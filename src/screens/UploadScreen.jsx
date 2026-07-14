import { useRef } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { extractTransactions } from '../services/aiExtract';

function base64ToFile(base64, format) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const type = `image/${format === 'jpg' ? 'jpeg' : format}`;
  return new File([arr], `capture.${format}`, { type });
}

export default function UploadScreen() {
  const { state, set, go, showToast } = useApp();
  const pickRef = useRef(null);

  const runExtract = async (file) => {
    set({ processing: true, procTitle: `Reading ${file.name}…`, procSub: 'Preparing file' });
    try {
      set({ procSub: 'AI is reading the transactions' });
      const validIds = state.categories.map((c) => c.id);
      const { transactions, truncated } = await extractTransactions(file, validIds);
      if (!Array.isArray(transactions) || !transactions.length) throw new Error('No transactions found in this file');

      const valid = state.categories.map((c) => c.id);
      const stamp = Date.now();
      const imported = transactions
        .map((t, i) => ({
          id: `u${stamp}-${i}`,
          merchant: String(t.merchant || 'Unknown').slice(0, 48),
          account: `Imported · ${file.name.slice(0, 24)}`,
          date: String(t.date || 'Today').slice(0, 12),
          amount: Math.abs(Number(t.amount)) || 0,
          cat: valid.includes(t.category) ? t.category : null,
          type: t.type === 'income' ? 'income' : 'expense',
        }))
        .filter((t) => t.amount > 0);

      if (!imported.length) throw new Error('No transactions found in this file');

      set({ processing: false, screen: 'review', reviewImported: imported, reviewSource: file.name });
      if (truncated) showToast('This file was large — only the first part was read, so some transactions may be missing');
    } catch (err) {
      set({ processing: false });
      showToast(err?.message || 'Couldn’t read that file');
    }
  };

  const captureBill = async () => {
    try {
      const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Camera, quality: 80 });
      if (!photo.base64String) return;
      await runExtract(base64ToFile(photo.base64String, photo.format || 'jpeg'));
    } catch (err) {
      if (err?.message && !/cancel/i.test(err.message)) showToast('Couldn’t open the camera');
    }
  };

  const onPickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runExtract(file);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        ref={pickRef}
        type="file"
        accept="image/*,.pdf,.html,.htm,.xls,.xlsx,.csv"
        onChange={onPickFile}
        style={{ display: 'none' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={() => go('home')} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Add expenses</div>
      </div>

      <button onClick={captureBill} style={{ background: colors.primary, borderRadius: 20, padding: '22px 18px', color: colors.bgApp, cursor: 'pointer', textAlign: 'left', border: 'none' }}>
        <svg width="30" height="30" viewBox="0 0 30 30" style={{ marginBottom: 10 }}>
          <rect x="3" y="6" width="24" height="18" rx="4" stroke="#F7F4EE" strokeWidth="2" fill="none" />
          <circle cx="15" cy="15" r="5" stroke="#F7F4EE" strokeWidth="2" fill="none" />
          <rect x="11" y="3" width="8" height="4" rx="1.5" fill="#F7F4EE" />
        </svg>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600 }}>Scan a bill</div>
        <div style={{ fontSize: 13.5, color: colors.accentGreen3, marginTop: 3 }}>Point your camera at a receipt or bill</div>
      </button>

      <button onClick={() => pickRef.current?.click()} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '22px 18px', cursor: 'pointer', textAlign: 'left' }}>
        <svg width="30" height="30" viewBox="0 0 30 30" style={{ marginBottom: 10 }}>
          <path d="M8 3h10l6 6v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="#0E6E4F" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path d="M18 3v6h6" stroke="#0E6E4F" strokeWidth="2" fill="none" strokeLinejoin="round" />
          <path d="M15 13v8m0-8l-3 3m3-3l3 3" stroke="#0E6E4F" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600 }}>Upload a file</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginTop: 3 }}>Image, PDF, HTML, Excel or CSV — bill or statement</div>
      </button>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary }}>How it works</div>
        <Step n={1} text="Upload any bill, receipt or statement" />
        <Step n={2} text="We read every transaction and detect its category automatically" />
        <Step n={3} text={<span>Anything we can't recognise is <span style={{ color: colors.danger, fontWeight: 600 }}>flagged red</span> so you can sort it yourself</span>} danger />
      </div>
    </div>
  );
}

function Step({ n, text, danger }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: danger ? colors.dangerTint : colors.successTint,
          color: danger ? colors.danger : colors.primary,
          fontSize: 12.5,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.45 }}>{text}</div>
    </div>
  );
}

const backBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15">
      <path d="M8 1L2 7.5 8 14" stroke="#1B1F23" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
