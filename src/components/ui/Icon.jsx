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
  // Warning triangle — the impulse / large-purchase nudge.
  warning: (
    <>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" strokeWidth="2.4" />
    </>
  ),

  // ── Net-worth holding types (Insights) ────────────────────────────────────
  // Gold, tracked by weight — a coin seen slightly side-on.
  coin: (
    <>
      <ellipse cx="12" cy="7" rx="7.5" ry="3.5" />
      <path d="M4.5 7v10c0 1.9 3.4 3.5 7.5 3.5s7.5-1.6 7.5-3.5V7" />
      <path d="M4.5 12c0 1.9 3.4 3.5 7.5 3.5s7.5-1.6 7.5-3.5" />
    </>
  ),
  // Fixed / recurring deposit — a classical bank front.
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 9.5v8M9.5 9.5v8M14.5 9.5v8M19 9.5v8" />
      <path d="M3 20.5h18" />
    </>
  ),
  // Chit fund — a group pooling money, so: people, not a handshake.
  people: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2" />
      <path d="M16.2 5.4a3.2 3.2 0 0 1 0 6" />
      <path d="M17.5 15.2c2.1.5 3.5 2.2 3.5 4.8" />
    </>
  ),
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5Z" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  // Cash / bank balance — a banknote.
  cash: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10v4M18 10v4" />
    </>
  ),
  // Anything else — a parcel.
  box: (
    <>
      <path d="M20.5 8.2v7.6a1.6 1.6 0 0 1-.85 1.42l-6.9 3.6a1.6 1.6 0 0 1-1.5 0l-6.9-3.6A1.6 1.6 0 0 1 3.5 15.8V8.2" />
      <path d="m3.7 7.6 8.3 4.3 8.3-4.3-7.55-3.9a1.6 1.6 0 0 0-1.5 0L3.7 7.6Z" />
      <path d="M12 11.9V20" />
    </>
  ),

  // ── Misc ──────────────────────────────────────────────────────────────────
  // A bill / receipt with a torn bottom edge.
  receipt: (
    <>
      <path d="M5 3.5h14v17l-2.3-1.6-2.35 1.6L12 18.9l-2.35 1.6L7.3 18.9 5 20.5v-17Z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </>
  ),
  // Emergency fund — the money you keep for a rainy day.
  umbrella: (
    <>
      <path d="M12 3.5c4.7 0 8.5 3.8 8.5 8.5h-17c0-4.7 3.8-8.5 8.5-8.5Z" />
      <path d="M12 12v6a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z" />
      <path d="M13.8 3.7V8.2h4.5" />
    </>
  ),
  clip: <path d="M17.5 10.5 11 17a3.5 3.5 0 0 1-5-5l7.2-7.2a2.3 2.3 0 0 1 3.3 3.3l-7.2 7.2a1.1 1.1 0 0 1-1.6-1.6l6.6-6.6" />,
  // A stored photo, as opposed to a PDF.
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="8.7" cy="9.7" r="1.6" />
      <path d="m4 16.5 4.6-4a1.6 1.6 0 0 1 2.1 0l5.6 5" />
      <path d="m14.6 13.6 1.5-1.3a1.6 1.6 0 0 1 2.1 0l1.8 1.6" />
    </>
  ),
  // Service / repair entry on a warranty.
  wrench: <path d="M15.3 4.6a5 5 0 0 0-6.6 6.2l-4.4 4.4a1.8 1.8 0 0 0 0 2.6l1.9 1.9a1.8 1.8 0 0 0 2.6 0l4.4-4.4a5 5 0 0 0 6.2-6.6l-3 3-2.6-.7-.7-2.6 3-3Z" />,
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
