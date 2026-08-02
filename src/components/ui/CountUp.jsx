import { useEffect, useRef } from 'react';
import Amount from '../Amount';
import { makeFrameGate } from '../../services/frameRate';

// A money figure that counts up to its value instead of hard-cutting to it.
// Reserved for the few headline numbers (the Home hero, a screen's summary
// total) — animating every amount in a list would be noise, not polish.
//
// Honours the motion setting the same way the CSS does: `data-motion='off'` or
// the OS's prefers-reduced-motion means the value simply appears. It also skips
// the animation when the delta is trivial, so a re-render that nudges a figure
// by a rupee doesn't visibly re-roll it.

const DURATION = 620;
const MIN_DELTA = 2;

// "Reduced" counts as reduced: everything else animated in the app stills for
// both 'reduced' and 'off' (see .bt-bar-fill, .bt-collapse, .screen-enter in
// index.css). A hero figure still rolling while every bar around it is frozen
// would be the one thing ignoring the user's setting.
function motionAllowed() {
  if (typeof window === 'undefined') return false;
  const level = document.documentElement.getAttribute('data-motion');
  if (level === 'off' || level === 'reduced') return false;
  return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// Ease-out cubic: fast to begin, settling at the end — reads as the number
// "landing" rather than ticking mechanically.
const easeOut = (t) => 1 - (1 - t) ** 3;

export default function CountUp({ value, format, style, className, frameRate = 'auto' }) {
  const target = Number.isFinite(value) ? value : 0;
  // What's actually on screen right now. Tracked in a ref rather than state
  // because an interrupted animation has to resume from the figure the user can
  // SEE — reading the interrupted run's target instead would make the number
  // visibly jump forward before carrying on (two quick adds inside the 620ms
  // window is enough to trigger it).
  const shownRef = useRef(target);
  const rafRef = useRef(0);
  const nodeRef = useRef(null);

  // The figure is written straight to the DOM node instead of through state.
  //
  // The previous version called setState on every animation frame, so a 620ms
  // count ran ~37 full React render-and-reconcile cycles just to change one text
  // node — all of it competing for the main thread with whatever else was
  // animating at the time. Writing textContent is the same pixels for none of
  // that work, and it's safe here precisely because this value is transient: it
  // is re-derived from `value` on every real render, so React never has stale
  // state to disagree with.
  const paint = (n) => {
    if (nodeRef.current) nodeRef.current.textContent = format(Math.round(n));
  };

  // Paint the committed value on every render so React-driven updates (a new
  // target, a currency change) are never left showing a stale figure.
  useEffect(() => {
    paint(shownRef.current);
  });

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return undefined;

    if (!motionAllowed() || Math.abs(target - from) < MIN_DELTA) {
      shownRef.current = target;
      paint(target);
      return undefined;
    }

    // Honour the frame-rate cap: on a 120Hz panel held to 60, this halves the
    // work with no visible difference to a number easing over 620ms.
    const gate = makeFrameGate(frameRate);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      // The final frame always paints, cap or no cap — stopping a count one
      // frame early would leave a visibly wrong total on screen.
      if (gate(now) || t === 1) {
        const v = t === 1 ? target : from + (target - from) * easeOut(t);
        shownRef.current = v;
        paint(v);
      }
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, frameRate]);

  // Rendered with the initial figure so there is never an empty frame before
  // the first effect runs; every update after that goes through `paint`.
  return (
    <Amount ref={nodeRef} style={style} className={className}>
      {format(Math.round(shownRef.current))}
    </Amount>
  );
}
