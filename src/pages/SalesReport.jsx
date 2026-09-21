import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCategorySalesStats } from '../api/client';

// ── Colour palette ────────────────────────────────────────────────────────────
const B = {
  darkBrown:  '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold:       '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  cream:      '#fdf6e3', text: '#7a4e08', textLight: '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:     'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const BAR_COLORS = [
  '#b8860b','#d4a017','#a0522d','#8b4513','#cd853f',
  '#daa520','#c47a2b','#996633','#bf8040','#a67c52',
];

const fmt  = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => parseFloat(n || 0).toLocaleString('en-IN');

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(d) { return d.toISOString().slice(0, 10); }   // YYYY-MM-DD

function getPresetRange(preset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today':
      return { dateFrom: toISO(today), dateTo: toISO(today) };
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { dateFrom: toISO(y), dateTo: toISO(y) };
    }
    case 'this_week': {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
      return { dateFrom: toISO(mon), dateTo: toISO(today) };
    }
    case 'last_week': {
      const mon = new Date(today);
      mon.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { dateFrom: toISO(mon), dateTo: toISO(sun) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: toISO(start), dateTo: toISO(today) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end   = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: toISO(start), dateTo: toISO(end) };
    }
    case 'all':
    default:
      return { dateFrom: '', dateTo: '' };
  }
}

