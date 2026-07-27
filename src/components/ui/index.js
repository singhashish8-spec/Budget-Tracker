// The app's UI primitives. Before these existed the same card/row/bar markup
// was hand-typed across fourteen screen files, which is what made every visual
// change cost fourteen edits. Import from here, not from the individual files.
//
// HAPTICS — read before adding a call. Feedback has exactly two owners:
//   1. These primitives, for the interaction they render. ListRow, SectionHeader
//      and Chip tick with select(); EmptyState's action fires tap().
//   2. showToast() in state/AppContext, for the OUTCOME — success() by default,
//      error() when passed tone 'error', silent on 'none'.
// So do NOT wrap a primitive's onClick/onAction in another haptics call, and do
// NOT fire success() next to an action that already toasts — both double-buzz a
// single user action. Raw <button>s that aren't a primitive yet keep their own
// manual call; delete it in the same commit that migrates them.
export { default as Card } from './Card';
export { default as Screen } from './Screen';
export { default as SectionHeader } from './SectionHeader';
export { default as ListRow } from './ListRow';
export { default as ProgressBar } from './ProgressBar';
export { default as Chip } from './Chip';
export { default as EmptyState } from './EmptyState';
export { default as Mono } from './Mono';
export { default as CountUp } from './CountUp';
export { default as Icon } from './Icon';
