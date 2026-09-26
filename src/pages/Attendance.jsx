import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getEmployees, getAttendance, markAttendance } from '../api/client';

// ─── Brand colours ────────────────────────────────────────────────────────────
const B = {
  darkBrown: '#2d1a0e',
  midBrown:  '#4a2c0a',
  brown:     '#3d2008',
  gold:      '#d4a017',
  goldLight: '#f5c842',
  cream:     '#fdf6e3',
  creamMid:  '#f5ead0',
};

const STATUS_OPTIONS = [
  { value: 'present',  label: 'Present',   color: '#16a34a', bg: '#dcfce7' },
  { value: 'absent',   label: 'Absent',    color: '#dc2626', bg: '#fee2e2' },
  { value: 'half_day', label: 'Half Day',  color: '#d97706', bg: '#fef3c7' },
  { value: 'leave',    label: 'Leave',     color: '#7c3aed', bg: '#ede9fe' },
];

function statusMeta(val) {
  return STATUS_OPTIONS.find(s => s.value === val) || STATUS_OPTIONS[0];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function Attendance() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [employees,    setEmployees]    = useState([]);
  const [attendance,   setAttendance]   = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState({});
  const [error,        setError]        = useState('');
  const [toast,        setToast]        = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const handleLogout = () => { signOut(); navigate('/login'); };

  const loadData = useCallback(async (date) => {
    setLoading(true); setError('');
    try {
      const [empRes, attRes] = await Promise.all([
        getEmployees(),
        getAttendance(date),
      ]);
      setEmployees(empRes.data.employees || []);
      setAttendance(attRes.data.attendance || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        signOut(); navigate('/login');
      }
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigate, signOut]);

  useEffect(() => { loadData(selectedDate); }, [selectedDate, loadData]);

  // Merge employees with their attendance status for the selected date
  const rows = employees.filter(e => e.active !== false).map(emp => {
    const att = attendance.find(a => a.employee_id === emp.id);
    return {
      ...emp,
      att_id:   att?.att_id   || null,
      status:   att?.status   || null,
      notes:    att?.notes    || '',
      marked_by: att?.marked_by || null,
    };
  });

  const handleMark = async (empId, status) => {
    setSaving(s => ({ ...s, [empId]: true }));
    try {
      await markAttendance({ employee_id: empId, att_date: selectedDate, status });
      showToast('Attendance marked!');
      // Refresh attendance for the day
      const attRes = await getAttendance(selectedDate);
      setAttendance(attRes.data.attendance || []);
    } catch (err) {
      setError('Failed to mark attendance. Please try again.');
    } finally {
      setSaving(s => ({ ...s, [empId]: false }));
    }
  };

  const markedCount = rows.filter(r => r.status).length;

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown} 0%, ${B.midBrown} 50%, ${B.brown} 100%)`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Attendance Register</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(212,160,23,0.25)', color: B.goldLight, border: '1px solid rgba(212,160,23,0.5)' }}>
            {user?.role}
          </span>
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: '#16a34a' }}>
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Header card */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B.darkBrown}, #5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                Daily Attendance Register
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Mark attendance for each employee · {markedCount}/{rows.length} marked
              </p>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="rounded-xl px-4 py-2 text-sm font-semibold border-2 outline-none"
              style={{ borderColor: B.gold, background: '#fff8e7', color: B.brown }}
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        {/* Status legend */}
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(s => (
            <span key={s.value} className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
          ))}
        </div>

        {/* Attendance table */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#a07020' }}>
              <p className="text-lg font-semibold">No active employees found.</p>
              <p className="text-sm mt-1">Ask an Admin to add employees first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                    {['Emp Code', 'Name', 'Role', 'Today\'s Status', 'Mark Attendance', 'Marked By'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp, idx) => {
                    const meta = emp.status ? statusMeta(emp.status) : null;
                    return (
                      <tr key={emp.id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: B.brown }}>{emp.emp_code}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{emp.full_name}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{emp.role}</td>
                        <td className="px-4 py-3">
                          {meta ? (
                            <span className="text-xs font-bold px-3 py-1 rounded-full"
                              style={{ background: meta.bg, color: meta.color }}>
                              {meta.label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not marked</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {STATUS_OPTIONS.map(s => (
                              <button
                                key={s.value}
                                disabled={saving[emp.id]}
                                onClick={() => handleMark(emp.id, s.value)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-50"
                                style={{
                                  background: emp.status === s.value ? s.color : s.bg,
                                  color:      emp.status === s.value ? '#fff'   : s.color,
                                  border:     `1px solid ${s.color}`,
                                  fontWeight: emp.status === s.value ? '800' : '600',
                                }}
                              >
                                {saving[emp.id] && emp.status !== s.value ? '…' : s.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#a07020' }}>
                          {emp.marked_by || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary pills */}
        {!loading && rows.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.map(s => {
              const count = rows.filter(r => r.status === s.value).length;
              return (
                <div key={s.value} className="rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm"
                  style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                  <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                  <span className="text-sm font-semibold" style={{ color: B.brown }}>{s.label}</span>
                  <span className="text-lg font-extrabold" style={{ color: s.color }}>{count}</span>
                </div>
              );
            })}
            <div className="rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm"
              style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <span className="text-sm font-semibold" style={{ color: B.brown }}>Unmarked</span>
              <span className="text-lg font-extrabold" style={{ color: '#6b7280' }}>
                {rows.filter(r => !r.status).length}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
