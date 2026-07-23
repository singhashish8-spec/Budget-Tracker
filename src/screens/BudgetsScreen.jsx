import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { budgetRows, suggestedLimit } from '../state/selectors';
import { salaryDayLabel } from '../utils/date';
import Amount from '../components/Amount';

const PERIOD_LABELS = { month: 'This month', cycle: 'This pay cycle', custom: 'Until deadline' };

function dateInputValue(ms) {
  const d = ms ? new Date(ms) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Shared period picker: calendar month, payday-to-payday, or a deadline.
function PeriodPicker({ period, setPeriod, endsAt, setEndsAt, salaryDay }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {[
          { key: 'month', label: 'Monthly' },
          { key: 'cycle', label: 'Pay cycle' },
          { key: 'custom', label: 'Deadline' },
        ].map((o) => (
          <button
            key={o.key}
            onClick={() => setPeriod(o.key)}
            style={{
              flex: 1,
              padding: '9px 4px',
              borderRadius: 100,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              background: period === o.key ? colors.primary : colors.cardSurface,
              color: period === o.key ? colors.onPrimary : colors.textSecondary,
              border: `1px solid ${period === o.key ? 'transparent' : colors.cardBorder}`,
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {period === 'cycle' && (
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
          Resets on payday ({salaryDayLabel(salaryDay)}), not on the 1st.
        </div>
      )}
      {period === 'custom' && (
        <input
          type="date"
          value={endsAt}
          min={dateInputValue()}
          onChange={(e) => setEndsAt(e.target.value)}
          style={{ width: '100%', marginTop: 8, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
        />
      )}
    </>
  );
}

export default function BudgetsScreen() {
  const { state, set, addBudget, editBudget, removeBudget } = useApp();
  const [editingCat, setEditingCat] = useState(null);
  const { txns, categories, budgets } = state;
  const rows = budgetRows(txns, categories, budgets, { salaryDay: state.salaryDay });
  const overallLimit = budgets.reduce((a, b) => a + b.limit, 0);
  const overallSpent = rows.reduce((a, r) => a + r.spent, 0);
  const overallPct = overallLimit ? Math.min(100, Math.round((overallSpent / overallLimit) * 100)) : 0;
  const overallPerDay = rows.reduce((a, r) => a + r.perDay, 0);
  const soonestDaysLeft = rows.length ? Math.min(...rows.map((r) => r.daysLeft)) : 0;

  const monthLabel = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const availableCats = categories.filter(
    (c) => c.id !== 'income' && c.id !== 'transfer' && !state.disabledCats.includes(c.id) && !budgets.some((b) => b.cat === c.id),
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>Budgets</div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>{monthLabel}</div>
      </div>

      <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: 18, color: colors.onPrimary }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: colors.accentGreen3 }}>Overall</div>
          <div style={{ fontSize: 14 }}>
            <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700 }}>{fmt(overallSpent)}</Amount>
            <span style={{ color: colors.accentGreen3 }}> of <Amount>{fmt(overallLimit)}</Amount></span>
          </div>
        </div>
        <div style={{ height: 6, borderRadius: 100, background: 'rgba(247,244,238,0.15)' }}>
          <div style={{ height: '100%', borderRadius: 100, background: colors.accentGreen1, width: `${overallPct}%` }} />
        </div>
        {rows.length > 0 && soonestDaysLeft > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: colors.accentGreen2 }}>
            <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>{fmt(overallPerDay)}</Amount>
            <span style={{ color: colors.accentGreen3 }}> a day left across all budgets</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((b) => {
          const barColor = b.status === 'over' ? colors.danger : b.status === 'near' ? colors.warning : colors.primary;
          const statusColor = b.status === 'over' ? colors.danger : b.status === 'near' ? colors.warning : colors.successText;
          return (
            <button
              key={b.cat}
              onClick={() => setEditingCat(b.cat)}
              style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer' }}
            >
              <div style={{ width: 38, height: 38, borderRadius: 12, background: tint(b.color), color: b.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {b.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600 }}>{b.label}</span>
                  <span>
                    <Amount style={{ fontWeight: 600 }}>{b.spentF}</Amount>
                    <span style={{ color: colors.textSecondary }}> / <Amount>{b.limitF}</Amount></span>
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: colors.divider, marginBottom: 6 }}>
                  <div style={{ height: '100%', borderRadius: 100, background: barColor, width: `${b.barPct}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: statusColor }}>{b.statusText}</div>
                  {/* What's actually spendable per day. Overspending shrinks
                      this automatically, which is the whole point of it. */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: b.status === 'over' ? colors.danger : b.aheadOfPace ? colors.warning : colors.textSecondary, flexShrink: 0 }}>
                    {b.paceText}
                  </div>
                </div>
                {b.aheadOfPace && b.status !== 'over' && (
                  <div style={{ fontSize: 11.5, color: colors.warning, marginTop: 3 }}>Spending faster than this budget allows</div>
                )}
                <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 3 }}>{PERIOD_LABELS[b.period] || 'This month'}</div>
              </div>
            </button>
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

      {state.budgetSheetOpen && (
        <NewBudgetSheet
          availableCats={availableCats}
          onSave={addBudget}
          onClose={() => set({ budgetSheetOpen: false })}
          txns={txns}
          salaryDay={state.salaryDay}
        />
      )}
      {editingCat && (
        <EditBudgetSheet
          row={rows.find((r) => r.cat === editingCat)}
          salaryDay={state.salaryDay}
          onSave={async (limit, opts) => {
            await editBudget(editingCat, limit, opts);
            setEditingCat(null);
          }}
          onRemove={async () => {
            await removeBudget(editingCat);
            setEditingCat(null);
          }}
          onClose={() => setEditingCat(null)}
        />
      )}
    </div>
  );
}

// Budgets were write-once: the only way to correct a limit was to live with it.
function EditBudgetSheet({ row, onSave, onRemove, onClose, salaryDay }) {
  const [amt, setAmt] = useState(String(row?.limit ?? ''));
  const [period, setPeriod] = useState(row?.period || 'month');
  const [endsAt, setEndsAt] = useState(row?.window?.kind === 'custom' ? dateInputValue(+row.window.end) : '');
  if (!row) return null;
  const n = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px 32px', animation: 'sheetup 0.22s ease-out' }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{row.label} budget</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary }}>
          <Amount>{row.spentF}</Amount> spent · {row.paceText}
        </div>
        <PeriodPicker period={period} setPeriod={setPeriod} endsAt={endsAt} setEndsAt={setEndsAt} salaryDay={salaryDay} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 14, padding: '12px 16px', margin: '12px 0' }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>₹</span>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            autoFocus
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: colors.ink, minWidth: 0 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() =>
              n > 0 &&
              !(period === 'custom' && !endsAt) &&
              onSave(n, {
                period,
                startsAt: period === 'custom' ? (row.window?.kind === 'custom' ? +row.window.start : Date.now()) : null,
                endsAt: period === 'custom' ? new Date(`${endsAt}T23:59:59`).getTime() : null,
              })
            }
            style={{ flex: 2, background: n > 0 ? colors.primary : colors.track, color: colors.onPrimary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: n > 0 ? 'pointer' : 'default' }}
          >
            Save changes
          </button>
        </div>
        <button
          onClick={onRemove}
          style={{ width: '100%', marginTop: 10, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.dangerDark, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Remove this budget
        </button>
      </div>
    </div>
  );
}

function NewBudgetSheet({ availableCats, onSave, onClose, txns, salaryDay }) {
  const [cat, setCat] = useState(null);
  const [amt, setAmt] = useState('');
  const [period, setPeriod] = useState('month');
  const [endsAt, setEndsAt] = useState('');

  // What this category has actually cost recently, so the limit is an informed
  // decision rather than a guess.
  const suggestion = cat ? suggestedLimit(txns, cat) : 0;

  const save = () => {
    const n = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    if (!cat || !n) return;
    if (period === 'custom' && !endsAt) return;
    onSave(cat, n, {
      period,
      startsAt: period === 'custom' ? Date.now() : null,
      endsAt: period === 'custom' ? new Date(`${endsAt}T23:59:59`).getTime() : null,
    });
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
        <PeriodPicker period={period} setPeriod={setPeriod} endsAt={endsAt} setEndsAt={setEndsAt} salaryDay={salaryDay} />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            placeholder="Limit e.g. 3000"
            style={{ flex: 1, minWidth: 0, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
          />
          <button onClick={save} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Save
          </button>
        </div>
        {suggestion > 0 && (
          <button
            onClick={() => setAmt(String(suggestion))}
            style={{ marginTop: 8, fontSize: 12.5, color: colors.primary, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
          >
            You usually spend about <Amount>{fmt(suggestion)}</Amount> a month here — use that
          </button>
        )}
      </div>
    </div>
  );
}
