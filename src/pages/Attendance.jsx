import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDesignations, getAttendance, markAttendance } from '../api/client';

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
  { value: 'present',  label: 'Present',  color: '#16a34a', bg: '#dcfce7' },
  { value: 'half_day', label: 'Half Day', color: '#d97706', bg: '#fef3c7' },
  { value: 'leave',    label: 'Leave',    color: '#7c3aed', bg: '#ede9fe' },
];

function statusMeta(val) {
  return STATUS_OPTIONS.find(s => s.value === val) || { label: val, color: '#6b7280', bg: '#f3f4f6' };
}

function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

const inr = n => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function Attendance() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [selectedDate,  setSelectedDate]  = useState(todayStr());
  const [designations,  setDesignations]  = useState([]);
  const [attendance,    setAttendance]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState({});    // empId → bool
  const [error,         setError]         = useState('');
  const [toast,         setToast]         = useState('');

  // Per-row pending state before marking:
  // { [empId]: { designation_id: '', ot_hours: '' } }
  const [rowState, setRowState] = useState({});

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(''), 2800);
  };

  const handleLogout = () => { signOut(); navigate('/login'); };

  const loadData = useCallback(async (date) => {
    setLoading(true); setError('');
    try {
      const [dRes, attRes] = await Promise.all([
        getDesignations(),
        getAttendance(date),
      ]);
      setDesignations(dRes.data.designations || []);
      const att = attRes.data.attendance || [];
      setAttendance(att);
      // Seed rowState from existing attendance rows
      const initial = {};
      att.forEach(a => {
        initial[a.employee_id] = {
          designation_id: a.designation_id ? String(a.designation_id) : '',
          ot_hours:       a.ot_hours ? String(a.ot_hours) : '',
        };
      });
      setRowState(initial);
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

  // Build rows from attendance (the GET /attendance returns all active emps)
  const rows = attendance
    .filter(a => a.employee_id)
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  // Get or init per-row state for an employee
  const getRS = (empId) => rowState[empId] || { designation_id: '', ot_hours: '' };

  const setRS = (empId, patch) =>
    setRowState(prev => ({ ...prev, [empId]: { ...getRS(empId), ...patch } }));

  const handleMark = async (empId, status, defaultDesigId) => {
    setSaving(s => ({ ...s, [empId]: true }));
    const rs = getRS(empId);
    // Use override designation if set, else use employee default
    const desigId = rs.designation_id ? parseInt(rs.designation_id) : (defaultDesigId || null);
    const otHours = parseFloat(rs.ot_hours || 0) || 0;
    // Resolve the OT rate to store on the record:
    // 1. Explicit designation ot_rate (if the active designation has one configured)
    // 2. null → backend falls back to daily_rate / 8
    const activeDesigId = rs.designation_id
      ? String(rs.designation_id)
      : String(defaultDesigId || '');
    const activeDesig = designations.find(d => String(d.id) === activeDesigId);
    const otRate = otHours > 0
      ? (activeDesig?.ot_rate != null ? parseFloat(activeDesig.ot_rate) : null)
      : null;
    try {
      await markAttendance({
        employee_id:    empId,
        att_date:       selectedDate,
        status,
        designation_id: desigId,
        ot_hours:       otHours,
        ot_rate:        otRate,
      });
      showToast('Attendance marked!');
      const attRes = await getAttendance(selectedDate);
      const att = attRes.data.attendance || [];
      setAttendance(att);
      // Keep ot_hours & designation from what we just saved
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to mark attendance.';
      showToast(msg, false);
    } finally {
      setSaving(s => ({ ...s, [empId]: false }));
    }
  };

  const isAdmin     = user?.role === 'Admin';
  const markedCount = rows.filter(r => r.status).length;

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg,${B.cream} 0%,${B.creamMid} 60%,#ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown},${B.brown})`,
          borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia,serif' }}>Crown Tea Hub</h1>
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
            className="text-sm font-semibold px-3 py-1.5 rounded-lg active:scale-95 mr-1"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Dashboard
          </button>
          <button onClick={handleLogout}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight},${B.gold},#b8860b)`, color: '#3d1f00' }}>
            Logout
          </button>
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: toast.ok === false ? '#dc2626' : '#16a34a' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header card */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg,${B.darkBrown},#5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia,serif' }}>
                Daily Attendance Register
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Mark status · override designation · log OT · {markedCount}/{rows.length} marked
              </p>
            </div>
            <input type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="rounded-xl px-4 py-2 text-sm font-semibold border-2 outline-none"
              style={{ borderColor: B.gold, background: '#fff8e7', color: B.brown }} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
            {error}
          </div>
        )}

        {/* Status legend */}
        <div className="flex flex-wrap gap-2 items-center">
          {STATUS_OPTIONS.map(s => (
            <span key={s.value} className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: s.bg, color: s.color }}>{s.label}</span>
          ))}
          <span className="text-xs ml-2" style={{ color: '#a07020' }}>
            · Set designation override &amp; OT per row before marking
          </span>
        </div>

        {/* Attendance table */}
        <div className="rounded-2xl shadow-sm overflow-hidden"
          style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
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
                  <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                    {['Emp','Name','Default Designation','Today\'s Status','Designation (override)','OT Hrs','Mark Attendance','By'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide"
                        style={{ color: B.goldLight, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp, idx) => {
                    const meta = emp.status ? statusMeta(emp.status) : null;
                    const rs   = getRS(emp.employee_id);
                    const locked = !isAdmin && !!emp.status;

                    // Determine effective designation shown on this row
                    const savedDesigId   = emp.designation_id;
                    const savedDesigName = emp.att_designation_name;
                    const defDesigName   = emp.default_designation_name;
                    const defDesigRate   = emp.default_daily_rate;
                    const defDesigId     = emp.default_designation_id;

                    // Effective rate for OT preview
                    const activeDesigId = rs.designation_id || String(savedDesigId || '') || String(defDesigId || '');
                    const activeDesig   = designations.find(d => String(d.id) === String(activeDesigId));
                    const otHours       = parseFloat(rs.ot_hours || emp.ot_hours || 0);
                    // Use designation's configured ot_rate; null means OT not set for this designation
                    const otRate        = activeDesig?.ot_rate != null ? parseFloat(activeDesig.ot_rate) : null;
                    const otPay         = otHours > 0 && otRate != null ? otHours * otRate : 0;

                    return (
                      <tr key={emp.employee_id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2',
                          borderBottom: '1px solid #f0e0c0' }}>

                        {/* Code */}
                        <td className="px-3 py-3 font-mono font-semibold text-xs" style={{ color: B.brown }}>
                          {emp.emp_code}
                        </td>

                        {/* Name */}
                        <td className="px-3 py-3 font-semibold" style={{ color: B.darkBrown }}>
                          {emp.full_name}
                        </td>

                        {/* Default Designation */}
                        <td className="px-3 py-3">
                          {defDesigName ? (
                            <div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#fef3c7', color: '#b45309' }}>
                                {defDesigName}
                              </span>
                              {defDesigRate != null && (
                                <div className="text-xs mt-0.5" style={{ color: '#a07020' }}>
                                  {inr(defDesigRate)}/day
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">—</span>
                          )}
                        </td>

                        {/* Today's Status */}
                        <td className="px-3 py-3">
                          {meta ? (
                            <div>
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                              {/* Show if designation was overridden today */}
                              {savedDesigName && savedDesigName !== defDesigName && (
                                <div className="text-xs mt-0.5 font-semibold" style={{ color: '#7c3aed' }}>
                                  as {savedDesigName}
                                </div>
                              )}
                              {parseFloat(emp.ot_hours || 0) > 0 && (
                                <div className="text-xs mt-0.5" style={{ color: '#d97706' }}>
                                  OT: {emp.ot_hours}h
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">Not marked</span>
                          )}
                        </td>

                        {/* Designation override dropdown */}
                        <td className="px-3 py-3">
                          {locked ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <select
                              value={rs.designation_id}
                              onChange={e => setRS(emp.employee_id, { designation_id: e.target.value })}
                              className="border-2 rounded-lg px-2 py-1.5 text-xs outline-none"
                              style={{ borderColor: rs.designation_id ? B.gold : '#e0e0e0',
                                background: '#fff9ee', minWidth: 140 }}>
                              <option value="">— Default ({defDesigName || 'none'}) —</option>
                              {designations.filter(d => d.active !== false).map(d => (
                                <option key={d.id} value={d.id}>
                                  {d.name} — {inr(d.daily_rate)}/day
                                </option>
                              ))}
                            </select>
                          )}
                          {rs.designation_id && !locked && (
                            <div className="text-xs mt-0.5 font-semibold" style={{ color: '#7c3aed' }}>
                              Override active
                            </div>
                          )}
                        </td>

                        {/* OT Hours */}
                        <td className="px-3 py-3">
                          {locked ? (
                            <span className="text-xs" style={{ color: parseFloat(emp.ot_hours||0) > 0 ? '#d97706' : '#9ca3af' }}>
                              {parseFloat(emp.ot_hours||0) > 0 ? `${emp.ot_hours}h` : '—'}
                            </span>
                          ) : (
                            <div>
                              <input type="number" min="0" max="12" step="0.5"
                                value={rs.ot_hours}
                                onChange={e => setRS(emp.employee_id, { ot_hours: e.target.value })}
                                placeholder="0"
                                className="border-2 rounded-lg px-2 py-1.5 text-xs outline-none text-center"
                                style={{ borderColor: parseFloat(rs.ot_hours||0) > 0 ? '#d97706' : '#e0e0e0',
                                  width: 64 }} />
                              {parseFloat(rs.ot_hours || 0) > 0 && otRate == null && (
                                <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                                  OT rate not set
                                </div>
                              )}
                              {otPay > 0 && (
                                <div className="text-xs mt-0.5 font-semibold" style={{ color: '#d97706' }}>
                                  +{inr(otPay)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Mark buttons */}
                        <td className="px-3 py-3">
                          {locked ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold px-3 py-1 rounded-full"
                                style={{ background: statusMeta(emp.status).bg, color: statusMeta(emp.status).color }}>
                                {statusMeta(emp.status).label}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-lg"
                                style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }}>
                                🔒 Locked
                              </span>
                            </div>
                          ) : (
                            <div className="flex gap-1 flex-wrap">
                              {STATUS_OPTIONS.map(s => (
                                <button key={s.value}
                                  disabled={saving[emp.employee_id]}
                                  onClick={() => handleMark(emp.employee_id, s.value, defDesigId)}
                                  className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95 disabled:opacity-50"
                                  style={{
                                    background: emp.status === s.value ? s.color : s.bg,
                                    color:      emp.status === s.value ? '#fff'  : s.color,
                                    border:     `1px solid ${s.color}`,
                                  }}>
                                  {saving[emp.employee_id] ? '…' : s.label}
                                </button>
                              ))}
                              {isAdmin && emp.status && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg self-center"
                                  style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>
                                  Admin override
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Marked by */}
                        <td className="px-3 py-3 text-xs" style={{ color: '#a07020' }}>
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
            {rows.some(r => parseFloat(r.ot_hours || 0) > 0) && (
              <div className="rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm"
                style={{ background: '#fff', border: '1px solid #fbbf24' }}>
                <span className="text-sm font-semibold" style={{ color: '#d97706' }}>OT Logged</span>
                <span className="text-lg font-extrabold" style={{ color: '#d97706' }}>
                  {rows.filter(r => parseFloat(r.ot_hours || 0) > 0).length}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
