import { useRef, useState } from 'react';
import { colors, tint } from '../theme/tokens';
import { useApp } from '../state/AppContext';
import { detectDelimiter, parseCsv, rowsToTransactions } from '../services/csvImport';
import Amount from '../components/Amount';
import { fmt } from '../utils/currency';
import Sheet from '../components/Sheet';

const emptyMapping = () => ({
  hasHeader: true,
  dateCol: 0,
  merchantCol: 1,
  typeMode: 'signed',
  amountCol: 2,
  debitCol: 2,
  creditCol: 3,
});

export default function CsvImportScreen() {
  const { state, set, goBack, showToast, saveCsvProfile, addManualTransactions } = useApp();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [mapping, setMapping] = useState(emptyMapping());
  const [remember, setRemember] = useState(true);
  // Parsed rows the user is about to add, staged here (not yet in the DB)
  // until they confirm — mirrors how a receipt scan used to stage results.
  const [staged, setStaged] = useState(null);
  const [stagedSource, setStagedSource] = useState('');
  const [editingId, setEditingId] = useState(null);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const parsed = parseCsv(text, delimiter);
      if (!parsed.length) {
        showToast('Couldn’t find any rows in that file');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
    } catch {
      showToast('Couldn’t read that file');
    }
  };

  const applyProfile = (name) => {
    setProfileName(name);
    const p = state.csvProfiles.find((x) => x.name === name);
    if (p) setMapping({ ...emptyMapping(), ...p.mapping });
  };

  const colCount = rows ? Math.max(...rows.slice(0, 5).map((r) => r.length)) : 0;
  const preview = rows ? rows.slice(0, 4) : [];

  const doImport = async () => {
    const txns = rowsToTransactions(rows, mapping, profileName.trim() || fileName);
    if (!txns.length) {
      showToast('None of these rows could be read — check the column mapping');
      return;
    }
    if (remember && profileName.trim()) {
      await saveCsvProfile(profileName.trim(), mapping);
    }
    setStaged(txns);
    setStagedSource(profileName.trim() || fileName);
  };

  if (staged) {
    return (
      <CsvReviewStep
        imported={staged}
        source={stagedSource}
        categories={state.categories}
        editingId={editingId}
        setEditingId={setEditingId}
        onPick={(txnId, catId) => setStaged((list) => list.map((t) => (t.id === txnId ? { ...t, cat: catId } : t)))}
        onBack={() => setStaged(null)}
        onConfirm={async () => {
          await addManualTransactions(staged);
          const stillFlagged = staged.some((t) => !t.cat);
          set({ screen: 'transactions', filter: stillFlagged ? 'review' : 'all' });
          showToast(`${staged.length} transaction${staged.length === 1 ? '' : 's'} added`);
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={rows ? () => setRows(null) : goBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Import CSV</div>
      </div>

      {!rows && (
        <>
          <div style={{ fontSize: 13.5, color: colors.textSecondary, padding: '0 4px', lineHeight: 1.5 }}>
            Import a bank or card statement CSV directly — parsed on this device, nothing sent anywhere. You tell it which column is which; it remembers that mapping for next time.
          </div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 20, padding: '22px 18px', textAlign: 'left', cursor: 'pointer', border: 'none' }}
          >
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600 }}>Choose a CSV file</div>
            <div style={{ fontSize: 13.5, color: colors.accentGreen3, marginTop: 3 }}>Exported from your bank or card's net-banking site</div>
          </button>

          {state.csvProfiles.length > 0 && (
            <div style={{ fontSize: 12.5, color: colors.textTertiary, padding: '0 4px' }}>
              Remembered banks: {state.csvProfiles.map((p) => p.name).join(', ')}
            </div>
          )}
        </>
      )}

      {rows && (
        <>
          <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 16, padding: '13px 15px', fontSize: 13.5 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{fileName} · {rows.length} row{rows.length === 1 ? '' : 's'} found</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11.5, width: '100%' }}>
                <tbody>
                  {preview.map((r, ri) => (
                    <tr key={ri}>
                      {Array.from({ length: colCount }).map((_, ci) => (
                        <td key={ci} style={{ border: `1px solid ${colors.divider}`, padding: '4px 6px', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', color: ri === 0 && mapping.hasHeader ? colors.textSecondary : colors.ink }}>
                          {r[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={mapping.hasHeader} onChange={(e) => setMapping((m) => ({ ...m, hasHeader: e.target.checked }))} />
              First row is a header (skip it)
            </label>

            <ColPicker label="Date column" value={mapping.dateCol} count={colCount} onChange={(v) => setMapping((m) => ({ ...m, dateCol: v }))} />
            <ColPicker label="Merchant / description column" value={mapping.merchantCol} count={colCount} onChange={(v) => setMapping((m) => ({ ...m, merchantCol: v }))} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setMapping((m) => ({ ...m, typeMode: 'signed' }))}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: mapping.typeMode === 'signed' ? colors.primary : colors.bgApp, color: mapping.typeMode === 'signed' ? colors.onPrimary : colors.textSecondary, border: `1px solid ${colors.cardBorder}` }}
              >
                One amount column (± sign)
              </button>
              <button
                onClick={() => setMapping((m) => ({ ...m, typeMode: 'debitCredit' }))}
                style={{ flex: 1, padding: '9px 10px', borderRadius: 100, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: mapping.typeMode === 'debitCredit' ? colors.primary : colors.bgApp, color: mapping.typeMode === 'debitCredit' ? colors.onPrimary : colors.textSecondary, border: `1px solid ${colors.cardBorder}` }}
              >
                Separate debit / credit columns
              </button>
            </div>

            {mapping.typeMode === 'signed' ? (
              <ColPicker label="Amount column" value={mapping.amountCol} count={colCount} onChange={(v) => setMapping((m) => ({ ...m, amountCol: v }))} />
            ) : (
              <>
                <ColPicker label="Debit (money out) column" value={mapping.debitCol} count={colCount} onChange={(v) => setMapping((m) => ({ ...m, debitCol: v }))} />
                <ColPicker label="Credit (money in) column" value={mapping.creditCol} count={colCount} onChange={(v) => setMapping((m) => ({ ...m, creditCol: v }))} />
              </>
            )}

            <input
              value={profileName}
              onChange={(e) => applyProfile(e.target.value)}
              placeholder="Bank name, e.g. HDFC — to remember this mapping"
              list="csv-bank-profiles"
              style={inputStyle}
            />
            <datalist id="csv-bank-profiles">
              {state.csvProfiles.map((p) => <option key={p.name} value={p.name} />)}
            </datalist>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: colors.textSecondary }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember this mapping for next time
            </label>
          </div>

          <button
            onClick={doImport}
            style={{ background: colors.primary, color: colors.onPrimary, borderRadius: 100, padding: 15, textAlign: 'center', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
          >
            Import {rows.length - (mapping.hasHeader ? 1 : 0)} rows
          </button>
        </>
      )}
    </div>
  );
}

// A lightweight staging list — the imported rows aren't in the database yet,
// so anything uncategorised can be fixed here before they're added for real.
function CsvReviewStep({ imported, source, categories, editingId, setEditingId, onPick, onBack, onConfirm }) {
  const needCount = imported.filter((t) => !t.cat).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(env(safe-area-inset-top, 0px) + 74px) 16px 120px', display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
        <button onClick={onBack} style={backBtnStyle}>
          <BackIcon />
        </button>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700 }}>Review import</div>
      </div>

      <div style={{ background: colors.successTint, border: `1px solid ${colors.successBorder}`, borderRadius: 16, padding: '13px 15px', fontSize: 14 }}>
        <span style={{ fontWeight: 600, color: colors.primary }}>{imported.length} transactions found</span>
        <span style={{ color: colors.successText }}> in {source || 'your file'}</span>
      </div>

      {needCount > 0 && (
        <div style={{ background: colors.dangerTint, border: `1px solid ${colors.dangerBorder}`, borderRadius: 16, padding: '13px 15px', fontSize: 14 }}>
          <span style={{ fontWeight: 600, color: colors.danger }}>{needCount} need your help</span>
          <span style={{ color: '#B96A5B' }}> — tap the red ones to pick a category</span>
        </div>
      )}

      <div style={{ background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 20, padding: '8px 16px', display: 'flex', flexDirection: 'column' }}>
        {imported.map((t) => {
          const cat = categories.find((c) => c.id === t.cat);
          const uncat = !t.cat;
          const income = t.type === 'income';
          return (
            <button
              key={t.id}
              onClick={() => setEditingId(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${colors.divider}`, textAlign: 'left', width: '100%' }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: uncat ? colors.dangerTint : tint(cat.color),
                  color: uncat ? colors.danger : cat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {uncat ? '?' : cat.mono}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.merchant}</div>
                <div style={{ fontSize: 12.5, color: uncat ? colors.danger : colors.textSecondary, fontWeight: uncat ? 600 : 400 }}>
                  {uncat ? 'Needs review — tap to categorise' : `${t.date} · ${cat.label}`}
                </div>
              </div>
              <Amount style={{ fontSize: 14.5, fontWeight: 600, color: income ? colors.primary : colors.ink }}>
                {income ? '+' : '−'}{fmt(t.amount)}
              </Amount>
            </button>
          );
        })}
      </div>

      <div style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
        <button
          onClick={onConfirm}
          style={{
            background: needCount > 0 ? colors.textSecondary : colors.primary,
            color: colors.onPrimary,
            borderRadius: 100,
            padding: 16,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
            boxShadow: '0 8px 24px rgba(16,36,28,0.25)',
          }}
        >
          {needCount > 0 ? `Add anyway (${needCount} still flagged)` : 'Add to my transactions'}
        </button>
      </div>

      {editingId && (
        <Sheet
          onClose={() => setEditingId(null)}
          header={
            <>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Pick a category</div>
              {imported.find((t) => t.id === editingId) && <div style={{ fontSize: 13.5, color: colors.textSecondary, marginTop: 2 }}>{imported.find((t) => t.id === editingId).merchant}</div>}
            </>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {categories
              .filter((c) => c.id !== 'income')
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onPick(editingId, c.id); setEditingId(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, background: colors.cardSurface, border: `1px solid ${colors.cardBorder}`, borderRadius: 14, padding: '10px 11px', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: tint(c.color), color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                    {c.mono}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.label}</div>
                </button>
              ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ColPicker({ label, value, count, onChange }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} style={inputStyle}>
        {Array.from({ length: count }).map((_, i) => (
          <option key={i} value={i}>Column {i + 1}</option>
        ))}
      </select>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: colors.bgApp,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 13.5,
  color: colors.ink,
  boxSizing: 'border-box',
};

const backBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: colors.cardSurface,
  border: `1px solid ${colors.cardBorder}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" style={{ color: 'var(--c-ink)' }}>
      <path d="M8 1L2 7.5 8 14" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
