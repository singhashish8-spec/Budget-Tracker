import { useEffect, useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, filterTransactions } from '../state/selectors';
import { listSmsTextByTxn } from '../db/repo';
import Amount from '../components/Amount';
import Collapse from '../components/Collapse';

export default function TransactionsScreen() {
  const { state, set, openCategorySheet, categorizeTxn, deleteTransaction } = useApp();
  const { txns, categories, search, filter, disabledCats } = state;
  const alerts = alertCount(txns);
  const view = filterTransactions(txns, { search, filter, categories });

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
  // Lazily load the stored message text (txn_id → [raw_sms]) the first time it's
  // needed — when messages are switched on or any row is expanded.
  const [smsMap, setSmsMap] = useState(null);
  useEffect(() => {
    if ((showMessages || expandedId) && smsMap === null) {
      listSmsTextByTxn().then(setSmsMap).catch(() => setSmsMap({}));
    }
  }, [showMessages, expandedId, smsMap]);

  const pickCats = categories.filter((c) => c.id !== 'income' && !disabledCats.includes(c.id));

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, padding: '0 4px' }}>Transactions</div>
      <input
        value={search}
        onChange={(e) => set({ search: e.target.value })}
        placeholder="Search name, category or amount"
        style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '12px 18px', fontSize: 14.5, color: colors.ink }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => set({ filter: 'all' })}
          style={{ padding: '8px 16px', borderRadius: 100, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: filter === 'all' ? colors.primary : colors.cardSurface, color: filter === 'all' ? colors.onPrimary : colors.ink, border: `1px solid ${filter === 'all' ? colors.primary : colors.cardBorder}` }}
        >
          All
        </button>
        <button
          onClick={() => set({ filter: 'review' })}
          style={{ padding: '8px 16px', borderRadius: 100, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: filter === 'review' ? colors.danger : colors.cardSurface, color: filter === 'review' ? '#FFFFFF' : colors.ink, border: `1px solid ${filter === 'review' ? colors.danger : colors.cardBorder}` }}
        >
          Needs review · {alerts}
        </button>
        <button
          onClick={toggleMessages}
          title="Show the full bank message under each transaction"
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: showMessages ? colors.primaryTint : colors.cardSurface, color: showMessages ? colors.primary : colors.textSecondary, border: `1px solid ${showMessages ? colors.primary : colors.cardBorder}` }}
        >
          <span style={{ width: 26, height: 15, borderRadius: 100, background: showMessages ? colors.primary : colors.track, position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: showMessages ? 13 : 2, width: 11, height: 11, borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.15s' }} />
          </span>
          Messages
        </button>
      </div>

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '4px 16px', display: 'flex', flexDirection: 'column' }}>
        {view.map((t) => {
          const cat = categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income = t.type === 'income';
          const msgs = smsMap?.[t.id];
          const hasMsg = Array.isArray(msgs) && msgs.length > 0;
          const isOpen = expandedId === t.id;
          return (
            <div key={t.id} style={{ borderBottom: `1px solid ${colors.divider}` }}>
              <button
                onClick={() => setExpandedId(isOpen ? null : t.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', cursor: 'pointer', textAlign: 'left', width: '100%' }}
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

              {/* Message shown inline under the row when the toggle is on (and the
                  row isn't expanded — the expander shows it too). */}
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
                          onClick={() => { categorizeTxn(t.id, c.id); setExpandedId(null); }}
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
                    <button onClick={() => openCategorySheet(t.id)} style={{ flex: 1, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, color: colors.ink, borderRadius: 100, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit details</button>
                    <button onClick={() => { deleteTransaction(t.id); setExpandedId(null); }} style={{ flex: 1, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, color: colors.dangerDark, borderRadius: 100, padding: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>
              </Collapse>
            </div>
          );
        })}
        {view.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>No transactions match</div>}
      </div>
      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Tap a transaction to expand it · toggle Messages to show the bank text</div>
    </div>
  );
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
