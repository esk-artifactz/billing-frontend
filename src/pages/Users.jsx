import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, registerUser, updateUser } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const ROLES = ['Admin', 'Cashier'];
const EMPTY_FORM = { username: '', password: '', full_name: '', role: 'Cashier' };

const ROLE_STYLE = {
  Admin:   { bg: '#ede9fe', color: '#7c3aed' },
  Cashier: { bg: '#dbeafe', color: '#1d4ed8' },
};

export default function Users() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);

  const [modal,     setModal]     = useState(null); // null | 'register' | 'edit'
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [formErr,   setFormErr]   = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers();
      setUsers(res.data.users || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openRegister = () => { setForm(EMPTY_FORM); setFormErr(''); setModal('register'); };
  const openEdit = (u) => {
    setSelected(u);
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, active: u.active });
    setFormErr(''); setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); };
  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: val }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormErr('Full name is required.'); return; }
    if (!form.username.trim())  { setFormErr('Username is required.'); return; }
    if (!form.password.trim())  { setFormErr('Password is required.'); return; }
    setSaving(true); setFormErr('');
    try {
      await registerUser(form);
      showToast('User registered!');
      closeModal(); fetchUsers();
    } catch (err) { setFormErr(err.response?.data?.detail || 'Registration failed.'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!form.full_name.trim()) { setFormErr('Full name is required.'); return; }
    setSaving(true); setFormErr('');
    try {
      const payload = { full_name: form.full_name, role: form.role, active: form.active };
      if (form.password) payload.password = form.password;
      await updateUser(selected.id, payload);
      showToast('User updated!');
      closeModal(); fetchUsers();
    } catch (err) { setFormErr(err.response?.data?.detail || 'Update failed.'); }
    finally { setSaving(false); }
  };

  const handleLogout = () => { signOut(); navigate('/login'); };

  const adminCount   = users.filter(u => u.role === 'Admin').length;
  const cashierCount = users.filter(u => u.role === 'Cashier').length;
  const activeCount  = users.filter(u => u.active).length;

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown} 0%, ${B.midBrown} 50%, ${B.brown} 100%)`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>User Management</p>
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
            className="text-sm font-bold px-4 py-1.5 rounded-lg transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: '#3d1f00' }}>
            Logout
          </button>
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
                User Management
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Register and manage staff accounts — Admins and Cashiers
              </p>
            </div>
            <button onClick={openRegister}
              className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 shadow-md flex-shrink-0"
              style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
              + Register User
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: B.textLight }}>Total Users</p>
            <p className="text-3xl font-extrabold" style={{ color: B.brown }}>{users.length}</p>
          </div>
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#ede9fe', border: '1px solid #7c3aed44' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#7c3aed' }}>Admins</p>
            <p className="text-3xl font-extrabold" style={{ color: '#7c3aed' }}>{adminCount}</p>
          </div>
          <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#dbeafe', border: '1px solid #1d4ed844' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#1d4ed8' }}>Cashiers</p>
            <p className="text-3xl font-extrabold" style={{ color: '#1d4ed8' }}>{cashierCount}</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-3">👥</p>
              <p className="text-lg font-semibold" style={{ color: B.textLight }}>No users found</p>
              <p className="text-sm mt-1" style={{ color: '#bbb' }}>Click "+ Register User" to add the first account.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                    {['#', 'Full Name', 'Username', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => {
                    const rs = ROLE_STYLE[u.role] || { bg: '#f5f5f5', color: '#555' };
                    return (
                      <tr key={u.id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 text-xs" style={{ color: B.textLight }}>{u.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0"
                              style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})` }}>
                              {(u.full_name || u.username).charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold" style={{ color: B.darkBrown }}>{u.full_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: B.textLight }}>@{u.username}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: rs.bg, color: rs.color }}>{u.role}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ background: u.active ? '#dcfce7' : '#fee2e2',
                              color: u.active ? '#16a34a' : '#dc2626' }}>
                            {u.active ? '● Active' : '● Disabled'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openEdit(u)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                            style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                            Edit
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

      {/* ── Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-1" style={{ color: B.brown }}>
                {modal === 'register' ? '+ Register New User' : `Edit User — ${selected?.username}`}
              </h3>
              <p className="text-xs mb-4" style={{ color: B.textLight }}>
                {modal === 'register'
                  ? 'Fill in the details to create a new staff account.'
                  : 'Update role, name or reset the password.'}
              </p>
              {formErr && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{formErr}</div>
              )}
              <form onSubmit={modal === 'register' ? handleRegister : handleUpdate} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Full Name *</label>
                  <input type="text" name="full_name" value={form.full_name} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }} placeholder="e.g. Ravi Kumar" />
                </div>
                {modal === 'register' && (
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Username *</label>
                    <input type="text" name="username" value={form.username} onChange={handleChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="e.g. ravi_k" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                    {modal === 'register' ? 'Password *' : 'New Password (leave blank to keep current)'}
                  </label>
                  <input type="password" name="password" value={form.password} onChange={handleChange}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }}
                    placeholder={modal === 'register' ? 'Min 6 characters' : '••••••••'} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Role</label>
                  <div className="flex gap-2">
                    {ROLES.map(r => (
                      <button key={r} type="button"
                        onClick={() => setForm(f => ({ ...f, role: r }))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95"
                        style={form.role === r
                          ? { background: ROLE_STYLE[r].bg, border: `2px solid ${ROLE_STYLE[r].color}`, color: ROLE_STYLE[r].color }
                          : { background: '#f5f5f5', border: '2px solid transparent', color: '#888' }}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                {modal === 'edit' && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: '#f9f9f9', border: '1px solid #e8d5a3' }}>
                    <label className="text-xs font-bold" style={{ color: B.brown }}>Account Active</label>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                      className="ml-auto w-11 h-6 rounded-full transition-all relative flex-shrink-0"
                      style={{ background: form.active ? '#16a34a' : '#d1d5db' }}>
                      <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                        style={{ left: form.active ? '22px' : '2px' }} />
                    </button>
                    <span className="text-xs font-bold" style={{ color: form.active ? '#16a34a' : '#9ca3af' }}>
                      {form.active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                    style={{ background: '#f5f5f5', color: '#555' }}>Cancel</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                    {saving ? 'Saving…' : modal === 'register' ? 'Register User' : 'Save Changes'}
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
