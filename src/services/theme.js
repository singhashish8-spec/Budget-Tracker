// Applies the user's appearance choices by overriding CSS variables on the root
// element. Light/dark neutrals come from index.css; here we set the accent group
// (the same in both modes) and the light/dark mode attribute. The choice is also
// cached in localStorage so it can be applied synchronously on the next launch,
// before React renders, avoiding a flash of the wrong theme.

// Each accent overrides the primary group plus the dark "spotlight" panel and
// its muted accent text, so the whole app stays cohesive per colour.
export const ACCENTS = [
  { key: 'green', label: 'Forest', primary: '#0E6E4F', hover: '#0B5940', surface: '#10241C', a1: '#4FA57F', a2: '#7FD1A8', a3: '#9DB8AC' },
  { key: 'teal', label: 'Teal', primary: '#0F766E', hover: '#0B5C56', surface: '#0C2422', a1: '#4FB0A6', a2: '#7FD8CE', a3: '#9DC0BB' },
  { key: 'blue', label: 'Ocean', primary: '#2563EB', hover: '#1D4FBE', surface: '#111A2E', a1: '#6C9BF5', a2: '#A8C5FB', a3: '#A6B4CC' },
  { key: 'indigo', label: 'Indigo', primary: '#5B4BC4', hover: '#473A9E', surface: '#1A162E', a1: '#9384E0', a2: '#BFB4F0', a3: '#B2AACC' },
  { key: 'plum', label: 'Plum', primary: '#9333A8', hover: '#762987', surface: '#26132B', a1: '#C069D3', a2: '#DFA8E8', a3: '#C5A6CC' },
  { key: 'amber', label: 'Amber', primary: '#B5701E', hover: '#8F5715', surface: '#2B1D0E', a1: '#D79A4F', a2: '#EFC98A', a3: '#CCBDA6' },
  { key: 'rose', label: 'Rose', primary: '#C2185B', hover: '#9C1249', surface: '#2E1119', a1: '#E06A93', a2: '#F2A8C0', a3: '#CCA6B2' },
];

export const MODES = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

const CACHE_KEY = 'bt-theme';
const DEFAULTS = { mode: 'system', accent: 'green' };

export function applyTheme({ mode = 'system', accent = 'green' } = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme'); // system → follow prefers-color-scheme

  const a = ACCENTS.find((x) => x.key === accent) || ACCENTS[0];
  const s = root.style;
  s.setProperty('--c-primary', a.primary);
  s.setProperty('--c-primaryHover', a.hover);
  s.setProperty('--c-primaryTint', a.primary + '1F'); // 12% alpha tint
  s.setProperty('--c-surfaceDark', a.surface);
  s.setProperty('--c-accentGreen1', a.a1);
  s.setProperty('--c-accentGreen2', a.a2);
  s.setProperty('--c-accentGreen3', a.a3);
  // Native controls (date pickers, scrollbars) follow this in system mode.
  s.colorScheme = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'light dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', a.primary);

  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ mode, accent })); } catch { /* private mode */ }
}

// Read the cached choice for an instant, flash-free apply at startup. The
// authoritative values come from the database once it loads.
export function loadCachedTheme() {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (v && typeof v.mode === 'string' && typeof v.accent === 'string') return v;
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}
