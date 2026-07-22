import { useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { alertCount } from '../state/selectors';

// The "+" opens a choice rather than jumping straight to the camera: most
// spending that needs adding by hand is cash, which has no receipt to scan.

const TABS = [
  { key: 'home', label: 'Home' },
  { key: 'transactions', label: 'Activity' },
  null, // center FAB slot
  { key: 'budgets', label: 'Budgets' },
  { key: 'insights', label: 'More' },
];

export default function BottomNav() {
  const { state, set, go: goTab } = useApp();
  const [choosing, setChoosing] = useState(false);
  const hasAlerts = alertCount(state.txns) > 0;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: colors.cardSurface,
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
            onClick={() => goTab(tab.key)}
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
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{tab.label}</span>
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
              onClick={() => setChoosing(true)}
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
                color: colors.onPrimary,
                fontSize: 26,
                lineHeight: 1,
              }}
              aria-label="Add a transaction"
            >
              +
            </button>
          </div>
        ),
      )}

      {choosing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setChoosing(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
          <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)', animation: 'sheetup 0.22s ease-out' }}>
            <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 16px' }} />
            <button
              onClick={() => {
                setChoosing(false);
                set({ addSheetOpen: true });
              }}
              style={choiceStyle}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Add manually</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Cash, or anything not tracked from SMS</div>
              </div>
            </button>
            <button
              onClick={() => {
                setChoosing(false);
                goTab('upload');
              }}
              style={{ ...choiceStyle, marginTop: 8 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Scan a receipt</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Photograph a bill and pull the details out</div>
              </div>
            </button>
            <button
              onClick={() => setChoosing(false)}
              style={{ width: '100%', marginTop: 12, padding: 13, borderRadius: 100, fontSize: 14.5, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const choiceStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 16,
  padding: '14px 16px',
};
