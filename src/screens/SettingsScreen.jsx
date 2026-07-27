import { useRef, useState } from 'react';
import { colors } from '../theme/tokens';
import { CURRENCIES } from '../utils/currency';
import { salaryDayLabel } from '../utils/date';
import { useApp } from '../state/AppContext';
import { backupToDrive, restoreFromFile } from '../services/backup';
import { exportAllAsZip } from '../services/zipExport';
import { MODES, ACCENTS, SURFACES, MOTIONS } from '../services/theme';
import { HAPTIC_LEVELS } from '../services/haptics';
import * as haptics from '../services/haptics';
import { notificationsSupported } from '../services/notify';
import { dataUrlBytes, formatBytes } from '../utils/image';
import { updatesSupported, fetchManifest, getCurrentVersion, downloadUpdate, applyUpdateAndReload } from '../services/liveUpdate';
import { Icon } from '../components/ui';

// Settings is a menu of categories, not a wall of controls: the top level lists
// sections, and every actual control lives one tap inside its section. `section`
// is null at the menu; the header back button steps back to the menu first, and
// only leaves Settings from the menu itself.
const SECTIONS = [
  { key: 'appearance', label: 'Appearance', sub: 'Themes, accent, haptics & motion' },
  { key: 'money', label: 'Money', sub: 'Display currency & pay cycle' },
  { key: 'backup', label: 'Backup & restore', sub: 'Save a copy and bring it back' },
  { key: 'privacy', label: 'Privacy & security', sub: 'SMS tracking & app lock' },
  { key: 'updates', label: 'App updates', sub: 'Check for the newest version' },
  { key: 'about', label: 'About', sub: 'Version & app info' },
];

