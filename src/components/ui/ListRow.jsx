import { colors, metrics, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

// The disclosure chevron iOS puts on any row that pushes a new screen. Drawn
// here rather than imported so a row never depends on the icon set.
function Chevron() {
  return (
    <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true" style={{ flexShrink: 0, color: colors.textTertiary }}>
      <path d="M1.5 1.5 6.5 6.5l-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The row that carries most of the app's content: a leading chip, a title with
// secondary meta under it, and something (usually an amount) on the trailing
// edge. Renders as a <button> when it's tappable so it inherits the global
// press-feedback and focus-ring rules, and as a <div> when it isn't.
export default function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  subtitleColor = colors.textSecondary,
  subtitleWeight = 400,
  // Set on rows that navigate somewhere. iOS shows a disclosure chevron on
  // exactly those, which is how you can tell a push from an in-place action
  // without tapping it.
  chevron = false,
  onClick,
  style,
  ...rest
}) {
  // Tapping a row is a selection — drilling into a detail, opening a sheet — so
  // it ticks rather than firing the heavier primary-action tap. Living here
  // means adopting the primitive gets the feedback right for free, instead of
  // every screen remembering to call it (which is why coverage was patchy).
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick ? () => { haptics.select(); onClick(); } : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '8px 0',
        // 44pt is Apple's minimum tappable height and the metric every iOS list
        // is built on. Rows here were free-height and often came out under it.
        minHeight: metrics.row,
        width: '100%',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        // No inline `background` here. It used to be 'transparent', and an
        // inline style beats a stylesheet — which silently killed the iOS press
        // fill that `.bt-list > *:active` paints. Buttons already reset to no
        // background globally, and a div is transparent by default.
        color: colors.ink,
        ...style,
      }}
      {...rest}
    >
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: type.callout,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        {subtitle != null && (
          <div style={{ fontSize: type.footnote, color: subtitleColor, fontWeight: subtitleWeight }}>
            {subtitle}
          </div>
        )}
      </div>
      {trailing != null && <div style={{ flexShrink: 0 }}>{trailing}</div>}
      {chevron && <Chevron />}
    </Tag>
  );
}
