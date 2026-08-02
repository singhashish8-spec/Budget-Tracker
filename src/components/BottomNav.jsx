import { useState } from 'react';
import { colors, metrics } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import * as haptics from '../services/haptics';
import { alertCount } from '../state/selectors';
import { Icon } from './ui';

// The "+" opens a choice rather than jumping straight to the camera: most
// spending that needs adding by hand is cash, which has no receipt to scan.

// icon keys are Icon.jsx's own vocabulary (24px grid, 1.9px stroke) — the tab
// bar was the one place in the app still text-only while every other icon
// came from this same registry.
const TABS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'transactions', label: 'Activity', icon: 'receipt' },
  null, // center FAB slot
  { key: 'budgets', label: 'Budgets', icon: 'pie' },
  { key: 'insights', label: 'More', icon: 'grid' },
];
// Every slot (4 real tabs + the FAB) is an equal-width flex:1 column, so a
// slot's fraction of the row is just 1/TABS.length regardless of what's in
// it — that's what lets the indicator's translateX skip the FAB for free.
const SLOT_PCT = 100 / TABS.length;

export default function BottomNav() {
  const { state, set, go: goTab } = useApp();
  const [choosing, setChoosing] = useState(false);
  const hasAlerts = alertCount(state.txns) > 0;
  const activeSlot = TABS.findIndex((t) => t && t.key === state.screen);
  // 'reduced' keeps small tactile feedback (matches the rest of the app's
  // motion philosophy — see index.css); 'off' stills everything, including
  // the sliding indicator and the icon's settle-in scale.
  const motionOff = state.motionPref === 'off';

  return (
    <div
      className="bt-material"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: colors.chromeSurface,
        // No inline backdropFilter. It used to hardcode blur(12px), and because
        // an inline style beats a stylesheet that made the tab bar blur LESS
        // than the cards floating above it — backwards, and the opposite of iOS
        // where the chrome is the most strongly materialised surface. The blur
        // now comes from the .bt-material class above.
        borderTop: `var(--hairline) solid ${colors.divider}`,
        display: 'flex',
        alignItems: 'center',
        // UITabBar is 49pt of content sitting on top of the home-indicator inset.
        minHeight: metrics.tabBar,
        padding: '6px 8px calc(env(safe-area-inset-bottom, 0px) + 10px)',
      }}
    >
      {/* The active tab used to just recolour with no transition — nothing
          marked the moment you actually switched. transform, not left/width,
          so this never repaints; hidden (not just transparent) off a drill-down
          screen where no tab is really "active", matching what the labels
          already did by all going tertiary together. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 8,
          top: 6,
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10px)',
          width: `calc((100% - 16px) * ${SLOT_PCT / 100})`,
          borderRadius: 14,
          background: colors.primaryTint,
          transform: `translateX(${(activeSlot >= 0 ? activeSlot : 0) * 100}%)`,
          opacity: activeSlot >= 0 ? 1 : 0,
          transition: motionOff ? 'none' : 'transform 0.28s var(--ease-ios), opacity 0.18s ease',
          pointerEvents: 'none',
        }}
      />
      {TABS.map((tab) =>
        tab ? (
          <button
            key={tab.key}
            // Re-tapping the tab you're already on isn't a state change, so it
            // stays silent — buzzing on a no-op is what makes an app feel buzzy.
            onClick={() => {
              if (state.screen === tab.key) return;
              haptics.select();
              goTab(tab.key);
            }}
            aria-current={state.screen === tab.key ? 'page' : undefined}
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
            <Icon
              name={tab.icon}
              size={19}
              style={{
                transform: motionOff ? 'none' : `scale(${state.screen === tab.key ? 1.1 : 1})`,
                transition: motionOff ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{tab.label}</span>
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
              onClick={() => { haptics.tap(); setChoosing(true); }}
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
          <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '14px 14px 0 0', padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)', animation: 'sheetup 0.22s ease-out' }}>
            <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 16px' }} />
            <button
              onClick={() => {
                haptics.tap();
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
  borderRadius: 12,
  padding: '14px 16px',
};
