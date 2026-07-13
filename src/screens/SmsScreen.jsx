import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';

// Canned SMS templates for the simulate button — the same "extract from text"
// path a real Android SMS_RECEIVED listener would feed. Production would add
// that native listener; per the design review, shipping it live is a Google
// Play restricted-permissions risk (Play only allows SMS read for a default
// SMS/dialer app or a narrow declared-use exception) that needs a Play
// Console declared-use justification before it goes out, not just a toggle.
const SMS_QUEUE = [
  { sms: 'ICICI Bank: Rs 240.00 debited from a/c **8890 on 11-07-26 at BLINKIT*BANGALORE. Avl bal Rs 42,310.', merchant: 'Blinkit', amount: 240, cat: 'groceries', type: 'expense' },
  { sms: 'HDFC Bank: Rs 500.00 credited to a/c **3412 on 11-07-26 via UPI from rahul.sharma@okhdfcbank. Ref 662104.', merchant: 'UPI from Rahul Sharma', amount: 500, cat: null, type: 'income' },
  { sms: 'HDFC Bank: Rs 3,450.00 debited from a/c **3412 on 11-07-26 at POS AXIS*9921. Ref 771204.', merchant: 'POS AXIS*9921', amount: 3450, cat: null, type: 'expense' },
];

export default function SmsScreen() {
  const { state, go, simulateSms, openCategorySheet } = useApp();
  const [i, setI] = useState(0);
  const on = state.accounts.sms;

  const simulate = () => {
    const q = SMS_QUEUE[i % SMS_QUEUE.length];
    simulateSms({ rawSms: q.sms, merchant: q.merchant, amount: q.amount, cat: q.cat, type: q.type });
    setI(i + 1);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={() => go('home')} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>SMS auto-tracking</div>
      </div>

      <div style={{ background: on ? colors.successTint : colors.dangerTint, border: `1px solid ${on ? colors.successBorder : colors.dangerBorder}`, borderRadius: 16, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: on ? colors.primary : colors.danger, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: on ? colors.primary : colors.danger }}>{on ? 'On — watching your inbox' : 'Off'}</div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary }}>HDFC, ICICI, GPay &amp; Paytm sender IDs · reads on your phone only</div>
        </div>
      </div>

      <button
        onClick={simulate}
        style={{ background: colors.surfaceDark, color: colors.bgApp, borderRadius: 100, padding: 14, textAlign: 'center', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
      >
        Simulate an incoming SMS
      </button>

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
