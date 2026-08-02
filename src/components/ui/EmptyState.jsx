import { colors, type } from '../../theme/tokens';
import * as haptics from '../../services/haptics';
import Mono from './Mono';

// Empty states used to be a bare line of tertiary text — quiet, but nothing
// said "you're looking at zero on purpose" rather than "something's missing."
// The app already has a distinctive little visual system for exactly this
// job: the two-letter monogram badge every category uses. Reusing it here
// (oversized, faint, on-brand) ties the empty moment back to the same visual
// grammar as every populated one, for the cost of one component change.
export default function EmptyState({ text, glyph = '∅', action, onAction, style }) {
  return (
    <div
      className="screen-enter"
      data-anim="tab"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '18px 12px',
        ...style,
      }}
    >
      <Mono label={glyph} size={48} color={colors.primary} style={{ opacity: 0.9, fontSize: 18 }} />
      <div style={{ fontSize: type.body, color: colors.textSecondary, lineHeight: 1.5, maxWidth: 260 }}>{text}</div>
      {action && onAction && (
        <button
          onClick={() => { haptics.tap(); onAction(); }}
          style={{
            marginTop: 2,
            fontSize: type.body,
            fontWeight: 700,
            color: '#FFFFFF',
            background: colors.primary,
            padding: '9px 18px',
            borderRadius: 100,
            cursor: 'pointer',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
