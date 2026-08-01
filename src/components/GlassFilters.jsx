// The SVG filter primitives behind the Liquid Glass skin's refraction.
//
// CSS can blur what's behind a panel, but blur alone is frost, not glass. Real
// glass BENDS what's behind it, hardest at the edges where the surface curves —
// that lensing is the whole difference between "translucent rectangle" and
// "piece of glass sitting on top of your content". There is no CSS property for
// it, so it comes from an SVG filter: feTurbulence generates a smooth noise
// field and feDisplacementMap uses that field to push pixels sideways.
//
// Why this is applied to decorative overlay layers rather than to
// `backdrop-filter` directly: Chromium nominally accepts `backdrop-filter:
// url(#id)`, but support across the range of Android WebView versions this app
// actually runs on is unreliable, and when it fails it fails by rendering
// nothing — an invisible panel, not a degraded one. Displacing an overlay's own
// pixels uses the ordinary `filter` property, which has been solid for years.
//
// Mounted once, from App. The <svg> itself is zero-sized and hidden; only the
// filter definitions matter.
export default function GlassFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        {/* Edge lensing. Low baseFrequency = long, slow undulations rather than
            visible static; two octaves keep it organic without the cost of
            four. seed is fixed so the distortion is identical on every launch —
            a pattern that reshuffles each time reads as a glitch. */}
        <filter id="bt-liquid-warp" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.014"
            numOctaves="2"
            seed="7"
            result="warpNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="warpNoise"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* A gentler version for surfaces that carry text-adjacent chrome (the
            tab bar, sheet grabbers). The strong warp above is beautiful on a
            highlight ring and unacceptable anywhere it could smear a label. */}
        <filter id="bt-liquid-warp-soft" x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.02" numOctaves="1" seed="7" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="7" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Film grain. Every convincing glass render has some — a perfectly
            smooth gradient is the tell that something is computed rather than
            photographed. Rendered once into a tiny tile and repeated by CSS,
            so it costs one small texture rather than a full-screen filter. */}
        <filter id="bt-grain" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="3" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.5
                    0 0 0 0 0.5
                    0 0 0 0 0.5
                    0 0 0 0.09 0"
          />
        </filter>

        {/* The gooey/morph primitive: blur then crush the alpha ramp, so two
            nearby shapes fuse into one blob instead of overlapping. This is
            what makes a Liquid Glass control look like it's made of a single
            continuous material when it splits or merges. */}
        <filter id="bt-goo" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="gooBlur" />
          <feColorMatrix
            in="gooBlur"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 20 -9"
            result="gooRamp"
          />
          <feComposite in="SourceGraphic" in2="gooRamp" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
