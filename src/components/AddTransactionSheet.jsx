import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { useApp } from '../state/AppContext';

// Hand-entered transactions. Cash never generates an SMS, so without this
// there was no way to record it at all — money simply left the picture. Also
// covers anything SMS tracking can't see (RCS bank alerts, for instance).

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'bank', label: 'Bank' },
];

function todayInputValue(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AddTransactionSheet() {
  const { state, set, addManualTransaction } = useApp();
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [method, setMethod] = useState('cash');
  const [when, setWhen] = useState(todayInputValue());
  const [cat, setCat] = useState(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!state.addSheetOpen) return null;

  const close = () => set({ addSheetOpen: false });
  const amountNum = Math.round(parseFloat(amount.replace(/,/g, '')) || 0);
  const valid = amountNum > 0;
  const income = type === 'income';

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      // Keep the time-of-day when the date is today so the entry sorts
      // naturally against today's other activity; backdated entries land at
      // midday, which reads sensibly and avoids timezone edge cases.
      const picked = new Date(`${when}T12:00:00`);
      const isToday = when === todayInputValue();
      const occurredAt = isToday ? Date.now() : picked.getTime();
      await addManualTransaction({
        merchant: name.trim() || (income ? 'Cash received' : 'Cash payment'),
        amount: amountNum,
        type,
        method,
        cat,
        note: note.trim() || null,
        occurredAt,
      });
      setAmount('');
      setName('');
      setNote('');
      setCat(null);
      setWhen(todayInputValue());
      setType('expense');
      setMethod('cash');
      close();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px 32px', maxHeight: '92%', overflowY: 'auto', animation: 'sheetup 0.22s ease-out' }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 16px' }} />

        {/* Spent or received */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            { key: 'expense', label: 'I spent' },
            { key: 'income', label: 'I received' },
          ].map((o) => (
            <button
              key={o.key}
              onClick={() => setType(o.key)}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: 14,
                fontSize: 14.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: type === o.key ? (o.key === 'income' ? colors.primary : colors.ink) : colors.cardSurface,
                color: type === o.key ? colors.onPrimary : colors.textSecondary,
                border: `1px solid ${type === o.key ? 'transparent' : colors.cardBorder}`,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: '14px 16px', marginBottom: 12 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: income ? colors.primary : colors.ink }}>₹</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
            autoFocus
            placeholder="0"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: income ? colors.primary : colors.ink, minWidth: 0 }}
          />
        </div>

        {/* What for */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={income ? 'Who from? (optional)' : 'What was it for? (optional)'}
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '12px 16px', fontSize: 14.5, color: colors.ink, marginBottom: 12 }}
        />

        {/* Method */}
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 8 }}>
          {income ? 'Received as' : 'Paid with'}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: 100,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                background: method === m.key ? colors.primary : colors.cardSurface,
                color: method === m.key ? colors.onPrimary : colors.textSecondary,
                border: `1px solid ${method === m.key ? 'transparent' : colors.cardBorder}`,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* When */}
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 8 }}>When</div>
        <input
          type="date"
          value={when}
          max={todayInputValue()}
          onChange={(e) => setWhen(e.target.value)}
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '12px 16px', fontSize: 14.5, color: colors.ink, marginBottom: 14 }}
        />

        {/* Category */}
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 8 }}>
          Category <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>— optional, you can set it later</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {state.categories
            .filter((c) => (income ? true : c.id !== 'income') && !state.disabledCats.includes(c.id))
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(cat === c.id ? null : c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 9, background: colors.cardSurface, border: `1px solid ${cat === c.id ? colors.primary : colors.cardBorder}`, borderRadius: 14, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 26, height: 26, borderRadius: 8, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 10.5, flexShrink: 0 }}>
                  {c.mono}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</div>
              </button>
            ))}
        </div>

        {/* Note */}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '12px 16px', fontSize: 14.5, color: colors.ink, marginBottom: 16 }}
        />

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={close} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            style={{ flex: 2, background: valid ? colors.primary : colors.track, color: colors.onPrimary, borderRadius: 100, padding: 14, fontSize: 15, fontWeight: 600, cursor: valid ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving…' : income ? 'Add money in' : 'Add spend'}
          </button>
        </div>
      </div>
    </div>
  );
}
