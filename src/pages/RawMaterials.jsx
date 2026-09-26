import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getRawMaterialItems, createRawMaterialItem, updateRawMaterialItem, deleteRawMaterialItem,
  getRawMaterialConsumption, createRawMaterialConsumption, deleteRawMaterialConsumption,
} from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const ITEM_CATEGORIES = [
  'Flour & Grains', 'Pulses & Legumes', 'Dairy', 'Oil & Ghee',
  'Spices & Masalas', 'Beverages & Powders', 'Vegetables', 'Fruits',
  'Sweeteners', 'Packaging', 'Miscellaneous',
];
const USED_FOR_OPTIONS = [
  'Tea', 'Bonda', 'Bajji', 'Sandwich', 'Juice', 'Snacks', 'Sweets', 'Other',
];

const today = () => new Date().toISOString().slice(0, 10);
const fmtN  = (n, dec = 3) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: dec });

const EMPTY_ITEM = { name: '', unit: 'kg', category: '' };
const EMPTY_ENTRY = { item_id: '', quantity_used: '', used_for: '', notes: '', consumption_date: today() };

export default function RawMaterials() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab]   = useState('consumption'); // 'consumption' | 'items'

  // ── Master items ──────────────────────────────────────────────────────────
  const [items,     setItems]     = useState([]);
  const [units,     setUnits]     = useState([]);
  const [itemsLoad, setItemsLoad] = useState(true);

  // item modal
  const [itemModal,  setItemModal]  = useState(null); // null | 'add' | 'edit'
  const [itemForm,   setItemForm]   = useState(EMPTY_ITEM);
  const [editItemId, setEditItemId] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemErr,    setItemErr]    = useState('');

  // ── Consumption log ───────────────────────────────────────────────────────
  const [records,     setRecords]     = useState([]);
  const [summary,     setSummary]     = useState([]);
  const [consLoad,    setConsLoad]    = useState(true);
  const [filterDate,  setFilterDate]  = useState(today());
  const [filterItem,  setFilterItem]  = useState('');

  // bulk add form (multiple items at once)
  const [entries,   setEntries]   = useState([{ ...EMPTY_ENTRY }]);
  const [consDate,  setConsDate]  = useState(today());
  const [consSaving, setConsSaving] = useState(false);
  const [consErr,   setConsErr]   = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ── Load items ────────────────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setItemsLoad(true);
    try {
      const res = await getRawMaterialItems();
      setItems(res.data.items || []);
      setUnits(res.data.units || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setItemsLoad(false); }
  }, [navigate, signOut]);

  // ── Load consumption ──────────────────────────────────────────────────────
  const loadConsumption = useCallback(async () => {
    setConsLoad(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterItem) params.item_id = filterItem;
      const res = await getRawMaterialConsumption(params);
      setRecords(res.data.records || []);
      setSummary(res.data.summary || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setConsLoad(false); }
  }, [filterDate, filterItem, navigate, signOut]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadConsumption(); }, [loadConsumption]);

  // ── Item CRUD ─────────────────────────────────────────────────────────────
  const openAddItem = () => { setItemForm(EMPTY_ITEM); setItemErr(''); setEditItemId(null); setItemModal('add'); };
  const openEditItem = (it) => {
    setItemForm({ name: it.name, unit: it.unit, category: it.category || '' });
    setEditItemId(it.id); setItemErr(''); setItemModal('edit');
  };
  const closeItemModal = () => { setItemModal(null); setEditItemId(null); };
  const handleItemChange = (e) => setItemForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleItemSubmit = async (ev) => {
    ev.preventDefault();
    if (!itemForm.name.trim()) { setItemErr('Name is required.'); return; }
    setItemSaving(true); setItemErr('');
    try {
      if (itemModal === 'add') {
        await createRawMaterialItem(itemForm);
        showToast('Item added!');
      } else {
        await updateRawMaterialItem(editItemId, itemForm);
        showToast('Item updated!');
      }
      closeItemModal(); loadItems();
    } catch (err) { setItemErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setItemSaving(false); }
  };

  const handleDeleteItem = async (it) => {
    if (!window.confirm(`Delete "${it.name}"?`)) return;
    try { await deleteRawMaterialItem(it.id); showToast('Deleted.'); loadItems(); }
    catch (err) { showToast(err.response?.data?.detail || 'Cannot delete — may have usage records.', false); }
  };

  const handleToggleItemActive = async (it) => {
    try { await updateRawMaterialItem(it.id, { active: !it.active }); loadItems(); }
    catch { showToast('Failed.', false); }
  };

  // ── Consumption entries ───────────────────────────────────────────────────
  const addEntryRow = () => setEntries(e => [...e, { ...EMPTY_ENTRY }]);
  const removeEntryRow = (i) => setEntries(e => e.filter((_, idx) => idx !== i));
  const updateEntry = (i, field, val) =>
    setEntries(e => e.map((en, idx) => idx === i ? { ...en, [field]: val } : en));

  // When item_id changes on a row, pre-fill unit hint
  const activeItems = items.filter(it => it.active !== false);

  const handleConsSubmit = async (ev) => {
    ev.preventDefault();
    const valid = entries.filter(e => e.item_id && parseFloat(e.quantity_used) > 0);
    if (!valid.length) { setConsErr('Add at least one item with quantity.'); return; }
    setConsSaving(true); setConsErr('');
    try {
      await createRawMaterialConsumption({ consumption_date: consDate, entries: valid });
      showToast(`${valid.length} usage record(s) saved!`);
      setEntries([{ ...EMPTY_ENTRY }]);
      loadConsumption();
    } catch (err) { setConsErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setConsSaving(false); }
  };

  const handleDeleteRecord = async (r) => {
    if (!window.confirm('Delete this consumption record?')) return;
    try { await deleteRawMaterialConsumption(r.id); showToast('Deleted.'); loadConsumption(); }
    catch { showToast('Failed.', false); }
  };

  // grouped records by item for the log view
  const groupedRecords = records.reduce((acc, r) => {
    const k = r.item_name;
    if (!acc[k]) acc[k] = { unit: r.unit, logs: [] };
    acc[k].logs.push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg,${B.cream} 0%,${B.creamMid} 60%,#ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown},${B.brown})`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Raw Materials</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Dashboard</button>
          <button onClick={() => { signOut(); navigate('/login'); }}
            className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: '#3d1f00' }}>Logout</button>
        </div>
      </nav>

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>{toast.msg}</div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg,${B.darkBrown},#5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
          <div className="p-5">
            <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
              Raw Material Tracker
            </h2>
            <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
              Manage your ingredient master list and record daily consumption
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'consumption', label: 'Daily Consumption' },
            { key: 'items',       label: 'Manage Items' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={tab === t.key
                ? { background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})`, color: B.goldLight, boxShadow: '0 2px 8px rgba(45,26,14,0.3)' }
                : { background: '#fff', border: '1px solid #e8d5a3', color: B.text }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB: DAILY CONSUMPTION                                  */}
        {/* ═══════════════════════════════════════════════════════ */}
        {tab === 'consumption' && (
          <div className="space-y-5">

            {/* Entry form */}
            <div className="rounded-2xl shadow-sm overflow-hidden"
              style={{ background: '#fff', border: `1.5px solid ${B.gold}` }}>
              <div className="px-5 py-3" style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                <h3 className="font-bold text-sm" style={{ color: B.goldLight }}>Record Today's Usage</h3>
              </div>
              <form onSubmit={handleConsSubmit} className="p-5 space-y-4">
                {consErr && (
                  <div className="px-3 py-2 rounded-lg text-sm font-semibold"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>{consErr}</div>
                )}
                <div className="flex items-center gap-4 flex-wrap">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.textLight }}>Consumption Date</label>
                    <input type="date" value={consDate} onChange={e => setConsDate(e.target.value)}
                      className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} />
                  </div>
                </div>

                {/* Entry rows */}
                <div className="space-y-3">
                  {entries.map((en, i) => {
                    const selItem = activeItems.find(it => String(it.id) === String(en.item_id));
                    return (
                      <div key={i} className="rounded-xl p-3 border flex flex-wrap gap-3 items-end"
                        style={{ borderColor: '#e8d5a3', background: '#fffbf2' }}>
                        {/* Item */}
                        <div className="flex-1 min-w-[180px]">
                          <label className="text-xs font-bold mb-1 block" style={{ color: B.textLight }}>Raw Material *</label>
                          <select value={en.item_id}
                            onChange={e => updateEntry(i, 'item_id', e.target.value)}
                            className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ borderColor: en.item_id ? B.gold : '#e8d5a3' }}>
                            <option value="">— Select Item —</option>
                            {activeItems.map(it => (
                              <option key={it.id} value={it.id}>
                                {it.name} ({it.unit}){it.category ? ` · ${it.category}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        {/* Qty */}
                        <div className="w-32">
                          <label className="text-xs font-bold mb-1 block" style={{ color: B.textLight }}>
                            Qty{selItem ? ` (${selItem.unit})` : ''} *
                          </label>
                          <input type="number" step="0.001" min="0.001"
                            value={en.quantity_used}
                            onChange={e => updateEntry(i, 'quantity_used', e.target.value)}
                            className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ borderColor: '#e8d5a3' }} placeholder="0.000" />
                        </div>
                        {/* Used for */}
                        <div className="w-36">
                          <label className="text-xs font-bold mb-1 block" style={{ color: B.textLight }}>Used For</label>
                          <select value={en.used_for}
                            onChange={e => updateEntry(i, 'used_for', e.target.value)}
                            className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ borderColor: '#e8d5a3' }}>
                            <option value="">— Select —</option>
                            {USED_FOR_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        {/* Notes */}
                        <div className="flex-1 min-w-[140px]">
                          <label className="text-xs font-bold mb-1 block" style={{ color: B.textLight }}>Notes</label>
                          <input type="text" value={en.notes}
                            onChange={e => updateEntry(i, 'notes', e.target.value)}
                            className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                            style={{ borderColor: '#e8d5a3' }} placeholder="Optional…" />
                        </div>
                        {/* Remove row */}
                        {entries.length > 1 && (
                          <button type="button" onClick={() => removeEntryRow(i)}
                            className="text-xs font-bold px-3 py-2 rounded-xl active:scale-95"
                            style={{ background: '#fee2e2', color: '#dc2626' }}>
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={addEntryRow}
                    className="text-sm font-bold px-4 py-2 rounded-xl active:scale-95"
                    style={{ background: '#f0f9ff', border: '1px dashed #7c3aed', color: '#7c3aed' }}>
                    + Add Another Item
                  </button>
                  <button type="submit" disabled={consSaving}
                    className="text-sm font-bold px-6 py-2 rounded-xl active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {consSaving ? 'Saving…' : 'Save Usage Record'}
                  </button>
                </div>
              </form>
            </div>

            {/* Filter */}
            <div className="rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4"
              style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>View Date</label>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e8d5a3' }} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Filter by Item</label>
                <select value={filterItem} onChange={e => setFilterItem(e.target.value)}
                  className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e8d5a3' }}>
                  <option value="">All Items</option>
                  {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                </select>
              </div>
              <button onClick={loadConsumption}
                className="text-sm font-bold px-4 py-2 rounded-xl active:scale-95"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
                Refresh
              </button>
            </div>

            {/* Summary for the day */}
            {!consLoad && summary.length > 0 && (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-5 py-3" style={{ background: '#fffbf2', borderBottom: '1px solid #e8d5a3' }}>
                  <h4 className="text-sm font-bold" style={{ color: B.text }}>Summary — {filterDate}</h4>
                </div>
                <div className="flex flex-wrap gap-3 p-4">
                  {summary.map(s => (
                    <div key={s.item_id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                      style={{ background: '#fff9ee', border: '1px solid #e8d5a3' }}>
                      <span className="text-sm font-semibold" style={{ color: B.text }}>{s.item_name}</span>
                      <span className="text-sm font-extrabold" style={{ color: B.brown }}>
                        {fmtN(s.total_used)} {s.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Consumption log */}
            <div className="rounded-2xl shadow-sm overflow-hidden"
              style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              {consLoad ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-4 animate-spin"
                    style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-lg font-semibold" style={{ color: B.textLight }}>No consumption records for this date</p>
                  <p className="text-sm mt-1" style={{ color: '#bbb' }}>Use the form above to log usage.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Date', 'Raw Material', 'Category', 'Quantity Used', 'Used For', 'Notes', 'By', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, idx) => (
                        <tr key={r.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                            {r.consumption_date?.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{r.item_name}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{r.item_category || '—'}</td>
                          <td className="px-4 py-3 font-extrabold" style={{ color: B.brown }}>
                            {fmtN(r.quantity_used)} {r.unit}
                          </td>
                          <td className="px-4 py-3">
                            {r.used_for ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#ede9fe', color: '#7c3aed' }}>{r.used_for}</span>
                            ) : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[150px]" style={{ color: B.textLight }}>
                            <div className="truncate" title={r.notes || ''}>{r.notes || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{r.recorded_by || '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDeleteRecord(r)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* TAB: MANAGE ITEMS                                       */}
        {/* ═══════════════════════════════════════════════════════ */}
        {tab === 'items' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openAddItem}
                className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                + Add Raw Material
              </button>
            </div>

            <div className="rounded-2xl shadow-sm overflow-hidden"
              style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              {itemsLoad ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-4 animate-spin"
                    style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-12">
                  <p className="font-semibold" style={{ color: B.textLight }}>No raw materials yet.</p>
                  <p className="text-sm mt-1" style={{ color: '#bbb' }}>
                    Add items like gram flour, oil, milk, tea powder, sugar…
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Name', 'Category', 'Unit', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                            opacity: it.active === false ? 0.55 : 1 }}>
                          <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{it.name}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{it.category || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                              {it.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: it.active !== false ? '#dcfce7' : '#fee2e2',
                                color: it.active !== false ? '#16a34a' : '#dc2626' }}>
                              {it.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditItem(it)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                              <button onClick={() => handleToggleItemActive(it)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: it.active !== false ? '#fef3c7' : '#dcfce7',
                                  color: it.active !== false ? '#b45309' : '#16a34a' }}>
                                {it.active !== false ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => handleDeleteItem(it)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Item Modal ── */}
      {itemModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {itemModal === 'add' ? '+ Add Raw Material' : 'Edit Raw Material'}
              </h3>
              {itemErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{itemErr}</div>
              )}
              <form onSubmit={handleItemSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Name *</label>
                  <input type="text" name="name" value={itemForm.name} onChange={handleItemChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder="e.g. Gram Flour, Tea Powder, Milk…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Unit *</label>
                    <select name="unit" value={itemForm.unit} onChange={handleItemChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }}>
                      {units.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category</label>
                    <select name="category" value={itemForm.category} onChange={handleItemChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }}>
                      <option value="">— None —</option>
                      {ITEM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeItemModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={itemSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {itemSaving ? 'Saving…' : itemModal === 'add' ? 'Add Item' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
