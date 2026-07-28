import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import * as haptics from '../services/haptics';

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
        onClick={() => { haptics.tap(); openMenu(); }}
        aria-label="Open menu"
        // Chrome, so it carries the material: a translucent button with no blur
        // would show the content behind it sharply, which reads as a bug rather
        // than as glass. It's a single element, so the cost is negligible.
        className="bt-material"
        style={{
          // 44px, not the 40 it was: this is the most-tapped control in the app
          // and it floats over content, so an undersized target here is felt.
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: colors.chromeSurface,
          color: colors.ink,
          border: `var(--hairline) solid ${colors.cardBorder}`,
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