export default function SettingsScreen() {
  const { state, go, goBack, showToast, setCurrency, setSalaryDay, setImpulseThreshold, setZeroBased, setHapticPref, askNotificationPermission, factoryReset, toggleAccount, toggleAppLock, reloadData, setThemeMode, setThemeAccent, setThemeSurface, setMotionPref, toggleRcsCapture, toggleClipboardCapture, confirmCapture, dismissCapture } = useApp();
  const [section, setSection] = useState(null);
  const restoreRef = useRef(null);
  // { phase, ... } where phase = idle | web | checking | uptodate | available |
  // downloading | ready | error. Drives the App-updates section.
  const [upd, setUpd] = useState({ phase: 'idle' });
  const [resetOpen, setResetOpen] = useState(false);

  const doBackup = async () => {
    try {
      await backupToDrive();
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) showToast('Couldn’t start the backup — try again', 'error');
    }
  };

  const doZipExport = async () => {
    try {
      await exportAllAsZip();
    } catch (err) {
      if (!/cancel/i.test(err?.message || '')) showToast('Couldn’t build the export — try again', 'error');
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
      showToast(err?.message || 'Couldn’t restore that file', 'error');
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
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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

          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, margin: '18px 0 4px' }}>Theme</div>
          <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 10 }}>
            Changes the whole feel — surfaces, contrast and depth — not just the colour. Works with any accent above.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SURFACES.map((s) => {
              const on = (state.themeSurface || 'standard') === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setThemeSurface(s.key)}
                  aria-pressed={on}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '11px 12px', borderRadius: 14,
                    background: on ? colors.primaryTint : 'transparent',
                    border: `1.5px solid ${on ? colors.primary : colors.cardBorder}`,
                  }}
                >
                  <SkinSwatch skin={s.key} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: on ? colors.primary : colors.ink }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: colors.textTertiary }}>{s.hint}</div>
                  </div>
                  {on && <span style={{ color: colors.primary, fontWeight: 700 }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, margin: '18px 0 4px' }}>Haptics</div>
          <div style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>
            A short tap when something actually happens — a choice made, a bill marked paid, a warning appearing. Not on every touch, which just feels buzzy. How good this feels depends on your phone's vibration hardware.
          </div>
          <div style={segWrap}>
            {HAPTIC_LEVELS.map((h) => (
              <button
                key={h.key}
                onClick={() => { setHapticPref(h.key); if (h.key !== 'off') setTimeout(() => haptics.tap(), 30); }}
                style={segBtn((state.hapticLevel || 'full') === h.key)}
              >
                {h.label}
              </button>
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

          <div style={card}>
            <div style={sectionLabel}>Cooling-off limit</div>
            <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
              Any single spend at or above this shows a "think twice" warning while you add it — a gentle brake on impulse buys. Set to 0 to turn it off.
            </div>
            <input
              value={state.impulseThreshold ? String(state.impulseThreshold) : ''}
              onChange={(e) => setImpulseThreshold(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="₹ amount (e.g. 5000)"
              style={{ width: '100%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
            />
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
              {state.impulseThreshold > 0 ? `Warns on spends of ₹${state.impulseThreshold.toLocaleString('en-IN')} or more` : 'Large-purchase warning is off'}
            </div>
          </div>

          <div style={card}>
            <div style={sectionLabel}>Envelope budgeting</div>
            <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
              Give every rupee a job. Instead of a limit you hope not to cross, you hand out the money you actually have. What you don't spend rolls into next month, and overspending has to be covered from somewhere.
            </div>
            <div style={segWrap}>
              <button onClick={() => setZeroBased(false)} style={segBtn(!state.zeroBased)}>Off</button>
              <button onClick={() => setZeroBased(true)} style={segBtn(state.zeroBased)}>On</button>
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
              {state.zeroBased ? 'Envelopes is in your menu. Your normal budgets still work alongside it.' : 'Adds an Envelopes screen to the menu. Your normal budgets are left alone either way.'}
            </div>
          </div>
        </>
      )}

      {section === 'backup' && (
        <div style={card}>
          <div style={sectionLabel}>Stored documents</div>
          <StorageSummary docs={state.warrantyDocs} />
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
          <button
            onClick={doZipExport}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '13px 0', borderBottom: `1px solid ${colors.divider}` }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>Export everything as a ZIP</div>
              <div style={{ fontSize: 12.5, color: colors.textSecondary }}>CSV + HTML report + JSON backup + every warranty document, bundled in one file</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>Export</div>
          </button>
          <button
            onClick={() => go('csvImport')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '13px 0', borderBottom: `1px solid ${colors.divider}` }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>Import CSV (no AI)</div>
              <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Bank statement CSV, parsed on-device — you map the columns once</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>Import</div>
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

      {section === 'backup' && (
        <div style={{ ...card, borderColor: colors.dangerBorder }}>
          <div style={{ ...sectionLabel, color: colors.danger }}>Reset app</div>
          <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
            Erases everything on this phone — transactions, budgets, bills, EMIs, warranties and their documents, goals, net worth and envelopes — and clears the automatic recovery snapshots too, so nothing comes back. Back up first if there's any chance you'll want this data again.
          </div>
          <button
            onClick={() => setResetOpen(true)}
            style={{ width: '100%', background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.danger, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Reset app &amp; erase all data
          </button>
        </div>
      )}

      {resetOpen && <ResetDialog onCancel={() => setResetOpen(false)} onConfirm={factoryReset} onBackup={doBackup} />}

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
          <ToggleRow title="App lock" sub="Fingerprint / face / PIN unlock on open" on={state.appLock} onToggle={toggleAppLock} border />
          <ToggleRow
            title="Bank notification capture"
            sub="Also catches RCS bank alerts, which never reach SMS — needs notification access, granted separately in system settings"
            on={state.rcsCaptureEnabled}
            onToggle={toggleRcsCapture}
            border
          />
          <ToggleRow
            title="Clipboard capture"
            sub="Offers to add a transaction when a payment message is copied to your clipboard"
            on={state.clipboardCaptureEnabled}
            onToggle={toggleClipboardCapture}
          />

          {state.captureQueue.length > 0 && (
            <div style={{ marginTop: 13, paddingTop: 13, borderTop: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{state.captureQueue.length} captured item{state.captureQueue.length === 1 ? '' : 's'} to review</div>
              {state.captureQueue.map((item) => (
                <div key={item.id} style={{ background: colors.bgApp, borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{item.merchant}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>
                      {item.type === 'income' ? '+' : '−'}₹{item.amount} · {item.source === 'clipboard' ? 'Clipboard' : 'Notification'}
                    </div>
                  </div>
                  <button onClick={() => confirmCapture(item)} style={{ fontSize: 12.5, fontWeight: 600, color: colors.primary, cursor: 'pointer', padding: '6px 10px' }}>Add</button>
                  <button onClick={() => dismissCapture(item)} style={{ fontSize: 12.5, fontWeight: 600, color: colors.textTertiary, cursor: 'pointer', padding: '6px 10px' }}>Ignore</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'privacy' && notificationsSupported() && (
        <div style={card}>
          <div style={sectionLabel}>Reminders</div>
          <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>
            Get told before a warranty runs out (60 and 15 days ahead) and on the day a bill is due — with a Mark paid button right on the notification. Everything is scheduled on this phone; nothing is sent anywhere.
          </div>
          <button
            onClick={async () => {
              const ok = await askNotificationPermission();
              showToast(ok ? 'Reminders are on' : 'Turn notifications on for Budget Tracker in Android settings');
            }}
            style={{ width: '100%', background: state.notifPermission ? colors.successTint : colors.primary, color: state.notifPermission ? colors.successText : colors.onPrimary, border: `1px solid ${state.notifPermission ? colors.successBorder : colors.primary}`, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}
          >
            {state.notifPermission ? 'Reminders are on ✓' : 'Turn on reminders'}
          </button>
          <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 8, lineHeight: 1.45 }}>
            Reminders are rebuilt each time you open the app, so a phone restart or battery optimisation can't quietly kill them.
          </div>
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

// A miniature of what each theme does to a surface: page behind, card in front,
// with that theme's border weight and depth. The values are literals rather
// than tokens on purpose — the swatch has to show a theme that ISN'T currently
// applied, so it can't read the live CSS variables.
const SKIN_PREVIEW = {
  standard: { page: '#F7F4EE', surface: '#FFFFFF', border: '#E7E2D9', borderWidth: 1, shadow: '0 2px 5px rgba(16,20,24,0.10)' },
  carbon: { page: '#000000', surface: '#0E0E11', border: '#232329', borderWidth: 1, shadow: 'none' },
  glass: { page: '#E8EDF2', surface: 'rgba(255,255,255,0.55)', border: 'rgba(255,255,255,0.85)', borderWidth: 1, shadow: '0 2px 8px rgba(16,20,24,0.10)' },
  neo: { page: '#FFFDF7', surface: '#FFFFFF', border: '#0A0A0A', borderWidth: 2, shadow: '2px 2px 0 rgba(10,10,10,0.9)' },
  serene: { page: '#F4F5F7', surface: '#FFFFFF', border: '#EDEFF2', borderWidth: 1, shadow: '0 3px 9px rgba(42,47,54,0.13)' },
};

function SkinSwatch({ skin }) {
  const p = SKIN_PREVIEW[skin] || SKIN_PREVIEW.standard;
  return (
    <div
      aria-hidden="true"
      style={{
        width: 44, height: 38, borderRadius: 9, background: p.page, flexShrink: 0,
        border: `1px solid ${colors.cardBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: 26, height: 18, borderRadius: 5, background: p.surface, border: `${p.borderWidth}px solid ${p.border}`, boxShadow: p.shadow }} />
    </div>
  );
}

const card = { background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 };

const segWrap = { display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3 };
const segBtn = (on) => ({ flex: 1, padding: '9px 6px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary });

const primaryBtn = { background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '13px', width: '100%', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' };

const sectionLabel = { fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 12 };

const backBtnStyle = { width: 36, height: 36, borderRadius: '50%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 };

// Documents live inside the database so they survive a reinstall, which means
// they also dominate the size of every backup. Worth being able to see.
function StorageSummary({ docs }) {
  const list = docs || [];
  const total = list.reduce((a, d) => a + dataUrlBytes(d.data), 0);
  const biggest = [...list]
    .map((d) => ({ name: d.name || 'Document', bytes: dataUrlBytes(d.data), pdf: (d.mime || '').includes('pdf') }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);

  if (!list.length) {
    return <div style={{ fontSize: 13, color: colors.textTertiary, lineHeight: 1.5 }}>No bills or warranty documents saved yet. Anything you attach is stored here and travels with your backup.</div>;
  }

  return (
    <>
      <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 10 }}>
        <strong style={{ color: colors.ink }}>{list.length}</strong> file{list.length === 1 ? '' : 's'} using <strong style={{ color: colors.ink }}>{formatBytes(total)}</strong>. These are included in every backup.
      </div>
      {biggest.map((d, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 13 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
            <Icon name={d.pdf ? 'doc' : 'image'} size={15} style={{ color: colors.textTertiary }} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
          </span>
          <span style={{ color: colors.textTertiary, flexShrink: 0 }}>{formatBytes(d.bytes)}</span>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 10, lineHeight: 1.45 }}>
        To free space, remove a document from its product in Warranties.
      </div>
    </>
  );
}

// Wiping everything has no undo and no recovery snapshot afterwards, so a tap
// isn't enough — the word has to be typed. The backup button sits inside the
// dialog because this is the last moment it's useful.
function ResetDialog({ onConfirm, onCancel, onBackup }) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);
  const armed = typed.trim().toUpperCase() === 'RESET';

  const go = async () => {
    if (!armed || working) return;
    setWorking(true);
    try {
      await onConfirm();
    } catch {
      setWorking(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={working ? undefined : onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.6)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: 20, padding: 22, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 16px 44px rgba(0,0,0,0.3)' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: colors.danger }}>Erase everything?</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, lineHeight: 1.5 }}>
          This deletes all your data on this phone and the automatic snapshots that would normally bring it back. There is no undo.
        </div>

        <button
          onClick={onBackup}
          disabled={working}
          style={{ background: colors.cardSurface, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: 100, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 2 }}
        >
          Back up first
        </button>

        <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 6 }}>
          Type <strong style={{ color: colors.ink }}>RESET</strong> to confirm
        </div>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="RESET"
          autoCapitalize="characters"
          disabled={working}
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${armed ? colors.danger : colors.cardBorder}`, borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 600, letterSpacing: 1, color: colors.ink, boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={onCancel} disabled={working} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={go}
            disabled={!armed || working}
            style={{ flex: 1, background: armed ? colors.danger : colors.track, color: '#FFFFFF', border: 'none', borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: armed ? 'pointer' : 'default', opacity: working ? 0.7 : 1 }}
          >
            {working ? 'Erasing…' : 'Erase everything'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" style={{ color: 'var(--c-ink)' }}>
      <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
