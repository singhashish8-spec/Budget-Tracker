import { useEffect, useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { listSmsForTxn } from '../db/repo';
import Amount from './Amount';
import Sheet from './Sheet';
import Collapse from './Collapse';

const METHOD_LABELS = { cash: 'paid in cash', upi: 'paid by UPI', card: 'paid by card', bank: 'bank transfer' };

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'upi', label: 'UPI' },
  { key: 'card', label: 'Card' },
  { key: 'bank', label: 'Bank' },
];

function dateInputValue(ms) {
  const d = ms ? new Date(ms) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CategorySheet() {
  const { state, closeCategorySheet, setTxnCategory, addCategory, setTransactionNote, ignoreSmsTransaction, deleteTransaction, splitMergedSms, editTransaction } = useApp();
  const [newCat, setNewCat] = useState('');
  const [note, setNote] = useState('');
  const [smsRows, setSmsRows] = useState([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const open = !!state.sheetFor;
  const txn = open ? state.txns.find((t) => t.id === state.sheetFor.id) : null;

  // Load the note + every message behind this transaction whenever a different
  // one opens. More than one row means texts were merged as duplicates.
  useEffect(() => {
    if (!txn) return;
    setNote(txn.note || '');
    setSmsRows([]);
    setEditing(false);
    setDraft(null);
    if (txn.source === 'sms') {
      listSmsForTxn(txn.id).then(setSmsRows).catch(() => setSmsRows([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sheetFor?.id, state.smsLog]);

  if (!open || !txn) return null;

  const startEdit = () => {
    setDraft({
      merchant: txn.merchant || '',
      amount: String(txn.amount ?? ''),
      type: txn.type,
      method: txn.method || '',
      when: dateInputValue(txn.occurred_at || txn.sms_date || txn.created_at),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    const amount = Math.round(parseFloat(String(draft.amount).replace(/,/g, '')) || 0);
    if (amount <= 0) return;
    const picked = new Date(`${draft.when}T12:00:00`).getTime();
    const originalDay = dateInputValue(txn.occurred_at || txn.sms_date || txn.created_at);
    await editTransaction(txn.id, {
      merchant: draft.merchant.trim() || txn.merchant,
      amount,
      type: draft.type,
      method: draft.method || null,
      ...(draft.when !== originalDay ? { occurredAt: picked } : {}),
    });
    setEditing(false);
  };

  const isSms = txn.source === 'sms';
  const income = txn.type === 'income';
  const bank = txn.sms_address || null;
  const when = txn.sms_date ? new Date(txn.sms_date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : null;

  const submitNewCat = async () => {
    if (!newCat.trim()) return;
    await addCategory(newCat);
    setNewCat('');
  };

  const saveNote = () => {
    if ((note || '') !== (txn.note || '')) setTransactionNote(txn.id, note.trim());
  };

  // ── Frozen header: read-only context (merchant, amount, meta) + the exact
  // message(s) behind this row, right at the top and always visible. ──
  const header = (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.merchant}</div>
        <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: income ? colors.primary : colors.ink, flexShrink: 0 }}>
          {income ? '+' : '−'}{fmt(txn.amount)}
        </Amount>
      </div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 3 }}>
        {[bank, when || txn.date, isSms ? 'from SMS' : METHOD_LABELS[txn.method] || 'added by you'].filter(Boolean).join(' · ')}
      </div>
      {isSms && smsRows.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 104, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {smsRows.length > 1 && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: colors.warningDark }}>{smsRows.length} messages merged as one payment</div>
          )}
          {smsRows.map((row, i) => (
            <div key={row.id} style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary, background: colors.cardSurface, border: `1px solid ${colors.divider}`, borderRadius: 12, padding: '9px 11px' }}>
              {row.raw_sms}
              {i > 0 && (
                <button
                  onClick={() => splitMergedSms(row, txn)}
                  style={{ marginTop: 8, background: colors.bgApp, color: colors.primary, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '6px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Not a duplicate — make it its own
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Footer: persistent actions in the thumb-zone. ──
  const footer = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => (editing ? setEditing(false) : startEdit())}
        style={{ flex: 1, background: editing ? colors.primary : colors.cardSurface, color: editing ? colors.onPrimary : colors.ink, border: `1px solid ${editing ? 'transparent' : colors.cardBorder}`, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
      >
        {editing ? 'Close edit' : 'Edit'}
      </button>
      {isSms && (
        <button
          onClick={() => ignoreSmsTransaction(txn.id)}
          style={{ flex: 1, background: colors.warningTint, color: colors.warningDark, border: `1px solid ${colors.warningBorder}`, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
        >
          Ignore
        </button>
      )}
      <button
        onClick={() => deleteTransaction(txn.id)}
        style={{ flex: 1, background: colors.dangerTint, color: colors.dangerDark, border: `1px solid ${colors.dangerBorder}`, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
      >
        Delete
      </button>
    </div>
  );

  return (
    <Sheet onClose={closeCategorySheet} header={header} footer={footer}>
      {/* Edit form — collapses in above the picker when you tap Edit. */}
      <Collapse open={editing}>
        {draft && (
          <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: 14, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[{ key: 'expense', label: 'Spent' }, { key: 'income', label: 'Received' }].map((o) => (
                <button
                  key={o.key}
                  onClick={() => setDraft({ ...draft, type: o.key })}
                  style={{ flex: 1, padding: '9px 4px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: draft.type === o.key ? colors.primary : colors.bgApp, color: draft.type === o.key ? colors.onPrimary : colors.textSecondary, border: `1px solid ${draft.type === o.key ? 'transparent' : colors.cardBorder}` }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '10px 14px' }}>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>₹</span>
              <input
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d.]/g, '') })}
                inputMode="decimal"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: colors.ink, minWidth: 0 }}
              />
            </div>
            <input
              value={draft.merchant}
              onChange={(e) => setDraft({ ...draft, merchant: e.target.value })}
              placeholder="Name"
              style={{ width: '100%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '10px 14px', fontSize: 14, color: colors.ink }}
            />
            <input
              type="date"
              value={draft.when}
              onChange={(e) => setDraft({ ...draft, when: e.target.value })}
              style={{ width: '100%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '10px 14px', fontSize: 14, color: colors.ink }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setDraft({ ...draft, method: draft.method === m.key ? '' : m.key })}
                  style={{ flex: 1, padding: '8px 2px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: draft.method === m.key ? colors.primary : colors.onPrimary, color: draft.method === m.key ? colors.onPrimary : colors.textSecondary, border: `1px solid ${draft.method === m.key ? 'transparent' : colors.cardBorder}` }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button onClick={saveEdit} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Save changes
            </button>
          </div>
        )}
      </Collapse>

      {/* Note */}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder="Add a note (what was this for?)"
        style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink, marginBottom: 14 }}
      />

      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 8 }}>Category</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {state.categories
          .filter((c) => c.id !== 'income' && !state.disabledCats.includes(c.id))
          .map((c) => (
            <button
              key={c.id}
              onClick={() => { saveNote(); setTxnCategory(c.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: colors.cardSurface, border: `1px solid ${txn.cat === c.id ? colors.primary : colors.cardBorder}`, borderRadius: 14, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {c.mono}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.label}</div>
            </button>
          ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          placeholder="Add your own category"
          style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '11px 16px', fontSize: 14, color: colors.ink }}
        />
        <button onClick={submitNewCat} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add
        </button>
      </div>

      {isSms && (
        <div style={{ fontSize: 11.5, color: colors.textTertiary, textAlign: 'center', marginTop: 12 }}>
          "Ignore" also stops similar messages from being added again
        </div>
      )}
    </Sheet>
  );
}
