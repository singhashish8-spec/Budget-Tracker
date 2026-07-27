import { spacing } from '../../theme/tokens';

// The scroll container every screen sits in. The padding string
// `calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px` was previously
// retyped verbatim in ~18 files — the top offset clears the floating TopBar,
// the bottom clears the BottomNav plus the gesture bar.
export default function Screen({ gap = 14, style, children, ...rest }) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: `calc(env(safe-area-inset-top, 0px) + ${spacing.screenTop}px) ${spacing.screenSide}px ${spacing.screenBottom}px`,
        display: 'flex',
        flexDirection: 'column',
        gap,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
