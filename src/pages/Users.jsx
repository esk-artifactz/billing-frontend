import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, registerUser, updateUser } from '../api/client';

const ROLES = ['Admin', 'Cashier'];
const EMPTY_FORM = { username: '', password: '', full_name: '', role: 'Cashier' };

export default function Users() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Modal state
  const [modal, setModal]         = useState(null); // null | 'register' | 'edit'
  const [selected, setSelected]   = useState(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getUsers();
      setUsers(res.data.users);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOut(); navigate('/login');
      }
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [navigate, signOut]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openRegister = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal('register');
  };

  const openEdit = (u) => {
    setSelected(u);
    setForm({ username: u.username, password: '', full_name: u.full_name, role: u.role, active: u.active });
    setFormError('');
    setModal('edit');
  };

  const closeModal = () => { setModal(null); setSelected(null); };

  const handleChange = (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [e.target.name]: val }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      await registerUser(form);
      closeModal();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      const payload = { full_name: form.full_name, role: form.role, active: form.active };
      if (form.password) payload.password = form.password;
      await updateUser(selected.id, payload);
      closeModal();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => { signOut(); navigate('/login'); };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-green-700 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-white opacity-80 hover:opacity-100 text-sm">
            ← Dashboard
          </button>
          <h1 className="text-xl font-bold">User Management</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm opacity-80">{user?.full_name} — {user?.role}</span>
          <button onClick={handleLogout} className="bg-white text-green-700 text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-gray-100">
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto mt-8 px-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-700">All Users ({users.length})</h2>
          <button
            onClick={openRegister}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg transition-colors"
          >
            + Register User
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-gray-400">Loading users...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">ID</th>
                  <th className="px-5 py-3 text-left">Full Name</th>
                  <th className="px-5 py-3 text-left">Username</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Created</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500">{u.id}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{u.full_name}</td>
                    <td className="px-5 py-3 text-gray-600">{u.username}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        u.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {u.active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-green-600 hover:text-green-800 font-medium text-sm"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-5">
              {modal === 'register' ? 'Register New User' : `Edit User — ${selected?.username}`}
            </h3>

            {formError && (
              <div className="mb-4 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={modal === 'register' ? handleRegister : handleUpdate} className="space-y-4">
              <Field label="Full Name" name="full_name" value={form.full_name} onChange={handleChange} required />

              {modal === 'register' && (
                <Field label="Username" name="username" value={form.username} onChange={handleChange} required />
              )}

              <Field
                label={modal === 'register' ? 'Password' : 'New Password (leave blank to keep)'}
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required={modal === 'register'}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>

              {modal === 'edit' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="active"
                    checked={form.active ?? true}
                    onChange={handleChange}
                    className="w-4 h-4 accent-green-600"
                  />
                  <span className="text-sm text-gray-700">Account Active</span>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving...' : modal === 'register' ? 'Register' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, name, value, onChange, type = 'text', required }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}
