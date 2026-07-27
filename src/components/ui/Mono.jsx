import { colors, fonts, tint } from '../../theme/tokens';

// The two-letter category monogram chip ("FD", "GR", "TR"). This is the app's
// icon system — license-free, always crisp, no icon font — and it was
// hand-rolled at ten different sizes across the screens. Sizes here are all
// >= 32px so they stay comfortable thumb targets when they're the tap surface.
export default function Mono({ label, color = colors.textTertiary, size = 36, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size / 3),
        background: tint(color),
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: fonts.heading,
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        flexShrink: 0,
        ...style,
      }}
    >
      {label}
    </div>
  );
}
