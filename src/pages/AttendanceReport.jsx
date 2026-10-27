import { useState, useEffect, useCallback } from 'react';
import { useEscClose } from '../hooks/useEscClose';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getDesignations, createDesignation, updateDesignation, deleteDesignation,
  getEmployees, createEmployee, updateEmployee,
  getAttendanceReport, getAttendanceDetail, markSalaryPaid, listSalaryPayments,
  giveAdvance, listAdvances,
  updateSalaryPayment, deleteSalaryPayment, updateAdvance, deleteAdvance,
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
  goldGrad:  'linear-gradient(135deg,#b8860b,#d4a017,#f5c842,#d4a017,#b8860b)',
  navGrad:   'linear-gradient(135deg,#2d1a0e,#4a2c0a,#3d2008)',
};

const STATUS_META = {
  present:  { label: 'Present',  color: '#16a34a', bg: '#dcfce7' },
  absent:   { label: 'Absent',   color: '#dc2626', bg: '#fee2e2' },
  half_day: { label: 'Half Day', color: '#d97706', bg: '#fef3c7' },
  leave:    { label: 'Leave',    color: '#7c3aed', bg: '#ede9fe' },
};

const EMPTY_EMP   = { emp_code: '', full_name: '', phone: '', role: 'Staff', default_designation_id: '', designation_effective_from: '', join_date: '' };
const EMPTY_DESIG = { name: '', daily_rate: '', ot_rate: '', description: '' };

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

const inpCls = 'w-full border-2 rounded-xl px-3 py-2 text-sm outline-none';
const inpSty = { borderColor: '#e8d5a3' };

