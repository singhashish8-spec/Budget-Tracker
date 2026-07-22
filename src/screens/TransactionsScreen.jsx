import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { txnWhen } from '../utils/date';
import { useApp } from '../state/AppContext';
import { alertCount, filterTransactions } from '../state/selectors';

export default function TransactionsScreen() {
  const { state, set, openCategorySheet } = useApp();
  const { txns, categories, search, filter } = state;
  const alerts = alertCount(txns);
  const view = filterTransactions(txns, { search, filter });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, padding: '0 4px' }}>Transactions</div>
      <input
        value={search}
        onChange={(e) => set({ search: e.target.value })}
        placeholder="Search merchant or note"
        style={{ width: '100%', background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 100, padding: '12px 18px', fontSize: 14.5, color: colors.ink }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => set({ filter: 'all' })}
          style={{
            padding: '8px 16px',
            borderRadius: 100,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'all' ? colors.ink : colors.cardSurface,
            color: filter === 'all' ? colors.onPrimary : colors.ink,
            border: `1px solid ${filter === 'all' ? colors.ink : colors.cardBorder}`,
          }}
        >
          All
        </button>
        <button
          onClick={() => set({ filter: 'review' })}
          style={{
            padding: '8px 16px',
            borderRadius: 100,
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'pointer',
            background: filter === 'review' ? colors.danger : colors.cardSurface,
            color: filter === 'review' ? '#FFFFFF' : colors.ink,
            border: `1px solid ${filter === 'review' ? colors.danger : colors.cardBorder}`,
          }}
        >
          Needs review · {alerts}
        </button>
      </div>
      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '8px 16px', display: 'flex', flexDirection: 'column' }}>
        {view.map((t) => {
          const cat = categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income = t.type === 'income';
          return (
            <button
              key={t.id}
              onClick={() => openCategorySheet(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${colors.divider}`, textAlign: 'left', width: '100%' }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
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
                <div style={{ fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
                {/* Date and time always show. They used to be swapped out for
                    the review prompt, so every uncategorised row — which is
                    most of them — appeared with no date at all. */}
                <div style={{ fontSize: 12.5, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {txnWhen(t)}
                  {!uncat && cat ? ` · ${cat.label}` : ''}
                </div>
                {uncat && (
                  <div style={{ fontSize: 12, color: colors.danger, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Needs review — tap to categorise
                  </div>
                )}
                {t.note && (
                  <div style={{ fontSize: 12, color: colors.textTertiary, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    “{t.note}”
                  </div>
                )}
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: income ? colors.primary : colors.ink }}>
                {income ? '+' : '−'}{fmt(t.amount)}
              </div>
            </button>
          );
        })}
        {view.length === 0 && <div style={{ padding: '28px 0', textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>No transactions match</div>}
      </div>
      <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: '4px 20px' }}>Tap any transaction to change its category</div>
    </div>
  );
}
