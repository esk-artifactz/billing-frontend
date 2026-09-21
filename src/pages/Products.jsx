import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories } from '../api/client';

const B = {
  darkBrown: '#2d1a0e',
  midBrown:  '#4a2c0a',
  brown:     '#3d2008',
  gold:      '#d4a017',
  goldLight: '#f5c842',
  goldDark:  '#b8860b',
  cream:     '#fdf6e3',
  creamMid:  '#f5ead0',
  text:      '#7a4e08',
  textLight: '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:  'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:    'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:  'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const inputSty = {
  background: '#fff9ee',
  border: '1.5px solid #d4a017',
  color: '#3d2008',
  borderRadius: 10,
  padding: '9px 13px',
  width: '100%',
  fontSize: 14,
  outline: 'none',
};

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'box', 'pack', 'dozen', 'cup', 'plate'];

const EMPTY_FORM = {
  name: '', barcode: '', brand: '', category_id: '', subcategory: '',
  unit: 'pcs', purchase_price: '', mrp: '', selling_price: '', gst_percentage: '',
  track_stock: true, current_stock: '', minimum_stock_level: '',
  quick_sale_enabled: false, active: true,
};

function Label({ children, required }) {
  return (
    <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
      {children}{required && <span style={{ color: '#c62828' }}> *</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={onChange}
        className="w-10 h-5 rounded-full flex items-center transition-all px-0.5 flex-shrink-0"
        style={{ background: checked ? B.goldGrad : '#d0c8b8' }}>
        <div className="w-4 h-4 rounded-full bg-white shadow transition-all"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: B.text }}>{label}</span>
    </label>
  );
}

