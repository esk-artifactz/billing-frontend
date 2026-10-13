import { useState, useEffect, useCallback } from 'react';
import { useEscClose } from '../hooks/useEscClose';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSalesHistory, getReceipt, updateSale } from '../api/client';
import Receipt from '../components/Receipt';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const PM_STYLE = {
  cash:  { bg: '#dcfce7', color: '#16a34a', label: 'Cash' },
  upi:   { bg: '#ede9fe', color: '#7c3aed', label: 'UPI' },
  card:  { bg: '#dbeafe', color: '#1d4ed8', label: 'Card' },
  split: { bg: '#fef3c7', color: '#b45309', label: 'Split' },
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // IST

export default function SalesHistory() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const isCashier = user?.role === 'Cashier';

  const [sales,       setSales]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filterDate,  setFilterDate]  = useState(today());
  const [search,      setSearch]      = useState('');
  const [filterMode,  setFilterMode]  = useState('all');

  const [receiptData, setReceiptData] = useState(null);
  useEscClose(() => setReceiptData(null), !!receiptData);
  const [loadingBill, setLoadingBill] = useState(null); // invoice_number being fetched

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ── Edit bill modal ─────────────────────────────────────────────────────
  const [editSale,  setEditSale]  = useState(null);   // sale row being edited
  const [editForm,  setEditForm]  = useState(null);
  const [editSaving,setEditSaving]= useState(false);
  const [editErr,   setEditErr]   = useState('');
  useEscClose(() => setEditSale(null), !!editSale);

  const openEdit = (s) => {
    let splits = {};
    try { splits = typeof s.payment_splits === 'string' ? JSON.parse(s.payment_splits) : (s.payment_splits || {}); } catch { splits = {}; }
    setEditForm({
      payment_method:  s.payment_method || 'cash',
      amount_tendered: s.amount_tendered ?? '',
      customer_name:   s.customer_name || '',
      customer_mobile: s.customer_mobile || '',
      discount_total:  s.discount_total ?? '',
      parcel_charge:   s.parcel_charge ?? '',
      split_cash: splits.cash ?? '',
      split_upi:  splits.upi  ?? '',
      split_card: splits.card ?? '',
    });
    setEditErr('');
    setEditSale(s);
  };

  const saveEdit = async () => {
    const discount = parseFloat(editForm.discount_total) || 0;
    const parcel   = parseFloat(editForm.parcel_charge)  || 0;
    const subtotal = parseFloat(editSale.subtotal || 0);
    const tax      = parseFloat(editSale.tax_total || 0);
    const newTotal = Math.round(subtotal - discount + tax + parcel);
    const payload  = {
      payment_method:  editForm.payment_method,
      amount_tendered: editForm.amount_tendered === '' ? null : parseFloat(editForm.amount_tendered),
      customer_name:   editForm.customer_name.trim() || null,
      customer_mobile: editForm.customer_mobile.trim() || null,
      discount_total:  discount,
      parcel_charge:   parcel,
    };
    if (editForm.payment_method === 'split') {
      const sp = {};
      if (parseFloat(editForm.split_cash) > 0) sp.cash = parseFloat(editForm.split_cash);
      if (parseFloat(editForm.split_upi)  > 0) sp.upi  = parseFloat(editForm.split_upi);
      if (parseFloat(editForm.split_card) > 0) sp.card = parseFloat(editForm.split_card);
      const spSum = Object.values(sp).reduce((a, b) => a + b, 0);
      if (Math.abs(spSum - newTotal) >= 0.01) {
        setEditErr(`Split amounts (₹${fmtINR(spSum)}) must equal new bill total (₹${fmtINR(newTotal)})`);
        return;
      }
      payload.payment_splits = sp;
    }
    setEditSaving(true); setEditErr('');
    try {
      await updateSale(editSale.id, payload);
      setEditSale(null);
      showToast('Bill updated!');
      load();
    } catch (err) {
      setEditErr(err.response?.data?.detail || 'Failed to update bill.');
    } finally { setEditSaving(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (search)     params.search = search;
      const res = await getSalesHistory(params);
      setSales(res.data.sales || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setLoading(false); }
  }, [filterDate, search, navigate, signOut]);

  useEffect(() => { load(); }, [load]);

  const viewBill = async (invoiceNumber) => {
    setLoadingBill(invoiceNumber);
    try {
      const res = await getReceipt(invoiceNumber);
      setReceiptData(res.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Could not load bill.', false);
    } finally { setLoadingBill(null); }
  };

  const filtered = sales.filter(s => filterMode === 'all' || s.payment_method === filterMode);
  const dayTotal = filtered.reduce((s, x) => s + parseFloat(x.grand_total || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg,${B.cream} 0%,${B.creamMid} 60%,#ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown},${B.brown})`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Bill History</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/billing')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Billing</button>
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
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                Bill History
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                {isCashier
                  ? "Today's bills — search and print a duplicate copy for the customer"
                  : 'Search any bill and print a duplicate copy for the customer'}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c8a84b' }}>Total</p>
              <p className="text-2xl font-extrabold" style={{ color: B.goldLight }}>{fmtINR(dayTotal)}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4"
          style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>
              Date
              {isCashier && <span className="ml-1 font-normal text-amber-600">(today only)</span>}
            </label>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              disabled={isCashier}
              className="border-2 rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ borderColor: '#e8d5a3' }} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>
              Search (invoice no / customer / cashier)
            </label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="e.g. INV-20260918-0003 or customer mobile…"
              className="w-full border-2 rounded-xl px-4 py-2 text-sm outline-none"
              style={{ borderColor: '#e8d5a3' }} />
          </div>
          <div>
            <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Payment</label>
            <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
              className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ borderColor: '#e8d5a3' }}>
              <option value="all">All</option>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="split">Split</option>
            </select>
          </div>
          <div className="flex gap-2">
            {!isCashier && filterDate && (
              <button onClick={() => setFilterDate('')}
                className="text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95"
                style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                All Dates
              </button>
            )}
            <button onClick={load}
              className="text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95"
              style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
              Refresh
            </button>
          </div>
        </div>

        {/* Bills table */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">🧾</p>
              <p className="text-lg font-semibold" style={{ color: B.textLight }}>No bills found</p>
              <p className="text-sm mt-1" style={{ color: '#bbb' }}>
                {isCashier
                  ? "Only today's bills are visible to Cashiers."
                  : filterDate ? 'Try clearing the date filter to see all bills.' : 'Bills created in Billing will appear here.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                    {['Invoice No', 'Time', 'Customer', 'Cashier', 'Items', 'Payment', 'Amount', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => {
                    const pm = PM_STYLE[s.payment_method] || { bg: '#f5f5f5', color: '#555', label: s.payment_method };
                    return (
                      <tr key={s.id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 font-mono text-xs font-bold whitespace-nowrap" style={{ color: B.darkBrown }}>
                          {s.invoice_number}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                          {new Date(s.sale_time).toLocaleString('en-IN', {
                            timeZone: 'Asia/Kolkata',
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit', hour12: true,
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: B.text }}>
                          {s.customer_name
                            ? <>{s.customer_name}{s.customer_mobile ? <span className="text-gray-400"> · {s.customer_mobile}</span> : ''}</>
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{s.cashier_username}</td>
                        <td className="px-4 py-3 text-xs text-center" style={{ color: B.textLight }}>{s.item_count ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                            style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                        </td>
                        <td className="px-4 py-3 font-extrabold whitespace-nowrap" style={{ color: B.brown }}>
                          {fmtINR(s.grand_total)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => viewBill(s.invoice_number)}
                              disabled={loadingBill === s.invoice_number}
                              className="text-xs font-bold px-4 py-1.5 rounded-lg active:scale-95 disabled:opacity-60"
                              style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
                              {loadingBill === s.invoice_number ? 'Loading…' : 'View Bill'}
                            </button>
                            {!isCashier && (
                              <button onClick={() => openEdit(s)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                                Edit
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                    <td colSpan={6} className="px-4 py-3 text-sm font-bold text-right" style={{ color: B.text }}>
                      Total ({filtered.length} bill{filtered.length !== 1 ? 's' : ''}):
                    </td>
                    <td className="px-4 py-3 font-extrabold text-lg" style={{ color: B.brown }}>{fmtINR(dayTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Bill modal ───────────────────────────────────────────────── */}
      {editSale && editForm && (() => {
        const inputStyle = {
          background: '#fff9ee', border: `1.5px solid ${B.gold}`, color: B.brown,
          borderRadius: 10, padding: '8px 12px', width: '100%', fontSize: 13, outline: 'none',
        };
        const discount = parseFloat(editForm.discount_total) || 0;
        const parcel   = parseFloat(editForm.parcel_charge)  || 0;
        const subtotal = parseFloat(editSale.subtotal || 0);
        const tax      = parseFloat(editSale.tax_total || 0);
        const newTotal = Math.round(subtotal - discount + tax + parcel);
        const spSum    = (parseFloat(editForm.split_cash) || 0) +
                         (parseFloat(editForm.split_upi)  || 0) +
                         (parseFloat(editForm.split_card) || 0);
        const spRemain = Math.round((newTotal - spSum) * 100) / 100;
        const fillRest = (key) => {
          const others = { split_cash: editForm.split_cash, split_upi: editForm.split_upi, split_card: editForm.split_card };
          const otherSum = (parseFloat(others.split_cash) || 0) + (parseFloat(others.split_upi) || 0) + (parseFloat(others.split_card) || 0) - (parseFloat(others[key]) || 0);
          setEditForm(f => ({ ...f, [key]: String(Math.max(0, Math.round((newTotal - otherSum) * 100) / 100)) }));
        };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(45,26,14,0.6)' }}
            onClick={ev => { if (ev.target === ev.currentTarget) setEditSale(null); }}>
            <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
              <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
              <div className="p-5 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold" style={{ color: B.brown }}>Edit Bill</h3>
                    <p className="text-xs font-mono" style={{ color: B.textLight }}>{editSale.invoice_number}</p>
                  </div>
                  <button onClick={() => setEditSale(null)} className="text-2xl font-bold leading-none" style={{ color: B.textLight }}>×</button>
                </div>

                {/* Payment method */}
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: B.text }}>Payment Method</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['cash', 'upi', 'card', 'split'].map(m => (
                      <button key={m} type="button"
                        onClick={() => setEditForm(f => ({ ...f, payment_method: m }))}
                        className="py-2 rounded-lg text-xs font-bold capitalize active:scale-95"
                        style={editForm.payment_method === m
                          ? { background: `linear-gradient(135deg,#b8860b,${B.goldLight})`, color: B.darkBrown, border: `2px solid #b8860b` }
                          : { background: '#fff9ee', color: B.text, border: `2px solid ${B.gold}` }}>
                        {m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split inputs */}
                {editForm.payment_method === 'split' && (
                  <div className="rounded-xl p-3 space-y-2" style={{ background: '#fff9ee', border: `1.5px dashed ${B.gold}` }}>
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: B.textLight }}>Split Amounts</p>
                    {[['split_cash','Cash','#16a34a'], ['split_upi','UPI','#7c3aed'], ['split_card','Card','#1d4ed8']].map(([k, lbl, c]) => (
                      <div key={k} className="flex items-center gap-2">
                        <label className="w-12 text-xs font-bold" style={{ color: c }}>{lbl}</label>
                        <input type="number" min="0" step="0.01" value={editForm[k]}
                          onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                          style={{ ...inputStyle, padding: '5px 9px', fontSize: 12 }} />
                        <button type="button" onClick={() => fillRest(k)}
                          className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                          style={{ background: '#fff', border: `1px solid ${c}55`, color: c }}>Rest</button>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t" style={{ borderColor: '#e8d5a3' }}>
                      <span className="text-xs font-bold" style={{ color: B.text }}>Collected: {fmtINR(spSum)}</span>
                      <span className="text-xs font-extrabold" style={{ color: Math.abs(spRemain) < 0.01 ? '#16a34a' : '#dc2626' }}>
                        {Math.abs(spRemain) < 0.01 ? '✓ Matches total' : `Remaining: ${fmtINR(spRemain)}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Tendered */}
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: B.text }}>Amount Tendered (₹)</label>
                  <input type="number" min="0" step="0.01" value={editForm.amount_tendered}
                    onChange={e => setEditForm(f => ({ ...f, amount_tendered: e.target.value }))}
                    placeholder={String(newTotal)} style={inputStyle} />
                </div>

                {/* Customer */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: B.text }}>Customer Name</label>
                    <input type="text" value={editForm.customer_name}
                      onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: B.text }}>Mobile</label>
                    <input type="tel" value={editForm.customer_mobile} maxLength={15}
                      onChange={e => setEditForm(f => ({ ...f, customer_mobile: e.target.value }))}
                      style={inputStyle} />
                  </div>
                </div>

                {/* Discount + Parcel */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: B.text }}>Discount (₹)</label>
                    <input type="number" min="0" step="0.01" value={editForm.discount_total}
                      onChange={e => setEditForm(f => ({ ...f, discount_total: e.target.value }))}
                      style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1" style={{ color: B.text }}>Parcel Charge (₹)</label>
                    <input type="number" min="0" step="0.01" value={editForm.parcel_charge}
                      onChange={e => setEditForm(f => ({ ...f, parcel_charge: e.target.value }))}
                      style={inputStyle} />
                  </div>
                </div>

                {/* New total preview */}
                <div className="rounded-xl px-3 py-2.5 flex justify-between items-center"
                  style={{ background: '#fff9ee', border: `1.5px solid ${B.gold}` }}>
                  <span className="text-xs font-bold" style={{ color: B.textLight }}>
                    New Bill Total {`(Subtotal ${fmtINR(subtotal)} − Discount + GST ${fmtINR(tax)} + Parcel)`}
                  </span>
                  <span className="font-extrabold" style={{ color: B.brown }}>{fmtINR(newTotal)}</span>
                </div>

                {editErr && (
                  <p className="text-xs font-semibold px-3 py-2 rounded-lg"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>{editErr}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setEditSale(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="button" onClick={saveEdit} disabled={editSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {editSaving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Receipt modal — same printable bill as the POS */}
      {receiptData && (
        <Receipt sale={receiptData.sale} items={receiptData.items} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}