const PRESETS = [
  { key: 'today',      label: 'Today' },
  { key: 'yesterday',  label: 'Yesterday' },
  { key: 'this_week',  label: 'This Week' },
  { key: 'last_week',  label: 'Last Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'all',        label: 'All Time' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function SalesReport() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Date filter state
  const [activePreset, setActivePreset] = useState('today');
  const [dateFrom, setDateFrom]         = useState(toISO(new Date()));
  const [dateTo,   setDateTo]           = useState(toISO(new Date()));

  // Report data state
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [searched, setSearched] = useState(false);

  const fetchStats = useCallback(async (from, to) => {
    setLoading(true); setError(''); setSearched(true);
    try {
      const res = await getCategorySalesStats({ dateFrom: from, dateTo: to });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load sales report. Please try again.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  // Apply a quick preset
  const applyPreset = (key) => {
    setActivePreset(key);
    const { dateFrom: f, dateTo: t } = getPresetRange(key);
    setDateFrom(f);
    setDateTo(t);
    fetchStats(f, t);
  };

  // Apply custom date range
  const applyCustom = () => {
    setActivePreset('custom');
    fetchStats(dateFrom, dateTo);
  };

  // Derived
  const activeCats  = data?.by_category?.filter(c => c.total_qty > 0) || [];
  const allCats     = data?.by_category || [];
  const maxQty      = activeCats.length > 0 ? Math.max(...activeCats.map(c => c.total_qty)) : 1;
  const maxRevenue  = activeCats.length > 0 ? Math.max(...activeCats.map(c => c.total_revenue)) : 1;
  const topProducts = data?.top_products || [];
  const summary     = data?.summary || { total_sales: 0, total_revenue: 0, total_tax: 0 };

  const rangeLabel = data?.date_from && data?.date_to
    ? `${data.date_from}  →  ${data.date_to}`
    : (!data?.date_from && !data?.date_to && searched) ? 'All Time' : '';

  const inputSty = {
    background: '#fff9ee', border: `1.5px solid ${B.gold}`, color: B.brown,
    borderRadius: 10, padding: '8px 12px', fontSize: 14, outline: 'none',
  };

  return (
    <div className="min-h-screen" style={{ background: B.pageGrad }}>

      {/* ── Navbar ── */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: B.bgGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            style={{ border: `2px solid ${B.gold}` }} />
          <div>
            <h1 className="text-base font-extrabold uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>
              Crown Tea Hub
            </h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Bakery &amp; Café</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(212,160,23,0.25)', color: B.goldLight, border: '1px solid rgba(212,160,23,0.5)' }}>
            {user?.role}
          </span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'rgba(212,160,23,0.15)', color: B.goldLight, border: `1px solid rgba(212,160,23,0.4)` }}>
            Dashboard
          </button>
          <button onClick={() => { signOut(); navigate('/login'); }}
            className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95 transition-all"
            style={{ background: B.goldGrad, color: B.brown }}>
            Logout
          </button>
        </div>
      </nav>

      {/* ── Page content ── */}
      <div className="max-w-5xl mx-auto mt-8 px-4 pb-12 space-y-6">

        {/* Title */}
        <div>
          <h2 className="text-2xl font-extrabold" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>
            Sales Report
          </h2>
          <p className="text-sm mt-0.5" style={{ color: B.textLight }}>Select a date range to view sales by category</p>
        </div>

        {/* ── Date filter card ── */}
        <div className="rounded-2xl shadow-md overflow-hidden" style={{ border: B.goldBorder }}>
          <div className="h-1" style={{ background: B.goldGrad }} />
          <div className="px-5 py-3" style={{ background: B.bgGrad }}>
            <h3 className="font-bold text-sm" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
              Date Range Filter
            </h3>
          </div>
          <div className="p-5 space-y-4" style={{ background: 'white' }}>

            {/* Quick preset buttons */}
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(p => (
                <button key={p.key} onClick={() => applyPreset(p.key)}
                  className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                  style={activePreset === p.key
                    ? { background: B.goldGrad, color: B.brown, boxShadow: '0 2px 8px rgba(180,130,10,0.35)' }
                    : { background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: '#e8d5a3' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: B.textLight }}>or custom range</span>
              <div className="flex-1 h-px" style={{ background: '#e8d5a3' }} />
            </div>

            {/* Custom date inputs */}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
                  From Date
                </label>
                <input type="date" value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setActivePreset('custom'); }}
                  style={inputSty} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
                  To Date
                </label>
                <input type="date" value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setActivePreset('custom'); }}
                  style={inputSty} />
              </div>
              <button onClick={applyCustom}
                disabled={!dateFrom || !dateTo}
                className="font-bold px-6 py-2 rounded-xl text-sm active:scale-95 transition-all"
                style={{ background: (!dateFrom || !dateTo) ? '#e8d5a3' : B.goldGrad,
                  color: (!dateFrom || !dateTo) ? '#aaa' : B.brown }}>
                Apply
              </button>
              {data && (
                <button onClick={() => applyPreset('all')}
                  className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
                  style={{ background: '#fff9ee', border: B.goldBorder, color: B.textLight }}>
                  Clear Filter
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* Prompt before first search */}
        {!searched && !loading && (
          <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: B.goldBorder }}>
            <div className="text-5xl mb-4">📊</div>
            <p className="font-bold text-lg" style={{ color: B.text }}>Select a date range above</p>
            <p className="text-sm mt-1" style={{ color: B.textLight }}>Click a preset or enter custom dates and press Apply</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-20 text-center font-medium text-lg" style={{ color: B.textLight }}>
            Loading report...
          </div>
        )}

        {/* ── Results ── */}
        {!loading && data && (
          <>
            {/* Period badge */}
            {rangeLabel && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: B.textLight }}>Showing:</span>
                <span className="text-sm font-bold px-4 py-1.5 rounded-full"
                  style={{ background: B.goldGrad, color: B.brown }}>
                  {rangeLabel}
                </span>
              </div>
            )}

            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard label="Total Bills"         value={fmtN(summary.total_sales)}    icon="🧾" />
              <SummaryCard label="Total Revenue"       value={`₹${fmt(summary.total_revenue)}`} icon="💰" highlight />
              <SummaryCard label="GST Collected"       value={`₹${fmt(summary.total_tax)}`} icon="📋" />
            </div>

            {/* Category qty chart */}
            <Card title="Items Sold by Category" subtitle="Quantity of items sold per category">
              {activeCats.length === 0 ? (
                <p className="text-center py-10 font-medium" style={{ color: B.textLight }}>
                  No sales in this date range.
                </p>
              ) : (
                <div className="space-y-4 mt-2">
                  {activeCats.map((cat, i) => (
                    <div key={cat.category_id}>
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ color: B.text }}>{cat.category_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: '#fff9ee', border: B.goldBorder, color: B.textLight }}>
                            {cat.total_orders} bill{cat.total_orders !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-extrabold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                            {fmtN(cat.total_qty)} units
                          </span>
                          <span className="text-xs ml-2" style={{ color: B.textLight }}>₹{fmt(cat.total_revenue)}</span>
                        </div>
                      </div>
                      <div className="h-8 rounded-xl overflow-hidden" style={{ background: '#e8d5a3' }}>
                        <div className="h-full rounded-xl flex items-center px-3 transition-all duration-700"
                          style={{
                            width: `${Math.max(5, (cat.total_qty / maxQty) * 100)}%`,
                            background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}, ${B.goldLight})`,
                          }}>
                          <span className="text-xs font-bold text-white drop-shadow truncate">{fmtN(cat.total_qty)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Revenue chart */}
            {activeCats.length > 0 && (
              <Card title="Revenue by Category" subtitle="Total sales amount per category (₹)">
                <div className="space-y-4 mt-2">
                  {[...activeCats].sort((a, b) => b.total_revenue - a.total_revenue).map((cat, i) => (
                    <div key={cat.category_id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold" style={{ color: B.text }}>{cat.category_name}</span>
                        <span className="text-sm font-extrabold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                          ₹{fmt(cat.total_revenue)}
                        </span>
                      </div>
                      <div className="h-8 rounded-xl overflow-hidden" style={{ background: '#e8d5a3' }}>
                        <div className="h-full rounded-xl flex items-center px-3 transition-all duration-700"
                          style={{
                            width: `${Math.max(5, (cat.total_revenue / maxRevenue) * 100)}%`,
                            background: `linear-gradient(90deg, ${B.goldDark}, ${B.goldLight})`,
                          }}>
                          <span className="text-xs font-bold text-white drop-shadow">₹{fmt(cat.total_revenue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Category table */}
            <Card title="Category Summary" subtitle="All categories with full breakdown">
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${B.gold}` }}>
                      {['Category', 'Bills', 'Units Sold', 'Revenue (₹)'].map(h => (
                        <th key={h} className="pb-2 text-left text-xs font-bold uppercase tracking-wider pr-4"
                          style={{ color: B.textLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allCats.map((cat, i) => (
                      <tr key={cat.category_id} style={{ borderBottom: '1px solid #e8d5a3' }}>
                        <td className="py-2.5 pr-4 font-semibold" style={{ color: B.text }}>
                          <span className="inline-block w-2.5 h-2.5 rounded-full mr-2"
                            style={{ background: cat.total_qty > 0 ? BAR_COLORS[i % BAR_COLORS.length] : '#d0c8b8', verticalAlign: 'middle' }} />
                          {cat.category_name}
                        </td>
                        <td className="py-2.5 pr-4" style={{ color: B.textLight }}>
                          {cat.total_orders > 0 ? cat.total_orders : <span style={{ color: '#bbb' }}>—</span>}
                        </td>
                        <td className="py-2.5 pr-4 font-bold" style={{ color: cat.total_qty > 0 ? B.goldDark : '#bbb' }}>
                          {cat.total_qty > 0 ? fmtN(cat.total_qty) : '—'}
                        </td>
                        <td className="py-2.5 font-bold" style={{ color: cat.total_revenue > 0 ? B.text : '#bbb' }}>
                          {cat.total_revenue > 0 ? `₹${fmt(cat.total_revenue)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {activeCats.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${B.gold}` }}>
                        <td className="pt-3 font-extrabold" style={{ color: B.text }}>Total</td>
                        <td className="pt-3 font-extrabold" style={{ color: B.text }}>{summary.total_sales}</td>
                        <td className="pt-3 font-extrabold" style={{ color: B.goldDark }}>
                          {fmtN(activeCats.reduce((s, c) => s + c.total_qty, 0))}
                        </td>
                        <td className="pt-3 font-extrabold" style={{ color: B.text }}>
                          ₹{fmt(summary.total_revenue)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </Card>

            {/* Top products */}
            <Card title="Top 10 Best-Selling Products" subtitle="Ranked by quantity sold in the selected period">
              {topProducts.length === 0 ? (
                <p className="text-center py-8 font-medium" style={{ color: B.textLight }}>No product sales in this range.</p>
              ) : (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${B.gold}` }}>
                        {['Rank', 'Product', 'Category', 'Units Sold', 'Revenue (₹)'].map(h => (
                          <th key={h} className="pb-2 text-left text-xs font-bold uppercase tracking-wider pr-4"
                            style={{ color: B.textLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e8d5a3' }}>
                          <td className="py-2.5 pr-4">
                            {i === 0 ? <span className="text-xl">🥇</span>
                           : i === 1 ? <span className="text-xl">🥈</span>
                           : i === 2 ? <span className="text-xl">🥉</span>
                           : <span className="font-bold text-xs px-2 py-0.5 rounded-full"
                               style={{ background: '#f5ead0', color: B.textLight }}>#{i + 1}</span>}
                          </td>
                          <td className="py-2.5 pr-4 font-semibold" style={{ color: B.text }}>{p.product_name}</td>
                          <td className="py-2.5 pr-4">
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: '#fff9ee', border: B.goldBorder, color: B.textLight }}>
                              {p.category_name}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 font-extrabold" style={{ color: B.goldDark }}>{fmtN(p.total_qty)}</td>
                          <td className="py-2.5 font-bold" style={{ color: B.text }}>₹{fmt(p.total_revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, icon, highlight }) {
  return (
    <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'white', border: B.goldBorder }}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: B.textLight }}>{label}</p>
      </div>
      <p className="text-2xl font-extrabold" style={{ color: highlight ? B.goldDark : B.text }}>{value}</p>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl shadow-md overflow-hidden" style={{ border: B.goldBorder }}>
      <div className="h-1" style={{ background: B.goldGrad }} />
      <div className="px-5 py-3" style={{ background: B.bgGrad }}>
        <h3 className="font-bold text-base" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#c8a84b' }}>{subtitle}</p>}
      </div>
      <div className="p-5" style={{ background: 'white' }}>{children}</div>
    </div>
  );
}
