import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function TopBar() {
  const { state, go, openMenu } = useApp();
  if (state.screen === 'onboarding' || state.processing) return null;

  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', right: 16, zIndex: 45, display: 'flex', gap: 8 }}>
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
          color: colors.bgApp,
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
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${colors.cardBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(27,31,35,0.08)',
        }}
      >
        <svg width="18" height="14" viewBox="0 0 18 14">
          <path d="M1 1h16M1 7h16M1 13h10" stroke="#1B1F23" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
