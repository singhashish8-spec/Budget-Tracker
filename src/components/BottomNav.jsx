import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { alertCount } from '../state/selectors';

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'transactions', label: 'Activity' },
  null, // center FAB slot
  { key: 'budgets', label: 'Budgets' },
];

export default function BottomNav() {
  const { state, go } = useApp();
  const hasAlerts = alertCount(state.txns) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(12px)',
        borderTop: `1px solid ${colors.cardBorder}`,
        display: 'flex',
        alignItems: 'center',
        padding: '8px 8px calc(env(safe-area-inset-bottom, 0px) + 14px)',
      }}
    >
      {TABS.map((tab, i) =>
        tab ? (
          <button
            key={tab.key}
            onClick={() => go(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              cursor: 'pointer',
              color: state.screen === tab.key ? colors.primary : colors.textTertiary,
              padding: '4px 0',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 600 }}>{tab.label}</span>
            {tab.key === 'transactions' && hasAlerts && (
              <div
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 24,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colors.danger,
                }}
              />
            )}
          </button>
        ) : (
          <div key="fab" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => go('upload')}
              style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginTop: -26,
                boxShadow: '0 8px 20px rgba(14,110,79,0.4)',
                border: `4px solid ${colors.bgApp}`,
                color: colors.bgApp,
                fontSize: 26,
                lineHeight: 1,
              }}
              aria-label="Add expense"
            >
              +
            </button>
          </div>
        ),
      )}
    </div>
  );
}
