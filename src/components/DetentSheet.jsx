import { useCallback, useEffect, useRef, useState } from 'react';
import { colors, radii } from '../theme/tokens';
import * as haptics from '../services/haptics';

// An iOS-style bottom sheet with two resting heights ("detents"):
//   • half  — opens here, enough to read the summary one-handed
//   • full  — drag up (or flick) to fill the screen
// Dragging down goes full → half → dismissed, and the dismiss fades the whole
// sheet out rather than snapping it away.
//
// The hard part is telling a sheet-drag from a content-scroll. Rule: the sheet
// only follows your finger when the body is already scrolled to the top and you
// are pulling DOWN, or when you grab the header/grabber area. Otherwise the
// touch belongs to the list inside. Get this wrong and the sheet feels broken,
// so the check is deliberately conservative.
//
// Respects the app's motion preference: with motion off the detents snap with
// no transition, and the drag still works.

const HALF = 0.55; // fraction of the viewport the half detent occupies
const FULL = 0.94;
// How far past a detent you must drag before it commits to the next one, and
// the flick speed that commits regardless of distance.
const COMMIT_PX = 60;
const FLICK_VELOCITY = 0.5; // px per ms

export default function DetentSheet({ onClose, header, children, footer, motion = 'on' }) {
  const animated = motion !== 'off';
  const [detent, setDetent] = useState('half'); // 'half' | 'full'
  const [dragY, setDragY] = useState(0); // live finger offset while dragging
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  const bodyRef = useRef(null);
  const drag = useRef(null); // { startY, startT, from, active }

  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const heightFor = (d) => Math.round(vh * (d === 'full' ? FULL : HALF));

  // Play the entrance on the first frame after mount so it animates in.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback(() => {
    if (!animated) { onClose(); return; }
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose, animated]);

  // Android back / Escape closes the sheet rather than the screen behind it.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const atTop = () => (bodyRef.current?.scrollTop ?? 0) <= 0;

  // Pointer Events, not Touch Events: React 19 unconditionally registers its
  // touchstart/touchmove/wheel root listeners as { passive: true } (verified
  // against node_modules/react-dom's own source — pointer events are not in
  // that forced list), which made onTouchMove's e.preventDefault() below a
  // silent no-op — the browser's own native scroll/overscroll on the sheet
  // body never actually stopped, so it and the sheet's own transform-driven
  // motion could run at once instead of the sheet cleanly tracking the
  // finger. ui/Screen.jsx's pull-to-refresh already uses Pointer Events for
  // exactly this reason; this follows the same, already-proven pattern.
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { startY: e.clientY, startT: Date.now(), from: detent, active: false, fromHandle: false, pointerId: e.pointerId };
  };

  const onHandlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Stop this from bubbling to the sheet's own onPointerDown below — the
    // grabber/header sit inside the sheet div, so without this the event
    // reached the parent handler right after this one and immediately
    // overwrote the `active: true` just set here back to `false`, silently
    // undoing "the grabber always drags the sheet" (verified: confirmed
    // pointerdown bubbles child-then-parent in this DOM shape). Present in
    // both the old touch-event version and this one until now.
    e.stopPropagation();
    drag.current = { startY: e.clientY, startT: Date.now(), from: detent, active: true, fromHandle: true, pointerId: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.startY;

    if (!d.active) {
      // Claim the gesture only when the body can't scroll any further up, or
      // (dragging up from half) there's no more sheet above to scroll into.
      // Anything else stays a plain scroll, untouched.
      const candidateDown = dy > 0 && atTop();
      const candidateUp = dy < 0 && d.from === 'half';
      if (!candidateDown && !candidateUp) return;
      // Prevent the browser from committing this touch sequence to its own
      // native scroll before deciding whether to treat it as a sheet-drag —
      // same reasoning and pattern as ui/Screen.jsx's pull-to-refresh fix
      // (docs/history/findings.md): claim it on the first qualifying pixel,
      // not only once past the commit threshold below.
      if (e.cancelable) e.preventDefault();
      if (Math.abs(dy) <= 6) return;
      d.active = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }
    // Above the full detent the sheet resists rather than flying off-screen.
    const resisted = dy < 0 && detent === 'full' ? dy * 0.25 : dy;
    setDragY(resisted);
    if (e.cancelable) e.preventDefault();
  };

  const onPointerUp = (e) => {
    const d = drag.current;
    drag.current = null;
    if (d?.pointerId != null) {
      try { e.currentTarget.releasePointerCapture?.(d.pointerId); } catch { /* already released */ }
    }
    if (!d || !d.active) { setDragY(0); return; }

    const dy = dragY;
    const velocity = dy / Math.max(1, Date.now() - d.startT);
    const flickDown = velocity > FLICK_VELOCITY;
    const flickUp = velocity < -FLICK_VELOCITY;
    setDragY(0);

    // Landing on a detent is a physical event — the sheet stops moving against
    // your finger — so it's exactly the kind of state change that should tick.
    // Without it the snap reads as the sheet "slipping" rather than clicking
    // into place. Nothing fires when the drag falls short and springs back:
    // that isn't a change.
    if (d.from === 'full') {
      if (flickDown || dy > COMMIT_PX) { haptics.select(); setDetent('half'); }
      return;
    }
    // from half
    if (flickUp || dy < -COMMIT_PX) { haptics.select(); setDetent('full'); return; }
    if (flickDown || dy > COMMIT_PX) { haptics.select(); close(); }
  };

  const height = heightFor(detent);
  // Before mount the sheet sits fully below the fold, so it slides up into place.
  const offset = !mounted || closing ? height : Math.max(0, dragY);
  const dragging = drag.current?.active;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div
        onClick={close}
        style={{
          position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.45)',
          opacity: !mounted || closing ? 0 : 1,
          transition: animated ? 'opacity 0.22s ease' : 'none',
        }}
      />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="bt-material bt-sheet"
        style={{
          position: 'relative',
          // Chrome, not page background — see the note in Sheet.jsx.
          background: colors.chromeSurface,
          borderRadius: `${radii.sheet}px ${radii.sheet}px 0 0`,
          height,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          transform: `translateY(${offset}px)`,
          opacity: closing ? 0 : 1,
          // No transition while the finger is down — the sheet must track it 1:1.
          transition: dragging || !animated
            ? 'none'
            : 'transform 0.38s var(--ease-ios), height 0.38s var(--ease-ios), opacity 0.24s ease',
          // Shadow lives in .bt-sheet (CSS) so it can't override the glass
          // specular highlight the way an inline boxShadow would.
          willChange: 'transform',
        }}
      >
        {/* Grabber — always drags the sheet, whatever the body is doing. */}
        <div
          onPointerDown={onHandlePointerDown}
          onClick={() => { haptics.select(); setDetent(detent === 'half' ? 'full' : 'half'); }}
          style={{ padding: '10px 0 4px', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
        >
          <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto' }} />
        </div>

        {header != null && (
          <div
            onPointerDown={onHandlePointerDown}
            style={{ flexShrink: 0, padding: '4px 16px 12px', borderBottom: `var(--hairline) solid ${colors.divider}`, touchAction: 'none' }}
          >
            {header}
          </div>
        )}

        <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>

        {footer != null && (
          <div style={{ flexShrink: 0, padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)', borderTop: `var(--hairline) solid ${colors.divider}`, background: colors.chromeSurface }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
