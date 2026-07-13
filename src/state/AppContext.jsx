import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import * as repo from '../db/repo';
import { checkLockAvailable, unlock as biometricUnlock } from '../services/appLock';

const AppStateContext = createContext(null);

const DEFAULT_ACCOUNTS = { bank: true, card: true, upi: true, sms: true, cash: false, invest: true, loans: false };

const initialState = {
  loading: true,
  loadError: null,
  onboarded: false,
  obStep: 1,
  accounts: DEFAULT_ACCOUNTS,
  screen: 'onboarding',
  categories: [],
  txns: [],
  budgets: [],
  reminders: [],
  goals: [],
  netWorthItems: [],
  patternPrefs: [],
  smsLog: [],
  search: '',
  filter: 'all',
  sheetFor: null,
  addSheetOpen: false,
  budgetSheetOpen: false,
  processing: false,
  procTitle: '',
  procSub: '',
  reviewImported: null,
  reviewSource: '',
  toast: '',
  currency: 'INR',
  taxRegime: 'new',
  tax80cInvested: 0,
  appLock: false,
  locked: false,
  menuOpen: false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'GO':
      return { ...state, screen: action.screen, sheetFor: null, addSheetOpen: false, menuOpen: false };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const toastTimer = useRef(null);
  const set = useCallback((payload) => dispatch({ type: 'SET', payload }), []);

  useEffect(() => {
    (async () => {
      try {
        const [
          categories,
          txns,
          budgets,
          reminders,
          goals,
          netWorthItems,
          patternPrefs,
          smsLog,
          onboardedFlag,
          accountsJson,
          appLockFlag,
          currency,
          taxRegime,
          tax80cInvested,
        ] = await Promise.all([
          repo.listCategories(),
          repo.listTransactions(),
          repo.listBudgets(),
          repo.listReminders(),
          repo.listGoals(),
          repo.listNetWorthItems(),
          repo.listPatternPrefs(),
          repo.listSmsLog(),
          repo.getSetting('onboarded', '0'),
          repo.getSetting('accounts', null),
          repo.getSetting('appLock', '0'),
          repo.getSetting('currency', 'INR'),
          repo.getSetting('taxRegime', 'new'),
          repo.getSetting('tax80cInvested', '0'),
        ]);
        const onboarded = onboardedFlag === '1';
        const appLock = appLockFlag === '1';
        set({
          categories,
          txns,
          budgets,
          reminders,
          goals,
          netWorthItems,
          patternPrefs,
          smsLog,
          onboarded,
          accounts: accountsJson ? JSON.parse(accountsJson) : DEFAULT_ACCOUNTS,
          screen: onboarded ? 'home' : 'onboarding',
          appLock,
          locked: onboarded && appLock,
          currency,
          taxRegime,
          tax80cInvested: Number(tax80cInvested) || 0,
          loading: false,
        });
      } catch (err) {
        set({ loading: false, loadError: err?.message || 'Could not open the local database' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-lock whenever the app comes back from the background, if app-lock is on.
  const appLockRef = useRef(state.appLock);
  const onboardedRef = useRef(state.onboarded);
  useEffect(() => {
    appLockRef.current = state.appLock;
    onboardedRef.current = state.onboarded;
  }, [state.appLock, state.onboarded]);

  useEffect(() => {
    const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && appLockRef.current && onboardedRef.current) {
        set({ locked: true });
      }
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = useCallback(
    (msg) => {
      clearTimeout(toastTimer.current);
      set({ toast: msg });
      toastTimer.current = setTimeout(() => set({ toast: '' }), 2200);
    },
    [set],
  );

  const go = useCallback((screen) => dispatch({ type: 'GO', screen }), []);
  const goReview = useCallback(() => set({ screen: 'transactions', filter: 'review', sheetFor: null, addSheetOpen: false }), [set]);
  const openMenu = useCallback(() => set({ menuOpen: true }), [set]);
  const closeMenu = useCallback(() => set({ menuOpen: false }), [set]);

  const toggleAccount = useCallback(
    (key) => {
      const next = { ...state.accounts, [key]: !state.accounts[key] };
      set({ accounts: next });
      repo.setSetting('accounts', JSON.stringify(next));
    },
    [state.accounts, set],
  );

  const setCurrency = useCallback(
    (code) => {
      set({ currency: code });
      repo.setSetting('currency', code);
    },
    [set],
  );

  const setTaxRegime = useCallback(
    (regime) => {
      set({ taxRegime: regime });
      repo.setSetting('taxRegime', regime);
    },
    [set],
  );

  const setTax80cInvested = useCallback(
    (amount) => {
      const n = Math.max(0, Math.round(amount) || 0);
      set({ tax80cInvested: n });
      repo.setSetting('tax80cInvested', String(n));
    },
    [set],
  );

  const toggleAppLock = useCallback(async () => {
    if (!state.appLock) {
      const { available, reason } = await checkLockAvailable();
      if (!available) {
        showToast(reason || 'App lock isn’t available on this device');
        return;
      }
    }
    const next = !state.appLock;
    set({ appLock: next });
    await repo.setSetting('appLock', next ? '1' : '0');
    showToast(next ? 'App lock turned on' : 'App lock turned off');
  }, [state.appLock, set, showToast]);

  const unlockApp = useCallback(async () => {
    const res = await biometricUnlock();
    if (res.success) {
      set({ locked: false });
    } else if (!res.cancelled) {
      showToast(res.message || 'Couldn’t verify — try again');
    }
    return res;
  }, [set, showToast]);

  const obNext = useCallback(() => set({ obStep: Math.min(3, state.obStep + 1) }), [state.obStep, set]);
  const obBack = useCallback(() => set({ obStep: Math.max(1, state.obStep - 1) }), [state.obStep, set]);

  const finishOnboarding = useCallback(async () => {
    await repo.setSetting('onboarded', '1');
    await repo.setSetting('accounts', JSON.stringify(state.accounts));
    set({ onboarded: true, screen: 'home' });
  }, [state.accounts, set]);

  const addCategory = useCallback(
    async (label) => {
      const name = label.trim();
      if (!name) return;
      const mono = name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'NC';
      const id = await repo.addCategory({ label: name, mono, color: '#8A8577' });
      const categories = await repo.listCategories();
      set({ categories });
      showToast(`Category "${name}" added`);
      return id;
    },
    [set, showToast],
  );

  const openCategorySheet = useCallback((txnId) => set({ sheetFor: { id: txnId } }), [set]);
  const closeCategorySheet = useCallback(() => set({ sheetFor: null }), [set]);

  const setTxnCategory = useCallback(
    async (catId) => {
      const sf = state.sheetFor;
      if (!sf) return;
      await repo.setTransactionCategory(sf.id, catId);
      const txns = await repo.listTransactions();
      set({ txns, sheetFor: null });
    },
    [state.sheetFor, set],
  );

  const addManualTransactions = useCallback(
    async (txnList) => {
      await repo.addTransactions(txnList);
      const txns = await repo.listTransactions();
      set({ txns });
    },
    [set],
  );

  const addBudget = useCallback(
    async (catId, limit) => {
      await repo.upsertBudget(catId, limit);
      const budgets = await repo.listBudgets();
      set({ budgets, budgetSheetOpen: false });
      showToast('Budget saved');
    },
    [set, showToast],
  );

  // ── bill reminders ──
  const addReminder = useCallback(
    async ({ label, amount, dueDay }) => {
      await repo.addReminder({ label, amount, dueDay });
      set({ reminders: await repo.listReminders() });
      showToast(`"${label}" added to reminders`);
    },
    [set, showToast],
  );

  const toggleReminderPaid = useCallback(
    async (id, monthKey) => {
      const r = state.reminders.find((x) => x.id === id);
      const alreadyPaid = r?.paid_for === monthKey;
      await repo.setReminderPaid(id, alreadyPaid ? null : monthKey);
      set({ reminders: await repo.listReminders() });
    },
    [state.reminders, set],
  );

  const deleteReminder = useCallback(
    async (id) => {
      await repo.deleteReminder(id);
      set({ reminders: await repo.listReminders() });
    },
    [set],
  );

  // ── savings goals ──
  const addGoal = useCallback(
    async ({ label, targetAmount }) => {
      await repo.addGoal({ label, targetAmount });
      set({ goals: await repo.listGoals() });
      showToast(`Goal "${label}" added`);
    },
    [set, showToast],
  );

  const addToGoal = useCallback(
    async (id, amount) => {
      await repo.addToGoal(id, amount);
      set({ goals: await repo.listGoals() });
    },
    [set],
  );

  const deleteGoal = useCallback(
    async (id) => {
      await repo.deleteGoal(id);
      set({ goals: await repo.listGoals() });
    },
    [set],
  );

  // ── net worth ──
  const addNetWorthItem = useCallback(
    async ({ kind, label, amount }) => {
      await repo.addNetWorthItem({ kind, label, amount });
      set({ netWorthItems: await repo.listNetWorthItems() });
    },
    [set],
  );

  const deleteNetWorthItem = useCallback(
    async (id) => {
      await repo.deleteNetWorthItem(id);
      set({ netWorthItems: await repo.listNetWorthItems() });
    },
    [set],
  );

  // ── smart patterns ──
  const setPatternPref = useCallback(
    async (signature, status) => {
      await repo.setPatternPref(signature, status);
      set({ patternPrefs: await repo.listPatternPrefs() });
    },
    [set],
  );

  const clearPatternPref = useCallback(
    async (signature) => {
      await repo.clearPatternPref(signature);
      set({ patternPrefs: await repo.listPatternPrefs() });
    },
    [set],
  );

  // ── SMS simulation: inserts a real transaction + logs the "SMS" that produced it ──
  const simulateSms = useCallback(
    async ({ rawSms, merchant, amount, cat, type }) => {
      try {
        const id = await repo.addTransaction({ merchant, account: 'SMS · auto-tracked', date: 'Today', amount, cat, type, source: 'sms' });
        await repo.addSmsLog({ rawSms, txnId: id });
        const [txns, smsLog] = await Promise.all([repo.listTransactions(), repo.listSmsLog()]);
        set({ txns, smsLog });
        showToast(cat ? `Auto-added: ${merchant}` : 'Couldn’t recognise — flagged red');
      } catch (err) {
        showToast(err?.message || 'Couldn’t process that SMS');
      }
    },
    [set, showToast],
  );

  // Review-import staging: these edit state.reviewImported in place (not the
  // DB) until the user confirms the batch — nothing is persisted until then.
  const setReviewCategory = useCallback(
    (txnId, catId) => {
      const next = (state.reviewImported || []).map((t) => (t.id === txnId ? { ...t, cat: catId } : t));
      set({ reviewImported: next });
    },
    [state.reviewImported, set],
  );

  const cancelReview = useCallback(() => set({ reviewImported: null, reviewSource: '', screen: 'upload' }), [set]);

  const confirmReview = useCallback(async () => {
    const batch = state.reviewImported || [];
    await addManualTransactions(batch);
    const stillFlagged = batch.some((t) => !t.cat);
    set({ reviewImported: null, reviewSource: '', screen: 'transactions', filter: stillFlagged ? 'review' : 'all' });
    showToast(`${batch.length} transaction${batch.length === 1 ? '' : 's'} added`);
  }, [state.reviewImported, addManualTransactions, set, showToast]);

  const value = useMemo(
    () => ({
      state,
      set,
      go,
      goReview,
      openMenu,
      closeMenu,
      showToast,
      toggleAccount,
      setCurrency,
      setTaxRegime,
      setTax80cInvested,
      toggleAppLock,
      unlockApp,
      obNext,
      obBack,
      finishOnboarding,
      addCategory,
      openCategorySheet,
      closeCategorySheet,
      setTxnCategory,
      addManualTransactions,
      addBudget,
      addReminder,
      toggleReminderPaid,
      deleteReminder,
      addGoal,
      addToGoal,
      deleteGoal,
      addNetWorthItem,
      deleteNetWorthItem,
      setPatternPref,
      clearPatternPref,
      simulateSms,
      setReviewCategory,
      cancelReview,
      confirmReview,
    }),
    [
      state,
      set,
      go,
      goReview,
      openMenu,
      closeMenu,
      showToast,
      toggleAccount,
      setCurrency,
      setTaxRegime,
      setTax80cInvested,
      toggleAppLock,
      unlockApp,
      obNext,
      obBack,
      finishOnboarding,
      addCategory,
      openCategorySheet,
      closeCategorySheet,
      setTxnCategory,
      addManualTransactions,
      addBudget,
      addReminder,
      toggleReminderPaid,
      deleteReminder,
      addGoal,
      addToGoal,
      deleteGoal,
      addNetWorthItem,
      deleteNetWorthItem,
      setPatternPref,
      clearPatternPref,
      simulateSms,
      setReviewCategory,
      cancelReview,
      confirmReview,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
