import { colors, fonts, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

// A card's title row, optionally with an action on the right ("View all",
// "Budgets", "See all"). Baseline-aligned so the small action text sits on the
// same line as the heading rather than centred against it.
export default function SectionHeader({ title, action, onAction, style }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 10,
        ...style,
      }}
    >
      <div style={{ fontFamily: fonts.heading, fontSize: type.title, fontWeight: 600 }}>{title}</div>
      {action != null && (
        onAction
          ? (
            <button
              onClick={() => { haptics.select(); onAction(); }}
              style={{ fontSize: type.body, fontWeight: 600, color: colors.primary, cursor: 'pointer', flexShrink: 0 }}
            >
              {action}
            </button>
          )
          : <span style={{ fontSize: type.body, fontWeight: 600, color: colors.primary, flexShrink: 0 }}>{action}</span>
      )}
    </div>
  );
}
