import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useEscClose } from '../hooks/useEscClose';
import {
  getSalesHistory, getReceipt,
  getSalesReturns, createSalesReturn, deleteSalesReturn,
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
const fmtTime = s => s ? new Date(s).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true,dateStyle:'short',timeStyle:'short'}) : '—';

const PM = {
  cash:{bg:'#dcfce7',color:'#16a34a',label:'Cash'},
  upi: {bg:'#ede9fe',color:'#7c3aed',label:'UPI'},
  card:{bg:'#dbeafe',color:'#1d4ed8',label:'Card'},
};

const REFUND_MODES = ['cash','upi','card','bank_transfer','cheque','other'];

// ── inline style helpers ─────────────────────────────────────────────────────
const inpSty = { border:'1.5px solid #d4a017', borderRadius:10, padding:'8px 12px',
  background:'#fff9ee', color:'#3d2008', fontSize:14, outline:'none', width:'100%' };

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SalesReturn() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Tab: 'new' | 'history'
  const [tab, setTab] = useState('new');

  // ── Step 1: search a sale ──────────────────────────────────────────────────
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [searchDate,    setSearchDate]    = useState(today());
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [searchErr,     setSearchErr]     = useState('');

  // ── Step 2: selected sale + items ─────────────────────────────────────────
  const [selectedSale,  setSelectedSale]  = useState(null); // full sale object
  const [saleItems,     setSaleItems]     = useState([]);   // items from receipt
  const [loadingItems,  setLoadingItems]  = useState(false);

  // Return form state
  const [returnDate,    setReturnDate]    = useState(today());
  const [reason,        setReason]        = useState('');
  const [refundMethod,  setRefundMethod]  = useState('cash');
  const [notes,         setNotes]         = useState('');
  // Per-item: { qty_returned, restock }
  const [itemSelections, setItemSelections] = useState({});

  const [saving,  setSaving]  = useState(false);
  const [formErr, setFormErr] = useState('');
  const [toast,   setToast]   = useState(null);
  const showToast = (msg, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3500); };

  // ── History tab ────────────────────────────────────────────────────────────
  const [returns,      setReturns]      = useState([]);
  const [histLoading,  setHistLoading]  = useState(false);
  const [histFrom,     setHistFrom]     = useState('');
  const [histTo,       setHistTo]       = useState('');
  const [histSearch,   setHistSearch]   = useState('');
  const [expandedId,   setExpandedId]   = useState(null);
  useEscClose(() => setExpandedId(null), !!expandedId);

  // ── Load history ───────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const params = {};
      if (histFrom)   params.date_from = histFrom;
      if (histTo)     params.date_to   = histTo;
      if (histSearch) params.search    = histSearch;
      const res = await getSalesReturns(params);
      setReturns(res.data.sales_returns || []);
    } catch { showToast('Failed to load return history.', false); }
    finally { setHistLoading(false); }
  }, [histFrom, histTo, histSearch]);

  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

  // ── Search sales ───────────────────────────────────────────────────────────
  const handleSearchSales = async () => {
    if (!invoiceSearch.trim() && !searchDate) { setSearchErr('Enter invoice number or select date.'); return; }
    setSearching(true); setSearchErr(''); setSearchResults([]);
    try {
      const res = await getSalesHistory({ date: searchDate, search: invoiceSearch.trim() });
      const sales = res.data.sales || [];
      setSearchResults(sales);
      if (!sales.length) setSearchErr('No sales found for that search.');
    } catch { setSearchErr('Search failed.'); }
    finally { setSearching(false); }
  };

  // ── Select a sale and load its items ───────────────────────────────────────
  const handleSelectSale = async (sale) => {
    setSelectedSale(sale);
    setSaleItems([]);
    setItemSelections({});
    setLoadingItems(true);
    setFormErr('');
    try {
      const res = await getReceipt(sale.invoice_number);
      const items = res.data.items || [];
      setSaleItems(items);
      // initialise each item with qty=0
      const sel = {};
      items.forEach(it => { sel[it.id] = { qty_returned: '', restock: true }; });
      setItemSelections(sel);
    } catch { setFormErr('Could not load sale items.'); }
    finally { setLoadingItems(false); }
  };

  const clearSale = () => { setSelectedSale(null); setSaleItems([]); setItemSelections({}); setFormErr(''); };

  // ── Submit return ──────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErr('');

    const returnItems = saleItems
      .map(it => {
        const sel = itemSelections[it.id] || {};
        const qty = parseFloat(sel.qty_returned || 0);
        if (qty <= 0) return null;
        const maxQty = parseFloat(it.quantity);
        if (qty > maxQty) return { _error: `${it.product_name}: qty (${qty}) > sold qty (${maxQty})` };
        return {
          sale_item_id:  it.id,
          product_id:    it.product_id,
          product_name:  it.product_name,
          qty_returned:  qty,
          unit_price:    parseFloat(it.unit_price),
          line_total:    parseFloat((qty * parseFloat(it.unit_price)).toFixed(2)),
          restock:       sel.restock !== false,
        };
      })
      .filter(Boolean);

    const errs = returnItems.filter(i => i._error);
    if (errs.length) { setFormErr(errs.map(e => e._error).join('; ')); return; }
    const validItems = returnItems.filter(i => !i._error);
    if (!validItems.length) { setFormErr('Select at least one item with quantity > 0.'); return; }

    setSaving(true);
    try {
      await createSalesReturn({
        sale_id:        selectedSale.id,
        invoice_number: selectedSale.invoice_number,
        customer_name:  selectedSale.customer_name || '',
        customer_mobile:selectedSale.customer_mobile || '',
        return_date:    returnDate,
        reason,
        refund_method:  refundMethod,
        notes,
        items: validItems,
      });
      showToast('Sales return recorded!');
      clearSale();
      setInvoiceSearch(''); setSearchResults([]);
      setReason(''); setNotes('');
      if (tab === 'history') loadHistory();
    } catch (err) {
      setFormErr(err.response?.data?.detail || 'Failed to save return.');
    } finally { setSaving(false); }
  };

  // ── Delete return ──────────────────────────────────────────────────────────
  const handleDeleteReturn = async (ret) => {
    if (!window.confirm(`Delete return ${ret.return_number}? Stock changes will be reversed.`)) return;
    try {
      await deleteSalesReturn(ret.id);
      showToast('Return deleted.');
      loadHistory();
    } catch (err) { showToast(err.response?.data?.detail || 'Delete failed.', false); }
  };

  // ── Computed refund total ──────────────────────────────────────────────────
  const refundTotal = saleItems.reduce((sum, it) => {
    const qty = parseFloat(itemSelections[it.id]?.qty_returned || 0);
    return sum + qty * parseFloat(it.unit_price);
  }, 0);

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
            <p className="text-xs" style={{ color: B.gold }}>Sales Return</p>
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
          <>
            {/* Step 1 — Search Sale */}
            {!selectedSale && (
              <div className="rounded-2xl shadow-sm p-5 space-y-4"
                style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                <h2 className="font-extrabold text-sm uppercase tracking-widest" style={{ color: B.text }}>
                  Step 1 — Find the Original Sale
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Invoice No / Customer</label>
                    <input value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                      onKeyDown={e => e.key==='Enter' && handleSearchSales()}
                      placeholder="INV-... or name / mobile"
                      style={inpSty} />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Sale Date</label>
                    <input type="date" value={searchDate} onChange={e => setSearchDate(e.target.value)}
                      style={inpSty} />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleSearchSales} disabled={searching}
                      className="w-full py-2 rounded-xl font-bold text-sm active:scale-95 disabled:opacity-60"
                      style={{ background: B.goldGrad, color: B.darkBrown }}>
                      {searching ? 'Searching…' : '🔍 Search Sales'}
                    </button>
                  </div>
                </div>
                {searchErr && <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>{searchErr}</p>}

                {/* Results */}
                {searchResults.length > 0 && (
                  <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e8d5a3' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: B.darkBrown }}>
                          {['Invoice','Time','Customer','Items','Payment','Total',''].map(h => (
                            <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide"
                              style={{ color: B.goldLight }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((s, i) => {
                          const pm = PM[s.payment_method] || {bg:'#f3f4f6',color:'#374151',label:s.payment_method};
                          return (
                            <tr key={s.id} style={{ background: i%2===0 ? '#fff' : '#fffbf0',
                              borderBottom: '1px solid #f0e8cc' }}>
                              <td className="px-3 py-2 font-mono font-bold text-xs" style={{ color: B.brown }}>
                                {s.invoice_number}
                              </td>
                              <td className="px-3 py-2 text-xs" style={{ color: B.textLight }}>{fmtTime(s.sale_time)}</td>
                              <td className="px-3 py-2 text-xs">
                                <div style={{ color: B.darkBrown }}>{s.customer_name || '—'}</div>
                                {s.customer_mobile && <div style={{ color: B.textLight }}>{s.customer_mobile}</div>}
                              </td>
                              <td className="px-3 py-2 text-xs text-center" style={{ color: B.text }}>{s.item_count}</td>
                              <td className="px-3 py-2">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                              </td>
                              <td className="px-3 py-2 font-extrabold text-xs" style={{ color: B.brown }}>
                                {fmtINR(s.grand_total)}
                              </td>
                              <td className="px-3 py-2">
                                <button onClick={() => handleSelectSale(s)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                  style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                                  Select →
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Step 2 — Return form */}
            {selectedSale && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Sale summary */}
                <div className="rounded-2xl p-4 flex items-start justify-between flex-wrap gap-3"
                  style={{ background: B.darkBrown, border: `2px solid ${B.gold}` }}>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: B.gold }}>
                      Original Sale
                    </p>
                    <p className="text-lg font-extrabold mt-0.5" style={{ color: B.goldLight }}>
                      {selectedSale.invoice_number}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: B.gold }}>
                      {fmtTime(selectedSale.sale_time)} · {selectedSale.cashier_username}
                      {selectedSale.customer_name && ` · ${selectedSale.customer_name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: B.gold }}>Grand Total</p>
                    <p className="text-xl font-extrabold" style={{ color: B.goldLight }}>{fmtINR(selectedSale.grand_total)}</p>
                    <button type="button" onClick={clearSale}
                      className="text-xs font-bold mt-1 px-3 py-1 rounded-lg active:scale-95"
                      style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5' }}>
                      ✕ Change Sale
                    </button>
                  </div>
                </div>

                {/* Items to return */}
                <div className="rounded-2xl shadow-sm overflow-hidden"
                  style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                  <div className="px-5 py-3" style={{ background: B.darkBrown }}>
                    <h2 className="font-extrabold text-sm uppercase tracking-widest" style={{ color: B.goldLight }}>
                      Step 2 — Select Items to Return
                    </h2>
                  </div>
                  {loadingItems ? (
                    <div className="flex justify-center py-10">
                      <div className="w-8 h-8 rounded-full border-4 animate-spin"
                        style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#fff9ee', borderBottom: `2px solid ${B.gold}` }}>
                            {['Product','Sold Qty','Unit Price','Return Qty','Restock?','Refund'].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase"
                                style={{ color: B.textLight }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {saleItems.map((it, idx) => {
                            const sel = itemSelections[it.id] || { qty_returned: '', restock: true };
                            const qty = parseFloat(sel.qty_returned || 0);
                            const lineRefund = qty * parseFloat(it.unit_price);
                            return (
                              <tr key={it.id} style={{ background: idx%2===0 ? '#fff' : '#fffbf0',
                                borderBottom: '1px solid #f0e8cc' }}>
                                <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>
                                  {it.product_name}
                                  {it.barcode && <div className="text-xs font-mono text-gray-400">{it.barcode}</div>}
                                </td>
                                <td className="px-4 py-3 text-center font-mono" style={{ color: B.text }}>
                                  {parseFloat(it.quantity)}
                                </td>
                                <td className="px-4 py-3 font-bold" style={{ color: B.brown }}>
                                  {fmtINR(it.unit_price)}
                                </td>
                                <td className="px-4 py-3">
                                  <input type="number" min="0" max={parseFloat(it.quantity)} step="0.001"
                                    value={sel.qty_returned}
                                    onChange={e => setItemSelections(prev => ({
                                      ...prev, [it.id]: { ...prev[it.id], qty_returned: e.target.value }
                                    }))}
                                    placeholder="0"
                                    className="w-24 text-sm px-2 py-1.5 rounded-lg border-2 outline-none text-center"
                                    style={{ borderColor: qty > 0 ? B.gold : '#e0e0e0' }} />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <input type="checkbox"
                                    checked={sel.restock !== false}
                                    onChange={e => setItemSelections(prev => ({
                                      ...prev, [it.id]: { ...prev[it.id], restock: e.target.checked }
                                    }))}
                                    className="w-4 h-4 accent-amber-600" />
                                </td>
                                <td className="px-4 py-3 font-extrabold"
                                  style={{ color: qty > 0 ? '#16a34a' : B.textLight }}>
                                  {qty > 0 ? fmtINR(lineRefund) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {refundTotal > 0 && (
                          <tfoot>
                            <tr style={{ background: '#f0fdf4', borderTop: '2px solid #bbf7d0' }}>
                              <td colSpan={5} className="px-4 py-2.5 font-bold text-right text-sm"
                                style={{ color: '#15803d' }}>Total Refund:</td>
                              <td className="px-4 py-2.5 font-extrabold text-sm" style={{ color: '#15803d' }}>
                                {fmtINR(refundTotal)}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </div>

                {/* Return details form */}
                <div className="rounded-2xl shadow-sm p-5 space-y-3"
                  style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                  <h2 className="font-extrabold text-sm uppercase tracking-widest" style={{ color: B.text }}>
                    Step 3 — Return Details
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Return Date *</label>
                      <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                        required style={inpSty} />
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Refund Method *</label>
                      <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)} style={inpSty}>
                        {REFUND_MODES.map(m => (
                          <option key={m} value={m}>{m.replace('_',' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Reason</label>
                      <input value={reason} onChange={e => setReason(e.target.value)}
                        placeholder="Damaged / Wrong item / etc."
                        style={inpSty} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Notes</label>
                    <input value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Optional internal notes"
                      style={inpSty} />
                  </div>
                  {formErr && (
                    <p className="text-xs font-semibold px-3 py-2 rounded-xl"
                      style={{ background: '#fef2f2', color: '#dc2626' }}>{formErr}</p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    {refundTotal > 0 && (
                      <div className="text-sm font-extrabold" style={{ color: '#15803d' }}>
                        Refund: {fmtINR(refundTotal)} via {refundMethod.toUpperCase()}
                      </div>
                    )}
                    <button type="submit" disabled={saving}
                      className="ml-auto px-8 py-2.5 rounded-xl font-extrabold text-sm active:scale-95 disabled:opacity-60"
                      style={{ background: B.goldGrad, color: B.darkBrown }}>
                      {saving ? 'Saving…' : '✓ Record Return'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-end"
              style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>From</label>
                <input type="date" value={histFrom} onChange={e => setHistFrom(e.target.value)} style={{...inpSty,width:140}} />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>To</label>
                <input type="date" value={histTo} onChange={e => setHistTo(e.target.value)} style={{...inpSty,width:140}} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Search</label>
                <input value={histSearch} onChange={e => setHistSearch(e.target.value)}
                  placeholder="Return No / Invoice / Customer"
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
                <p className="text-4xl mb-3">↩️</p>
                <p className="font-semibold" style={{ color: B.textLight }}>No sales returns found</p>
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: B.darkBrown }}>
                      {['Return No','Date','Invoice','Customer','Items','Refund','Mode','By',''].map(h => (
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
                          <td className="px-3 py-2.5 font-mono font-bold text-xs" style={{ color: '#7c3aed' }}>
                            {ret.return_number}
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: B.textLight }}>
                            {ret.return_date}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: B.brown }}>
                            {ret.invoice_number}
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: B.darkBrown }}>
                            {ret.customer_name || '—'}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-center" style={{ color: B.text }}>
                            {(ret.items || []).length}
                          </td>
                          <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#15803d' }}>
                            {fmtINR(ret.refund_amount)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: '#ede9fe', color: '#7c3aed' }}>
                              {ret.refund_method?.replace('_',' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs" style={{ color: B.textLight }}>
                            {ret.processed_by}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              <button onClick={() => setExpandedId(expandedId===ret.id ? null : ret.id)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#f3e8ff', color: '#7c3aed' }}>
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
                            <td colSpan={9} className="px-4 py-3"
                              style={{ background: '#f9f5ff', borderBottom: '2px solid #e8d5a3' }}>
                              <div className="space-y-1.5">
                                {ret.reason && (
                                  <p className="text-xs font-semibold" style={{ color: '#7c3aed' }}>
                                    Reason: {ret.reason}
                                  </p>
                                )}
                                <table className="w-full text-xs rounded-xl overflow-hidden">
                                  <thead>
                                    <tr style={{ background: '#ede9fe' }}>
                                      {['Product','Qty Returned','Unit Price','Refund','Restock'].map(h => (
                                        <th key={h} className="px-3 py-1.5 text-left font-bold" style={{ color: '#7c3aed' }}>{h}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(ret.items||[]).map(it => (
                                      <tr key={it.id} style={{ borderBottom: '1px solid #e9d5ff' }}>
                                        <td className="px-3 py-1.5 font-semibold" style={{ color: B.darkBrown }}>{it.product_name}</td>
                                        <td className="px-3 py-1.5 font-mono">{parseFloat(it.qty_returned)}</td>
                                        <td className="px-3 py-1.5">{fmtINR(it.unit_price)}</td>
                                        <td className="px-3 py-1.5 font-bold" style={{ color: '#15803d' }}>{fmtINR(it.line_total)}</td>
                                        <td className="px-3 py-1.5">{it.restock ? '✓ Yes' : '✗ No'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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
