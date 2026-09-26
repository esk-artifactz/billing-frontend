import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)' }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)', borderBottom: '2px solid #d4a017' }}>
        <div className="flex items-center gap-3">
          <img
            src="/logo.jpg"
            alt="Crown Tea Hub"
            className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: '#d4a017' }}
          />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: '#f5c842', fontFamily: 'Georgia, serif' }}>
              Crown Tea Hub
            </h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Bakery &amp; Café</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>
            {user?.full_name}
          </span>
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(212,160,23,0.25)', color: '#f5c842', border: '1px solid rgba(212,160,23,0.5)' }}>
            {user?.role}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)', color: '#3d1f00' }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto mt-8 px-4 pb-10 space-y-6">

        {/* Welcome card */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #2d1a0e, #5a3510)', border: '1px solid #d4a017' }}>
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #b8860b, #f5c842, #b8860b)' }} />
          <div className="p-6 flex items-center gap-4">
            <img src="/logo.jpg" alt="logo" className="w-16 h-16 rounded-full object-cover flex-shrink-0"
              style={{ border: '2px solid #d4a017' }} />
            <div>
              <h2 className="text-2xl font-extrabold" style={{ color: '#f5c842', fontFamily: 'Georgia, serif' }}>
                Welcome, {user?.full_name}!
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#c8a84b' }}>
                Logged in as <strong style={{ color: '#f5c842' }}>{user?.role}</strong> — Made with love, served with Crown
              </p>
            </div>
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <InfoCard label="Username"  value={user?.username} />
          <InfoCard label="Full Name" value={user?.full_name} />
          <InfoCard label="Role"      value={user?.role} highlight />
        </div>

        {/* Quick actions for everyone */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ActionCard>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#7a4e08' }}>Point of Sale</h3>
                <p className="text-sm" style={{ color: '#a07020' }}>Open billing to start a sale</p>
              </div>
              <button
                onClick={() => navigate('/billing')}
                className="font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-md w-full"
                style={{ background: 'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)', color: '#3d1f00' }}
              >
                Open Billing
              </button>
            </div>
          </ActionCard>
          <ActionCard>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#7a4e08' }}>Credit Bills</h3>
                <p className="text-sm" style={{ color: '#a07020' }}>Manage customer credit &amp; dues</p>
              </div>
              <button
                onClick={() => navigate('/credit-bills')}
                className="font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-md w-full"
                style={{ background: 'linear-gradient(135deg, #8b0000, #c62828, #e57373, #c62828, #8b0000)', color: '#fff' }}
              >
                Credit Bills
              </button>
            </div>
          </ActionCard>
          <ActionCard>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-base font-bold" style={{ color: '#7a4e08' }}>Attendance</h3>
                <p className="text-sm" style={{ color: '#a07020' }}>Mark daily employee attendance</p>
              </div>
              <button
                onClick={() => navigate('/attendance')}
                className="font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-md w-full"
                style={{ background: 'linear-gradient(135deg, #1a5276, #2980b9, #5dade2, #2980b9, #1a5276)', color: '#fff' }}
              >
                Mark Attendance
              </button>
            </div>
          </ActionCard>
          {user?.role === 'Admin' && (
            <ActionCard>
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="text-base font-bold" style={{ color: '#7a4e08' }}>Sales Report</h3>
                  <p className="text-sm" style={{ color: '#a07020' }}>Items sold by category</p>
                </div>
                <button
                  onClick={() => navigate('/sales-report')}
                  className="font-bold px-5 py-2.5 rounded-xl text-sm uppercase tracking-widest transition-all active:scale-95 shadow-md w-full"
                  style={{ background: 'linear-gradient(135deg, #3d2008, #7a4e08, #a07020)', color: '#f5c842' }}
                >
                  View Report
                </button>
              </div>
            </ActionCard>
          )}
        </div>

        {/* Admin actions */}
        {user?.role === 'Admin' && (
          <ActionCard title="Admin Actions">
            <div className="flex flex-wrap gap-3">
              <NavBtn onClick={() => navigate('/users')} color="#5c3d9e">Manage Users</NavBtn>
              <NavBtn onClick={() => navigate('/categories')} color="#7b3fa0">Manage Categories</NavBtn>
              <NavBtn onClick={() => navigate('/products')} color="#1e6fa8">Manage Products</NavBtn>
              <NavBtn onClick={() => navigate('/stock-alerts')} color="#c62828">Stock Alerts</NavBtn>
              <NavBtn onClick={() => navigate('/attendance-report')} color="#0d6e4a">HR &amp; Salary Report</NavBtn>
              <NavBtn onClick={() => navigate('/suppliers')} color="#7b3fa0">Manage Suppliers</NavBtn>
              <NavBtn onClick={() => navigate('/purchase-order')} color="#b8500a">Create Purchase Order</NavBtn>
              <NavBtn onClick={() => navigate('/receive-stock')} color="#1a6e3a">Receive Stock</NavBtn>
              <NavBtn onClick={() => navigate('/daily-expenses')} color="#b45309">Daily Expenses</NavBtn>
              <NavBtn onClick={() => navigate('/expense-categories')} color="#92400e">Expense Report</NavBtn>
              <NavBtn onClick={() => navigate('/contacts')} color="#4f6d7a">Contact Book</NavBtn>
              <NavBtn onClick={() => navigate('/sales-history')} color="#2d6a4f">Bill History</NavBtn>
            </div>
          </ActionCard>
        )}

        {/* Cashier quick actions */}
        {user?.role === 'Cashier' && (
          <ActionCard title="Quick Actions">
            <div className="flex flex-wrap gap-3">
              <NavBtn onClick={() => navigate('/categories')} color="#7b3fa0">View Categories</NavBtn>
              <NavBtn onClick={() => navigate('/products')} color="#1e6fa8">View Products</NavBtn>
              <NavBtn onClick={() => navigate('/stock-alerts')} color="#c62828">Stock Alerts</NavBtn>
              <NavBtn onClick={() => navigate('/purchase-order')} color="#b8500a">Create Purchase Order</NavBtn>
              <NavBtn onClick={() => navigate('/receive-stock')} color="#1a6e3a">Receive Stock</NavBtn>
              <NavBtn onClick={() => navigate('/daily-expenses')} color="#b45309">Daily Expenses</NavBtn>
              <NavBtn onClick={() => navigate('/contacts')} color="#4f6d7a">Contact Book</NavBtn>
              <NavBtn onClick={() => navigate('/sales-history')} color="#2d6a4f">Bill History</NavBtn>
              <NavBtn onClick={() => navigate('/attendance')} color="#1a5276">Mark Attendance</NavBtn>
            </div>
          </ActionCard>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value, highlight }) {
  return (
    <div className="rounded-2xl shadow-sm p-5" style={{ background: 'white', border: '1px solid #e8d5a3' }}>
      <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#a07020' }}>{label}</p>
      <p className="text-lg font-bold" style={{ color: highlight ? '#b8860b' : '#3d2008' }}>
        {value || '—'}
      </p>
    </div>
  );
}

function ActionCard({ title, children }) {
  return (
    <div className="rounded-2xl shadow-sm p-6" style={{ background: 'white', border: '1px solid #e8d5a3' }}>
      {title && (
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-base font-bold" style={{ color: '#7a4e08' }}>{title}</h3>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #d4a017, transparent)' }} />
        </div>
      )}
      {children}
    </div>
  );
}

function NavBtn({ onClick, color, children }) {
  return (
    <button
      onClick={onClick}
      className="font-semibold px-5 py-2.5 rounded-xl text-sm transition-all active:scale-95 text-white shadow-sm"
      style={{ background: color }}
    >
      {children}
    </button>
  );
}
