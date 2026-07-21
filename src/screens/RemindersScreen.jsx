import { useState } from 'react';
import { colors } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { currentMonthKey, ordinal } from '../utils/date';
import { useApp } from '../state/AppContext';

export default function RemindersScreen() {
  const { state, goBack, addReminder, toggleReminderPaid, deleteReminder, editReminder } = useApp();
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const [dueDate, setDueDate] = useState('');
  const monthKey = currentMonthKey();

  const submit = () => {
    const amount = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    // Bills recur monthly, so we store the day-of-month from the picked date.
    const dueDay = dueDate ? new Date(dueDate).getDate() : 1;
    if (!label.trim() || !amount || !dueDate) return;
    addReminder({ label: label.trim(), amount, dueDay });
    setLabel('');
    setAmt('');
    setDueDate('');
  };

  const rows = [...state.reminders].sort((a, b) => a.due_day - b.due_day);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Bill reminders</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const paid = r.paid_for === monthKey;
          return (
            <div key={r.id} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, opacity: paid ? 0.55 : 1 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: colors.warningTint, color: colors.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {r.label.slice(0, 2).toUpperCase()}
              </div>
              <button onClick={() => setEditingId(r.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', background: 'transparent' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.label}</div>
                <div style={{ fontSize: 12.5, color: paid ? colors.successText : colors.warning, fontWeight: 500 }}>
                  {paid ? 'Paid this month' : `Due ${ordinal(r.due_day)}`}
                </div>
              </button>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{fmt(r.amount)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => toggleReminderPaid(r.id, monthKey)}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: '6px 13px',
                      borderRadius: 100,
                      cursor: 'pointer',
                      background: paid ? colors.successTint : colors.primary,
                      color: paid ? colors.primary : colors.bgApp,
                      border: `1px solid ${paid ? colors.successBorder : colors.primary}`,
                    }}
                  >
                    {paid ? 'Paid' : 'Mark paid'}
                  </button>
                  <button onClick={() => deleteReminder(r.id)} style={{ fontSize: 12.5, fontWeight: 600, padding: '6px 10px', borderRadius: 100, cursor: 'pointer', background: 'transparent', color: colors.textTertiary }}>
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
            reminder={rows.find((x) => x.id === editingId)}
            onSave={async (patch) => {
              await editReminder(editingId, patch);
              setEditingId(null);
            }}
            onClose={() => setEditingId(null)}
          />
        )}
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary }}>Add a bill</div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Electricity" style={inputStyle} />
        <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="₹ amount" style={inputStyle} />
        <label style={{ fontSize: 12.5, color: colors.textSecondary, paddingLeft: 4 }}>Due date (repeats monthly on this day)</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ ...inputStyle, color: dueDate ? colors.ink : colors.textTertiary }}
        />
        <button onClick={submit} style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add reminder
        </button>
      </div>

      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Mark a bill paid each month — it resets automatically next month</div>
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
    <svg width="9" height="15" viewBox="0 0 9 15">
      <path d="M8 1L2 7.5 8 14" stroke="#1B1F23" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Bills were write-once: a wrong amount or due date meant deleting and
// re-adding, which threw away the paid-this-month status with it.
function EditReminderSheet({ reminder, onSave, onClose }) {
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [amount, setAmount] = useState(String(reminder?.amount ?? ''));
  const [dueDay, setDueDay] = useState(String(reminder?.due_day ?? ''));
  if (!reminder) return null;

  const amtN = parseInt(String(amount).replace(/[^0-9]/g, ''), 10);
  const dayN = Math.min(31, Math.max(1, parseInt(String(dueDay).replace(/[^0-9]/g, ''), 10) || 0));
  const valid = label.trim() && amtN > 0 && dayN >= 1;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px 32px', animation: 'sheetup 0.22s ease-out', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 6px' }} />
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Edit bill</div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" style={editInput} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Amount ₹" style={{ ...editInput, flex: 2 }} />
          <input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Day" style={{ ...editInput, flex: 1 }} />
        </div>
        <div style={{ fontSize: 12, color: colors.textTertiary }}>Day of the month it's due (1–31)</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            onClick={() => valid && onSave({ label: label.trim(), amount: amtN, dueDay: dayN })}
            style={{ flex: 2, background: valid ? colors.primary : colors.track, color: colors.bgApp, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: valid ? 'pointer' : 'default' }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
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
