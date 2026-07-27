import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, fonts, radii, type } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { currentMonthKey, currentMonthLabel, ordinal, daysUntilPayday, payCycleWindow, txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, topCategories, homeTotals, inWindow, goalsSummary, categoryDetail, warrantyList, subscriptionPriceChanges, spendingForecast } from '../state/selectors';
import * as haptics from '../services/haptics';
import QuickAddBar from '../components/QuickAddBar';
import DuplicateBanner from '../components/DuplicateBanner';
import Amount from '../components/Amount';
import Collapse from '../components/Collapse';
import { Card, Screen, SectionHeader, ListRow, ProgressBar, Mono, EmptyState, CountUp, Icon } from '../components/ui';

export default function HomeScreen() {
  const { state, go, goReview, openCategorySheet, openDetail, togglePrivacy } = useApp();
  const { txns, categories } = state;
  // Spending resets on payday, not on the 1st — so the headline figure matches
  // the money you actually have to work with this cycle.
  // Period selector: null = the live pay-cycle (default), or a { y, m } calendar
  // month picked from the dropdown. Same tested window math either way, so the
  // figures stay trustworthy for any month you look back at.
  const [period, setPeriod] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);

  // Every selector below walks the full transaction array, and this screen
  // re-renders on any state change anywhere in the app (one shared context).
  // Without memoisation the whole set recomputed on every keystroke elsewhere.
  const alerts = useMemo(() => alertCount(txns), [txns]);
  const cycle = useMemo(() => (period
    ? { start: new Date(period.y, period.m, 1), end: new Date(period.y, period.m + 1, 1), calendar: true }
    : payCycleWindow(state.salaryDay)), [period, state.salaryDay]);
  const cycleTxns = useMemo(() => inWindow(txns, cycle), [txns, cycle]);
  const { spend, income, spendPct } = useMemo(() => homeTotals(txns, cycle), [txns, cycle]);
  const top = useMemo(() => topCategories(cycleTxns, categories), [cycleTxns, categories]);
  const recent = useMemo(() => (period ? cycleTxns : txns).slice(0, 4), [period, cycleTxns, txns]);
  const goals = useMemo(() => goalsSummary(state.goals), [state.goals]);

  const monthKey = currentMonthKey();
  const daysToPay = period ? null : daysUntilPayday(state.salaryDay);
  const spentLabel = period
    ? `Spent in ${new Date(period.y, period.m, 1).toLocaleDateString('en-IN', { month: 'long' })}`
    : cycle.calendar
      ? 'Spent this month'
      : `Spent since ${cycle.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const upcomingBills = useMemo(() => [...state.reminders]
    .filter((r) => r.paid_for !== monthKey)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 2), [state.reminders, monthKey]);

  const now = new Date();
  // A subscription charging more than the amount on its reminder — the honest
  // version of "bill negotiation": we can't haggle, but we can notice.
  const priceRises = useMemo(
    () => (period ? [] : subscriptionPriceChanges(state.reminders, txns)),
    [period, state.reminders, txns],
  );
  // Budgets heading past their limit at the current pace. Extrapolation, not a
  // prediction — worth surfacing early enough to actually change course.
  const forecasts = useMemo(
    () => (period ? [] : spendingForecast(txns, state.budgets, categories, { salaryDay: state.salaryDay, now })),
    // `now` is intentionally excluded: it changes identity on every render, and
    // re-forecasting on a sub-second cadence would defeat the memo entirely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, txns, state.budgets, categories, state.salaryDay],
  );
  // Warranties needing attention: expiring within 60 days, or expired in the
  // last 30 — pulled from both the warranties panel and any purchase quick-
  // tagged with a warranty. The full list lives on the Warranties screen.
  const expiringWs = useMemo(
    () => (period
      ? []
      : warrantyList(state.warranties, txns, now).filter((w) => w.status === 'expiring' || (w.status === 'expired' && w.daysLeft >= -30))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, state.warranties, txns],
  );
  // Only the open category needs its detail computed — this used to run for
  // every row on every render, each one six nested month-window scans deep.
  const expandedDetail = useMemo(
    () => (expandedCat ? categoryDetail(txns, categories, expandedCat, { salaryDay: state.salaryDay }) : null),
    [expandedCat, txns, categories, state.salaryDay],
  );

  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const selectedLabel = period
    ? new Date(period.y, period.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : currentMonthLabel();

  // Collapsing header: once the hero "Spent" card scrolls up past the top, a
  // compact bar carrying the same figure slides down, and retracts on the way
  // back up. The bar itself is rendered through a portal to <body> so it's a
  // true viewport-fixed element that no scroll container or transform can clip.
  const heroRef = useRef(null);
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    const target = heroRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;
    // Observe against root:null — the VIEWPORT itself — so it fires no matter
    // which element actually scrolls. Earlier tries watched the inner container,
    // but on this layout the page scrolls, not that div, so they never fired.
    const io = new IntersectionObserver(([e]) => setCondensed(!e.isIntersecting), { root: null, threshold: 0, rootMargin: '-4px 0px 0px 0px' });
    io.observe(target);
    return () => io.disconnect();
  }, []);

  const toggleCategory = (id) => {
    haptics.select();
    setExpandedCat((cur) => (cur === id ? null : id));
  };

  return (
    <Screen>
      {/* Condensed header lives at the document root (portal) so it's genuinely
          fixed to the viewport — never clipped by the scroll container. It sits
          below the floating action icons (zIndex 42 < 45), left-aligned with room
          kept on the right so the two never collide. */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="home-condensed"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 42,
            padding: 'calc(env(safe-area-inset-top, 0px) + 9px) 74px 9px 20px',
            background: colors.bgApp, borderBottom: `1px solid ${colors.divider}`,
            transform: condensed ? 'translateY(0)' : 'translateY(-101%)',
            opacity: condensed ? 1 : 0,
            transition: 'transform 0.26s cubic-bezier(0.2,0.75,0.3,1), opacity 0.2s ease',
            pointerEvents: condensed ? 'auto' : 'none',
          }}
        >
          <div style={{ fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textTertiary, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spentLabel}</div>
          <Amount style={{ fontFamily: fonts.heading, fontSize: 18, fontWeight: 700 }}>{fmt(spend)}</Amount>
        </div>,
        document.body,
      )}

      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: fonts.heading, fontSize: type.screen, fontWeight: 700 }}>Home</div>
          {/* Period selector — switch the month the whole dashboard shows. */}
          <button
            onClick={() => { haptics.select(); setPickerOpen((o) => !o); }}
            aria-expanded={pickerOpen}
            aria-label={`Change period — currently ${selectedLabel}`}
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: colors.textSecondary, fontSize: type.body, fontWeight: 600, padding: '3px 0' }}
          >
            {selectedLabel}
            <svg width="10" height="6" viewBox="0 0 10 6" style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {pickerOpen && (
            <>
              <button onClick={() => setPickerOpen(false)} aria-label="Close period picker" style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'transparent', cursor: 'default' }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: radii.chip, boxShadow: '0 12px 30px rgba(0,0,0,0.20)', padding: 6, minWidth: 190, maxHeight: 300, overflowY: 'auto' }}>
                {monthOptions.map((o, i) => {
                  const isSel = i === 0 ? period === null : !!period && period.y === o.y && period.m === o.m;
                  return (
                    <button
                      key={o.key}
                      onClick={() => { haptics.select(); setPeriod(i === 0 ? null : { y: o.y, m: o.m }); setPickerOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '10px 12px', borderRadius: 9, background: isSel ? colors.primaryTint : 'transparent', color: isSel ? colors.primary : colors.ink, fontSize: type.body, fontWeight: isSel ? 700 : 500 }}
                    >
                      <span>{i === 0 ? `${o.label} · now` : o.label}</span>
                      {isSel && <Icon name="check" size={14} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {daysToPay != null && (
          <div style={{ background: colors.successTint, color: colors.successText, borderRadius: radii.pill, padding: '6px 12px', fontSize: type.footnote, fontWeight: 600, marginTop: 4 }}>
            {daysToPay === 0 ? 'Payday today' : `${daysToPay} day${daysToPay === 1 ? '' : 's'} to payday`}
          </div>
        )}
      </div>

      <QuickAddBar />

      <DuplicateBanner />

      {priceRises.length > 0 && (
        <Card tight style={{ background: colors.warningTint, borderColor: colors.warningBorder, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.warningDark }}>
            <Icon name="trendUp" size={17} />
            <div style={{ fontSize: type.callout, fontWeight: 700 }}>Subscription price went up</div>
          </div>
          {priceRises.slice(0, 3).map((p) => (
            <ListRow
              key={p.id}
              onClick={() => go('reminders')}
              style={{ padding: '6px 0', borderTop: `1px solid ${colors.warningBorder}80`, color: colors.warningDark }}
              title={p.label}
              subtitle={<>{fmt(p.was)} → {fmt(p.now)} · up {p.pct}%</>}
              subtitleColor={colors.warningDark}
              trailing={<div style={{ fontSize: type.footnote, fontWeight: 700 }}>+{fmt(p.yearlyImpact)}/yr</div>}
            />
          ))}
        </Card>
      )}

      {forecasts.length > 0 && (
        <Card tight style={{ gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="forecast" size={17} style={{ color: colors.textSecondary }} />
            <div style={{ fontSize: type.callout, fontWeight: 700 }}>Heading over budget</div>
          </div>
          {forecasts.slice(0, 3).map((f) => (
            <ListRow
              key={f.cat}
              onClick={() => go('budgets')}
              style={{ padding: '6px 0', borderTop: `1px solid ${colors.divider}` }}
              title={f.label}
              subtitle={`${fmt(f.spent)} of ${fmt(f.limit)} · ${f.daysLeft} day${f.daysLeft === 1 ? '' : 's'} left`}
              subtitleColor={colors.textTertiary}
              trailing={<div style={{ fontSize: type.footnote, fontWeight: 700, color: colors.danger }}>~{fmt(f.over)} over</div>}
            />
          ))}
          <div style={{ fontSize: type.caption, color: colors.textTertiary }}>Based on your pace so far this period</div>
        </Card>
      )}

      {expiringWs.length > 0 && (
        <Card tight style={{ background: colors.warningTint, borderColor: colors.warningBorder, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.warningDark }}>
            <Icon name="shield" size={17} />
            <div style={{ fontSize: type.callout, fontWeight: 700 }}>Warranties expiring soon</div>
            <button onClick={() => { haptics.select(); go('warranty'); }} style={{ marginLeft: 'auto', fontSize: type.footnote, fontWeight: 700, color: colors.warningDark, cursor: 'pointer' }}>View all →</button>
          </div>
          {expiringWs.slice(0, 3).map((w) => {
            const isExpired = w.status === 'expired';
            return (
              <ListRow
                key={`${w.source}-${w.id}`}
                onClick={() => go('warranty')}
                style={{ padding: '6px 0', borderTop: `1px solid ${colors.warningBorder}80`, color: colors.warningDark }}
                title={w.product}
                subtitle={`${w.amount != null ? `${fmt(w.amount)} • ` : ''}${w.totalMonths} months`}
                subtitleColor={colors.warningDark}
                trailing={(
                  <div style={{ fontSize: type.footnote, fontWeight: isExpired ? 700 : 600, color: isExpired ? colors.danger : colors.warningDark }}>
                    {isExpired ? 'Expired ' : 'Expires '}{w.expireLabel}
                  </div>
                )}
              />
            );
          })}
        </Card>
      )}

      {alerts > 0 && (
        <button
          onClick={() => { haptics.select(); goReview(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 12, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: radii.cardTight, padding: '13px 14px', cursor: 'pointer', textAlign: 'left', width: '100%' }}
        >
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: colors.danger, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: type.title, flexShrink: 0 }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: type.callout, fontWeight: 600, color: colors.dangerDark }}>{alerts} transaction{alerts === 1 ? '' : 's'} need review</div>
            <div style={{ fontSize: type.footnote, color: colors.dangerDark, opacity: 0.75 }}>We couldn't detect a category for these</div>
          </div>
          <div style={{ fontSize: type.body, fontWeight: 600, color: colors.danger }}>Review</div>
        </button>
      )}

      <div ref={heroRef} style={{ background: colors.surfaceDark, borderRadius: radii.card, padding: '20px 18px', color: colors.onPrimary }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: type.footnote, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>{spentLabel}</div>
          <button
            onClick={() => { haptics.select(); togglePrivacy(); }}
            title={state.privacy ? 'Show balances' : 'Hide balances'}
            aria-label={state.privacy ? 'Show balances' : 'Hide balances'}
            style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(247,244,238,0.10)', color: colors.accentGreen3, flexShrink: 0 }}
          >
            <EyeIcon off={state.privacy} />
          </button>
        </div>
        {/* The one figure in the app that counts up — it's the headline, and a
            number that lands reads as considered rather than merely printed. */}
        <CountUp
          value={spend}
          format={fmt}
          style={{ display: 'block', fontFamily: fonts.heading, fontSize: type.display, fontWeight: 700, margin: '6px 0 14px' }}
        />
        <ProgressBar pct={spendPct} height={6} color={colors.accentGreen1} track="rgba(247,244,238,0.15)" />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <div style={{ fontSize: type.body, color: colors.accentGreen3 }}>{spendPct}% of income spent</div>
          <div style={{ fontSize: type.body }}>
            <span style={{ color: colors.accentGreen3 }}>Income </span>
            <Amount style={{ fontWeight: 600, color: colors.accentGreen2 }}>{fmt(income)}</Amount>
          </div>
        </div>
      </div>

      <Card style={{ gap: 13 }}>
        <SectionHeader title="Top spending" action="Budgets" onAction={() => go('budgets')} />
        {top.length === 0 && <EmptyState text="No categorised spending yet" />}
        {top.map((c) => {
          const isOpen = expandedCat === c.id;
          const d = isOpen ? expandedDetail : null;
          return (
            <div key={c.id}>
              <button
                onClick={() => toggleCategory(c.id)}
                aria-expanded={isOpen}
                style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left', width: '100%', color: colors.ink }}
              >
                <Mono label={c.mono} color={c.color} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: type.callout, marginBottom: 5 }}>
                    <span style={{ fontWeight: 500 }}>{c.label}</span>
                    <Amount style={{ fontWeight: 600 }}>{c.amtF}</Amount>
                  </div>
                  <ProgressBar pct={c.barPct} height={5} color={c.color} />
                </div>
                <svg className="bt-chev" data-open={isOpen ? '1' : '0'} width="11" height="7" viewBox="0 0 11 7" style={{ flexShrink: 0, color: colors.textTertiary }}>
                  <path d="M1 1l4.5 4L10 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Collapse open={isOpen}>
                <div style={{ padding: '8px 0 4px 43px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {d && (
                    <>
                      <div style={{ fontSize: type.footnote, color: colors.textSecondary }}>
                        {d.lastTotal === 0 && d.thisTotal === 0
                          ? 'No history yet'
                          : d.delta === 0
                            ? 'Same as last cycle'
                            : <><Amount>{d.deltaF}</Amount> {d.deltaUp ? 'more' : 'less'} than last cycle</>}
                      </div>
                      {d.topMerchants.slice(0, 3).map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: type.body }}>
                          <span style={{ color: colors.textSecondary, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.merchant} <span style={{ color: colors.textTertiary }}>· {m.count}×</span></span>
                          <Amount style={{ fontWeight: 600, flexShrink: 0 }}>{m.totalF}</Amount>
                        </div>
                      ))}
                      <button onClick={() => { haptics.select(); openDetail({ kind: 'category', id: c.id }); }} style={{ alignSelf: 'flex-start', fontSize: type.body, fontWeight: 600, color: colors.primary, cursor: 'pointer', padding: '4px 0' }}>
                        See full breakdown ›
                      </button>
                    </>
                  )}
                </div>
              </Collapse>
            </div>
          );
        })}
      </Card>

      <Card as="button" onClick={() => { haptics.select(); go('goals'); }} style={{ gap: 12, cursor: 'pointer', textAlign: 'left', width: '100%', color: colors.ink }}>
        <SectionHeader title="Savings goals" action={`${goals.count > 0 ? 'Manage' : 'Set one'} ›`} style={{ width: '100%' }} />
        {goals.count === 0 ? (
          <EmptyState text="No goals yet — set one and I'll track how close you're getting." />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', width: '100%', fontSize: type.body }}>
              <span style={{ color: colors.textSecondary }}>{goals.count} goal{goals.count === 1 ? '' : 's'}{goals.behind > 0 ? ` · ${goals.behind} behind pace` : ''}</span>
              <Amount><span style={{ fontWeight: 700 }}>{goals.totalSavedF}</span><span style={{ color: colors.textSecondary }}> / {goals.totalTargetF}</span></Amount>
            </div>
            <ProgressBar pct={goals.pct} height={6} />
            {goals.rows.slice(0, 2).map((r) => (
              <div key={r.id} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: type.body, marginBottom: 4 }}>
                  <span style={{ fontWeight: 500 }}>{r.label}</span>
                  <span style={{ color: r.onTrack === false ? colors.warningDark : colors.textSecondary, fontWeight: r.onTrack === false ? 600 : 400 }}>{r.pct}%</span>
                </div>
                <ProgressBar pct={r.pct} height={4} color={r.onTrack === false ? colors.warning : colors.primary} />
              </div>
            ))}
          </>
        )}
      </Card>

      {upcomingBills.length > 0 && (
        <Card style={{ gap: 4 }}>
          <SectionHeader title="Upcoming bills" action="View all" onAction={() => go('reminders')} style={{ marginBottom: 8 }} />
          {upcomingBills.map((r) => (
            <ListRow
              key={r.id}
              style={{ padding: '7px 0' }}
              leading={<Mono label={r.label.slice(0, 2).toUpperCase()} color={colors.warning} size={32} />}
              title={r.label}
              subtitle={`Due ${ordinal(r.due_day)}`}
              trailing={<Amount style={{ fontSize: type.callout, fontWeight: 600 }}>{fmt(r.amount)}</Amount>}
            />
          ))}
        </Card>
      )}

      <Card style={{ gap: 2 }}>
        <SectionHeader title="Recent" action="See all" onAction={() => go('transactions')} style={{ marginBottom: 8 }} />
        {recent.length === 0 && <EmptyState text="No transactions yet — tap + to add one" />}
        {recent.map((t) => {
          const cat = categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const isIncome = t.type === 'income';
          return (
            <ListRow
              key={t.id}
              onClick={() => openCategorySheet(t.id)}
              leading={<Mono label={uncat ? '?' : cat.mono} color={uncat ? colors.danger : cat.color} size={36} />}
              title={t.merchant}
              subtitle={uncat ? 'Needs review — tap to categorise' : `${txnWhen(t)} · ${cat.label}`}
              subtitleColor={uncat ? colors.danger : colors.textSecondary}
              subtitleWeight={uncat ? 600 : 400}
              trailing={(
                <Amount style={{ fontSize: type.callout, fontWeight: 600, color: isIncome ? colors.primary : colors.ink }}>
                  {isIncome ? '+' : '−'}{fmt(t.amount)}
                </Amount>
              )}
            />
          );
        })}
      </Card>
    </Screen>
  );
}

// Open eye when balances are visible; struck-through eye when hidden.
function EyeIcon({ off }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.8 12S5.5 5 12 5s10.2 7 10.2 7-3.7 7-10.2 7S1.8 12 1.8 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}
