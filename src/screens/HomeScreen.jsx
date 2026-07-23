import { useEffect, useRef, useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { currentMonthKey, currentMonthLabel, ordinal, daysUntilPayday, payCycleWindow, txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, topCategories, homeTotals, inWindow, goalsSummary } from '../state/selectors';
import QuickAddBar from '../components/QuickAddBar';
import DuplicateBanner from '../components/DuplicateBanner';
import Amount from '../components/Amount';

export default function HomeScreen() {
  const { state, go, goReview, openCategorySheet, openDetail } = useApp();
  const { txns, categories } = state;
  const alerts = alertCount(txns);
  // Spending resets on payday, not on the 1st — so the headline figure matches
  // the money you actually have to work with this cycle.
  const cycle = payCycleWindow(state.salaryDay);
  const cycleTxns = inWindow(txns, cycle);
  const { spend, income, spendPct } = homeTotals(txns, cycle);
  const top = topCategories(cycleTxns, categories);
  const recent = txns.slice(0, 4);
  const monthKey = currentMonthKey();
  const daysToPay = daysUntilPayday(state.salaryDay);
  const spentLabel = cycle.calendar
    ? 'Spent this month'
    : `Spent since ${cycle.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const upcomingBills = [...state.reminders]
    .filter((r) => r.paid_for !== monthKey)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 2);

  const monthLabel = currentMonthLabel();
  const goals = goalsSummary(state.goals);

  // Collapsing header: once the hero "Spent" card scrolls up out of view, a
  // compact bar slides down carrying the same figure — so the headline number is
  // always one glance away. An IntersectionObserver on the hero drives it, so it
  // works regardless of how many banners sit above the hero on any given day.
  const scrollRef = useRef(null);
  const heroRef = useRef(null);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const root = scrollRef.current;
    const target = heroRef.current;
    if (!root || !target || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting), { root, threshold: 0 });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Condensed header — slides in when the hero card leaves the top. Sits
          below the floating action icons (zIndex 42 < 45) and its content is
          left-aligned with room kept on the right so the two never collide. */}
      <div
        className="home-condensed"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 42,
          padding: 'calc(env(safe-area-inset-top, 0px) + 9px) 150px 9px 20px',
          background: colors.bgApp, borderBottom: `1px solid ${colors.divider}`,
          transform: condensed ? 'translateY(0)' : 'translateY(-101%)',
          opacity: condensed ? 1 : 0,
          transition: 'transform 0.26s cubic-bezier(0.2,0.75,0.3,1), opacity 0.2s ease',
          pointerEvents: condensed ? 'auto' : 'none',
        }}
      >
        <div style={{ fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textTertiary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spentLabel}</div>
        <Amount style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{fmt(spend)}</Amount>
      </div>
      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>Home</div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>{monthLabel}</div>
        </div>
        {daysToPay != null && (
          <div style={{ background: colors.successTint, color: colors.successText, borderRadius: 100, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            {daysToPay === 0 ? 'Payday today 🎉' : `${daysToPay} day${daysToPay === 1 ? '' : 's'} to payday`}
          </div>
        )}
      </div>

      <QuickAddBar />

      <DuplicateBanner />

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

      <div ref={heroRef} style={{ background: colors.surfaceDark, borderRadius: 20, padding: '20px 18px', color: colors.onPrimary }}>
        <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>{spentLabel}</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, margin: '6px 0 14px' }}><Amount>{fmt(spend)}</Amount></div>
        <div style={{ height: 6, borderRadius: 100, background: 'rgba(247,244,238,0.15)', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 100, background: colors.accentGreen1, width: `${spendPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: 13, color: colors.accentGreen3 }}>{spendPct}% of income spent</div>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: colors.accentGreen3 }}>Income </span>
            <Amount style={{ fontWeight: 600, color: colors.accentGreen2 }}>{fmt(income)}</Amount>
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
          <button
            key={c.id}
            onClick={() => openDetail({ kind: 'category', id: c.id })}
            style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left', width: '100%' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
              {c.mono}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 5 }}>
                <span style={{ fontWeight: 500 }}>{c.label}</span>
                <Amount style={{ fontWeight: 600 }}>{c.amtF}</Amount>
              </div>
              <div style={{ height: 5, borderRadius: 100, background: colors.divider }}>
                <div style={{ height: '100%', borderRadius: 100, background: c.color, width: `${c.barPct}%` }} />
              </div>
            </div>
            <span style={{ color: colors.textTertiary, fontWeight: 600, fontSize: 15 }}>›</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => go('goals')}
        style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600 }}>Savings goals</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.primary }}>{goals.count > 0 ? 'Manage' : 'Set one'} ›</span>
        </div>
        {goals.count === 0 ? (
          <div style={{ fontSize: 13.5, color: colors.textTertiary }}>No goals yet — set one and I'll track how close you're getting.</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%', fontSize: 13.5 }}>
              <span style={{ color: colors.textSecondary }}>{goals.count} goal{goals.count === 1 ? '' : 's'}{goals.behind > 0 ? ` · ${goals.behind} behind pace` : ''}</span>
              <Amount><span style={{ fontWeight: 700 }}>{goals.totalSavedF}</span><span style={{ color: colors.textSecondary }}> / {goals.totalTargetF}</span></Amount>
            </div>
            <div style={{ height: 6, borderRadius: 100, background: colors.divider, width: '100%', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 100, background: colors.primary, width: `${goals.pct}%` }} />
            </div>
            {goals.rows.slice(0, 2).map((r) => (
              <div key={r.id} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ color: r.onTrack === false ? colors.warningDark : colors.textSecondary, fontWeight: r.onTrack === false ? 600 : 400 }}>{r.pct}%</span>
                </div>
                <div style={{ height: 4, borderRadius: 100, background: colors.divider, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 100, background: r.onTrack === false ? colors.warning : colors.primary, width: `${r.pct}%` }} />
                </div>
              </div>
            ))}
          </>
        )}
      </button>

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
              <Amount style={{ fontSize: 14, fontWeight: 600 }}>{fmt(r.amount)}</Amount>
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
                  {uncat ? 'Needs review — tap to categorise' : `${txnWhen(t)} · ${cat.label}`}
                </div>
              </div>
              <Amount style={{ fontSize: 14, fontWeight: 600, color: income_ ? colors.primary : colors.ink }}>
                {income_ ? '+' : '−'}{fmt(t.amount)}
              </Amount>
            </button>
          );
        })}
      </div>
    </div>
  );
}
