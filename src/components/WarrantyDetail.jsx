import { useMemo, useRef, useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { billRow } from '../state/selectors';
import { fmt } from '../utils/currency';
import { fileToStoredDocument, dataUrlBytes, formatBytes } from '../utils/image';
import DetentSheet from './DetentSheet';
import ConfirmDialog from './ConfirmDialog';
import DocumentViewer from './DocumentViewer';

const STATUS = {
  valid: { color: colors.successText, tint: colors.successTint, label: 'In warranty' },
  expiring: { color: colors.warning, tint: colors.warningTint, label: 'Expiring soon' },
  expired: { color: colors.danger, tint: colors.dangerTint, label: 'Expired' },
};

const CLAIM_STATUS = {
  open: { label: 'Open', color: colors.warning },
  in_progress: { label: 'In progress', color: colors.warning },
  resolved: { label: 'Resolved', color: colors.successText },
};

function dateLabel(ts) {
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Read-only dashboard for one product. Opening a card used to drop you straight
// into an edit form, which is backwards: you open it to check something far more
// often than to change it. Editing is one deliberate tap away.
export default function WarrantyDetail({ item, onEdit, onClose }) {
  const { state, addWarrantyDocument, removeWarrantyDocument, addWarrantyClaim, removeWarrantyClaim, deleteWarranty } = useApp();
  const [viewing, setViewing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, id, title, message }
  const [addingClaim, setAddingClaim] = useState(false);
  const [docErr, setDocErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const isStored = item.source === 'warranty';
  const docs = useMemo(
    () => (isStored ? (state.warrantyDocs || []).filter((d) => d.warranty_id === item.id) : []),
    [state.warrantyDocs, item.id, isStored],
  );
  const claims = useMemo(
    () => (isStored ? (state.warrantyClaims || []).filter((c) => c.warranty_id === item.id) : []),
    [state.warrantyClaims, item.id, isStored],
  );
  // The EMI or bill this product was bought on, with its live instalment maths.
  const linked = useMemo(() => {
    const r = item.raw?.reminder_id ? state.reminders.find((x) => x.id === item.raw.reminder_id) : null;
    return r ? { raw: r, ...billRow(r) } : null;
  }, [state.reminders, item.raw]);
  // Spending that looks like it belongs to this product.
  const related = useMemo(() => {
    const needle = (item.product || '').toLowerCase().trim();
    if (needle.length < 3) return [];
    return state.txns.filter((t) => (t.merchant || '').toLowerCase().includes(needle)).slice(0, 6);
  }, [state.txns, item.product]);

  const s = STATUS[item.status];
  const totalDays = Math.max(1, item.totalMonths * 30);
  const usedPct = Math.max(0, Math.min(100, Math.round(((totalDays - item.daysLeft) / totalDays) * 100)));
  const monthsLeft = Math.max(0, Math.round(item.daysLeft / 30));
  const docBytes = docs.reduce((a, d) => a + dataUrlBytes(d.data), 0);

  const pickDoc = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDocErr('');
    setBusy(true);
    try {
      const stored = await fileToStoredDocument(file);
      await addWarrantyDocument(item.id, stored);
    } catch (err) {
      setDocErr(err?.message || "Couldn't attach that file");
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{item.product}</div>
        <div style={{ fontSize: 12.5, color: colors.textTertiary, marginTop: 2 }}>
          {[item.brand, item.amount != null ? fmt(item.amount) : null, `Bought ${dateLabel(item.purchaseAt)}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <span style={{ background: s.tint, color: s.color, borderRadius: 100, padding: '5px 11px', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>{s.label}</span>
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
        Close
      </button>
      {isStored && (
        <button onClick={() => onEdit(item)} style={{ flex: 2, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', border: 'none' }}>
          Edit details
        </button>
      )}
    </div>
  );

  return (
    <>
      <DetentSheet onClose={onClose} header={header} footer={footer} motion={state.motionPref}>
        {/* Cover remaining — a warranty month isn't an event, so this reads as a
            depleting bar rather than the EMI's per-instalment segments. */}
        <Section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              {item.status === 'expired' ? 'Cover ended' : `${monthsLeft} month${monthsLeft === 1 ? '' : 's'} left`}
            </span>
            <span style={{ fontSize: 12, color: colors.textTertiary }}>of {item.totalMonths} months</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: colors.track, overflow: 'hidden' }}>
            <div style={{ width: `${usedPct}%`, height: '100%', background: s.color, borderRadius: 5, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6 }}>
            {item.status === 'expired' ? 'Expired' : 'Expires'} {item.expireLabel}
            {item.extendedMonths ? ` · includes ${item.extendedMonths} extended` : ''}
          </div>
        </Section>

        {(item.store || item.serial || item.note) && (
          <Section title="Details">
            {item.store && <Row k="Store / dealer" v={item.store} />}
            {item.serial && <Row k="Serial / invoice" v={item.serial} />}
            {item.note && <Row k="Note" v={item.note} />}
          </Section>
        )}

        {isStored && (
          <Section title={`Bills & documents${docs.length ? ` (${docs.length})` : ''}`}>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" onChange={pickDoc} style={{ display: 'none' }} />
            {docs.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                {docs.map((d) => {
                  const pdf = (d.mime || '').includes('pdf');
                  return (
                    <div key={d.id} style={{ position: 'relative' }}>
                      <button
                        onClick={() => setViewing(d)}
                        style={{ width: 74, height: 74, borderRadius: 12, overflow: 'hidden', border: `1px solid ${colors.cardBorder}`, background: colors.cardSurface, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {pdf ? <span style={{ fontSize: 26 }}>📄</span> : <img src={d.data} alt={d.name || 'bill'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </button>
                      <button
                        onClick={() => setConfirm({ kind: 'doc', id: d.id, title: 'Remove this document?', message: 'This is the only copy stored in the app. If you need it for a claim later, it will be gone.' })}
                        aria-label="Remove document"
                        style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%', background: colors.danger, color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} disabled={busy} style={ghost}>
              {busy ? 'Attaching…' : docs.length ? '+ Add another document' : '📎 Add bill or warranty document'}
            </button>
            <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 6 }}>
              Photos or PDFs. {docs.length > 0 ? `Using ${formatBytes(docBytes)} · included in your backup.` : 'Emailed PDF bills work too.'}
            </div>
            {docErr && <div style={{ fontSize: 12, color: colors.danger, marginTop: 6 }}>{docErr}</div>}
          </Section>
        )}

        {linked && (
          <Section title={linked.kind === 'emi' ? 'Bought on this EMI' : 'Linked bill'}>
            <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 14, padding: '12px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{linked.label}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{linked.amountF}</span>
              </div>
              {linked.hasProgress && (
                <>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 5 }}>
                    {Array.from({ length: Math.min(linked.total, 24) }).map((_, i) => {
                      const scale = linked.total / Math.min(linked.total, 24);
                      const done = i < Math.round(linked.paid / scale);
                      return <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: done ? colors.successText : colors.track }} />;
                    })}
                  </div>
                  <div style={{ fontSize: 11.5, color: colors.textTertiary }}>{linked.typeText}</div>
                </>
              )}
            </div>
          </Section>
        )}

        {isStored && (
          <Section title={`Claims & service${claims.length ? ` (${claims.length})` : ''}`}>
            {claims.map((c) => {
              const cs = CLAIM_STATUS[c.status] || CLAIM_STATUS.open;
              return (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${colors.divider}` }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{c.kind === 'service' ? '🔧' : '🛠️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.issue}</div>
                    <div style={{ fontSize: 11.5, color: colors.textTertiary }}>
                      {dateLabel(c.raised_at)} · <span style={{ color: cs.color, fontWeight: 600 }}>{cs.label}</span>
                      {c.cost != null ? ` · ${fmt(c.cost)}` : ''}
                    </div>
                  </div>
                  <button onClick={() => removeWarrantyClaim(c.id)} aria-label="Remove entry" style={{ background: 'transparent', border: 'none', color: colors.textTertiary, cursor: 'pointer', fontSize: 13 }}>✕</button>
                </div>
              );
            })}
            {claims.length === 0 && (
              <div style={{ fontSize: 12.5, color: colors.textTertiary, marginBottom: 8 }}>
                Nothing logged yet. Keep a record of repairs and service visits — it's what you'll need if you ever argue a claim.
              </div>
            )}
            <button onClick={() => setAddingClaim(true)} style={{ ...ghost, marginTop: 8 }}>+ Log a claim or service visit</button>
          </Section>
        )}

        {related.length > 0 && (
          <Section title="Related spending">
            {related.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 13 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</span>
                <span style={{ color: colors.textTertiary, flexShrink: 0, marginLeft: 10 }}>{t.date} · {fmt(t.amount)}</span>
              </div>
            ))}
          </Section>
        )}

        {isStored && (
          <button
            onClick={() => setConfirm({ kind: 'warranty', id: item.id, title: `Delete ${item.product}?`, message: 'The warranty, its documents and its claim history are all removed. This cannot be undone.' })}
            style={{ ...ghost, color: colors.danger, borderColor: colors.dangerBorder, marginTop: 4 }}
          >
            Delete this product
          </button>
        )}
        {!isStored && (
          <div style={{ fontSize: 12.5, color: colors.textTertiary, lineHeight: 1.5, padding: '4px 2px' }}>
            This came from a transaction tagged with a warranty. Add it as a full product to attach bills and track claims.
          </div>
        )}
      </DetentSheet>

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}

      {addingClaim && (
        <ClaimForm
          onCancel={() => setAddingClaim(false)}
          onSave={async (claim) => {
            await addWarrantyClaim(item.id, claim);
            setAddingClaim(false);
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.kind === 'doc' ? 'Remove' : 'Delete'}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            if (confirm.kind === 'doc') await removeWarrantyDocument(confirm.id);
            else { await deleteWarranty(confirm.id); onClose(); }
            setConfirm(null);
          }}
        />
      )}
    </>
  );
}

