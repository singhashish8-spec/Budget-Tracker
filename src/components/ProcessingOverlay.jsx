import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function ProcessingOverlay() {
  const { state } = useApp();
  if (!state.processing) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(247,244,238,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3.5px solid ${colors.cardBorder}`, borderTopColor: colors.primary, animation: 'spin 0.9s linear infinite' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600 }}>{state.procTitle || 'Reading your file…'}</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, marginTop: 5 }}>{state.procSub || 'Detecting merchants and categories'}</div>
      </div>
    </div>
  );
}
