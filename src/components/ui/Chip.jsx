import { forwardRef } from 'react';
import { colors, radii, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

// A pill: filter segments, status badges, selectable options. Selecting one is
// a choice changing, so it ticks (haptics.select) rather than firing the
// heavier primary-action tap.
//
// Forwards its ref to the underlying element — a sliding-selection row (see
// Transactions' filter segment) needs each chip's real DOM rect to know where
// to animate a shared highlight to, and that only works with a real ref.
const Chip = forwardRef(function Chip({
  label,
  selected = false,
  tone, // { bg, fg, border } — for status badges that aren't selectable
  onClick,
  style,
  ...rest
}, ref) {
  const Tag = onClick ? 'button' : 'div';
  const palette = tone || {
    bg: selected ? colors.primaryTint : 'transparent',
    fg: selected ? colors.primary : colors.textSecondary,
    border: selected ? colors.primary : colors.cardBorder,
  };

  return (
    <Tag
      ref={ref}
      onClick={onClick ? () => { haptics.select(); onClick(); } : undefined}
      aria-pressed={onClick ? selected : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: radii.pill,
        padding: '7px 13px',
        fontSize: type.footnote,
        fontWeight: selected ? 700 : 600,
        background: palette.bg,
        color: palette.fg,
        border: `1px solid ${palette.border}`,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {label}
    </Tag>
  );
});

export default Chip;
