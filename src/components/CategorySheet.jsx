import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function CategorySheet() {
  const { state, closeCategorySheet, setTxnCategory, addCategory } = useApp();
  const [newCat, setNewCat] = useState('');
  const open = !!state.sheetFor;
  if (!open) return null;

  const txn = state.txns.find((t) => t.id === state.sheetFor.id);

  const submitNewCat = async () => {
    if (!newCat.trim()) return;
    await addCategory(newCat);
    setNewCat('');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={closeCategorySheet} style={{ position: 'absolute', inset: 0, background: 'rgba(27,31,35,0.4)' }} />
      <div
        style={{
          position: 'relative',
          background: colors.bgApp,
          borderRadius: '24px 24px 0 0',
          padding: '20px 16px 32px',
          maxHeight: '72%',
          overflowY: 'auto',
          animation: 'sheetup 0.22s ease-out',
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 100, background: colors.track, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Pick a category</div>
        {txn && (
          <div style={{ fontSize: 13.5, color: colors.textSecondary, marginBottom: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {txn.merchant}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {state.categories
            .filter((c) => c.id !== 'income')
            .map((c) => (
              <button
                key={c.id}
                onClick={() => setTxnCategory(c.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  background: colors.cardSurface,
                  border: `1px solid ${txn?.cat === c.id ? colors.primary : colors.cardBorder}`,
                  borderRadius: 14,
                  padding: '10px 11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    background: tint(c.color),
                    color: c.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {c.mono}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.label}</div>
              </button>
            ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="Add your own category"
            style={{
              flex: 1,
              background: colors.cardSurface,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 100,
              padding: '11px 16px',
              fontSize: 14,
              color: colors.ink,
            }}
          />
          <button
            onClick={submitNewCat}
            style={{
              background: colors.primary,
              color: colors.bgApp,
              borderRadius: 100,
              padding: '11px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
