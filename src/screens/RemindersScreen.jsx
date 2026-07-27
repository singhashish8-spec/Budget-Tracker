import { useState } from 'react';
import { colors } from '../theme/tokens';
import { currentMonthKey, ordinal } from '../utils/date';
import { useApp } from '../state/AppContext';
import { billRow } from '../state/selectors';
import Amount from '../components/Amount';
import Sheet from '../components/Sheet';
import ReminderDetail from '../components/ReminderDetail';
import * as haptics from '../services/haptics';

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
  const { state, go, goBack, addReminder, toggleReminderPaid, deleteReminder, editReminder, addWarranty, editWarranty, deleteWarranty } = useApp();
  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [kind, setKind] = useState('bill');
  const [cadence, setCadence] = useState('monthly');
  const [termCount, setTermCount] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [warrantyMonths, setWarrantyMonths] = useState('');
  const monthKey = currentMonthKey();

  const reset = () => {
    setLabel(''); setAmt(''); setDueDate(''); setKind('bill'); setCadence('monthly'); setTermCount(''); setStartMonth(''); setWarrantyMonths('');
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
    } else if (kind === 'bill') {
      // A duration turns a plain recurring bill into a fixed-run one (e.g. a
      // 6-month membership) that shows a progress bar and an end date. Optional.
      const term = parseInt(String(termCount).replace(/[^0-9]/g, ''), 10);
      if (term > 0) {
        payload.termCount = term;
        payload.startAt = startMonth ? monthToTs(startMonth) : new Date(new Date(dueDate).getFullYear(), new Date(dueDate).getMonth(), 1).getTime();
      }
    }
    // A financed purchase (fridge, phone) usually carries a warranty, so it can
    // be entered right here — it lands in the Warranties panel linked to this
    // bill/EMI rather than having to be typed in twice.
    const wMonths = parseInt(String(warrantyMonths).replace(/[^0-9]/g, ''), 10) || 0;
    (async () => {
      const reminderId = await addReminder(payload);
      if (wMonths > 0 && reminderId) {
        await addWarranty({
          product: payload.label,
          amount: null,
          purchaseAt: payload.startAt || new Date(dueDate).getTime(),
          warrantyMonths: wMonths,
          reminderId,
        });
      }
    })();
    reset();
  };

  const rows = [...state.reminders].sort((a, b) => a.due_day - b.due_day).map((r) => ({ raw: r, ...billRow(r) }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Bills &amp; EMIs</div>
        <button onClick={() => go('warranty')} style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 600, color: colors.primary, background: colors.primaryTint, border: `1px solid ${colors.primary}`, borderRadius: 100, padding: '7px 13px', cursor: 'pointer' }}>
          Warranties
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((b) => {
          const paid = b.raw.paid_for === monthKey;
          return (
            <div key={b.id} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12, opacity: paid ? 0.55 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: colors.warningTint, color: colors.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {b.label.slice(0, 2).toUpperCase()}
                </div>
                <button onClick={() => setViewingId(b.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', background: 'transparent' }}>
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
                      onClick={() => { haptics.success(); toggleReminderPaid(b.id, monthKey); }}
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
              {b.hasProgress && <EmiProgress paid={b.paid} total={b.total} pct={b.pct} />}
            </div>
          );
        })}
        {rows.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '12px 0' }}>No bills added yet</div>}
        {viewingId && (
          <ReminderDetail
            reminder={state.reminders.find((x) => x.id === viewingId)}
            onClose={() => setViewingId(null)}
            onEdit={(r) => { setViewingId(null); setEditingId(r.id); }}
          />
        )}
        {editingId && (
          <EditReminderSheet
            reminder={state.reminders.find((x) => x.id === editingId)}
            warranty={state.warranties.find((w) => w.reminder_id === editingId)}
            onSave={async (patch, wMonths) => {
              const reminder = state.reminders.find((x) => x.id === editingId);
              const existing = state.warranties.find((w) => w.reminder_id === editingId);
              await editReminder(editingId, patch);
              // Warranty follows the bill it belongs to: added, updated, or
              // cleared out when the months field is emptied.
              if (wMonths > 0 && existing) {
                await editWarranty(existing.id, { warrantyMonths: wMonths, product: patch.label });
              } else if (wMonths > 0) {
                await addWarranty({
                  product: patch.label,
                  purchaseAt: patch.startAt || reminder?.start_at || reminder?.created_at || Date.now(),
                  warrantyMonths: wMonths,
                  reminderId: editingId,
                });
              } else if (existing) {
                await deleteWarranty(existing.id);
              }
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
        {kind === 'bill' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={termCount} onChange={(e) => setTermCount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Duration in months (optional)" style={{ ...inputStyle, flex: 1 }} />
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ ...inputStyle, flex: 1, color: startMonth ? colors.ink : colors.textTertiary }} />
          </div>
        )}
        {kind === 'bill' && <div style={{ fontSize: 11.5, color: colors.textTertiary, paddingLeft: 4 }}>Add a duration for a fixed-run bill (like a 6-month membership) to see a progress bar. Leave blank for an open-ended monthly bill.</div>}

        {kind !== 'subscription' && (
          <>
            <input value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Product warranty in months (optional)" style={inputStyle} />
            <div style={{ fontSize: 11.5, color: colors.textTertiary, paddingLeft: 4 }}>Bought a fridge, phone or TV on this? Add the warranty and it shows up in Warranties, linked to this {kind === 'emi' ? 'EMI' : 'bill'}.</div>
          </>
        )}

        <label style={{ fontSize: 12.5, color: colors.textSecondary, paddingLeft: 4 }}>Due date {kind === 'subscription' && cadence === 'yearly' ? '(renews yearly)' : '(repeats monthly on this day)'}</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, color: dueDate ? colors.ink : colors.textTertiary }} />
        <button onClick={() => { haptics.success(); submit(); }} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
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
            onClick={() => { haptics.select(); onChange(o.key); }}
            style={{ flex: 1, padding: '8px 6px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: on ? colors.primary : 'transparent', color: on ? colors.onPrimary : colors.textSecondary, border: 'none' }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// A progress bar that "breaks into the number of instalments" — one segment per
// month for short terms (paid = green, the one currently due = amber, the rest
// grey). Long loans (a 60-month home loan) would be an unreadable row of slivers,
// so above 24 instalments it becomes a single continuous fill instead.
function EmiProgress({ paid, total, pct }) {
  const useSegments = total > 0 && total <= 24;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {useSegments ? (
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: total }).map((_, i) => {
            const done = i < paid;
            const current = i === paid && paid < total;
            const bg = done ? colors.successText : current ? colors.warning : colors.track;
            return <div key={i} style={{ flex: 1, height: 8, borderRadius: 3, background: bg, transition: 'background 0.2s' }} />;
          })}
        </div>
      ) : (
        <div style={{ height: 8, borderRadius: 4, background: colors.track, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: colors.successText, transition: 'width 0.3s' }} />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.textTertiary, fontWeight: 500 }}>
        <span>{pct}% complete</span>
        <span>{paid}/{total}</span>
      </div>
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
function EditReminderSheet({ reminder, warranty, onSave, onClose }) {
  const [label, setLabel] = useState(reminder?.label ?? '');
  const [amount, setAmount] = useState(String(reminder?.amount ?? ''));
  const [dueDay, setDueDay] = useState(String(reminder?.due_day ?? ''));
  const [kind, setKind] = useState(reminder?.kind || 'bill');
  const [cadence, setCadence] = useState(reminder?.cadence || 'monthly');
  const [termCount, setTermCount] = useState(String(reminder?.term_count ?? ''));
  const [startMonth, setStartMonth] = useState(tsToMonth(reminder?.start_at));
  const [warrantyMonths, setWarrantyMonths] = useState(warranty?.warranty_months ? String(warranty.warranty_months) : '');
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
      // Plain bill: an optional duration makes it a fixed-run bill with progress.
      patch.cadence = null;
      const term = parseInt(String(termCount).replace(/[^0-9]/g, ''), 10);
      patch.termCount = term > 0 ? term : null;
      patch.startAt = term > 0 ? (startMonth ? monthToTs(startMonth) : reminder.start_at || reminder.created_at) : null;
    }
    const wMonths = kind === 'subscription' ? 0 : parseInt(String(warrantyMonths).replace(/[^0-9]/g, ''), 10) || 0;
    onSave(patch, wMonths);
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
        {kind === 'bill' && (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={termCount} onChange={(e) => setTermCount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Duration in months (optional)" style={{ ...editInput, flex: 1 }} />
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} style={{ ...editInput, flex: 1, color: startMonth ? colors.ink : colors.textTertiary }} />
            </div>
            <div style={{ fontSize: 12, color: colors.textTertiary }}>Leave duration blank for an open-ended monthly bill.</div>
          </>
        )}
        {kind !== 'subscription' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary, marginTop: 4 }}>Product warranty</div>
            <input value={warrantyMonths} onChange={(e) => setWarrantyMonths(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Warranty in months (optional)" style={editInput} />
            <div style={{ fontSize: 12, color: colors.textTertiary }}>
              {warranty ? 'Clear this to remove the warranty from the Warranties panel. Add photos and dealer details there.' : 'Adds this product to the Warranties panel, linked to this bill.'}
            </div>
          </>
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
