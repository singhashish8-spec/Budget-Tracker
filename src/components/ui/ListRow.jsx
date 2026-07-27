import { colors, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

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
        width: '100%',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        background: 'transparent',
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
    </Tag>
  );
}
