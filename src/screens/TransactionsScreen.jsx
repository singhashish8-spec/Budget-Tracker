import { useEffect, useMemo, useState } from 'react';
import { colors, fonts, radii, tint, tracking, type } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, filterTransactions } from '../state/selectors';
import { listSmsTextByTxn } from '../db/repo';
import * as haptics from '../services/haptics';
import Amount from '../components/Amount';
import Collapse from '../components/Collapse';
import { Screen, Card, Chip, EmptyState } from '../components/ui';

const SEARCH_DEBOUNCE_MS = 180;

// These filters read as a segmented control — the active one is a solid fill,
// not the tinted outline Chip uses by default — so they pass an explicit tone.
const filterTone = (on, accent) => (on
  ? { bg: accent, fg: '#FFFFFF', border: accent }
  : { bg: colors.cardSurface, fg: colors.ink, border: colors.cardBorder });

export default function TransactionsScreen() {
  const { state, set, openCategorySheet, categorizeTxn, deleteTransaction, splitTransaction } = useApp();
  const { txns, categories, search, filter, disabledCats } = state;

  // The search box types into local state and only lands in the shared app
  // context after a pause. `search` lives in the one global context, so every
  // keystroke used to re-render every screen that reads useApp() AND re-run the
  // full-array filter below — the single worst typing path in the app.
  const [draft, setDraft] = useState(search);
  useEffect(() => {
    if (draft === search) return undefined;
    const id = setTimeout(() => set({ search: draft }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  // Keep the box in step when something else clears the search (e.g. the review
  // shortcut from Home).
  useEffect(() => { setDraft(search); }, [search]);

  const alerts = useMemo(() => alertCount(txns), [txns]);
  const view = useMemo(
    () => filterTransactions(txns, { search, filter, categories }),
    [txns, search, filter, categories],
  );

  // "Show full message" is a view preference (default off), kept in localStorage
  // so it holds across launches without touching the data layer.
  const [showMessages, setShowMessages] = useState(() => {
    try { return localStorage.getItem('bt-txn-messages') === '1'; } catch { return false; }
  });
  const toggleMessages = () => {
    setShowMessages((v) => {
      const n = !v;
      try { localStorage.setItem('bt-txn-messages', n ? '1' : '0'); } catch { /* ignore */ }
      return n;
    });
  };

  const [expandedId, setExpandedId] = useState(null);
  const [collapsedDays, setCollapsedDays] = useState({});
  // Lazily load the stored message text (txn_id → [raw_sms]) the first time it's
  // needed — when messages are switched on or any row is expanded.
  const [smsMap, setSmsMap] = useState(null);
  useEffect(() => {
    if ((showMessages || expandedId) && smsMap === null) {
      listSmsTextByTxn().then(setSmsMap).catch(() => setSmsMap({}));
    }
  }, [showMessages, expandedId, smsMap]);

  const pickCats = useMemo(
    () => categories.filter((c) => c.id !== 'income' && !disabledCats.includes(c.id)),
    [categories, disabledCats],
  );

  // Group the (already date-sorted) list into collapsible day sections.
  const groups = useMemo(() => {
    const now = new Date();
    const out = [];
    const gmap = {};
    for (const t of view) {
      const b = dayBucket(t, now);
      if (!gmap[b.key]) { gmap[b.key] = { key: b.key, label: b.label, items: [] }; out.push(gmap[b.key]); }
      gmap[b.key].items.push(t);
    }
    return out;
  }, [view]);

  const renderRow = (t) => {
    const cat = categories.find((c) => c.id === t.cat);
    const uncat = !t.cat;
    const income = t.type === 'income';
    const msgs = smsMap?.[t.id];
    const hasMsg = Array.isArray(msgs) && msgs.length > 0;
    const isOpen = expandedId === t.id;
    return (
      <div key={t.id} style={{ borderBottom: `1px solid ${colors.divider}` }}>
        <button
          onClick={() => { haptics.select(); setExpandedId(isOpen ? null : t.id); }}
          aria-expanded={isOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', cursor: 'pointer', textAlign: 'left', width: '100%', color: colors.ink }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 12, background: uncat ? colors.dangerTint : tint(cat.color), color: uncat ? colors.danger : cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
            {uncat ? '?' : cat.mono}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
            <div style={{ fontSize: 12.5, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {txnWhen(t)}{!uncat && cat ? ` · ${cat.label}` : ''}
            </div>
            {uncat && (
              <div style={{ fontSize: 12, color: colors.danger, fontWeight: 600 }}>Needs review — tap to categorise</div>
            )}
            {t.note && !isOpen && (
              <div style={{ fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{t.note}”</div>
            )}
          </div>
          <Amount style={{ fontSize: 14.5, fontWeight: 600, color: income ? colors.primary : colors.ink }}>
            {income ? '+' : '−'}{fmt(t.amount)}
          </Amount>
          <svg className="bt-chev" data-open={isOpen ? '1' : '0'} width="11" height="7" viewBox="0 0 11 7" style={{ flexShrink: 0, color: colors.textTertiary }}>
            <path d="M1 1l4.5 4L10 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {showMessages && hasMsg && !isOpen && (
          <div style={msgBox}>{msgs.join('\n\n— — —\n\n')}</div>
        )}

        <Collapse open={isOpen}>
          <div style={{ padding: '2px 0 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hasMsg && <div style={msgBox}>{msgs.join('\n\n— — —\n\n')}</div>}
            {t.note && <div style={{ fontSize: 12.5, color: colors.textSecondary, fontStyle: 'italic' }}>“{t.note}”</div>}
            <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textSecondary }}>Set category</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {pickCats.map((c) => {
                const on = t.cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { haptics.success(); categorizeTxn(t.id, c.id); setExpandedId(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, padding: '7px 12px', borderRadius: 100, cursor: 'pointer', background: on ? colors.primaryTint : colors.bgApp, border: `1.5px solid ${on ? colors.primary : colors.cardBorder}`, color: on ? colors.primary : colors.ink, fontSize: 13, fontWeight: 600 }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: tint(c.color), color: c.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 8.5 }}>{c.mono}</span>
                    {c.label}
                    {on && <span style={{ marginLeft: 1 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { haptics.select(); openCategorySheet(t.id); }} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Edit details</button>
              {/* splitTransaction toasts on success, and the toast carries the haptic. */}
              <button onClick={() => { splitTransaction(t.id); setExpandedId(null); }} style={{ flex: 1, background: colors.primaryTint, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Split 50/50</button>
              <button onClick={() => { haptics.error(); deleteTransaction(t.id); setExpandedId(null); }} style={{ flex: 1, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.dangerDark, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </Collapse>
      </div>
    );
  };

  return (
    <Screen gap={12}>
      <div style={{ fontFamily: fonts.heading, fontSize: type.screen, fontWeight: 700, letterSpacing: tracking.screen, padding: '0 4px' }}>Transactions</div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Search name, category or amount"
        aria-label="Search transactions"
        style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: radii.pill, padding: '12px 18px', fontSize: type.callout, color: colors.ink }}
      />
      {/* The filters can't fit a phone's width — "Needs review · 393" alone is
          most of it — so they scroll in their own strip. The Messages toggle
          sits outside that strip so it stays reachable without scrolling.
          minWidth:0 is what lets the strip shrink below its content width;
          without it the row pushes the whole screen wide. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <div className="bt-hscroll" style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0, padding: '2px 0' }}>
          {/* Chip owns its own select() tick — don't add another here. */}
          <Chip
            label="All"
            selected={filter === 'all'}
            onClick={() => set({ filter: 'all' })}
            tone={filterTone(filter === 'all', colors.primary)}
            style={{ flexShrink: 0 }}
          />
          <Chip
            label="Business"
            selected={filter === 'business'}
            onClick={() => set({ filter: filter === 'business' ? 'all' : 'business' })}
            tone={filterTone(filter === 'business', colors.primary)}
            style={{ flexShrink: 0 }}
          />
          <Chip
            label={`Needs review · ${alerts}`}
            selected={filter === 'review'}
            onClick={() => set({ filter: 'review' })}
            tone={filterTone(filter === 'review', colors.danger)}
            style={{ flexShrink: 0 }}
          />
        </div>
        <button
          onClick={() => { haptics.select(); toggleMessages(); }}
          aria-pressed={showMessages}
          title="Show the full bank message under each transaction"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: showMessages ? colors.primaryTint : colors.cardSurface, color: showMessages ? colors.primary : colors.textSecondary, border: `1px solid ${showMessages ? colors.primary : colors.cardBorder}` }}
        >
          <span style={{ width: 26, height: 15, borderRadius: 100, background: showMessages ? colors.primary : colors.track, position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: showMessages ? 13 : 2, width: 11, height: 11, borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.15s' }} />
          </span>
          Messages
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map((g) => {
          const collapsed = !!collapsedDays[g.key];
          return (
            <Card key={g.key} tight padded={false} style={{ padding: '2px 16px' }}>
              <button
                onClick={() => { haptics.select(); setCollapsedDays((s) => ({ ...s, [g.key]: !s[g.key] })); }}
                aria-expanded={!collapsed}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', cursor: 'pointer', padding: '10px 0' }}
              >
                <span style={{ fontSize: type.footnote, fontWeight: 700, color: colors.textSecondary }}>{g.label}</span>
                <span style={{ fontSize: type.footnote, color: colors.textTertiary }}>· {g.items.length}</span>
                <svg className="bt-chev" data-open={collapsed ? '0' : '1'} width="11" height="7" viewBox="0 0 11 7" style={{ marginLeft: 'auto', color: colors.textTertiary }}>
                  <path d="M1 1l4.5 4L10 1" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <Collapse open={!collapsed}>
                <div>{g.items.map(renderRow)}</div>
              </Collapse>
            </Card>
          );
        })}
        {view.length === 0 && (
          <Card style={{ alignItems: 'center', padding: '28px 16px' }}>
            <EmptyState
              text={search || filter !== 'all' ? 'No transactions match this search or filter.' : 'No transactions yet — tap + to add one.'}
              action={search || filter !== 'all' ? 'Clear filters' : undefined}
              onAction={search || filter !== 'all' ? () => { setDraft(''); set({ search: '', filter: 'all' }); } : undefined}
              style={{ alignItems: 'center', textAlign: 'center' }}
            />
          </Card>
        )}
      </div>
      <div style={{ fontSize: type.footnote, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Tap a day to collapse it · tap a transaction to expand it</div>
    </Screen>
  );
}

// Which day a transaction belongs to, for the collapsible date groups. Prefers
// the real occurred/SMS time; falls back to the display date string when a row
// has no timestamp at all.
function dayBucket(t, now) {
  const ms = t.occurred_at || t.sms_date || t.created_at;
  if (!ms) return { key: t.date || 'earlier', label: t.date || 'Earlier' };
  const d = new Date(ms);
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const daysApart = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  let label;
  if (daysApart === 0) label = 'Today';
  else if (daysApart === 1) label = 'Yesterday';
  else label = d.toLocaleDateString('en-IN', d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  return { key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, label };
}

const msgBox = {
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textSecondary,
  background: colors.bgApp,
  border: `1px solid ${colors.divider}`,
  borderRadius: 12,
  padding: '9px 11px',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};
