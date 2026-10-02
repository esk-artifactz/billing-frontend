import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getExpenseCategories, getExpenseReport } from '../api/client';

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

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // IST
const firstOfMonth = () => isoToday().slice(0, 8) + '01';

export default function ExpenseCategories() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Categories for the filter dropdown
  const [cats,       setCats]       = useState([]);

  // ── Report ────────────────────────────────────────────────────────────────
  const [report,     setReport]     = useState(null);
  const [reportLoad, setReportLoad] = useState(false);
  const [dateFrom,   setDateFrom]   = useState(firstOfMonth());
  const [dateTo,     setDateTo]     = useState(isoToday());
  const [filterCat,  setFilterCat]  = useState('all');
  const [filterMode, setFilterMode] = useState('all');
  const [reportView, setReportView] = useState('category');
  const [showUnpaid, setShowUnpaid] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ── Load categories for filter ────────────────────────────────────────────
  const loadCats = useCallback(async () => {
    try {
      const res = await getExpenseCategories();
      setCats(res.data.categories || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    }
  }, [navigate, signOut]);

  useEffect(() => { loadCats(); }, [loadCats]);

  // ── Load report ───────────────────────────────────────────────────────────
  const loadReport = useCallback(async () => {
    setReportLoad(true);
    try {
      const params = { from: dateFrom, to: dateTo };
      if (filterCat  !== 'all') params.category     = filterCat;
      if (filterMode !== 'all') params.payment_mode = filterMode;
      const res = await getExpenseReport(params);
      setReport(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setReportLoad(false); }
  }, [dateFrom, dateTo, filterCat, filterMode, navigate, signOut]);

  useEffect(() => { loadReport(); }, [loadReport]);

  const maxCatTotal = Math.max(...(report?.by_category?.map(c => c.total) || [1]), 1);

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
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Expense Report</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/daily-expenses')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg"
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
              Expense Report
            </h2>
            <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
              Analyse spends by category, supplier &amp; payment mode
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e8d5a3' }} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e8d5a3' }} />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Category</label>
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e8d5a3' }}>
                <option value="all">All Categories</option>
                {cats.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Payment Mode</label>
              <select value={filterMode} onChange={e => setFilterMode(e.target.value)}
                className="border-2 rounded-xl px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#e8d5a3' }}>
                <option value="all">All Modes</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            {/* Quick ranges */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Today',      fn: () => { setDateFrom(isoToday()); setDateTo(isoToday()); } },
                { label: 'This Month', fn: () => { setDateFrom(firstOfMonth()); setDateTo(isoToday()); } },
                { label: 'Last 7d',    fn: () => {
                  const d = new Date(); d.setDate(d.getDate() - 6);
                  setDateFrom(d.toLocaleDateString('en-CA')); setDateTo(isoToday());
                }},
              ].map(q => (
                <button key={q.label} onClick={q.fn}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                  style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>
                  {q.label}
                </button>
              ))}
            </div>
            <button onClick={loadReport}
              className="text-sm font-bold px-5 py-2 rounded-xl active:scale-95"
              style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
              Run Report
            </button>
          </div>
        </div>

        {reportLoad ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 animate-spin"
              style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
          </div>
        ) : report ? (
          <>
            {/* Grand total + unpaid + mode cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1 rounded-2xl p-5 shadow-sm"
                style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})`, border: `1px solid ${B.gold}` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#c8a84b' }}>Total Spent</p>
                <p className="text-3xl font-extrabold" style={{ color: B.goldLight }}>{fmtINR(report.grand_total)}</p>
                <p className="text-xs mt-1" style={{ color: '#c8a84b' }}>{dateFrom} → {dateTo}</p>
              </div>
              {/* Unpaid card — clickable */}
              <button onClick={() => setShowUnpaid(true)}
                className="rounded-2xl p-5 shadow-sm text-left transition-all active:scale-95"
                style={{ background: parseFloat(report.unpaid_total) > 0 ? '#fef2f2' : '#f0fdf4',
                         border: `1.5px solid ${parseFloat(report.unpaid_total) > 0 ? '#fca5a5' : '#bbf7d0'}` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1"
                  style={{ color: parseFloat(report.unpaid_total) > 0 ? '#dc2626' : '#16a34a' }}>
                  Unpaid / Pending
                </p>
                <p className="text-2xl font-extrabold"
                  style={{ color: parseFloat(report.unpaid_total) > 0 ? '#dc2626' : '#16a34a' }}>
                  {fmtINR(report.unpaid_total)}
                </p>
                <p className="text-xs mt-1"
                  style={{ color: parseFloat(report.unpaid_total) > 0 ? '#ef4444' : '#22c55e' }}>
                  {(report.unpaid_items || []).length} unpaid entries · tap to view
                </p>
              </button>
              {(report.by_mode || []).map(m => {
                const s = PM_STYLE[m.mode] || { bg: '#f5f5f5', color: '#555', label: m.mode };
                return (
                  <div key={m.mode} className="rounded-2xl p-4 shadow-sm"
                    style={{ background: s.bg, border: `1px solid ${s.color}40` }}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: s.color }}>{s.label}</p>
                    <p className="text-2xl font-extrabold" style={{ color: s.color }}>{fmtINR(m.total)}</p>
                    <p className="text-xs mt-0.5" style={{ color: s.color + 'bb' }}>{m.count} entries</p>
                  </div>
                );
              })}
            </div>

            {/* View selector */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'category', label: 'By Category' },
                { key: 'supplier', label: 'By Supplier' },
                { key: 'mode',     label: 'By Payment Mode' },
                { key: 'recent',   label: 'Transactions' },
              ].map(v => (
                <button key={v.key} onClick={() => setReportView(v.key)}
                  className="px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={reportView === v.key
                    ? { background: B.gold, color: B.darkBrown }
                    : { background: '#fff', border: '1px solid #e8d5a3', color: B.text }}>
                  {v.label}
                </button>
              ))}
            </div>

            {/* By Category */}
            {reportView === 'category' && (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-5 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                  <h3 className="font-bold text-sm" style={{ color: B.text }}>Spending by Category</h3>
                </div>
                {report.by_category.length === 0 ? (
                  <p className="text-center py-10 text-sm" style={{ color: B.textLight }}>No data for selected period.</p>
                ) : (
                  <div className="divide-y" style={{ borderColor: '#f0e0c0' }}>
                    {report.by_category.map(c => (
                      <div key={c.category} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                            <span className="font-semibold text-sm" style={{ color: B.darkBrown }}>{c.category}</span>
                            <span className="text-xs text-gray-400">{c.count} entries</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: c.color + '22', color: c.color }}>{c.pct}%</span>
                            <span className="font-extrabold" style={{ color: B.brown }}>{fmtINR(c.total)}</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0e8d0' }}>
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(c.total / maxCatTotal) * 100}%`, background: c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* By Supplier */}
            {reportView === 'supplier' && (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-5 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                  <h3 className="font-bold text-sm" style={{ color: B.text }}>Spending by Supplier / Vendor</h3>
                </div>
                {report.by_supplier.length === 0 ? (
                  <p className="text-center py-10 text-sm" style={{ color: B.textLight }}>No "Paid To" data for selected period.</p>
                ) : (
                  <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                          {['#', 'Supplier / Vendor', 'Entries', 'Total Paid'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{ color: B.goldLight }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_supplier.map((s, idx) => (
                          <tr key={s.paid_to}
                            style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                            <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{idx + 1}</td>
                            <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{s.paid_to}</td>
                            <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{s.count}</td>
                            <td className="px-4 py-3 font-extrabold" style={{ color: B.brown }}>{fmtINR(s.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* By Mode */}
            {reportView === 'mode' && (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-5 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                  <h3 className="font-bold text-sm" style={{ color: B.text }}>Spending by Payment Mode</h3>
                </div>
                <div className="divide-y" style={{ borderColor: '#f0e0c0' }}>
                  {report.by_mode.map(m => {
                    const s = PM_STYLE[m.mode] || { bg: '#f5f5f5', color: '#555', label: m.mode };
                    const pct = report.grand_total ? Math.round((m.total / report.grand_total) * 100) : 0;
                    return (
                      <div key={m.mode} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold px-3 py-1 rounded-full uppercase"
                              style={{ background: s.bg, color: s.color }}>{s.label}</span>
                            <span className="text-xs text-gray-400">{m.count} entries</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold" style={{ color: s.color }}>{pct}%</span>
                            <span className="font-extrabold" style={{ color: B.brown }}>{fmtINR(m.total)}</span>
                          </div>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#f0e8d0' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Transactions */}
            {reportView === 'recent' && (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-5 py-3 border-b flex items-center justify-between"
                  style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                  <h3 className="font-bold text-sm" style={{ color: B.text }}>
                    Recent Transactions
                    <span className="ml-2 text-xs font-normal text-gray-400">(latest 50)</span>
                  </h3>
                  <button onClick={() => window.print()}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                    style={{ background: B.darkBrown, color: B.goldLight }}>Print</button>
                </div>
                {report.recent.length === 0 ? (
                  <p className="text-center py-10 text-sm" style={{ color: B.textLight }}>No transactions.</p>
                ) : (
                  <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                          {['Date', 'Category', 'Description', 'Paid To', 'Mode', 'Amount'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                              style={{ color: B.goldLight }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.recent.map((e, idx) => {
                          const pm = PM_STYLE[e.payment_mode] || { bg: '#f5f5f5', color: '#555', label: e.payment_mode };
                          const catObj = cats.find(c => c.name === e.category);
                          return (
                            <tr key={e.id}
                              style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                              <td className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                                {e.expense_date?.slice(0, 10)}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="flex items-center gap-1.5 text-xs font-semibold">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: catObj?.color || B.gold }} />
                                  {e.category}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 max-w-[180px]">
                                <div className="truncate text-sm font-semibold" title={e.description} style={{ color: B.darkBrown }}>{e.description}</div>
                                {e.notes && <div className="truncate text-xs text-gray-400" title={e.notes}>{e.notes}</div>}
                              </td>
                              <td className="px-4 py-2.5 text-xs" style={{ color: B.textLight }}>{e.paid_to || '—'}</td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full uppercase"
                                  style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
                              </td>
                              <td className="px-4 py-2.5 font-extrabold whitespace-nowrap" style={{ color: B.brown }}>
                                {fmtINR(e.amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                          <td colSpan={5} className="px-4 py-3 text-sm font-bold text-right" style={{ color: B.text }}>
                            Total ({report.recent.length} shown):
                          </td>
                          <td className="px-4 py-3 font-extrabold" style={{ color: B.brown }}>
                            {fmtINR(report.recent.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16" style={{ color: B.textLight }}>
            <p className="text-lg font-semibold">Set a date range and click "Run Report"</p>
          </div>

        )}
      </div>

      {/* ── Unpaid Drawer ──────────────────────────────────────────────────────── */}
      {showUnpaid && report && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          style={{ background: 'rgba(45,26,14,0.65)' }}>
          <div className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            style={{ background: '#fff', border: `2px solid #fca5a5` }}>

            {/* Header */}
            <div className="h-1 flex-shrink-0" style={{ background: 'linear-gradient(90deg,#dc2626,#f87171,#dc2626)' }} />
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
              style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca' }}>
              <div>
                <h3 className="text-base font-extrabold" style={{ color: '#7f1d1d' }}>
                  Unpaid / Pending Expenses
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>
                  {dateFrom} → {dateTo} &nbsp;·&nbsp; {(report.unpaid_items || []).length} entries &nbsp;·&nbsp;
                  Total: <span className="font-extrabold">{fmtINR(report.unpaid_total)}</span>
                </p>
              </div>
              <button onClick={() => setShowUnpaid(false)}
                className="text-2xl font-bold leading-none" style={{ color: '#dc2626' }}>×</button>
            </div>

            {/* Card list — no table, no horizontal scroll */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {(report.unpaid_items || []).length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-4xl mb-3">✅</p>
                  <p className="font-semibold" style={{ color: '#16a34a' }}>All expenses are paid!</p>
                </div>
              ) : (
                <>
                  {(report.unpaid_items || []).map((e) => {
                    const remaining = parseFloat(e.remaining_amount ?? e.amount);
                    const paid      = parseFloat(e.paid_amount ?? 0);
                    const total     = parseFloat(e.amount ?? 0);
                    const isPartial = paid > 0 && paid < total;
                    return (
                      <div key={e.id} className="rounded-xl border p-3 space-y-2"
                        style={{ background: '#fff', borderColor: '#fecaca' }}>
                        {/* Row 1: date + category + status badge */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold" style={{ color: '#7f1d1d' }}>
                              {e.expense_date?.slice(0, 10)}
                            </span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>
                              {e.category}
                            </span>
                            {isPartial && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}>
                                Partial
                              </span>
                            )}
                          </div>
                          {e.paid_to && (
                            <span className="text-xs font-semibold" style={{ color: '#7f1d1d' }}>
                              {e.paid_to}
                            </span>
                          )}
                        </div>
                        {/* Row 2: description */}
                        <p className="text-sm font-semibold truncate" style={{ color: '#1c1917' }}>
                          {e.description}
                        </p>
                        {e.notes && <p className="text-xs text-gray-400 truncate">{e.notes}</p>}
                        {/* Row 3: Bill / Paid / Remaining */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: '#f9fafb' }}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#9ca3af' }}>Bill</p>
                            <p className="text-sm font-extrabold" style={{ color: '#374151' }}>{fmtINR(total)}</p>
                          </div>
                          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: '#f0fdf4' }}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#16a34a' }}>Paid</p>
                            <p className="text-sm font-extrabold" style={{ color: '#16a34a' }}>{fmtINR(paid)}</p>
                          </div>
                          <div className="rounded-lg px-2 py-1.5 text-center" style={{ background: '#fef2f2' }}>
                            <p className="text-xs font-bold uppercase tracking-wide mb-0.5" style={{ color: '#dc2626' }}>Due</p>
                            <p className="text-sm font-extrabold" style={{ color: '#dc2626' }}>{fmtINR(remaining)}</p>
                          </div>
                        </div>
                        {/* Progress bar */}
                        {total > 0 && (
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#fecaca' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${Math.min((paid / total) * 100, 100)}%`, background: '#16a34a', transition: 'width 0.3s' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Footer total */}
                  <div className="rounded-xl p-3 sticky bottom-0"
                    style={{ background: '#fef2f2', border: '2px solid #fca5a5' }}>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: '#9ca3af' }}>Total Bill</p>
                        <p className="text-sm font-extrabold" style={{ color: '#374151' }}>
                          {fmtINR((report.unpaid_items || []).reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: '#16a34a' }}>Total Paid</p>
                        <p className="text-sm font-extrabold" style={{ color: '#16a34a' }}>
                          {fmtINR((report.unpaid_items || []).reduce((s, e) => s + parseFloat(e.paid_amount || 0), 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase" style={{ color: '#dc2626' }}>Total Due</p>
                        <p className="text-sm font-extrabold" style={{ color: '#dc2626' }}>
                          {fmtINR(report.unpaid_total)}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
