import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import * as repo from '../db/repo';
import { resetDatabase } from '../db/sqlite';
import { checkLockAvailable, unlock as biometricUnlock } from '../services/appLock';
import { smsAvailable, ensureSmsPermission, hasSmsPermission, readNewTransactions } from '../services/smsReader';
import { smsSignature, parseSms, extractAmount, extractMerchant } from '../services/smsParse';
import { setGeminiKey } from '../services/aiExtract';
import { writeAutoBackup, readAutoBackup } from '../services/autoBackup';

const AppStateContext = createContext(null);

const DEFAULT_ACCOUNTS = { bank: true, card: true, upi: true, sms: true, cash: false, invest: true, loans: false };

// Shown as the transaction's "account" line so a hand-entered row reads the
// same way an SMS-derived one does.
const METHOD_LABELS = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank transfer' };

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
  salaryDay: 0, // 0 = not set (use calendar month); 1-31 = pay day; 32 = last day of month
  geminiKey: '',
  disabledCats: [],
  customPatterns: [],
  appLock: false,
  locked: false,
  menuOpen: false,
  // Screens visited on the way here, so Android's back gesture has somewhere to
  // return to. Without this the gesture had no history and simply closed the app.
  navStack: [],
  // Money-mentioning messages the parser couldn't interpret. Surfaced to the
  // user rather than dropped, so nothing goes missing silently.
  smsUnmatched: [],
  // A snapshot found on disk when the database came up empty — offered as
  // recovery instead of sending the user through onboarding again.
  recoverable: null,
  // { at, durable } for the last automatic snapshot, shown in Settings so the
  // user can see whether they're actually protected.
  lastAutoBackup: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.payload };
    case 'GO': {
      if (action.screen === state.screen) {
        return { ...state, sheetFor: null, addSheetOpen: false, menuOpen: false };
      }
      // Returning to a screen already in the stack unwinds to it rather than
      // stacking a loop (home → settings → home shouldn't need two backs).
      const idx = state.navStack.indexOf(action.screen);
      const navStack = idx >= 0 ? state.navStack.slice(0, idx) : [...state.navStack, state.screen];
      return { ...state, screen: action.screen, navStack, sheetFor: null, addSheetOpen: false, menuOpen: false };
    }
    case 'BACK': {
      if (!state.navStack.length) return state;
      const navStack = state.navStack.slice(0, -1);
      const screen = state.navStack[state.navStack.length - 1];
      return { ...state, screen, navStack, sheetFor: null, addSheetOpen: false, menuOpen: false };
    }
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
          disabledCatsJson,
          customPatternsJson,
          salaryDayStr,
          geminiKeyStr,
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
          repo.getSetting('disabledCats', null),
          repo.getSetting('customPatterns', null),
          repo.getSetting('salaryDay', '0'),
          repo.getSetting('geminiKey', ''),
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
          disabledCats: disabledCatsJson ? JSON.parse(disabledCatsJson) : [],
          customPatterns: customPatternsJson ? JSON.parse(customPatternsJson) : [],
          salaryDay: Number(salaryDayStr) || 0,
          geminiKey: geminiKeyStr || '',
          loading: false,
        });
        setGeminiKey(geminiKeyStr || '');

        // Database came up empty (wiped by a reinstall, most likely). Before
        // sending the user through onboarding and losing everything, see
        // whether an automatic snapshot is sitting on disk to offer back.
        if (!onboarded && txns.length === 0) {
          try {
            const found = await readAutoBackup();
            if (found) set({ recoverable: found });
          } catch {
            /* nothing recoverable — onboarding proceeds as normal */
          }
        }
      } catch (err) {
        set({ loading: false, loadError: err?.message || 'Could not open the local database' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recovery when the database can't be opened (e.g. a restored-but-
  // undecryptable DB): wipe it and reload the app to start clean.
  const resetApp = useCallback(async () => {
    await resetDatabase();
    window.location.reload();
  }, []);

  // Re-read all table-backed data into state (used after a restore-from-backup).
  const reloadData = useCallback(async () => {
    const [categories, txns, budgets, reminders, goals, netWorthItems, patternPrefs, smsLog] = await Promise.all([
      repo.listCategories(),
      repo.listTransactions(),
      repo.listBudgets(),
      repo.listReminders(),
      repo.listGoals(),
      repo.listNetWorthItems(),
      repo.listPatternPrefs(),
      repo.listSmsLog(),
    ]);
    set({ categories, txns, budgets, reminders, goals, netWorthItems, patternPrefs, smsLog });
  }, [set]);

  // Refs so the once-registered lifecycle listener always sees current values.
  const appLockRef = useRef(state.appLock);
  const onboardedRef = useRef(state.onboarded);
  const smsOnRef = useRef(state.accounts.sms);
  const autoScanRef = useRef(null); // set to scanSms after it's defined below
  const scanInFlightRef = useRef(false); // guards against concurrent scans (auto-sync + manual)
  useEffect(() => {
    appLockRef.current = state.appLock;
    onboardedRef.current = state.onboarded;
    smsOnRef.current = state.accounts.sms;
  }, [state.appLock, state.onboarded, state.accounts.sms]);

  // Bug 1 fix: auto-sync SMS silently on app resume (so new messages get
  // picked up without a manual tap), and re-lock on background. The silent
  // scan never prompts and is bounded by a timeout, so it can't freeze the UI.
  useEffect(() => {
    const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        if (appLockRef.current && onboardedRef.current) set({ locked: true });
        return;
      }
      if (onboardedRef.current && smsOnRef.current) autoScanRef.current?.({ silent: true });
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
  const goBack = useCallback(() => dispatch({ type: 'BACK' }), []);

  // Android back gesture / button. Capacitor raises this for the swipe too.
  // Nothing listened for it before, so the gesture had no history to walk and
  // Android just closed the app. Unwind the most recent thing first: an open
  // sheet, then the drawer, then the screen stack — and only exit from Home.
  const backStateRef = useRef(state);
  useEffect(() => {
    backStateRef.current = state;
  }, [state]);
  useEffect(() => {
    const handle = CapacitorApp.addListener('backButton', () => {
      const s = backStateRef.current;
      // Back must never slip past the lock screen — leave the app instead.
      if (s.locked) return CapacitorApp.exitApp();
      if (s.sheetFor) return set({ sheetFor: null });
      if (s.menuOpen) return set({ menuOpen: false });
      if (s.addSheetOpen) return set({ addSheetOpen: false });
      if (s.budgetSheetOpen) return set({ budgetSheetOpen: false });
      if (s.navStack.length) return dispatch({ type: 'BACK' });
      if (s.screen !== 'home' && s.onboarded) return dispatch({ type: 'GO', screen: 'home' });
      CapacitorApp.exitApp();
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [set]);
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

  // Gemini API key entered by the user (Settings). Stored in the encrypted DB,
  // never in the public web bundle. Pushed into the AI service immediately.
  const setGeminiApiKey = useCallback(
    (key) => {
      const k = (key || '').trim();
      set({ geminiKey: k });
      setGeminiKey(k);
      repo.setSetting('geminiKey', k);
    },
    [set],
  );

  // Salary day: 0 = calendar month; 1-31 = pay day; 32 = last day of month.
  // Feeds the budget cycle (#6) and "return by next salary" (#3).
  const setSalaryDay = useCallback(
    (day) => {
      const d = Math.max(0, Math.min(32, Number(day) || 0));
      set({ salaryDay: d });
      repo.setSetting('salaryDay', String(d));
    },
    [set],
  );

  // Onboarding category selection: toggling a category into disabledCats
  // hides it from the category pickers (categorize sheet, budget chips)
  // without deleting it, so past transactions keep their category.
  const toggleCategoryEnabled = useCallback(
    (id) => {
      const disabled = state.disabledCats.includes(id)
        ? state.disabledCats.filter((x) => x !== id)
        : [...state.disabledCats, id];
      set({ disabledCats: disabled });
      repo.setSetting('disabledCats', JSON.stringify(disabled));
    },
    [state.disabledCats, set],
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

  // ── automatic snapshots ──
  // Rewrite the snapshot shortly after anything changes. Debounced so a burst
  // of SMS imports produces one write, not dozens.
  useEffect(() => {
    if (state.loading || !state.onboarded) return undefined;
    const t = setTimeout(async () => {
      try {
        const res = await writeAutoBackup();
        if (res.ok) set({ lastAutoBackup: { at: res.at, durable: res.durable, cloud: res.cloud } });
      } catch {
        /* snapshot is best-effort; never interrupt the user */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [state.loading, state.onboarded, state.txns, state.budgets, state.reminders, state.goals, state.netWorthItems, set]);

  // Restore the snapshot found at startup. importBackup merges on original
  // ids, so running it more than once can't duplicate anything.
  const restoreFound = useCallback(async () => {
    const found = state.recoverable;
    if (!found) return;
    set({ processing: true, procTitle: 'Restoring your data', procSub: 'One moment…' });
    try {
      await repo.importBackup(found.data);
      await repo.setSetting('onboarded', '1');
      await reloadData();
      set({ onboarded: true, screen: 'home', recoverable: null, processing: false });
      showToast('Your data is back');
    } catch (err) {
      set({ processing: false });
      showToast(err?.message || 'Couldn’t restore that backup');
    }
  }, [state.recoverable, set, showToast, reloadData]);

  const dismissRecovery = useCallback(() => set({ recoverable: null }), [set]);

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

  // A single hand-entered transaction (the "+" button). Cash leaves no SMS
  // trail, so this is the only way it can ever be recorded.
  const addManualTransaction = useCallback(
    async ({ merchant, amount, type, method, cat, note, occurredAt }) => {
      const when = occurredAt || Date.now();
      await repo.addTransaction({
        merchant,
        account: method ? METHOD_LABELS[method] || 'Added by you' : 'Added by you',
        date: new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        amount,
        cat: cat ?? null,
        type,
        source: 'manual',
        note: note ?? null,
        method: method ?? null,
        occurredAt: when,
      });
      set({ txns: await repo.listTransactions() });
      showToast(type === 'income' ? 'Money in added' : 'Spend added');
    },
    [set, showToast],
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
    async (catId, limit, opts) => {
      await repo.upsertBudget(catId, limit, opts);
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

  // User-defined recurring items shown alongside auto-detected patterns.
  const addCustomPattern = useCallback(
    ({ label, amount, cadence }) => {
      const next = [...state.customPatterns, { id: `cp_${Date.now()}`, label, amount: Math.round(amount), cadence }];
      set({ customPatterns: next });
      repo.setSetting('customPatterns', JSON.stringify(next));
      showToast(`"${label}" added`);
    },
    [state.customPatterns, set, showToast],
  );

  const deleteCustomPattern = useCallback(
    (id) => {
      const next = state.customPatterns.filter((p) => p.id !== id);
      set({ customPatterns: next });
      repo.setSetting('customPatterns', JSON.stringify(next));
    },
    [state.customPatterns, set],
  );

  // ── real SMS scan: reads inbox, parses bank/UPI alerts, dedupes, inserts ──
  // `silent` mode (used by auto-sync on app open/resume) never prompts for
  // permission and stays quiet unless it actually adds something — so opening
  // the app doesn't nag or interrupt. Whole flow is wrapped so a plugin hang
  // (now bounded by a 12s timeout in smsReader) can never freeze the UI.
  const scanSms = useCallback(
    async ({ silent = false, deep = false } = {}) => {
      if (!smsAvailable()) {
        if (!silent) showToast('SMS reading works on an Android phone only');
        return;
      }
      // Concurrency guard: auto-sync (on open/resume) and a manual tap could
      // otherwise run at the same time, both see the same messages as new, and
      // both insert them — the duplicate rows the user hit. Only one at a time.
      if (scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      try {
        const granted = silent ? await hasSmsPermission() : await ensureSmsPermission();
        if (!granted) {
          if (!silent) showToast('SMS permission is needed to auto-track from messages');
          return;
        }
        const sinceMs = Number(await repo.getSetting('smsLastRead', '0')) || 0;
        const ignores = new Set(await repo.listSmsIgnores());
        const { transactions: found, newest, unmatched } = await readNewTransactions(sinceMs, ignores, { deep });

        // Exact de-dup: never import a message whose exact body we've already
        // imported. This is precise (unlike the old amount+type+day check, which
        // wrongly merged two different same-amount payments on one day) and is
        // race-proof even if the high-water mark lags.
        const importedBodies = new Set((await repo.listImportedSmsBodies()).map((b) => (b || '').trim()));
        let added = 0;
        for (const t of found) {
          const bodyKey = (t.rawSms || '').trim();
          if (importedBodies.has(bodyKey)) continue;
          importedBodies.add(bodyKey);
          const dayLabel = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          const id = await repo.addTransaction({
            merchant: t.merchant,
            account: t.address || 'SMS · auto-tracked',
            date: dayLabel,
            amount: t.amount,
            cat: null, // always left for review; BNPL especially needs confirming
            type: t.type,
            source: 'sms',
            note: t.bnpl ? `Pay-later (${t.bnpl}) — confirm what this was` : null,
            smsAddress: t.address || null,
            smsDate: t.date || null,
          });
          await repo.addSmsLog({ rawSms: t.rawSms, txnId: id });
          // Messages folded in as duplicates are logged against the same
          // transaction, so the detail sheet can show them and offer to split
          // one back out if the merge was wrong.
          for (const m of t.mergedFrom || []) {
            const dupKey = (m.rawSms || '').trim();
            if (importedBodies.has(dupKey)) continue;
            importedBodies.add(dupKey);
            await repo.addSmsLog({ rawSms: m.rawSms, txnId: id });
          }
          added += 1;
        }

        await repo.setSetting('smsLastRead', String(newest));
        // Drop anything we've since imported or that the user already has, so
        // the "not recognised" list only ever shows genuinely unhandled texts.
        const stillUnmatched = (unmatched || []).filter((u) => !importedBodies.has((u.rawSms || '').trim()));
        const [txns, smsLog] = await Promise.all([repo.listTransactions(), repo.listSmsLog()]);
        set({ txns, smsLog, ...(deep || stillUnmatched.length ? { smsUnmatched: stillUnmatched } : {}) });
        if (added) showToast(`Added ${added} transaction${added === 1 ? '' : 's'} from SMS`);
        else if (!silent) showToast(deep ? 'Deep scan finished — nothing new to add' : 'No new transactions in your messages');
      } catch (err) {
        if (!silent) showToast(err?.message || 'Couldn’t read your messages');
      } finally {
        scanInFlightRef.current = false;
      }
    },
    [set, showToast],
  );

  // ── editing ──
  // Change an existing transaction. Anything imported from SMS is marked as
  // hand-corrected so a later re-scan can't quietly undo the user's edit.
  const editTransaction = useCallback(
    async (id, patch) => {
      const next = { ...patch };
      if (next.occurredAt !== undefined) {
        next.occurred_at = next.occurredAt;
        next.date = new Date(next.occurredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        delete next.occurredAt;
      }
      if (next.cat !== undefined) {
        next.category_id = next.cat;
        delete next.cat;
      }
      await repo.updateTransaction(id, next);
      set({ txns: await repo.listTransactions() });
      showToast('Transaction updated');
    },
    [set, showToast],
  );

  const editBudget = useCallback(
    async (catId, limit, opts) => {
      await repo.upsertBudget(catId, limit, opts);
      set({ budgets: await repo.listBudgets(), budgetSheetOpen: false });
      showToast('Budget updated');
    },
    [set, showToast],
  );

  const removeBudget = useCallback(
    async (catId) => {
      await repo.deleteBudget(catId);
      set({ budgets: await repo.listBudgets() });
      showToast('Budget removed');
    },
    [set, showToast],
  );

  const editGoal = useCallback(
    async (id, patch) => {
      await repo.updateGoal(id, patch);
      set({ goals: await repo.listGoals() });
      showToast('Goal updated');
    },
    [set, showToast],
  );

  const editReminder = useCallback(
    async (id, patch) => {
      await repo.updateReminder(id, patch);
      set({ reminders: await repo.listReminders() });
      showToast('Bill updated');
    },
    [set, showToast],
  );

  // Attach / edit a free-text note on a transaction.
  const setTransactionNote = useCallback(
    async (id, note) => {
      await repo.setTransactionNote(id, note);
      set({ txns: await repo.listTransactions() });
    },
    [set],
  );

  // "Ignore this forever": mute the SMS template behind a transaction so it's
  // never re-imported, then remove the transaction it created.
  const ignoreSmsTransaction = useCallback(
    async (id) => {
      const raw = await repo.getRawSmsForTxn(id);
      if (raw) await repo.addSmsIgnore(smsSignature(raw));
      await repo.deleteTransaction(id);
      const [txns, smsLog] = await Promise.all([repo.listTransactions(), repo.listSmsLog()]);
      set({ txns, smsLog, sheetFor: null });
      showToast('Ignored — messages like this won’t be added again');
    },
    [set, showToast],
  );

  // ── unrecognised messages ──
  // A message we found money in but couldn't classify. The user tells us which
  // way it went and we import it, so nothing is stuck being invisible.
  const addUnmatchedAsTransaction = useCallback(
    async (entry, type) => {
      const amount = extractAmount(entry.rawSms);
      if (!amount) {
        showToast('Couldn’t read an amount in that message');
        return;
      }
      const merchant = extractMerchant(entry.rawSms) || (type === 'income' ? 'Credit' : 'Payment');
      const dayLabel = new Date(entry.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const id = await repo.addTransaction({
        merchant,
        account: entry.address || 'SMS · added by you',
        date: dayLabel,
        amount,
        cat: null,
        type,
        source: 'sms',
        smsAddress: entry.address || null,
        smsDate: entry.date || null,
      });
      await repo.addSmsLog({ rawSms: entry.rawSms, txnId: id });
      const [txns, smsLog] = await Promise.all([repo.listTransactions(), repo.listSmsLog()]);
      set({ txns, smsLog, smsUnmatched: state.smsUnmatched.filter((u) => u.rawSms !== entry.rawSms) });
      showToast(`Added as ${type === 'income' ? 'money in' : 'a spend'}`);
    },
    [state.smsUnmatched, set, showToast],
  );

  const ignoreUnmatched = useCallback(
    async (entry) => {
      await repo.addSmsIgnore(smsSignature(entry.rawSms));
      set({ smsUnmatched: state.smsUnmatched.filter((u) => u.rawSms !== entry.rawSms) });
      showToast('Ignored — messages like this won’t be shown again');
    },
    [state.smsUnmatched, set, showToast],
  );

  // "This wasn't a duplicate": give a merged message its own transaction and
  // re-point its log row, leaving the original with whatever messages remain.
  const splitMergedSms = useCallback(
    async (log, parentTxn) => {
      const parsed = parseSms(log.raw_sms);
      if (!parsed) {
        showToast('Couldn’t read that message as a transaction');
        return;
      }
      const id = await repo.addTransaction({
        merchant: parsed.merchant,
        account: parentTxn.account,
        date: parentTxn.date,
        amount: parsed.amount,
        cat: null,
        type: parsed.type,
        source: 'sms',
        smsAddress: parentTxn.sms_address ?? null,
        smsDate: parentTxn.sms_date ?? null,
      });
      await repo.reassignSmsLog(log.id, id);
      const [txns, smsLog] = await Promise.all([repo.listTransactions(), repo.listSmsLog()]);
      set({ txns, smsLog });
      showToast('Split into its own transaction');
    },
    [set, showToast],
  );

  // Plain delete of a transaction (no ignore).
  const deleteTransaction = useCallback(
    async (id) => {
      await repo.deleteTransaction(id);
      set({ txns: await repo.listTransactions(), sheetFor: null });
    },
    [set],
  );

  // Keep the resume listener pointed at the latest scanSms, and run one silent
  // auto-sync shortly after the app finishes loading (app-open pickup).
  useEffect(() => {
    autoScanRef.current = scanSms;
  }, [scanSms]);
  useEffect(() => {
    if (!state.loading && state.onboarded && state.accounts.sms) {
      const t = setTimeout(() => scanSms({ silent: true }), 800);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.loading, state.onboarded]);

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
      goBack,
      goReview,
      openMenu,
      closeMenu,
      reloadData,
      resetApp,
      restoreFound,
      dismissRecovery,
      showToast,
      toggleAccount,
      setCurrency,
      setSalaryDay,
      setGeminiApiKey,
      toggleCategoryEnabled,
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
      editTransaction,
      editBudget,
      removeBudget,
      editGoal,
      editReminder,
      setTransactionNote,
      ignoreSmsTransaction,
      addUnmatchedAsTransaction,
      ignoreUnmatched,
      splitMergedSms,
      deleteTransaction,
      addManualTransaction,
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
      addCustomPattern,
      deleteCustomPattern,
      scanSms,
      setReviewCategory,
      cancelReview,
      confirmReview,
    }),
    [
      state,
      set,
      go,
      goBack,
      goReview,
      openMenu,
      closeMenu,
      reloadData,
      resetApp,
      restoreFound,
      dismissRecovery,
      showToast,
      toggleAccount,
      setCurrency,
      setSalaryDay,
      setGeminiApiKey,
      toggleCategoryEnabled,
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
      editTransaction,
      editBudget,
      removeBudget,
      editGoal,
      editReminder,
      setTransactionNote,
      ignoreSmsTransaction,
      addUnmatchedAsTransaction,
      ignoreUnmatched,
      splitMergedSms,
      deleteTransaction,
      addManualTransaction,
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
      addCustomPattern,
      deleteCustomPattern,
      scanSms,
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
