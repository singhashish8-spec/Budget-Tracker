import { colors, radii } from '../../theme/tokens';

// Every progress bar in the app used to be a bare inline `width: '${pct}%'`
// with no transition, so bars snapped to their value instead of filling. The
// fill animates here in one place; `.bt-bar-fill` carries the transition so the
// motion setting (and prefers-reduced-motion) can still the whole app's bars at
// once — see index.css.
export default function ProgressBar({
  pct,
  height = 6,
  color = colors.primary,
  track = colors.divider,
  style,
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        height,
        borderRadius: radii.pill,
        background: track,
        overflow: 'hidden',
        width: '100%',
        ...style,
      }}
    >
      <div
        className="bt-bar-fill"
        style={{ height: '100%', borderRadius: radii.pill, background: color, width: `${clamped}%` }}
      />
    </div>
  );
}
