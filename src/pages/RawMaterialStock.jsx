import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getRawMaterialStock, getRawMaterialPurchases, createRawMaterialPurchase,
  updateRawMaterialPurchase, deleteRawMaterialPurchase, updateRawMaterialItem,
  getSuppliers, setRawMaterialSuppliers,
} from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const PM_STYLE = {
  cash: { bg: '#dcfce7', color: '#16a34a', label: 'Cash' },
  bank: { bg: '#dbeafe', color: '#1d4ed8', label: 'Bank' },
  upi:  { bg: '#ede9fe', color: '#7c3aed', label: 'UPI' },
};

const today   = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // IST
const firstOfMonth = () => today().slice(0, 8) + '01';
const fmtINR  = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty  = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });

const EMPTY_LINE = { item_id: '', quantity: '', rate: '' };

export default function RawMaterialStock() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('purchase'); // 'purchase' | 'stock'

  // ── Stock ─────────────────────────────────────────────────────────────────
  const [stock, setStock]       = useState(null);
  const [stockLoad, setStockLoad] = useState(true);

  // ── Purchase form ─────────────────────────────────────────────────────────
  const [pDate, setPDate]       = useState(today());
  const [pMode, setPMode]       = useState('cash');
  const [vendor, setVendor]     = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');     // '' = local shop / no supplier
  const [invoiceNo, setInvoiceNo] = useState('');
  const [payType, setPayType]   = useState('full');     // 'full' | 'partial' | 'later'
  const [paidAmt, setPaidAmt]   = useState('');
  const [showAllItems, setShowAllItems] = useState(false);
  // supplier-link modal (Stock tab)
  const [linkItem, setLinkItem] = useState(null);
  const [linkIds, setLinkIds]   = useState([]);
  const [notes, setNotes]       = useState('');
  const [lines, setLines]       = useState([{ ...EMPTY_LINE }]);

  // Coming from the Purchase List ("Record Purchase →"): fill supplier + items once
  const location = useLocation();
  useEffect(() => {
    const pre = location.state?.prefill;
    if (!pre) return;
    setTab('purchase');
    setSupplierId(pre.supplier_id || '');
    if (pre.lines?.length) setLines(pre.lines.map(l => ({ ...EMPTY_LINE, ...l })));
    window.history.replaceState({}, '');   // don't refill on page refresh
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [saving, setSaving]     = useState(false);
  const [formErr, setFormErr]   = useState('');

  // ── Purchase history ──────────────────────────────────────────────────────
  const [histFrom, setHistFrom] = useState(firstOfMonth());
  const [histTo, setHistTo]     = useState(today());
  const [histItem, setHistItem] = useState('');
  const [histSupplier, setHistSupplier] = useState('');
  const [hist, setHist]         = useState(null);
  const [histLoad, setHistLoad] = useState(false);

  // inline edit of a purchase row
  const [editId, setEditId]     = useState(null);
  const [editRow, setEditRow]   = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500); };

  const handleAuthErr = useCallback((err) => {
    if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); return true; }
    return false;
  }, [signOut, navigate]);

  const loadStock = useCallback(async () => {
    setStockLoad(true);
    try { const res = await getRawMaterialStock(); setStock(res.data); }
    catch (err) { if (!handleAuthErr(err)) showToast('Failed to load stock.', false); }
    finally { setStockLoad(false); }
  }, [handleAuthErr]);

  const loadHist = useCallback(async () => {
    setHistLoad(true);
    try {
      const params = { from: histFrom || undefined, to: histTo || undefined };
      if (histItem) params.item_id = histItem;
      if (histSupplier) params.supplier_id = histSupplier;
      const res = await getRawMaterialPurchases(params);
      setHist(res.data);
    } catch (err) { if (!handleAuthErr(err)) showToast('Failed to load purchases.', false); }
    finally { setHistLoad(false); }
  }, [histFrom, histTo, histItem, histSupplier, handleAuthErr]);

  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => { loadHist(); }, [loadHist]);
  useEffect(() => {
    getSuppliers().then(res => setSuppliers(res.data.suppliers || [])).catch(() => {});
  }, []);

  const items       = stock?.items || [];
  const activeItems = items.filter(i => i.active);
  const itemById    = (id) => items.find(i => String(i.id) === String(id));
  const activeSuppliers = suppliers.filter(s => s.active !== false);
  const supplierById = (id) => suppliers.find(s => String(s.id) === String(id));

  // Materials this supplier supplies (falls back to all when none are linked yet)
  const supplierItems = supplierId
    ? activeItems.filter(i => (i.suppliers || []).some(s => String(s.id) === String(supplierId)))
    : activeItems;
  const offeredItems = (!supplierId || showAllItems || supplierItems.length === 0) ? activeItems : supplierItems;

  // Last rate — from this supplier if known, else the material's last rate
  const suggestRate = (it, supId) => {
    const fromSup = (it?.suppliers || []).find(s => String(s.id) === String(supId))?.last_rate;
    return fromSup || it?.last_rate || '';
  };

  // ── Purchase form helpers ─────────────────────────────────────────────────
  const setLine = (idx, field, val) => setLines(ls => ls.map((l, i) => {
    if (i !== idx) return l;
    const next = { ...l, [field]: val };
    // Picking a material pre-fills its last purchase rate
    if (field === 'item_id' && !l.rate) {
      const r = suggestRate(itemById(val), supplierId);
      if (r) next.rate = String(r);
    }
    return next;
  }));
  const lineAmount = (l) => (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0);
  const formTotal  = Math.round(lines.reduce((s, l) => s + lineAmount(l), 0) * 100) / 100;
  const paidNow    = !supplierId || payType === 'full' ? formTotal : payType === 'partial' ? (parseFloat(paidAmt) || 0) : 0;

  const changeSupplier = (id) => {
    setSupplierId(id);
    setShowAllItems(false);
    if (!id) setPayType('full');   // without a supplier the purchase is always paid
  };

  const submitPurchase = async (e) => {
    e.preventDefault();
    const valid = lines.filter(l => l.item_id && parseFloat(l.quantity) > 0);
    if (!valid.length) { setFormErr('Add at least one material with quantity.'); return; }
    if (valid.some(l => l.rate === '' || parseFloat(l.rate) < 0)) { setFormErr('Enter the rate for every material.'); return; }
    if (supplierId && payType === 'partial' && (paidNow <= 0 || paidNow >= formTotal)) {
      setFormErr('Part paid amount must be more than 0 and less than the total.'); return;
    }
    setSaving(true); setFormErr('');
    try {
      const res = await createRawMaterialPurchase({
        purchase_date: pDate, payment_mode: pMode, notes: notes.trim() || undefined,
        supplier_id: supplierId || undefined,
        vendor: supplierId ? undefined : (vendor.trim() || undefined),
        invoice_no: invoiceNo.trim() || undefined,
        paid_amount: supplierId ? paidNow : undefined,
        lines: valid.map(l => ({ item_id: l.item_id, quantity: parseFloat(l.quantity), rate: parseFloat(l.rate) })),
      });
      const { total, paid, pending } = res.data;
      showToast(supplierId
        ? `Bill ${fmtINR(total)} added to ${supplierById(supplierId)?.name || 'supplier'} ledger — paid ${fmtINR(paid)}${pending > 0 ? `, pending ${fmtINR(pending)}` : ''}`
        : `Purchase of ${fmtINR(total)} saved — Daily Expense "Raw Material Cost" (${pMode.toUpperCase()}) updated`);
      setLines([{ ...EMPTY_LINE }]); setNotes(''); setInvoiceNo(''); setPaidAmt('');
      loadStock(); loadHist();
    } catch (err) {
      if (!handleAuthErr(err)) setFormErr(err.response?.data?.detail || 'Failed to save purchase.');
    } finally { setSaving(false); }
  };

  // ── History actions ───────────────────────────────────────────────────────
  const startEdit = (p) => {
    setEditId(p.id);
    setEditRow({ quantity: String(p.quantity), rate: String(p.rate), purchase_date: p.purchase_date?.slice(0, 10), payment_mode: p.payment_mode, vendor: p.vendor || '' });
  };
  const saveEdit = async () => {
    try {
      await updateRawMaterialPurchase(editId, editRow);
      setEditId(null); setEditRow(null);
      showToast('Purchase updated — Daily Expense total adjusted');
      loadStock(); loadHist();
    } catch (err) { if (!handleAuthErr(err)) showToast(err.response?.data?.detail || 'Update failed.', false); }
  };
  const removePurchase = async (p) => {
    if (!window.confirm(`Delete purchase of ${fmtQty(p.quantity)} ${p.unit} ${p.item_name} (${fmtINR(p.amount)})?\nThe Daily Expense total for ${p.purchase_date?.slice(0, 10)} will be reduced.`)) return;
    try {
      await deleteRawMaterialPurchase(p.id);
      showToast('Purchase deleted — Daily Expense total adjusted');
      loadStock(); loadHist();
    } catch (err) { if (!handleAuthErr(err)) showToast(err.response?.data?.detail || 'Delete failed.', false); }
  };

  // ── Opening stock (first-time stock in hand; not a purchase / expense) ────
  const [openItem, setOpenItem] = useState(null);
  const [opQty, setOpQty]       = useState('');
  const [opRate, setOpRate]     = useState('');
  const [opDate, setOpDate]     = useState(today());
  const [opErr, setOpErr]       = useState('');
  const [opSaving, setOpSaving] = useState(false);
  const openOpening = (it) => {
    setOpenItem(it);
    setOpQty(parseFloat(it.opening_qty) > 0 ? String(parseFloat(it.opening_qty)) : '');
    setOpRate(it.opening_rate != null ? String(it.opening_rate) : (it.last_rate ? String(it.last_rate) : ''));
    setOpDate(it.opening_date ? String(it.opening_date).slice(0, 10) : today());
    setOpErr('');
  };
  const saveOpening = async () => {
    const q = opQty === '' ? 0 : parseFloat(opQty);
    if (isNaN(q) || q < 0) { setOpErr('Enter a valid quantity (0 to clear).'); return; }
    if (opRate !== '' && (isNaN(parseFloat(opRate)) || parseFloat(opRate) < 0)) { setOpErr('Enter a valid rate.'); return; }
    setOpSaving(true); setOpErr('');
    try {
      await updateRawMaterialItem(openItem.id, {
        opening_qty: q, opening_rate: opRate === '' ? null : parseFloat(opRate), opening_date: opDate || null,
      });
      showToast(`Opening stock for ${openItem.name} set to ${fmtQty(q)} ${openItem.unit}`);
      setOpenItem(null);
      loadStock();
    } catch (err) {
      if (!handleAuthErr(err)) setOpErr(err.response?.data?.detail || 'Failed to save opening stock.');
    } finally { setOpSaving(false); }
  };

  const openLink = (it) => { setLinkItem(it); setLinkIds((it.suppliers || []).map(s => String(s.id))); };
  const saveLink = async () => {
    try {
      await setRawMaterialSuppliers(linkItem.id, linkIds.map(Number));
      showToast(`Suppliers updated for ${linkItem.name}`);
      setLinkItem(null);
      loadStock();
    } catch (err) { if (!handleAuthErr(err)) showToast(err.response?.data?.detail || 'Failed to save suppliers.', false); }
  };

  const setMinStock = async (it) => {
    const val = window.prompt(`Low-stock alert level for ${it.name} (${it.unit}) — leave empty to clear:`, it.min_stock ?? '');
    if (val === null) return;
    if (val !== '' && (isNaN(parseFloat(val)) || parseFloat(val) < 0)) { showToast('Enter a valid number.', false); return; }
    try {
      await updateRawMaterialItem(it.id, { min_stock: val === '' ? null : parseFloat(val) });
      loadStock();
    } catch (err) { if (!handleAuthErr(err)) showToast(err.response?.data?.detail || 'Failed.', false); }
  };

  const inp = { borderColor: '#e8d5a3' };

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
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Raw Material Stock</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/raw-material-purchase-list')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Purchase List{stock?.low_count ? ` (${stock.low_count})` : ''}
          </button>
          <button onClick={() => navigate('/raw-materials')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Materials &amp; Usage</button>
          <button onClick={() => navigate('/daily-expenses')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg hidden sm:inline"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Daily Expenses</button>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Dashboard</button>
          <button onClick={() => { signOut(); navigate('/login'); }}
            className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: '#3d1f00' }}>Logout</button>
        </div>
      </nav>

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm max-w-md"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>{toast.msg}</div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header + summary */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg,${B.darkBrown},#5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Raw Material Stock</h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Add purchases with price — each day&apos;s total is added to Daily Expenses as &ldquo;Raw Material Cost&rdquo;
              </p>
            </div>
            {stock && (
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c8a84b' }}>Stock Value</p>
                  <p className="text-2xl font-extrabold" style={{ color: B.goldLight }}>{fmtINR(stock.total_value)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c8a84b' }}>Low Stock</p>
                  <p className="text-2xl font-extrabold" style={{ color: stock.low_count ? '#fca5a5' : B.goldLight }}>{stock.low_count}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[{ key: 'purchase', label: 'Add Purchase & History' }, { key: 'stock', label: 'Stock in Hand' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={tab === t.key
                ? { background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})`, color: B.goldLight }
                : { background: '#fff', border: '1px solid #e8d5a3', color: B.text }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ━━━━━━━━━━━━━━━━━━━━ Stock in hand ━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'stock' && (
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            {stockLoad && !stock ? (
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16" style={{ color: B.textLight }}>
                <p className="font-semibold">No raw materials yet</p>
                <button onClick={() => navigate('/raw-materials')} className="underline text-sm mt-2" style={{ color: B.gold }}>
                  Add materials in Materials &amp; Usage
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                      {['Material', 'Suppliers', 'Opening', 'Purchased', 'Used', 'In Stock', 'Avg Rate', 'Last Rate', 'Stock Value', 'Alert Level'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={it.id} style={{ background: idx % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0', opacity: it.active ? 1 : 0.5 }}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold" style={{ color: B.darkBrown }}>{it.name}</div>
                          {it.category && <div className="text-xs text-gray-400">{it.category}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-xs min-w-[150px]">
                          {(it.suppliers || []).map(s => (
                            <div key={s.id} className="whitespace-nowrap" style={{ color: B.darkBrown }}>
                              {s.name}
                              {s.last_rate != null && <span style={{ color: B.textLight }}> · {fmtINR(s.last_rate)}</span>}
                            </div>
                          ))}
                          <button onClick={() => openLink(it)} className="mt-0.5 font-bold underline" style={{ color: B.gold }}>
                            {(it.suppliers || []).length ? 'Edit' : '+ Link supplier'}
                          </button>
                        </td>
                        {/* Opening stock in hand — first-time setup */}
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs">
                          {parseFloat(it.opening_qty) > 0 && (
                            <div className="font-semibold text-sm" style={{ color: B.darkBrown }}>{fmtQty(it.opening_qty)} {it.unit}</div>
                          )}
                          <button onClick={() => openOpening(it)} className="font-bold underline" style={{ color: B.gold }}>
                            {parseFloat(it.opening_qty) > 0 ? 'Edit' : '+ Set'}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{fmtQty(it.purchased)} {it.unit}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: B.textLight }}>{fmtQty(it.consumed)} {it.unit}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-extrabold" style={{ color: it.low_stock ? '#dc2626' : '#16a34a' }}>{fmtQty(it.in_stock)} {it.unit}</span>
                          {it.low_stock && it.active && (
                            <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                              {it.in_stock <= 0 ? 'Out' : 'Low'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">{it.avg_rate ? `${fmtINR(it.avg_rate)}/${it.unit}` : '—'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs" style={{ color: B.textLight }}>
                          {it.last_rate ? <>{fmtINR(it.last_rate)}<div>{it.last_purchase_date?.slice(0, 10)}</div></> : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-bold whitespace-nowrap" style={{ color: B.brown }}>{fmtINR(it.stock_value)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setMinStock(it)} className="text-xs font-bold px-2 py-1 rounded-lg"
                            style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                            {it.min_stock != null ? `${fmtQty(it.min_stock)} ${it.unit}` : 'Set'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                      <td colSpan={8} className="px-4 py-3 text-right text-sm font-bold" style={{ color: B.text }}>Total stock value</td>
                      <td className="px-4 py-3 font-extrabold" style={{ color: B.brown }}>{fmtINR(stock?.total_value)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                <p className="px-4 py-2 text-xs" style={{ color: B.textLight }}>
                  In Stock = Opening + Purchased − Used (usage is recorded on the Materials &amp; Usage page). Stock value uses the average rate.
                  Use <strong>Opening → + Set</strong> to enter the stock you already have when you start — it is not added to Daily Expenses.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━ Add purchase + history ━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'purchase' && (
          <>
            <form onSubmit={submitPurchase} className="rounded-2xl shadow-sm p-5 space-y-3" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <h3 className="font-bold" style={{ color: B.brown }}>Add Raw Material Purchase</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Date</label>
                  <input type="date" value={pDate} onChange={e => setPDate(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Payment Mode</label>
                  <select value={pMode} onChange={e => setPMode(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Supplier</label>
                  <select value={supplierId} onChange={e => changeSupplier(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp}>
                    <option value="">— Local shop / no supplier —</option>
                    {activeSuppliers.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.balance > 0 ? ` (pending ${fmtINR(s.balance)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  {supplierId ? (
                    <>
                      <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Supplier Invoice No.</label>
                      <input type="text" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} maxLength={60}
                        placeholder="Optional" className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
                    </>
                  ) : (
                    <>
                      <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Bought From (optional)</label>
                      <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} maxLength={150}
                        placeholder="Shop name" className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
                    </>
                  )}
                </div>
              </div>
              {supplierId && (
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs" style={{ color: B.textLight }}>
                  <span>
                    {supplierItems.length
                      ? `Showing ${showAllItems ? 'all materials' : `${supplierItems.length} material(s) supplied by ${supplierById(supplierId)?.name}`}`
                      : `No materials linked to ${supplierById(supplierId)?.name} yet — materials you buy now will be linked automatically`}
                  </span>
                  {supplierItems.length > 0 && (
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={showAllItems} onChange={e => setShowAllItems(e.target.checked)} />
                      Show all materials
                    </label>
                  )}
                </div>
              )}

              {/* Lines */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8d5a3' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#fffbf2' }}>
                      {['Material', 'Quantity', 'Rate (₹ per unit)', 'Amount', ''].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: B.textLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => {
                      const it = itemById(l.item_id);
                      return (
                        <tr key={idx} style={{ borderTop: '1px solid #f0e0c0' }}>
                          <td className="px-3 py-2 min-w-[180px]">
                            <select value={l.item_id} onChange={e => setLine(idx, 'item_id', e.target.value)}
                              className="w-full border-2 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp}>
                              <option value="">— Select material —</option>
                              {offeredItems.map(i => (
                                <option key={i.id} value={i.id}>{i.name} ({i.unit}) · stock {fmtQty(i.in_stock)}</option>
                              ))}
                              {/* keep an already-chosen material visible even if the filter changed */}
                              {l.item_id && !offeredItems.some(i => String(i.id) === String(l.item_id)) && it && (
                                <option value={it.id}>{it.name} ({it.unit})</option>
                              )}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" step="any" value={l.quantity} onChange={e => setLine(idx, 'quantity', e.target.value)}
                                placeholder="0" className="w-24 border-2 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} />
                              <span className="text-xs" style={{ color: B.textLight }}>{it?.unit || ''}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" value={l.rate} onChange={e => setLine(idx, 'rate', e.target.value)}
                              placeholder="0.00" className="w-28 border-2 rounded-lg px-2 py-1.5 text-sm outline-none" style={inp} />
                          </td>
                          <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: B.brown }}>{fmtINR(lineAmount(l))}</td>
                          <td className="px-3 py-2">
                            {lines.length > 1 && (
                              <button type="button" onClick={() => setLines(ls => ls.filter((_, i) => i !== idx))}
                                className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setLines(ls => [...ls, { ...EMPTY_LINE }])}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: '#fff', border: `1px dashed ${B.gold}`, color: B.text }}>
                          + Add material
                        </button>
                      </td>
                      <td colSpan={2} className="px-3 py-2 text-right text-sm font-bold" style={{ color: B.text }}>Total</td>
                      <td className="px-3 py-2 font-extrabold text-base" style={{ color: B.brown }}>{fmtINR(formTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Payment — credit only possible with a supplier (goes to the supplier ledger) */}
              {supplierId && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: '#fffbf2', border: '1px solid #e8d5a3' }}>
                  <div className="flex gap-2">
                    {[['full', 'Paid in full'], ['partial', 'Part paid'], ['later', 'Pay later']].map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setPayType(k)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={payType === k
                          ? { background: B.gold, color: B.darkBrown, border: `2px solid ${B.gold}` }
                          : { background: '#fff', color: B.text, border: '2px solid #e8d5a3' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  {payType === 'partial' && (
                    <input type="number" min="0" step="0.01" value={paidAmt} onChange={e => setPaidAmt(e.target.value)}
                      placeholder="Amount paid now ₹" className="w-full border-2 rounded-lg px-3 py-2 text-sm outline-none" style={inp} />
                  )}
                  <div className="flex justify-between text-xs font-semibold" style={{ color: B.text }}>
                    <span>Bill {fmtINR(formTotal)} · Paid now {fmtINR(paidNow)}</span>
                    <span style={{ color: formTotal - paidNow > 0 ? '#dc2626' : '#16a34a' }}>
                      {formTotal - paidNow > 0 ? `Pending ${fmtINR(formTotal - paidNow)} → supplier ledger` : 'Fully paid'}
                    </span>
                  </div>
                </div>
              )}

              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)"
                className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
              {formErr && <p className="text-sm font-semibold text-red-600">{formErr}</p>}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs" style={{ color: B.textLight }}>
                  {paidNow > 0
                    ? <>Adds {fmtINR(paidNow)} to Daily Expenses → &ldquo;Raw Material Cost&rdquo; ({pMode.toUpperCase()}) for {pDate}</>
                    : <>Nothing paid now — the full amount is pending in the supplier ledger</>}
                </p>
                <button type="submit" disabled={saving}
                  className="font-bold px-6 py-2.5 rounded-xl text-sm active:scale-95 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                  {saving ? 'Saving…' : 'Save Purchase'}
                </button>
              </div>
            </form>

            {/* History */}
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <div className="px-5 py-3 border-b flex flex-wrap items-end gap-3" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                <h3 className="font-bold text-sm flex-1" style={{ color: B.text }}>Purchase History</h3>
                <input type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)} className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp} />
                <span className="text-xs" style={{ color: B.textLight }}>to</span>
                <input type="date" value={histTo} onChange={e => setHistTo(e.target.value)} className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp} />
                <select value={histItem} onChange={e => setHistItem(e.target.value)} className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp}>
                  <option value="">All materials</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <select value={histSupplier} onChange={e => setHistSupplier(e.target.value)} className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp}>
                  <option value="">All suppliers</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {histLoad && !hist ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : !hist?.purchases?.length ? (
                <p className="text-center py-10 text-sm" style={{ color: B.textLight }}>No purchases in this period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Date', 'Material', 'Qty', 'Rate', 'Amount', 'Mode', 'Supplier / Shop', ''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hist.purchases.map((p, idx) => {
                        const pm = PM_STYLE[p.payment_mode] || { bg: '#eee', color: '#555', label: p.payment_mode };
                        const editing = editId === p.id;
                        const eInp = 'border-2 rounded-lg px-2 py-1 text-xs outline-none';
                        return (
                          <tr key={p.id} style={{ background: idx % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0' }}>
                            <td className="px-4 py-2 text-xs whitespace-nowrap">
                              {editing ? <input type="date" value={editRow.purchase_date} onChange={e => setEditRow(r => ({ ...r, purchase_date: e.target.value }))} className={eInp} style={inp} />
                                : p.purchase_date?.slice(0, 10)}
                            </td>
                            <td className="px-4 py-2 font-semibold" style={{ color: B.darkBrown }}>{p.item_name}</td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {editing ? <input type="number" min="0" step="any" value={editRow.quantity} onChange={e => setEditRow(r => ({ ...r, quantity: e.target.value }))} className={`${eInp} w-20`} style={inp} />
                                : `${fmtQty(p.quantity)} ${p.unit}`}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {editing ? <input type="number" min="0" step="0.01" value={editRow.rate} onChange={e => setEditRow(r => ({ ...r, rate: e.target.value }))} className={`${eInp} w-20`} style={inp} />
                                : fmtINR(p.rate)}
                            </td>
                            <td className="px-4 py-2 font-bold whitespace-nowrap" style={{ color: B.brown }}>
                              {editing ? fmtINR((parseFloat(editRow.quantity) || 0) * (parseFloat(editRow.rate) || 0)) : fmtINR(p.amount)}
                            </td>
                            <td className="px-4 py-2">
                              {editing ? (
                                <select value={editRow.payment_mode} onChange={e => setEditRow(r => ({ ...r, payment_mode: e.target.value }))} className={eInp} style={inp}>
                                  <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option>
                                </select>
                              ) : <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>}
                            </td>
                            <td className="px-4 py-2 text-xs" style={{ color: B.textLight }}>
                              {editing && !p.supplier_id
                                ? <input type="text" value={editRow.vendor} onChange={e => setEditRow(r => ({ ...r, vendor: e.target.value }))} className={`${eInp} w-28`} style={inp} />
                                : (
                                  <>
                                    <div className="font-semibold" style={{ color: p.supplier_id ? B.darkBrown : B.textLight }}>
                                      {p.supplier_name || p.vendor || '—'}
                                    </div>
                                    {p.supplier_id && p.bill_total != null && (() => {
                                      const pend = Math.round((p.bill_total - p.bill_paid_now) * 100) / 100;
                                      return (
                                        <div title={`Bill ${p.bill_invoice_no || `RM-${p.bill_id}`}: ${fmtINR(p.bill_total)}, paid at purchase ${fmtINR(p.bill_paid_now)}`}
                                          style={{ color: pend > 0 ? '#dc2626' : '#16a34a' }}>
                                          {p.bill_invoice_no || `RM-${p.bill_id}`} · {pend > 0 ? `credit ${fmtINR(pend)}` : 'paid'}
                                        </div>
                                      );
                                    })()}
                                  </>
                                )}
                            </td>
                            <td className="px-4 py-2 whitespace-nowrap">
                              {editing ? (
                                <div className="flex gap-1">
                                  <button onClick={saveEdit} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#dcfce7', color: '#16a34a' }}>✓</button>
                                  <button onClick={() => { setEditId(null); setEditRow(null); }} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#f5f5f5', color: '#555' }}>✕</button>
                                </div>
                              ) : (
                                <div className="flex gap-1">
                                  <button onClick={() => startEdit(p)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                                  <button onClick={() => removePurchase(p)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                        <td colSpan={4} className="px-4 py-3 text-right text-sm font-bold" style={{ color: B.text }}>
                          Total ({hist.purchases.length} line{hist.purchases.length !== 1 ? 's' : ''})
                        </td>
                        <td className="px-4 py-3 font-extrabold" style={{ color: B.brown }}>{fmtINR(hist.total_amount)}</td>
                        <td colSpan={3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Opening stock in hand */}
      {openItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: 'rgba(45,26,14,0.55)' }}
          onClick={() => setOpenItem(null)}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff', border: `2px solid ${B.gold}` }}
            onClick={e => e.stopPropagation()}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-5 space-y-3">
              <div>
                <h3 className="text-lg font-extrabold" style={{ color: B.brown }}>Opening Stock — {openItem.name}</h3>
                <p className="text-xs" style={{ color: B.textLight }}>
                  Quantity already in hand when you start tracking. Not a purchase — nothing is added to Daily Expenses.
                </p>
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Quantity in hand ({openItem.unit})</label>
                <input type="number" min="0" step="any" value={opQty} autoFocus onChange={e => setOpQty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveOpening(); }}
                  placeholder="0" className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Rate ₹ / {openItem.unit} (optional)</label>
                  <input type="number" min="0" step="0.01" value={opRate} onChange={e => setOpRate(e.target.value)}
                    placeholder="For stock value" className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>As of date</label>
                  <input type="date" value={opDate} max={today()} onChange={e => setOpDate(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inp} />
                </div>
              </div>
              {opQty !== '' && opRate !== '' && (
                <p className="text-xs font-semibold" style={{ color: B.text }}>
                  Opening value: {fmtINR((parseFloat(opQty) || 0) * (parseFloat(opRate) || 0))}
                </p>
              )}
              {opErr && <p className="text-xs font-semibold text-red-600">{opErr}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setOpenItem(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                  Cancel
                </button>
                <button onClick={saveOpening} disabled={opSaving} className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                  {opSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Link suppliers to a material */}
      {linkItem && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4" style={{ background: 'rgba(45,26,14,0.55)' }}
          onClick={() => setLinkItem(null)}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff', border: `2px solid ${B.gold}` }}
            onClick={e => e.stopPropagation()}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-5 space-y-3">
              <h3 className="text-lg font-extrabold" style={{ color: B.brown }}>Suppliers for {linkItem.name}</h3>
              <p className="text-xs" style={{ color: B.textLight }}>Tick the suppliers you buy this material from.</p>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {activeSuppliers.length === 0 && (
                  <p className="text-sm" style={{ color: B.textLight }}>No suppliers yet — add them on the Suppliers page.</p>
                )}
                {activeSuppliers.map(s => {
                  const checked = linkIds.includes(String(s.id));
                  return (
                    <label key={s.id} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                      style={{ background: checked ? '#fff7e0' : '#fff', border: '1px solid #f0e0c0' }}>
                      <input type="checkbox" checked={checked}
                        onChange={() => setLinkIds(ids => checked ? ids.filter(x => x !== String(s.id)) : [...ids, String(s.id)])} />
                      <span className="text-sm font-semibold" style={{ color: B.darkBrown }}>{s.name}</span>
                      {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                    </label>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setLinkItem(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                  Cancel
                </button>
                <button onClick={saveLink} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
