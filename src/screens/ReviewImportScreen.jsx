import { useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { fmt } from '../utils/currency';
import { useApp } from '../state/AppContext';
import Amount from '../components/Amount';
import Sheet from '../components/Sheet';

export default function ReviewImportScreen() {
  const { state, cancelReview, confirmReview, setReviewCategory } = useApp();
  const [editingId, setEditingId] = useState(null);
  const imported = state.reviewImported || [];
  const needCount = imported.filter((t) => !t.cat).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '74px 16px 120px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={cancelReview} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Review import</div>
      </div>

      <div style={{ background: colors.successTint, border: `1px solid ${colors.successBorder}`, borderRadius: 16, padding: '13px 15px', fontSize: 14 }}>
        <span style={{ fontWeight: 600, color: colors.primary }}>{imported.length} transactions found</span>
        <span style={{ color: colors.successText }}> in {state.reviewSource || 'your file'}</span>
      </div>

      {needCount > 0 && (
        <div style={{ background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: 16, padding: '13px 15px', fontSize: 14 }}>
          <span style={{ fontWeight: 600, color: colors.danger }}>{needCount} need your help</span>
          <span style={{ color: '#B96A5B' }}> — tap the red ones to pick a category</span>
        </div>
      )}

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '8px 16px', display: 'flex', flexDirection: 'column' }}>
        {imported.map((t) => {
          const cat = state.categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income = t.type === 'income';
          return (
            <button
              key={t.id}
              onClick={() => setEditingId(t.id)}
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
                <div style={{ fontSize: 12.5, color: uncat ? colors.danger : colors.textSecondary, fontWeight: uncat ? 600 : 400 }}>
                  {uncat ? 'Needs review — tap to categorise' : `${t.date} · ${cat.label}`}
                </div>
              </div>
              <Amount style={{ fontSize: 14.5, fontWeight: 600, color: income ? colors.primary : colors.ink }}>
                {income ? '+' : '−'}{fmt(t.amount)}
              </Amount>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <button
          onClick={confirmReview}
          style={{
            background: needCount > 0 ? colors.textSecondary : colors.primary,
            color: colors.onPrimary,
            borderRadius: 100,
            padding: 16,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 8px 24px rgba(16,36,28,0.25)',
          }}
        >
          {needCount > 0 ? `Add anyway (${needCount} still flagged)` : 'Add to my transactions'}
        </button>
      </div>

      {editingId && (
        <InlineCategorySheet
          categories={state.categories}
          current={imported.find((t) => t.id === editingId)}
          onPick={(catId) => {
            setReviewCategory(editingId, catId);
            setEditingId(null);
          }}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function InlineCategorySheet({ categories, current, onPick, onClose }) {
  return (
    <Sheet
      onClose={onClose}
      header={
        <>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Pick a category</div>
          {current && <div style={{ fontSize: 13.5, color: colors.textSecondary, marginTop: 2 }}>{current.merchant}</div>}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {categories
          .filter((c) => c.id !== 'income')
          .map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, background: colors.cardSurface, border: `1px solid ${current?.cat === c.id ? colors.primary : colors.cardBorder}`, borderRadius: 14, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 9, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {c.mono}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.label}</div>
            </button>
          ))}
      </div>
    </Sheet>
  );
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
