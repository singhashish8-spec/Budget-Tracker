import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function TopBar() {
  const { state, go, openMenu, togglePrivacy } = useApp();
  if (state.screen === 'onboarding' || state.processing) return null;

  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 16, zIndex: 45, display: 'flex', gap: 8 }}>
      <button
        onClick={togglePrivacy}
        title={state.privacy ? 'Show balances' : 'Hide balances'}
        aria-label={state.privacy ? 'Show balances' : 'Hide balances'}
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
        <EyeIcon off={state.privacy} />
      </button>
      <button
        onClick={() => go('upload')}
        title="Add expense"
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(14,110,79,0.3)',
          color: colors.onPrimary,
          fontSize: 19,
        }}
      >
        <svg width="19" height="19" viewBox="0 0 30 30">
          <rect x="3" y="6" width="24" height="18" rx="4" stroke="#F7F4EE" strokeWidth="2.4" fill="none" />
          <circle cx="15" cy="15" r="5" stroke="#F7F4EE" strokeWidth="2.4" fill="none" />
          <rect x="11" y="3" width="8" height="4" rx="1.5" fill="#F7F4EE" />
        </svg>
      </button>
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

// Open eye when balances are visible; struck-through eye when they're hidden.
function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}
