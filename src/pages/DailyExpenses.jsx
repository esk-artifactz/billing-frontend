import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDailyExpenses, createDailyExpense, updateDailyExpense, deleteDailyExpense,
  getExpenseCategories, createExpenseCategory, updateExpenseCategory, deleteExpenseCategory,
  getQueuedByUrl } from '../api/client';
import OfflineBanner from '../components/OfflineBanner';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const PAYMENT_MODES = ['cash', 'bank', 'upi'];
const PM_STYLE = {
  cash: { bg: '#dcfce7', color: '#16a34a', label: 'Cash' },
  bank: { bg: '#dbeafe', color: '#1d4ed8', label: 'Bank' },
  upi:  { bg: '#ede9fe', color: '#7c3aed', label: 'UPI' },
};
const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today  = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  expense_date: today(), category: '', description: '', amount: '',
  payment_mode: 'cash', paid_to: '', notes: '', supplier_id: '',
};

const EMPTY_CAT_FORM = { name: '', description: '', color: '#d4a017', sort_order: 0 };

const PRESET_COLORS = [
  '#d97706','#16a34a','#ca8a04','#0ea5e9','#f59e0b','#dc2626',
  '#7c3aed','#64748b','#f97316','#06b6d4','#8b5cf6','#be185d','#6b7280',
  '#d4a017','#10b981','#3b82f6','#ef4444','#8b5cf6',
];

