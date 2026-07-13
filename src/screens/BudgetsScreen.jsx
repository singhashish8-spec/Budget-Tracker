import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { budgetRows } from '../state/selectors';

export default function BudgetsScreen() {
  const { state, set, addBudget } = useApp();
  const { txns, categories, budgets } = state;
  const rows = budgetRows(txns, categories, budgets);
  const overallLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const overallSpent = rows.reduce((a, r) => a + r.spent, 0);
  const overallPct = overallLimit ? Math.min(100, Math.round((overallSpent / overallLimit) * 100)) : 0;

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const availableCats = categories.filter((c) => c.id !== 'income' && c.id !== 'transfer' && !budgets.some((b) => b.cat === c.id));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>Budgets</div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>{monthLabel}</div>
      </div>

      <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: 18, color: colors.bgApp }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: colors.accentGreen3 }}>Overall</div>
          <div style={{ fontSize: 14 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700 }}>{fmt(overallSpent)}</span>
            <span style={{ color: colors.accentGreen3 }}> of {fmt(overallLimit)}</span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 100, background: 'rgba(247,244,238,0.15)' }}>
          <div style={{ height: '100%', borderRadius: 100, background: colors.accentGreen1, width: `${overallPct}%` }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((b) => {
          const barColor = b.status === 'over' ? colors.danger : b.status === 'near' ? colors.warning : colors.primary;
          const statusColor = b.status === 'over' ? colors.danger : b.status === 'near' ? colors.warning : colors.successText;
          return (
            <div key={b.cat} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: tint(b.color), color: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {b.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{b.label}</span>
                  <span>
                    <span style={{ fontWeight: 600 }}>{b.spentF}</span>
                    <span style={{ color: colors.textSecondary }}> / {b.limitF}</span>
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: colors.divider, marginBottom: 6 }}>
                  <div style={{ height: '100%', borderRadius: 100, background: barColor, width: `${b.barPct}%` }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{b.statusText}</div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '12px 0' }}>No budgets set yet</div>}
      </div>

      <button
        onClick={() => set({ budgetSheetOpen: true })}
        style={{ border: `1.5px dashed ${colors.track}`, borderRadius: 18, padding: 14, textAlign: 'center', fontSize: 14, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer' }}
      >
        + Set a new budget
      </button>

      {state.budgetSheetOpen && <NewBudgetSheet availableCats={availableCats} onSave={addBudget} onClose={() => set({ budgetSheetOpen: false })} />}
    </div>
  );
}

function NewBudgetSheet({ availableCats, onSave, onClose }) {
  const [cat, setCat] = useState(null);
  const [amt, setAmt] = useState('');

  const save = () => {
    const n = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    if (!cat || !n) return;
    onSave(cat, n);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px 32px', maxHeight: '72%', overflowY: 'auto', animation: 'sheetup 0.22s ease-out' }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Set a new budget</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 14 }}>Pick a category and a monthly limit</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {availableCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: colors.cardSurface, border: `1.5px solid ${cat === c.id ? colors.primary : colors.cardBorder}`, borderRadius: 14, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {c.mono}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.label}</div>
            </button>
          ))}
          {availableCats.length === 0 && <div style={{ fontSize: 13, color: colors.textTertiary, gridColumn: '1 / -1' }}>Every category already has a budget</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value)}
            placeholder="Monthly limit e.g. 3000"
            style={{ flex: 1, minWidth: 0, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
          />
          <button onClick={save} style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
