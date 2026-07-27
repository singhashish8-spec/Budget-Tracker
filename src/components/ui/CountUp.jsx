import { useEffect, useRef, useState } from 'react';
import Amount from '../Amount';

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

export default function CountUp({ value, format, style, className }) {
  const target = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(target);
  // What's actually on screen right now. Tracked in a ref as well as state
  // because an interrupted animation has to resume from the figure the user can
  // SEE — reading the interrupted run's target instead would make the number
  // visibly jump forward before carrying on (two quick adds inside the 620ms
  // window is enough to trigger it).
  const shownRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return undefined;

    if (!motionAllowed() || Math.abs(target - from) < MIN_DELTA) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }

    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      const v = t === 1 ? target : from + (target - from) * easeOut(t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return (
    <Amount style={style} className={className}>
      {format(Math.round(shown))}
    </Amount>
  );
}
