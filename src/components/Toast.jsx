import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function Toast() {
  const { state } = useApp();
  if (!state.toast) return null;
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
          background: colors.surfaceDark,
          color: colors.onPrimary,
          borderRadius: 100,
          padding: '10px 20px',
          fontSize: 13.5,
          fontWeight: 500,
          animation: 'rise 0.25s ease-out',
          boxShadow: '0 8px 24px rgba(16,36,28,0.3)',
          maxWidth: '85vw',
          textAlign: 'center',
        }}
      >
        {state.toast}
      </div>
    </div>
  );
}
