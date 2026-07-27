import { colors, radii, shadow } from '../../theme/tokens';

// The app's surface. This markup was hand-typed in fourteen screen files before
// it lived here, which is why the UI was expensive to change: every visual
// tweak cost fourteen edits.
//
// IMPORTANT: the background must stay an INLINE style that paints
// colors.cardSurface (i.e. `var(--c-cardSurface)`). Frosted-glass mode attaches
// its backdrop-filter with the attribute hook
// `:root[data-surface='glass'] [style*="--c-cardSurface"]` (index.css), which
// matches on the inline style string. Move this to a CSS class and glass mode
// silently stops blurring.
// `elevated` is opt-in and OFF by default, deliberately. The app is uniformly
// flat (1px border, no shadow) and only two screens use this primitive so far —
// defaulting elevation on would make Home and Transactions float while Budgets,
// Goals, Insights and the rest stayed flat, which reads as unfinished rather
// than designed. Flip the default once every screen renders through <Card>.
export default function Card({
  as: Tag = 'div',
  tight = false,
  padded = true,
  elevated = false,
  style,
  children,
  ...rest
}) {
  return (
    <Tag
      style={{
        background: colors.cardSurface,
        border: `1px solid ${colors.cardBorder}`,
        borderRadius: tight ? radii.cardTight : radii.card,
        padding: padded ? (tight ? '14px 14px' : '18px 16px') : 0,
        boxShadow: elevated ? shadow.card : 'none',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
