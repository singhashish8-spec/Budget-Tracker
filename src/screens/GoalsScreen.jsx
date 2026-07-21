import { useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { goalsSummary } from '../state/selectors';

// "YYYY-MM" (from <input type="month">) → timestamp at the last day of that month.
function monthValueToTs(v) {
  if (!v) return null;
  const [y, m] = v.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return null;
  return new Date(y, m, 0).getTime(); // day 0 of next month = last day of this one
}
// timestamp → "YYYY-MM" for the month input.
function tsToMonthValue(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function GoalsScreen() {
  const { state, goBack, addGoal, addToGoal, editGoal, deleteGoal } = useApp();
  const summary = goalsSummary(state.goals);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Savings goals</div>
      </div>

      {summary.count > 0 && (
        <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: '18px 16px', color: colors.bgApp }}>
          <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>Saved across all goals</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, margin: '5px 0 12px' }}>
            {summary.totalSavedF} <span style={{ fontSize: 15, color: colors.accentGreen3 }}>/ {summary.totalTargetF}</span>
          </div>
          <div style={{ height: 6, borderRadius: 100, background: 'rgba(247,244,238,0.15)', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 100, background: colors.accentGreen1, width: `${summary.pct}%` }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: colors.accentGreen3 }}>
            {summary.pct}% of the way{summary.behind > 0 ? ` · ${summary.behind} behind pace` : ''}
          </div>
        </div>
      )}

      {summary.rows.map((r) => (
        <GoalCard
          key={r.id}
          r={r}
          onContribute={addToGoal}
          onEdit={editGoal}
          onDelete={deleteGoal}
        />
      ))}

      {summary.count === 0 && (
        <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '10px 20px', lineHeight: 1.5 }}>
          No goals yet. Set one below — a trip, a gadget, or a rainy-day fund — and track how close you're getting.
        </div>
      )}

      <AddGoal onAdd={addGoal} txns={state.txns} />
    </div>
  );
}

function GoalCard({ r, onContribute, onEdit, onDelete }) {
  const [addAmt, setAddAmt] = useState('');
  const [editing, setEditing] = useState(false);

  const barColor = r.reached ? colors.primary : r.onTrack === false ? colors.warning : colors.primary;
  const paceColor = r.reached ? colors.successText : r.onTrack === false ? colors.warningDark : colors.textSecondary;

  if (editing) {
    return <GoalEditor r={r} onSave={(patch) => { onEdit(r.id, patch); setEditing(false); }} onCancel={() => setEditing(false)} onDelete={() => { onDelete(r.id); setEditing(false); }} />;
  }

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 15 }}>
        <span style={{ fontWeight: 600 }}>{r.label}</span>
        <span>
          <span style={{ fontWeight: 700 }}>{r.savedF}</span>
          <span style={{ color: colors.textSecondary }}> / {r.targetF}</span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 100, background: colors.divider, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 100, background: barColor, width: `${r.pct}%` }} />
      </div>
      <div style={{ fontSize: 12.5, color: paceColor, fontWeight: r.onTrack === false || r.reached ? 600 : 400 }}>{r.paceText}</div>

      <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center' }}>
        <input
          value={addAmt}
          onChange={(e) => setAddAmt(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="Add ₹"
          inputMode="numeric"
          style={{ width: 100, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '8px 13px', fontSize: 13, color: colors.ink }}
        />
        <button
          onClick={() => {
            const n = parseInt(addAmt || '', 10);
            if (!n) return;
            onContribute(r.id, n);
            setAddAmt('');
          }}
          style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          Add
        </button>
        <button onClick={() => setEditing(true)} style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer', marginLeft: 'auto' }}>Edit</button>
      </div>
    </div>
  );
}

// Rename, re-target, correct the saved total, or set/clear the deadline.
function GoalEditor({ r, onSave, onCancel, onDelete }) {
  const [label, setLabel] = useState(r.label);
  const [target, setTarget] = useState(String(r.target));
  const [saved, setSaved] = useState(String(r.saved));
  const [month, setMonth] = useState(tsToMonthValue(r.deadline));

  const save = () => {
    const targetAmount = parseInt(String(target).replace(/[^0-9]/g, ''), 10);
    const savedAmount = parseInt(String(saved).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !targetAmount) return;
    onSave({
      label: label.trim(),
      targetAmount,
      savedAmount: Number.isFinite(savedAmount) ? savedAmount : r.saved,
      targetDate: month ? monthValueToTs(month) : null,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Goal name" style={inputStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={saved} onChange={(e) => setSaved(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Saved ₹" style={{ ...inputStyle, flex: 1 }} />
        <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Target ₹" style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 5 }}>Target date (optional)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          {month && <button onClick={() => setMonth('')} style={{ fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, cursor: 'pointer', padding: '0 4px' }}>Clear</button>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={onCancel} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={save} style={{ flex: 1, background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
      </div>
      <button onClick={onDelete} style={{ fontSize: 12.5, fontWeight: 600, color: colors.danger, cursor: 'pointer', padding: 4 }}>Delete this goal</button>
    </div>
  );
}

function AddGoal({ onAdd, txns }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [target, setTarget] = useState('');
  const [month, setMonth] = useState('');

  const submit = () => {
    const targetAmount = parseInt(String(target).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !targetAmount) return;
    onAdd({ label: label.trim(), targetAmount, targetDate: month ? monthValueToTs(month) : null });
    setLabel('');
    setTarget('');
    setMonth('');
    setOpen(false);
  };

  // Emergency-fund preset: prefill the name, and suggest ~6 months of expenses
  // from the last 90 days of spending (rounded), so it's grounded in real data.
  const startEmergency = () => {
    const cutoff = Date.now() - 90 * 86400000;
    const spent90 = txns
      .filter((t) => t.type === 'expense' && (t.occurred_at || t.sms_date || t.created_at || 0) >= cutoff)
      .reduce((a, t) => a + t.amount, 0);
    const sixMonths = spent90 > 0 ? Math.round((spent90 / 3) * 6 / 1000) * 1000 : 0;
    setLabel('Emergency fund');
    setTarget(sixMonths ? String(sixMonths) : '');
    setMonth('');
    setOpen(true);
  };

  if (!open) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={() => setOpen(true)} style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '13px 20px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>+ New savings goal</button>
        <button onClick={startEmergency} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.primary, borderRadius: 100, padding: '12px 20px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>🛟 Start an emergency fund</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16 }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Goa trip, new phone, rainy day" style={inputStyle} />
      <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Target ₹" style={inputStyle} />
      <div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 5 }}>Target date (optional — enables pace tracking)</div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button onClick={() => { setOpen(false); setLabel(''); setTarget(''); setMonth(''); }} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} style={{ flex: 1, background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: 11, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save goal</button>
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
    <svg width="9" height="15" viewBox="0 0 9 15">
      <path d="M8 1L2 7.5 8 14" stroke="#1B1F23" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
