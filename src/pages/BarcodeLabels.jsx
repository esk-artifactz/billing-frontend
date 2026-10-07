import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProducts, getCategories } from '../api/client';
import { generateQR } from '../utils/qrcode';

// ── Theme ─────────────────────────────────────────────────────────────────────
const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  text: '#7a4e08', textLight: '#a07020',
  pageGrad: 'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
  navGrad:  'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  goldGrad: 'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
};

// ── QR Canvas component ───────────────────────────────────────────────────────
function QRCanvas({ text, size = 120 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !text) return;
    const canvas = canvasRef.current;
    try {
      const matrix = generateQR(text);
      const n = matrix.length;
      const scale = Math.floor(size / n);
      const side = scale * n;
      canvas.width  = side;
      canvas.height = side;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, side, side);
      ctx.fillStyle = '#000';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (matrix[r][c]) ctx.fillRect(c * scale, r * scale, scale, scale);
        }
      }
    } catch {
      // fallback: draw a placeholder if text too long
      const ctx = canvas.getContext('2d');
      canvas.width = size; canvas.height = size;
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#dc2626';
      ctx.font = '9px sans-serif';
      ctx.fillText('Too long', 4, size / 2);
    }
  }, [text, size]);

  return <canvas ref={canvasRef} style={{ imageRendering: 'pixelated' }} />;
}

