import { useMemo, useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { warrantyList } from '../state/selectors';
import { fmt } from '../utils/currency';
import Amount from '../components/Amount';
import Sheet from '../components/Sheet';
import WarrantyDetail from '../components/WarrantyDetail';
import * as haptics from '../services/haptics';
import { Icon } from '../components/ui';

const STATUS = {
  valid: { color: colors.successText, tint: colors.successTint, label: 'In warranty' },
  expiring: { color: colors.warning, tint: colors.warningTint, label: 'Expiring soon' },
  expired: { color: colors.danger, tint: colors.dangerTint, label: 'Expired' },
};

// A day timestamp (ms) → the value a native <input type="date"> expects.
function tsToDateInput(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateInputToTs(v) {
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}
function daysLabel(daysLeft) {
  if (daysLeft < 0) return `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} ago`;
  if (daysLeft === 0) return 'today';
  if (daysLeft < 45) return `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
  const months = Math.round(daysLeft / 30);
  return `in ${months} month${months === 1 ? '' : 's'}`;
}

export default function WarrantyScreen() {
  const { state, goBack, addWarranty, editWarranty, deleteWarranty, addWarrantyDocument, clearPendingShare, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const items = useMemo(() => warrantyList(state.warranties, state.txns), [state.warranties, state.txns]);
  const counts = useMemo(() => ({
    valid: items.filter((i) => i.status === 'valid').length,
    expiring: items.filter((i) => i.status === 'expiring').length,
    expired: items.filter((i) => i.status === 'expired').length,
  }), [items]);

  // First image attached to each product, used as the card thumbnail. PDFs have
  // no preview, so a product whose only document is a PDF keeps the icon.
  const thumbs = useMemo(() => {
    const map = {};
    for (const d of state.warrantyDocs || []) {
      if (!map[d.warranty_id] && !(d.mime || '').includes('pdf')) map[d.warranty_id] = d.data;
    }
    return map;
  }, [state.warrantyDocs]);

  const editing = editingId ? items.find((i) => i.id === editingId && i.source === 'warranty') : null;
  const viewing = viewingId ? items.find((i) => i.id === viewingId) : null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}><BackIcon /></button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Warranties</div>
      </div>

      {state.pendingShare?.length > 0 && (
        <div style={{ background: colors.primaryTint, border: `1px solid ${colors.primary}`, borderRadius: 12, padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: colors.primary }}>
            {state.pendingShare.length} file{state.pendingShare.length === 1 ? '' : 's'} shared in
          </div>
          <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.45 }}>
            Pick the product {state.pendingShare.length === 1 ? 'it belongs' : 'they belong'} to, and {state.pendingShare.length === 1 ? "it'll" : "they'll"} be attached as documents.
          </div>
          <button onClick={() => { haptics.tap(); clearPendingShare(); }} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: colors.textTertiary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: '2px 0' }}>
            Discard
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          <StatChip n={counts.valid} label="In warranty" c={colors.successText} bg={colors.successTint} />
          <StatChip n={counts.expiring} label="Expiring" c={colors.warning} bg={colors.warningTint} />
          <StatChip n={counts.expired} label="Expired" c={colors.danger} bg={colors.dangerTint} />
        </div>
      )}

      <button onClick={() => { haptics.tap(); setAdding(true); }} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 13, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
        + Add a product
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((w) => {
          const s = STATUS[w.status];
          const purchase = new Date(w.purchaseAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          return (
            <button
              key={`${w.source}-${w.id}`}
              onClick={async () => {
                const share = state.pendingShare || [];
                if (share.length && w.source === 'warranty') {
                  haptics.success();
                  for (const f of share) await addWarrantyDocument(w.id, f);
                  clearPendingShare();
                  showToast(`Attached to ${w.product}`);
                  setViewingId(w.id);
                  return;
                }
                haptics.select();
                setViewingId(w.id);
              }}
              style={{ textAlign: 'left', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: '100%' }}>
              {(thumbs[w.id] || w.photo) ? (
                <img src={thumbs[w.id] || w.photo} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `1px solid ${colors.cardBorder}` }} />
              ) : (
                <div style={{ width: 46, height: 46, borderRadius: 12, background: s.tint, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}><Icon name="receipt" size={22} /></div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.product}</span>
                  {w.source === 'txn' && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5, padding: '2px 6px', borderRadius: 6, background: colors.divider, color: colors.textSecondary, flexShrink: 0 }}>TXN</span>}
                </div>
                <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                  {[w.brand, `Bought ${purchase}`].filter(Boolean).join(' · ')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: s.color }}>
                    {w.status === 'expired' ? `Expired ${daysLabel(w.daysLeft)}` : `Expires ${daysLabel(w.daysLeft)}`}
                  </span>
                  <span style={{ fontSize: 11.5, color: colors.textTertiary }}>· {w.expireLabel}</span>
                </div>
              </div>
              {w.amount != null && <Amount style={{ fontSize: 13.5, fontWeight: 600, flexShrink: 0 }}>{fmt(w.amount)}</Amount>}
              </div>
              <CoverBar item={w} color={s.color} />
            </button>
          );
        })}
        {items.length === 0 && (
          <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '20px 12px', lineHeight: 1.5 }}>
            No warranties yet.<br />Add your fridge, phone, TV or any big purchase and never lose a claim window again.
          </div>
        )}
      </div>

      {viewing && (
        <WarrantyDetail
          item={viewing}
          onClose={() => setViewingId(null)}
          onEdit={(it) => { setViewingId(null); setEditingId(it.id); }}
        />
      )}

      {(adding || editing) && (
        <WarrantySheet
          existing={editing}
          reminders={state.reminders}
          onClose={() => { setAdding(false); setEditingId(null); }}
          onSave={async (payload) => {
            if (editing) {
              await editWarranty(editing.id, payload);
            } else {
              const newId = await addWarranty(payload);
              if (newId) setViewingId(newId);
            }
            setAdding(false); setEditingId(null);
          }}
          onDelete={editing ? async () => { await deleteWarranty(editing.id); setEditingId(null); } : null}
        />
      )}
    </div>
  );
}

// How much of the cover is used up. A warranty month isn't an event the way an
// EMI instalment is, so this is a single depleting bar rather than segments.
function CoverBar({ item, color }) {
  const totalDays = Math.max(1, item.totalMonths * 30);
  const usedPct = Math.max(0, Math.min(100, Math.round(((totalDays - item.daysLeft) / totalDays) * 100)));
  return (
    <div style={{ width: '100%' }}>
      <div style={{ height: 6, borderRadius: 3, background: colors.track, overflow: 'hidden' }}>
        <div style={{ width: `${usedPct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

function StatChip({ n, label, c, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: c, fontFamily: "'Space Grotesk', sans-serif" }}>{n}</div>
      <div style={{ fontSize: 11, color: c, fontWeight: 600, opacity: 0.9 }}>{label}</div>
    </div>
  );
}

function WarrantySheet({ existing, reminders, onSave, onClose, onDelete }) {
  const w = existing?.raw;
  const [product, setProduct] = useState(w?.product ?? '');
  const [brand, setBrand] = useState(w?.brand ?? '');
  const [amount, setAmount] = useState(w?.amount != null ? String(w.amount) : '');
  const [purchase, setPurchase] = useState(tsToDateInput(w?.purchase_at ?? Date.now()));
  const [months, setMonths] = useState(w?.warranty_months != null ? String(w.warranty_months) : '');
  const [extended, setExtended] = useState(w?.extended_months != null ? String(w.extended_months) : '');
  const [store, setStore] = useState(w?.store ?? '');
  const [serial, setSerial] = useState(w?.serial ?? '');
  const [note, setNote] = useState(w?.note ?? '');
  const [reminderId, setReminderId] = useState(w?.reminder_id ?? '');

  const [showMore, setShowMore] = useState(Boolean(w?.store || w?.serial || w?.note || w?.extended_months || w?.reminder_id));
  const monthsN = parseInt(String(months).replace(/[^0-9]/g, ''), 10) || 0;
  const valid = product.trim() && purchase && monthsN > 0;


  const save = () => {
    if (!valid) return;
    onSave({
      product: product.trim(),
      brand: brand.trim() || null,
      amount: amount.trim() ? parseInt(amount.replace(/[^0-9]/g, ''), 10) : null,
      purchaseAt: dateInputToTs(purchase) ?? Date.now(),
      warrantyMonths: monthsN,
      extendedMonths: extended.trim() ? parseInt(extended.replace(/[^0-9]/g, ''), 10) : null,
      store: store.trim() || null,
      serial: serial.trim() || null,
      note: note.trim() || null,
      reminderId: reminderId || null,
    });
  };

  return (
    <Sheet
      onClose={onClose}
      header={<div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{existing ? 'Edit warranty' : 'Add a product'}</div>}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {onDelete && (
            <button onClick={onDelete} style={{ background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.danger, borderRadius: 100, padding: '13px 16px', fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
              Delete
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => { haptics.success(); save(); }} style={{ flex: 2, background: valid ? colors.primary : colors.track, color: colors.onPrimary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: valid ? 'pointer' : 'default' }}>
            {existing ? 'Save' : 'Add'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Product — e.g. LG Refrigerator" style={inp} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" style={{ ...inp, flex: 1 }} />
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Price ₹" style={{ ...inp, flex: 1 }} />
        </div>

        <label style={lbl}>Purchase date</label>
        <input type="date" value={purchase} onChange={(e) => setPurchase(e.target.value)} style={{ ...inp, color: purchase ? colors.ink : colors.textTertiary }} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={lbl}>Warranty (months)</label>
            <input value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="e.g. 24" style={{ ...inp, width: '100%' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[6, 12, 24, 36].map((n) => (
                <button key={n} onClick={() => setMonths(String(n))} style={{ flex: 1, padding: '6px 0', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: months === String(n) ? colors.primary : colors.cardSurface, color: months === String(n) ? colors.onPrimary : colors.textSecondary, border: `1px solid ${months === String(n) ? colors.primary : colors.cardBorder}` }}>{n}m</button>
              ))}
            </div>
          </div>
          {showMore && <div style={{ flex: 1 }}>
            <label style={lbl}>Extended (optional)</label>
            <input value={extended} onChange={(e) => setExtended(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="extra months" style={{ ...inp, width: '100%' }} />
          </div>}
        </div>

        {!showMore && (
          <button onClick={() => setShowMore(true)} style={{ ...inp, textAlign: 'left', cursor: 'pointer', color: colors.textSecondary, background: 'transparent' }}>
            Add more details (dealer, serial no., link to an EMI) ⌄
          </button>
        )}

        {showMore && <input value={store} onChange={(e) => setStore(e.target.value)} placeholder="Store / dealer (optional)" style={inp} />}
        {showMore && <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="Serial / invoice no. (optional)" style={inp} />}

        {showMore && reminders.length > 0 && (
          <>
            <label style={lbl}>Bought on an EMI / linked to a bill?</label>
            <select value={reminderId} onChange={(e) => setReminderId(e.target.value)} style={{ ...inp, color: reminderId ? colors.ink : colors.textTertiary }}>
              <option value="">Not linked</option>
              {reminders.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </>
        )}

        {showMore && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" style={inp} />}
      </div>
    </Sheet>
  );
}

const inp = {
  width: '100%',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12,
  padding: '12px 16px',
  fontSize: 14.5,
  color: colors.ink,
  boxSizing: 'border-box',
};
const lbl = { fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary };

const backBtnStyle = {
  width: 36, height: 36, borderRadius: '50%', background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
};

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" style={{ color: 'var(--c-ink)' }}>
      <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