export default function DailyExpenses() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab,         setTab]         = useState('expenses'); // 'expenses' | 'categories'

  const [expenses,    setExpenses]    = useState([]);
  const [pendingExp,  setPendingExp]  = useState([]); // queued offline expenses
  const [categories,  setCategories]  = useState([]);
  const [catObjs,     setCatObjs]     = useState([]); // full objects from /expense-categories
  const [suppliers,   setSuppliers]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);

  // Category manage modal
  const [catModal,    setCatModal]    = useState(null); // null | 'add' | 'edit'
  const [catForm,     setCatForm]     = useState(EMPTY_CAT_FORM);
  const [editCatId,   setEditCatId]   = useState(null);
  const [catSaving,   setCatSaving]   = useState(false);
  const [catErr,      setCatErr]      = useState('');

  // Filters
  const [filterDate,  setFilterDate]  = useState(today());
  const [filterMode,  setFilterMode]  = useState('all');

  // Modal
  const [modal,    setModal]    = useState(null); // null | 'add' | 'edit'
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [editId,   setEditId]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterMode !== 'all') params.payment_mode = filterMode;
      const res = await getDailyExpenses(params);
      setExpenses(res.data.expenses || []);
      setTotal(res.data.total || 0);
      setCategories(res.data.categories || []);
      setSuppliers(res.data.suppliers || []);
      // Also load full category objects for Manage tab
      const catRes = await getExpenseCategories();
      setCatObjs(catRes.data.categories || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    }
    // Always load locally queued items (works offline)
    try {
      const queued = await getQueuedByUrl('/daily-expenses');
      setPendingExp(queued);
    } catch { /* IDB unavailable */ }
    setLoading(false);
  }, [filterDate, filterMode, navigate, signOut]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, expense_date: filterDate || today() });
    setFormErr(''); setEditId(null); setModal('add');
  };
  const openEdit = (e) => {
    setForm({
      expense_date: e.expense_date?.slice(0, 10) || today(),
      category: e.category, description: e.description,
      amount: e.amount, payment_mode: e.payment_mode,
      paid_to: e.paid_to || '', notes: e.notes || '', supplier_id: '',
    });
    setEditId(e.id); setFormErr(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => {
      const updated = { ...f, [name]: value };
      // When supplier is picked from the supplier dropdown, auto-fill Paid To + Description
      if (name === 'supplier_id') {
        const sup = suppliers.find(s => String(s.id) === String(value));
        if (sup) {
          updated.paid_to = sup.name;
          if (!f.description) updated.description = `Payment to ${sup.name}`;
        } else {
          updated.paid_to = '';
        }
      }
      // When category changes away from Supplier Payment, clear supplier_id
      if (name === 'category' && value !== 'Supplier Payment') {
        updated.supplier_id = '';
      }
      return updated;
    });
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!form.category)    { setFormErr('Select a category.'); return; }
    if (!form.description) { setFormErr('Description is required.'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setFormErr('Enter a valid amount.'); return; }
    setSaving(true); setFormErr('');
    try {
      if (modal === 'add') {
        const res = await createDailyExpense(form);
        showToast(res.data?._queued
          ? 'Saved offline — will sync when network returns'
          : 'Expense recorded!');
      } else {
        await updateDailyExpense(editId, form);
        showToast('Expense updated!');
      }
      closeModal(); load();
    } catch (err) { setFormErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete this expense (${fmtINR(e.amount)})?`)) return;
    try { await deleteDailyExpense(e.id); showToast('Deleted.'); load(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed.', false); }
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const openAddCat = () => { setCatForm(EMPTY_CAT_FORM); setCatErr(''); setEditCatId(null); setCatModal('add'); };
  const openEditCat = (c) => {
    setCatForm({ name: c.name, description: c.description || '', color: c.color || '#d4a017', sort_order: c.sort_order || 0 });
    setEditCatId(c.id); setCatErr(''); setCatModal('edit');
  };
  const closeCatModal = () => { setCatModal(null); setEditCatId(null); };
  const handleCatChange = (e) => setCatForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCatSubmit = async (ev) => {
    ev.preventDefault();
    if (!catForm.name.trim()) { setCatErr('Category name is required.'); return; }
    setCatSaving(true); setCatErr('');
    try {
      if (catModal === 'add') { await createExpenseCategory(catForm); showToast('Category added!'); }
      else { await updateExpenseCategory(editCatId, catForm); showToast('Category updated!'); }
      closeCatModal(); load();
    } catch (err) { setCatErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setCatSaving(false); }
  };

  const handleCatDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await deleteExpenseCategory(c.id); showToast('Deleted.'); load(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed — may have expense records.', false); }
  };

  const handleCatToggle = async (c) => {
    try { await updateExpenseCategory(c.id, { active: !c.active }); load(); }
    catch { showToast('Failed.', false); }
  };

  // Summaries
  const byMode = expenses.reduce((acc, e) => {
    acc[e.payment_mode] = (acc[e.payment_mode] || 0) + parseFloat(e.amount || 0);
    return acc;
  }, {});
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + parseFloat(e.amount || 0);
    return acc;
  }, {});

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown}, ${B.midBrown}, ${B.brown})`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Daily Expenses</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Dashboard
          </button>
          <button onClick={() => { signOut(); navigate('/login'); }}
            className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: '#3d1f00' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Offline / pending-sync banner */}
      <OfflineBanner onSynced={() => load()} />

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg,${B.darkBrown},#5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                Daily Expense Tracker
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Record cash, bank &amp; UPI spends — vegetables, restocking, fuel and more
              </p>
            </div>
            {tab === 'expenses' && (
              <button onClick={openAdd}
                className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md flex-shrink-0"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                + Add Expense
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'expenses',   label: 'Daily Expenses' },
            { key: 'categories', label: 'Expense Categories' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={tab === t.key
                ? { background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})`, color: B.goldLight }
                : { background: '#fff', border: '1px solid #e8d5a3', color: B.text }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* EXPENSES TAB                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === 'expenses' && (
          <div className="space-y-5">

        {/* Filters */}
        <div className="rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-4"
          style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Date</label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#e8d5a3' }} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Payment Mode</label>
            <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
              className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#e8d5a3' }}>
              <option value="all">All Modes</option>
              {PAYMENT_MODES.map(m => <option key={m} value={m}>{PM_STYLE[m].label}</option>)}
            </select>
          </div>
          <button onClick={load}
            className="mt-4 text-sm font-bold px-4 py-2 rounded-xl active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        {!loading && expenses.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: B.textLight }}>Total Spent</p>
              <p className="text-2xl font-extrabold" style={{ color: B.brown }}>{fmtINR(total)}</p>
            </div>
            {Object.entries(PM_STYLE).map(([mode, s]) => (
              <div key={mode} className="rounded-2xl p-4 shadow-sm"
                style={{ background: s.bg, border: `1px solid ${s.color}40` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: s.color }}>{s.label}</p>
                <p className="text-2xl font-extrabold" style={{ color: s.color }}>
                  {fmtINR(byMode[mode] || 0)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Category breakdown */}
        {!loading && Object.keys(byCategory).length > 0 && (
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: B.textLight }}>By Category</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                const catObj = categories.find(c => (c.name ?? c) === cat);
                const dotColor = catObj?.color || B.gold;
                return (
                  <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                    style={{ background: '#fff9ee', border: `1px solid ${dotColor}55` }}>
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <span className="text-xs font-semibold" style={{ color: B.text }}>{cat}</span>
                    <span className="text-xs font-extrabold" style={{ color: B.brown }}>{fmtINR(amt)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Expense list */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : expenses.length === 0 && pendingExp.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-lg font-semibold" style={{ color: B.textLight }}>No expenses for this date</p>
              <p className="text-sm mt-1" style={{ color: '#bbb' }}>Click "+ Add Expense" to record a spend.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                    {['Date', 'Category', 'Description', 'Paid To', 'Amount', 'Mode', 'Recorded By', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Pending offline entries — synced later */}
                  {pendingExp.map((q) => {
                    const pm = PM_STYLE[q.data?.payment_mode] || PM_STYLE.cash;
                    return (
                      <tr key={`q-${q.id}`}
                        style={{ background: '#fff7ed', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: '#d97706' }}>
                          {q.data?.expense_date || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                            {q.data?.category || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold max-w-[200px]" style={{ color: B.darkBrown }}>
                          <div className="truncate" title={q.data?.description}>{q.data?.description}</div>
                          {q.last_error && (
                            <div className="text-xs text-red-500 truncate">Sync failed: {q.last_error}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{q.data?.paid_to || '—'}</td>
                        <td className="px-4 py-3 font-extrabold whitespace-nowrap" style={{ color: '#d97706' }}>
                          {fmtINR(q.data?.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: pm.bg, color: pm.color }}>
                            {pm.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fef3c7', color: '#b45309' }}>
                            ⏳ Pending sync
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#bbb' }}>—</td>
                      </tr>
                    );
                  })}
                  {expenses.map((e, idx) => {
                    const pm = PM_STYLE[e.payment_mode] || PM_STYLE.cash;
                    return (
                      <tr key={e.id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                          {e.expense_date?.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                            {e.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold max-w-[200px]" style={{ color: B.darkBrown }}>
                          <div className="truncate" title={e.description}>{e.description}</div>
                          {e.notes && <div className="text-xs text-gray-400 truncate" title={e.notes}>{e.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{e.paid_to || '—'}</td>
                        <td className="px-4 py-3 font-extrabold whitespace-nowrap" style={{ color: B.brown }}>
                          {fmtINR(e.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: pm.bg, color: pm.color }}>
                            {pm.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{e.recorded_by || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEdit(e)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                              Edit
                            </button>
                            <button onClick={() => handleDelete(e)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-right" style={{ color: B.text }}>
                      Day Total:
                    </td>
                    <td className="px-4 py-3 font-extrabold text-lg" style={{ color: B.brown }}>{fmtINR(total)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* CATEGORIES TAB                                     */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openAddCat}
                className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                + Add Category
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 animate-spin"
                  style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Color', 'Category Name', 'Description', 'Order', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {catObjs.map((c, idx) => (
                        <tr key={c.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                            opacity: c.active ? 1 : 0.5 }}>
                          <td className="px-4 py-3">
                            <span className="w-6 h-6 rounded-lg inline-block border"
                              style={{ background: c.color, borderColor: c.color + '88' }} />
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{c.name}</td>
                          <td className="px-4 py-3 text-xs max-w-[200px]" style={{ color: B.textLight }}>
                            <div className="truncate" title={c.description || ''}>{c.description || '—'}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-center" style={{ color: B.textLight }}>{c.sort_order}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: c.active ? '#dcfce7' : '#fee2e2',
                                color: c.active ? '#16a34a' : '#dc2626' }}>
                              {c.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditCat(c)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                              <button onClick={() => handleCatToggle(c)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: c.active ? '#fef3c7' : '#dcfce7',
                                  color: c.active ? '#b45309' : '#16a34a' }}>
                                {c.active ? 'Deactivate' : 'Activate'}
                              </button>
                              <button onClick={() => handleCatDelete(c)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Expense Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {modal === 'add' ? '+ Add Expense' : 'Edit Expense'}
              </h3>
              {formErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{formErr}</div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Date</label>
                    <input type="date" name="expense_date" value={form.expense_date} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Payment Mode *</label>
                    <select name="payment_mode" value={form.payment_mode} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }}>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{PM_STYLE[m].label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category *</label>
                  <select name="category" value={form.category} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
                    style={{ borderColor: form.category === 'Supplier Payment' ? B.gold : '#e8d5a3',
                      background: form.category === 'Supplier Payment' ? '#fff8e7' : '#fff' }}>
                    <option value="">— Select Category —</option>
                    {categories.map(c => <option key={c.name ?? c} value={c.name ?? c}>{c.name ?? c}</option>)}
                  </select>
                </div>

                {/* Supplier dropdown — shown only when category is Supplier Payment */}
                {form.category === 'Supplier Payment' && (
                  <div className="rounded-xl p-3 border" style={{ background: '#fff8e7', borderColor: B.gold }}>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                      Select Supplier
                      <span className="ml-1 font-normal text-gray-400">(auto-fills Paid To)</span>
                    </label>
                    <select name="supplier_id" value={form.supplier_id} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: B.gold }}>
                      <option value="">— Pick a supplier —</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.phone ? ` · ${s.phone}` : ''}
                        </option>
                      ))}
                    </select>
                    {suppliers.length === 0 && (
                      <p className="text-xs mt-1 text-gray-400">
                        No suppliers found. Add them in Manage Suppliers first.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Description *</label>
                  <input type="text" name="description" value={form.description} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder={form.category === 'Supplier Payment'
                      ? 'e.g. Payment for October tea powder invoice'
                      : 'e.g. Bought gram flour 5kg from market'} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Amount (₹) *</label>
                    <input type="number" name="amount" value={form.amount} onChange={handleChange}
                      step="0.01" min="0.01"
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                      Paid To
                      {form.category === 'Supplier Payment' && form.paid_to && (
                        <span className="ml-1 font-normal text-green-600">(auto-filled)</span>
                      )}
                    </label>
                    <input type="text" name="paid_to" value={form.paid_to} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: form.paid_to && form.category === 'Supplier Payment' ? '#16a34a' : '#e8d5a3',
                        background: form.paid_to && form.category === 'Supplier Payment' ? '#f0fdf4' : '#fff' }}
                      placeholder="Vendor / shop / supplier name" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes</label>
                  <textarea name="notes" value={form.notes} onChange={handleChange} rows={2}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: '#e8d5a3' }} placeholder="Optional details…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {saving ? 'Saving…' : modal === 'add' ? 'Add Expense' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {catModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {catModal === 'add' ? '+ New Expense Category' : 'Edit Category'}
              </h3>
              {catErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{catErr}</div>
              )}
              <form onSubmit={handleCatSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category Name *</label>
                  <input type="text" name="name" value={catForm.name} onChange={handleCatChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder="e.g. Tea & Coffee Powder" />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Description</label>
                  <input type="text" name="description" value={catForm.description} onChange={handleCatChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder="Short description of what this covers" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Colour</label>
                    <div className="flex items-center gap-2">
                      <input type="color" name="color" value={catForm.color} onChange={handleCatChange}
                        className="w-10 h-10 rounded-lg border-2 cursor-pointer"
                        style={{ borderColor: '#e8d5a3', padding: 2 }} />
                      <span className="text-xs font-mono" style={{ color: B.textLight }}>{catForm.color}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESET_COLORS.map(pc => (
                        <button key={pc} type="button"
                          onClick={() => setCatForm(f => ({ ...f, color: pc }))}
                          className="w-5 h-5 rounded-full border-2 transition-all"
                          style={{ background: pc, borderColor: catForm.color === pc ? '#fff' : 'transparent',
                            outline: catForm.color === pc ? `2px solid ${pc}` : 'none' }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Sort Order</label>
                    <input type="number" name="sort_order" value={catForm.sort_order} onChange={handleCatChange}
                      min="0" step="1"
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="0" />
                    <p className="text-xs mt-1 text-gray-400">Lower = appears first</p>
                  </div>
                </div>
                {/* Preview chip */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: catForm.color + '18', border: `1px solid ${catForm.color}55` }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: catForm.color }} />
                  <span className="text-sm font-semibold" style={{ color: B.darkBrown }}>
                    {catForm.name || 'Category Preview'}
                  </span>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeCatModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={catSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {catSaving ? 'Saving…' : catModal === 'add' ? 'Add Category' : 'Save Changes'}
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
