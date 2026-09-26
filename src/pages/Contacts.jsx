import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getContactCategories, createContactCategory, updateContactCategory, deleteContactCategory,
  getContacts, createContact, updateContact, deleteContact,
} from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const PRESET_COLORS = [
  '#f97316','#06b6d4','#16a34a','#0ea5e9','#ca8a04','#dc2626',
  '#8b5cf6','#64748b','#eab308','#1d4ed8','#be185d','#6b7280',
  '#d4a017','#10b981','#f59e0b','#7c3aed',
];

const PRESET_ICONS = [
  '🔥','🍦','🥦','🥛','🛒','⚡','🔧','🚚','🏦','🚨','📋',
  '🏪','🍕','☕','🧹','🌿','🐄','🐟','💊','📦','🏗️','🎯',
];

const EMPTY_CAT_FORM  = { name: '', color: '#d4a017', icon: '📋' };
const EMPTY_CON_FORM  = { name: '', category_id: '', phone: '', phone2: '', address: '', notes: '' };

export default function Contacts() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [cats,        setCats]        = useState([]);
  const [contacts,    setContacts]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [total,       setTotal]       = useState(0);

  // Sidebar / filter state
  const [activeCat,   setActiveCat]   = useState(null); // null = All
  const [search,      setSearch]      = useState('');

  // Contact modal
  const [conModal,    setConModal]    = useState(null); // null | 'add' | 'edit'
  const [conForm,     setConForm]     = useState(EMPTY_CON_FORM);
  const [editConId,   setEditConId]   = useState(null);
  const [conSaving,   setConSaving]   = useState(false);
  const [conErr,      setConErr]      = useState('');

  // Category modal
  const [catModal,    setCatModal]    = useState(null); // null | 'add' | 'edit'
  const [catForm,     setCatForm]     = useState(EMPTY_CAT_FORM);
  const [editCatId,   setEditCatId]   = useState(null);
  const [catSaving,   setCatSaving]   = useState(false);
  const [catErr,      setCatErr]      = useState('');

  // View: 'contacts' | 'categories'
  const [tab, setTab] = useState('contacts');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeCat) params.category_id = activeCat;
      if (search)    params.search      = search;
      const res = await getContacts(params);
      setContacts(res.data.contacts || []);
      setCats(res.data.categories  || []);
      setTotal(res.data.total      || 0);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setLoading(false); }
  }, [activeCat, search, navigate, signOut]);

  const loadCats = useCallback(async () => {
    try {
      const res = await getContactCategories();
      setCats(res.data.categories || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Contact helpers ───────────────────────────────────────────────────────
  const openAddContact = () => {
    setConForm({ ...EMPTY_CON_FORM, category_id: activeCat || '' });
    setConErr(''); setEditConId(null); setConModal('add');
  };
  const openEditContact = (c) => {
    setConForm({
      name: c.name, category_id: c.category_id || '',
      phone: c.phone || '', phone2: c.phone2 || '',
      address: c.address || '', notes: c.notes || '',
    });
    setEditConId(c.id); setConErr(''); setConModal('edit');
  };
  const closeConModal = () => { setConModal(null); setEditConId(null); };
  const handleConChange = (e) => setConForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleConSubmit = async (ev) => {
    ev.preventDefault();
    if (!conForm.name.trim()) { setConErr('Name is required.'); return; }
    setConSaving(true); setConErr('');
    try {
      if (conModal === 'add') { await createContact(conForm); showToast('Contact saved!'); }
      else { await updateContact(editConId, conForm); showToast('Contact updated!'); }
      closeConModal(); load();
    } catch (err) { setConErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setConSaving(false); }
  };

  const handleDeleteContact = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try { await deleteContact(c.id); showToast('Deleted.'); load(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed.', false); }
  };

  const callNumber = (phone) => { window.open(`tel:${phone}`); };
  const whatsapp   = (phone) => {
    const num = phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${num}`, '_blank');
  };

  // ── Category helpers ──────────────────────────────────────────────────────
  const openAddCat = () => { setCatForm(EMPTY_CAT_FORM); setCatErr(''); setEditCatId(null); setCatModal('add'); };
  const openEditCat = (c) => {
    setCatForm({ name: c.name, color: c.color || '#d4a017', icon: c.icon || '📋' });
    setEditCatId(c.id); setCatErr(''); setCatModal('edit');
  };
  const closeCatModal = () => { setCatModal(null); setEditCatId(null); };
  const handleCatChange = (e) => setCatForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCatSubmit = async (ev) => {
    ev.preventDefault();
    if (!catForm.name.trim()) { setCatErr('Name is required.'); return; }
    setCatSaving(true); setCatErr('');
    try {
      if (catModal === 'add') { await createContactCategory(catForm); showToast('Category added!'); }
      else { await updateContactCategory(editCatId, catForm); showToast('Category updated!'); }
      closeCatModal(); load(); loadCats();
    } catch (err) { setCatErr(err.response?.data?.detail || 'Failed to save.'); }
    finally { setCatSaving(false); }
  };

  const handleDeleteCat = async (c) => {
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    try { await deleteContactCategory(c.id); showToast('Deleted.'); load(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed — may have contacts.', false); }
  };

  // Count contacts per category for the sidebar badge
  const countByCat = contacts.reduce((acc, c) => {
    if (c.category_id) acc[c.category_id] = (acc[c.category_id] || 0) + 1;
    return acc;
  }, {});

  // For the "All contacts" view group by category
  const grouped = contacts.reduce((acc, c) => {
    const key = c.category_name || 'Uncategorised';
    if (!acc[key]) acc[key] = { color: c.category_color || B.gold, icon: c.category_icon || '📋', items: [] };
    acc[key].items.push(c);
    return acc;
  }, {});

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
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Contact Book</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
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
                Contact Book
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Save phone numbers by category — Gas Agency, Ice Cream Vendors, Suppliers and more
              </p>
            </div>
            <button onClick={openAddContact}
              className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md flex-shrink-0"
              style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
              + Add Contact
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'contacts',   label: 'All Contacts' },
            { key: 'categories', label: 'Manage Categories' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
              style={tab === t.key
                ? { background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})`, color: B.goldLight }
                : { background: '#fff', border: '1px solid #e8d5a3', color: B.text }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* CONTACTS TAB                                       */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === 'contacts' && (
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Category sidebar */}
            <div className="lg:w-56 flex-shrink-0 space-y-2">
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="px-4 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: B.textLight }}>Categories</p>
                </div>
                <div className="p-2 space-y-1">
                  {/* All */}
                  <button onClick={() => setActiveCat(null)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-left active:scale-95 transition-all"
                    style={activeCat === null
                      ? { background: B.darkBrown, color: B.goldLight }
                      : { color: B.text, background: 'transparent' }}>
                    <span>📋</span>
                    <span className="flex-1">All</span>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: activeCat === null ? B.gold + '44' : '#f0e8d0', color: activeCat === null ? B.goldLight : B.textLight }}>
                      {contacts.length}
                    </span>
                  </button>
                  {/* Per category */}
                  {cats.map(c => (
                    <button key={c.id} onClick={() => setActiveCat(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-left active:scale-95 transition-all"
                      style={activeCat === c.id
                        ? { background: c.color + '22', border: `1px solid ${c.color}55`, color: B.darkBrown }
                        : { color: B.text }}>
                      <span>{c.icon}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      {countByCat[c.id] > 0 && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: c.color + '22', color: c.color }}>
                          {countByCat[c.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main panel */}
            <div className="flex-1 space-y-4">
              {/* Search bar */}
              <div className="flex gap-3">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load()}
                  placeholder="Search by name or phone…"
                  className="flex-1 border-2 rounded-xl px-4 py-2.5 text-sm outline-none"
                  style={{ borderColor: '#e8d5a3', background: '#fff' }}
                />
                <button onClick={load}
                  className="text-sm font-bold px-4 py-2.5 rounded-xl active:scale-95"
                  style={{ background: `linear-gradient(135deg,#b8860b,${B.gold})`, color: '#fff' }}>
                  Search
                </button>
                {search && (
                  <button onClick={() => { setSearch(''); }}
                    className="text-sm font-semibold px-3 py-2.5 rounded-xl active:scale-95"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>
                    Clear
                  </button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="w-10 h-10 rounded-full border-4 animate-spin"
                    style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-20 rounded-2xl" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                  <p className="text-5xl mb-3">📞</p>
                  <p className="text-lg font-semibold" style={{ color: B.textLight }}>No contacts yet</p>
                  <p className="text-sm mt-1" style={{ color: '#bbb' }}>Click "+ Add Contact" to save your first number.</p>
                </div>
              ) : (
                /* Group by category */
                Object.entries(grouped).map(([catName, grp]) => (
                  <div key={catName} className="rounded-2xl shadow-sm overflow-hidden"
                    style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                    {/* Category header */}
                    <div className="flex items-center gap-2 px-5 py-3"
                      style={{ background: grp.color + '18', borderBottom: `2px solid ${grp.color}44` }}>
                      <span className="text-lg">{grp.icon}</span>
                      <span className="font-bold text-sm" style={{ color: B.darkBrown }}>{catName}</span>
                      <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: grp.color + '22', color: grp.color }}>
                        {grp.items.length}
                      </span>
                    </div>
                    {/* Contacts grid */}
                    <div className="divide-y" style={{ borderColor: '#f5ead0' }}>
                      {grp.items.map(con => (
                        <div key={con.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white font-extrabold text-sm"
                            style={{ background: grp.color }}>
                            {con.name.charAt(0).toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: B.darkBrown }}>{con.name}</p>
                            {con.phone && (
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-sm font-semibold" style={{ color: B.text }}>{con.phone}</p>
                                <button onClick={() => callNumber(con.phone)}
                                  className="text-xs font-bold px-2 py-0.5 rounded-full active:scale-95"
                                  style={{ background: '#dcfce7', color: '#16a34a' }}>📞 Call</button>
                                <button onClick={() => whatsapp(con.phone)}
                                  className="text-xs font-bold px-2 py-0.5 rounded-full active:scale-95"
                                  style={{ background: '#d1fae5', color: '#059669' }}>💬 WhatsApp</button>
                              </div>
                            )}
                            {con.phone2 && (
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-xs" style={{ color: B.textLight }}>{con.phone2}</p>
                                <button onClick={() => callNumber(con.phone2)}
                                  className="text-xs font-bold px-2 py-0.5 rounded-full active:scale-95"
                                  style={{ background: '#dbeafe', color: '#1d4ed8' }}>📞 Alt</button>
                              </div>
                            )}
                            {con.address && (
                              <p className="text-xs mt-0.5 truncate" style={{ color: B.textLight }}>📍 {con.address}</p>
                            )}
                            {con.notes && (
                              <p className="text-xs mt-0.5 italic" style={{ color: '#aaa' }}>"{con.notes}"</p>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => openEditContact(con)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                            <button onClick={() => handleDeleteContact(con)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* CATEGORIES TAB                                     */}
        {/* ══════════════════════════════════════════════════ */}
        {tab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={openAddCat}
                className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                + Add Category
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cats.map(c => (
                <div key={c.id} className="rounded-2xl shadow-sm overflow-hidden"
                  style={{ background: '#fff', border: `1.5px solid ${c.color}44` }}>
                  <div className="h-1.5" style={{ background: c.color }} />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{c.icon}</span>
                      <div>
                        <p className="font-extrabold text-sm" style={{ color: B.darkBrown }}>{c.name}</p>
                        <p className="text-xs" style={{ color: B.textLight }}>
                          {countByCat[c.id] || 0} contact{(countByCat[c.id] || 0) !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className="ml-auto w-5 h-5 rounded-full border"
                        style={{ background: c.color, borderColor: c.color + '88' }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setTab('contacts'); setActiveCat(c.id); }}
                        className="flex-1 text-xs font-bold py-1.5 rounded-lg active:scale-95"
                        style={{ background: c.color + '18', color: c.color }}>
                        View Contacts
                      </button>
                      <button onClick={() => openEditCat(c)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                        style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                      <button onClick={() => handleDeleteCat(c)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                        style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
              {cats.length === 0 && (
                <div className="col-span-3 text-center py-12" style={{ color: B.textLight }}>
                  <p className="text-lg font-semibold">No categories yet</p>
                  <p className="text-sm mt-1" style={{ color: '#bbb' }}>Click "+ Add Category" to create one.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CONTACT MODAL                                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {conModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {conModal === 'add' ? '+ Add Contact' : 'Edit Contact'}
              </h3>
              {conErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{conErr}</div>
              )}
              <form onSubmit={handleConSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Name *</label>
                    <input type="text" name="name" value={conForm.name} onChange={handleConChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }}
                      placeholder="e.g. Ravi Gas Agency, Kumar Ice Cream" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category</label>
                    <select name="category_id" value={conForm.category_id} onChange={handleConChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }}>
                      <option value="">— None —</option>
                      {cats.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Phone Number</label>
                    <input type="tel" name="phone" value={conForm.phone} onChange={handleConChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="e.g. 9876543210" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Alternate Phone</label>
                    <input type="tel" name="phone2" value={conForm.phone2} onChange={handleConChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="Optional" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Address</label>
                    <input type="text" name="address" value={conForm.address} onChange={handleConChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="Shop / area address (optional)" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes</label>
                    <textarea name="notes" value={conForm.notes} onChange={handleConChange} rows={2}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="e.g. Delivers on Tuesdays, Best price for LPG…" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeConModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={conSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {conSaving ? 'Saving…' : conModal === 'add' ? 'Save Contact' : 'Update Contact'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CATEGORY MODAL                                                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {catModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {catModal === 'add' ? '+ New Category' : 'Edit Category'}
              </h3>
              {catErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{catErr}</div>
              )}
              <form onSubmit={handleCatSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Category Name *</label>
                  <input type="text" name="name" value={catForm.name} onChange={handleCatChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder="e.g. Gas Agency, Juice Vendor, Mechanic…" />
                </div>

                {/* Icon picker */}
                <div>
                  <label className="text-xs font-bold mb-2 block" style={{ color: B.brown }}>Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_ICONS.map(ic => (
                      <button key={ic} type="button"
                        onClick={() => setCatForm(f => ({ ...f, icon: ic }))}
                        className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                        style={{
                          background: catForm.icon === ic ? B.gold + '33' : '#f5f5f5',
                          border: catForm.icon === ic ? `2px solid ${B.gold}` : '2px solid transparent',
                        }}>
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="text-xs font-bold mb-2 block" style={{ color: B.brown }}>Colour</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {PRESET_COLORS.map(pc => (
                      <button key={pc} type="button"
                        onClick={() => setCatForm(f => ({ ...f, color: pc }))}
                        className="w-6 h-6 rounded-full transition-all"
                        style={{
                          background: pc,
                          outline: catForm.color === pc ? `3px solid ${pc}` : 'none',
                          outlineOffset: '2px',
                        }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" name="color" value={catForm.color} onChange={handleCatChange}
                      className="w-9 h-9 rounded-lg border-2 cursor-pointer"
                      style={{ borderColor: '#e8d5a3', padding: 2 }} />
                    <span className="text-xs font-mono" style={{ color: B.textLight }}>{catForm.color}</span>
                  </div>
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: catForm.color + '18', border: `1px solid ${catForm.color}44` }}>
                  <span className="text-2xl">{catForm.icon}</span>
                  <span className="font-bold text-sm" style={{ color: B.darkBrown }}>
                    {catForm.name || 'Category Preview'}
                  </span>
                  <span className="ml-auto w-4 h-4 rounded-full" style={{ background: catForm.color }} />
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={closeCatModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={catSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {catSaving ? 'Saving…' : catModal === 'add' ? 'Add Category' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
