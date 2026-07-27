import { useState } from 'react';
import { colors } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { exportCsv, exportHtmlReport, exportPdfReport } from '../services/exportReport';
import Amount from '../components/Amount';
import Collapse from '../components/Collapse';
import { businessSummary, netWorthProjection } from '../state/selectors';
import { payCycleWindow } from '../utils/date';
import { Icon } from '../components/ui';

const TAX_80C_LIMIT = 150000;

// How savings are actually held here, so the list groups the way people think
// rather than as one undifferentiated pile of "assets".
// `icon` names a glyph in components/ui/Icon rather than holding an emoji:
// emoji ship a different set on every Android skin, so this list rendered
// inconsistently across phones and clashed with the app's own monogram chips.
const HOLDINGS = [
  { key: 'gold', label: 'Gold', icon: 'coin', weighed: true },
  { key: 'sip', label: 'SIP / MF', icon: 'trendUp' },
  { key: 'fd', label: 'FD / RD', icon: 'bank' },
  { key: 'chit', label: 'Chit fund', icon: 'people' },
  { key: 'property', label: 'Property', icon: 'home' },
  { key: 'cash', label: 'Cash / bank', icon: 'cash' },
  { key: 'other', label: 'Other', icon: 'box' },
];

export default function InsightsScreen() {
  const { state, go, showToast, addNetWorthItem, deleteNetWorthItem, setTaxRegime, setTax80cInvested } = useApp();
  const goalsSaved = state.goals.reduce((a, g) => a + (g.saved_amount || 0), 0);

  const assets = state.netWorthItems.filter((i) => i.kind === 'asset').reduce((a, i) => a + i.amount, 0);
  const liab = state.netWorthItems.filter((i) => i.kind === 'liability').reduce((a, i) => a + i.amount, 0);
  const projection = netWorthProjection(state.netWorthItems, state.txns);
  const biz = businessSummary(state.txns, payCycleWindow(state.salaryDay));

  const doExportCsv = async () => {
    try {
      await exportCsv(state.txns, state.categories);
    } catch {
      showToast('Couldn’t export — try again', 'error');
    }
  };
  const doExportReport = async () => {
    try {
      await exportHtmlReport(state.txns, state.categories);
    } catch {
      showToast('Couldn’t export — try again', 'error');
    }
  };
  const doExportPdf = async () => {
    try {
      await exportPdfReport(state.txns, state.categories);
    } catch (err) {
      showToast(err?.message || 'Couldn’t export — try again', 'error');
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, padding: '0 4px' }}>Insights</div>

      <NetWorthCard assets={assets} liab={liab} items={state.netWorthItems} onAdd={addNetWorthItem} onDelete={deleteNetWorthItem} />
      <ProjectionCard p={projection} />
      {biz.count > 0 && <BusinessCard biz={biz} onOpen={() => go('transactions')} />}
      <HubLink label="Savings goals" sub={state.goals.length ? `${fmt(goalsSaved)} saved` : 'Set one'} onClick={() => go('goals')} />
      <TaxCard regime={state.taxRegime} invested={state.tax80cInvested} onRegime={setTaxRegime} onInvested={setTax80cInvested} />

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Export report</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={doExportReport} style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 100, background: colors.primary, color: colors.onPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Report
          </button>
          <button onClick={doExportCsv} style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 100, background: colors.cardSurface, color: colors.primary, border: `1.5px solid ${colors.primary}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            CSV
          </button>
        </div>
        <button onClick={doExportPdf} style={{ width: '100%', marginTop: 10, textAlign: 'center', padding: 12, borderRadius: 100, background: colors.cardSurface, color: colors.primary, border: `1.5px solid ${colors.primary}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          PDF (Android print dialog)
        </button>
      </div>

      <HubLink label="Bill reminders" sub={`${state.reminders.length} tracked`} onClick={() => go('reminders')} />
      <HubLink label="Smart patterns" sub="Detected from your habits" onClick={() => go('patterns')} />
      <HubLink label="SMS auto-tracking" sub={state.accounts.sms ? 'On' : 'Off'} onClick={() => go('sms')} />
      <HubLink label="Settings" sub="Currency, lock, sync" onClick={() => go('settings')} />
    </div>
  );
}

