import { useState, useEffect, useCallback, Fragment } from 'react';
import { useEscClose } from '../hooks/useEscClose';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  getSubcategories, createSubcategory, updateSubcategory, deleteSubcategory,
} from '../api/client';

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

const EMPTY_FORM = { name: '', description: '', active: true, category_type: 'product', show_on_menu: true, menu_note: '' };

// Product categories show on Products / Billing; Raw Material categories only on Raw Material pages
const TYPE_TABS = [
  { key: 'product',      label: 'Product Categories',      hint: 'Used for products sold in billing. Choose which ones show on the public Menu card and add a Menu Note (e.g. "Add Ice Cream +₹15").' },
  { key: 'raw_material', label: 'Raw Material Categories', hint: 'Used only for raw materials (not shown on Products)' },
];
const typeOf = (c) => c.category_type || 'product';

export default function Categories() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [allCats, setCategories]    = useState([]);
  const [ctype, setCtype]           = useState('product');   // which tab is shown
  const categories = allCats.filter(c => typeOf(c) === ctype);
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

  // ── Subcategories ─────────────────────────────────────────────────────────
  const [subcats, setSubcats]       = useState([]);
  const [openCatId, setOpenCatId]   = useState(null);   // category whose subcategories are expanded
  const [newSub, setNewSub]         = useState('');
  const [subEditId, setSubEditId]   = useState(null);
  const [subEditName, setSubEditName] = useState('');
  const [subErr, setSubErr]         = useState('');
  const [subBusy, setSubBusy]       = useState(false);

  const fetchSubcats = useCallback(async () => {
    try { const res = await getSubcategories(); setSubcats(res.data.subcategories || []); }
    catch { /* silent */ }
  }, []);
  useEffect(() => { fetchSubcats(); }, [fetchSubcats]);

  const subsOf = (catId) => subcats.filter(s => s.category_id === catId);
  const toggleSubs = (catId) => {
    setOpenCatId(id => (id === catId ? null : catId));
    setNewSub(''); setSubErr(''); setSubEditId(null);
  };
  const runSub = async (fn) => {
    setSubBusy(true); setSubErr('');
    try { await fn(); await fetchSubcats(); return true; }
    catch (err) { setSubErr(err.response?.data?.detail || 'Failed — please try again.'); return false; }
    finally { setSubBusy(false); }
  };
  const addSub = async (catId) => {
    if (!newSub.trim()) return;
    if (await runSub(() => createSubcategory({ category_id: catId, name: newSub.trim() }))) setNewSub('');
  };
  const saveSubName = async (s) => {
    if (!subEditName.trim()) return;
    if (await runSub(() => updateSubcategory(s.id, { name: subEditName.trim() }))) setSubEditId(null);
  };
  const toggleSubActive = (s) => runSub(() => updateSubcategory(s.id, { active: !s.active }));
  const removeSub = (s) => {
    if (!confirm(`Delete subcategory "${s.name}"?`)) return;
    runSub(() => deleteSubcategory(s.id));
  };

  const openAdd  = () => { setForm({ ...EMPTY_FORM, category_type: ctype }); setFormError(''); setModal('add'); };
  const openEdit = (cat) => { setSelected(cat); setForm({ name: cat.name || '', description: cat.description || '', active: cat.active !== undefined ? cat.active : true, category_type: typeOf(cat), show_on_menu: cat.show_on_menu !== false, menu_note: cat.menu_note || '' }); setFormError(''); setModal('edit'); };
  const closeModal = () => { setModal(null); setSelected(null); };
  useEscClose(closeModal, !!modal);

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  };

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try { await createCategory(form); closeModal(); setCtype(form.category_type); fetchCategories(); }
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
            <p className="text-sm mt-0.5" style={{ color: B.textLight }}>{allCats.length} categor{allCats.length === 1 ? 'y' : 'ies'} in total</p>
          </div>
          <button onClick={openAdd}
            className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-all shadow-md"
            style={{ background: B.goldGrad, color: B.brown }}>
            + Add {ctype === 'raw_material' ? 'Raw Material' : 'Product'} Category
          </button>
        </div>

        {/* Product / Raw Material tabs */}
        <div className="flex gap-2 flex-wrap">
          {TYPE_TABS.map(t => {
            const n = allCats.filter(c => typeOf(c) === t.key).length;
            const on = ctype === t.key;
            return (
              <button key={t.key} onClick={() => { setCtype(t.key); setOpenCatId(null); }} title={t.hint}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={on ? { background: B.bgGrad, color: B.goldLight, border: `1.5px solid ${B.gold}` }
                          : { background: '#fff9ee', color: B.text, border: '1.5px solid #e8d5a3' }}>
                {t.label} <span className="ml-1 text-xs opacity-80">({n})</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs -mt-2" style={{ color: B.textLight }}>{TYPE_TABS.find(t => t.key === ctype).hint}</p>

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
            <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: B.bgGrad }}>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>#</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Description</th>
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Subcategories</th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Active</th>
                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: B.goldLight }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, idx) => {
                    const subs = subsOf(cat.id);
                    const open = openCatId === cat.id;
                    return (
                    <Fragment key={cat.id}>
                    <tr
                      className="transition-colors"
                      style={{ background: open ? '#fff3d6' : idx % 2 === 0 ? '#fff9ee' : '#fffef8', borderTop: '1px solid #e8d5a3' }}>
                      <td className="px-5 py-3 text-sm" style={{ color: B.textLight }}>{idx + 1}</td>
                      <td className="px-5 py-3 text-sm font-bold" style={{ color: B.text }}>
                        {cat.name}
                        {ctype === 'product' && cat.show_on_menu === false && (
                          <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: '#f3f4f6', color: '#6b7280' }}>Hidden from Menu</span>
                        )}
                        {ctype === 'product' && cat.menu_note && (
                          <div className="text-xs font-normal mt-0.5 whitespace-pre-line" style={{ color: '#b45309' }}>Menu note: {cat.menu_note}</div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: B.textLight }}>{cat.description || '—'}</td>
                      <td className="px-5 py-3 text-sm">
                        <button onClick={() => toggleSubs(cat.id)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all whitespace-nowrap"
                          style={open ? { background: B.goldGrad, color: B.brown } : { background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                          {subs.length} {open ? '▲' : '▼ Manage'}
                        </button>
                      </td>
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
                    {open && (
                      <tr style={{ background: '#fffdf5', borderTop: '1px dashed #e8d5a3' }}>
                        <td />
                        <td colSpan={5} className="px-5 py-4">
                          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: B.textLight }}>
                            Subcategories of {cat.name}
                            <span className="ml-1 font-normal normal-case">(used by products and raw materials)</span>
                          </p>
                          {subErr && <p className="text-xs font-semibold mb-2" style={{ color: '#c62828' }}>{subErr}</p>}
                          <div className="space-y-1.5 mb-3">
                            {subs.length === 0 && <p className="text-sm" style={{ color: B.textLight }}>No subcategories yet.</p>}
                            {subs.map(s => (
                              <div key={s.id} className="flex items-center gap-2 flex-wrap rounded-lg px-3 py-1.5"
                                style={{ background: '#fff', border: '1px solid #f0e0c0', opacity: s.active ? 1 : 0.55 }}>
                                {subEditId === s.id ? (
                                  <input value={subEditName} onChange={e => setSubEditName(e.target.value)} autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') saveSubName(s); if (e.key === 'Escape') setSubEditId(null); }}
                                    style={{ ...inputCls, padding: '4px 10px', width: 200 }} maxLength={100} />
                                ) : (
                                  <span className="text-sm font-semibold" style={{ color: B.text }}>{s.name}</span>
                                )}
                                <span className="text-xs" style={{ color: B.textLight }}>
                                  {s.product_count} product{s.product_count !== 1 ? 's' : ''} · {s.raw_material_count} raw material{s.raw_material_count !== 1 ? 's' : ''}
                                  {!s.active && ' · inactive'}
                                </span>
                                <div className="ml-auto flex gap-1.5">
                                  {subEditId === s.id ? (
                                    <>
                                      <button onClick={() => saveSubName(s)} disabled={subBusy} className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: '#e8f5e9', color: '#2e7d32' }}>Save</button>
                                      <button onClick={() => setSubEditId(null)} className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setSubEditId(s.id); setSubEditName(s.name); }} className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>Rename</button>
                                      <button onClick={() => toggleSubActive(s)} disabled={subBusy} className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: s.active ? '#fff7e0' : '#e8f5e9', color: s.active ? '#b45309' : '#2e7d32' }}>
                                        {s.active ? 'Deactivate' : 'Activate'}
                                      </button>
                                      <button onClick={() => removeSub(s)} disabled={subBusy} className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>Delete</button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input value={newSub} onChange={e => setNewSub(e.target.value)} maxLength={100}
                              onKeyDown={e => { if (e.key === 'Enter') addSub(cat.id); }}
                              placeholder={`New subcategory in ${cat.name} (e.g. Dairy, Spices)`} style={{ ...inputCls, maxWidth: 360 }} />
                            <button onClick={() => addSub(cat.id)} disabled={subBusy || !newSub.trim()}
                              className="font-bold px-4 rounded-xl text-sm active:scale-95 disabled:opacity-50"
                              style={{ background: B.goldGrad, color: B.brown }}>
                              + Add
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[92vh]"
            style={{ background: B.pageGrad, border: B.goldBorder }}>
            <div className="h-1.5" style={{ background: B.goldGrad }} />
            <div className="px-6 py-4" style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
              <h3 className="text-lg font-bold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                {modal === 'add' ? `Add ${form.category_type === 'raw_material' ? 'Raw Material' : 'Product'} Category` : 'Edit Category'}
              </h3>
            </div>

            {formError && (
              <div className="mx-5 mt-4 rounded-lg px-4 py-3 text-sm font-medium"
                style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
                {formError}
              </div>
            )}

            <form onSubmit={modal === 'add' ? handleAdd : handleUpdate} className="p-5 space-y-4">
              {/* Type — Product (Products / billing) or Raw Material (Raw Material pages only) */}
              <div>
                <label className="block text-sm font-bold mb-1.5" style={{ color: B.text }}>Category Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_TABS.map(t => (
                    <button key={t.key} type="button" onClick={() => setForm(f => ({ ...f, category_type: t.key }))}
                      className="py-2 rounded-lg text-xs font-bold active:scale-95"
                      style={form.category_type === t.key
                        ? { background: B.goldGrad, color: B.brown, border: `2px solid ${B.goldDark}` }
                        : { background: '#fff9ee', color: B.text, border: '2px solid #e8d5a3' }}>
                      {t.key === 'product' ? 'Product' : 'Raw Material'}
                    </button>
                  ))}
                </div>
              </div>
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

              {/* Public Menu card settings — product categories only */}
              {form.category_type === 'product' && (
                <div className="rounded-xl p-3 space-y-3" style={{ background: '#fff9ee', border: '1.5px dashed #d4a017' }}>
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div onClick={() => setForm(f => ({ ...f, show_on_menu: !f.show_on_menu }))}
                      className="w-11 h-6 rounded-full flex items-center transition-all px-0.5 flex-shrink-0"
                      style={{ background: form.show_on_menu ? B.goldGrad : '#d0c8b8' }}>
                      <div className="w-5 h-5 rounded-full bg-white shadow transition-all"
                        style={{ transform: form.show_on_menu ? 'translateX(20px)' : 'translateX(0)' }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: B.text }}>Show on Menu card</span>
                  </label>
                  <div>
                    <label className="block text-sm font-bold mb-1.5" style={{ color: B.text }}>
                      Menu Note <span className="font-normal text-xs" style={{ color: B.textLight }}>(shown under this category on the Menu)</span>
                    </label>
                    <textarea name="menu_note" value={form.menu_note} onChange={handleChange} rows="2" maxLength={500}
                      placeholder="e.g., Add Ice Cream +₹15 · Extra Cheese +₹10"
                      style={{ ...inputCls, resize: 'vertical' }} />
                  </div>
                </div>
              )}

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
