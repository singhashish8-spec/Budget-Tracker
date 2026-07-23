import { useRef, useState } from 'react';
import { colors } from '../theme/tokens';
import { CURRENCIES } from '../utils/currency';
import { salaryDayLabel } from '../utils/date';
import { useApp } from '../state/AppContext';
import { backupToDrive, restoreFromFile } from '../services/backup';
import { MODES, ACCENTS, SURFACES, MOTIONS } from '../services/theme';
import { updatesSupported, fetchManifest, getCurrentVersion, downloadUpdate, applyUpdateAndReload } from '../services/liveUpdate';

// Settings is a menu of categories, not a wall of controls: the top level lists
// sections, and every actual control lives one tap inside its section. `section`
// is null at the menu; the header back button steps back to the menu first, and
// only leaves Settings from the menu itself.
const SECTIONS = [
  { key: 'appearance', label: 'Appearance', sub: 'Theme, accent, glass & motion' },
  { key: 'money', label: 'Money', sub: 'Display currency & pay cycle' },
  { key: 'scanning', label: 'Receipt scanning', sub: 'Gemini key for bills & statements' },
  { key: 'backup', label: 'Backup & restore', sub: 'Save a copy and bring it back' },
  { key: 'privacy', label: 'Privacy & security', sub: 'SMS tracking & app lock' },
  { key: 'updates', label: 'App updates', sub: 'Check for the newest version' },
  { key: 'about', label: 'About', sub: 'Version & app info' },
];

