import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

// Full-screen "please wait" for operations that take real time — reading the
// SMS inbox, importing a file, removing duplicates, restoring a backup. Shows a
// determinate bar with an "X of Y" count when the work has a known total, and an
// indeterminate sweeping bar otherwise.
export default function ProcessingOverlay() {
  const { state } = useApp();
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
    </div>
  );
}
