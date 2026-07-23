import { useRef, useState } from 'react';
import { colors } from '../theme/tokens';
import { CURRENCIES } from '../utils/currency';
import { salaryDayLabel } from '../utils/date';
import { useApp } from '../state/AppContext';
import { backupToDrive, restoreFromFile } from '../services/backup';
import { MODES, ACCENTS, SURFACES } from '../services/theme';

export default function SettingsScreen() {
  const { state, go, goBack, showToast, setCurrency, setSalaryDay, setGeminiApiKey, toggleAccount, toggleAppLock, reloadData, setThemeMode, setThemeAccent, setThemeSurface } = useApp();
  const restoreRef = useRef(null);
  const [keyDraft, setKeyDraft] = useState(state.geminiKey || '');

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
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Settings</div>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
        <div style={sectionLabel}>Appearance</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>Theme</div>
        <div style={{ display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3, marginBottom: 16 }}>
          {MODES.map((m) => {
            const on = state.themeMode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setThemeMode(m.key)}
                style={{ flex: 1, padding: '9px 6px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 10 }}>Accent colour</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {ACCENTS.map((a) => {
            const on = state.themeAccent === a.key;
            return (
              <button
                key={a.key}
                onClick={() => setThemeAccent(a.key)}
                title={a.label}
                style={{ width: 36, height: 36, borderRadius: '50%', background: a.primary, cursor: 'pointer', border: on ? `3px solid ${colors.ink}` : `2px solid ${colors.cardBorder}`, boxShadow: on ? `0 0 0 2px ${colors.cardSurface} inset` : 'none' }}
              />
            );
          })}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, margin: '18px 0 4px' }}>Surface</div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>Frosted glass gives cards a translucent, iOS-style blur. Standard is the classic solid look.</div>
        <div style={{ display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3 }}>
          {SURFACES.map((s) => {
            const on = state.themeSurface === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setThemeSurface(s.key)}
                style={{ flex: 1, padding: '9px 6px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
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

        {/* Automatic snapshot status. Stated plainly — a snapshot kept in the
            app's own storage does NOT survive the app being reinstalled, and
            claiming otherwise would give false confidence about real data. */}
        <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${colors.divider}` }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Automatic backup</div>
          {state.lastAutoBackup ? (
            <>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
                Last saved {new Date(state.lastAutoBackup.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
              </div>
              <div style={{ fontSize: 12.5, color: colors.successText, marginTop: 4, lineHeight: 1.5 }}>
                {state.lastAutoBackup.cloud ? '✓ Included in your Google account backup — comes back on a new phone.' : null}
              </div>
              <div style={{ fontSize: 12.5, color: state.lastAutoBackup.durable ? colors.successText : colors.warningDark, marginTop: 2, lineHeight: 1.5 }}>
                {state.lastAutoBackup.durable
                  ? '✓ Also saved to your Documents folder — survives reinstalling the app.'
                  : 'Not saved to Documents on this phone, so a reinstall relies on the Google backup above.'}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>
              Saves by itself a few seconds after your data changes.
            </div>
          )}
          <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
            Google’s backup runs on its own schedule (usually overnight, on Wi-Fi while charging). For a copy you control right now, use “Back up to Google Drive” above.
          </div>
        </div>
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
                  color: active ? colors.onPrimary : colors.ink,
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
        <div style={sectionLabel}>Receipt scanning (Gemini)</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
          Paste your Google Gemini API key to enable scanning bills & statements. It's stored only on this phone (encrypted) — get a free key at aistudio.google.com/app/apikey.
        </div>
        <input
          value={keyDraft}
          onChange={(e) => setKeyDraft(e.target.value)}
          placeholder="Paste Gemini API key"
          type="password"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{ width: '100%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
        />
        <button
          onClick={() => {
            setGeminiApiKey(keyDraft);
            showToast(keyDraft.trim() ? 'Gemini key saved' : 'Gemini key cleared');
          }}
          style={{ marginTop: 10, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px', width: '100%', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Save key
        </button>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
          {state.geminiKey ? '✓ Key saved — scanning is enabled' : 'No key yet — scanning is off'}
        </div>
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
        <div style={{ marginTop: 4, fontWeight: 600 }}>Version {import.meta.env.VITE_APP_VERSION}</div>
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
    <svg width="9" height="15" viewBox="0 0 9 15" style={{ color: 'var(--c-ink)' }}>
      <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
