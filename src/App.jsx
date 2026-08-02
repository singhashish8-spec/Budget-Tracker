import { useState } from 'react';
import { colors, fonts, type } from './theme/tokens';
import { setActiveCurrency } from './utils/currency';
import { AppProvider, useApp } from './state/AppContext';
import Onboarding from './screens/onboarding/Onboarding';
import HomeScreen from './screens/HomeScreen';
import TransactionsScreen from './screens/TransactionsScreen';
import BudgetsScreen from './screens/BudgetsScreen';
import InsightsScreen from './screens/InsightsScreen';
import GoalsScreen from './screens/GoalsScreen';
import DetailScreen from './screens/DetailScreen';
import RemindersScreen from './screens/RemindersScreen';
import WarrantyScreen from './screens/WarrantyScreen';
import EnvelopesScreen from './screens/EnvelopesScreen';
import EventBudgetsScreen from './screens/EventBudgetsScreen';
import CsvImportScreen from './screens/CsvImportScreen';
import PatternsScreen from './screens/PatternsScreen';
import SmsScreen from './screens/SmsScreen';
import SettingsScreen from './screens/SettingsScreen';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import CategorySheet from './components/CategorySheet';
import AddTransactionSheet from './components/AddTransactionSheet';
import ProcessingOverlay from './components/ProcessingOverlay';
import Toast from './components/Toast';
import LockScreen from './components/LockScreen';
import HamburgerDrawer from './components/HamburgerDrawer';
import SkeletonHome from './components/SkeletonHome';
import GlassFilters from './components/GlassFilters';

const TAB_SCREENS = ['home', 'transactions', 'budgets', 'insights'];
// Screens reached by drilling in animate differently from the top-level tabs:
// deep screens slide in from the right (a sense of "going in"), tabs cross-fade
// up (siblings, not a hierarchy).
const DEEP_SCREENS = new Set(['detail', 'settings', 'goals', 'reminders', 'warranty', 'envelopes', 'patterns', 'sms', 'eventBudgets', 'csvImport']);

