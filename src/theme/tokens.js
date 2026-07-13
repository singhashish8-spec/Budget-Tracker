// Ported from the "Budget Tracker v2" design handoff (Budget Tracker v2.dc.html / README.md).
// Keep this the single source of truth for color/type/shape so screens never hardcode hex values.

export const colors = {
  bgApp: '#F7F4EE',
  bgDesk: '#ECE7DD',
  ink: '#1B1F23',
  textSecondary: '#7C7668',
  textTertiary: '#A39D91',

  primary: '#0E6E4F',
  primaryHover: '#0B5940',
  surfaceDark: '#10241C',
  accentGreen1: '#4FA57F',
  accentGreen2: '#7FD1A8',
  accentGreen3: '#9DB8AC',

  successTint: '#E7F2EC',
  successBorder: '#C9E0D3',
  successText: '#4A7A63',

  danger: '#D9432F',
  dangerDark: '#A32E1E',
  dangerTint: '#FBEAE6',
  dangerBorder: '#F0CCC2',

  warning: '#B8892B',
  warningDark: '#8A6415',
  warningTint: '#F6EEDC',
  warningBorder: '#E8D9B4',

  cardSurface: '#FFFFFF',
  cardBorder: '#E7E2D9',
  divider: '#F0EBE2',
  track: '#D5CEC1',
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
