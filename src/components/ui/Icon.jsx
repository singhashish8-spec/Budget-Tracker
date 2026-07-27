// Stroke icons to replace the emoji that were standing in for them (📈 🔮 ⚠️).
// Emoji render differently on every Android skin — Samsung, Pixel and Xiaomi
// each ship their own set — so they read as inconsistent next to the app's own
// monogram chips. These inherit currentColor and sit on the same 24px grid as
// the icons already hand-drawn in the screens.
const BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const PATHS = {
  // A rising line with an arrowhead — a price or spend going up.
  trendUp: (
    <>
      <path d="M3 17.5 9.5 11l4 4L21 7.5" />
      <path d="M15 7.5h6v6" />
    </>
  ),
  // Forecast: a line continuing into a dashed projection.
  forecast: (
    <>
      <path d="M3 15.5 8 10l3.5 3.5L15 9" />
      <path d="M17.5 7.5h.01M20 11h.01M18.5 14.5h.01" strokeWidth="2.4" />
    </>
  ),
  // Shield with a tick — a warranty still in force.
  shield: (
    <>
      <path d="M12 3.5 20 6.5v5.2c0 4.4-3.2 7.6-8 9.3-4.8-1.7-8-4.9-8-9.3V6.5l8-3Z" />
      <path d="M9 12.2l2.2 2.2L15.5 10" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 7" />,
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
};

export default function Icon({ name, size = 18, style, title }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      style={{ flexShrink: 0, ...style }}
      {...BASE}
    >
      {title && <title>{title}</title>}
      {d}
    </svg>
  );
}
