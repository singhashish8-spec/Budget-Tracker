import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import { detectPatterns } from '../state/selectors';
import { unlock as biometricUnlock } from '../services/appLock';

export default function PatternsScreen() {
  const { state, goBack, openDetail, setPatternPref, clearPatternPref, showToast, addCustomPattern, deleteCustomPattern } = useApp();
  const patterns = detectPatterns(state.txns, state.categories, state.patternPrefs);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [cpLabel, setCpLabel] = useState('');
  const [cpAmt, setCpAmt] = useState('');
  const [cpCadence, setCpCadence] = useState('monthly');

  const submitCustom = () => {
    const amount = parseInt(String(cpAmt).replace(/[^0-9]/g, ''), 10);
    if (!cpLabel.trim() || !amount) return;
    addCustomPattern({ label: cpLabel.trim(), amount, cadence: cpCadence });
    setCpLabel('');
    setCpAmt('');
  };

  const requestDelete = async (p) => {
    setConfirmDelete(p.signature);
    const res = await biometricUnlock();
    setConfirmDelete(null);
    if (res.success) {
      await setPatternPref(p.signature, 'dismissed');
      showToast(`"${p.merchant}" pattern dismissed`);
    } else if (!res.cancelled) {
      showToast(res.message || 'Couldn’t verify — try again');
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Smart patterns</div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, padding: '0 4px' }}>
        Detected from your transactions
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {patterns.map((p) => (
          <div key={p.signature} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: 15 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 8 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: tint(p.color), color: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {p.mono}
              </div>
              <button onClick={() => openDetail({ kind: 'pattern', id: p.signature })} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'transparent', cursor: 'pointer' }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.merchant}</div>
                <div style={{ fontSize: 12, color: colors.textTertiary }}>Seen {p.count} times · avg {p.avgF} · tap for details ›</div>
              </button>
              <button
                onClick={() => requestDelete(p)}
                title="Dismiss pattern"
                disabled={confirmDelete === p.signature}
                style={{ width: 30, height: 30, borderRadius: '50%', background: colors.bgApp, border: `1px solid ${colors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11">
                  <path d="M1 1l9 9M10 1l-9 9" stroke={colors.danger} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: colors.textSecondary, marginBottom: 10 }}>
              Tagged {p.label} {p.count} times, totalling {p.totalF} so far.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => (p.confirmed ? clearPatternPref(p.signature) : setPatternPref(p.signature, 'confirmed'))}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '7px 15px',
                  borderRadius: 100,
                  cursor: 'pointer',
                  background: p.confirmed ? colors.successTint : colors.primary,
                  color: p.confirmed ? colors.primary : colors.onPrimary,
                  border: `1px solid ${p.confirmed ? colors.successBorder : colors.primary}`,
                }}
              >
                {p.confirmed ? 'Confirmed pattern' : 'Confirm pattern'}
              </button>
            </div>
          </div>
        ))}
        {patterns.length === 0 && (
          <div style={{ fontSize: 13.5, color: colors.textTertiary, textAlign: 'center', padding: '20px 0' }}>
            No recurring merchants yet — patterns show up once a merchant appears 3+ times
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary, padding: '8px 4px 0' }}>
        Your recurring expenses
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {state.customPatterns.map((p) => (
          <div key={p.id} style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: colors.primaryTint, color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {p.label.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary }}>{p.cadence}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(p.amount)}</div>
            <button onClick={() => deleteCustomPattern(p.id)} style={{ color: colors.textTertiary, cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>✕</button>
          </div>
        ))}
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textSecondary }}>Add your own</div>
        <input value={cpLabel} onChange={(e) => setCpLabel(e.target.value)} placeholder="e.g. Gym membership" style={cpInput} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={cpAmt} onChange={(e) => setCpAmt(e.target.value)} placeholder="₹ amount" style={{ ...cpInput, flex: 1 }} />
          <select value={cpCadence} onChange={(e) => setCpCadence(e.target.value)} style={{ ...cpInput, flex: 1 }}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
        <button onClick={submitCustom} style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 12, textAlign: 'center', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Add recurring expense
        </button>
      </div>

      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>
        Dismissing a detected pattern requires verifying it's you
      </div>
    </div>
  );
}

const cpInput = {
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
