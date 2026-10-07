import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEscClose } from '../hooks/useEscClose';
import {
  getProducts, getSuppliers, getPurchaseOrders,
  getPurchaseReturns, createPurchaseReturn, deletePurchaseReturn,
} from '../api/client';

// ── Theme ─────────────────────────────────────────────────────────────────────
const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
  navGrad:  'linear-gradient(135deg,#2d1a0e,#4a2c0a,#3d2008)',
  pageGrad: 'linear-gradient(160deg,#fdf6e3 0%,#f5ead0 60%,#ede0c4 100%)',
  goldGrad: 'linear-gradient(135deg,#b8860b,#d4a017,#f5c842,#d4a017,#b8860b)',
};

const fmtINR = n => `₹${parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const today  = () => new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});

const inpSty = { border:'1.5px solid #d4a017', borderRadius:10, padding:'8px 12px',
  background:'#fff9ee', color:'#3d2008', fontSize:14, outline:'none', width:'100%' };

const EMPTY_ITEM = { product_id: '', product_name: '', qty_returned: '', purchase_price: '', destock: true };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PurchaseReturn() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('new');

  // ── Master data ────────────────────────────────────────────────────────────
  const [products,   setProducts]   = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [pos,        setPOs]        = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── New return form ────────────────────────────────────────────────────────
  const [supplierId,   setSupplierId]   = useState('');
  const [poNumber,     setPONumber]     = useState('');  // optional link to a PO
  const [returnDate,   setReturnDate]   = useState(today());
  const [reason,       setReason]       = useState('');
  const [notes,        setNotes]        = useState('');
  const [items,        setItems]        = useState([{ ...EMPTY_ITEM }]);

  // Product search per-row
  const [productSearch, setProductSearch] = useState({});  // rowIdx → search string
  const [showDropdown,  setShowDropdown]  = useState(null); // rowIdx | null

  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');
  const [toast,    setToast]    = useState(null);
  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  // ── History tab ────────────────────────────────────────────────────────────
  const [returns,     setReturns]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histFrom,    setHistFrom]    = useState('');
  const [histTo,      setHistTo]      = useState('');
  const [histSearch,  setHistSearch]  = useState('');
  const [expandedId,  setExpandedId]  = useState(null);
  useEscClose(() => setExpandedId(null), !!expandedId);

  // ── Load master data once ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [pRes, sRes, poRes] = await Promise.all([
          getProducts(), getSuppliers(), getPurchaseOrders('all')
        ]);
        setProducts((pRes.data.products || []).filter(p => p.active));
        setSuppliers(sRes.data.suppliers || []);
        setPOs(poRes.data.purchase_orders || []);
        setDataLoaded(true);
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      }
    })();
  }, [signOut, navigate]);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = {};
      if (histFrom)   params.date_from = histFrom;
      if (histTo)     params.date_to   = histTo;
      if (histSearch) params.search    = histSearch;
      const res = await getPurchaseReturns(params);
      setReturns(res.data.purchase_returns || []);
    } catch { showToast('Failed to load history.', false); }
    finally { setHistLoading(false); }
  }, [histFrom, histTo, histSearch]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  // ── Item row helpers ───────────────────────────────────────────────────────
  const addRow = () => setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeRow = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const selectProduct = (idx, product) => {
    setItems(prev => prev.map((it, i) => i === idx ? {
      ...it,
      product_id:    product.id,
      product_name:  product.name,
      purchase_price: it.purchase_price || String(product.purchase_price || ''),
    } : it));
    setProductSearch(prev => ({ ...prev, [idx]: product.name }));
    setShowDropdown(null);
  };

  // Filtered products per row
  const filteredProducts = (idx) => {
    const q = (productSearch[idx] || '').toLowerCase();
    if (!q) return products.slice(0, 50);
    return products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 30);
  };

  // ── Supplier name from id ──────────────────────────────────────────────────
  const supplierName = () => suppliers.find(s => String(s.id) === String(supplierId))?.name || '';

  // ── POs for selected supplier ──────────────────────────────────────────────
  const supplierPOs = pos.filter(po =>
    !supplierId || String(po.supplier_id) === String(supplierId)
  );

  // ── Total ──────────────────────────────────────────────────────────────────
  const totalAmount = items.reduce((sum, it) => {
    const qty = parseFloat(it.qty_returned || 0);
    const price = parseFloat(it.purchase_price || 0);
    return sum + qty * price;
  }, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErr('');

    const validItems = items
      .map(it => ({
        product_id:    it.product_id,
        product_name:  it.product_name,
        qty_returned:  parseFloat(it.qty_returned || 0),
        purchase_price:parseFloat(it.purchase_price || 0),
        line_total:    parseFloat(((parseFloat(it.qty_returned||0)) * parseFloat(it.purchase_price||0)).toFixed(2)),
        destock:       it.destock !== false,
      }))
      .filter(it => it.product_id && it.qty_returned > 0);

    if (!validItems.length) { setFormErr('Add at least one item with product and quantity.'); return; }

    setSaving(true);
    try {
      await createPurchaseReturn({
        supplier_id:   supplierId || null,
        supplier_name: supplierName(),
        po_number:     poNumber || null,
        return_date:   returnDate,
        reason,
        notes,
        items: validItems,
      });
      showToast('Purchase return recorded!');
      // Reset form
      setSupplierId(''); setPONumber(''); setReason(''); setNotes('');
      setItems([{ ...EMPTY_ITEM }]); setProductSearch({});
      if (tab === 'history') loadHistory();
    } catch (err) {
      setFormErr(err.response?.data?.detail || 'Failed to save return.');
    } finally { setSaving(false); }
  };

  // ── Delete return ──────────────────────────────────────────────────────────
  const handleDeleteReturn = async (ret) => {
    if (!window.confirm(`Delete return ${ret.return_number}? Stock changes will be reversed.`)) return;
    try {
      await deletePurchaseReturn(ret.id);
      showToast('Return deleted.');
      loadHistory();
    } catch (err) { showToast(err.response?.data?.detail || 'Delete failed.', false); }
  };

  return (
    <div className="min-h-screen" style={{ background: B.pageGrad }}>

      {/* Navbar */}
      <nav className="sticky top-0 z-30 px-4 py-3 shadow-lg flex items-center justify-between"
        style={{ background: B.navGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-xl font-bold active:scale-95" style={{ color: B.goldLight }}>←</button>
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-base font-extrabold tracking-widest uppercase"
              style={{ color: B.goldLight, fontFamily: 'Georgia,serif' }}>Crown Tea Hub</h1>
            <p className="text-xs" style={{ color: B.gold }}>Purchase Return</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['new','history'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 rounded-xl text-xs font-bold active:scale-95"
              style={{ background: tab===t ? B.goldGrad : 'rgba(212,160,23,0.15)',
                       color: tab===t ? B.darkBrown : B.goldLight }}>
              {t === 'new' ? '+ New Return' : '📋 History'}
            </button>
          ))}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg"
          style={{ background: toast.ok ? '#15803d' : '#dc2626', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-5">

        {/* ── NEW RETURN TAB ── */}
        {tab === 'new' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header details */}
            <div className="rounded-2xl shadow-sm p-5 space-y-3"
              style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
              <h2 className="font-extrabold text-sm uppercase tracking-widest" style={{ color: B.text }}>
                Return Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Supplier</label>
                  <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setPONumber(''); }}
                    style={inpSty}>
                    <option value="">— Select Supplier (optional) —</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>
                    Link to PO (optional)
                  </label>
                  <select value={poNumber} onChange={e => setPONumber(e.target.value)} style={inpSty}>
                    <option value="">— None —</option>
                    {supplierPOs.map(po => (
                      <option key={po.id} value={po.po_number}>
                        {po.po_number} · {po.supplier_name || '—'} · {po.status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Return Date *</label>
                  <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                    required style={inpSty} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Reason</label>
                  <input value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="Damaged / Expired / Wrong product / etc."
                    style={inpSty} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Notes</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Internal notes"
                    style={inpSty} />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="rounded-2xl shadow-sm overflow-visible"
              style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ background: B.darkBrown, borderRadius: '16px 16px 0 0' }}>
                <h2 className="font-extrabold text-sm uppercase tracking-widest" style={{ color: B.goldLight }}>
                  Items to Return
                </h2>
                <button type="button" onClick={addRow}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl active:scale-95"
                  style={{ background: B.goldGrad, color: B.darkBrown }}>
                  + Add Row
                </button>
              </div>

              <div className="p-4 space-y-3">
                {items.map((it, idx) => (
                  <div key={idx} className="rounded-xl p-3 space-y-2"
                    style={{ background: '#fffbf0', border: '1px solid #e8d5a3' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-start">

                      {/* Product search */}
                      <div className="sm:col-span-2 relative">
                        <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Product *</label>
                        <input
                          value={productSearch[idx] !== undefined ? productSearch[idx] : it.product_name}
                          onChange={e => {
                            setProductSearch(prev => ({ ...prev, [idx]: e.target.value }));
                            updateItem(idx, 'product_id', '');
                            updateItem(idx, 'product_name', e.target.value);
                            setShowDropdown(idx);
                          }}
                          onFocus={() => setShowDropdown(idx)}
                          onBlur={() => setTimeout(() => setShowDropdown(null), 200)}
                          placeholder="Search product…"
                          style={inpSty} />
                        {showDropdown === idx && filteredProducts(idx).length > 0 && (
                          <div className="absolute z-40 left-0 right-0 top-full mt-1 rounded-xl shadow-xl overflow-y-auto"
                            style={{ background: '#fff', border: '1.5px solid #d4a017', maxHeight: 220 }}>
                            {filteredProducts(idx).map(p => (
                              <div key={p.id}
                                onMouseDown={() => selectProduct(idx, p)}
                                className="px-4 py-2.5 cursor-pointer hover:bg-amber-50 text-sm border-b"
                                style={{ borderColor: '#f0e8cc' }}>
                                <div className="font-semibold" style={{ color: B.darkBrown }}>{p.name}</div>
                                <div className="text-xs" style={{ color: B.textLight }}>
                                  {p.barcode && <span className="font-mono mr-2">{p.barcode}</span>}
                                  Stock: {p.track_stock ? p.current_stock : 'N/A'}
                                  {p.purchase_price && ` · Buy: ${fmtINR(p.purchase_price)}`}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Qty */}
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Qty *</label>
                        <input type="number" min="0.001" step="0.001"
                          value={it.qty_returned}
                          onChange={e => updateItem(idx, 'qty_returned', e.target.value)}
                          placeholder="0"
                          style={inpSty} />
                      </div>

                      {/* Purchase price */}
                      <div>
                        <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Purchase Price *</label>
                        <input type="number" min="0" step="0.01"
                          value={it.purchase_price}
                          onChange={e => updateItem(idx, 'purchase_price', e.target.value)}
                          placeholder="₹0.00"
                          style={inpSty} />
                      </div>

                      {/* Line total + controls */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Total</label>
                        <div className="font-extrabold text-sm" style={{ color: '#15803d' }}>
                          {fmtINR((parseFloat(it.qty_returned||0)) * parseFloat(it.purchase_price||0))}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                            style={{ color: B.text }}>
                            <input type="checkbox" checked={it.destock !== false}
                              onChange={e => updateItem(idx, 'destock', e.target.checked)}
                              className="w-3.5 h-3.5 accent-amber-600" />
                            Deduct stock
                          </label>
                          {items.length > 1 && (
                            <button type="button" onClick={() => removeRow(idx)}
                              className="text-xs font-bold px-2 py-0.5 rounded-lg active:scale-95"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Total bar */}
                {totalAmount > 0 && (
                  <div className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <span className="text-sm font-bold" style={{ color: '#15803d' }}>Total Return Value</span>
                    <span className="text-lg font-extrabold" style={{ color: '#15803d' }}>{fmtINR(totalAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            {formErr && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
                {formErr}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="px-10 py-3 rounded-xl font-extrabold text-sm active:scale-95 disabled:opacity-60 shadow-lg"
                style={{ background: B.goldGrad, color: B.darkBrown }}>
                {saving ? 'Saving…' : '✓ Record Purchase Return'}
              </button>
            </div>
          </form>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
              style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>From</label>
                <input type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)}
                  style={{...inpSty, width:140}} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>To</label>
                <input type="date" value={histTo} onChange={e => setHistTo(e.target.value)}
                  style={{...inpSty, width:140}} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Search</label>
                <input value={histSearch} onChange={e => setHistSearch(e.target.value)}
                  placeholder="Return No / Supplier / PO"
                  style={inpSty} />
              </div>
              <button onClick={loadHistory}
                className="px-5 py-2 rounded-xl font-bold text-sm active:scale-95"
                style={{ background: B.goldGrad, color: B.darkBrown }}>
                🔍 Filter
              </button>
            </div>

            {histLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 rounded-full border-4 animate-spin"
                  style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : returns.length === 0 ? (
              <div className="rounded-2xl py-16 text-center"
                style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                <p className="text-4xl mb-3">📦</p>
                <p className="font-semibold" style={{ color: B.textLight }}>No purchase returns found</p>
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: B.darkBrown }}>
                      {['Return No','Date','Supplier','PO No','Items','Total','By',''].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide"
                          style={{ color: B.goldLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((ret, i) => (
                      <>
                        <tr key={ret.id} style={{ background: i%2===0 ? '#fff' : '#fffbf0',
                          borderBottom: '1px solid #f0e8cc' }}>
                          <td className="px-3 py-2.5 font-mono font-bold text-xs" style={{ color: '#ea580c' }}>
                            {ret.return_number}
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: B.textLight }}>{ret.return_date}</td>
                          <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: B.darkBrown }}>
                            {ret.supplier_name || '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: B.brown }}>
                            {ret.po_number || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-center">{(ret.items||[]).length}</td>
                          <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#dc2626' }}>
                            {fmtINR(ret.total_amount)}
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: B.textLight }}>{ret.processed_by}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              <button onClick={() => setExpandedId(expandedId===ret.id ? null : ret.id)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#fff7ed', color: '#ea580c' }}>
                                {expandedId===ret.id ? '▲' : '▼'} Items
                              </button>
                              {user?.role === 'Admin' && (
                                <button onClick={() => handleDeleteReturn(ret)}
                                  className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                  style={{ background: '#fee2e2', color: '#dc2626' }}>✕</button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === ret.id && (
                          <tr key={`${ret.id}-exp`}>
                            <td colSpan={8} className="px-4 py-3"
                              style={{ background: '#fff7ed', borderBottom: '2px solid #e8d5a3' }}>
                              {ret.reason && (
                                <p className="text-xs font-semibold mb-2" style={{ color: '#ea580c' }}>
                                  Reason: {ret.reason}
                                </p>
                              )}
                              <table className="w-full text-xs rounded-xl overflow-hidden">
                                <thead>
                                  <tr style={{ background: '#ffedd5' }}>
                                    {['Product','Qty Returned','Purchase Price','Total','Destock'].map(h => (
                                      <th key={h} className="px-3 py-1.5 text-left font-bold" style={{ color: '#ea580c' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(ret.items||[]).map(it => (
                                    <tr key={it.id} style={{ borderBottom: '1px solid #fed7aa' }}>
                                      <td className="px-3 py-1.5 font-semibold" style={{ color: B.darkBrown }}>{it.product_name}</td>
                                      <td className="px-3 py-1.5 font-mono">{parseFloat(it.qty_returned)}</td>
                                      <td className="px-3 py-1.5">{fmtINR(it.purchase_price)}</td>
                                      <td className="px-3 py-1.5 font-bold" style={{ color: '#dc2626' }}>{fmtINR(it.line_total)}</td>
                                      <td className="px-3 py-1.5">{it.destock ? '✓ Yes' : '✗ No'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
