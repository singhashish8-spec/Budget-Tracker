// Client-side file→text/base64 helpers feeding the AI import pipeline.
// Ported from the design prototype's extractTxns/xlsxToText/unzip, with
// bounds checks added to the zip reader (the original trusted central-
// directory offsets/sizes without validating them against buffer length).

const MAX_INPUT_CHARS = 60000;

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('Couldn’t read the file'));
    r.readAsDataURL(file);
  });
}

export function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

// Returns { text, truncated } — callers must surface `truncated` to the user
// rather than silently dropping the tail of a large statement.
export function capText(text) {
  const truncated = text.length > MAX_INPUT_CHARS;
  return { text: text.slice(0, MAX_INPUT_CHARS), truncated };
}

async function unzip(buf) {
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const len = buf.byteLength;
  let i = len - 22;
  while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
  if (i < 0) throw new Error('Not a valid .xlsx (zip) file');

  const count = dv.getUint16(i + 10, true);
  let off = dv.getUint32(i + 16, true);
  const dirs = [];
  const td = new TextDecoder();

  for (let e = 0; e < count; e++) {
    if (off + 46 > len || dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true);
    const elen = dv.getUint16(off + 30, true);
    const clen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    if (off + 46 + nlen > len) break;
    dirs.push({ name: td.decode(u8.subarray(off + 46, off + 46 + nlen)), method, csize, lho });
    off += 46 + nlen + elen + clen;
  }

  const out = {};
  for (const ent of dirs) {
    if (!/\.xml$/.test(ent.name)) continue;
    if (ent.lho + 30 > len) continue;
    const lnlen = dv.getUint16(ent.lho + 26, true);
    const lelen = dv.getUint16(ent.lho + 28, true);
    const start = ent.lho + 30 + lnlen + lelen;
    const end = start + ent.csize;
    if (start < 0 || end > len || start > end) continue;
    const data = u8.slice(start, end);
    if (ent.method === 0) {
      out[ent.name] = data;
      continue;
    }
    try {
      const ds = new DecompressionStream('deflate-raw');
      const ab = await new Response(new Blob([data]).stream().pipeThrough(ds)).arrayBuffer();
      out[ent.name] = new Uint8Array(ab);
    } catch {
      // corrupt/unsupported entry — skip it rather than failing the whole import
    }
  }
  return out;
}

export async function xlsxToText(file) {
  let entries;
  try {
    entries = await unzip(await file.arrayBuffer());
  } catch {
    throw new Error('Old .xls format — save it as .xlsx or CSV and retry');
  }
  const dec = new TextDecoder();
  const sst = [];
  if (entries['xl/sharedStrings.xml']) {
    const xml = dec.decode(entries['xl/sharedStrings.xml']);
    (xml.match(/<si>[\s\S]*?<\/si>/g) || []).forEach((si) => {
      sst.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
    });
  }
  let out = '';
  Object.keys(entries)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort()
    .forEach((k) => {
      const xml = dec.decode(entries[k]);
      (xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []).forEach((row) => {
        const cells = [];
        (row.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []).forEach((c) => {
          const shared = /t="s"/.test(c);
          const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          const inline = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
          let val = inline !== undefined ? inline : v;
          if (shared && v !== undefined) val = sst[parseInt(v, 10)] !== undefined ? sst[parseInt(v, 10)] : v;
          if (val !== undefined) cells.push(val);
        });
        if (cells.length) out += cells.join('\t') + '\n';
      });
    });
  if (!out.trim()) throw new Error('Couldn’t find any rows in that sheet');
  return out;
}
