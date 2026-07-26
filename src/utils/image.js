// Turn a picked file into something we can store in the database.
//
// Documents live inline in SQLite rather than as loose files on disk, because
// the whole point of keeping a bill is that it survives — inline means it rides
// along in the backup, so a new phone still has the invoice when the fridge
// dies in month 22. The cost is size, so images are downscaled hard and PDFs
// are capped.

export const MAX_PDF_BYTES = 3 * 1024 * 1024; // ~3 MB of actual PDF

export function fileToCompressedDataUrl(file, { maxEdge = 1400, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Not an image file'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (e) {
          reject(e);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

// Accepts an image or a PDF (bills routinely arrive as a PDF by email) and
// returns the row we store: { name, mime, data }.
export async function fileToStoredDocument(file) {
  if (!file) throw new Error('No file chosen');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');

  if (isPdf) {
    if (file.size > MAX_PDF_BYTES) {
      throw new Error(`That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please attach one under 3 MB, or take a photo of the bill instead.`);
    }
    return { name: file.name || 'Bill.pdf', mime: 'application/pdf', data: await readAsDataUrl(file) };
  }

  if (!file.type?.startsWith('image/')) {
    throw new Error('Attach a photo or a PDF');
  }
  return { name: file.name || 'Bill photo', mime: 'image/jpeg', data: await fileToCompressedDataUrl(file) };
}

// Rough on-disk size of a base64 data URL, for showing what documents cost.
export function dataUrlBytes(dataUrl) {
  const b64 = String(dataUrl || '').split(',')[1] || '';
  return Math.round((b64.length * 3) / 4);
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
