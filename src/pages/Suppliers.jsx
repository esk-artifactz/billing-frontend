import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
};

const EMPTY = { name: '', contact_name: '', phone: '', address: '', fssai_no: '' };

export default function Suppliers() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');

  const [modal,     setModal]     = useState(null); // null | 'add' | 'edit'
  const [form,      setForm]      = useState(EMPTY);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  const handleLogout = () => { signOut(); navigate('/login'); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getSuppliers();
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) ||
           (s.phone || '').includes(q) ||
           (s.fssai_no || '').toLowerCase().includes(q);
  });

  const openAdd  = () => { setForm(EMPTY); setFormError(''); setEditId(null); setModal('add'); };
  const openEdit = (s) => {
    setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone || '',
      address: s.address || '', fssai_no: s.fssai_no || '' });
    setEditId(s.id); setFormError(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setEditId(null); };

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Supplier name is required.'); return; }
    setSaving(true); setFormError('');
    try {
      if (modal === 'add') {
        await createSupplier(form);
        showToast('Supplier added!');
      } else {
        await updateSupplier(editId, form);
        showToast('Supplier updated!');
      }
      closeModal(); load();
    } catch (err) { setFormError(err.response?.data?.detail || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (s) => {
    try {
      await updateSupplier(s.id, { active: !s.active });
      showToast(s.active ? 'Supplier deactivated.' : 'Supplier activated.');
      load();
    } catch { showToast('Failed.', false); }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    try { await deleteSupplier(s.id); showToast('Supplier deleted.'); load(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to delete.', false); }
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown} 0%, ${B.midBrown} 50%, ${B.brown} 100%)`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Suppliers</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95"
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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B.darkBrown}, #5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Supplier Management</h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>Manage suppliers linked to products and purchase orders</p>
            </div>
            <button onClick={openAdd}
              className="font-bold px-5 py-2 rounded-xl text-sm transition-all active:scale-95 flex-shrink-0 shadow-md"
              style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
              + Add Supplier
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-80 border-2 rounded-xl px-4 py-2 text-sm outline-none"
            style={{ borderColor: '#e8d5a3' }} placeholder="Search by name, phone or FSSAI…" />
        </div>

        {/* Table */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#a07020' }}>
              <p className="text-lg font-semibold">{search ? 'No suppliers match your search' : 'No suppliers yet'}</p>
              {!search && <p className="text-sm mt-1">Click "+ Add Supplier" to create one.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                    {['Supplier Name', 'Contact Person', 'Phone', 'Address', 'FSSAI No.', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, idx) => (
                    <tr key={s.id}
                      style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                        opacity: s.active === false ? 0.55 : 1 }}>
                      <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{s.name}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{s.contact_name || '—'}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{s.phone || '—'}</td>
                      <td className="px-4 py-3 text-xs max-w-[180px]" style={{ color: '#7a4e08' }}>
                        <div className="truncate" title={s.address || ''}>{s.address || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {s.fssai_no ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: '#fef3c7', color: '#b45309' }}>
                            {s.fssai_no}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: s.active !== false ? '#dcfce7' : '#fee2e2',
                            color: s.active !== false ? '#16a34a' : '#dc2626' }}>
                          {s.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => openEdit(s)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                            style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                            Edit
                          </button>
                          <button onClick={() => handleToggleActive(s)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                            style={{ background: s.active !== false ? '#fef3c7' : '#dcfce7',
                              color: s.active !== false ? '#b45309' : '#16a34a' }}>
                            {s.active !== false ? 'Deactivate' : 'Activate'}
                          </button>
                          <button onClick={() => handleDelete(s)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                            style={{ background: '#fee2e2', color: '#dc2626' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {modal === 'add' ? '+ Add New Supplier' : 'Edit Supplier'}
              </h3>
              {formError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>
                  {formError}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Name */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Supplier Name *</label>
                  <input name="name" value={form.name} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }} placeholder="e.g. Tata Consumer Products" />
                </div>
                {/* Contact + Phone */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Contact Person</label>
                    <input name="contact_name" value={form.contact_name} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Contact Number</label>
                    <input name="phone" value={form.phone} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="9876543210" />
                  </div>
                </div>
                {/* Address */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Address</label>
                  <textarea name="address" value={form.address} onChange={handleChange} rows={3}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none resize-none"
                    style={{ borderColor: '#e8d5a3' }} placeholder="Street, City, State, PIN" />
                </div>
                {/* FSSAI */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                    FSSAI Licence Number
                    <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                  </label>
                  <input name="fssai_no" value={form.fssai_no} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none font-mono"
                    style={{ borderColor: '#e8d5a3' }} placeholder="e.g. 10019022000147" maxLength={20} />
                </div>
                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
                    {saving ? 'Saving…' : modal === 'add' ? 'Add Supplier' : 'Save Changes'}
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