// ─── Payments/Advances detail drawer ─────────────────────────────────────────
function PaymentsDrawer({ empName, month, payments, advances, onClose, onChanged, showToast }) {
  const [editing, setEditing] = useState(null);
  const [busy,    setBusy]    = useState(null);

  const totalPaid = payments.reduce((s, p) => s + parseFloat(p.amount_paid), 0);
  const totalAdv  = advances.reduce((s, a) => s + parseFloat(a.amount), 0);

  const startEdit = (type, row) => setEditing({
    type,
    id:     row.id,
    amount: type === 'pay' ? row.amount_paid : row.amount,
    notes:  row.notes || '',
    date:   row.given_on ? String(row.given_on).slice(0, 10) : '',
  });

  const saveEdit = async () => {
    const amt = parseFloat(editing.amount);
    if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', false); return; }
    setBusy(editing.id);
    try {
      if (editing.type === 'pay')
        await updateSalaryPayment(editing.id, { amount_paid: amt, notes: editing.notes || null });
      else
        await updateAdvance(editing.id, { amount: amt, notes: editing.notes || null, given_on: editing.date || undefined });
      showToast('Updated!'); setEditing(null); onChanged();
    } catch (err) { showToast(err.response?.data?.detail || 'Update failed', false); }
    finally { setBusy(null); }
  };

  const removeRow = async (type, row) => {
    const amt = type === 'pay' ? row.amount_paid : row.amount;
    if (!window.confirm(`Delete this ${type === 'pay' ? 'salary payment' : 'advance'} of ${inr(amt)}?`)) return;
    setBusy(row.id);
    try {
      if (type === 'pay') await deleteSalaryPayment(row.id);
      else await deleteAdvance(row.id);
      showToast('Deleted.'); onChanged();
    } catch (err) { showToast(err.response?.data?.detail || 'Delete failed', false); }
    finally { setBusy(null); }
  };

  const editForm = (key) => (
    <div key={key} className="px-3 py-2 rounded-lg space-y-2" style={{ background: '#fff', border: `1px solid ${B.gold}` }}>
      <div className="flex gap-2">
        <input type="number" step="0.01" min="0.01" value={editing.amount}
          onChange={e => setEditing(s => ({ ...s, amount: e.target.value }))}
          placeholder="Amount" autoFocus
          className="w-28 border-2 rounded-lg px-2 py-1 text-sm outline-none" style={{ borderColor: B.gold }} />
        <input type="text" value={editing.notes}
          onChange={e => setEditing(s => ({ ...s, notes: e.target.value }))}
          placeholder="Note (optional)"
          className="flex-1 border-2 rounded-lg px-2 py-1 text-sm outline-none" style={{ borderColor: '#e8d5a3' }} />
      </div>
      {editing.type === 'adv' && (
        <input type="date" value={editing.date}
          onChange={e => setEditing(s => ({ ...s, date: e.target.value }))}
          className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={{ borderColor: '#e8d5a3' }} />
      )}
      <div className="flex gap-2">
        <button onClick={saveEdit} disabled={busy === editing.id}
          className="text-xs font-bold px-3 py-1 rounded-lg disabled:opacity-50"
          style={{ background: '#dcfce7', color: '#16a34a' }}>
          {busy === editing.id ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => setEditing(null)}
          className="text-xs font-bold px-3 py-1 rounded-lg" style={{ background: '#f3f4f6', color: '#6b7280' }}>Cancel</button>
      </div>
    </div>
  );

  const actionBtns = (type, row) => (
    <span className="flex gap-1 ml-2 flex-shrink-0">
      <button onClick={() => startEdit(type, row)} disabled={busy === row.id}
        className="text-xs font-bold px-2 py-0.5 rounded-lg disabled:opacity-40"
        style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
      <button onClick={() => removeRow(type, row)} disabled={busy === row.id}
        className="text-xs font-bold px-2 py-0.5 rounded-lg disabled:opacity-40"
        style={{ background: '#fee2e2', color: '#dc2626' }}>
        {busy === row.id ? '…' : 'Del'}
      </button>
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(45,26,14,0.6)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
        <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
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
                {advances.map(a => (
                  editing?.type === 'adv' && editing.id === a.id ? editForm(`adv-${a.id}`) : (
                    <div key={a.id} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                      style={{ background: '#ede9fe' }}>
                      <span style={{ color: '#5b21b6' }}>{a.given_on?.slice(0,10)} — {a.notes || 'Advance'}</span>
                      <span className="flex items-center">
                        <span className="font-bold" style={{ color: '#7c3aed' }}>{inr(a.amount)}</span>
                        {actionBtns('adv', a)}
                      </span>
                    </div>
                  )
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
                {payments.map(p => {
                  const fromExpense = p.source === 'daily_expense';
                  return editing?.type === 'pay' && editing.id === p.id ? editForm(`pay-${p.id}`) : (
                    <div key={p.id} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                      style={{ background: '#dcfce7' }}>
                      <span style={{ color: '#166534' }}>
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : ''} — {p.notes || p.payment_type}
                        {fromExpense && (
                          <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded"
                            style={{ background: '#fef3c7', color: '#b45309' }}>via Expenses</span>
                        )}
                      </span>
                      <span className="flex items-center">
                        <span className="font-bold" style={{ color: '#16a34a' }}>{inr(p.amount_paid)}</span>
                        {!fromExpense && actionBtns('pay', p)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AttendanceReport() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // tab: 'report' | 'employees' | 'designations'
  const [tab, setTab] = useState('report');

  // ── Monthly Report ────────────────────────────────────────────────────────
  const [month,    setMonth]    = useState(currentMonth());
  const [report,   setReport]   = useState([]);
  const [rLoading, setRLoading] = useState(false);
  const [rError,   setRError]   = useState('');

  // ── Designations ──────────────────────────────────────────────────────────
  const [designations,  setDesignations]  = useState([]);
  const [dLoading,      setDLoading]      = useState(false);
  const [desigModal,    setDesigModal]    = useState(null); // null | 'add' | 'edit'
  const [desigForm,     setDesigForm]     = useState(EMPTY_DESIG);
  const [editDesigId,   setEditDesigId]   = useState(null);
  const [desigSaving,   setDesigSaving]   = useState(false);
  const [desigError,    setDesigError]    = useState('');

  // ── Employees ─────────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([]);
  const [eLoading,  setELoading]  = useState(false);
  const [empModal,  setEmpModal]  = useState(null); // null | 'add' | 'edit'
  const [empForm,   setEmpForm]   = useState(EMPTY_EMP);
  const [editEmpId, setEditEmpId] = useState(null);
  const [empSaving, setEmpSaving] = useState(false);
  const [empError,  setEmpError]  = useState('');

  // ── Pay modal ─────────────────────────────────────────────────────────────
  const [payModal,  setPayModal]  = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes,  setPayNotes]  = useState('');
  const [paySaving, setPaySaving] = useState(false);
  const [payError,  setPayError]  = useState('');

  // ── Advance modal ─────────────────────────────────────────────────────────
  const [advModal,  setAdvModal]  = useState(null);
  const [advAmount, setAdvAmount] = useState('');
  const [advNotes,  setAdvNotes]  = useState('');
  const [advDate,   setAdvDate]   = useState('');
  const [advSaving, setAdvSaving] = useState(false);
  const [advError,  setAdvError]  = useState('');

  // ── History drawer ────────────────────────────────────────────────────────
  const [drawer,         setDrawer]         = useState(null);
  const [drawerPayments, setDrawerPayments] = useState([]);
  const [drawerAdvances, setDrawerAdvances] = useState([]);

  // ── Per-day detail popup ──────────────────────────────────────────────────
  const [detailModal,    setDetailModal]    = useState(null); // { employee_id, full_name }
  const [detailDays,     setDetailDays]     = useState([]);
  const [detailPayments, setDetailPayments] = useState([]);   // salary_payments
  const [detailExpPay,   setDetailExpPay]   = useState([]);   // paid via daily_expenses
  const [detailAdvances, setDetailAdvances] = useState([]);
  const [detailSummary,  setDetailSummary]  = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 2800); };

  // ── Esc close hooks ───────────────────────────────────────────────────────
  useEscClose(() => { setEmpModal(null); setEditEmpId(null); },   !!empModal);
  useEscClose(() => setPayModal(null),   !!payModal);
  useEscClose(() => setAdvModal(null),   !!advModal);
  useEscClose(() => setDrawer(null),     !!drawer);
  useEscClose(() => setDetailModal(null), !!detailModal);
  useEscClose(() => { setDesigModal(null); setEditDesigId(null); }, !!desigModal);

  // ── Load designations ─────────────────────────────────────────────────────
  const loadDesignations = useCallback(async () => {
    setDLoading(true);
    try { setDesignations((await getDesignations()).data.designations || []); }
    catch { /* silent */ }
    finally { setDLoading(false); }
  }, []);

  // ── Load report ────────────────────────────────────────────────────────────
  const loadReport = useCallback(async (m) => {
    setRLoading(true); setRError('');
    try { setReport((await getAttendanceReport(m)).data.report || []); }
    catch (err) {
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
  useEffect(() => { loadEmployees(); loadDesignations(); }, [loadEmployees, loadDesignations]);

  // ── Designation form ──────────────────────────────────────────────────────
  const openAddDesig  = () => { setDesigForm(EMPTY_DESIG); setDesigError(''); setEditDesigId(null); setDesigModal('add'); };
  const openEditDesig = (d) => {
    setDesigForm({ name: d.name, daily_rate: d.daily_rate, ot_rate: d.ot_rate ?? '', description: d.description || '' });
    setEditDesigId(d.id); setDesigError(''); setDesigModal('edit');
  };
  const handleDesigSubmit = async (e) => {
    e.preventDefault();
    if (!desigForm.name.trim()) { setDesigError('Name is required.'); return; }
    if (!desigForm.daily_rate || parseFloat(desigForm.daily_rate) < 0) { setDesigError('Enter a valid daily rate.'); return; }
    setDesigSaving(true); setDesigError('');
    try {
      const payload = {
        name:        desigForm.name.trim(),
        daily_rate:  parseFloat(desigForm.daily_rate),
        ot_rate:     desigForm.ot_rate !== '' ? parseFloat(desigForm.ot_rate) : null,
        description: desigForm.description.trim(),
      };
      if (desigModal === 'add') await createDesignation(payload);
      else await updateDesignation(editDesigId, payload);
      showToast(desigModal === 'add' ? 'Designation added!' : 'Designation updated!');
      setDesigModal(null); setEditDesigId(null);
      loadDesignations();
    } catch (err) { setDesigError(err.response?.data?.detail || 'Failed to save.'); }
    finally { setDesigSaving(false); }
  };
  const handleDeleteDesig = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    try {
      await deleteDesignation(d.id);
      showToast('Designation removed.');
      loadDesignations();
    } catch (err) { showToast(err.response?.data?.detail || 'Failed.', false); }
  };

  // ── Employee form ─────────────────────────────────────────────────────────
  const openAddEmp  = () => { setEmpForm(EMPTY_EMP); setEmpError(''); setEditEmpId(null); setEmpModal('add'); };
  const openEditEmp = (emp) => {
    setEmpForm({
      emp_code:               emp.emp_code,
      full_name:              emp.full_name,
      phone:                  emp.phone || '',
      role:                   emp.role,
      default_designation_id: emp.default_designation_id || '',
      designation_effective_from: emp.designation_effective_from?.slice(0,10) || '',
      join_date:              emp.join_date?.slice(0,10) || '',
    });
    setEditEmpId(emp.id); setEmpError(''); setEmpModal('edit');
  };
  const closeEmpModal = () => { setEmpModal(null); setEditEmpId(null); };
  const handleEmpChange = (e) => setEmpForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // When designation changes in the form, update the `role` field to match designation name
  const handleEmpDesigChange = (e) => {
    const did = e.target.value;
    const desig = designations.find(d => String(d.id) === String(did));
    setEmpForm(f => ({ ...f, default_designation_id: did, role: desig ? desig.name : f.role }));
  };

  const handleEmpSubmit = async (e) => {
    e.preventDefault();
    if (!empForm.full_name.trim() || !empForm.emp_code.trim()) { setEmpError('Employee Code and Full Name are required.'); return; }
    if (empModal === 'add' && !empForm.default_designation_id) { setEmpError('Please select a default designation.'); return; }
    setEmpSaving(true); setEmpError('');
    try {
      const payload = { ...empForm };
      if (empModal === 'edit') {
        // Send designation fields when the designation changed OR an
        // effective date was explicitly picked (updates history only).
        const orig = employees.find(x => x.id === editEmpId);
        const desigChanged = String(orig?.default_designation_id || '') !== String(empForm.default_designation_id || '');
        const datePicked   = !!empForm.designation_effective_from;
        if (!desigChanged && !datePicked) {
          delete payload.default_designation_id;
          delete payload.designation_effective_from;
        }
      }
      if (empForm.default_designation_id) {
        payload.default_designation_id = parseInt(empForm.default_designation_id);
      } else {
        delete payload.default_designation_id; // don't send null/empty on edit
      }
      if (!empForm.designation_effective_from) delete payload.designation_effective_from;
      if (empModal === 'add') await createEmployee(payload);
      else await updateEmployee(editEmpId, payload);
      showToast(empModal === 'add' ? 'Employee added!' : 'Employee updated!');
      closeEmpModal(); loadEmployees();
    } catch (err) { setEmpError(err.response?.data?.detail || 'Failed to save.'); }
    finally { setEmpSaving(false); }
  };

  const handleDeactivate = async (emp) => {
    try {
      await updateEmployee(emp.id, { active: !emp.active });
      showToast(emp.active ? 'Deactivated.' : 'Activated.');
      loadEmployees();
    } catch { showToast('Failed.', false); }
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
      await markSalaryPaid({ employee_id: payModal.employee_id, pay_month: month, amount_paid: amount, notes: payNotes || null });
      showToast('Payment recorded!'); setPayModal(null); loadReport(month);
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
      await giveAdvance({ employee_id: advModal.employee_id, amount, given_on: advDate || undefined, notes: advNotes || null });
      showToast('Advance recorded!'); setAdvModal(null); loadReport(month);
    } catch (err) { setAdvError(err.response?.data?.detail || 'Failed.'); }
    finally { setAdvSaving(false); }
  };

  // ── History drawer ────────────────────────────────────────────────────────
  const openDrawer = async (row) => {
    setDrawer({ empName: row.full_name, empId: row.employee_id });
    try {
      const [pRes, aRes] = await Promise.all([
        listSalaryPayments(row.employee_id, month),
        listAdvances(row.employee_id, month),
      ]);
      setDrawerPayments(pRes.data.payments || []);
      setDrawerAdvances(aRes.data.advances || []);
    } catch { showToast('Failed to load history.', false); }
  };
  const reloadDrawer = async () => {
    if (!drawer) return;
    const [pRes, aRes] = await Promise.all([
      listSalaryPayments(drawer.empId, month),
      listAdvances(drawer.empId, month),
    ]);
    setDrawerPayments(pRes.data.payments || []);
    setDrawerAdvances(aRes.data.advances || []);
    loadReport(month);
  };

  // ── Per-day detail popup ──────────────────────────────────────────────────
  const openDetail = async (row) => {
    setDetailModal({ employee_id: row.employee_id, full_name: row.full_name });
    setDetailDays([]); setDetailPayments([]); setDetailExpPay([]);
    setDetailAdvances([]); setDetailSummary(null);
    setDetailLoading(true);
    try {
      const res = await getAttendanceDetail(row.employee_id, month);
      setDetailDays(res.data.days        || []);
      setDetailPayments(res.data.payments  || []);
      setDetailExpPay(res.data.exp_payments || []);
      setDetailAdvances(res.data.advances  || []);
      setDetailSummary(res.data.summary    || null);
    } catch { showToast('Failed to load details.', false); }
    finally { setDetailLoading(false); }
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalEarned  = report.reduce((s, r) => s + parseFloat(r.gross_earned || 0), 0);
  const totalPaid    = report.reduce((s, r) => s + parseFloat(r.total_paid || 0), 0);
  const totalAdv     = report.reduce((s, r) => s + parseFloat(r.total_advance || 0), 0);
  const totalBalance = report.reduce((s, r) => s + parseFloat(r.balance_due || 0), 0);
  const totalOTPay   = report.reduce((s, r) => s + parseFloat(r.ot_pay || 0), 0);

  // Designation selected in employee form
  const selectedDesig = designations.find(d => String(d.id) === String(empForm.default_designation_id));

  const TABS = [
    { id: 'report',       label: '📊 Monthly Report' },
    { id: 'employees',    label: '👷 Employees' },
    { id: 'designations', label: '🏷️ Designations' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg,#fdf6e3 0%,#f5ead0 60%,#ede0c4 100%)' }}>

      {/* Navbar */}
      <nav className="sticky top-0 z-30 px-4 py-3 shadow-lg flex items-center justify-between"
        style={{ background: B.navGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')}
            className="text-xl font-bold active:scale-95" style={{ color: B.goldLight }}>←</button>
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-9 h-9 rounded-full object-cover border-2 flex-shrink-0"
            style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-base font-extrabold tracking-widest uppercase"
              style={{ color: B.goldLight, fontFamily: 'Georgia,serif' }}>Crown Tea Hub</h1>
            <p className="text-xs" style={{ color: B.gold }}>Employee Management</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold active:scale-95"
              style={{
                background: tab === t.id ? B.goldGrad : 'rgba(212,160,23,0.15)',
                color:      tab === t.id ? B.darkBrown : B.goldLight,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg"
          style={{ background: toast.ok ? '#15803d' : '#dc2626', color: '#fff' }}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 py-5 space-y-5">

        {/* ━━━━━━━━━ REPORT TAB ━━━━━━━━━ */}
        {tab === 'report' && (
          <div className="space-y-4">
            {/* Month picker */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-bold" style={{ color: B.brown }}>Month</label>
              <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                className="border-2 rounded-xl px-3 py-2 text-sm outline-none font-semibold"
                style={{ borderColor: B.gold, background: '#fff9ee', color: B.darkBrown }} />
              <span className="text-sm font-semibold" style={{ color: B.brown }}>{monthLabel(month)}</span>
            </div>

            {rLoading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 rounded-full border-4 animate-spin"
                  style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : rError ? (
              <div className="rounded-2xl p-6 text-center" style={{ background: '#fee2e2', color: '#dc2626' }}>{rError}</div>
            ) : report.length === 0 ? (
              <div className="rounded-2xl py-16 text-center"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <p className="text-4xl mb-3">📋</p>
                <p className="font-semibold" style={{ color: '#a07020' }}>No attendance data for {monthLabel(month)}</p>
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm overflow-hidden"
                style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Employee','Designation','P','H','L','A','Eff. Days','Regular Pay','OT Pay','Total Earned','Advances','Paid','Balance','Actions'].map(h => (
                          <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.map((row, idx) => (
                        <tr key={row.employee_id}
                          style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2',
                            borderBottom: '1px solid #f0e0c0' }}>
                          <td className="px-3 py-3">
                            <div className="font-semibold" style={{ color: B.darkBrown }}>{row.full_name}</div>
                            <div className="text-xs font-mono" style={{ color: '#a07020' }}>{row.emp_code}</div>
                          </td>
                          <td className="px-3 py-3 text-xs" style={{ color: B.brown }}>
                            {row.default_designation_name || row.role || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: STATUS_META.present.bg, color: STATUS_META.present.color }}>
                              {row.present_days}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: STATUS_META.half_day.bg, color: STATUS_META.half_day.color }}>
                              {row.half_days}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: STATUS_META.leave.bg, color: STATUS_META.leave.color }}>
                              {row.leave_days}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: STATUS_META.absent.bg, color: STATUS_META.absent.color }}>
                              {row.absent_days}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-semibold text-center" style={{ color: B.brown }}>
                            {row.effective_days}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#0369a1' }}>
                            {inr(row.base_earned ?? (parseFloat(row.gross_earned) - parseFloat(row.ot_pay || 0)))}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap"
                            style={{ color: parseFloat(row.ot_pay) > 0 ? '#d97706' : '#9ca3af' }}>
                            {parseFloat(row.ot_pay) > 0 ? `+${inr(row.ot_pay)}` : '—'}
                          </td>
                          <td className="px-3 py-3 font-bold whitespace-nowrap" style={{ color: '#1d4ed8' }}>
                            {inr(row.gross_earned)}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#7c3aed' }}>
                            {inr(row.total_advance)}
                          </td>
                          <td className="px-3 py-3 font-semibold whitespace-nowrap" style={{ color: '#16a34a' }}>
                            {inr(row.total_paid)}
                          </td>
                          <td className="px-3 py-3 font-extrabold whitespace-nowrap"
                            style={{ color: row.balance_due > 0 ? '#dc2626' : row.balance_due < 0 ? '#7c3aed' : '#6b7280' }}>
                            {inr(row.balance_due)}
                            {row.balance_due < 0 && <span className="text-xs font-normal ml-1">(overpaid)</span>}
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => openDetail(row)}
                                title="View day-by-day attendance"
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#e0f2fe', color: '#0369a1' }}>📋</button>
                              <button onClick={() => openPayModal(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#dcfce7', color: '#16a34a' }}>Pay</button>
                              <button onClick={() => openAdvModal(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#ede9fe', color: '#7c3aed' }}>Advance</button>
                              <button onClick={() => openDrawer(row)}
                                className="text-xs font-bold px-2.5 py-1 rounded-lg active:scale-95"
                                style={{ background: '#f3f4f6', color: '#374151' }}>History</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: B.darkBrown }}>
                        <td colSpan={7} className="px-3 py-2.5 text-xs font-bold uppercase"
                          style={{ color: B.goldLight }}>Totals</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#7dd3fc' }}>{inr(totalEarned - totalOTPay)}</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#fbbf24' }}>{totalOTPay > 0 ? `+${inr(totalOTPay)}` : '—'}</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: B.goldLight }}>{inr(totalEarned)}</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#c4b5fd' }}>{inr(totalAdv)}</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs" style={{ color: '#86efac' }}>{inr(totalPaid)}</td>
                        <td className="px-3 py-2.5 font-extrabold text-xs"
                          style={{ color: totalBalance > 0 ? '#fca5a5' : '#86efac' }}>{inr(totalBalance)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs px-1" style={{ color: '#a07020' }}>
              P = Present · H = Half Day · L = Leave (unpaid) · A = Absent · Effective = P + H×0.5 ·
              Total Earned = Regular Pay + OT Pay · Balance = Total − Advances − Paid
            </p>
          </div>
        )}

        {/* ━━━━━━━━━ EMPLOYEES TAB ━━━━━━━━━ */}
        {tab === 'employees' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold" style={{ color: B.brown }}>All Employees ({employees.length})</h3>
              <button onClick={openAddEmp}
                className="font-bold px-5 py-2 rounded-xl text-sm active:scale-95 shadow-md"
                style={{ background: B.goldGrad, color: B.darkBrown }}>
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
                      <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                        {['Code','Name','Role','Designation','Daily Rate','Phone','Join Date','Status','Actions'].map(h => (
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
                          <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                            {emp.designation_name || '—'}
                            {emp.designation_effective_from && (
                              <div className="text-xs font-normal mt-0.5" style={{ color: '#9ca3af' }}>
                                from {emp.designation_effective_from.slice(0,10)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-semibold" style={{ color: '#16a34a' }}>
                            {inr(emp.designation_daily_rate ?? emp.daily_rate)}/day
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{emp.phone || '—'}</td>
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
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                              <button onClick={() => handleDeactivate(emp)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
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

        {/* ━━━━━━━━━ DESIGNATIONS TAB ━━━━━━━━━ */}
        {tab === 'designations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold" style={{ color: B.brown }}>Designations & Daily Rates</h3>
              <button onClick={openAddDesig}
                className="font-bold px-5 py-2 rounded-xl text-sm active:scale-95 shadow-md"
                style={{ background: B.goldGrad, color: B.darkBrown }}>
                + Add Designation
              </button>
            </div>
            <p className="text-xs px-1" style={{ color: '#a07020' }}>
              Designations define the daily pay rate for each role. An employee can have one default designation,
              but the attendance page lets you override it day-by-day (e.g. Tea Master on Mon, Juice Master on Tue).
            </p>
            {dLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : (
              <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                      {['Designation Name','Daily Rate (₹)','OT Rate (₹/hr)','Description','Status','Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                          style={{ color: B.goldLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {designations.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#a07020' }}>No designations yet.</td></tr>
                    ) : designations.map((d, idx) => (
                      <tr key={d.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0',
                        opacity: d.active === false ? 0.55 : 1 }}>
                        <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>{d.name}</td>
                        <td className="px-4 py-3 font-extrabold" style={{ color: '#16a34a' }}>{inr(d.daily_rate)}</td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#d97706' }}>
                          {d.ot_rate != null ? inr(d.ot_rate) : <span style={{ color: '#9ca3af' }}>Not set</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{d.description || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold px-2 py-1 rounded-full"
                            style={{ background: d.active !== false ? '#dcfce7' : '#fee2e2',
                              color: d.active !== false ? '#16a34a' : '#dc2626' }}>
                            {d.active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openEditDesig(d)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#dbeafe', color: '#1d4ed8' }}>Edit</button>
                            <button onClick={() => handleDeleteDesig(d)}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                              style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━ Designation Modal ━━━━━━━━━ */}
      {desigModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {desigModal === 'add' ? '+ Add Designation' : 'Edit Designation'}
              </h3>
              {desigError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{desigError}</div>
              )}
              <form onSubmit={handleDesigSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Designation Name *</label>
                  <input value={desigForm.name}
                    onChange={e => setDesigForm(f => ({ ...f, name: e.target.value }))}
                    className={inpCls} style={inpSty}
                    placeholder="Tea Master, Staff, Juice Master…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Daily Rate (₹/day) *</label>
                    <input type="number" min="0" step="0.01"
                      value={desigForm.daily_rate}
                      onChange={e => setDesigForm(f => ({ ...f, daily_rate: e.target.value }))}
                      className={inpCls} style={{ borderColor: B.gold }}
                      placeholder="800" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                      OT Rate (₹/hr)
                      <span className="ml-1 font-normal" style={{ color: '#a07020' }}>optional</span>
                    </label>
                    <input type="number" min="0" step="0.01"
                      value={desigForm.ot_rate}
                      onChange={e => setDesigForm(f => ({ ...f, ot_rate: e.target.value }))}
                      className={inpCls} style={{ borderColor: desigForm.ot_rate ? B.gold : '#e8d5a3' }}
                      placeholder="e.g. 100" />
                    {!desigForm.ot_rate && (
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        If blank, OT hours won't earn pay for this designation
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Description (optional)</label>
                  <input value={desigForm.description}
                    onChange={e => setDesigForm(f => ({ ...f, description: e.target.value }))}
                    className={inpCls} style={inpSty}
                    placeholder="Senior tea preparation role" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setDesigModal(null); setEditDesigId(null); }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={desigSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: B.goldGrad, color: B.darkBrown }}>
                    {desigSaving ? 'Saving…' : desigModal === 'add' ? 'Add' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━ Employee Modal ━━━━━━━━━ */}
      {empModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.55)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-4" style={{ color: B.brown }}>
                {empModal === 'add' ? '+ Onboard New Employee' : 'Edit Employee'}
              </h3>
              {empError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{empError}</div>
              )}
              <form onSubmit={handleEmpSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Emp Code *</label>
                    <input name="emp_code" value={empForm.emp_code} onChange={handleEmpChange}
                      disabled={empModal === 'edit'}
                      className={inpCls}
                      style={{ borderColor: '#e8d5a3', background: empModal === 'edit' ? '#f5f5f5' : '#fff' }}
                      placeholder="EMP001" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Full Name *</label>
                    <input name="full_name" value={empForm.full_name} onChange={handleEmpChange}
                      className={inpCls} style={inpSty} placeholder="John Doe" />
                  </div>
                </div>

                {/* Default Designation — the key field */}
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                    Default Designation * <span style={{ color: '#a07020', fontWeight: 400 }}>(sets daily pay rate)</span>
                  </label>
                  <select value={empForm.default_designation_id} onChange={handleEmpDesigChange}
                    className={inpCls} style={{ borderColor: B.gold }}>
                    <option value="">— Select a designation —</option>
                    {designations.filter(d => d.active !== false).map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {inr(d.daily_rate)}/day</option>
                    ))}
                  </select>
                  {selectedDesig && (
                    <p className="text-xs mt-1 font-semibold" style={{ color: '#16a34a' }}>
                      Daily rate: {inr(selectedDesig.daily_rate)}
                      {selectedDesig.ot_rate != null
                        ? <span style={{ color: '#d97706' }}> · OT: {inr(selectedDesig.ot_rate)}/hr</span>
                        : <span style={{ color: '#9ca3af' }}> · OT: not configured</span>}
                    </p>
                  )}
                  {/* Effective-from date — new designation applies from this date onward */}
                  {empForm.default_designation_id && (
                    <div className="mt-2">
                      <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>
                        Effective From <span style={{ color: '#a07020', fontWeight: 400 }}>(designation applies from this date)</span>
                      </label>
                      <input name="designation_effective_from" type="date"
                        value={empForm.designation_effective_from} onChange={handleEmpChange}
                        className={inpCls} style={inpSty} />
                      <p className="text-xs mt-1" style={{ color: '#a07020' }}>
                        {empModal === 'edit'
                          ? 'Changing designation records history — attendance before this date keeps the old rate.'
                          : 'Leave blank to use the join date.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Phone</label>
                    <input name="phone" value={empForm.phone} onChange={handleEmpChange}
                      className={inpCls} style={inpSty} placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Join Date</label>
                    <input name="join_date" type="date" value={empForm.join_date} onChange={handleEmpChange}
                      className={inpCls} style={inpSty} />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeEmpModal}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={empSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: B.goldGrad, color: B.darkBrown }}>
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
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-1" style={{ color: B.brown }}>Record Salary Payment</h3>
              <p className="text-sm mb-4" style={{ color: '#a07020' }}>
                {payModal.full_name} · {monthLabel(month)}
                {payModal.balance > 0 && (
                  <span className="ml-2 font-semibold" style={{ color: '#dc2626' }}>
                    Balance due: {inr(payModal.balance)}
                  </span>
                )}
              </p>
              {payError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{payError}</div>
              )}
              <form onSubmit={handlePaySubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Amount (₹)</label>
                  <input type="number" min="1" step="0.01" value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className={inpCls} style={{ borderColor: B.gold }} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes (optional)</label>
                  <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)}
                    className={inpCls} style={inpSty} placeholder="Weekly pay / Bank transfer…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setPayModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={paySaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
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
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="p-6">
              <h3 className="text-lg font-extrabold mb-1" style={{ color: B.brown }}>Give Advance</h3>
              <p className="text-sm mb-4" style={{ color: '#a07020' }}>{advModal.full_name}</p>
              {advError && (
                <div className="mb-3 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: '#fee2e2', color: '#dc2626' }}>{advError}</div>
              )}
              <form onSubmit={handleAdvSubmit} className="space-y-3">
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Amount (₹)</label>
                  <input type="number" min="1" step="0.01" value={advAmount}
                    onChange={e => setAdvAmount(e.target.value)}
                    className={inpCls} style={{ borderColor: B.gold }} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Date (optional)</label>
                  <input type="date" value={advDate} onChange={e => setAdvDate(e.target.value)}
                    className={inpCls} style={inpSty} />
                </div>
                <div>
                  <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes (optional)</label>
                  <input type="text" value={advNotes} onChange={e => setAdvNotes(e.target.value)}
                    className={inpCls} style={inpSty} placeholder="Festival advance…" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setAdvModal(null)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={advSaving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                    style={{ background: '#7c3aed', color: '#fff' }}>
                    {advSaving ? 'Saving…' : 'Give Advance'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━ Payments / Advances Drawer ━━━━━━━━━ */}
      {drawer && (
        <PaymentsDrawer
          empName={drawer.empName}
          month={month}
          payments={drawerPayments}
          advances={drawerAdvances}
          onClose={() => setDrawer(null)}
          onChanged={reloadDrawer}
          showToast={showToast}
        />
      )}

      {/* ━━━━━━━━━ Day-by-Day Detail Modal ━━━━━━━━━ */}
      {detailModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.6)' }}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />

            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid #f0e0c0' }}>
              <div>
                <h3 className="text-base font-extrabold" style={{ color: B.brown }}>
                  {detailModal.full_name}
                </h3>
                <p className="text-xs" style={{ color: '#a07020' }}>
                  {monthLabel(month)} · Full attendance &amp; settlement breakdown
                </p>
              </div>
              <button onClick={() => setDetailModal(null)}
                className="text-2xl leading-none font-bold" style={{ color: '#a07020' }}>×</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-10 h-10 rounded-full border-4 animate-spin"
                    style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <>
                  {/* ── Section 1: Day-by-day attendance ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2"
                      style={{ color: B.brown }}>Attendance Days</p>
                    {detailDays.length === 0 ? (
                      <p className="text-sm italic py-4 text-center" style={{ color: '#a07020' }}>
                        No attendance marked this month.
                      </p>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8d5a3' }}>
                        <table className="w-full text-sm">
                          <thead>
                            <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                              {['Date','Status','Designation','Rate','OT','Day Pay','Total'].map(h => (
                                <th key={h} className="px-3 py-2.5 text-left text-xs font-bold uppercase"
                                  style={{ color: B.goldLight, whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {detailDays.map((d, i) => (
                              <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fffbf2',
                                borderBottom: '1px solid #f0e0c0' }}>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: B.brown }}>{d.date}</td>
                                <td className="px-3 py-2">
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                    style={{ background: STATUS_META[d.status]?.bg || '#f3f4f6',
                                      color: STATUS_META[d.status]?.color || '#6b7280' }}>
                                    {STATUS_META[d.status]?.label || d.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs" style={{ color: B.brown }}>
                                  {d.designation}
                                  {d.is_override && <span className="ml-1 font-bold" style={{ color: '#7c3aed' }}>⇄</span>}
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold" style={{ color: '#16a34a' }}>
                                  {inr(d.daily_rate)}
                                </td>
                                <td className="px-3 py-2 text-xs" style={{ color: '#d97706' }}>
                                  {d.ot_hours > 0 ? `${d.ot_hours}h` : '—'}
                                  {d.ot_pay > 0 && <span className="block font-semibold">{inr(d.ot_pay)}</span>}
                                </td>
                                <td className="px-3 py-2 text-xs font-semibold" style={{ color: '#1d4ed8' }}>
                                  {inr(d.day_pay)}
                                </td>
                                <td className="px-3 py-2 text-xs font-extrabold" style={{ color: '#1d4ed8' }}>
                                  {inr(d.total_pay)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ background: B.cream }}>
                              <td colSpan={4} className="px-3 py-2 text-xs font-bold" style={{ color: B.brown }}>
                                {detailDays.filter(d=>d.status==='present').length}P
                                {detailDays.filter(d=>d.status==='half_day').length > 0 &&
                                  ` + ${detailDays.filter(d=>d.status==='half_day').length}H`} worked
                              </td>
                              <td className="px-3 py-2 font-extrabold text-xs" style={{ color: '#d97706' }}>
                                {detailDays.reduce((s,d)=>s+(d.ot_pay||0),0) > 0
                                  ? `+${inr(detailDays.reduce((s,d)=>s+(d.ot_pay||0),0))}` : '—'}
                              </td>
                              <td className="px-3 py-2 font-extrabold text-xs" style={{ color: '#1d4ed8' }}>
                                {inr(detailDays.reduce((s,d)=>s+d.day_pay,0))}
                              </td>
                              <td className="px-3 py-2 font-extrabold text-xs" style={{ color: '#1d4ed8' }}>
                                {inr(detailDays.reduce((s,d)=>s+d.total_pay,0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ── Section 2: Advances ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#7c3aed' }}>
                      Advances Given {detailSummary && `— ${inr(detailSummary.total_advance)}`}
                    </p>
                    {detailAdvances.length === 0 ? (
                      <p className="text-sm italic" style={{ color: '#9ca3af' }}>No advances this month</p>
                    ) : (
                      <div className="space-y-1">
                        {detailAdvances.map(a => (
                          <div key={a.id} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                            style={{ background: a.recovered ? '#f3f4f6' : '#ede9fe' }}>
                            <span style={{ color: '#5b21b6' }}>
                              {a.given_on?.slice(0,10)} — {a.notes || 'Advance'}
                              {a.recovered && <span className="ml-2 text-xs font-bold" style={{ color: '#16a34a' }}>✓ Recovered</span>}
                            </span>
                            <span className="font-bold" style={{ color: '#7c3aed' }}>{inr(a.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Section 3: Salary Paid ── */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#16a34a' }}>
                      Salary Paid {detailSummary && `— ${inr(detailSummary.total_paid)}`}
                    </p>
                    {detailPayments.length === 0 && detailExpPay.length === 0 ? (
                      <p className="text-sm italic" style={{ color: '#9ca3af' }}>No payments this month</p>
                    ) : (
                      <div className="space-y-1">
                        {detailPayments.map(p => (
                          <div key={`pay-${p.id}`} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                            style={{ background: '#dcfce7' }}>
                            <span style={{ color: '#166534' }}>
                              {p.paid_at?.slice(0,10) || ''} — {p.notes || p.payment_type || 'Salary'}
                            </span>
                            <span className="font-bold" style={{ color: '#16a34a' }}>{inr(p.amount_paid)}</span>
                          </div>
                        ))}
                        {detailExpPay.map(e => (
                          <div key={`exp-${e.id}`} className="flex justify-between items-center px-3 py-2 rounded-lg text-sm"
                            style={{ background: '#dcfce7' }}>
                            <span style={{ color: '#166534' }}>
                              {e.expense_date} — {e.description || 'Salary via Expenses'}
                              <span className="ml-1 text-xs font-bold px-1 py-0.5 rounded"
                                style={{ background: '#fef3c7', color: '#b45309' }}>via Expenses</span>
                            </span>
                            <span className="font-bold" style={{ color: '#16a34a' }}>{inr(e.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ── Section 4: Final Settlement ── */}
                  {detailSummary && (
                    <div className="rounded-2xl p-4 space-y-2"
                      style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown})` }}>
                      {[
                        { label: 'Regular Pay',         val: detailSummary.base_earned,   color: '#7dd3fc' },
                        { label: 'OT Pay',              val: detailSummary.total_ot_pay,  color: '#fbbf24', showIf: parseFloat(detailSummary.total_ot_pay) > 0 },
                        { label: 'Gross Earned',        val: detailSummary.gross_earned,  color: '#93c5fd' },
                        { label: 'Advances Given',      val: detailSummary.total_advance, color: '#c4b5fd', neg: true },
                        { label: 'Salary Paid',         val: detailSummary.total_paid,    color: '#86efac', neg: true },
                      ].filter(r => r.showIf === undefined || r.showIf).map(r => (
                        <div key={r.label} className="flex justify-between items-center">
                          <span className="text-xs font-semibold" style={{ color: '#c8a84b' }}>{r.label}</span>
                          <span className="text-sm font-bold" style={{ color: r.color }}>
                            {r.neg ? '− ' : ''}{inr(r.val)}
                          </span>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-1 flex justify-between items-center"
                        style={{ borderColor: 'rgba(212,160,23,0.3)' }}>
                        <span className="text-sm font-extrabold" style={{ color: B.goldLight }}>
                          {detailSummary.balance_due > 0 ? 'Balance to Pay' :
                           detailSummary.balance_due < 0 ? 'Overpaid' : 'Fully Settled'}
                        </span>
                        <span className="text-xl font-extrabold"
                          style={{ color: detailSummary.balance_due > 0 ? '#fca5a5' :
                                          detailSummary.balance_due < 0 ? '#c4b5fd' : '#86efac' }}>
                          {inr(Math.abs(detailSummary.balance_due))}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
