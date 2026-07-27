import { colors, radii } from '../../theme/tokens';

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
// Elevation is deliberately NOT set here. It comes from the `--c-cardShadow`
// rule in index.css, which matches on the inline card-surface style below — so
// depth is identical whether a screen renders through <Card> or still writes
// its card by hand, and each theme/skin decides how much of it there is.
// Setting boxShadow inline here would override that and desync the two.
export default function Card({
  as: Tag = 'div',
  tight = false,
  padded = true,
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
