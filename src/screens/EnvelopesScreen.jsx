import { useMemo, useState } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { envelopeRows, toBeAssigned, periodKeyOf } from '../state/selectors';
import { fmt } from '../utils/currency';
import Amount from '../components/Amount';
import Sheet from '../components/Sheet';
import * as haptics from '../services/haptics';

// Zero-based budgeting: "give every rupee a job".
//
// The difference from the ordinary budgets screen is where the money comes
// from. A budget is a limit you hope not to cross; an envelope is money you
// actually have, handed out on purpose. Two consequences follow, and they're
// the whole reason this mode exists:
//   • what you don't spend ROLLS OVER instead of resetting each month, so
//     saving up inside a category works;
//   • overspending goes negative and follows you into next month, so it has to
//     be covered from somewhere rather than quietly forgotten.
export default function EnvelopesScreen() {
  const { state, goBack, assignToEnvelope, clearEnvelope } = useApp();
  const [periodKey, setPeriodKey] = useState(periodKeyOf());
  const [editing, setEditing] = useState(null); // category row being assigned

  const rows = useMemo(
    () => envelopeRows(state.txns, state.categories, state.envelopes, periodKey),
    [state.txns, state.categories, state.envelopes, periodKey],
  );
  const pool = useMemo(
    () => toBeAssigned(state.txns, state.categories, state.envelopes, periodKey),
    [state.txns, state.categories, state.envelopes, periodKey],
  );

  // Categories with nothing assigned yet, offered as "add an envelope".
  const unused = state.categories.filter(
    (c) => c.id !== 'income' && !state.disabledCats.includes(c.id) && !rows.some((r) => r.catId === c.id),
  );

  const [y, m] = periodKey.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const shiftMonth = (delta) => setPeriodKey(periodKeyOf(new Date(y, m - 1 + delta, 1)));

  const overspent = rows.filter((r) => r.overspent);
  const poolColor = pool.unassigned === 0 ? colors.successText : pool.unassigned > 0 ? colors.primary : colors.danger;

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}><BackIcon /></button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Envelopes</div>
      </div>

      {/* Month stepper — envelopes are per month, and last month's leftovers
          are what make this month's numbers make sense. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '6px 8px' }}>
        <button onClick={() => { haptics.select(); shiftMonth(-1); }} style={stepBtn}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{monthLabel}</span>
        <button onClick={() => { haptics.select(); shiftMonth(1); }} style={stepBtn}>›</button>
      </div>

      {/* The headline number: money that has arrived but hasn't been given a job. */}
      <div style={{ background: colors.cardSurface, border: `1px solid ${pool.unassigned === 0 ? colors.successBorder : colors.cardBorder}`, borderRadius: 12, padding: '18px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary, fontWeight: 600 }}>To be assigned</div>
        <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, color: poolColor, display: 'block', margin: '4px 0 6px' }}>
          {fmt(pool.unassigned)}
        </Amount>
        <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: 1.5 }}>
          {pool.unassigned === 0
            ? 'Every rupee has a job. This is the goal.'
            : pool.unassigned > 0
              ? 'Give this a job below — assign it to an envelope.'
              : "You've assigned more than you have. Take some back from an envelope."}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Mini label="Income" value={fmt(pool.income)} />
          <Mini label="Rolled over" value={fmt(pool.carried)} />
          <Mini label="Assigned" value={fmt(pool.assigned)} />
        </div>
      </div>

      {overspent.length > 0 && (
        <div style={{ background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.dangerDark, marginBottom: 3 }}>
            {overspent.length} envelope{overspent.length === 1 ? '' : 's'} overspent
          </div>
          <div style={{ fontSize: 12.5, color: colors.dangerDark, lineHeight: 1.45 }}>
            Cover it by assigning more here, or accept it and it carries into next month as a hole to fill.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const spentPct = r.assigned + r.carried > 0
            ? Math.min(100, Math.round((r.spent / (r.assigned + r.carried)) * 100))
            : r.spent > 0 ? 100 : 0;
          return (
            <button key={r.catId} onClick={() => setEditing(r)} style={{ textAlign: 'left', width: '100%', background: colors.cardSurface, border: `1px solid ${r.overspent ? colors.dangerBorder : colors.cardBorder}`, borderRadius: 12, padding: '13px 15px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${r.color}1F`, color: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                  {r.mono}
                </div>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, minWidth: 0 }}>{r.label}</span>
                <div style={{ textAlign: 'right' }}>
                  <Amount style={{ fontSize: 15, fontWeight: 700, color: r.overspent ? colors.danger : colors.successText }}>{fmt(r.available)}</Amount>
                  <div style={{ fontSize: 10.5, color: colors.textTertiary }}>left</div>
                </div>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: colors.track, overflow: 'hidden' }}>
                <div style={{ width: `${spentPct}%`, height: '100%', background: r.overspent ? colors.danger : r.color, borderRadius: 4 }} />
              </div>
              <div style={{ fontSize: 11.5, color: colors.textTertiary }}>
                {r.carried !== 0 && <>{r.carried > 0 ? '+' : ''}{fmt(r.carried)} rolled over · </>}
                {fmt(r.assigned)} assigned · {fmt(r.spent)} spent
              </div>
            </button>
          );
        })}

        {rows.length === 0 && (
          <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '18px 12px', lineHeight: 1.55 }}>
            No envelopes yet for {monthLabel}.<br />Start by giving your income a job — assign it to the categories you actually spend on.
          </div>
        )}
      </div>

      {unused.length > 0 && (
        <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '16px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 10 }}>Add an envelope</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {unused.map((c) => (
              <button
                key={c.id}
                onClick={() => setEditing({ catId: c.id, label: c.label, color: c.color, mono: c.mono, assigned: 0, carried: 0, spent: 0, available: 0 })}
                style={{ padding: '8px 12px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: colors.bgApp, color: colors.textSecondary, border: `1px solid ${colors.cardBorder}` }}
              >
                + {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11.5, color: colors.textTertiary, textAlign: 'center', padding: '0 20px', lineHeight: 1.5 }}>
        Unspent money rolls into next month. Overspending carries forward too, so it has to be covered.
      </div>

      {editing && (
        <AssignSheet
          row={editing}
          monthLabel={monthLabel}
          unassigned={pool.unassigned}
          onClose={() => setEditing(null)}
          onSave={async (amount) => {
            haptics.success();
            if (amount > 0) await assignToEnvelope(editing.catId, periodKey, amount);
            else await clearEnvelope(editing.catId, periodKey);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function AssignSheet({ row, monthLabel, unassigned, onClose, onSave }) {
  const [value, setValue] = useState(row.assigned ? String(row.assigned) : '');
  const amount = parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
  // What the envelope will hold once this assignment lands.
  const after = row.carried + amount - row.spent;

  return (
    <Sheet
      onClose={onClose}
      header={<div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Assign to {row.label}</div>}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.textSecondary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave(amount)} style={{ flex: 2, background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 13, fontSize: 14.5, fontWeight: 600, cursor: 'pointer', border: 'none' }}>Assign</button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          For {monthLabel}. You have <strong style={{ color: unassigned >= 0 ? colors.primary : colors.danger }}>{fmt(unassigned)}</strong> still to assign.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 12, padding: '13px 16px' }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>₹</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            autoFocus
            placeholder="0"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: colors.ink, minWidth: 0 }}
          />
        </div>

        {unassigned > 0 && (
          <button onClick={() => setValue(String(row.assigned + unassigned))} style={{ background: colors.primaryTint, color: colors.primary, border: `1px solid ${colors.primary}`, borderRadius: 100, padding: '10px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Assign all {fmt(unassigned)} that's left
          </button>
        )}

        <div style={{ background: colors.bgApp, borderRadius: 14, padding: '12px 14px', fontSize: 13 }}>
          <Line k="Rolled over from last month" v={fmt(row.carried)} />
          <Line k="Assigning now" v={fmt(amount)} />
          <Line k="Already spent" v={`− ${fmt(row.spent)}`} />
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: `1px solid ${colors.divider}`, fontWeight: 700 }}>
            <span>Left in envelope</span>
            <span style={{ color: after < 0 ? colors.danger : colors.successText }}>{fmt(after)}</span>
          </div>
        </div>

        {row.assigned > 0 && (
          <button onClick={() => onSave(0)} style={{ background: 'transparent', color: colors.danger, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 6 }}>
            Remove this envelope for the month
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Line({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: colors.textSecondary }}>
      <span>{k}</span>
      <span style={{ fontWeight: 500, color: colors.ink }}>{v}</span>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div style={{ flex: 1, background: colors.bgApp, borderRadius: 12, padding: '8px 6px' }}>
      <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <Amount style={{ fontSize: 13, fontWeight: 700 }}>{value}</Amount>
    </div>
  );
}

const stepBtn = {
  width: 34, height: 34, borderRadius: '50%', background: 'transparent',
  border: 'none', cursor: 'pointer', fontSize: 20, color: colors.textSecondary, lineHeight: 1,
};

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
