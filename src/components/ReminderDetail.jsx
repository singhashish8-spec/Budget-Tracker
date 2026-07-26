import { useMemo, useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { billRow, warrantyStatus } from '../state/selectors';
import { fmt } from '../utils/currency';
import { currentMonthKey, ordinal } from '../utils/date';
import DetentSheet from './DetentSheet';
import ConfirmDialog from './ConfirmDialog';

const KIND_LABEL = { emi: 'Loan / EMI', subscription: 'Subscription', bill: 'Bill' };

// Read-only dashboard for one bill, EMI or subscription. Same principle as the
// warranty one: opening a card shows you where things stand; editing is a
// deliberate second tap.
export default function ReminderDetail({ reminder, onEdit, onClose }) {
  const { state, toggleReminderPaid, deleteReminder } = useApp();
  const [confirm, setConfirm] = useState(false);
  const monthKey = currentMonthKey();

  const b = useMemo(() => billRow(reminder), [reminder]);
  const paid = reminder.paid_for === monthKey;
  const kind = reminder.kind || 'bill';

  // A product bought on this EMI, if one was attached.
  const warranty = useMemo(() => {
    const w = (state.warranties || []).find((x) => x.reminder_id === reminder.id);
    return w ? { raw: w, ...warrantyStatus(w.purchase_at, w.warranty_months, w.extended_months) } : null;
  }, [state.warranties, reminder.id]);

  // Payments that look like this bill, newest first.
  const related = useMemo(() => {
    const needle = (reminder.label || '').toLowerCase().trim();
    if (needle.length < 3) return [];
    return state.txns.filter((t) => (t.merchant || '').toLowerCase().includes(needle)).slice(0, 8);
  }, [state.txns, reminder.label]);

  // Whether this subscription's price has moved — the honest version of "bill
  // negotiation": we can't haggle for you, but we can show a silent increase.
  const priceHistory = useMemo(() => {
    const amounts = related.map((t) => t.amount).filter((n) => n > 0);
    if (amounts.length < 2) return null;
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    return max > min ? { min, max, rise: max - min } : null;
  }, [related]);

  const totalPaid = b.hasProgress ? b.paid * reminder.amount : null;
  const remainingValue = b.hasProgress ? b.remaining * reminder.amount : null;

  const header = (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>{reminder.label}</div>
        <div style={{ fontSize: 12.5, color: colors.textTertiary, marginTop: 2 }}>
          {KIND_LABEL[kind]} · Due {ordinal(b.dueDay)} each month
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{b.amountF}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: paid ? colors.successText : colors.warning }}>{paid ? 'Paid' : 'Due'}</span>
      </div>
    </div>
  );

  const footer = (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={() => toggleReminderPaid(reminder.id, monthKey)}
        style={{ flex: 1, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', background: paid ? colors.successTint : colors.primary, color: paid ? colors.primary : colors.onPrimary, border: `1px solid ${paid ? colors.successBorder : colors.primary}` }}
      >
        {paid ? 'Paid ✓' : 'Mark paid'}
      </button>
      <button onClick={() => onEdit(reminder)} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>
        Edit
      </button>
    </div>
  );

  return (
    <>
      <DetentSheet onClose={onClose} header={header} footer={footer} motion={state.motionPref}>
        {b.hasProgress && (
          <Section title={kind === 'emi' ? 'Instalments' : 'Progress'}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
              {Array.from({ length: Math.min(b.total, 24) }).map((_, i) => {
                const scale = b.total / Math.min(b.total, 24);
                const doneUpto = Math.round(b.paid / scale);
                const done = i < doneUpto;
                const current = i === doneUpto && b.paid < b.total;
                return <div key={i} style={{ flex: 1, height: 9, borderRadius: 3, background: done ? colors.successText : current ? colors.warning : colors.track }} />;
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: colors.textTertiary }}>
              <span>{b.pct}% complete</span>
              <span>{b.paid}/{b.total}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <Row k={kind === 'emi' ? 'Paid so far' : 'Spent so far'} v={fmt(totalPaid)} />
              <Row k="Still to pay" v={fmt(remainingValue)} />
              <Row k={kind === 'emi' ? 'Payoff' : 'Ends'} v={b.payoffLabel} />
            </div>
          </Section>
        )}

        {kind === 'subscription' && (
          <Section title="Cost">
            <Row k="Billed" v={b.yearly ? 'Yearly' : 'Monthly'} />
            <Row k="Per year" v={b.annualF} />
            {priceHistory && (
              <div style={{ background: colors.warningTint, border: `1px solid ${colors.warningBorder}`, borderRadius: 12, padding: '10px 12px', marginTop: 10 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.warningDark, marginBottom: 2 }}>Price has changed</div>
                <div style={{ fontSize: 12, color: colors.warningDark, lineHeight: 1.45 }}>
                  Charges range from {fmt(priceHistory.min)} to {fmt(priceHistory.max)} — up {fmt(priceHistory.rise)}. Worth checking whether the plan quietly went up.
                </div>
              </div>
            )}
          </Section>
        )}

        {kind === 'bill' && !b.hasProgress && (
          <Section title="Cost">
            <Row k="Every month" v={b.amountF} />
            <Row k="Per year" v={fmt(reminder.amount * 12)} />
          </Section>
        )}

        {warranty && (
          <Section title="Product warranty">
            <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 14, padding: '12px 13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{warranty.raw.product}</span>
                <span style={{ fontSize: 12, fontWeight: 700, flexShrink: 0, color: warranty.status === 'expired' ? colors.danger : warranty.status === 'expiring' ? colors.warning : colors.successText }}>
                  {warranty.status === 'expired' ? 'Expired' : `${Math.max(0, Math.round(warranty.daysLeft / 30))} months left`}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 3 }}>
                {warranty.status === 'expired' ? 'Expired' : 'Expires'} {warranty.expireLabel} · open Warranties for bills & claims
              </div>
            </div>
          </Section>
        )}

        {related.length > 0 && (
          <Section title="Related payments">
            {related.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${colors.divider}`, fontSize: 13 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.merchant}</span>
                <span style={{ color: colors.textTertiary, flexShrink: 0, marginLeft: 10 }}>{t.date} · {fmt(t.amount)}</span>
              </div>
            ))}
          </Section>
        )}

        <button
          onClick={() => setConfirm(true)}
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.dangerBorder}`, color: colors.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}
        >
          Delete this {KIND_LABEL[kind].toLowerCase()}
        </button>
      </DetentSheet>

      {confirm && (
        <ConfirmDialog
          title={`Delete ${reminder.label}?`}
          message={warranty ? 'Its payment reminder is removed. The linked product warranty stays in your Warranties list.' : 'This reminder and its paid history are removed. This cannot be undone.'}
          onCancel={() => setConfirm(false)}
          onConfirm={async () => { await deleteReminder(reminder.id); setConfirm(false); onClose(); }}
        />
      )}
    </>
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
      <span style={{ color: colors.textTertiary }}>{k}</span>
      <span style={{ fontWeight: 500 }}>{v}</span>
    </div>
  );
}
