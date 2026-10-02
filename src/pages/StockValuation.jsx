import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStockValuation } from '../api/client';

// ── Theme ─────────────────────────────────────────────────────────────────────
const B = {
  darkBrown:  '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold:       '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  text:       '#7a4e08', textLight: '#a07020',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
  navGrad:    'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
};

const fmtINR = (n) =>
  `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n, unit) =>
  `${parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit || ''}`.trim();

// How much more MRP is vs purchase (profit margin %)
const margin = (purchase, sell) => {
  if (!purchase || purchase <= 0) return null;
  return (((sell - purchase) / purchase) * 100).toFixed(1);
};

export default function StockValuation() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [catFilter,  setCatFilter]  = useState('all');
  const [trackOnly,  setTrackOnly]  = useState(true);
  const [view,       setView]       = useState('table');    // 'table' | 'category'
  const [sortCol,    setSortCol]    = useState('name');     // column key
  const [sortAsc,    setSortAsc]    = useState(true);
  const [searchDraft, setSearchDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getStockValuation({
        category:   catFilter !== 'all' ? catFilter : undefined,
        search:     search || undefined,
        track_only: trackOnly,
      });
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOut(); navigate('/login');
      }
      setError('Failed to load stock valuation.');
    } finally {
      setLoading(false);
    }
  }, [catFilter, search, trackOnly, signOut, navigate]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // Sort products
  const sorted = data ? [...data.products].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av < bv) return sortAsc ? -1 : 1;
    if (av > bv) return sortAsc ?  1 : -1;
    return 0;
  }) : [];

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(a => !a);
    else { setSortCol(col); setSortAsc(true); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <span style={{ color: '#ccc' }}> ⇅</span>;
    return <span style={{ color: B.goldLight }}>{sortAsc ? ' ↑' : ' ↓'}</span>;
  };

  return (
    <div className="min-h-screen" style={{ background: B.pageGrad }}>

      {/* ── Navbar ── */}
      <nav className="text-white px-4 py-3 shadow-lg flex items-center justify-between sticky top-0 z-30"
        style={{ background: B.navGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-xl font-bold leading-none active:scale-95"
            style={{ color: B.goldLight }}>←</button>
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-base font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
              Crown Tea Hub
            </h1>
            <p className="text-xs" style={{ color: B.gold }}>Stock Valuation</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full"
          style={{ background: 'rgba(212,160,23,0.2)', color: B.goldLight }}>
          {user?.role}
        </span>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* ── Summary Cards ── */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard
              label="Purchase Value"
              value={fmtINR(data.total_purchase_value)}
              sub={`${data.count} products tracked`}
              bg="#dbeafe" border="#93c5fd" labelColor="#1e40af" valueColor="#1d4ed8"
            />
            <SummaryCard
              label="MRP Value"
              value={fmtINR(data.total_mrp_value)}
              sub="At maximum retail price"
              bg="#ede9fe" border="#c4b5fd" labelColor="#5b21b6" valueColor="#7c3aed"
            />
            <SummaryCard
              label="Selling Value"
              value={fmtINR(data.total_selling_value)}
              sub="At your selling price"
              bg="#dcfce7" border="#86efac" labelColor="#166534" valueColor="#16a34a"
            />
            <SummaryCard
              label="Potential Profit"
              value={fmtINR(data.potential_profit)}
              sub="Selling − Purchase value"
              bg="#fef9c3" border="#fde047" labelColor="#92400e" valueColor="#b45309"
            />
          </div>
        )}

        {/* ── Filters + View Toggle ── */}
        <div className="rounded-2xl shadow-sm p-4 space-y-3"
          style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[160px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: B.textLight }}>🔍</span>
              <input
                value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)}
                placeholder="Search product or brand…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border-2 outline-none"
                style={{ borderColor: '#e8d5a3' }}
              />
            </div>

            {/* Category filter */}
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="text-sm px-3 py-2 rounded-xl border-2 outline-none"
              style={{ borderColor: '#e8d5a3', minWidth: 150 }}>
              <option value="all">All Categories</option>
              {(data?.categories || []).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Track-stock toggle */}
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer select-none"
              style={{ color: B.text }}>
              <input type="checkbox" checked={trackOnly}
                onChange={e => setTrackOnly(e.target.checked)}
                className="w-4 h-4 accent-amber-600" />
              Tracked only
            </label>

            {/* View toggle */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#e8d5a3' }}>
              {[['table', '☰ Products'], ['category', '⊞ By Category']].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className="px-3 py-2 text-xs font-bold transition-all"
                  style={{
                    background: view === v ? B.gold : '#fff',
                    color:      view === v ? B.darkBrown : B.textLight,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={load}
              className="px-4 py-2 rounded-xl text-xs font-bold active:scale-95"
              style={{ background: B.goldGrad, color: B.darkBrown }}>
              Refresh
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 animate-spin"
              style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            PRODUCT TABLE VIEW
            ════════════════════════════════════════════════════════ */}
        {!loading && data && view === 'table' && (
          <div className="rounded-2xl shadow-sm overflow-hidden"
            style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
            {sorted.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-4xl mb-3">📦</p>
                <p className="font-semibold" style={{ color: B.textLight }}>No products found</p>
              </div>
            ) : (
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                      {[
                        ['name',           'Product'],
                        ['category_name',  'Category'],
                        ['current_stock',  'Stock'],
                        ['purchase_price', 'Purchase Rate'],
                        ['mrp',            'MRP'],
                        ['selling_price',  'Selling Price'],
                        ['purchase_value', 'Purchase Value'],
                        ['mrp_value',      'MRP Value'],
                        ['selling_value',  'Selling Value'],
                      ].map(([col, label]) => (
                        <th key={col}
                          onClick={() => handleSort(col)}
                          className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none"
                          style={{ color: B.goldLight }}>
                          {label}<SortIcon col={col} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((p, idx) => {
                      const pm = margin(p.purchase_price, p.mrp);
                      const sm = margin(p.purchase_price, p.selling_price);
                      const lowStock = p.minimum_stock_level && p.current_stock <= p.minimum_stock_level;
                      const zeroStock = p.current_stock <= 0;
                      return (
                        <tr key={p.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf0', borderBottom: '1px solid #f0e6c8' }}>
                          {/* Product name */}
                          <td className="px-3 py-3">
                            <div className="font-semibold" style={{ color: B.darkBrown }}>{p.name}</div>
                            {p.brand && <div className="text-xs" style={{ color: B.textLight }}>{p.brand}</div>}
                          </td>
                          {/* Category */}
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: '#fef3c7', color: B.text }}>
                              {p.category_name || '—'}
                            </span>
                          </td>
                          {/* Stock qty */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`text-sm font-extrabold`}
                              style={{ color: zeroStock ? '#dc2626' : lowStock ? '#d97706' : '#16a34a' }}>
                              {fmtQty(p.current_stock, p.unit)}
                            </span>
                            {zeroStock && <div className="text-xs font-bold" style={{ color: '#dc2626' }}>Out of stock</div>}
                            {!zeroStock && lowStock && <div className="text-xs font-bold" style={{ color: '#d97706' }}>Low stock</div>}
                          </td>
                          {/* Purchase rate */}
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#1d4ed8' }}>
                            {fmtINR(p.purchase_price)}
                          </td>
                          {/* MRP */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold" style={{ color: '#7c3aed' }}>{fmtINR(p.mrp)}</div>
                            {pm !== null && (
                              <div className="text-xs font-bold" style={{ color: '#7c3aed' }}>+{pm}%</div>
                            )}
                          </td>
                          {/* Selling price */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold" style={{ color: '#16a34a' }}>{fmtINR(p.selling_price)}</div>
                            {sm !== null && (
                              <div className="text-xs font-bold" style={{ color: '#16a34a' }}>+{sm}%</div>
                            )}
                          </td>
                          {/* Purchase value */}
                          <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#1d4ed8' }}>
                            {fmtINR(p.purchase_value)}
                          </td>
                          {/* MRP value */}
                          <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#7c3aed' }}>
                            {fmtINR(p.mrp_value)}
                          </td>
                          {/* Selling value */}
                          <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#16a34a' }}>
                            {fmtINR(p.selling_value)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                      <td colSpan={6} className="px-3 py-3 text-sm font-bold text-right"
                        style={{ color: B.text }}>
                        Total ({sorted.length} products):
                      </td>
                      <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#1d4ed8' }}>
                        {fmtINR(sorted.reduce((s, p) => s + p.purchase_value, 0))}
                      </td>
                      <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#7c3aed' }}>
                        {fmtINR(sorted.reduce((s, p) => s + p.mrp_value, 0))}
                      </td>
                      <td className="px-3 py-3 font-extrabold whitespace-nowrap" style={{ color: '#16a34a' }}>
                        {fmtINR(sorted.reduce((s, p) => s + p.selling_value, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            CATEGORY SUMMARY VIEW
            ════════════════════════════════════════════════════════ */}
        {!loading && data && view === 'category' && (
          <div className="space-y-3">
            {data.category_summary.length === 0 ? (
              <div className="rounded-2xl py-16 text-center shadow-sm"
                style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                <p className="text-4xl mb-3">📦</p>
                <p className="font-semibold" style={{ color: B.textLight }}>No data</p>
              </div>
            ) : data.category_summary.map((cat) => {
              const pmPct = margin(
                data.products.filter(p => (p.category_name || 'Uncategorised') === cat.category)
                  .reduce((s, p) => s + p.purchase_value, 0),
                data.products.filter(p => (p.category_name || 'Uncategorised') === cat.category)
                  .reduce((s, p) => s + p.selling_value, 0)
              );
              const barPct = data.total_purchase_value > 0
                ? Math.min((cat.purchase_value / data.total_purchase_value) * 100, 100)
                : 0;
              return (
                <div key={cat.category} className="rounded-2xl shadow-sm overflow-hidden"
                  style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                  {/* Category header */}
                  <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
                    style={{ background: '#fdf6e3', borderBottom: '1px solid #e8d5a3' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold" style={{ color: B.darkBrown }}>
                        {cat.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: '#fef3c7', color: B.text }}>
                        {cat.count} products
                      </span>
                    </div>
                    {pmPct !== null && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: '#dcfce7', color: '#16a34a' }}>
                        +{pmPct}% margin
                      </span>
                    )}
                  </div>

                  {/* Value bar */}
                  <div className="h-1.5" style={{ background: '#f0e6c8' }}>
                    <div className="h-full rounded-r-full"
                      style={{ width: `${barPct}%`, background: B.gold, transition: 'width 0.4s' }} />
                  </div>

                  {/* Three value boxes */}
                  <div className="grid grid-cols-3 divide-x" style={{ divideColor: '#e8d5a3' }}>
                    <ValBox label="Purchase Value" value={fmtINR(cat.purchase_value)} color="#1d4ed8" bg="#eff6ff" />
                    <ValBox label="MRP Value"      value={fmtINR(cat.mrp_value)}      color="#7c3aed" bg="#f5f3ff" />
                    <ValBox label="Selling Value"  value={fmtINR(cat.selling_value)}  color="#16a34a" bg="#f0fdf4" />
                  </div>
                </div>
              );
            })}

            {/* Grand total card */}
            <div className="rounded-2xl shadow-md overflow-hidden"
              style={{ background: B.darkBrown, border: `2px solid ${B.gold}` }}>
              <div className="h-1" style={{ background: B.goldGrad }} />
              <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
                style={{ borderBottom: `1px solid ${B.gold}44` }}>
                <span className="text-sm font-extrabold uppercase tracking-widest"
                  style={{ color: B.goldLight }}>Grand Total</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(212,160,23,0.2)', color: B.goldLight }}>
                  {data.count} products
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x" style={{ divideColor: `${B.gold}33` }}>
                <ValBox label="Purchase Value" value={fmtINR(data.total_purchase_value)} color="#93c5fd" bg="transparent" dark />
                <ValBox label="MRP Value"      value={fmtINR(data.total_mrp_value)}      color="#c4b5fd" bg="transparent" dark />
                <ValBox label="Selling Value"  value={fmtINR(data.total_selling_value)}  color="#86efac" bg="transparent" dark />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, bg, border, labelColor, valueColor }) {
  return (
    <div className="rounded-2xl shadow-sm p-4"
      style={{ background: bg, border: `1.5px solid ${border}` }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: labelColor }}>
        {label}
      </p>
      <p className="text-lg font-extrabold leading-tight" style={{ color: valueColor }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: labelColor, opacity: 0.7 }}>{sub}</p>
    </div>
  );
}

function ValBox({ label, value, color, bg, dark }) {
  return (
    <div className="px-4 py-3 text-center" style={{ background: bg }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1"
        style={{ color: dark ? 'rgba(255,255,255,0.5)' : '#9ca3af' }}>
        {label}
      </p>
      <p className="text-base font-extrabold" style={{ color }}>{value}</p>
    </div>
  );
}