function Shell() {
  const { state } = useApp();
  setActiveCurrency(state.currency);

  if (state.loading) {
    return <SkeletonHome />;
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

  // The shell's height (not min-height) and overflow:hidden live in index.css —
  // see the .app-shell rule there for why. Setting either inline would win over
  // the stylesheet's 100vh→100dvh fallback pair and defeat the point.
  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', position: 'relative', backgroundColor: colors.bgApp, color: colors.ink }}>
      {/* Keyed so each navigation remounts the wrapper and replays the enter
          animation; data-anim picks the direction (deep slide vs tab fade). */}
      <div
        key={state.screen}
        className="screen-enter"
        data-anim={DEEP_SCREENS.has(state.screen) ? 'deep' : 'tab'}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {state.screen === 'onboarding' && <Onboarding />}
        {state.screen === 'home' && <HomeScreen />}
        {state.screen === 'transactions' && <TransactionsScreen />}
        {state.screen === 'budgets' && <BudgetsScreen />}
        {state.screen === 'insights' && <InsightsScreen />}
        {state.screen === 'goals' && <GoalsScreen />}
        {state.screen === 'detail' && <DetailScreen />}
        {state.screen === 'reminders' && <RemindersScreen />}
        {state.screen === 'warranty' && <WarrantyScreen />}
        {state.screen === 'envelopes' && <EnvelopesScreen />}
        {state.screen === 'eventBudgets' && <EventBudgetsScreen />}
        {state.screen === 'csvImport' && <CsvImportScreen />}
        {state.screen === 'patterns' && <PatternsScreen />}
        {state.screen === 'sms' && <SmsScreen />}
        {state.screen === 'settings' && <SettingsScreen />}
      </div>

      {/* Filter definitions for the Liquid Glass refraction. Renders nothing
          visible and costs nothing until a skin references it by id. */}
      <GlassFilters />

      <TopBar />
      {TAB_SCREENS.includes(state.screen) && <BottomNav />}
      <CategorySheet />
      <AddTransactionSheet />
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

  // Renders OUTSIDE .app-shell, and html/body are overflow:hidden, so this owns
  // its own scrolling — otherwise tall content would be clipped unreachable.
  return (
    <div style={{ height: '100dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bgApp, padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ fontFamily: fonts.heading, fontSize: 20, fontWeight: 700 }}>We found your data</div>
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
        style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '14px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 6 }}
      >
        Restore my data
      </button>
      <button onClick={dismissRecovery} style={{ fontSize: 13.5, color: colors.textTertiary, cursor: 'pointer', padding: 8 }}>
        Start fresh instead
      </button>
    </div>
  );
}

// Shown when the database could not be opened AND the automatic backup restore
// in the bootstrap didn't recover anything.
//
// This screen used to offer exactly one button — "Reset & start fresh" — which
// deletes the database, and told the user their "encrypted data can't be
// unlocked" (encryption was removed; the copy was stale and pointed at the
// wrong conclusion). The most common trigger is actually a TRANSIENT one: the
// store timing out on a slow cold start. Handing someone a delete button as the
// only way out of a temporary failure is how data gets lost, so retrying is now
// the primary action and the destructive path is secondary and confirmed.
function DatabaseErrorScreen({ message }) {
  const { resetApp } = useApp();
  const [resetting, setResetting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // A timeout means the store never came up in time — the data is almost
  // certainly still there and a retry usually clears it.
  const looksTransient = /in time|timeout|timed out/i.test(message || '');

  const doReset = async () => {
    setResetting(true);
    try {
      await resetApp();
    } catch {
      setResetting(false);
    }
  };

  // Renders OUTSIDE .app-shell, and html/body are overflow:hidden, so this owns
  // its own scrolling — otherwise tall content would be clipped unreachable.
  return (
    <div style={{ height: '100dvh', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: colors.bgApp, padding: 32, textAlign: 'center', gap: 12 }}>
      <div style={{ fontFamily: fonts.heading, fontSize: 18, fontWeight: 700 }}>
        {looksTransient ? 'Couldn’t load your data' : 'Couldn’t open your data'}
      </div>
      <div style={{ fontSize: type.body, color: colors.textSecondary, maxWidth: 350, lineHeight: 1.55 }}>
        {looksTransient
          ? 'Your data store took too long to start. This is usually temporary and your records are still on this phone — trying again normally fixes it.'
          : 'The local data store couldn’t be opened this time. Your records are still on this phone, and the app keeps automatic backups, so try again first.'}
      </div>

      <button
        onClick={() => window.location.reload()}
        style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: '14px 30px', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}
      >
        Try again
      </button>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          style={{ fontSize: type.body, color: colors.textTertiary, cursor: 'pointer', padding: 10, marginTop: 4 }}
        >
          Still stuck?
        </button>
      ) : (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: 12, padding: '16px 18px', maxWidth: 340 }}>
          <div style={{ fontSize: type.footnote, color: colors.dangerDark, lineHeight: 1.5 }}>
            Starting fresh <strong>deletes the data on this phone</strong>. Only do this if trying again keeps failing. If an automatic backup exists, the app will offer it back on the next launch.
          </div>
          <button
            onClick={doReset}
            disabled={resetting}
            style={{ background: colors.danger, color: '#FFFFFF', borderRadius: 100, padding: '12px 24px', fontSize: type.callout, fontWeight: 600, cursor: 'pointer', opacity: resetting ? 0.6 : 1 }}
          >
            {resetting ? 'Resetting…' : 'Delete and start fresh'}
          </button>
          <button onClick={() => setConfirming(false)} style={{ fontSize: type.footnote, color: colors.textSecondary, cursor: 'pointer', padding: 6 }}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ fontSize: type.caption, color: colors.textTertiary, maxWidth: 320, marginTop: 4 }}>Technical detail: {message}</div>
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