export default function SettingsScreen() {
  const { state, go, goBack, showToast, setCurrency, setSalaryDay, setGeminiApiKey, toggleAccount, toggleAppLock, reloadData, setThemeMode, setThemeAccent, setThemeSurface, setMotionPref } = useApp();
  const [section, setSection] = useState(null);
  const restoreRef = useRef(null);
  const [keyDraft, setKeyDraft] = useState(state.geminiKey || '');
  // { phase, ... } where phase = idle | web | checking | uptodate | available |
  // downloading | ready | error. Drives the App-updates section.
  const [upd, setUpd] = useState({ phase: 'idle' });

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

  // ── App updates ──
  const checkUpdate = async () => {
    if (!updatesSupported()) { setUpd({ phase: 'web' }); return; }
    setUpd({ phase: 'checking' });
    const manifest = await fetchManifest();
    if (!manifest) { setUpd({ phase: 'error', error: 'Couldn’t reach the update server. Check your connection and try again.' }); return; }
    const current = await getCurrentVersion();
    if (manifest.version === current) { setUpd({ phase: 'uptodate', version: current }); return; }
    setUpd({ phase: 'available', manifest, version: manifest.version });
  };
  const startDownload = async () => {
    const manifest = upd.manifest;
    if (!manifest) return;
    setUpd({ phase: 'downloading', percent: 0, version: manifest.version });
    try {
      const bundle = await downloadUpdate(manifest, (p) => setUpd((s) => (s.phase === 'downloading' ? { ...s, percent: p } : s)));
      setUpd({ phase: 'ready', version: manifest.version, bundleId: bundle.id });
    } catch (err) {
      setUpd({ phase: 'error', error: err?.message || 'Download failed — please try again.' });
    }
  };
  const restartNow = async () => {
    try {
      await applyUpdateAndReload(upd.bundleId);
    } catch (err) {
      setUpd((s) => ({ ...s, phase: 'error', error: err?.message || 'Couldn’t apply the update.' }));
    }
  };

  const active = SECTIONS.find((s) => s.key === section);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={() => (section ? setSection(null) : goBack())} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>{active ? active.label : 'Settings'}</div>
      </div>

      {/* Top-level menu */}
      {!section && (
        <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, overflow: 'hidden' }}>
          {SECTIONS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '15px 16px', borderBottom: i < SECTIONS.length - 1 ? `1px solid ${colors.divider}` : 'none' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{s.sub}</div>
              </div>
              <div style={{ color: colors.textTertiary, fontWeight: 600, fontSize: 18 }}>›</div>
            </button>
          ))}
        </div>
      )}

      {/* Appearance */}
      {section === 'appearance' && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>Theme</div>
          <div style={segWrap}>
            {MODES.map((m) => (
              <button key={m.key} onClick={() => setThemeMode(m.key)} style={segBtn(state.themeMode === m.key)}>{m.label}</button>
            ))}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, margin: '16px 0 10px' }}>Accent colour</div>
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
          <div style={segWrap}>
            {SURFACES.map((s) => (
              <button key={s.key} onClick={() => setThemeSurface(s.key)} style={segBtn(state.themeSurface === s.key)}>{s.label}</button>
            ))}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, margin: '18px 0 4px' }}>Animations</div>
          <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>Screen transitions and tap feedback. Reduced keeps taps responsive but calms the movement; Off stills everything.</div>
          <div style={segWrap}>
            {MOTIONS.map((m) => (
              <button key={m.key} onClick={() => setMotionPref(m.key)} style={segBtn((state.motionPref || 'on') === m.key)}>{m.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Money */}
      {section === 'money' && (
        <>
          <div style={card}>
            <div style={sectionLabel}>Display currency</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CURRENCIES.map((code) => {
                const on = code === state.currency;
                return (
                  <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    style={{ padding: '9px 16px', borderRadius: 100, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : colors.cardSurface, color: on ? colors.onPrimary : colors.ink, border: `1px solid ${on ? colors.primary : colors.cardBorder}` }}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 10 }}>Demo conversion rates for the prototype — not live FX</div>
          </div>

          <div style={card}>
            <div style={sectionLabel}>Pay cycle</div>
            <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
              Get paid on a specific day? Set it and your month runs pay-day to pay-day instead of 1st–31st.
            </div>
            <select
              value={state.salaryDay}
              onChange={(e) => setSalaryDay(Number(e.target.value))}
              style={{ width: '100%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink, fontFamily: "'IBM Plex Sans', sans-serif" }}
            >
              <option value={0}>Calendar month (1st–end)</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{salaryDayLabel(d)} of the month</option>
              ))}
              <option value={32}>Last day of month</option>
            </select>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>Currently: {salaryDayLabel(state.salaryDay)}</div>
          </div>
        </>
      )}

      {/* Receipt scanning */}
      {section === 'scanning' && (
        <div style={card}>
          <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
            Paste your Google Gemini API key to enable scanning bills & statements. It's stored only on this phone — get a free key at aistudio.google.com/app/apikey.
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
      )}

      {/* Backup & restore */}
      {section === 'backup' && (
        <div style={card}>
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
              <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 2 }}>Saves by itself a few seconds after your data changes.</div>
            )}
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6, lineHeight: 1.5 }}>
              Google’s backup runs on its own schedule (usually overnight, on Wi-Fi while charging). For a copy you control right now, use “Back up to Google Drive” above.
            </div>
          </div>
        </div>
      )}

      {/* Privacy & security */}
      {section === 'privacy' && (
        <div style={card}>
          <ToggleRow title="SMS auto-tracking" sub="Reads bank & UPI SMS on this device only" on={state.accounts.sms} onToggle={() => toggleAccount('sms')} border />
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
      )}

      {/* App updates */}
      {section === 'updates' && (
        <div style={card}>
          <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
            You’re on version <b style={{ color: colors.ink }}>{import.meta.env.VITE_APP_VERSION}</b>. Check for a newer version and download it right here — no reinstall.
          </div>

          {(upd.phase === 'downloading') ? (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Downloading version {upd.version}…</div>
              <div style={{ height: 10, borderRadius: 100, background: colors.track, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 100, background: colors.primary, width: `${upd.percent || 0}%`, transition: 'width 0.2s ease' }} />
              </div>
              <div style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{upd.percent || 0}%</div>
            </div>
          ) : upd.phase === 'ready' ? (
            <>
              <div style={{ fontSize: 13.5, color: colors.successText, fontWeight: 600, marginBottom: 12 }}>✓ Version {upd.version} downloaded and ready.</div>
              <button onClick={restartNow} style={primaryBtn}>Restart to finish</button>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8, textAlign: 'center' }}>The app will reload into the new version.</div>
            </>
          ) : (
            <>
              {upd.phase === 'uptodate' && <div style={{ fontSize: 13.5, color: colors.successText, fontWeight: 600, marginBottom: 12 }}>✓ You’re on the latest version ({upd.version}).</div>}
              {upd.phase === 'available' && <div style={{ fontSize: 13.5, color: colors.ink, fontWeight: 600, marginBottom: 12 }}>Version {upd.version} is available.</div>}
              {upd.phase === 'web' && <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>Manual updates run in the phone app. In a web preview the latest version always loads automatically.</div>}
              {upd.phase === 'error' && <div style={{ fontSize: 13, color: colors.danger, marginBottom: 12, lineHeight: 1.5 }}>{upd.error}</div>}

              {upd.phase === 'available' ? (
                <button onClick={startDownload} style={primaryBtn}>Download update</button>
              ) : (
                <button onClick={checkUpdate} disabled={upd.phase === 'checking'} style={{ ...primaryBtn, opacity: upd.phase === 'checking' ? 0.6 : 1 }}>
                  {upd.phase === 'checking' ? 'Checking…' : upd.phase === 'uptodate' || upd.phase === 'error' ? 'Check again' : 'Check for updates'}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* About */}
      {section === 'about' && (
        <div style={card}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Budget Tracker</div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 1.55 }}>
            A private, on-device tracker for your money. Your transactions stay in this app’s own storage on your phone — nothing is sent to a server.
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 12, fontWeight: 600 }}>Version {import.meta.env.VITE_APP_VERSION}</div>
        </div>
      )}
    </div>
  );
}

function ToggleRow({ title, sub, on, onToggle, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: border ? `1px solid ${colors.divider}` : 'none' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{sub}</div>
      </div>
      <button
        onClick={onToggle}
        style={{ width: 44, height: 26, borderRadius: 100, background: on ? colors.primary : colors.track, position: 'relative', flexShrink: 0, cursor: 'pointer', transition: 'background 0.15s' }}
      >
        <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.15s' }} />
      </button>
    </div>
  );
}

const card = { background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 };

const segWrap = { display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3 };
const segBtn = (on) => ({ flex: 1, padding: '9px 6px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary });

const primaryBtn = { background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '13px', width: '100%', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };

const sectionLabel = { fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 12 };

const backBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" style={{ color: 'var(--c-ink)' }}>
      <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
