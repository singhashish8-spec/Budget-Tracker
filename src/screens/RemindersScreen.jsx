import { useState } from 'react';
import { colors } from '../theme/tokens';
import { currentMonthKey, ordinal } from '../utils/date';
import { useApp } from '../state/AppContext';
import { billRow } from '../state/selectors';
import Amount from '../components/Amount';
import Sheet from '../components/Sheet';

const KINDS = [
  { key: 'bill', label: 'Bill' },
  { key: 'emi', label: 'Loan / EMI' },
  { key: 'subscription', label: 'Subscription' },
];

// "YYYY-MM" → timestamp at the first day of that month.
function monthToTs(v) {
  if (!v) return null;
  const [y, m] = v.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return null;
  return new Date(y, m - 1, 1).getTime();
}
function tsToMonth(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RemindersScreen() {
  const { state, goBack, addReminder, toggleReminderPaid, deleteReminder, editReminder } = useApp();
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [kind, setKind] = useState('bill');
  const [cadence, setCadence] = useState('monthly');
  const [termCount, setTermCount] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const monthKey = currentMonthKey();

  const reset = () => {
    setLabel(''); setAmt(''); setDueDate(''); setKind('bill'); setCadence('monthly'); setTermCount(''); setStartMonth('');
  };

  const submit = () => {
    const amount = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    const dueDay = dueDate ? new Date(dueDate).getDate() : 1;
    if (!label.trim() || !amount || !dueDate) return;
    const payload = { label: label.trim(), amount, dueDay, kind };
    if (kind === 'emi') {
      payload.termCount = parseInt(String(termCount).replace(/[^0-9]/g, ''), 10) || null;
      // Anchor the loan to the chosen first-instalment month, or the due date's month.
      payload.startAt = startMonth ? monthToTs(startMonth) : new Date(new Date(dueDate).getFullYear(), new Date(dueDate).getMonth(), 1).getTime();
    } else if (kind === 'subscription') {
      payload.cadence = cadence;
    }
    addReminder(payload);
    reset();
  };

  const rows = [...state.reminders].sort((a, b) => a.due_day - b.due_day).map((r) => ({ raw: r, ...billRow(r) }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Bills &amp; EMIs</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((b) => {
          const paid = b.raw.paid_for === monthKey;
          return (
            <div key={b.id} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, opacity: paid ? 0.55 : 1 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: colors.warningTint, color: colors.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {b.label.slice(0, 2).toUpperCase()}
              </div>
              <button onClick={() => setEditingId(b.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', background: 'transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.label}</span>
                  {b.badge && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, padding: '2px 6px', borderRadius: 6, background: colors.divider, color: colors.textSecondary, flexShrink: 0 }}>{b.badge}</span>
                  )}
                </div>
                <div style={{ fontSize: 12.5, color: paid ? colors.successText : colors.warning, fontWeight: 500 }}>
                  {paid ? 'Paid this month' : `Due ${ordinal(b.dueDay)}`}
                </div>
                {b.typeText && <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>{b.typeText}</div>}
              </button>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <Amount style={{ fontSize: 14.5, fontWeight: 600 }}>{b.amountF}</Amount>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleReminderPaid(b.id, monthKey)}
                    style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 13px', borderRadius: 100, cursor: 'pointer', background: paid ? colors.successTint : colors.primary, color: paid ? colors.primary : colors.onPrimary, border: `1px solid ${paid ? colors.successBorder : colors.primary}` }}
                  >
                    {paid ? 'Paid' : 'Mark paid'}
                  </button>
                  <button onClick={() => deleteReminder(b.id)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 10px', borderRadius: 100, cursor: 'pointer', background: 'transparent', color: colors.textTertiary }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '12px 0' }}>No bills added yet</div>}
        {editingId && (
          <EditReminderSheet
            reminder={state.reminders.find((x) => x.id === editingId)}
            onSave={async (patch) => {
              await editReminder(editingId, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary }}>Add a bill</div>
        <SegPicker options={KINDS} value={kind} onChange={setKind} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'emi' ? 'e.g. Car loan' : kind === 'subscription' ? 'e.g. Netflix' : 'e.g. Electricity'} style={inputStyle} />
        <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder={kind === 'emi' ? 'Monthly instalment ₹' : '₹ amount'} style={inputStyle} />

        {kind === 'subscription' && (
          <SegPicker options={[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]} value={cadence} onChange={setCadence} />
        )}
        {kind === 'emi' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={termCount} onChange={(e) => setTermCount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Total instalments" style={{ ...inputStyle, flex: 1 }} />
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ ...inputStyle, flex: 1, color: startMonth ? colors.ink : colors.textTertiary }} />
          </div>
        )}
        {kind === 'emi' && <div style={{ fontSize: 11.5, color: colors.textTertiary, paddingLeft: 4 }}>Total number of EMIs and the month the first one was due.</div>}

        <label style={{ fontSize: 12.5, color: colors.textSecondary, paddingLeft: 4 }}>Due date {kind === 'subscription' && cadence === 'yearly' ? '(renews yearly)' : '(repeats monthly on this day)'}</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, color: dueDate ? colors.ink : colors.textTertiary }} />
        <button onClick={submit} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add {kind === 'emi' ? 'EMI' : kind === 'subscription' ? 'subscription' : 'bill'}
        </button>
      </div>

      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Mark a bill paid each month — it resets automatically next month</div>
    </div>
  );
}

function SegPicker({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3 }}>
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{ flex: 1, padding: '8px 6px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary, border: 'none' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const inputStyle = {
  background: colors.bgApp,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 100,
  padding: '11px 16px',
  fontSize: 14,
  color: colors.ink,
  minWidth: 0,
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

// Bills were write-once: a wrong amount or due date meant deleting and
// re-adding, which threw away the paid-this-month status with it.
function EditReminderSheet({ reminder, onSave, onClose }) {
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [amount, setAmount] = useState(String(reminder?.amount ?? ''));
  const [dueDay, setDueDay] = useState(String(reminder?.due_day ?? ''));
  const [kind, setKind] = useState(reminder?.kind || 'bill');
  const [cadence, setCadence] = useState(reminder?.cadence || 'monthly');
  const [termCount, setTermCount] = useState(String(reminder?.term_count ?? ''));
  const [startMonth, setStartMonth] = useState(tsToMonth(reminder?.start_at));
  if (!reminder) return null;

  const amtN = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
  const dayN = Math.min(31, Math.max(1, parseInt(String(dueDay).replace(/[^0-9]/g, ''), 10) || 0));
  const valid = label.trim() && amtN > 0 && dayN >= 1;

  const save = () => {
    if (!valid) return;
    const patch = { label: label.trim(), amount: amtN, dueDay: dayN, kind };
    if (kind === 'emi') {
      patch.termCount = parseInt(String(termCount).replace(/[^0-9]/g, ''), 10) || null;
      patch.startAt = startMonth ? monthToTs(startMonth) : reminder.start_at || reminder.created_at;
      patch.cadence = null;
    } else if (kind === 'subscription') {
      patch.cadence = cadence;
      patch.termCount = null;
      patch.startAt = null;
    } else {
      patch.cadence = null;
      patch.termCount = null;
      patch.startAt = null;
    }
    onSave(patch);
  };

  return (
    <Sheet
      onClose={onClose}
      header={<div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Edit bill</div>}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={save} style={{ flex: 2, background: valid ? colors.primary : colors.track, color: colors.onPrimary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: valid ? 'pointer' : 'default' }}>
            Save changes
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SegPicker options={KINDS} value={kind} onChange={setKind} />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" style={editInput} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Amount ₹" style={{ ...editInput, flex: 2 }} />
          <input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Day" style={{ ...editInput, flex: 1 }} />
        </div>
        <div style={{ fontSize: 12, color: colors.textTertiary }}>Day of the month it's due (1–31)</div>
        {kind === 'subscription' && (
          <SegPicker options={[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly' }]} value={cadence} onChange={setCadence} />
        )}
        {kind === 'emi' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={termCount} onChange={(e) => setTermCount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Total instalments" style={{ ...editInput, flex: 1 }} />
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ ...editInput, flex: 1, color: startMonth ? colors.ink : colors.textTertiary }} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

const editInput = {
  width: '100%',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 100,
  padding: '12px 16px',
  fontSize: 14.5,
  color: colors.ink,
};
