import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStockAlerts } from '../api/client';

// ── Colours ───────────────────────────────────────────────────────────────────
const B = {
  darkBrown:  '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold:       '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  text:       '#7a4e08', textLight: '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:     'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const fmtN = (n) => parseFloat(n || 0).toLocaleString('en-IN');

// Stock level indicator: returns % of current vs minimum (capped 0–100)
function stockPct(current, minimum) {
  if (!minimum || minimum <= 0) return 0;
  return Math.min(100, Math.round((current / minimum) * 100));
}

export default function StockAlerts() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [tab, setTab]         = useState('out');   // 'out' | 'low'
  const [search, setSearch]   = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getStockAlerts();
      setData(res.data);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load stock alerts. Please try again.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const outOfStock = (data?.out_of_stock || []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name.toLowerCase().includes(search.toLowerCase())
  );
  const lowStock = (data?.low_stock || []).filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category_name.toLowerCase().includes(search.toLowerCase())
  );

  const activeList = tab === 'out' ? outOfStock : lowStock;

  // Group by category
  const grouped = activeList.reduce((acc, item) => {
    const cat = item.category_name;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

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

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto mt-8 px-4 pb-12 space-y-6">

        {/* Title + refresh */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>
              Stock Alerts
            </h2>
            <p className="text-sm mt-0.5" style={{ color: B.textLight }}>
              Items that need to be ordered
            </p>
          </div>
          <button onClick={fetchAlerts}
            className="text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all"
            style={{ background: B.goldGrad, color: B.brown }}>
            Refresh
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center text-lg font-medium" style={{ color: B.textLight }}>
            Loading stock alerts...
          </div>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'white', border: '1px solid #e57373' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">🚨</span>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c62828' }}>Out of Stock</p>
                </div>
                <p className="text-3xl font-extrabold" style={{ color: '#c62828' }}>
                  {data?.out_of_stock?.length || 0}
                </p>
                <p className="text-xs mt-1" style={{ color: '#aaa' }}>items need immediate order</p>
              </div>

              <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'white', border: '1px solid #ffc107' }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#856404' }}>Low Stock</p>
                </div>
                <p className="text-3xl font-extrabold" style={{ color: '#856404' }}>
                  {data?.low_stock?.length || 0}
                </p>
                <p className="text-xs mt-1" style={{ color: '#aaa' }}>items running low</p>
              </div>

              <div className="rounded-2xl p-5 shadow-sm" style={{ background: 'white', border: B.goldBorder }}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📦</span>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: B.textLight }}>Tracked Items</p>
                </div>
                <p className="text-3xl font-extrabold" style={{ color: B.goldDark }}>
                  {data?.total_tracked || 0}
                </p>
                <p className="text-xs mt-1" style={{ color: '#aaa' }}>total stock-tracked products</p>
              </div>
            </div>

            {/* ── No alerts state ── */}
            {data?.total_alerts === 0 && (
              <div className="rounded-2xl p-16 text-center" style={{ background: 'white', border: B.goldBorder }}>
                <div className="text-6xl mb-4">✅</div>
                <p className="text-xl font-bold" style={{ color: B.text }}>All stock levels are healthy!</p>
                <p className="text-sm mt-2" style={{ color: B.textLight }}>
                  No items are out of stock or below their minimum level.
                </p>
              </div>
            )}

            {/* ── Tabs + search ── */}
            {data?.total_alerts > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Tab buttons */}
                  <div className="flex gap-2">
                    <button onClick={() => setTab('out')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                      style={tab === 'out'
                        ? { background: '#c62828', color: 'white', boxShadow: '0 2px 8px rgba(198,40,40,0.35)' }
                        : { background: 'white', border: '1px solid #e57373', color: '#c62828' }}>
                      🚨 Out of Stock
                      {(data?.out_of_stock?.length || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold"
                          style={{ background: tab === 'out' ? 'rgba(255,255,255,0.25)' : '#fce8e8', color: '#c62828' }}>
                          {data.out_of_stock.length}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setTab('low')}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                      style={tab === 'low'
                        ? { background: '#856404', color: 'white', boxShadow: '0 2px 8px rgba(133,100,4,0.35)' }
                        : { background: 'white', border: '1px solid #ffc107', color: '#856404' }}>
                      ⚠️ Low Stock
                      {(data?.low_stock?.length || 0) > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-extrabold"
                          style={{ background: tab === 'low' ? 'rgba(255,255,255,0.25)' : '#fff3cd', color: '#856404' }}>
                          {data.low_stock.length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Search */}
                  <input type="text" placeholder="Search item or category..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      background: '#fff9ee', border: `1.5px solid ${B.gold}`, color: B.brown,
                      borderRadius: 10, padding: '8px 14px', fontSize: 14, outline: 'none', minWidth: 220,
                    }} />
                </div>

                {/* ── Print order list button ── */}
                {activeList.length > 0 && (
                  <div className="flex justify-end">
                    <button onClick={() => window.print()}
                      className="text-sm font-bold px-5 py-2.5 rounded-xl active:scale-95 transition-all"
                      style={{ background: B.bgGrad, color: B.goldLight, border: `1px solid ${B.gold}` }}>
                      🖨️ Print Order List
                    </button>
                  </div>
                )}

                {/* ── Empty search result ── */}
                {activeList.length === 0 && (
                  <div className="rounded-2xl p-12 text-center" style={{ background: 'white', border: B.goldBorder }}>
                    <p className="font-bold" style={{ color: B.text }}>No items match your search</p>
                  </div>
                )}

                {/* ── Grouped item cards ── */}
                <div id="order-list-print" className="space-y-5">
                  {/* Print header (only visible when printing) */}
                  <div className="hidden print-only text-center mb-4">
                    <p className="text-lg font-extrabold">Crown Tea Hub — Order List</p>
                    <p className="text-sm">{tab === 'out' ? 'Out of Stock Items' : 'Low Stock Items'} · {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    <hr className="my-2" />
                  </div>

                  {Object.entries(grouped).map(([category, items]) => (
                    <div key={category} className="rounded-2xl overflow-hidden shadow-sm"
                      style={{ border: tab === 'out' ? '1px solid #e57373' : '1px solid #ffc107' }}>
                      {/* Category header */}
                      <div className="px-5 py-2.5 flex items-center justify-between"
                        style={{ background: tab === 'out' ? '#fce8e8' : '#fff3cd' }}>
                        <h3 className="font-bold text-sm uppercase tracking-wide"
                          style={{ color: tab === 'out' ? '#c62828' : '#856404' }}>
                          {category}
                        </h3>
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          style={{ background: tab === 'out' ? '#c62828' : '#856404', color: 'white' }}>
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="divide-y" style={{ background: 'white', borderColor: '#f5ead0' }}>
                        {items.map(item => {
                          const pct = stockPct(item.current_stock, item.minimum_stock_level);
                          const isOut = item.current_stock <= 0;
                          return (
                            <div key={item.id} className="px-5 py-4">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold" style={{ color: B.text }}>{item.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                      style={{ background: '#fff9ee', border: B.goldBorder, color: B.textLight }}>
                                      {item.unit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 mt-1.5 flex-wrap text-sm">
                                    <span style={{ color: isOut ? '#c62828' : '#856404' }}>
                                      <span className="font-extrabold">{fmtN(item.current_stock)}</span>
                                      <span className="text-xs ml-1">{item.unit} in stock</span>
                                    </span>
                                    {item.minimum_stock_level > 0 && (
                                      <span style={{ color: B.textLight }}>
                                        Min: <span className="font-semibold">{fmtN(item.minimum_stock_level)} {item.unit}</span>
                                      </span>
                                    )}
                                    {!isOut && item.minimum_stock_level > 0 && (
                                      <span style={{ color: '#888' }}>
                                        Need: <span className="font-semibold" style={{ color: '#c62828' }}>
                                          {fmtN(Math.max(0, item.minimum_stock_level - item.current_stock))} {item.unit}
                                        </span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Stock level bar */}
                                  {!isOut && item.minimum_stock_level > 0 && (
                                    <div className="mt-2 h-2 rounded-full overflow-hidden w-48 max-w-full"
                                      style={{ background: '#f0e8d0' }}>
                                      <div className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${pct}%`,
                                          background: pct <= 25
                                            ? '#c62828'
                                            : pct <= 50
                                            ? '#f57c00'
                                            : '#856404',
                                        }} />
                                    </div>
                                  )}
                                </div>

                                {/* Urgency badge */}
                                <div className="flex-shrink-0">
                                  {isOut ? (
                                    <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                                      style={{ background: '#c62828', color: 'white' }}>
                                      ORDER NOW
                                    </span>
                                  ) : pct <= 25 ? (
                                    <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                                      style={{ background: '#f57c00', color: 'white' }}>
                                      URGENT
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                                      style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffc107' }}>
                                      ORDER SOON
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #order-list-print, #order-list-print * { visibility: visible !important; }
          #order-list-print {
            position: fixed !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important;
            padding: 20px !important;
            background: white !important;
          }
          .print-only { display: block !important; }
          @page { size: A4; margin: 15mm; }
        }
        .print-only { display: none; }
      `}</style>
    </div>
  );
}
