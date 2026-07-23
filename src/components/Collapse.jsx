// A smooth expand/collapse container. Uses the grid-rows 0fr→1fr technique so it
// animates to the content's natural height without measuring anything in JS. The
// transition is CSS (class .bt-collapse) so it respects the motion setting: it's
// stilled when Animations = Off or the OS prefers reduced motion.
export default function Collapse({ open, children }) {
  return (
    <div className="bt-collapse" data-open={open ? '1' : '0'} style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr' }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>{children}</div>
    </div>
  );
}
