import { metrics } from '../../theme/tokens';

// A group of rows with iOS separators between them.
//
// The separator is the giveaway detail. Apple never runs it to the leading edge
// of the row — it starts where the row's TEXT starts, so the line reads as
// dividing content rather than slicing the card in half. It's also a true
// hairline (one device pixel), not the 1px border a browser gives you.
//
// Both are handled by the `.bt-list` rule in index.css using a pseudo-element,
// which keeps the separator out of layout entirely — no row grows by a pixel
// because it has a line above it, and the last row needs no special case.
//
// `inset` overrides where the line starts. Use `metrics.separatorInset` (the
// default) for rows with a leading icon or monogram, and 0 for plain text rows
// where the text begins at the card's own padding.
export default function List({ inset = metrics.separatorInset, style, children, ...rest }) {
  return (
    <div
      className="bt-list"
      style={{ '--bt-separator-inset': `${inset}px`, display: 'flex', flexDirection: 'column', ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
