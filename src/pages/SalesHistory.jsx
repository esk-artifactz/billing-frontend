import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSalesHistory, getReceipt } from '../api/client';
import Receipt from '../components/Receipt';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const PM_STYLE = {
  cash: { bg: '#dcfce7', color: '#16a34a', label: 'Cash' },
  upi:  { bg: '#ede9fe', color: '#7c3aed', label: 'UPI' },
  card: { bg: '#dbeafe', color: '#1d4ed8', label: 'Card' },
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

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
  const [loadingBill, setLoadingBill] = useState(null); // invoice_number being fetched

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

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
            <div className="overflow-x-auto">
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
                          <button onClick={() => viewBill(s.invoice_number)}
                            disabled={loadingBill === s.invoice_number}
                            className="text-xs font-bold px-4 py-1.5 rounded-lg active:scale-95 disabled:opacity-60"
                            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
                            {loadingBill === s.invoice_number ? 'Loading…' : 'View Bill'}
                          </button>
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

      {/* Receipt modal — same printable bill as the POS */}
      {receiptData && (
        <Receipt sale={receiptData.sale} items={receiptData.items} onClose={() => setReceiptData(null)} />
      )}
    </div>
  );
}
