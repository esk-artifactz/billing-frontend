import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getBrands, getProducts, getCategories, createPurchaseOrder, getSuppliers } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
};

export default function PurchaseOrder() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // ── Source data ────────────────────────────────────────────────────────────
  const [brands,     setBrands]     = useState([]);
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // ── Filters ────────────────────────────────────────────────────────────────
  const [selectedBrand,    setSelectedBrand]    = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search,           setSearch]           = useState('');

  // ── PO header ──────────────────────────────────────────────────────────────
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poNotes,            setPoNotes]            = useState('');

  // ── Cart (items added to PO) ──────────────────────────────────────────────
  // { product_id, product_name, unit, ordered_qty, purchase_price, current_stock, mfg_date, expiry_date }
  const [cart, setCart] = useState([]);

  // ── Submission ─────────────────────────────────────────────────────────────
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  const handleLogout = () => { signOut(); navigate('/login'); };

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [bRes, pRes, cRes, sRes] = await Promise.all([getBrands(), getProducts(), getCategories(), getSuppliers()]);
      setBrands(bRes.data.brands || []);
      setProducts(pRes.data.products || []);
      setCategories(cRes.data.categories || []);
      setSuppliers((sRes.data.suppliers || []).filter(s => s.active !== false));
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load data.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  // Derived: selected supplier object
  const selectedSupplier = suppliers.find(s => String(s.id) === String(selectedSupplierId)) || null;

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtered product list ──────────────────────────────────────────────────
  const filtered = products.filter(p => {
    if (!p.active) return false;
    if (selectedBrand && p.brand !== selectedBrand) return false;
    if (selectedCategory && String(p.category_id) !== String(selectedCategory)) return false;
    if (search) {
      const q = search.toLowerCase();
      const cat = categories.find(c => c.id === p.category_id);
      if (!p.name.toLowerCase().includes(q) &&
          !(p.barcode || '').toLowerCase().includes(q) &&
          !(cat?.name || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const catName = (id) => categories.find(c => c.id === id)?.name || '—';

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const inCart = (pid) => cart.find(c => c.product_id === pid);

  const addToCart = (p) => {
    if (inCart(p.id)) return;
    setCart(prev => [...prev, {
      product_id:     p.id,
      product_name:   p.name,
      unit:           p.unit,
      ordered_qty:    1,
      purchase_price: p.purchase_price || '',
      current_stock:  p.current_stock ?? 0,
      mfg_date:       '',
      expiry_date:    '',
    }]);
  };

  const removeFromCart = (pid) => setCart(prev => prev.filter(c => c.product_id !== pid));

  const updateCart = (pid, field, val) =>
    setCart(prev => prev.map(c => c.product_id === pid ? { ...c, [field]: val } : c));

  // ── Submit PO ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (cart.length === 0) { showToast('Add at least one product to the order.', false); return; }
    const invalid = cart.find(c => !c.ordered_qty || parseFloat(c.ordered_qty) <= 0);
    if (invalid) { showToast(`Enter a valid quantity for "${invalid.product_name}".`, false); return; }

    setSaving(true);
    try {
      const payload = {
        brand:       selectedBrand || null,
        supplier_id: selectedSupplierId || null,
        notes:       poNotes || null,
        items: cart.map(c => ({
          product_id:     c.product_id,
          ordered_qty:    parseFloat(c.ordered_qty),
          purchase_price: c.purchase_price !== '' ? parseFloat(c.purchase_price) : null,
          mfg_date:       c.mfg_date || null,
          expiry_date:    c.expiry_date || null,
        })),
      };
      const res = await createPurchaseOrder(payload);
      const poNum = res.data.po_number;
      setSuccess(poNum);
      setCart([]);
      setSelectedSupplierId('');
      setPoNotes('');
      showToast(`Purchase Order ${poNum} created!`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create purchase order.', false);
    } finally { setSaving(false); }
  };

  const totalItems = cart.length;
  const totalQty   = cart.reduce((s, c) => s + parseFloat(c.ordered_qty || 0), 0);
  const totalValue = cart.reduce((s, c) => {
    const p = parseFloat(c.purchase_price || 0);
    const q = parseFloat(c.ordered_qty || 0);
    return s + p * q;
  }, 0);

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown} 0%, ${B.midBrown} 50%, ${B.brown} 100%)`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Create Purchase Order</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/receive-stock')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 mr-1"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Receive Stock
          </button>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 mr-1"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Dashboard
          </button>
          <button onClick={handleLogout}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight}, ${B.gold}, #b8860b)`, color: '#3d1f00' }}>
            Logout
          </button>
        </div>
      </nav>

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-5">

        {/* ── LEFT: Product picker ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Header */}
          <div className="rounded-2xl shadow-md overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${B.darkBrown}, #5a3510)`, border: `1px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
            <div className="p-5">
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                Create Purchase Order
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Filter by brand or category, then add products to the order
              </p>
            </div>
          </div>

          {error && <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</div>}

          {success && (
            <div className="rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between"
              style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
              <span>✓ Purchase Order <strong>{success}</strong> created successfully!</span>
              <button onClick={() => navigate('/receive-stock')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg ml-3"
                style={{ background: '#16a34a', color: '#fff' }}>
                Go to Receive Stock →
              </button>
            </div>
          )}

          {/* PO Header fields */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#a07020' }}>Order Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Supplier</label>
                <select value={selectedSupplierId} onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: selectedSupplierId ? B.gold : '#e8d5a3', background: selectedSupplierId ? '#fff8e7' : '#fff' }}>
                  <option value="">— Select Supplier (optional) —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}{s.phone ? ` · ${s.phone}` : ''}</option>
                  ))}
                </select>
                {selectedSupplier?.fssai_no && (
                  <p className="text-xs mt-1 font-semibold" style={{ color: '#b45309' }}>
                    FSSAI: <span className="font-mono">{selectedSupplier.fssai_no}</span>
                  </p>
                )}
                {selectedSupplier?.address && (
                  <p className="text-xs mt-0.5 text-gray-400">{selectedSupplier.address}</p>
                )}
              </div>
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes (optional)</label>
                <input value={poNotes} onChange={e => setPoNotes(e.target.value)}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e8d5a3' }} placeholder="Urgent / seasonal restock…" />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#a07020' }}>Filter Products</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Brand filter */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Brand</label>
                <select value={selectedBrand} onChange={e => setSelectedBrand(e.target.value)}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: selectedBrand ? B.gold : '#e8d5a3', background: selectedBrand ? '#fff8e7' : '#fff' }}>
                  <option value="">All Brands</option>
                  {brands.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Category filter */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: selectedCategory ? B.gold : '#e8d5a3', background: selectedCategory ? '#fff8e7' : '#fff' }}>
                  <option value="">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {/* Search */}
              <div>
                <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Search</label>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ borderColor: '#e8d5a3' }} placeholder="Name, barcode…" />
              </div>
            </div>
            {/* Active filter chips */}
            {(selectedBrand || selectedCategory || search) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedBrand && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                    style={{ background: '#fff8e7', color: B.brown, border: `1px solid ${B.gold}` }}>
                    Brand: {selectedBrand}
                    <button onClick={() => setSelectedBrand('')} className="ml-1 font-bold" style={{ color: B.gold }}>×</button>
                  </span>
                )}
                {selectedCategory && (
                  <span className="text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1"
                    style={{ background: '#fff8e7', color: B.brown, border: `1px solid ${B.gold}` }}>
                    {catName(parseInt(selectedCategory))}
                    <button onClick={() => setSelectedCategory('')} className="ml-1 font-bold" style={{ color: B.gold }}>×</button>
                  </span>
                )}
                <button onClick={() => { setSelectedBrand(''); setSelectedCategory(''); setSearch(''); }}
                  className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Product grid */}
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: '#f0e0c0' }}>
              <p className="text-sm font-bold" style={{ color: B.brown }}>
                {loading ? 'Loading…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#a07020' }}>
                <p className="text-base font-semibold">No products found</p>
                <p className="text-sm mt-1">Try changing the brand or category filter</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                      {['Product', 'Brand', 'Category', 'Unit', 'Purchase Price', 'Stock', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                          style={{ color: B.goldLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, idx) => {
                      const added = !!inCart(p.id);
                      const lowStock = p.track_stock && p.minimum_stock_level != null && p.current_stock != null && parseFloat(p.current_stock) <= parseFloat(p.minimum_stock_level);
                      const outStock = p.track_stock && (p.current_stock == null || parseFloat(p.current_stock) <= 0);
                      return (
                        <tr key={p.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                          opacity: added ? 0.6 : 1 }}>
                          <td className="px-4 py-3">
                            <div className="font-semibold" style={{ color: B.darkBrown }}>{p.name}</div>
                            {p.barcode && <div className="text-xs font-mono text-gray-400">{p.barcode}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{p.brand || '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{catName(p.category_id)}</td>
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: B.brown }}>{p.unit}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>
                            {p.purchase_price ? `₹${parseFloat(p.purchase_price).toFixed(2)}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {p.track_stock ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: outStock ? '#fee2e2' : lowStock ? '#fef3c7' : '#dcfce7',
                                  color: outStock ? '#dc2626' : lowStock ? '#d97706' : '#16a34a' }}>
                                {outStock ? 'Out' : `${p.current_stock} ${p.unit}`}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">No track</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => added ? removeFromCart(p.id) : addToCart(p)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                              style={{ background: added ? '#fee2e2' : '#dcfce7', color: added ? '#dc2626' : '#16a34a' }}>
                              {added ? '− Remove' : '+ Add'}
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
        </div>

        {/* ── RIGHT: Order cart ── */}
        <div className="w-full lg:w-96 flex-shrink-0 space-y-4">
          <div className="rounded-2xl shadow-md overflow-hidden sticky top-4"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
            <div className="p-4 border-b" style={{ borderColor: '#f0e0c0' }}>
              <h3 className="text-base font-extrabold" style={{ color: B.brown }}>Purchase Order</h3>
              <p className="text-xs mt-0.5" style={{ color: '#a07020' }}>
                {totalItems} item{totalItems !== 1 ? 's' : ''} · {totalQty} units total
                {totalValue > 0 && ` · ₹${totalValue.toFixed(2)}`}
              </p>
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-10 px-4" style={{ color: '#a07020' }}>
                <p className="text-sm font-semibold">No items yet</p>
                <p className="text-xs mt-1">Click "+ Add" on any product</p>
              </div>
            ) : (
              <div className="divide-y" style={{ divideColor: '#f0e0c0' }}>
                {cart.map(item => (
                  <div key={item.product_id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight" style={{ color: B.darkBrown }}>{item.product_name}</p>
                        <p className="text-xs" style={{ color: '#a07020' }}>
                          Stock: {item.current_stock} {item.unit}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.product_id)}
                        className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                        style={{ background: '#fee2e2', color: '#dc2626' }}>×</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold mb-0.5 block" style={{ color: B.brown }}>
                          Qty ({item.unit})
                        </label>
                        <input type="number" min="0.001" step="any"
                          value={item.ordered_qty}
                          onChange={e => updateCart(item.product_id, 'ordered_qty', e.target.value)}
                          className="w-full border-2 rounded-lg px-2 py-1.5 text-sm outline-none"
                          style={{ borderColor: B.gold }} />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-0.5 block" style={{ color: B.brown }}>
                          Price/unit (₹)
                        </label>
                        <input type="number" min="0" step="0.01"
                          value={item.purchase_price}
                          onChange={e => updateCart(item.product_id, 'purchase_price', e.target.value)}
                          placeholder="Optional"
                          className="w-full border-2 rounded-lg px-2 py-1.5 text-sm outline-none"
                          style={{ borderColor: '#e8d5a3' }} />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-0.5 block" style={{ color: B.brown }}>Mfg Date</label>
                        <input type="date" value={item.mfg_date}
                          onChange={e => updateCart(item.product_id, 'mfg_date', e.target.value)}
                          className="w-full border-2 rounded-lg px-2 py-1.5 text-sm outline-none"
                          style={{ borderColor: '#e8d5a3' }} />
                      </div>
                      <div>
                        <label className="text-xs font-bold mb-0.5 block" style={{ color: B.brown }}>Expiry Date</label>
                        <input type="date" value={item.expiry_date}
                          onChange={e => updateCart(item.product_id, 'expiry_date', e.target.value)}
                          className="w-full border-2 rounded-lg px-2 py-1.5 text-sm outline-none"
                          style={{ borderColor: '#e8d5a3' }} />
                      </div>
                    </div>
                    {item.purchase_price && item.ordered_qty && (
                      <p className="text-xs font-semibold text-right" style={{ color: '#16a34a' }}>
                        Total: ₹{(parseFloat(item.purchase_price) * parseFloat(item.ordered_qty)).toFixed(2)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <div className="p-4 border-t space-y-3" style={{ borderColor: '#f0e0c0' }}>
                {totalValue > 0 && (
                  <div className="flex justify-between text-sm font-bold" style={{ color: B.brown }}>
                    <span>Estimated Total</span>
                    <span style={{ color: '#16a34a' }}>₹{totalValue.toFixed(2)}</span>
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={saving || cart.length === 0}
                  className="w-full py-3 rounded-xl text-sm font-extrabold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight}, ${B.gold}, #b8860b)`, color: B.darkBrown }}>
                  {saving ? 'Creating PO…' : 'Create Purchase Order'}
                </button>
                <button
                  onClick={() => { setCart([]); setSuccess(''); }}
                  className="w-full py-2 rounded-xl text-xs font-semibold"
                  style={{ background: '#f5f5f5', color: '#555' }}>
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
