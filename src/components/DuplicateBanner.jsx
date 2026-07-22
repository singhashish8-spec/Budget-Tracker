import { useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { duplicateTxnIds } from '../state/selectors';

// Appears only when exact-duplicate bank-SMS transactions are detected (from the
// re-import bug). One tap, with a confirm step, removes the extra copies.
export default function DuplicateBanner() {
  const { state, cleanupDuplicates } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const count = duplicateTxnIds(state.txns).length;
  if (!count) return null;

  const run = async () => {
    setBusy(true);
    try { await cleanupDuplicates(); } finally { setBusy(false); setConfirming(false); }
  };

  return (
    <div style={{ background: colors.warningTint, border: `1px solid ${colors.warningBorder}`, borderRadius: 16, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: confirming ? 10 : 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.warningDark }}>{count} duplicate {count === 1 ? 'entry' : 'entries'} found</div>
          <div style={{ fontSize: 12.5, color: colors.warningDark, opacity: 0.85 }}>Same bank message counted more than once</div>
        </div>
        {!confirming && (
          <button
            onClick={() => setConfirming(true)}
            style={{ background: colors.warning, color: colors.onPrimary, borderRadius: 100, padding: '8px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
          >
            Clean up
          </button>
        )}
      </div>
      {confirming && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12.5, color: colors.warningDark }}>
            Remove {count} duplicate {count === 1 ? 'copy' : 'copies'}? One of each is kept, and your cash entries aren't touched.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirming(false)} disabled={busy} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={run} disabled={busy} style={{ flex: 1, background: colors.warning, color: colors.onPrimary, borderRadius: 100, padding: 10, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Removing…' : `Remove ${count}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}
