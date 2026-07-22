import { useState } from 'react';
import { colors, tint } from '../../theme/tokens';
import { useApp } from '../../state/AppContext';

const ACCOUNT_TYPES = [
  { key: 'bank', label: 'Bank accounts', sub: 'Savings & current — statements', mono: 'BK', color: '#0E6E4F' },
  { key: 'card', label: 'Credit cards', sub: 'Bills & monthly statements', mono: 'CC', color: '#7A5C9E' },
  { key: 'upi', label: 'UPI apps', sub: 'GPay, PhonePe, Paytm history', mono: 'UP', color: '#2D6E8F' },
  { key: 'sms', label: 'SMS auto-tracking', sub: 'Reads bank & UPI SMS to log spends instantly', mono: 'SM', color: '#C2622E' },
  { key: 'cash', label: 'Cash', sub: 'Add cash spends by hand or bill photo', mono: 'CA', color: '#B8892B' },
  { key: 'invest', label: 'Investments', sub: 'Mutual funds, stocks, SIPs', mono: 'MF', color: '#1E8F72' },
  { key: 'loans', label: 'Loans & EMIs', sub: 'Personal, home, vehicle EMIs', mono: 'LN', color: '#A13B3B' },
];

const dot = (active) => ({ height: 4, flex: 1, borderRadius: 100, background: active ? colors.primary : colors.track });

export default function Onboarding() {
  const { state } = useApp();
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={dot(state.obStep >= 1)} />
        <div style={dot(state.obStep >= 2)} />
        <div style={dot(state.obStep >= 3)} />
      </div>
      {state.obStep === 1 && <StepSignIn />}
      {state.obStep === 2 && <StepTrack />}
      {state.obStep === 3 && <StepCategories />}
    </div>
  );
}

function StepSignIn() {
  const { obNext } = useApp();
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 15,
            background: colors.primary,
            color: colors.onPrimary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 21,
          }}
        >
          BT
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, lineHeight: 1.15 }}>Budget Tracker</div>
        <div style={{ fontSize: 15, color: colors.textSecondary, lineHeight: 1.45 }}>
          Link what you use. We'll read your bills and statements, sort every expense, and flag anything we can't recognise.
        </div>
      </div>
      <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: '13px 14px' }}>
        Your data is encrypted and stays on this device. You can back it up to Google Drive anytime from Settings.
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          onClick={obNext}
          style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 16, textAlign: 'center', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
        >
          Get started
        </button>
      </div>
    </>
  );
}

function StepTrack() {
  const { state, toggleAccount, obNext, obBack } = useApp();
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700 }}>What should we track?</div>
        <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.45 }}>Turn on everything you use — change this later in Settings.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ACCOUNT_TYPES.map((a) => {
          const on = state.accounts[a.key];
          return (
            <button
              key={a.key}
              onClick={() => toggleAccount(a.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 12, background: tint(a.color), color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {a.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{a.label}</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{a.sub}</div>
              </div>
              <div style={{ width: 44, height: 26, borderRadius: 100, background: on ? colors.primary : colors.track, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
                <div style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.15s' }} />
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
        <button onClick={obBack} style={{ flex: 1, background: colors.cardSurface, border: `1.5px solid ${colors.cardBorder}`, borderRadius: 100, padding: 15, textAlign: 'center', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Back
        </button>
        <button onClick={obNext} style={{ flex: 2, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 16, textAlign: 'center', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Continue
        </button>
      </div>
    </>
  );
}

function StepCategories() {
  const { state, addCategory, toggleCategoryEnabled, obBack, finishOnboarding } = useApp();
  const [newCat, setNewCat] = useState('');

  const submit = async () => {
    if (!newCat.trim()) return;
    await addCategory(newCat);
    setNewCat('');
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700 }}>Your categories</div>
        <div style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.45 }}>Tap to turn categories on or off. Add your own below.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {state.categories
          .filter((c) => c.id !== 'income' && c.id !== 'transfer')
          .map((c) => {
            const on = !state.disabledCats.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleCategoryEnabled(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  background: on ? colors.cardSurface : 'transparent',
                  border: `1.5px solid ${on ? colors.primary : colors.cardBorder}`,
                  borderRadius: 14,
                  padding: '10px 11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  opacity: on ? 1 : 0.5,
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 9, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                  {c.mono}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>{c.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: on ? colors.primary : colors.textTertiary }}>{on ? '✓' : '+'}</div>
              </button>
            );
          })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Add your own category"
          style={{ flex: 1, minWidth: 0, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
        />
        <button onClick={submit} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add
        </button>
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', gap: 10 }}>
        <button onClick={obBack} style={{ flex: 1, background: colors.cardSurface, border: `1.5px solid ${colors.cardBorder}`, borderRadius: 100, padding: 15, textAlign: 'center', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Back
        </button>
        <button onClick={finishOnboarding} style={{ flex: 2, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 16, textAlign: 'center', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
          Start tracking
        </button>
      </div>
    </>
  );
}

