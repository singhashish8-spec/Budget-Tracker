import { useState } from 'react';
import { colors } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { exportCsv, exportHtmlReport } from '../services/exportReport';

const TAX_80C_LIMIT = 150000;

export default function InsightsScreen() {
  const { state, go, showToast, addNetWorthItem, deleteNetWorthItem, setTaxRegime, setTax80cInvested } = useApp();
  const goalsSaved = state.goals.reduce((a, g) => a + (g.saved_amount || 0), 0);

  const assets = state.netWorthItems.filter((i) => i.kind === 'asset').reduce((a, i) => a + i.amount, 0);
  const liab = state.netWorthItems.filter((i) => i.kind === 'liability').reduce((a, i) => a + i.amount, 0);

  const doExportCsv = async () => {
    try {
      await exportCsv(state.txns, state.categories);
    } catch {
      showToast('Couldn’t export — try again');
    }
  };
  const doExportReport = async () => {
    try {
      await exportHtmlReport(state.txns, state.categories);
    } catch {
      showToast('Couldn’t export — try again');
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, padding: '0 4px' }}>Insights</div>

      <NetWorthCard assets={assets} liab={liab} items={state.netWorthItems} onAdd={addNetWorthItem} onDelete={deleteNetWorthItem} />
      <HubLink label="Savings goals" sub={state.goals.length ? `${fmt(goalsSaved)} saved` : 'Set one'} onClick={() => go('goals')} />
      <TaxCard regime={state.taxRegime} invested={state.tax80cInvested} onRegime={setTaxRegime} onInvested={setTax80cInvested} />

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 12 }}>Export report</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={doExportReport} style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 100, background: colors.primary, color: colors.bgApp, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Report
          </button>
          <button onClick={doExportCsv} style={{ flex: 1, textAlign: 'center', padding: 12, borderRadius: 100, background: colors.cardSurface, color: colors.primary, border: `1.5px solid ${colors.primary}`, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            CSV
          </button>
        </div>
      </div>

      <HubLink label="Bill reminders" sub={`${state.reminders.length} tracked`} onClick={() => go('reminders')} />
      <HubLink label="Smart patterns" sub="Detected from your habits" onClick={() => go('patterns')} />
      <HubLink label="SMS auto-tracking" sub={state.accounts.sms ? 'On' : 'Off'} onClick={() => go('sms')} />
      <HubLink label="Settings" sub="Currency, lock, sync" onClick={() => go('settings')} />
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

  const submit = () => {
    const amount = parseInt(String(amt).replace(/[^0-9]/g, ''), 10);
    if (!label.trim() || !amount) return;
    onAdd({ kind, label: label.trim(), amount });
    setLabel('');
    setAmt('');
    setOpen(false);
  };

  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px' }}>
      <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textSecondary, fontWeight: 600 }}>Net worth</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, margin: '4px 0 12px', color: colors.primary }}>{fmt(assets - liab)}</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, background: colors.successTint, borderRadius: 14, padding: '11px 13px' }}>
          <div style={{ fontSize: 12, color: colors.successText, fontWeight: 600 }}>Assets</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(assets)}</div>
        </div>
        <div style={{ flex: 1, background: colors.dangerTint, borderRadius: 14, padding: '11px 13px' }}>
          <div style={{ fontSize: 12, color: '#A35545', fontWeight: 600 }}>Liabilities</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>{fmt(liab)}</div>
        </div>
      </div>
      {items.map((i) => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13.5 }}>
          <span style={{ flex: 1, color: colors.textSecondary }}>{i.label}</span>
          <span style={{ fontWeight: 600 }}>{i.kind === 'liability' ? '−' : ''}{fmt(i.amount)}</span>
          <button onClick={() => onDelete(i.id)} style={{ color: colors.textTertiary, cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      ))}
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer', marginTop: 8 }}>+ Add asset or liability</button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setKind('asset')} style={pillBtn(kind === 'asset')}>Asset</button>
            <button onClick={() => setKind('liability')} style={pillBtn(kind === 'liability')}>Liability</button>
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Savings account" style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={amt} onChange={(e) => setAmt(e.target.value)} placeholder="₹ amount" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={submit} style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
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
            style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Save
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 10 }}>
            {fmt(invested)} of {fmt(TAX_80C_LIMIT)} invested —{' '}
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
  background: active ? colors.ink : colors.cardSurface,
  color: active ? colors.bgApp : colors.ink,
  border: `1px solid ${active ? colors.ink : colors.cardBorder}`,
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
