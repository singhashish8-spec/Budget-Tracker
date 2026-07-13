import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { currentMonthKey, currentMonthLabel, ordinal } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, topCategories, homeTotals } from '../state/selectors';

export default function HomeScreen() {
  const { state, go, goReview, openCategorySheet } = useApp();
  const { txns, categories } = state;
  const alerts = alertCount(txns);
  const { spend, income, spendPct } = homeTotals(txns);
  const top = topCategories(txns, categories);
  const recent = txns.slice(0, 4);
  const monthKey = currentMonthKey();
  const upcomingBills = [...state.reminders]
    .filter((r) => r.paid_for !== monthKey)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 2);

  const monthLabel = currentMonthLabel();

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '0 4px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>Home</div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>{monthLabel}</div>
      </div>

      {alerts > 0 && (
        <button
          onClick={goReview}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: 16, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: colors.danger, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 17, flexShrink: 0 }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: colors.dangerDark }}>{alerts} transaction{alerts === 1 ? '' : 's'} need review</div>
            <div style={{ fontSize: 12.5, color: '#B96A5B' }}>We couldn't detect a category for these</div>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: colors.danger }}>Review</div>
        </button>
      )}

      <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: '20px 18px', color: colors.bgApp }}>
        <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>Spent this month</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, margin: '6px 0 14px' }}>{fmt(spend)}</div>
        <div style={{ height: 6, borderRadius: 100, background: 'rgba(247,244,238,0.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 100, background: colors.accentGreen1, width: `${spendPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 13, color: colors.accentGreen3 }}>{spendPct}% of income spent</div>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: colors.accentGreen3 }}>Income </span>
            <span style={{ fontWeight: 600, color: colors.accentGreen2 }}>{fmt(income)}</span>
          </div>
        </div>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Top spending</div>
          <button onClick={() => go('budgets')} style={{ fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>Budgets</button>
        </div>
        {top.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary }}>No categorised spending yet</div>}
        {top.map((c) => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {c.mono}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5 }}>
                <span style={{ fontWeight: 500 }}>{c.label}</span>
                <span style={{ fontWeight: 600 }}>{c.amtF}</span>
              </div>
              <div style={{ height: 5, borderRadius: 100, background: colors.divider }}>
                <div style={{ height: '100%', borderRadius: 100, background: c.color, width: `${c.barPct}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {upcomingBills.length > 0 && (
        <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Upcoming bills</div>
            <button onClick={() => go('reminders')} style={{ fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>View all</button>
          </div>
          {upcomingBills.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: colors.warningTint, color: colors.warning, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                {r.label.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 12.5, color: colors.textSecondary }}>Due {ordinal(r.due_day)}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(r.amount)}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Recent</div>
          <button onClick={() => go('transactions')} style={{ fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}>See all</button>
        </div>
        {recent.length === 0 && <div style={{ fontSize: 13.5, color: colors.textTertiary, padding: '8px 0' }}>No transactions yet — tap + to add one</div>}
        {recent.map((t) => {
          const cat = categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income_ = t.type === 'income';
          return (
            <button
              key={t.id}
              onClick={() => openCategorySheet(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: uncat ? colors.dangerTint : tint(cat.color),
                  color: uncat ? colors.danger : cat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {uncat ? '?' : cat.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
                <div style={{ fontSize: 12.5, color: uncat ? colors.danger : colors.textSecondary, fontWeight: uncat ? 600 : 400 }}>
                  {uncat ? 'Needs review — tap to categorise' : `${t.date} · ${cat.label}`}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: income_ ? colors.primary : colors.ink }}>
                {income_ ? '+' : '−'}{fmt(t.amount)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
