import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import * as repo from '../db/repo';

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
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'GO':
      return { ...state, screen: action.screen, sheetFor: null, addSheetOpen: false };
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
        const [categories, txns, budgets, onboardedFlag, accountsJson] = await Promise.all([
          repo.listCategories(),
          repo.listTransactions(),
          repo.listBudgets(),
          repo.getSetting('onboarded', '0'),
          repo.getSetting('accounts', null),
        ]);
        const onboarded = onboardedFlag === '1';
        set({
          categories,
          txns,
          budgets,
          onboarded,
          accounts: accountsJson ? JSON.parse(accountsJson) : DEFAULT_ACCOUNTS,
          screen: onboarded ? 'home' : 'onboarding',
          loading: false,
        });
      } catch (err) {
        set({ loading: false, loadError: err?.message || 'Could not open the local database' });
      }
    })();
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

  const toggleAccount = useCallback(
    (key) => {
      const next = { ...state.accounts, [key]: !state.accounts[key] };
      set({ accounts: next });
      repo.setSetting('accounts', JSON.stringify(next));
    },
    [state.accounts, set],
  );

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
      showToast,
      toggleAccount,
      obNext,
      obBack,
      finishOnboarding,
      addCategory,
      openCategorySheet,
      closeCategorySheet,
      setTxnCategory,
      addManualTransactions,
      addBudget,
      setReviewCategory,
      cancelReview,
      confirmReview,
    }),
    [
      state,
      set,
      go,
      goReview,
      showToast,
      toggleAccount,
      obNext,
      obBack,
      finishOnboarding,
      addCategory,
      openCategorySheet,
      closeCategorySheet,
      setTxnCategory,
      addManualTransactions,
      addBudget,
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