// Straight-line forecast from the savings rate we can actually see. Framed as
// "if you keep this up" rather than a prediction, because that's all it is.
function ProjectionCard({ p }) {
  const [horizon, setHorizon] = useState(12);
  const value = p.current + p.monthlySurplus * horizon;
  const growing = p.monthlySurplus > 0;
  if (!p.hasData) return null;

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Where you're heading</div>
      <div style={{ fontSize: 12.5, color: colors.textSecondary, marginBottom: 12 }}>
        {growing
          ? `You've been saving about ${fmt(p.monthlySurplus)} a month.`
          : `You've been spending about ${fmt(Math.abs(p.monthlySurplus))} more than you earn each month.`}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[12, 36, 60].map((m) => (
          <button
            key={m}
            onClick={() => setHorizon(m)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: horizon === m ? colors.primary : colors.bgApp, color: horizon === m ? colors.onPrimary : colors.textSecondary, border: `1px solid ${horizon === m ? colors.primary : colors.cardBorder}` }}
          >
            {m / 12} year{m > 12 ? 's' : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 }}>
        <div>
          <div style={{ fontSize: 11.5, color: colors.textTertiary }}>Today</div>
          <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{fmt(p.current)}</Amount>
        </div>
        <div style={{ flex: 1, height: 2, background: colors.divider, marginBottom: 10 }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11.5, color: colors.textTertiary }}>In {horizon / 12} year{horizon > 12 ? 's' : ''}</div>
          <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: growing ? colors.successText : colors.danger }}>{fmt(value)}</Amount>
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 12, lineHeight: 1.45 }}>
        Simple arithmetic on the last {p.monthsSeen} month{p.monthsSeen === 1 ? '' : 's'} — not a market forecast. Change what you save and this changes with it.
      </div>
    </div>
  );
}

// Side-hustle totals kept apart from the household, with the GST paid on
// business bills — the input credit a freelancer claims back.
function BusinessCard({ biz, onOpen }) {
  return (
    <button onClick={onOpen} style={{ textAlign: 'left', width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Business this cycle</div>
        <span style={{ fontSize: 12, color: colors.textTertiary }}>{biz.count} entries ›</span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Stat label="Earned" value={fmt(biz.earned)} color={colors.successText} />
        <Stat label="Spent" value={fmt(biz.spend)} color={colors.ink} />
        <Stat label="Net" value={fmt(biz.net)} color={biz.net >= 0 ? colors.successText : colors.danger} />
      </div>
      {biz.gst > 0 && (
        <div style={{ marginTop: 12, background: colors.primaryTint, borderRadius: 12, padding: '10px 12px', fontSize: 12.5, color: colors.primary, fontWeight: 600 }}>
          GST paid on business bills: {fmt(biz.gst)}
        </div>
      )}
    </button>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: colors.bgApp, borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 10.5, color: colors.textTertiary, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color }}>{value}</Amount>
    </div>
  );
}

function HubLink({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>{sub} ›</div>
    </button>
  );
}

