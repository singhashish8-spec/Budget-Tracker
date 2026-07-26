import { colors } from '../theme/tokens';
import * as haptics from '../services/haptics';

// A blocking yes/no for things that can't be undone — deleting a warranty, or
// removing the only copy of a bill. Destructive actions used to happen on a
// single stray tap, which is exactly the wrong behaviour for a document you may
// need years later.
export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', cancelLabel = 'Keep', destructive = true, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.55)' }} />
      <div
        role="alertdialog"
        aria-modal="true"
        style={{
          position: 'relative', background: colors.bgApp, borderRadius: 20, padding: '20px 20px 16px',
          maxWidth: 360, width: '100%', boxShadow: '0 16px 44px rgba(0,0,0,0.28)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>{title}</div>
        {message && <div style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.5 }}>{message}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: 100, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { haptics.error(); onConfirm(); }}
            style={{
              flex: 1, borderRadius: 100, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
              background: destructive ? colors.danger : colors.primary, color: '#FFFFFF', border: 'none',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
