import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

// The haptic tied to `tone` already tells your hand whether something
// succeeded or failed (see showToast in AppContext.jsx); the pill itself used
// to be the same neutral dark regardless, so "Restored 40 transactions" and
// "Couldn't restore that file" looked identical. Only 'error' gets a distinct
// treatment here — 'success' and 'none' keep the original neutral pill, since
// that one was never the problem and colors.danger is the one semantic colour
// that reads consistently against every accent, unlike inventing a "success
// green" that could clash with a Rose or Amber accent.
export default function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;
  const isError = state.toastTone === 'error';
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 116,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 60,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: isError ? colors.danger : colors.surfaceDark,
          color: isError ? '#FFFFFF' : colors.onPrimary,
          borderRadius: 100,
          padding: '10px 20px',
          fontSize: 13.5,
          fontWeight: 500,
          animation: 'rise 0.25s ease-out',
          boxShadow: isError ? '0 8px 24px rgba(217,67,47,0.35)' : '0 8px 24px rgba(16,36,28,0.3)',
          maxWidth: '85vw',
          textAlign: 'center',
        }}
      >
        {isError && <span aria-hidden="true" style={{ flexShrink: 0 }}>⚠</span>}
        {state.toast}
      </div>
    </div>
  );
}
