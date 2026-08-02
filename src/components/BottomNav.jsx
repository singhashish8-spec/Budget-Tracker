import { useRef, useState } from 'react';
import { colors, metrics, radii, nest } from '../theme/tokens';
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

// How long the FAB takes to grow into the sheet (and shrink back on close),
// and how much of that window the #bt-goo filter stays applied — just long
// enough to soften the circle-to-rounded-rect corner interpolation into
// something that reads as melting rather than snapping, cleared well before
// the sheet's own content becomes visible so text is never seen through a
// blur filter.
const MORPH_MS = 380;
const GOO_MS = 220;
// Rounder than the app's normal 14px sheet radius (radii.sheet) on purpose —
// this surface is growing out of a full circle, so a tight corner would read
// as the shape snapping into a rectangle rather than continuing to relax
// outward. The choice card inside is sized FROM this radius via nest(), not
// picked independently, so the two curves stay concentric on purpose
// (finding #07) instead of two numbers that happen to both look "rounded".
const MORPH_RADIUS = 24;

export default function BottomNav() {
  const { state, set, go: goTab } = useApp();
  const [choosing, setChoosing] = useState(false);
  const [morphOrigin, setMorphOrigin] = useState(null);
  const [morphed, setMorphed] = useState(false);
  const [goo, setGoo] = useState(false);
  const fabRef = useRef(null);
  const gooTimer = useRef(null);
  const hasAlerts = alertCount(state.txns) > 0;
  const activeSlot = TABS.findIndex((t) => t && t.key === state.screen);
  // 'reduced' keeps small tactile feedback (matches the rest of the app's
  // motion philosophy — see index.css); 'off' stills everything, including
  // the sliding indicator and the icon's settle-in scale.
  const motionOff = state.motionPref === 'off';

  const openChoosing = () => {
    haptics.tap();
    if (motionOff) { setChoosing(true); return; }
    const r = fabRef.current?.getBoundingClientRect();
    setMorphOrigin(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    setChoosing(true);
    setMorphed(false);
    setGoo(true);
    // Double rAF: guarantees the browser has actually painted the circle's
    // starting frame before the next state flip animates away from it —
    // otherwise React can batch both updates into a single paint and the
    // transition never plays, it just jumps straight to the end state.
    requestAnimationFrame(() => requestAnimationFrame(() => setMorphed(true)));
    clearTimeout(gooTimer.current);
    gooTimer.current = setTimeout(() => setGoo(false), GOO_MS);
  };

  const closeChoosing = () => {
    if (motionOff) { setChoosing(false); return; }
    setMorphed(false);
    setGoo(true);
    clearTimeout(gooTimer.current);
    gooTimer.current = setTimeout(() => { setChoosing(false); setGoo(false); }, MORPH_MS);
  };

  const sheetBody = (
    <>
      <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 16px' }} />
      <button
        onClick={() => {
          haptics.tap();
          if (motionOff) setChoosing(false); else closeChoosing();
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
        onClick={motionOff ? () => setChoosing(false) : closeChoosing}
        style={{ width: '100%', marginTop: 12, padding: 13, borderRadius: 100, fontSize: 14.5, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer' }}
      >
        Cancel
      </button>
    </>
  );

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
              ref={fabRef}
              onClick={openChoosing}
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
                // The morph ghost below paints exactly over this button while
                // it's open — hidden (not just occluded) so the two "+"
                // glyphs never double-render, and so it drops out of hit
                // testing and the a11y tree while it's not the real target.
                visibility: choosing && !motionOff ? 'hidden' : 'visible',
              }}
              aria-label="Add a transaction"
            >
              +
            </button>
          </div>
        ),
      )}

      {choosing && motionOff && (
        // Reduced-motion path: no morph, no filter — the sheet just appears.
        <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div onClick={() => setChoosing(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
          <div style={{ position: 'relative', background: colors.bgApp, borderRadius: `${radii.sheet}px ${radii.sheet}px 0 0`, padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
            {sheetBody}
          </div>
        </div>
      )}

      {choosing && !motionOff && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
          <div
            onClick={closeChoosing}
            style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)', opacity: morphed ? 1 : 0, transition: 'opacity 0.28s ease' }}
          />
          {/* The FAB itself, mid-flight: starts pinned exactly over the real
              button (captured via fabRef) as a 54px circle, then grows into
              the bottom sheet. One element, one continuous shape — not a
              button that vanishes and an unrelated sheet that slides up. */}
          <div
            id="bt-fab-morph-ghost"
            className={goo ? 'bt-fab-morph' : undefined}
            style={{
              position: 'fixed',
              ...(morphed
                ? { top: 'auto', left: 0, right: 0, bottom: 0, width: 'auto', height: 'auto', borderRadius: `${MORPH_RADIUS}px ${MORPH_RADIUS}px 0 0` }
                : morphOrigin
                  ? { top: morphOrigin.top, left: morphOrigin.left, width: morphOrigin.width, height: morphOrigin.height, borderRadius: '50%' }
                  : { left: 0, right: 0, bottom: 0, borderRadius: `${MORPH_RADIUS}px ${MORPH_RADIUS}px 0 0` }),
              background: morphed ? colors.bgApp : colors.primary,
              overflow: 'hidden',
              boxShadow: morphed ? '0 -10px 34px rgba(0,0,0,0.20)' : '0 8px 20px rgba(14,110,79,0.4)',
              transition: [
                'top 0.38s var(--ease-ios)', 'left 0.38s var(--ease-ios)', 'right 0.38s var(--ease-ios)',
                'bottom 0.38s var(--ease-ios)', 'width 0.38s var(--ease-ios)', 'height 0.38s var(--ease-ios)',
                'border-radius 0.38s var(--ease-ios)', 'background-color 0.38s var(--ease-ios)', 'box-shadow 0.38s var(--ease-ios)',
              ].join(', '),
            }}
          >
            {/* The FAB's own glyph, positioned to exactly match the real
                button underneath, crossfading out as the sheet content
                crossfades in — this is what sells "the button grew" rather
                than "the button vanished and something else appeared." */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: colors.onPrimary, fontSize: 26, lineHeight: 1,
                opacity: morphed ? 0 : 1, transition: 'opacity 0.2s ease', pointerEvents: 'none',
              }}
            >
              +
            </div>
            <div style={{ opacity: morphed ? 1 : 0, transition: 'opacity 0.2s ease', padding: '20px 16px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
              {sheetBody}
            </div>
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
  // Derived from the morph sheet's own radius (MORPH_RADIUS) and its 16px
  // body padding via nest(), not picked independently — see #07.
  borderRadius: nest(MORPH_RADIUS, 16),
  padding: '14px 16px',
};
