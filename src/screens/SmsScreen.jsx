import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';

export default function SmsScreen() {
  const { state, goBack, scanSms, openCategorySheet, addUnmatchedAsTransaction, ignoreUnmatched } = useApp();
  const [scanning, setScanning] = useState(false);
  const [deepScanning, setDeepScanning] = useState(false);
  const on = state.accounts.sms;

  const scan = async () => {
    setScanning(true);
    try {
      await scanSms();
    } finally {
      setScanning(false);
    }
  };

  // Re-reads the entire inbox instead of only what's new. The routine scan only
  // ever looks forward, so a message skipped once could never be found again —
  // this is how anything missed (an unrecognised salary credit, say) comes back.
  const deepScan = async () => {
    setDeepScanning(true);
    try {
      await scanSms({ deep: true });
    } finally {
      setDeepScanning(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>SMS auto-tracking</div>
      </div>

      <div style={{ background: on ? colors.successTint : colors.dangerTint, border: `1px solid ${on ? colors.successBorder : colors.dangerBorder}`, borderRadius: 16, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: on ? colors.primary : colors.danger, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: on ? colors.primary : colors.danger }}>{on ? 'On — reads bank & UPI SMS' : 'Off'}</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Reads on your phone only · duplicate bank + UPI texts are merged</div>
        </div>
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        style={{ background: colors.surfaceDark, color: colors.onPrimary, borderRadius: 100, padding: 14, textAlign: 'center', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: scanning ? 0.6 : 1 }}
      >
        {scanning ? 'Reading your messages…' : 'Scan my messages'}
      </button>

      <button
        onClick={deepScan}
        disabled={deepScanning || scanning}
        style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.primary, borderRadius: 100, padding: 13, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: deepScanning ? 0.6 : 1 }}
      >
        {deepScanning ? 'Checking every message…' : 'Find missed messages (full inbox)'}
      </button>
      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '0 20px', marginTop: -4 }}>
        A normal scan only looks at new texts. Use this to go back through your whole inbox and recover anything that was skipped.
      </div>

      {state.smsUnmatched.length > 0 && (
        <div style={{ background: colors.cardSurface, border: `1px solid ${colors.warningBorder}`, borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.warningDark, paddingBottom: 4 }}>
            Not recognised ({state.smsUnmatched.length})
          </div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, paddingBottom: 8, lineHeight: 1.5 }}>
            These mention money but we couldn't tell what they were. Tell us which way each one went, or hide it for good.
          </div>
          {state.smsUnmatched.map((u, i) => (
            <div key={`${u.date}_${i}`} style={{ padding: '10px 0', borderTop: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary, background: colors.bgApp, border: `1px solid ${colors.divider}`, borderRadius: 12, padding: '8px 11px' }}>{u.rawSms}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => addUnmatchedAsTransaction(u, 'income')} style={pillBtn(colors.successTint, colors.successText, colors.successBorder)}>+ Money in</button>
                <button onClick={() => addUnmatchedAsTransaction(u, 'expense')} style={pillBtn(colors.dangerTint, colors.dangerDark, colors.dangerBorder)}>− Spend</button>
                <button onClick={() => ignoreUnmatched(u)} style={pillBtn(colors.bgApp, colors.textSecondary, colors.cardBorder)}>Ignore</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, paddingBottom: 6 }}>Recently read</div>
        {state.smsLog.map((m) => {
          const t = state.txns.find((x) => x.id === m.txn_id);
          if (!t) return null;
          const cat = state.categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income = t.type === 'income';
          return (
            <div key={m.id} style={{ padding: '10px 0', borderBottom: `1px solid ${colors.divider}`, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary, background: colors.bgApp, border: `1px solid ${colors.divider}`, borderRadius: 12, padding: '8px 11px' }}>{m.raw_sms}</div>
              <button onClick={() => openCategorySheet(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                <div style={{ width: 30, height: 30, borderRadius: 10, background: uncat ? colors.dangerTint : tint(cat.color), color: uncat ? colors.danger : cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                  {uncat ? '?' : cat.mono}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
                  <div style={{ fontSize: 12, color: uncat ? colors.danger : colors.textSecondary, fontWeight: uncat ? 600 : 400 }}>{uncat ? 'Needs review' : `${cat.label} · auto-detected`}</div>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: income ? colors.primary : colors.ink }}>
                  {income ? '+' : '−'}{fmt(t.amount)}
                </div>
              </button>
            </div>
          );
        })}
        {state.smsLog.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary, padding: '12px 0', textAlign: 'center' }}>No SMS read yet — try the simulate button</div>}
      </div>

      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>
        Credits and debits are detected from the SMS text. Anything unclear is flagged red so you can sort it yourself.
      </div>
    </div>
  );
}

const pillBtn = (bg, fg, border) => ({
  flex: 1,
  background: bg,
  color: fg,
  border: `1px solid ${border}`,
  borderRadius: 100,
  padding: '9px 4px',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
});

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
