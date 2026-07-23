// A monetary amount that can be hidden for privacy. It's a plain span carrying
// `.bt-amt`; the actual frosting is driven entirely by [data-private] on the
// root (set from the eye toggle in the top bar), so this stays a zero-logic
// wrapper — no context reads, no re-renders on toggle. Wrap any user-facing
// amount so "hide balances" covers it. `style`/`className` pass through so it
// drops in wherever a styled amount span already lived.
export default function Amount({ children, style, className }) {
  return (
    <span className={className ? `bt-amt ${className}` : 'bt-amt'} style={style}>
      {children}
    </span>
  );
}
