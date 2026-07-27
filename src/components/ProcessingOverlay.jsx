import { useEffect, useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

// Full-screen "please wait" for operations that take real time — reading the
// SMS inbox, importing a file, removing duplicates, restoring a backup. Shows a
// determinate bar with an "X of Y" count when the work has a known total, and an
// indeterminate sweeping bar otherwise.
export default function ProcessingOverlay() {
  const { state, set } = useApp();
  // A full-screen overlay with no exit is the worst failure mode there is: an
  // app-wide dead end reached through no fault of the user. If the work hasn't
  // finished in half a minute, offer a way out rather than leaving them staring
  // at a bar that may never move again.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!state.processing) { setStalled(false); return undefined; }
    const t = setTimeout(() => setStalled(true), 30000);
    return () => clearTimeout(t);
  }, [state.processing]);

  if (!state.processing) return null;

  const p = state.procProgress; // { done, total } | null
  const hasTotal = p && p.total > 0;
  const pct = hasTotal ? Math.min(100, Math.round((p.done / p.total) * 100)) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'color-mix(in srgb, var(--c-bgApp) 96%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600 }}>{state.procTitle || 'Working…'}</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginTop: 5 }}>{state.procSub || 'This can take a moment'}</div>
      </div>

      <div style={{ width: 'min(280px, 74vw)' }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 100, background: colors.track, overflow: 'hidden' }}>
          {hasTotal ? (
            <div style={{ height: '100%', borderRadius: 100, background: colors.primary, width: `${pct}%`, transition: 'width 0.25s ease' }} />
          ) : (
            // Indeterminate: a segment sweeps across while the total is unknown.
            <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', borderRadius: 100, background: colors.primary, animation: 'barSweep 1.1s ease-in-out infinite' }} />
          )}
        </div>
        {hasTotal && (
          <div style={{ fontSize: 12.5, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
            {p.done} of {p.total} · {pct}%
          </div>
        )}
      </div>

      {stalled && (
        <div style={{ textAlign: 'center', maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: colors.textTertiary, lineHeight: 1.5 }}>
            This is taking longer than it should. You can carry on into the app — nothing already saved is lost.
          </div>
          <button
            onClick={() => set({ processing: false, procTitle: '', procSub: '', procProgress: null })}
            style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: 100, padding: '11px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Continue anyway
          </button>
        </div>
      )}
    </div>
  );
}
