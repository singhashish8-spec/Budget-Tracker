import { useRef } from 'react';
import { colors } from '../theme/tokens';
import { CURRENCIES } from '../utils/currency';
import { salaryDayLabel } from '../utils/date';
import { useApp } from '../state/AppContext';
import { backupToDrive, restoreFromFile } from '../services/backup';

export default function SettingsScreen() {
  const { state, go, showToast, setCurrency, setSalaryDay, toggleAccount, toggleAppLock, reloadData } = useApp();
  const restoreRef = useRef(null);

  const doBackup = async () => {
    try {
      await backupToDrive();
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) showToast('Couldn’t start the backup — try again');
    }
  };

  const onRestoreFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const counts = await restoreFromFile(file);
      await reloadData();
      showToast(`Restored ${counts.transactions} transactions, ${counts.budgets} budgets, ${counts.reminders} reminders`);
    } catch (err) {
      showToast(err?.message || 'Couldn’t restore that file');
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={() => go('home')} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Settings</div>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
        <div style={sectionLabel}>Backup &amp; restore</div>
        <button
          onClick={doBackup}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', paddingBottom: 13, borderBottom: `1px solid ${colors.divider}` }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Back up to Google Drive</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Exports your data — pick "Save to Drive" in the share sheet</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>Back up</div>
        </button>
        <input ref={restoreRef} type="file" accept="application/json,.json" onChange={onRestoreFile} style={{ display: 'none' }} />
        <button
          onClick={() => restoreRef.current?.click()}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', paddingTop: 13 }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>Restore from a backup</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Pick a backup file to bring back budgets, reminders &amp; transactions</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>Restore</div>
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
        <div style={sectionLabel}>Pay cycle</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
          Get paid on a specific day? Set it and your month runs pay-day to pay-day instead of 1st–31st.
        </div>
        <select
          value={state.salaryDay}
          onChange={(e) => setSalaryDay(Number(e.target.value))}
          style={{
            width: '100%',
            background: colors.bgApp,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 100,
            padding: '11px 16px',
            fontSize: 14,
            color: colors.ink,
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          <option value={0}>Calendar month (1st–end)</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {salaryDayLabel(d)} of the month
            </option>
          ))}
          <option value={32}>Last day of month</option>
        </select>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>Currently: {salaryDayLabel(state.salaryDay)}</div>
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
        <button
          onClick={() => go('sms')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '13px 0', borderBottom: `1px solid ${colors.divider}` }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>SMS activity &amp; manual scan</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>See recently read messages and scan now</div>
          </div>
          <div style={{ color: colors.textTertiary, fontWeight: 600 }}>›</div>
        </button>
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
