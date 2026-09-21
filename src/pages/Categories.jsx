import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api/client';

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

const inputCls = {
  background: '#fff9ee',
  border: '1.5px solid #d4a017',
  color: '#3d2008',
  borderRadius: 10,
  padding: '9px 13px',
  width: '100%',
  fontSize: 14,
  outline: 'none',
};

const EMPTY_FORM = { name: '', description: '', active: true };

export default function Categories() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [modal, setModal]           = useState(null);
  const [selected, setSelected]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getCategories();
      setCategories(res.data.categories || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load categories.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openAdd  = () => { setForm(EMPTY_FORM); setFormError(''); setModal('add'); };
  const openEdit = (cat) => { setSelected(cat); setForm({ name: cat.name || '', description: cat.description || '', active: cat.active !== undefined ? cat.active : true }); setFormError(''); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await createCategory(form); closeModal(); fetchCategories(); }
    catch (err) { setFormError(err.response?.data?.detail || 'Failed to add category.'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await updateCategory(selected.id, form); closeModal(); fetchCategories(); }
    catch (err) { setFormError(err.response?.data?.detail || 'Failed to update category.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try { await deleteCategory(cat.id); fetchCategories(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to delete category.'); }
  };

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
      <div className="max-w-4xl mx-auto mt-8 px-4 pb-10 space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>Categories</h2>
            <p className="text-sm mt-0.5" style={{ color: B.textLight }}>{categories.length} categor{categories.length === 1 ? 'y' : 'ies'} found</p>
          </div>
          <button onClick={openAdd}
            className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-all shadow-md"
            style={{ background: B.goldGrad, color: B.brown }}>
            + Add Category
          </button>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="rounded-2xl shadow-md overflow-hidden" style={{ border: B.goldBorder }}>
          {/* Gold top stripe */}
          <div className="h-1" style={{ background: B.goldGrad }} />

          {loading ? (
            <div className="p-10 text-center font-medium" style={{ color: B.textLight }}>Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-10 text-center font-medium" style={{ color: B.textLight }}>No categories yet. Add your first one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: B.bgGrad }}>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Description</th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Active</th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, idx) => (
                    <tr key={cat.id}
                      className="transition-colors"
                      style={{ background: idx % 2 === 0 ? '#fff9ee' : '#fffef8', borderTop: '1px solid #e8d5a3' }}>
                      <td className="px-5 py-3 text-sm" style={{ color: B.textLight }}>{idx + 1}</td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: B.text }}>{cat.name}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: B.textLight }}>{cat.description || '—'}</td>
                      <td className="px-5 py-3 text-center">
                        {cat.active
                          ? <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#e8f5e9', color: '#2e7d32' }}>Active</span>
                          : <span className="px-2.5 py-0.5 rounded-full text-xs font-bold" style={{ background: '#ffebee', color: '#c62828' }}>Inactive</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button onClick={() => openEdit(cat)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg mr-2 active:scale-95 transition-all"
                          style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(cat)}
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ background: B.pageGrad, border: B.goldBorder }}>
            <div className="h-1.5" style={{ background: B.goldGrad }} />
            <div className="px-6 py-4" style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
              <h3 className="text-lg font-bold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                {modal === 'add' ? 'Add New Category' : 'Edit Category'}
              </h3>
            </div>

            {formError && (
              <div className="mx-5 mt-4 rounded-lg px-4 py-3 text-sm font-medium"
                style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
                {formError}
              </div>
            )}

            <form onSubmit={modal === 'add' ? handleAdd : handleUpdate} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: B.text }}>Category Name *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange}
                  required placeholder="e.g., Beverages" style={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: B.text }}>Description</label>
                <textarea name="description" value={form.description} onChange={handleChange}
                  rows="3" placeholder="Category description..."
                  style={{ ...inputCls, resize: 'vertical' }} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className="w-11 h-6 rounded-full flex items-center transition-all px-0.5 flex-shrink-0"
                  style={{ background: form.active ? B.goldGrad : '#d0c8b8' }}>
                  <div className="w-5 h-5 rounded-full bg-white shadow transition-all"
                    style={{ transform: form.active ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: B.text }}>Active</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background: saving ? '#c8a84b' : B.goldGrad, color: B.brown }}>
                  {saving ? 'Saving...' : modal === 'add' ? 'Add Category' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
