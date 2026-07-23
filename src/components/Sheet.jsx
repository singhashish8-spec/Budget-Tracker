import { colors } from '../theme/tokens';

// The one-handed bottom sheet used by every popup in the app. Three regions:
//   • a FROZEN header that never scrolls (read-only context — always visible),
//   • a scrollable body in the middle,
//   • a pinned footer in the bottom thumb-zone for the primary actions.
// Because the sheet rises from the bottom and its actions live at the bottom,
// the whole thing stays reachable with one hand (Samsung One UI style). Callers
// pass `header`, `children` (body) and optional `footer`.
export default function Sheet({ onClose, header, children, footer, maxHeight = '90vh' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.45)' }} />
      <div
        style={{
          position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0',
          maxHeight, display: 'flex', flexDirection: 'column', minHeight: 0,
          animation: 'sheetup 0.24s cubic-bezier(0.2,0.75,0.3,1)', boxShadow: '0 -10px 34px rgba(0,0,0,0.20)',
        }}
      >
        {/* Grabber */}
        <div style={{ padding: '10px 0 2px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto' }} />
        </div>

        {/* Frozen header — read-only context, always visible while the body scrolls. */}
        {header != null && (
          <div style={{ flexShrink: 0, padding: '8px 16px 12px', borderBottom: `1px solid ${colors.divider}` }}>{header}</div>
        )}

        {/* Scrollable body. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', minHeight: 0 }}>{children}</div>

        {/* Pinned footer — the primary tap targets, in the thumb-zone. */}
        {footer != null && (
          <div style={{ flexShrink: 0, padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)', borderTop: `1px solid ${colors.divider}`, background: colors.bgApp }}>{footer}</div>
        )}
      </div>
    </div>
  );
}
