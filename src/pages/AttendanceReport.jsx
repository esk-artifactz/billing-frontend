import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getEmployees, createEmployee, updateEmployee,
  getAttendanceReport, markSalaryPaid, listSalaryPayments,
  giveAdvance, listAdvances,
} from '../api/client';

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

const STATUS_META = {
  present:  { label: 'Present',  color: '#16a34a', bg: '#dcfce7' },
  absent:   { label: 'Absent',   color: '#dc2626', bg: '#fee2e2' },
  half_day: { label: 'Half Day', color: '#d97706', bg: '#fef3c7' },
  leave:    { label: 'Leave',    color: '#7c3aed', bg: '#ede9fe' },
};

const EMPTY_EMP = { emp_code: '', full_name: '', phone: '', role: 'Staff', daily_rate: '', join_date: '' };

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function inr(n) {
  return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// ─── Payments/Advances detail drawer ─────────────────────────────────────────
function PaymentsDrawer({ empName, month, payments, advances, onClose }) {
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount_paid), 0);
  const totalAdv  = advances.reduce((s, a) => s + parseFloat(a.amount), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(45,26,14,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
        <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
        <div className="p-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-extrabold" style={{ color: B.brown }}>{empName}</h3>
            <p className="text-xs" style={{ color: '#a07020' }}>{monthLabel(month)} — Transaction History</p>
          </div>
          <button onClick={onClose} className="text-2xl leading-none font-bold" style={{ color: '#a07020' }}>×</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-5 space-y-4">
          {/* Advances */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>
              Advances Given — {inr(totalAdv)}
            </p>
            {advances.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No advances this month</p>
            ) : (
              <div className="space-y-1">
                {advances.map((a, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                    style={{ background: '#ede9fe' }}>
                    <span style={{ color: '#5b21b6' }}>{a.given_on?.slice(0,10)} — {a.notes || 'Advance'}</span>
                    <span className="font-bold" style={{ color: '#7c3aed' }}>{inr(a.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Salary payments */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#16a34a' }}>
              Salary Payments — {inr(totalPaid)}
            </p>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No salary payments this month</p>
            ) : (
              <div className="space-y-1">
                {payments.map((p, i) => (
                  <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                    style={{ background: '#dcfce7' }}>
                    <span style={{ color: '#166534' }}>
                      {p.paid_at?.slice(0,10)} — {p.notes || p.payment_type}
                    </span>
                    <span className="font-bold" style={{ color: '#16a34a' }}>{inr(p.amount_paid)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceReport() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState('report'); // 'report' | 'employees'

  // ── Monthly Report ────────────────────────────────────────────────────────
  const [month,   setMonth]   = useState(currentMonth());
  const [report,  setReport]  = useState([]);
  const [rLoading, setRLoading] = useState(false);
  const [rError,   setRError]   = useState('');

  // ── Employees ─────────────────────────────────────────────────────────────
  const [employees,  setEmployees]  = useState([]);
  const [eLoading,   setELoading]   = useState(false);
  const [empModal,   setEmpModal]   = useState(null); // null | 'add' | 'edit'
  const [empForm,    setEmpForm]    = useState(EMPTY_EMP);
  const [editEmpId,  setEditEmpId]  = useState(null);
  const [empSaving,  setEmpSaving]  = useState(false);
  const [empError,   setEmpError]   = useState('');

  // ── Pay modal ─────────────────────────────────────────────────────────────
  const [payModal,   setPayModal]   = useState(null);
  const [payAmount,  setPayAmount]  = useState('');
  const [payNotes,   setPayNotes]   = useState('');
  const [paySaving,  setPaySaving]  = useState(false);
  const [payError,   setPayError]   = useState('');

  // ── Advance modal ─────────────────────────────────────────────────────────
  const [advModal,   setAdvModal]   = useState(null);
  const [advAmount,  setAdvAmount]  = useState('');
  const [advNotes,   setAdvNotes]   = useState('');
  const [advDate,    setAdvDate]    = useState('');
  const [advSaving,  setAdvSaving]  = useState(false);
  const [advError,   setAdvError]   = useState('');

  // ── History drawer ────────────────────────────────────────────────────────
  const [drawer,         setDrawer]         = useState(null); // { empName, empId }
  const [drawerPayments, setDrawerPayments] = useState([]);
  const [drawerAdvances, setDrawerAdvances] = useState([]);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

  const handleLogout = () => { signOut(); navigate('/login'); };

  // ── Load report ────────────────────────────────────────────────────────────
  const loadReport = useCallback(async (m) => {
    setRLoading(true); setRError('');
    try {
      const res = await getAttendanceReport(m);
      setReport(res.data.report || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setRError('Failed to load report.');
    } finally { setRLoading(false); }
  }, [navigate, signOut]);

  const loadEmployees = useCallback(async () => {
    setELoading(true);
    try { setEmployees((await getEmployees()).data.employees || []); }
    catch { /* silent */ }
    finally { setELoading(false); }
  }, []);

  useEffect(() => { loadReport(month); }, [month, loadReport]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // ── Employee form ─────────────────────────────────────────────────────────
  const openAddEmp  = () => { setEmpForm(EMPTY_EMP); setEmpError(''); setEditEmpId(null); setEmpModal('add'); };
  const openEditEmp = (emp) => {
    setEmpForm({ emp_code: emp.emp_code, full_name: emp.full_name, phone: emp.phone || '',
      role: emp.role, daily_rate: emp.daily_rate, join_date: emp.join_date?.slice(0,10) || '' });
    setEditEmpId(emp.id); setEmpError(''); setEmpModal('edit');
  };
  const closeEmpModal = () => { setEmpModal(null); setEditEmpId(null); };
  const handleEmpChange = (e) => setEmpForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    if (!empForm.full_name.trim() || !empForm.emp_code.trim()) { setEmpError('Employee Code and Full Name are required.'); return; }
    setEmpSaving(true); setEmpError('');
    try {
      const payload = { ...empForm, daily_rate: parseFloat(empForm.daily_rate) || 0 };
      if (empModal === 'add') { await createEmployee(payload); showToast('Employee added!'); }
      else { await updateEmployee(editEmpId, payload); showToast('Employee updated!'); }
      closeEmpModal(); loadEmployees();
    } catch (err) { setEmpError(err.response?.data?.detail || 'Failed to save.'); }
    finally { setEmpSaving(false); }
  };
  const handleDeactivate = async (emp) => {
    try { await updateEmployee(emp.id, { active: !emp.active }); showToast(emp.active ? 'Deactivated.' : 'Activated.'); loadEmployees(); }
    catch { showToast('Failed.', false); }
  };

  // ── Pay modal ─────────────────────────────────────────────────────────────
  const openPayModal = (row) => {
    setPayModal({ employee_id: row.employee_id, full_name: row.full_name, balance: row.balance_due });
    setPayAmount(row.balance_due > 0 ? String(row.balance_due) : '');
    setPayNotes(''); setPayError('');
  };
  const handlePaySubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount.'); return; }
    setPaySaving(true); setPayError('');
    try {
      await markSalaryPaid({ employee_id: payModal.employee_id, pay_month: month, amount_paid: amount, notes: payNotes });
      showToast('Payment recorded!');
      setPayModal(null); loadReport(month);
    } catch (err) { setPayError(err.response?.data?.detail || 'Failed.'); }
    finally { setPaySaving(false); }
  };

  // ── Advance modal ─────────────────────────────────────────────────────────
  const openAdvModal = (row) => {
    setAdvModal({ employee_id: row.employee_id, full_name: row.full_name });
    setAdvAmount(''); setAdvNotes(''); setAdvDate(''); setAdvError('');
  };
  const handleAdvSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(advAmount);
    if (!amount || amount <= 0) { setAdvError('Enter a valid amount.'); return; }
    setAdvSaving(true); setAdvError('');
    try {
      await giveAdvance({ employee_id: advModal.employee_id, amount, given_on: advDate || undefined, notes: advNotes });
      showToast('Advance recorded!');
      setAdvModal(null); loadReport(month);
    } catch (err) { setAdvError(err.response?.data?.detail || 'Failed.'); }
    finally { setAdvSaving(false); }
  };

  // ── History drawer ────────────────────────────────────────────────────────
  const openDrawer = async (row) => {
    setDrawer({ empName: row.full_name, empId: row.employee_id });
    try {
      const [p, a] = await Promise.all([
        listSalaryPayments(row.employee_id, month),
        listAdvances(row.employee_id, month),
      ]);
      setDrawerPayments(p.data.payments || []);
      setDrawerAdvances(a.data.advances || []);
    } catch { setDrawerPayments([]); setDrawerAdvances([]); }
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalEarned  = report.reduce((s, r) => s + r.gross_earned,    0);
  const totalPaid    = report.reduce((s, r) => s + r.total_paid,      0);
  const totalAdv     = report.reduce((s, r) => s + r.total_advance,   0);
  const totalBalance = report.reduce((s, r) => s + r.balance_due,     0);

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
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Attendance &amp; HR</p>
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

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B.darkBrown}, #5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
          <div className="p-5">
            <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
              Attendance &amp; HR Management
            </h2>
            <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
              Daily salary · advances · flexible payouts · employee onboarding
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {[
            { key: 'report',    label: 'Monthly Report & Salary' },
            { key: 'employees', label: 'Employee Management' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={{ background: tab === t.key ? B.gold : '#fff', color: tab === t.key ? B.darkBrown : '#7a4e08',
                border: `2px solid ${tab === t.key ? B.gold : '#e8d5a3'}` }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ━━━━━━━━━ Monthly Report Tab ━━━━━━━━━ */}
        {tab === 'report' && (
          <div className="space-y-4">
            {/* Month picker + summary totals */}
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-bold" style={{ color: B.brown }}>Month:</label>
                  <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm font-semibold border-2 outline-none"
                    style={{ borderColor: B.gold, background: '#fff8e7', color: B.brown }} />
                </div>
                <div className="flex flex-wrap gap-3 ml-auto">
                  {[
                    { label: 'Gross Earned', value: totalEarned, color: '#1d4ed8', bg: '#dbeafe' },
                    { label: 'Advances',     value: totalAdv,    color: '#7c3aed', bg: '#ede9fe' },
                    { label: 'Paid Out',     value: totalPaid,   color: '#16a34a', bg: '#dcfce7' },
                    { label: 'Balance Due',  value: totalBalance, color: totalBalance > 0 ? '#dc2626' : '#6b7280', bg: totalBalance > 0 ? '#fee2e2' : '#f3f4f6' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background: s.bg, border: `1px solid ${s.color}30` }}>
                      <p className="text-xs font-bold" style={{ color: s.color }}>{s.label}</p>
                      <p className="text-base font-extrabold" style={{ color: s.color }}>{inr(s.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {rError && (
              <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>
                {rError}
              </div>
            )}

            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              {rLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 rounded-full border-4 animate-spin"
                    style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : report.length === 0 ? (
                <div className="text-center py-16" style={{ color: '#a07020' }}>
                  <p className="text-lg font-semibold">No data for {monthLabel(month)}</p>
                  <p className="text-sm mt-1">Add employees and mark attendance first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                        {['Employee', 'Daily Rate', 'P', 'A', 'H', 'L', 'Eff. Days', 'Gross', 'Advances', 'Paid', 'Balance', 'Actions'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((row, idx) => (
                        <tr key={row.employee_id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold" style={{ color: B.darkBrown }}>{row.full_name}</div>
                            <div className="text-xs font-mono text-gray-400">{row.emp_code}</div>
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: B.brown }}>
                            {inr(row.daily_rate)}/day
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_META.present.bg, color: STATUS_META.present.color }}>{row.present_days}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_META.absent.bg, color: STATUS_META.absent.color }}>{row.absent_days}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_META.half_day.bg, color: STATUS_META.half_day.color }}>{row.half_days}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: STATUS_META.leave.bg, color: STATUS_META.leave.color }}>{row.leave_days}</span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-center" style={{ color: B.brown }}>{row.effective_days}</td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap" style={{ color: '#1d4ed8' }}>{inr(row.gross_earned)}</td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#7c3aed' }}>{inr(row.total_advance)}</td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#16a34a' }}>{inr(row.total_paid)}</td>
                          <td className="px-3 py-3 font-extrabold whitespace-nowrap"
                            style={{ color: row.balance_due > 0 ? '#dc2626' : row.balance_due < 0 ? '#7c3aed' : '#6b7280' }}>
                            {inr(row.balance_due)}
                            {row.balance_due < 0 && <span className="text-xs font-normal ml-1">(overpaid)</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => openPayModal(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95"
                                style={{ background: '#dcfce7', color: '#16a34a' }}>
                                Pay
                              </button>
                              <button onClick={() => openAdvModal(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95"
                                style={{ background: '#ede9fe', color: '#7c3aed' }}>
                                Advance
                              </button>
                              <button onClick={() => openDrawer(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95"
                                style={{ background: '#f3f4f6', color: '#374151' }}>
                                History
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

            <p className="text-xs px-1" style={{ color: '#a07020' }}>
              P = Present · A = Absent · H = Half Day · L = Leave (paid) · Effective days = P + L + H×0.5 · Gross = Daily Rate × Effective days · Balance = Gross − Advances − Paid · <strong>Policy: Each employee is entitled to 1 day off per month (mark as Absent — no extra deduction needed)</strong>
            </p>
          </div>
        )}

        {/* ━━━━━━━━━ Employee Management Tab ━━━━━━━━━ */}
        {tab === 'employees' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold" style={{ color: B.brown }}>All Employees ({employees.length})</h3>
              <button onClick={openAddEmp}
                className="font-bold px-5 py-2 rounded-xl text-sm transition-all active:scale-95 shadow-md"
                style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
                + Onboard Employee
              </button>
            </div>
            <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              {eLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-16" style={{ color: '#a07020' }}>
                  <p className="text-lg font-semibold">No employees yet.</p>
                  <p className="text-sm mt-1">Click "+ Onboard Employee" to add the first employee.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                        {['Code', 'Name', 'Role', 'Phone', 'Daily Rate', 'Join Date', 'Status', 'Actions'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp, idx) => (
                        <tr key={emp.id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                            opacity: emp.active === false ? 0.6 : 1 }}>
                          <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: B.brown }}>{emp.emp_code}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{emp.full_name}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{emp.role}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{emp.phone || '—'}</td>
                          <td className="px-4 py-3 font-semibold" style={{ color: '#16a34a' }}>
                            {inr(emp.daily_rate)}/day
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{emp.join_date?.slice(0,10) || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-1 rounded-full"
                              style={{ background: emp.active !== false ? '#dcfce7' : '#fee2e2',
                                color: emp.active !== false ? '#16a34a' : '#dc2626' }}>
                              {emp.active !== false ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openEditEmp(emp)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                                Edit
                              </button>
                              <button onClick={() => handleDeactivate(emp)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                style={{ background: emp.active !== false ? '#fee2e2' : '#dcfce7',
                                  color: emp.active !== false ? '#dc2626' : '#16a34a' }}>
                                {emp.active !== false ? 'Deactivate' : 'Activate'}
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
        )}
      </div>

      {/* ━━━━━━━━━ Employee Modal ━━━━━━━━━ */}
      {empModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {empModal === 'add' ? '+ Onboard New Employee' : 'Edit Employee'}
              </h3>
              {empError && <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{empError}</div>}
              <form onSubmit={handleEmpSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Emp Code *</label>
                    <input name="emp_code" value={empForm.emp_code} onChange={handleEmpChange}
                      disabled={empModal === 'edit'}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3', background: empModal === 'edit' ? '#f5f5f5' : '#fff' }}
                      placeholder="EMP001" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Full Name *</label>
                    <input name="full_name" value={empForm.full_name} onChange={handleEmpChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="John Doe" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Phone</label>
                    <input name="phone" value={empForm.phone} onChange={handleEmpChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Role / Designation</label>
                    <input name="role" value={empForm.role} onChange={handleEmpChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="Cashier / Staff" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Daily Rate (₹/day)</label>
                    <input name="daily_rate" type="number" min="0" step="0.01" value={empForm.daily_rate} onChange={handleEmpChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} placeholder="500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Join Date</label>
                    <input name="join_date" type="date" value={empForm.join_date} onChange={handleEmpChange}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#e8d5a3' }} />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeEmpModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={empSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
                    {empSaving ? 'Saving…' : empModal === 'add' ? 'Add Employee' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━ Pay Modal ━━━━━━━━━ */}
      {payModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-1" style={{ color: B.brown }}>Record Salary Payment</h3>
              <p className="text-sm mb-4" style={{ color: '#a07020' }}>
                {payModal.full_name} · {monthLabel(month)}
                {payModal.balance > 0 && <span className="ml-2 font-semibold" style={{ color: '#dc2626' }}>Balance due: {inr(payModal.balance)}</span>}
              </p>
              {payError && <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{payError}</div>}
              <form onSubmit={handlePaySubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Amount (₹)</label>
                  <input type="number" min="1" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={{ borderColor: B.gold }} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes (optional)</label>
                  <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#e8d5a3' }} placeholder="Weekly pay / Bank transfer…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPayModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={paySaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: '#16a34a', color: '#fff' }}>
                    {paySaving ? 'Saving…' : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━ Advance Modal ━━━━━━━━━ */}
      {advModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid #7c3aed` }}>
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed)' }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-1" style={{ color: '#5b21b6' }}>Give Advance</h3>
              <p className="text-sm mb-4" style={{ color: '#7c3aed' }}>{advModal.full_name}</p>
              {advError && <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{advError}</div>}
              <form onSubmit={handleAdvSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: '#5b21b6' }}>Amount (₹)</label>
                    <input type="number" min="1" step="0.01" value={advAmount} onChange={e => setAdvAmount(e.target.value)}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={{ borderColor: '#7c3aed' }} />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: '#5b21b6' }}>Date</label>
                    <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)}
                      className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={{ borderColor: '#c4b5fd' }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: '#5b21b6' }}>Notes (optional)</label>
                  <input type="text" value={advNotes} onChange={e => setAdvNotes(e.target.value)}
                    className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ borderColor: '#c4b5fd' }} placeholder="Festival advance / Emergency…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setAdvModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={advSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                    style={{ background: '#7c3aed', color: '#fff' }}>
                    {advSaving ? 'Saving…' : 'Record Advance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━ History Drawer ━━━━━━━━━ */}
      {drawer && (
        <PaymentsDrawer
          empName={drawer.empName}
          month={month}
          payments={drawerPayments}
          advances={drawerAdvances}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