export default function Products() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [modal, setModal]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [search, setSearch]         = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getProducts();
      setProducts(res.data.products || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load products.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  const fetchCategories = useCallback(async () => {
    try { const res = await getCategories(); setCategories(res.data.categories || []); }
    catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);

  const openAdd  = () => { setForm(EMPTY_FORM); setFormError(''); setModal('add'); };
  const openEdit = (p) => {
    setSelected(p);
    setForm({
      name: p.name || '', barcode: p.barcode || '', brand: p.brand || '',
      category_id: p.category_id || '', subcategory: p.subcategory || '',
      unit: p.unit || 'pcs',
      purchase_price: p.purchase_price || '', mrp: p.mrp || '',
      selling_price: p.selling_price || '', gst_percentage: p.gst_percentage || '',
      track_stock: p.track_stock !== undefined ? p.track_stock : true,
      current_stock: p.current_stock || '', minimum_stock_level: p.minimum_stock_level || '',
      quick_sale_enabled: p.quick_sale_enabled || false,
      active: p.active !== undefined ? p.active : true,
    });
    setFormError(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  };

  const buildPayload = () => ({
    ...form,
    purchase_price: parseFloat(form.purchase_price) || 0,
    mrp: parseFloat(form.mrp) || 0,
    selling_price: parseFloat(form.selling_price) || 0,
    gst_percentage: parseFloat(form.gst_percentage) || 0,
    current_stock: form.track_stock ? (parseFloat(form.current_stock) || 0) : null,
    minimum_stock_level: form.track_stock ? (parseFloat(form.minimum_stock_level) || 0) : null,
  });

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await createProduct(buildPayload()); closeModal(); fetchProducts(); }
    catch (err) { setFormError(err.response?.data?.detail || 'Failed to add product.'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await updateProduct(selected.id, buildPayload()); closeModal(); fetchProducts(); }
    catch (err) { setFormError(err.response?.data?.detail || 'Failed to update product.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try { await deleteProduct(p.id); fetchProducts(); }
    catch { setError('Failed to delete product.'); }
  };

  const getCatName = (id) => categories.find(c => c.id === id)?.name || '—';

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search)) ||
    getCatName(p.category_id).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: B.pageGrad }}>

      {/* Navbar */}
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

      {/* Content */}
      <div className="max-w-screen-xl mx-auto mt-8 px-4 pb-10 space-y-5">

        {/* Page header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>Products</h2>
            <p className="text-sm mt-0.5" style={{ color: B.textLight }}>{filtered.length} of {products.length} product{products.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <input
              type="text"
              placeholder="Search by name, barcode, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-sm rounded-xl px-4 py-2 outline-none"
              style={{ background: B.cream, border: `1.5px solid ${B.gold}`, color: B.brown, minWidth: 240 }}
            />
            <button onClick={openAdd}
              className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-all shadow-md"
              style={{ background: B.goldGrad, color: B.brown }}>
              + Add Product
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium"
            style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="rounded-2xl shadow-md overflow-hidden" style={{ border: B.goldBorder }}>
          <div className="h-1" style={{ background: B.goldGrad }} />

          {loading ? (
            <div className="p-10 text-center font-medium" style={{ color: B.textLight }}>Loading products...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center font-medium" style={{ color: B.textLight }}>
              {search ? 'No products match your search.' : 'No products yet. Add your first one.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: B.bgGrad }}>
                    {['#','Name','Category','Brand','Unit','Purchase','MRP','Selling','GST%','Track','Stock','Min','Quick','Active','Actions'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => (
                    <tr key={p.id} className="transition-colors"
                      style={{ background: idx % 2 === 0 ? '#fff9ee' : '#fffef8', borderTop: '1px solid #e8d5a3' }}>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>{idx + 1}</td>
                      <td className="px-3 py-2.5 font-bold max-w-[140px] truncate" style={{ color: B.text }} title={p.name}>{p.name}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: B.textLight }}>
                        {getCatName(p.category_id)}{p.subcategory ? <span style={{ color: '#bbb' }}> / {p.subcategory}</span> : ''}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>{p.brand || '—'}</td>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>{p.unit}</td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: B.text }}>₹{parseFloat(p.purchase_price).toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: B.text }}>₹{parseFloat(p.mrp).toFixed(2)}</td>
                      <td className="px-3 py-2.5 font-bold" style={{ color: B.goldDark }}>₹{parseFloat(p.selling_price).toFixed(2)}</td>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>{parseFloat(p.gst_percentage).toFixed(1)}%</td>
                      <td className="px-3 py-2.5">
                        {p.track_stock
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Yes</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#f5f5f5', color: '#777' }}>No</span>}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>
                        {p.track_stock && p.current_stock != null ? parseFloat(p.current_stock).toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: B.textLight }}>
                        {p.track_stock && p.minimum_stock_level != null ? parseFloat(p.minimum_stock_level).toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.quick_sale_enabled
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#fff3e0', color: '#e65100' }}>Yes</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#f5f5f5', color: '#777' }}>No</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        {p.active
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Yes</span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#ffebee', color: '#c62828' }}>No</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button onClick={() => openEdit(p)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg mr-2 active:scale-95 transition-all"
                          style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                          style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            style={{ background: B.pageGrad, border: B.goldBorder }}>
            <div className="h-1.5 sticky top-0" style={{ background: B.goldGrad }} />
            <div className="px-6 py-4 sticky top-1.5 z-10" style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
              <h3 className="text-lg font-bold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                {modal === 'add' ? 'Add New Product' : `Edit — ${selected?.name}`}
              </h3>
            </div>

            {formError && (
              <div className="mx-5 mt-4 rounded-lg px-4 py-3 text-sm font-medium"
                style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
                {formError}
              </div>
            )}

            <form onSubmit={modal === 'add' ? handleAdd : handleUpdate} className="p-5 space-y-5">

              {/* Section: Basic Info */}
              <Section title="Basic Info">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <Label required>Product Name</Label>
                    <input type="text" name="name" value={form.name} onChange={handleChange}
                      required placeholder="e.g., Masala Chai" style={inputSty} />
                  </div>
                  <div>
                    <Label>Barcode</Label>
                    <input type="text" name="barcode" value={form.barcode} onChange={handleChange}
                      placeholder="e.g., 1234567890" style={inputSty} />
                  </div>
                  <div>
                    <Label>Brand</Label>
                    <input type="text" name="brand" value={form.brand} onChange={handleChange}
                      placeholder="e.g., Tata" style={inputSty} />
                  </div>
                  <div>
                    <Label required>Category</Label>
                    <select name="category_id" value={form.category_id} onChange={handleChange}
                      required style={inputSty}>
                      <option value="">Select category</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Subcategory</Label>
                    <input type="text" name="subcategory" value={form.subcategory} onChange={handleChange}
                      placeholder="e.g., Green Tea" style={inputSty} />
                  </div>
                  <div>
                    <Label required>Unit</Label>
                    <select name="unit" value={form.unit} onChange={handleChange} required style={inputSty}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </Section>

              {/* Section: Pricing */}
              <Section title="Pricing">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <Label required>Purchase (₹)</Label>
                    <input type="number" name="purchase_price" value={form.purchase_price} onChange={handleChange}
                      required step="0.01" min="0" placeholder="0.00" style={inputSty} />
                  </div>
                  <div>
                    <Label required>MRP (₹)</Label>
                    <input type="number" name="mrp" value={form.mrp} onChange={handleChange}
                      required step="0.01" min="0" placeholder="0.00" style={inputSty} />
                  </div>
                  <div>
                    <Label required>Selling (₹)</Label>
                    <input type="number" name="selling_price" value={form.selling_price} onChange={handleChange}
                      required step="0.01" min="0" placeholder="0.00" style={inputSty} />
                  </div>
                  <div>
                    <Label required>GST %</Label>
                    <input type="number" name="gst_percentage" value={form.gst_percentage} onChange={handleChange}
                      required step="0.01" min="0" placeholder="0.00" style={inputSty} />
                  </div>
                </div>
              </Section>

              {/* Section: Inventory */}
              <Section title="Inventory">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-6">
                    <Toggle checked={form.track_stock} label="Track Stock"
                      onChange={() => setForm(f => ({ ...f, track_stock: !f.track_stock }))} />
                    <Toggle checked={form.quick_sale_enabled} label="Quick Sale"
                      onChange={() => setForm(f => ({ ...f, quick_sale_enabled: !f.quick_sale_enabled }))} />
                    <Toggle checked={form.active} label="Active"
                      onChange={() => setForm(f => ({ ...f, active: !f.active }))} />
                  </div>
                  {form.track_stock && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label required>Current Stock</Label>
                        <input type="number" name="current_stock" value={form.current_stock} onChange={handleChange}
                          required={form.track_stock} step="0.001" min="0" placeholder="0" style={inputSty} />
                      </div>
                      <div>
                        <Label required>Min Stock Level</Label>
                        <input type="number" name="minimum_stock_level" value={form.minimum_stock_level} onChange={handleChange}
                          required={form.track_stock} step="0.001" min="0" placeholder="0" style={inputSty} />
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background: saving ? '#c8a84b' : B.goldGrad, color: B.brown }}>
                  {saving ? 'Saving...' : modal === 'add' ? 'Add Product' : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8d5a3' }}>
      <div className="px-4 py-2 flex items-center gap-2"
        style={{ background: 'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f5c842' }}>{title}</span>
        <div className="flex-1 h-px opacity-30" style={{ background: '#d4a017' }} />
      </div>
      <div className="p-4" style={{ background: '#fff9ee' }}>
        {children}
      </div>
    </div>
  );
}
