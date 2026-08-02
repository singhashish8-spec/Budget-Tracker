import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

// These filters read as a segmented control: the active chip's own fill stays
// transparent because a single shared pill (rendered behind the row, see
// segRect below) supplies the solid colour and slides between options — the
// chip itself only ever carries the border/text needed while unselected.
const filterTone = (on) => (on
  ? { bg: 'transparent', fg: '#FFFFFF', border: 'transparent' }
  : { bg: colors.cardSurface, fg: colors.ink, border: colors.cardBorder });

export default function TransactionsScreen() {
  const { state, set, openCategorySheet, categorizeTxn, deleteTransaction, splitTransaction, scanSms } = useApp();
  const { txns, categories, search, filter, disabledCats } = state;

  // The search box types into local state and only lands in the shared app
  // context after a pause. `search` lives in the one global context, so every
  // keystroke used to re-render every screen that reads useApp() AND re-run the
  // full-array filter below — the single worst typing path in the app.
  const [draft, setDraft] = useState(search);
  const searchInputRef = useRef(null);
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

  // The three filter chips read as a segmented control, so they should share
  // one selection surface that slides between them rather than each chip
  // repainting its own fill independently. Chips are variable-width (the
  // review count changes the "Needs review · N" label's length) and live in a
  // horizontally-scrolling strip, so the pill's position can't be hard-coded —
  // it's measured off the real DOM via refs, same as the tab bar's indicator
  // would be if its slots weren't equal-width.
  const segWrapRef = useRef(null);
  const segRefs = useRef({});
  const [segRect, setSegRect] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      const wrap = segWrapRef.current;
      const el = segRefs.current[filter];
      if (!wrap || !el) return;
      const wrapRect = wrap.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setSegRect({ left: elRect.left - wrapRect.left + wrap.scrollLeft, width: elRect.width });
    };
    measure();
    // The strip can resize under rotation, font-load reflow, or a sidebar
    // opening — not just a filter change or the review count ticking.
    const ro = new ResizeObserver(measure);
    if (segWrapRef.current) ro.observe(segWrapRef.current);
    return () => ro.disconnect();
  }, [filter, alerts]);
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
  // Which row currently has its swipe actions open — separate from expandedId
  // (the tap-to-expand accordion), since a row can have either, both, or
  // neither open at once. Only one row's swipe actions stay open at a time,
  // the same rule Mail/Messages use.
  const [openSwipeId, setOpenSwipeId] = useState(null);
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

  // Swipe is an ADDITIONAL fast path onto the existing tap-to-expand panel
  // below, not a replacement for it — the panel has more in it (the full
  // category grid, split, edit details) than two swipe actions could hold, so
  // it stays exactly as it was. Swipe just gets you to the two most repeated
  // single actions — open the categorize sheet, or delete — in one gesture
  // instead of three taps.
  const renderRow = (t) => (
    <TxnRow
      key={t.id}
      t={t}
      cat={categories.find((c) => c.id === t.cat)}
      isOpen={expandedId === t.id}
      onToggleExpand={() => { haptics.select(); setExpandedId(expandedId === t.id ? null : t.id); }}
      hasMsg={Array.isArray(smsMap?.[t.id]) && smsMap[t.id].length > 0}
      msgs={smsMap?.[t.id]}
      showMessages={showMessages}
      pickCats={pickCats}
      onCategorize={(catId) => { haptics.success(); categorizeTxn(t.id, catId); setExpandedId(null); }}
      onOpenSheet={() => { haptics.select(); openCategorySheet(t.id); }}
      onSplit={() => { splitTransaction(t.id); setExpandedId(null); }}
      onDelete={() => { haptics.error(); deleteTransaction(t.id); setExpandedId(null); }}
      swipeOpen={openSwipeId === t.id}
      onSwipeOpen={() => setOpenSwipeId(t.id)}
      onSwipeClose={() => setOpenSwipeId((id) => (id === t.id ? null : id))}
    />
  );

  return (
    <Screen gap={12} onRefresh={() => scanSms({ silent: false })}>
      <div style={{ fontFamily: fonts.heading, fontSize: type.screen, fontWeight: 700, letterSpacing: tracking.screen, padding: '0 4px' }}>Transactions</div>
      <div style={{ position: 'relative' }}>
        <input
          ref={searchInputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search name, category or amount"
          aria-label="Search transactions"
          style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: radii.pill, padding: `12px ${draft ? 42 : 18}px 12px 18px`, fontSize: type.callout, color: colors.ink }}
        />
        {/* Every native search field clears itself with a trailing ×; this one
            had no way to but a manual select-all-backspace. Only mounted once
            there's text — an empty field showing a disabled × is worse than no
            × at all. */}
        {draft && (
          <button
            onClick={() => { haptics.select(); setDraft(''); searchInputRef.current?.focus(); }}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              width: 26, height: 26, borderRadius: '50%', background: colors.track,
              color: colors.textSecondary, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', animation: 'rise 0.15s ease-out',
            }}
          >
            ✕
          </button>
        )}
      </div>
      {/* The filters can't fit a phone's width — "Needs review · 393" alone is
          most of it — so they scroll in their own strip. The Messages toggle
          sits outside that strip so it stays reachable without scrolling.
          minWidth:0 is what lets the strip shrink below its content width;
          without it the row pushes the whole screen wide. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <div ref={segWrapRef} className="bt-hscroll" style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0, padding: '2px 0', position: 'relative' }}>
          {/* The shared selection surface. Absolutely positioned and measured
              off the active chip's own rect (see segRect above) — the chips
              stay real DOM elements with real widths, this just paints one
              solid pill behind whichever one is active and slides it there. */}
          {segRect && (
            <div
              aria-hidden="true"
              className="bt-seg-pill"
              style={{
                position: 'absolute',
                top: 2,
                bottom: 2,
                left: segRect.left,
                width: segRect.width,
                borderRadius: radii.pill,
                background: filter === 'review' ? colors.danger : colors.primary,
                transition: 'left 0.26s var(--ease-ios), width 0.26s var(--ease-ios), background-color 0.2s ease',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Chip owns its own select() tick — don't add another here. */}
          <Chip
            ref={(el) => { segRefs.current.all = el; }}
            label="All"
            selected={filter === 'all'}
            onClick={() => set({ filter: 'all' })}
            tone={filterTone(filter === 'all')}
            style={{ flexShrink: 0, position: 'relative' }}
          />
          <Chip
            ref={(el) => { segRefs.current.business = el; }}
            label="Business"
            selected={filter === 'business'}
            onClick={() => set({ filter: filter === 'business' ? 'all' : 'business' })}
            tone={filterTone(filter === 'business')}
            style={{ flexShrink: 0, position: 'relative' }}
          />
          <Chip
            ref={(el) => { segRefs.current.review = el; }}
            label={`Needs review · ${alerts}`}
            selected={filter === 'review'}
            onClick={() => set({ filter: 'review' })}
            tone={filterTone(filter === 'review')}
            style={{ flexShrink: 0, position: 'relative' }}
          />
        </div>
        <button
          onClick={() => { haptics.select(); toggleMessages(); }}
          aria-pressed={showMessages}
          title="Show the full bank message under each transaction"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: showMessages ? colors.primaryTint : colors.cardSurface, color: showMessages ? colors.primary : colors.textSecondary, border: `1px solid ${showMessages ? colors.primary : colors.cardBorder}` }}
        >
          <span style={{ width: 26, height: 15, borderRadius: 100, background: showMessages ? colors.primary : colors.track, position: 'relative', flexShrink: 0 }}>
            {/* transform, not left — same fix as Settings' ToggleRow (#13):
                left forces layout on every frame, transform is composite-only. */}
            <span style={{ position: 'absolute', top: 2, left: 2, width: 11, height: 11, borderRadius: '50%', background: '#FFFFFF', transform: `translateX(${showMessages ? 11 : 0}px)`, transition: 'transform 0.2s cubic-bezier(0.34, 1.4, 0.6, 1)' }} />
          </span>
          Messages
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map((g) => {
          const collapsed = !!collapsedDays[g.key];
          return (
            // content-visibility lets the browser skip style, layout and paint
            // for any day group scrolled out of view — on a long history that
            // is most of the screen's work, done for rows nobody is looking at.
            // contain-intrinsic-size gives it a height to reserve while a group
            // is skipped, so the scrollbar stays stable and scrolling doesn't
            // jump as groups come into range. The estimate is the header plus
            // ~64px per row; being approximate is fine, being absent is not.
            <Card
              key={g.key}
              tight
              padded={false}
              style={{
                padding: '2px 16px',
                contentVisibility: 'auto',
                containIntrinsicSize: `auto ${40 + (collapsed ? 0 : g.items.length * 64)}px`,
              }}
            >
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
            />
          </Card>
        )}
      </div>
      <div style={{ fontSize: type.footnote, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Tap a day to collapse it · tap a transaction to expand it · swipe left to categorise or delete</div>
    </Screen>
  );
}

// How far a row travels to fully reveal its two actions, and the drag distance
// past which a release commits to open rather than snapping shut.
const SWIPE_ACTION_W = 74;
const SWIPE_OPEN_X = -(SWIPE_ACTION_W * 2);
const SWIPE_COMMIT_X = SWIPE_OPEN_X * 0.4;
// A real drag has to move at least this many px before it counts as one —
// under this, a shaky tap could rob the row's own onClick (which drives the
// tap-to-expand panel) of the click it should have gotten.
const SWIPE_INTENT_PX = 8;

// A transaction row that can be swiped left to reveal Categorize/Delete, on
// top of its existing tap-to-expand behaviour (untouched below). Split out as
// its own component — not a plain helper called inside .map() — because
// per-row drag position is real component state, and hooks can only live in
// something React actually renders as a component.
function TxnRow({
  t, cat, isOpen, onToggleExpand, hasMsg, msgs, showMessages, pickCats,
  onCategorize, onOpenSheet, onSplit, onDelete, swipeOpen, onSwipeOpen, onSwipeClose,
}) {
  const uncat = !t.cat;
  const income = t.type === 'income';

  const contentRef = useRef(null);
  const drag = useRef({ active: false, startX: 0, startTX: 0, moved: false });
  const [dragX, setDragX] = useState(0);

  // A row whose actions were left open by a previous render (another row just
  // opened, closing this one) eases shut instead of snapping — same motion a
  // manual swipe-closed gets.
  useEffect(() => {
    if (!swipeOpen && dragX !== 0) setDragX(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipeOpen]);

  const clamp = (x) => {
    if (x > 0) return x * 0.25; // rubber-band if dragged the wrong way
    if (x < SWIPE_OPEN_X) return SWIPE_OPEN_X + (x - SWIPE_OPEN_X) * 0.25;
    return x;
  };

  const onPointerDown = (e) => {
    drag.current = { active: true, startX: e.clientX, startTX: dragX, moved: false };
    contentRef.current?.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > SWIPE_INTENT_PX) drag.current.moved = true;
    if (!drag.current.moved) return;
    setDragX(clamp(drag.current.startTX + dx));
  };
  const onPointerUp = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (!drag.current.moved) return; // a plain tap — let onClick handle it
    if (dragX < SWIPE_COMMIT_X) {
      setDragX(SWIPE_OPEN_X);
      onSwipeOpen();
    } else {
      setDragX(0);
      onSwipeClose();
    }
  };

  return (
    <div style={{ borderBottom: `1px solid ${colors.divider}`, position: 'relative', overflow: 'hidden' }}>
      {/* Actions sit behind the content, revealed as it slides left — sized to
          take over exactly as much of the row as they need, so a partial drag
          previews proportionally rather than popping in at full width. */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: SWIPE_ACTION_W * 2, display: 'flex' }} aria-hidden={dragX === 0}>
        <button
          onClick={() => { setDragX(0); onSwipeClose(); onOpenSheet(); }}
          style={{ width: SWIPE_ACTION_W, background: colors.primary, color: '#FFFFFF', border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Categorize
        </button>
        <button
          onClick={() => { setDragX(0); onSwipeClose(); onDelete(); }}
          style={{ width: SWIPE_ACTION_W, background: colors.danger, color: '#FFFFFF', border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Delete
        </button>
      </div>

      <div
        ref={contentRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative', background: colors.bgApp,
          transform: `translateX(${dragX}px)`,
          transition: drag.current.active ? 'none' : 'transform 0.3s var(--ease-ios)',
          touchAction: 'pan-y',
        }}
      >
        <button
          onClick={() => {
            // A drag that just released shouldn't also fire the tap-to-expand
            // toggle — onPointerUp already used the gesture for something else.
            if (drag.current.moved) { drag.current.moved = false; return; }
            onToggleExpand();
          }}
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
      </div>

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
                  onClick={() => onCategorize(c.id)}
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
            <button onClick={onOpenSheet} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Edit details</button>
            {/* splitTransaction toasts on success, and the toast carries the haptic. */}
            <button onClick={onSplit} style={{ flex: 1, background: colors.primaryTint, border: `1px solid ${colors.primary}`, color: colors.primary, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Split 50/50</button>
            <button onClick={onDelete} style={{ flex: 1, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.dangerDark, borderRadius: radii.pill, padding: 11, fontSize: type.body, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      </Collapse>
    </div>
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