// ── Single Label ──────────────────────────────────────────────────────────────
function ProductLabel({ product }) {
  // QR encodes the barcode field text; falls back to product name if none set
  const qrText = product.barcode || product.name;
  return (
    <div className="product-label flex flex-col items-center text-center p-2 rounded-xl border"
      style={{ background: '#fff', borderColor: '#e8d5a3', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      {/* Product name */}
      <p className="font-extrabold leading-tight mb-1.5 w-full"
        style={{ color: B.darkBrown, fontSize: '0.68rem', lineHeight: 1.25 }}>
        {product.name}
      </p>
      {/* QR Code */}
      <QRCanvas text={qrText} size={100} />
      {/* Barcode text value below QR */}
      <p className="font-mono mt-1 tracking-wider"
        style={{ color: '#374151', fontSize: '0.52rem' }}>
        {qrText}
      </p>
      {/* Selling price */}
      <p className="mt-1 font-extrabold" style={{ fontSize: '0.72rem', color: B.brown }}>
        ₹{parseFloat(product.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BarcodeLabels() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [products,    setProducts]    = useState([]);
  const [categories,  setCategories]  = useState([]);
  const [selCat,      setSelCat]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [cols,        setCols]        = useState(4);     // columns in grid
  const [selected,    setSelected]    = useState(new Set()); // selected product ids
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const printRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [pRes, cRes] = await Promise.all([getProducts(), getCategories()]);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOut(); navigate('/login');
      }
      setError('Failed to load products.');
    } finally { setLoading(false); }
  }, [signOut, navigate]);

  useEffect(() => { load(); }, [load]);

  // Filtered list
  const filtered = products.filter(p => {
    const catMatch = selCat === 'all' || String(p.category_id) === String(selCat);
    const q = search.toLowerCase();
    const textMatch = !q ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q);
    return catMatch && textMatch;
  });

  // toPrint pulls from ALL products so cross-category selections survive tab switching
  const toPrint = products.filter(p => selected.has(p.id));

  // Toggle select
  const toggle = (id) => setSelected(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  // Select / deselect only what's currently visible (respects category + search filter)
  const selectAllVisible = () => setSelected(prev => {
    const s = new Set(prev);
    filtered.forEach(p => s.add(p.id));
    return s;
  });
  const deselectAllVisible = () => setSelected(prev => {
    const s = new Set(prev);
    filtered.forEach(p => s.delete(p.id));
    return s;
  });
  // Clear every selection across all categories
  const clearAll = () => setSelected(new Set());

  // Category name lookup
  const catName = (id) => categories.find(c => String(c.id) === String(id))?.name || '';

  // Group selected (across ALL categories) for print
  const grouped = {};
  for (const p of toPrint) {
    const cn = catName(p.category_id) || 'Uncategorised';
    if (!grouped[cn]) grouped[cn] = [];
    grouped[cn].push(p);
  }

  // Per-category selected count summary (for sticky bar)
  const selectedSummary = Object.entries(grouped).map(([cat, prods]) => ({ cat, count: prods.length }));

  const handlePrint = () => {
    if (toPrint.length === 0) { alert('Select at least one product to print.'); return; }
    window.print();
  };

  const colsGridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  }[cols] || 'grid-cols-4';

  return (
    <>
      {/* ── Print styles ── */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area {
            position: fixed; left: 0; top: 0;
            width: 100%; background: #fff;
          }
          .no-print { display: none !important; }
          .product-label { border: 1px solid #ccc !important; margin: 4px; }
          .print-category-title {
            font-weight: 900; font-size: 14px; margin: 10px 0 4px;
            color: #2d1a0e; border-bottom: 2px solid #d4a017;
            padding-bottom: 4px;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(${cols}, 1fr);
            gap: 6px;
          }
        }
      `}</style>

      <div className="min-h-screen" style={{ background: B.pageGrad }}>

        {/* ── Navbar ── */}
        <nav className="no-print text-white px-4 py-3 shadow-lg flex items-center justify-between sticky top-0 z-30"
          style={{ background: B.navGrad, borderBottom: `2px solid ${B.gold}` }}>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')}
              className="text-xl font-bold leading-none active:scale-95" style={{ color: B.goldLight }}>←</button>
            <img src="/logo.jpg" alt="Crown Tea Hub"
              className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
              style={{ borderColor: B.gold }} />
            <div>
              <h1 className="text-base font-extrabold tracking-widest uppercase leading-tight"
                style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
              <p className="text-xs" style={{ color: B.gold }}>Barcode / QR Labels</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {toPrint.length > 0 && (
              <span className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: 'rgba(212,160,23,0.25)', color: B.goldLight }}>
                {toPrint.length} selected
              </span>
            )}
            <button onClick={handlePrint}
              className="font-bold px-4 py-2 rounded-xl text-sm active:scale-95 shadow"
              style={{ background: B.goldGrad, color: B.darkBrown }}>
              🖨 Print
            </button>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-5 space-y-4">

          {/* ── Filter bar ── */}
          <div className="no-print rounded-2xl shadow-sm p-4 space-y-3"
            style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
            <div className="flex flex-wrap gap-3 items-center">

              {/* Category filter */}
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-bold block mb-1" style={{ color: B.text }}>Category</label>
                <select value={selCat}
                  onChange={e => { setSelCat(e.target.value); clearAll(); }}
                  className="w-full text-sm px-3 py-2 rounded-xl border-2 outline-none"
                  style={{ borderColor: '#e8d5a3' }}>
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-bold block mb-1" style={{ color: B.text }}>Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Name or barcode…"
                  className="w-full text-sm px-3 py-2 rounded-xl border-2 outline-none"
                  style={{ borderColor: '#e8d5a3' }} />
              </div>

              {/* Columns */}
              <div>
                <label className="text-xs font-bold block mb-1" style={{ color: B.text }}>
                  Columns per row
                </label>
                <div className="flex gap-1">
                  {[2,3,4,5,6].map(n => (
                    <button key={n} onClick={() => setCols(n)}
                      className="w-8 h-8 rounded-lg text-sm font-bold transition-all active:scale-95"
                      style={{
                        background: cols === n ? B.gold : '#f5f5f5',
                        color:      cols === n ? B.darkBrown : B.textLight,
                        border:     cols === n ? `2px solid ${B.goldDark}` : '2px solid #e0e0e0',
                      }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Select/Clear buttons */}
              <div className="flex gap-2 self-end flex-wrap">
                <button onClick={selectAllVisible}
                  className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
                  style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                  + Select Visible ({filtered.length})
                </button>
                <button onClick={deselectAllVisible}
                  className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
                  style={{ background: '#fef3c7', color: '#b45309' }}>
                  − Deselect Visible
                </button>
                {selected.size > 0 && (
                  <button onClick={clearAll}
                    className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
                    style={{ background: '#fef2f2', color: '#dc2626' }}>
                    ✕ Clear All ({selected.size})
                  </button>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="no-print rounded-xl px-4 py-3 text-sm font-semibold"
              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          )}

          {loading ? (
            <div className="no-print flex justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 animate-spin"
                style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : (
            <>
              {/* ── Product grid (screen) — grouped by category ── */}
              <div className="no-print space-y-6">
                {(() => {
                  // Group filtered products by category
                  const groups = {};
                  for (const p of filtered) {
                    const cn = catName(p.category_id) || 'Uncategorised';
                    if (!groups[cn]) groups[cn] = [];
                    groups[cn].push(p);
                  }
                  if (Object.keys(groups).length === 0) return (
                    <div className="rounded-2xl py-16 text-center shadow-sm"
                      style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                      <p className="text-4xl mb-3">🏷️</p>
                      <p className="font-semibold" style={{ color: B.textLight }}>No products found</p>
                    </div>
                  );
                  return Object.entries(groups).map(([cat, prods]) => (
                    <div key={cat} className="rounded-2xl shadow-sm overflow-hidden"
                      style={{ background: '#fff', border: `1px solid #e8d5a3` }}>
                      {/* Category header */}
                      <div className="px-5 py-3 flex items-center justify-between"
                        style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        <div className="flex items-center gap-3">
                          <h2 className="font-extrabold text-sm uppercase tracking-widest"
                            style={{ color: B.goldLight }}>{cat}</h2>
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(212,160,23,0.25)', color: B.goldLight }}>
                            {prods.length} products
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* how many of this category are selected */}
                          {prods.filter(p => selected.has(p.id)).length > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(212,160,23,0.35)', color: B.goldLight }}>
                              {prods.filter(p => selected.has(p.id)).length} selected
                            </span>
                          )}
                          <button onClick={() => setSelected(prev => {
                            const s = new Set(prev);
                            prods.forEach(p => s.add(p.id));
                            return s;
                          })}
                            className="text-xs font-bold px-3 py-1 rounded-lg active:scale-95"
                            style={{ background: 'rgba(212,160,23,0.2)', color: B.goldLight }}>
                            Select All
                          </button>
                          <button onClick={() => setSelected(prev => {
                            const s = new Set(prev);
                            prods.forEach(p => s.delete(p.id));
                            return s;
                          })}
                            className="text-xs font-bold px-3 py-1 rounded-lg active:scale-95"
                            style={{ background: 'rgba(220,38,38,0.15)', color: '#fca5a5' }}>
                            Deselect
                          </button>
                        </div>
                      </div>

                      {/* Product grid */}
                      <div className={`grid ${colsGridClass} gap-3 p-4`}>
                        {prods.map(p => (
                          <div key={p.id}
                            onClick={() => toggle(p.id)}
                            className="cursor-pointer relative rounded-xl transition-all active:scale-95"
                            style={{
                              outline: selected.has(p.id) ? `3px solid ${B.gold}` : '3px solid transparent',
                              boxShadow: selected.has(p.id) ? `0 0 0 1px ${B.goldDark}` : 'none',
                            }}>
                            {/* Checkbox badge */}
                            <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shadow"
                              style={{
                                background: selected.has(p.id) ? B.gold : '#e5e7eb',
                                color: selected.has(p.id) ? B.darkBrown : '#9ca3af',
                              }}>
                              {selected.has(p.id) ? '✓' : ''}
                            </div>
                            <ProductLabel product={p} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* ── PRINT AREA — hidden on screen, visible on print ── */}
              <div id="print-area" ref={printRef}
                style={{ display: 'none' }}>
                <div style={{ padding: '8px', fontFamily: 'Arial, sans-serif' }}>
                  {/* Shop name header */}
                  <div style={{ textAlign: 'center', marginBottom: 12, borderBottom: '2px solid #d4a017', paddingBottom: 6 }}>
                    <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#2d1a0e', letterSpacing: 2 }}>
                      CROWN TEA HUB
                    </h1>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#7a4e08' }}>Product Labels</p>
                  </div>

                  {/* Per-category label groups */}
                  {Object.entries(grouped).map(([cat, prods]) => (
                    <div key={cat} style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
                      <p className="print-category-title">{cat} ({prods.length} items)</p>
                      <div className="print-grid">
                        {prods.map(p => (
                          <ProductLabel key={p.id} product={p} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Sticky bottom print bar — shown when anything is selected ── */}
      {toPrint.length > 0 && (
        <div className="no-print fixed bottom-0 left-0 right-0 z-50 shadow-2xl"
          style={{ background: B.darkBrown, borderTop: `2px solid ${B.gold}` }}>
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            {/* Left: breakdown by category */}
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xs font-bold uppercase tracking-wider"
                style={{ color: B.goldLight }}>Print:</span>
              {selectedSummary.map(({ cat, count }) => (
                <span key={cat}
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(212,160,23,0.2)', color: B.goldLight, border: `1px solid ${B.gold}55` }}>
                  {cat} × {count}
                </span>
              ))}
            </div>

            {/* Right: total count + print + clear */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-extrabold" style={{ color: B.goldLight }}>
                {toPrint.length} label{toPrint.length !== 1 ? 's' : ''}
              </span>
              <button onClick={clearAll}
                className="px-3 py-2 rounded-xl text-xs font-bold active:scale-95"
                style={{ background: 'rgba(220,38,38,0.2)', color: '#fca5a5', border: '1px solid #fca5a544' }}>
                ✕ Clear All
              </button>
              <button onClick={handlePrint}
                className="px-5 py-2 rounded-xl text-sm font-extrabold active:scale-95 shadow-lg"
                style={{ background: B.goldGrad, color: B.darkBrown }}>
                🖨 Print {toPrint.length} Labels
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Spacer so content isn't hidden behind sticky bar */}
      {toPrint.length > 0 && <div className="no-print h-16" />}

      {/* Make print area visible on print */}
      <style>{`
        @media print {
          #print-area { display: block !important; }
        }
      `}</style>
    </>
  );
}
