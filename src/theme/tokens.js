// Ported from the "Budget Tracker v2" design handoff (Budget Tracker v2.dc.html / README.md).
// Keep this the single source of truth for color/type/shape so screens never hardcode hex values.

// Every token is a CSS custom property so the whole app themes from one place:
// the concrete hex values live in index.css (light + dark sets) and are
// overridden at runtime for the accent colour and light/dark mode
// (see services/theme.js). Because ~290 inline styles read these tokens, they
// all re-theme automatically without touching a single screen.
export const colors = {
  bgApp: 'var(--c-bgApp)',
  bgDesk: 'var(--c-bgDesk)',
  ink: 'var(--c-ink)',
  textSecondary: 'var(--c-textSecondary)',
  textTertiary: 'var(--c-textTertiary)',

  primary: 'var(--c-primary)',
  primaryHover: 'var(--c-primaryHover)',
  primaryTint: 'var(--c-primaryTint)',
  // Text/icons that sit ON the primary or a dark surface — stays light in both
  // themes (dark text on a green button would be unreadable in dark mode).
  onPrimary: 'var(--c-onPrimary)',
  surfaceDark: 'var(--c-surfaceDark)',
  accentGreen1: 'var(--c-accentGreen1)',
  accentGreen2: 'var(--c-accentGreen2)',
  accentGreen3: 'var(--c-accentGreen3)',

  successTint: 'var(--c-successTint)',
  successBorder: 'var(--c-successBorder)',
  successText: 'var(--c-successText)',

  danger: 'var(--c-danger)',
  dangerDark: 'var(--c-dangerDark)',
  dangerTint: 'var(--c-dangerTint)',
  dangerBorder: 'var(--c-dangerBorder)',

  warning: 'var(--c-warning)',
  warningDark: 'var(--c-warningDark)',
  warningTint: 'var(--c-warningTint)',
  warningBorder: 'var(--c-warningBorder)',

  cardSurface: 'var(--c-cardSurface)',
  // Tab bar and sheets. Identical to cardSurface in every theme except Frosted,
  // where iOS makes chrome denser than a floating card. Surfaces painting this
  // are the only ones that carry the (expensive) backdrop blur — see the
  // .bt-material note in index.css.
  chromeSurface: 'var(--c-chromeSurface)',
  cardBorder: 'var(--c-cardBorder)',
  divider: 'var(--c-divider)',
  track: 'var(--c-track)',
};

// category color + this alpha suffix = tint background for icon chips
export const TINT_ALPHA = '1F';
export const tint = (hex) => `${hex}${TINT_ALPHA}`;

export const CATEGORIES = [
  { id: 'food', label: 'Food & Dining', mono: 'FD', color: '#C2622E' },
  { id: 'groceries', label: 'Groceries', mono: 'GR', color: '#6B8F3C' },
  { id: 'transport', label: 'Transport', mono: 'TR', color: '#2D6E8F' },
  { id: 'rent', label: 'Rent & Housing', mono: 'RN', color: '#7A5C9E' },
  { id: 'utilities', label: 'Utilities', mono: 'UT', color: '#B8892B' },
  { id: 'shopping', label: 'Shopping', mono: 'SH', color: '#C24D6B' },
  { id: 'health', label: 'Health', mono: 'HE', color: '#1E8F72' },
  { id: 'entertainment', label: 'Entertainment', mono: 'EN', color: '#8F4D9E' },
  { id: 'emi', label: 'EMI & Loans', mono: 'EL', color: '#A13B3B' },
  { id: 'invest', label: 'Investments', mono: 'IN', color: '#0E6E4F' },
  { id: 'subscriptions', label: 'Subscriptions', mono: 'SU', color: '#5B6B8F' },
  { id: 'income', label: 'Income', mono: 'CR', color: '#2F8F4D' },
  { id: 'transfer', label: 'Transfers', mono: 'TF', color: '#6B7280' },
  { id: 'other', label: 'Others', mono: 'OT', color: '#8A8577' },
];

export const fonts = {
  heading: "'Space Grotesk', sans-serif",
  body: "'IBM Plex Sans', sans-serif",
};

// Corner radii follow iOS: an inset-grouped list container is 10pt, a presented
// sheet ~14pt. The app previously used 20/18, which is an Android/Material
// figure and is the main reason the surfaces read as "not iOS" even when the
// blur is right — iOS corners are noticeably tighter than people remember.
export const radii = {
  card: 12,
  cardTight: 10,
  chip: 10,
  sheet: 14,
  pill: 100,
};

// iOS layout constants, in points (1pt == 1 CSS px here).
export const metrics = {
  row: 44, // the minimum tappable row height in every Apple HIG list
  tabBar: 49, // standard UITabBar height, before the home-indicator inset
  navBar: 44, // standard UINavigationBar height
  // Where a list separator starts: the row's leading padding plus the leading
  // accessory and its gap. iOS never runs a separator to the leading edge.
  separatorInset: 16 + 29 + 12,
};

export const spacing = {
  screenSide: 16,
  screenTop: 74,
  screenBottom: 100,
};

// Type scale. The app previously used fifteen ad-hoc sizes (11.5, 12, 12.5, 13,
// 13.5, 14, 14.5, 15, 17, 18, 20, 22, 24, 36) — half-point steps that are
// invisible on their own but collectively make the app feel unrhythmic. These
// seven steps replace them. Primitives below read from here, so adopting a
// primitive normalises a screen's typography for free.
export const type = {
  caption: 11.5, // micro labels, uppercase eyebrows, footnotes
  footnote: 12.5, // secondary meta under a row title
  body: 13.5, // default body / secondary text
  callout: 14.5, // row titles, primary body
  title: 17, // card headings
  screen: 30, // screen title — iOS large titles are 34pt; 30 suits a wider face
  display: 48, // the one hero figure — Home's balance. Big enough to be the
  // page's single anchor rather than one heading among several; the negative
  // tracking below keeps it from reading loose at this size.
};

// Large text needs negative tracking to read as iOS. SF Pro Display tightens
// automatically above ~20pt; Space Grotesk doesn't, so without this the big
// headings sit noticeably looser than the iPhone equivalent — one of those
// differences everyone feels and nobody can name.
export const tracking = {
  display: '-0.02em',
  screen: '-0.02em',
  title: '-0.01em',
};

// Elevation. The app was entirely flat (1px border, no shadow) which read as
// "wireframe that got coloured in". These are deliberately soft — a WebView
// blurs shadows cheaply, but only if the radius stays modest.
export const shadow = {
  card: '0 1px 2px rgba(16,20,24,0.04), 0 4px 12px rgba(16,20,24,0.05)',
  raised: '0 4px 10px rgba(16,20,24,0.07), 0 12px 28px rgba(16,20,24,0.09)',
  sheet: '0 -10px 34px rgba(0,0,0,0.20)',
};
