import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { currentMonthKey, currentMonthLabel, ordinal, daysUntilPayday, payCycleWindow, txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, topCategories, homeTotals, inWindow, goalsSummary, categoryDetail } from '../state/selectors';
import QuickAddBar from '../components/QuickAddBar';
import DuplicateBanner from '../components/DuplicateBanner';
import Amount from '../components/Amount';
import Collapse from '../components/Collapse';

export default function HomeScreen() {
  const { state, go, goReview, openCategorySheet, openDetail, togglePrivacy } = useApp();
  const { txns, categories } = state;
  const alerts = alertCount(txns);
  // Spending resets on payday, not on the 1st — so the headline figure matches
  // the money you actually have to work with this cycle.
  // Period selector: null = the live pay-cycle (default), or a { y, m } calendar
  // month picked from the dropdown. Same tested window math either way, so the
  // figures stay trustworthy for any month you look back at.
  const [period, setPeriod] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const cycle = period
    ? { start: new Date(period.y, period.m, 1), end: new Date(period.y, period.m + 1, 1), calendar: true }
    : payCycleWindow(state.salaryDay);
  const cycleTxns = inWindow(txns, cycle);
  const { spend, income, spendPct } = homeTotals(txns, cycle);
  const top = topCategories(cycleTxns, categories);
  const recent = (period ? cycleTxns : txns).slice(0, 4);
  const monthKey = currentMonthKey();
  const daysToPay = period ? null : daysUntilPayday(state.salaryDay);
  const spentLabel = period
    ? `Spent in ${new Date(period.y, period.m, 1).toLocaleDateString('en-IN', { month: 'long' })}`
    : cycle.calendar
      ? 'Spent this month'
      : `Spent since ${cycle.start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
  const upcomingBills = [...state.reminders]
    .filter((r) => r.paid_for !== monthKey)
    .sort((a, b) => a.due_day - b.due_day)
    .slice(0, 2);

  const now = new Date();
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { y: d.getFullYear(), m: d.getMonth(), key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
  });
  const selectedLabel = period
    ? new Date(period.y, period.m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : currentMonthLabel();
  const goals = goalsSummary(state.goals);

  // Collapsing header: once the hero "Spent" card scrolls up past the top, a
  // compact bar carrying the same figure slides down, and retracts on the way
  // back up. Driven by a plain scroll check (hero's bottom edge vs the top of
  // the scroll area) — deterministic and easy to reason about. The bar itself is
  // rendered through a portal to <body> so it's a true viewport-fixed element
  // that no scroll container or transform can clip.
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

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Condensed header lives at the document root (portal) so it's genuinely
          fixed to the viewport — never clipped by the scroll container. It sits
          below the floating action icons (zIndex 42 < 45), left-aligned with room
          kept on the right so the two never collide. */}
      {typeof document !== 'undefined' && createPortal(
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
        </div>,
        document.body,
      )}
      <div style={{ padding: '0 4px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700 }}>Home</div>
          {/* Premium period selector — switch the month the whole dashboard shows. */}
          <button
            onClick={() => setPickerOpen((o) => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: colors.textSecondary, fontSize: 13, fontWeight: 600, padding: '1px 0' }}
          >
            {selectedLabel}
            <svg width="10" height="6" viewBox="0 0 10 6" style={{ transform: pickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>
              <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {pickerOpen && (
            <>
              <button onClick={() => setPickerOpen(false)} aria-label="Close" style={{ position: 'fixed', inset: 0, zIndex: 29, background: 'transparent', cursor: 'default' }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 14, boxShadow: '0 12px 30px rgba(0,0,0,0.20)', padding: 6, minWidth: 190, maxHeight: 300, overflowY: 'auto' }}>
                {monthOptions.map((o, i) => {
                  const isSel = i === 0 ? period === null : !!period && period.y === o.y && period.m === o.m;
                  return (
                    <button
                      key={o.key}
                      onClick={() => { setPeriod(i === 0 ? null : { y: o.y, m: o.m }); setPickerOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '9px 12px', borderRadius: 9, background: isSel ? colors.primaryTint : 'transparent', color: isSel ? colors.primary : colors.ink, fontSize: 13.5, fontWeight: isSel ? 700 : 500 }}
                    >
                      <span>{i === 0 ? `${o.label} · now` : o.label}</span>
                      {isSel && <span>✓</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>{spentLabel}</div>
          <button
            onClick={togglePrivacy}
            title={state.privacy ? 'Show balances' : 'Hide balances'}
            aria-label={state.privacy ? 'Show balances' : 'Hide balances'}
            style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(247,244,238,0.10)', color: colors.accentGreen3, flexShrink: 0 }}
          >
            <EyeIcon off={state.privacy} />
          </button>
        </div>
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
        {top.map((c) => {
          const isOpen = expandedCat === c.id;
          const d = categoryDetail(txns, categories, c.id, { salaryDay: state.salaryDay });
          return (
            <div key={c.id}>
              <button
                onClick={() => setExpandedCat(isOpen ? null : c.id)}
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
                <svg className="bt-chev" data-open={isOpen ? '1' : '0'} width="11" height="7" viewBox="0 0 11 7" style={{ flexShrink: 0, color: colors.textTertiary }}>
                  <path d="M1 1l4.5 4L10 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Collapse open={isOpen}>
                <div style={{ padding: '8px 0 4px 43px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 12.5, color: colors.textSecondary }}>
                    {d.lastTotal === 0 && d.thisTotal === 0
                      ? 'No history yet'
                      : d.delta === 0
                        ? 'Same as last cycle'
                        : <><Amount>{d.deltaF}</Amount> {d.deltaUp ? 'more' : 'less'} than last cycle</>}
                  </div>
                  {d.topMerchants.slice(0, 3).map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                      <span style={{ color: colors.textSecondary, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.merchant} <span style={{ color: colors.textTertiary }}>· {m.count}×</span></span>
                      <Amount style={{ fontWeight: 600, flexShrink: 0 }}>{m.totalF}</Amount>
                    </div>
                  ))}
                  <button onClick={() => openDetail({ kind: 'category', id: c.id })} style={{ alignSelf: 'flex-start', fontSize: 13, fontWeight: 600, color: colors.primary, cursor: 'pointer', paddingTop: 2 }}>
                    See full breakdown ›
                  </button>
                </div>
              </Collapse>
            </div>
          );
        })}
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
