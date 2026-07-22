import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { categoryDetail, patternDetail } from '../state/selectors';

// One reusable drill-down dashboard. state.detail = { kind, id } picks the
// subject; it renders a spending category or a detected pattern, and is shaped
// so budget / goal / bill subjects can slot in later without a new screen.
export default function DetailScreen() {
  const { state, goBack, openCategorySheet } = useApp();
  const subject = state.detail;

  if (subject?.kind === 'pattern') {
    return <PatternDetail signature={subject.id} />;
  }

  if (!subject || subject.kind !== 'category') {
    return (
      <Shell title="Details" onBack={goBack}>
        <div style={{ fontSize: 13.5, color: colors.textTertiary, padding: '10px 4px' }}>Nothing to show.</div>
      </Shell>
    );
  }

  const d = categoryDetail(state.txns, state.categories, subject.id, { salaryDay: state.salaryDay });

  return (
    <Shell title={d.title} mono={d.mono} color={d.color} onBack={goBack}>
      {/* Headline: what this category cost this cycle, vs last */}
      <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: '18px 16px', color: colors.onPrimary }}>
        <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>Spent {d.cycleLabel}</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, margin: '5px 0 8px' }}>{d.thisTotalF}</div>
        <div style={{ fontSize: 13, color: colors.accentGreen3 }}>
          {d.lastTotal === 0 && d.thisTotal === 0
            ? 'No spending recorded here yet'
            : d.delta === 0
              ? 'Same as last cycle'
              : `${d.deltaF} ${d.deltaUp ? 'more' : 'less'} than last cycle (${d.lastTotalF})`}
        </div>
      </div>

      {/* 6-month trend */}
      <Card title="Last 6 months">
        <TrendChart trend={d.trend} color={d.color} />
      </Card>

      {/* Top merchants */}
      {d.topMerchants.length > 0 && (
        <Card title="Top merchants">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {d.topMerchants.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.merchant}
                  <span style={{ color: colors.textTertiary, fontSize: 12 }}> · {m.count}×</span>
                </div>
                <div style={{ fontWeight: 600 }}>{m.totalF}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Full transaction list for this category */}
      <Card title={`All transactions (${d.count})`}>
        <TxnList txns={d.txns} color={d.color} mono={d.mono} onTap={openCategorySheet} />
      </Card>
    </Shell>
  );
}

// Detail view for a detected pattern: the evidence behind the flag, a 6-month
// trend, and every transaction that makes up the pattern.
function PatternDetail({ signature }) {
  const { state, goBack, openCategorySheet, setMerchantCategory } = useApp();
  const d = patternDetail(state.txns, state.categories, signature);
  const ruleCat = state.merchantRules[signature] || null;
  const cats = state.categories.filter((c) => !(state.disabledCats || []).includes(c.id));

  return (
    <Shell title={d.title} mono={d.mono} color={d.color} onBack={goBack}>
      <div style={{ background: colors.surfaceDark, borderRadius: 20, padding: '18px 16px', color: colors.onPrimary }}>
        <div style={{ fontSize: 12.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.accentGreen3, fontWeight: 600 }}>Recurring · {d.categoryLabel}</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, fontWeight: 700, margin: '5px 0 8px' }}>Seen {d.count}×</div>
        <div style={{ fontSize: 13, color: colors.accentGreen3 }}>{d.totalF} total · {d.avgF} on average</div>
      </div>

      <Card title="Always file under">
        <div style={{ fontSize: 12.5, color: colors.textSecondary, marginTop: -4 }}>
          {ruleCat
            ? 'New payments to this merchant file here automatically. Tap another to change it.'
            : `Pick a category and every ${d.title} payment — past and future — files there automatically, no more review flags.`}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cats.map((c) => {
            const on = ruleCat === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setMerchantCategory(signature, on ? null : c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 100, cursor: 'pointer',
                  background: on ? colors.primaryTint : colors.bgApp,
                  border: `1.5px solid ${on ? colors.primary : colors.cardBorder}`,
                  color: on ? colors.primary : colors.ink, fontSize: 13, fontWeight: 600,
                }}
              >
                <span style={{ width: 20, height: 20, borderRadius: 6, background: tint(c.color), color: c.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 9 }}>{c.mono}</span>
                {c.label}
                {on && <span style={{ marginLeft: 2 }}>✓</span>}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Why this is flagged">
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: colors.textSecondary }}>{d.whyText}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: colors.textTertiary, borderTop: `1px solid ${colors.divider}`, paddingTop: 10 }}>
          <span>First seen {d.firstSeenLabel}</span>
          <span>Latest {d.lastSeenLabel}</span>
        </div>
      </Card>

      <Card title="Last 6 months">
        <TrendChart trend={d.trend} color={d.color} />
      </Card>

      <Card title={`All transactions (${d.count})`}>
        <TxnList txns={d.txns} color={d.color} mono={d.mono} onTap={openCategorySheet} />
      </Card>
    </Shell>
  );
}

function TrendChart({ trend, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 108, padding: '4px 2px 0' }}>
      {trend.map((m, i) => {
        const current = i === trend.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontSize: 10, color: colors.textTertiary, fontWeight: 600 }}>{m.total > 0 ? shortAmt(m.total) : ''}</div>
            <div style={{ width: '100%', maxWidth: 34, height: `${m.pct}%`, minHeight: m.total > 0 ? 4 : 0, borderRadius: 6, background: current ? color : tint(color) }} />
            <div style={{ fontSize: 11, color: current ? colors.ink : colors.textSecondary, fontWeight: current ? 700 : 500 }}>{m.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function TxnList({ txns, color, mono, onTap }) {
  if (!txns.length) return <div style={{ fontSize: 13.5, color: colors.textTertiary }}>None yet</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {txns.map((t) => (
        <button
          key={t.id}
          onClick={() => onTap(t.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 0', cursor: 'pointer', textAlign: 'left', width: '100%', borderBottom: `1px solid ${colors.divider}` }}
        >
          <div style={{ width: 34, height: 34, borderRadius: 11, background: tint(color), color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
            {mono}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary }}>{txnWhen(t)}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>−{fmt(t.amount)}</div>
        </button>
      ))}
    </div>
  );
}

function Shell({ title, mono, color, onBack, children }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={onBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        {mono && (
          <div style={{ width: 30, height: 30, borderRadius: 9, background: tint(color), color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
            {mono}
          </div>
        )}
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>{title}</div>
      </div>
      {children}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>{title}</div>
      {children}
    </div>
  );
}

// Compact money for chart tops: 12.3k, 1.2L. Full precision lives elsewhere.
function shortAmt(n) {
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

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
