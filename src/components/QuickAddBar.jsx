import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { parseQuickEntry } from '../services/quickAdd';

// A one-line "type it and go" logger for cash / quick spends, e.g.
// "500 groceries", "1200 petrol", "got 5000 salary". Guesses the category from
// keywords; if it can't, it shows a quick category picker.
export default function QuickAddBar() {
  const { state, addManualTransaction, showToast } = useApp();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(null); // { amount, type, item } awaiting a category

  const cats = state.categories.filter((c) => !(state.disabledCats || []).includes(c.id));
  const catIds = cats.map((c) => c.id);

  const commit = async ({ amount, type, item }, catId) => {
    const cat = cats.find((c) => c.id === catId);
    const merchant = item || (type === 'income' ? 'Money in' : cat?.label || 'Cash spend');
    await addManualTransaction({ merchant, amount, type, method: 'cash', cat: catId, note: null, occurredAt: Date.now() });
    setText('');
    setPending(null);
  };

  const submit = async () => {
    const res = parseQuickEntry(text, catIds);
    if (res.error) { showToast(res.error); return; }
    if (res.cat) { await commit(res, res.cat); return; }
    // No category guessed — ask.
    setPending({ amount: res.amount, type: res.type, item: res.item });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); if (pending) setPending(null); }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Quick add — e.g. 500 groceries, 1200 petrol"
          style={{ flex: 1, minWidth: 0, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
        />
        <button
          onClick={submit}
          style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '0 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
        >
          Add
        </button>
      </div>

      {pending && (
        <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: colors.textSecondary }}>
            {pending.item ? `“${pending.item}” · ` : ''}₹{Math.round(pending.amount).toLocaleString('en-IN')} — which category?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => commit(pending, c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 100, cursor: 'pointer', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, color: colors.ink, fontSize: 12.5, fontWeight: 600 }}
              >
                <span style={{ width: 18, height: 18, borderRadius: 5, background: tint(c.color), color: c.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 8.5 }}>{c.mono}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
