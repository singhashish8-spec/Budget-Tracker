import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

const ITEMS = [
  { key: 'settings', label: 'Settings', mono: 'ST', color: colors.primary },
  { key: 'reminders', label: 'Bill reminders', mono: 'BR', color: colors.warning },
  { key: 'patterns', label: 'Smart patterns', mono: 'SP', color: colors.warning },
  { key: 'sms', label: 'SMS auto-tracking', mono: 'SM', color: '#C2622E' },
  { key: 'upload', label: 'Upload bills', mono: 'UP', color: '#2D6E8F' },
];

export default function HamburgerDrawer() {
  const { state, go, closeMenu } = useApp();
  if (!state.menuOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
      <div onClick={closeMenu} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '76%',
          background: colors.bgApp,
          padding: 'calc(env(safe-area-inset-top, 0px) + 60px) 16px 30px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          animation: 'slidein 0.22s ease-out',
          boxShadow: '-12px 0 32px rgba(27,31,35,0.18)',
        }}
      >
        <div style={{ padding: '0 6px 10px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>Budget Tracker</div>
        </div>
        {ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => go(item.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: colors.cardSurface,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 16,
              padding: '13px 14px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: item.color + '1F',
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {item.mono}
            </div>
            <div style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{item.label}</div>
            <div style={{ color: colors.textTertiary, fontWeight: 600 }}>›</div>
          </button>
        ))}
        <div style={{ marginTop: 'auto', fontSize: 11.5, color: colors.textTertiary, padding: '0 6px' }}>Budget Tracker · your data stays on this device</div>
      </div>
    </div>
  );
}