function NetWorthCard({ assets, liab, items, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('asset');
  const [label, setLabel] = useState('');
  const [amt, setAmt] = useState('');
  const [holding, setHolding] = useState('cash');
  const [grams, setGrams] = useState('');
  const [rate, setRate] = useState('');
  const [openGroups, setOpenGroups] = useState({ asset: true, liability: true });

  const weighed = kind === 'asset' && HOLDINGS.find((h) => h.key === holding)?.weighed;
  // Gold is held in grams: enter the weight and today's rate and the value
  // works itself out, instead of having to recompute it by hand every time.
  const computed = weighed && grams && rate ? Math.round(Number(grams) * Number(rate)) : null;

  const submit = () => {
    const amount = computed ?? parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !amount) return;
    onAdd({
      kind,
      label: label.trim(),
      amount,
      category: kind === 'asset' ? holding : null,
      quantity: weighed && grams ? Number(grams) : null,
      unit: weighed && grams ? 'g' : null,
    });
    setLabel(''); setAmt(''); setGrams(''); setRate('');
    setOpen(false);
  };

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
      <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary, fontWeight: 600 }}>Net worth</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, margin: '4px 0 12px', color: colors.primary }}><Amount>{fmt(assets - liab)}</Amount></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, background: colors.successTint, borderRadius: 14, padding: '11px 13px' }}>
          <div style={{ fontSize: 12, color: colors.successText, fontWeight: 600 }}>Assets</div>
          <Amount style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(assets)}</Amount>
        </div>
        <div style={{ flex: 1, background: colors.dangerTint, borderRadius: 14, padding: '11px 13px' }}>
          <div style={{ fontSize: 12, color: '#A35545', fontWeight: 600 }}>Liabilities</div>
          <Amount style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(liab)}</Amount>
        </div>
      </div>
      {['asset', 'liability'].map((group) => {
        const groupItems = items.filter((i) => i.kind === group);
        if (!groupItems.length) return null;
        const isOpen = openGroups[group];
        return (
          <div key={group}>
            <button
              onClick={() => setOpenGroups((g) => ({ ...g, [group]: !g[group] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '8px 0 6px' }}
            >
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary }}>
                {group === 'asset' ? 'Assets' : 'Liabilities'} ({groupItems.length})
              </span>
              <svg className="bt-chev" data-open={isOpen ? '1' : '0'} width="11" height="7" viewBox="0 0 11 7" style={{ color: colors.textTertiary }}>
                <path d="M1 1l4.5 4L10 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <Collapse open={isOpen}>
              <div>
                {groupItems.map((i) => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13.5 }}>
                    <Icon name={HOLDINGS.find((h) => h.key === i.category)?.icon} size={15} style={{ color: colors.textTertiary }} />
                    <span style={{ flex: 1, color: colors.textSecondary, minWidth: 0 }}>
                      {i.label}
                      {i.quantity ? <span style={{ color: colors.textTertiary, fontSize: 11.5 }}> · {i.quantity}{i.unit || ''}</span> : null}
                    </span>
                    <Amount style={{ fontWeight: 600 }}>{i.kind === 'liability' ? '−' : ''}{fmt(i.amount)}</Amount>
                    <button onClick={() => onDelete(i.id)} style={{ color: colors.textTertiary, cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                ))}
              </div>
            </Collapse>
          </div>
        );
      })}
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer', marginTop: 8 }}>+ Add asset or liability</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setKind('asset')} style={pillBtn(kind === 'asset')}>Asset</button>
            <button onClick={() => setKind('liability')} style={pillBtn(kind === 'liability')}>Liability</button>
          </div>
          {kind === 'asset' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {HOLDINGS.map((h) => (
                <button
                  key={h.key}
                  onClick={() => setHolding(h.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: holding === h.key ? colors.primary : colors.bgApp, color: holding === h.key ? colors.onPrimary : colors.textSecondary, border: `1px solid ${holding === h.key ? colors.primary : colors.cardBorder}` }}
                >
                  <Icon name={h.icon} size={14} />
                  {h.label}
                </button>
              ))}
            </div>
          )}
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === 'asset' && holding === 'gold' ? 'e.g. Wedding jewellery' : 'e.g. Savings account'} style={inputStyle} />
          {weighed && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={grams} onChange={(e) => setGrams(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Grams" style={{ ...inputStyle, flex: 1 }} />
                <input value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="Rate per gram ₹" style={{ ...inputStyle, flex: 1 }} />
              </div>
              <div style={{ fontSize: 11.5, color: colors.textTertiary, paddingLeft: 4 }}>
                {computed ? `Worth ${fmt(computed)} at that rate` : 'Enter weight and today’s rate — the value works itself out'}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {!weighed && <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="₹ amount" style={{ ...inputStyle, flex: 1 }} />}
            {weighed && <div style={{ flex: 1 }} />}
            <button onClick={submit} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaxCard({ regime, invested, onRegime, onInvested }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(invested || ''));
  const isOld = regime === 'old';
  const pct = isOld ? Math.min(100, Math.round((invested / TAX_80C_LIMIT) * 100)) : 0;

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Tax saver · 80C</div>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0' }}>
        <button onClick={() => onRegime('new')} style={pillBtn(regime === 'new')}>New regime</button>
        <button onClick={() => onRegime('old')} style={pillBtn(regime === 'old')}>Old regime</button>
      </div>
      {!isOld ? (
        <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
          The new tax regime (India's default since FY 2023-24) doesn't allow 80C deductions — switch to "Old regime" above only if you've explicitly opted into it.
        </div>
      ) : editing ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="Amount invested this year" style={{ ...inputStyle, flex: 1 }} />
          <button
            onClick={() => {
              onInvested(parseInt(String(val).replace(/[^0-9]/g, ''), 10) || 0);
              setEditing(false);
            }}
            style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
            <Amount>{fmt(invested)}</Amount> of <Amount>{fmt(TAX_80C_LIMIT)}</Amount> invested —{' '}
            <button onClick={() => setEditing(true)} style={{ color: colors.primary, fontWeight: 600, cursor: 'pointer' }}>edit</button>
          </div>
          <div style={{ height: 6, borderRadius: 100, background: colors.divider }}>
            <div style={{ height: '100%', borderRadius: 100, background: colors.warning, width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

const pillBtn = (active) => ({
  padding: '8px 14px',
  borderRadius: 100,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  background: active ? colors.primary : colors.cardSurface,
  color: active ? colors.onPrimary : colors.ink,
  border: `1px solid ${active ? colors.primary : colors.cardBorder}`,
});

const inputStyle = {
  background: colors.bgApp,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 100,
  padding: '11px 16px',
  fontSize: 14,
  color: colors.ink,
  minWidth: 0,
};
