import { colors } from '../theme/tokens';
import { CURRENCIES } from '../utils/currency';
import { useApp } from '../state/AppContext';

export default function SettingsScreen() {
  const { state, go, showToast, setCurrency, toggleAccount, toggleAppLock } = useApp();

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={() => go('home')} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Settings</div>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
        <div style={sectionLabel}>Account &amp; sync</div>
        <button
          onClick={() => showToast('Google sign-in isn’t configured yet — add your OAuth client ID to enable it')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Google Drive sync</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Not connected</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>Connect</div>
        </button>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
        <div style={sectionLabel}>Display currency</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CURRENCIES.map((code) => {
            const active = code === state.currency;
            return (
              <button
                key={code}
                onClick={() => setCurrency(code)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 100,
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: active ? colors.primary : colors.cardSurface,
                  color: active ? colors.bgApp : colors.ink,
                  border: `1px solid ${active ? colors.primary : colors.cardBorder}`,
                }}
              >
                {code}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 10 }}>Demo conversion rates for the prototype — not live FX</div>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
        <div style={sectionLabel}>Privacy &amp; security</div>
        <ToggleRow
          title="SMS auto-tracking"
          sub="Reads bank & UPI SMS on this device only"
          on={state.accounts.sms}
          onToggle={() => toggleAccount('sms')}
          border
        />
        <ToggleRow title="App lock" sub="Fingerprint / face / PIN unlock on open" on={state.appLock} onToggle={toggleAppLock} />
      </div>

      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>
        Budget Tracker · transactions are encrypted at rest on this device
      </div>
    </div>
  );
}

function ToggleRow({ title, sub, on, onToggle, border }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 0',
        borderBottom: border ? `1px solid ${colors.divider}` : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{sub}</div>
      </div>
      <button
        onClick={onToggle}
        style={{
          width: 44,
          height: 26,
          borderRadius: 100,
          background: on ? colors.primary : colors.track,
          position: 'relative',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: on ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.15s',
          }}
        />
      </button>
    </div>
  );
}

const sectionLabel = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: colors.textSecondary,
  marginBottom: 12,
};

const backBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15">
      <path d="M8 1L2 7.5 8 14" stroke="#1B1F23" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
