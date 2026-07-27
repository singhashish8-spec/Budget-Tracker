import { colors, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';

// Empty states were a bare line of tertiary text wherever they appeared. This
// keeps them quiet but gives them room to breathe and an optional action, so
// "nothing here yet" reads as a starting point rather than a dead end.
export default function EmptyState({ text, action, onAction, style }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 8,
        padding: '10px 0',
        ...style,
      }}
    >
      <div style={{ fontSize: type.body, color: colors.textTertiary, lineHeight: 1.5 }}>{text}</div>
      {action && onAction && (
        <button
          onClick={() => { haptics.tap(); onAction(); }}
          style={{ fontSize: type.body, fontWeight: 600, color: colors.primary, cursor: 'pointer' }}
        >
          {action} ›
        </button>
      )}
    </div>
  );
}
