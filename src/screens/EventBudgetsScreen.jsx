import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { eventBudgetRow } from '../state/selectors';
import { fmt } from '../utils/currency';
import Amount from '../components/Amount';

// "YYYY-MM-DD" (from <input type="date">) → timestamp. `end` rounds up to the
// end of that day so a one-day event (e.g. a single wedding function) still
// captures transactions made any time on that date.
function dateValueToTs(v, end = false) {
  if (!v) return null;
  const [y, m, d] = v.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return end ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime() : new Date(y, m - 1, d).getTime();
}
function tsToDateValue(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EventBudgetsScreen() {
  const { state, goBack, addEventBudget, editEventBudget, deleteEventBudget } = useApp();
  const rows = state.eventBudgets.map((e) => eventBudgetRow(e, state.txns, state.categories, state.eventBudgets));
  const active = rows.filter((r) => r.status === 'active');
  const other = rows.filter((r) => r.status !== 'active');

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Festival & event budgets</div>
      </div>

      <div style={{ fontSize: 13, color: colors.textSecondary, padding: '0 4px', lineHeight: 1.5 }}>
        A temporary budget for a named event — Diwali, a wedding, a trip — with its own date range. Spend is tallied automatically from your transactions in that window, and compared against the same event last year.
      </div>

      {active.map((r) => (
        <EventCard key={r.id} r={r} onEdit={editEventBudget} onDelete={deleteEventBudget} categories={state.categories} />
      ))}
      {other.map((r) => (
        <EventCard key={r.id} r={r} onEdit={editEventBudget} onDelete={deleteEventBudget} categories={state.categories} />
      ))}

      {rows.length === 0 && (
        <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '10px 20px', lineHeight: 1.5 }}>
          No event budgets yet. Add one below for an upcoming festival or wedding.
        </div>
      )}

      <AddEventBudget onAdd={addEventBudget} categories={state.categories} />
    </div>
  );
}

function EventCard({ r, onEdit, onDelete, categories }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EventEditor
        r={r}
        categories={categories}
        onSave={(patch) => { onEdit(r.id, patch); setEditing(false); }}
        onCancel={() => setEditing(false)}
        onDelete={() => { onDelete(r.id); setEditing(false); }}
      />
    );
  }

  const barColor = r.over ? colors.danger : colors.primary;
  const statusLabel = r.status === 'upcoming' ? 'Upcoming' : r.status === 'past' ? 'Ended' : 'Happening now';

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 11, background: tint(r.color), color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
          {r.mono}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{r.label}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>{r.startLabel} – {r.endLabel} · {r.categoryLabel}</div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: r.status === 'active' ? colors.primary : colors.textTertiary }}>{statusLabel}</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 15 }}>
        <Amount style={{ fontWeight: 700 }}>{r.spentF}</Amount>
        <span style={{ color: colors.textSecondary, fontSize: 13 }}>of <Amount>{r.limitF}</Amount></span>
      </div>
      <div style={{ height: 7, borderRadius: 100, background: colors.divider, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 100, background: barColor, width: `${r.barPct}%` }} />
      </div>
      <div style={{ fontSize: 12.5, color: r.over ? colors.danger : colors.textSecondary, fontWeight: r.over ? 600 : 400 }}>
        {r.over ? `Over by ${fmt(r.spent - r.limit)}` : `${r.remainingF} left`}
      </div>

      {r.priorLabel && (
        <div style={{ background: colors.bgApp, borderRadius: 12, padding: '9px 11px', fontSize: 12.5, color: colors.textSecondary }}>
          vs <b style={{ color: colors.ink }}>{r.priorLabel}</b>: spent <Amount>{r.priorSpentF}</Amount>
          {r.priorDeltaPct != null && (
            <span style={{ color: r.priorDeltaPct > 0 ? colors.danger : colors.successText, fontWeight: 600 }}>
              {' '}({r.priorDeltaPct > 0 ? '+' : ''}{r.priorDeltaPct}% {r.priorDeltaPct > 0 ? 'more' : 'less'})
            </span>
          )}
        </div>
      )}

      <button onClick={() => setEditing(true)} style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer', marginLeft: 'auto', padding: '2px 4px' }}>Edit</button>
    </div>
  );
}

function EventEditor({ r, categories, onSave, onCancel, onDelete }) {
  const [label, setLabel] = useState(r.label);
  const [start, setStart] = useState(tsToDateValue(r.startsAt));
  const [end, setEnd] = useState(tsToDateValue(r.endsAt));
  const [amount, setAmount] = useState(String(r.limit));
  const [catId, setCatId] = useState(r.categoryId || '');

  const save = () => {
    const startsAt = dateValueToTs(start);
    const endsAt = dateValueToTs(end, true);
    const budgetAmount = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !startsAt || !endsAt || !budgetAmount) return;
    onSave({ label: label.trim(), startsAt, endsAt, budgetAmount, categoryId: catId || null });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali 2026" style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      </div>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Budget ₹" style={inputStyle} />
      <select value={catId} onChange={(e) => setCatId(e.target.value)} style={inputStyle}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={onCancel} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} style={{ flex: 1, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
      </div>
      <button onClick={onDelete} style={{ fontSize: 12.5, fontWeight: 600, color: colors.danger, cursor: 'pointer', padding: 4 }}>Delete this event</button>
    </div>
  );
}

function AddEventBudget({ onAdd, categories }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState('');

  const reset = () => { setLabel(''); setStart(''); setEnd(''); setAmount(''); setCatId(''); setOpen(false); };

  const submit = () => {
    const startsAt = dateValueToTs(start);
    const endsAt = dateValueToTs(end, true);
    const budgetAmount = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !startsAt || !endsAt || !budgetAmount) return;
    onAdd({ label: label.trim(), startsAt, endsAt, budgetAmount, categoryId: catId || null });
    reset();
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '13px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
        + New event budget
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Diwali 2026, Priya's wedding" style={inputStyle} />
      <div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 5 }}>Date range</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        </div>
      </div>
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Budget ₹" style={inputStyle} />
      <select value={catId} onChange={(e) => setCatId(e.target.value)} style={inputStyle}>
        <option value="">All categories (any spending counts)</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={reset} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} style={{ flex: 1, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save event</button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: colors.bgApp,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12,
  padding: '11px 13px',
  fontSize: 14,
  color: colors.ink,
  boxSizing: 'border-box',
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