function ClaimForm({ onSave, onCancel }) {
  const [kind, setKind] = useState('claim');
  const [issue, setIssue] = useState('');
  const [status, setStatus] = useState('open');
  const [cost, setCost] = useState('');
  const valid = issue.trim().length > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.55)' }} />
      <div style={{ position: 'relative', background: colors.bgApp, borderRadius: 20, padding: 20, width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, boxShadow: '0 16px 44px rgba(0,0,0,0.28)' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Log a claim or service</div>
        <div style={{ display: 'flex', gap: 6, background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: 3 }}>
          {[{ k: 'claim', l: 'Warranty claim' }, { k: 'service', l: 'Service visit' }].map((o) => (
            <button key={o.k} onClick={() => setKind(o.k)} style={{ flex: 1, padding: '8px 6px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none', background: kind === o.k ? colors.primary : 'transparent', color: kind === o.k ? colors.onPrimary : colors.textSecondary }}>
              {o.l}
            </button>
          ))}
        </div>
        <input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="What happened? e.g. Compressor replaced" style={field} />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...field, flex: 1 }}>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
          <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="Cost ₹ (optional)" style={{ ...field, flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onCancel} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => valid && onSave({ kind, issue: issue.trim(), status, cost: cost || null, raisedAt: Date.now() })}
            style={{ flex: 2, background: valid ? colors.primary : colors.track, color: colors.onPrimary, borderRadius: 100, padding: 12, fontSize: 14.5, fontWeight: 600, cursor: valid ? 'pointer' : 'default', border: 'none' }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {title && <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 8 }}>{title}</div>}
      {children}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 13.5 }}>
      <span style={{ color: colors.textTertiary, flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{v}</span>
    </div>
  );
}

const ghost = {
  width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`,
  color: colors.textSecondary, borderRadius: 12, padding: '11px 14px',
  fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
};

const field = {
  width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12, padding: '11px 14px', fontSize: 14, color: colors.ink, boxSizing: 'border-box',
};
