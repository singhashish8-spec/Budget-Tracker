import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

// Only the menu button floats over the screens now. The camera shortcut that
// used to sit beside it was a second way into "Scan a receipt" — already the
// first option under the + in the bottom nav — and being a fixed overlay it
// covered the top-right of every screen's own content.
export default function TopBar() {
  const { state, openMenu } = useApp();
  if (state.screen === 'onboarding' || state.processing) return null;

  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 16, zIndex: 45, display: 'flex', gap: 8 }}>
      <button
        onClick={openMenu}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: colors.cardSurface,
          color: colors.ink,
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(27,31,35,0.08)',
        }}
      >
        <svg width="18" height="14" viewBox="0 0 18 14">
          <path d="M1 1h16M1 7h16M1 13h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
