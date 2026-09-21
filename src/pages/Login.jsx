import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/client';

export default function Login() {
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const [form, setForm]       = useState({ username: '', password: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(form.username, form.password);
      signIn(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 40%, #6b3f0f 70%, #3d2008 100%)' }}
    >
      {/* Decorative background circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #d4a017 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #d4a017 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #f5c842 0%, transparent 70%)' }} />
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md mx-4 rounded-3xl shadow-2xl overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 50%, #ede0c4 100%)' }}
      >
        {/* Gold top border */}
        <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)' }} />

        <div className="px-8 pt-8 pb-10">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-40 h-40 rounded-full overflow-hidden shadow-xl border-4 mb-4"
              style={{ borderColor: '#d4a017' }}>
              <img
                src="/logo.jpg"
                alt="Crown Tea Hub Logo"
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              {/* Fallback if logo not loaded */}
              <div className="w-full h-full items-center justify-center text-6xl hidden"
                style={{ background: 'linear-gradient(135deg, #f5ead0, #e8d5b0)', display: 'none' }}>
                👑
              </div>
            </div>

            <h1
              className="text-3xl font-extrabold tracking-widest uppercase text-center"
              style={{ color: '#7a4e08', fontFamily: 'Georgia, serif', letterSpacing: '0.15em' }}
            >
              Crown Tea Hub
            </h1>

            {/* Decorative divider */}
            <div className="flex items-center gap-3 my-2 w-full">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #b8860b)' }} />
              <span style={{ color: '#b8860b' }} className="text-sm">✦</span>
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #b8860b, transparent)' }} />
            </div>

            <p className="text-xs font-semibold uppercase tracking-widest text-center"
              style={{ color: '#a07020', letterSpacing: '0.2em' }}>
              Refresh · Relax · Repeat
            </p>
            <p className="text-xs font-medium mt-1 text-center" style={{ color: '#8b6914' }}>
              Bakery &amp; Café — Billing System
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 border rounded-xl px-4 py-3 text-sm font-medium text-center"
              style={{ background: '#fff0f0', borderColor: '#e57373', color: '#c62828' }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#7a4e08' }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                placeholder="Enter username"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#fff9ee',
                  border: '1.5px solid #d4a017',
                  color: '#3d2008',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.07)',
                }}
                onFocus={e => e.target.style.border = '1.5px solid #b8860b'}
                onBlur={e => e.target.style.border = '1.5px solid #d4a017'}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#7a4e08' }}>
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="Enter password"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  background: '#fff9ee',
                  border: '1.5px solid #d4a017',
                  color: '#3d2008',
                  boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.07)',
                }}
                onFocus={e => e.target.style.border = '1.5px solid #b8860b'}
                onBlur={e => e.target.style.border = '1.5px solid #d4a017'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95"
              style={{
                background: loading
                  ? '#c8a84b'
                  : 'linear-gradient(135deg, #b8860b 0%, #d4a017 40%, #f5c842 60%, #d4a017 80%, #b8860b 100%)',
                color: '#3d1f00',
                boxShadow: '0 4px 15px rgba(180, 130, 10, 0.4)',
                letterSpacing: '0.15em',
              }}
            >
              {loading ? 'Signing in...' : '👑 Sign In'}
            </button>
          </form>

          {/* Footer */}
          <div className="flex items-center gap-3 mt-6">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #c8a84b)' }} />
            <span className="text-xs" style={{ color: '#a07020' }}>Made with love, served with Crown</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #c8a84b, transparent)' }} />
          </div>
        </div>

        {/* Gold bottom border */}
        <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)' }} />
      </div>
    </div>
  );
}
