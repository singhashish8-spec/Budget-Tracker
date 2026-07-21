import { useEffect, useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { listSmsForTxn } from '../db/repo';

export default function CategorySheet() {
  const { state, closeCategorySheet, setTxnCategory, addCategory, setTransactionNote, ignoreSmsTransaction, deleteTransaction, splitMergedSms } = useApp();
  const [newCat, setNewCat] = useState('');
  const [note, setNote] = useState('');
  const [smsRows, setSmsRows] = useState([]);
  const open = !!state.sheetFor;
  const txn = open ? state.txns.find((t) => t.id === state.sheetFor.id) : null;

  // Load the note + every message behind this transaction whenever a different
  // one opens. More than one row means texts were merged as duplicates.
  useEffect(() => {
    if (!txn) return;
    setNote(txn.note || '');
    setSmsRows([]);
    if (txn.source === 'sms') {
      listSmsForTxn(txn.id).then(setSmsRows).catch(() => setSmsRows([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sheetFor?.id, state.smsLog]);

  if (!open || !txn) return null;

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

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={closeCategorySheet} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: '24px 24px 0 0', padding: '20px 16px 32px', maxHeight: '86%', overflowY: 'auto', animation: 'sheetup 0.22s ease-out' }}>
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 14px' }} />

        {/* Header: merchant + amount */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txn.merchant}</div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: income ? colors.primary : colors.ink, flexShrink: 0 }}>
            {income ? '+' : '−'}{fmt(txn.amount)}
          </div>
        </div>

        {/* Meta: bank + date/time */}
        <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: 4, marginBottom: 12 }}>
          {[bank, when || txn.date, isSms ? 'from SMS' : txn.source].filter(Boolean).join(' · ')}
        </div>

        {/* Original SMS. When more than one message sits behind this row they
            were merged as duplicates — show them all, and let a wrong merge be
            undone rather than leaving a real payment hidden inside another. */}
        {isSms && smsRows.length > 0 && (
          <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {smsRows.length > 1 && (
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.warningDark }}>
                {smsRows.length} messages merged as one payment
              </div>
            )}
            {smsRows.map((row, i) => (
              <div key={row.id} style={{ fontSize: 12, lineHeight: 1.5, color: colors.textSecondary, background: colors.cardSurface, border: `1px solid ${colors.divider}`, borderRadius: 12, padding: '10px 12px' }}>
                {row.raw_sms}
                {i > 0 && (
                  <button
                    onClick={() => splitMergedSms(row, txn)}
                    style={{ marginTop: 8, background: colors.bgApp, color: colors.primary, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Not a duplicate — make it its own
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

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
                onClick={() => {
                  saveNote();
                  setTxnCategory(c.id);
                }}
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
          <button onClick={submitNewCat} style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Add
          </button>
        </div>

        {/* Destructive actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {isSms && (
            <button
              onClick={() => ignoreSmsTransaction(txn.id)}
              style={{ flex: 1, background: colors.warningTint, color: colors.warningDark, border: `1px solid ${colors.warningBorder}`, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Ignore forever
            </button>
          )}
          <button
            onClick={() => deleteTransaction(txn.id)}
            style={{ flex: 1, background: colors.dangerTint, color: colors.dangerDark, border: `1px solid ${colors.dangerBorder}`, borderRadius: 100, padding: 12, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Delete
          </button>
        </div>
        {isSms && (
          <div style={{ fontSize: 11.5, color: colors.textTertiary, textAlign: 'center', marginTop: 8 }}>
            "Ignore forever" also stops similar messages from being added again
          </div>
        )}
      </div>
    </div>
  );
}
