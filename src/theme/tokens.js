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

export const radii = {
  card: 20,
  cardTight: 18,
  chip: 14,
  pill: 100,
};

export const spacing = {
  screenSide: 16,
  screenTop: 74,
  screenBottom: 100,
};
