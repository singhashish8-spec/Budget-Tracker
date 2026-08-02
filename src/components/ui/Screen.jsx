import { useRef, useState } from 'react';
import { spacing, colors } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

// How far a pull travels before release commits to a refresh, and the (lower)
// resting height the spinner settles to once the fetch is actually running —
// iOS's own pull-to-refresh does the same two-stage move rather than snapping
// straight back to 0 while work is still in flight.
const PULL_TRIGGER = 64;
const PULL_MAX = 96;
const PULL_SETTLE = 44;

// The scroll container every screen sits in. The padding string
// `calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px` was previously
// retyped verbatim in ~18 files — the top offset clears the floating TopBar,
// the bottom clears the BottomNav plus the gesture bar.
//
// `onRefresh`, when passed, turns on a drag-down-at-scroll-top gesture: pull
// past PULL_TRIGGER and release to await onRefresh(). Everything moves on
// `transform` only (never top/height) so the drag never triggers layout.
export default function Screen({ gap = 14, style, children, onRefresh, ...rest }) {
  const scrollRef = useRef(null);
  const drag = useRef({ active: false, pulling: false, startY: 0 });
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (e) => {
    if (!onRefresh || refreshing) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { active: true, pulling: false, startY: e.clientY };
  };

  const onPointerMove = (e) => {
    if (!onRefresh || refreshing || !drag.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    const dy = e.clientY - drag.current.startY;
    if (!drag.current.pulling) {
      // Only claim the gesture once we're sure it's a downward pull at the
      // very top of the list — anything else (an upward flick, or any drag
      // once already scrolled down) stays a normal scroll.
      if (el.scrollTop > 0 || dy <= 8) return;
      drag.current.pulling = true;
      setDragging(true);
      el.setPointerCapture?.(e.pointerId);
    }
    e.preventDefault();
    const over = Math.max(0, dy - 8);
    // Rubber-band: each extra px of finger travel buys less list travel the
    // further past the trigger you go, so the gesture never feels like it
    // could scroll forever.
    const damped = over < PULL_TRIGGER ? over : PULL_TRIGGER + (over - PULL_TRIGGER) * 0.35;
    setPullY(Math.min(PULL_MAX, damped));
  };

  const endPull = async (e) => {
    if (!drag.current.pulling) { drag.current.active = false; return; }
    drag.current.active = false;
    drag.current.pulling = false;
    setDragging(false);
    if (e?.pointerId != null) scrollRef.current?.releasePointerCapture?.(e.pointerId);
    if (pullY >= PULL_TRIGGER) {
      haptics.select();
      setPullY(PULL_SETTLE);
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullY(0);
      }
    } else {
      setPullY(0);
    }
  };

  return (
    <div
      ref={scrollRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPull}
      onPointerCancel={endPull}
      style={{
        flex: 1,
        overflowY: 'auto',
        // Nothing should ever scroll the page sideways. One over-wide child (a
        // long chip row, an unbreakable merchant name) used to drag the whole
        // screen horizontally, and because the top bar and tab bar are fixed
        // they stayed put while the content slid out from under them — every
        // heading and card clipped at the left edge. Anything that genuinely
        // needs to scroll horizontally does it in its own .bt-hscroll strip.
        overflowX: 'hidden',
        // Without this, Chrome's own native overscroll pull-to-refresh (or a
        // bounce/glow) fights this custom one for the same gesture.
        overscrollBehaviorY: onRefresh ? 'contain' : undefined,
        position: 'relative',
        padding: `calc(env(safe-area-inset-top, 0px) + ${spacing.screenTop}px) ${spacing.screenSide}px ${spacing.screenBottom}px`,
        ...style,
      }}
      {...rest}
    >
      {onRefresh && (pullY > 0 || refreshing) && (
        <div
          aria-hidden="true"
          className="bt-pull-indicator"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            display: 'flex',
            justifyContent: 'center',
            transform: `translateY(${pullY - PULL_TRIGGER}px)`,
            opacity: Math.min(1, pullY / (PULL_TRIGGER * 0.6)),
            transition: dragging ? 'none' : 'transform 0.28s var(--ease-ios), opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: colors.cardSurface,
              border: `1px solid ${colors.cardBorder}`,
              boxShadow: '0 2px 8px rgba(16,20,24,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              className="bt-pull-spin"
              style={{
                transform: refreshing ? undefined : `rotate(${Math.min(1, pullY / PULL_TRIGGER) * 300}deg)`,
                transition: dragging ? 'none' : 'transform 0.2s ease',
                animation: refreshing ? 'spin 0.7s linear infinite' : 'none',
              }}
            >
              <path
                d="M8 2a6 6 0 1 1-5.2 3"
                stroke={colors.primary}
                strokeWidth="1.8"
                fill="none"
                strokeLinecap="round"
              />
              <path d="M2.4 2v3.4h3.4" stroke={colors.primary} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      )}
      <div
        className="bt-pull-content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap,
          transform: pullY ? `translateY(${pullY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.28s var(--ease-ios)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
