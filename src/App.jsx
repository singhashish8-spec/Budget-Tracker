import { useState } from 'react';
import { colors } from './theme/tokens';
import { setActiveCurrency } from './utils/currency';
import { AppProvider, useApp } from './state/AppContext';
import Onboarding from './screens/onboarding/Onboarding';
import HomeScreen from './screens/HomeScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import BudgetsScreen from './screens/BudgetsScreen';
import UploadScreen from './screens/UploadScreen';
import ReviewImportScreen from './screens/ReviewImportScreen';
import InsightsScreen from './screens/InsightsScreen';
import RemindersScreen from './screens/RemindersScreen';
import PatternsScreen from './screens/PatternsScreen';
import SmsScreen from './screens/SmsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CategorySheet from './components/CategorySheet';
import ProcessingOverlay from './components/ProcessingOverlay';
import Toast from './components/Toast';
import LockScreen from './components/LockScreen';
import HamburgerDrawer from './components/HamburgerDrawer';

const TAB_SCREENS = ['home', 'transactions', 'budgets', 'insights'];

function Shell() {
  const { state } = useApp();
  setActiveCurrency(state.currency);

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bgApp }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.cardBorder}`, borderTopColor: colors.primary, animation: 'spin 0.9s linear infinite' }} />
      </div>
    );
  }

  if (state.loadError) {
    return <DatabaseErrorScreen message={state.loadError} />;
  }

  if (state.locked) {
    return <LockScreen />;
  }

  // The database came up empty but a snapshot exists — offer it back rather
  // than marching the user through onboarding on top of their own data.
  if (state.recoverable) {
    return <RecoveryScreen found={state.recoverable} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', background: colors.bgApp, color: colors.ink }}>
      {state.screen === 'onboarding' && <Onboarding />}
      {state.screen === 'home' && <HomeScreen />}
      {state.screen === 'transactions' && <TransactionsScreen />}
      {state.screen === 'budgets' && <BudgetsScreen />}
      {state.screen === 'upload' && <UploadScreen />}
      {state.screen === 'review' && <ReviewImportScreen />}
      {state.screen === 'insights' && <InsightsScreen />}
      {state.screen === 'reminders' && <RemindersScreen />}
      {state.screen === 'patterns' && <PatternsScreen />}
      {state.screen === 'sms' && <SmsScreen />}
      {state.screen === 'settings' && <SettingsScreen />}

      <TopBar />
      {TAB_SCREENS.includes(state.screen) && <BottomNav />}
      <CategorySheet />
      <HamburgerDrawer />
      <ProcessingOverlay />
      <Toast />
    </div>
  );
}

function RecoveryScreen({ found }) {
  const { restoreFound, dismissRecovery } = useApp();
  const when = found.exportedAt ? new Date(found.exportedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : null;
  const n = found.data;
  const bits = [
    n.transactions?.length ? `${n.transactions.length} transactions` : null,
    n.budgets?.length ? `${n.budgets.length} budgets` : null,
    n.reminders?.length ? `${n.reminders.length} bills` : null,
    n.goals?.length ? `${n.goals.length} goals` : null,
  ].filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bgApp, padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>We found your data</div>
      <div style={{ fontSize: 14, color: colors.textSecondary, maxWidth: 340, lineHeight: 1.55 }}>
        This phone has a saved copy{when ? ` from ${when}` : ''}. You can put it back instead of starting over.
      </div>
      {bits.length > 0 && (
        <div style={{ background: colors.successTint, border: `1px solid ${colors.successBorder}`, color: colors.successText, borderRadius: 14, padding: '12px 16px', fontSize: 13.5, fontWeight: 600 }}>
          {bits.join(' · ')}
        </div>
      )}
      <button
        onClick={restoreFound}
        style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '14px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}
      >
        Restore my data
      </button>
      <button onClick={dismissRecovery} style={{ fontSize: 13.5, color: colors.textTertiary, cursor: 'pointer', padding: 8 }}>
        Start fresh instead
      </button>
    </div>
  );
}

function DatabaseErrorScreen({ message }) {
  const { resetApp } = useApp();
  const [resetting, setResetting] = useState(false);

  const doReset = async () => {
    setResetting(true);
    try {
      await resetApp();
    } catch {
      setResetting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bgApp, padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Couldn't open your data</div>
      <div style={{ fontSize: 13.5, color: colors.textSecondary, maxWidth: 340, lineHeight: 1.5 }}>
        This usually happens when the app was restored to a new phone or reinstalled — the encrypted data can't be unlocked here. Starting fresh fixes it. If you have a backup file, you can restore it afterwards from Settings.
      </div>
      <button
        onClick={doReset}
        disabled={resetting}
        style={{ background: colors.primary, color: colors.bgApp, borderRadius: 100, padding: '14px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8, opacity: resetting ? 0.6 : 1 }}
      >
        {resetting ? 'Resetting…' : 'Reset & start fresh'}
      </button>
      <div style={{ fontSize: 11.5, color: colors.textTertiary, maxWidth: 320 }}>Technical detail: {message}</div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
