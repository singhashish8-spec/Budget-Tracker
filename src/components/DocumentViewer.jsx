import { useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { colors } from '../theme/tokens';

// Full-screen look at a stored bill or warranty card.
//
// Images open right here, with tap-to-zoom (double-tap style: one tap toggles
// between fit-to-screen and 2.5x, and the zoomed image pans by scrolling).
//
// PDFs are a different story: Android's WebView will not render a PDF from a
// data: URL inline — you get a blank frame, which looks like data loss. So a PDF
// shows as a card and opens in the phone's real PDF app via the share sheet,
// which is both reliable and what people expect.
export default function DocumentViewer({ doc, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!doc) return null;

  const isPdf = (doc.mime || '').includes('pdf');
  const name = doc.name || (isPdf ? 'Document.pdf' : 'Bill');

  const openExternally = async () => {
    setBusy(true);
    setErr('');
    try {
      // data:<mime>;base64,<payload> — Filesystem wants just the payload.
      const base64 = String(doc.data).split(',')[1] || '';
      const safe = name.replace(/[^\w.-]+/g, '_');
      const filename = /\.[a-z0-9]{2,4}$/i.test(safe) ? safe : `${safe}${isPdf ? '.pdf' : '.jpg'}`;
      const written = await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache });
      await Share.share({ title: name, url: written.uri });
    } catch (e) {
      if (!/cancel/i.test(e?.message || '')) setErr("Couldn't open the document on this device.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(10,12,10,0.94)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 14px 12px', flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close" style={iconBtn}>✕</button>
        <div style={{ flex: 1, minWidth: 0, color: '#F2F4EE', fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
        <button onClick={openExternally} disabled={busy} style={{ ...iconBtn, width: 'auto', padding: '0 14px', fontSize: 13, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Opening…' : isPdf ? 'Open' : 'Share'}
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: isPdf ? 'center' : zoomed ? 'flex-start' : 'center', justifyContent: 'center', padding: 14, minHeight: 0 }}>
        {isPdf ? (
          <div style={{ textAlign: 'center', color: '#D8DCD2', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 54 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#F2F4EE' }}>{name}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.75 }}>
              PDFs open in your phone's document viewer. Your copy stays saved here and travels with your backup.
            </div>
            <button onClick={openExternally} disabled={busy} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '12px 24px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', border: 'none', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Opening…' : 'Open PDF'}
            </button>
          </div>
        ) : (
          <img
            src={doc.data}
            alt={name}
            onClick={() => setZoomed((z) => !z)}
            style={{
              maxWidth: zoomed ? 'none' : '100%',
              maxHeight: zoomed ? 'none' : '100%',
              width: zoomed ? '250%' : 'auto',
              objectFit: 'contain',
              borderRadius: zoomed ? 0 : 10,
              cursor: zoomed ? 'zoom-out' : 'zoom-in',
            }}
          />
        )}
      </div>

      {err && <div style={{ color: '#F3A9A0', fontSize: 13, textAlign: 'center', padding: '0 20px 10px' }}>{err}</div>}
      {!isPdf && (
        <div style={{ color: '#A9B0A2', fontSize: 12, textAlign: 'center', padding: '0 20px calc(env(safe-area-inset-bottom, 0px) + 14px)' }}>
          Tap the image to {zoomed ? 'fit it to the screen' : 'zoom in'}
        </div>
      )}
    </div>
  );
}

const iconBtn = {
  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
  background: 'rgba(255,255,255,0.14)', color: '#F2F4EE', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', fontSize: 15, fontWeight: 600,
};
