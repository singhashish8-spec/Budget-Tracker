import { useEffect, useRef } from 'react';
import { colors } from '../theme/tokens';
import { useApp } from '../state/AppContext';

export default function LockScreen() {
  const { unlockApp } = useApp();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    unlockApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: colors.bgApp,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 32,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 15,
          background: colors.primary,
          color: colors.bgApp,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 21,
        }}
      >
        BT
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>Budget Tracker is locked</div>
      <div style={{ fontSize: 13.5, color: colors.textSecondary, maxWidth: 280 }}>Verify it's you to see your transactions and budgets.</div>
      <button
        onClick={unlockApp}
        style={{
          background: colors.primary,
          color: colors.bgApp,
          borderRadius: 100,
          padding: '14px 28px',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Unlock
      </button>
    </div>
  );
}
