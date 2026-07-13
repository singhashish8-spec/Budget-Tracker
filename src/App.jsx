import { colors } from './theme/tokens';
import { AppProvider, useApp } from './state/AppContext';
import Onboarding from './screens/onboarding/Onboarding';
import HomeScreen from './screens/HomeScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import BudgetsScreen from './screens/BudgetsScreen';
import UploadScreen from './screens/UploadScreen';
import ReviewImportScreen from './screens/ReviewImportScreen';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CategorySheet from './components/CategorySheet';
import ProcessingOverlay from './components/ProcessingOverlay';
import Toast from './components/Toast';

const TAB_SCREENS = ['home', 'transactions', 'budgets'];

function Shell() {
  const { state } = useApp();

  if (state.loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bgApp }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.cardBorder}`, borderTopColor: colors.primary, animation: 'spin 0.9s linear infinite' }} />
      </div>
    );
  }

  if (state.loadError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bgApp, padding: 32, textAlign: 'center', gap: 8 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Couldn't open the local database</div>
        <div style={{ fontSize: 13.5, color: colors.textSecondary, maxWidth: 320 }}>{state.loadError}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', background: colors.bgApp, color: colors.ink }}>
      {state.screen === 'onboarding' && <Onboarding />}
      {state.screen === 'home' && <HomeScreen />}
      {state.screen === 'transactions' && <TransactionsScreen />}
      {state.screen === 'budgets' && <BudgetsScreen />}
      {state.screen === 'upload' && <UploadScreen />}
      {state.screen === 'review' && <ReviewImportScreen />}

      <TopBar />
      {TAB_SCREENS.includes(state.screen) && <BottomNav />}
      <CategorySheet />
      <ProcessingOverlay />
      <Toast />
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
