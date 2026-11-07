import { useState, useEffect, useCallback } from 'react';
import { getEmployeeLoans, previewEmployeeLoan, createEmployeeLoan, deleteEmployeeLoan } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842',
};

const inr = (n) => '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const istToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const nextMonth = () => {
  const [y, m] = istToday().split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
};

const inpCls = 'w-full border-2 rounded-xl px-3 py-2 text-sm outline-none';
const inpSty = { borderColor: '#e8d5a3' };

const STATUS = {
  deducted: { label: 'Deducted', color: '#16a34a', bg: '#dcfce7' },
  due:      { label: 'This month', color: '#d97706', bg: '#fef3c7' },
  upcoming: { label: 'Upcoming', color: '#6b7280', bg: '#f3f4f6' },
};

function ScheduleTable({ rows }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #e8d5a3' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
            {['#', 'Month', 'Opening', 'EMI', 'Principal', 'Interest', 'Closing', 'Status'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-bold uppercase" style={{ color: B.goldLight }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const st = STATUS[r.status];
            return (
              <tr key={r.installment_no} style={{ background: i % 2 ? '#fffbf2' : '#fff', borderTop: '1px solid #f0e0c0' }}>
                <td className="px-3 py-1.5 text-xs" style={{ color: '#a07020' }}>{r.installment_no}</td>
                <td className="px-3 py-1.5 font-semibold whitespace-nowrap" style={{ color: B.brown }}>{monthLabel(r.due_month)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{inr(r.opening_balance)}</td>
                <td className="px-3 py-1.5 font-bold whitespace-nowrap" style={{ color: '#dc2626' }}>{inr(r.emi)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{inr(r.principal_part)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: '#7c3aed' }}>{inr(r.interest_part)}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{inr(r.closing_balance)}</td>
                <td className="px-3 py-1.5">
                  {st ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      : <span className="text-xs text-gray-400">Preview</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Employee loans: give a loan, preview the amortization schedule, EMI is deducted in the
// HR & Salary report every month until the loan closes.
// eslint-disable-next-line react/prop-types
export default function EmployeeLoans({ employees, onChanged, showToast }) {
  const empty = { employee_id: '', principal: '', annual_rate: '0', tenure_months: '', start_month: nextMonth(),
                  loan_date: istToday(), notes: '', pay_out: false, payment_mode: 'cash' };
  const [form, setForm]         = useState(empty);
  const [preview, setPreview]   = useState(null);
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [loans, setLoans]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [openId, setOpenId]     = useState(null);
  const [filterEmp, setFilterEmp] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setLoans((await getEmployeeLoans()).data.loans || []); }
    catch { /* silent */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setPreview(null); };
  const loanBody = () => ({
    employee_id: form.employee_id ? Number(form.employee_id) : undefined,
    principal: parseFloat(form.principal), annual_rate: parseFloat(form.annual_rate || 0),
    tenure_months: parseInt(form.tenure_months, 10), start_month: form.start_month,
  });

  const doPreview = async () => {
    setError('');
    try { setPreview((await previewEmployeeLoan(loanBody())).data); }
    catch (err) { setError(err.response?.data?.detail || 'Check the loan details.'); }
  };

  const save = async () => {
    if (!form.employee_id) { setError('Select the employee.'); return; }
    setSaving(true); setError('');
    try {
      const res = await createEmployeeLoan({ ...loanBody(), loan_date: form.loan_date, notes: form.notes,
                                             pay_out: form.pay_out, payment_mode: form.payment_mode });
      const l = res.data.loan;
      showToast(`Loan ${inr(l.principal)} created — EMI ${inr(l.emi_amount)} × ${l.tenure_months} from ${monthLabel(l.start_month)}`);
      setForm(empty); setPreview(null); setOpenId(l.id);
      load(); onChanged?.();
    } catch (err) { setError(err.response?.data?.detail || 'Failed to create loan.'); }
    finally { setSaving(false); }
  };

  const remove = async (l) => {
    if (!window.confirm(`Delete loan of ${inr(l.principal)} for ${l.full_name}?\nIts EMIs will no longer be deducted${l.expense_id ? ' and the Daily Expense payout will be removed' : ''}.`)) return;
    try { await deleteEmployeeLoan(l.id); showToast('Loan deleted.'); load(); onChanged?.(); }
    catch (err) { showToast(err.response?.data?.detail || 'Failed to delete.', false); }
  };

  const shown = loans.filter(l => !filterEmp || String(l.employee_id) === String(filterEmp));
  const activeEmployees = (employees || []).filter(e => e.active !== false);

  return (
    <div className="space-y-5">
      {/* New loan */}
      <div className="rounded-2xl p-5 shadow-sm space-y-3" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
        <h3 className="font-bold" style={{ color: B.brown }}>New Employee Loan</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Employee *</label>
            <select value={form.employee_id} onChange={e => set('employee_id', e.target.value)} className={inpCls} style={inpSty}>
              <option value="">— Select employee —</option>
              {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.emp_code})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Loan Amount (₹) *</label>
            <input type="number" min="0" step="0.01" value={form.principal} onChange={e => set('principal', e.target.value)}
              placeholder="e.g. 8000" className={inpCls} style={inpSty} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>No. of EMIs (months) *</label>
            <input type="number" min="1" max="120" value={form.tenure_months} onChange={e => set('tenure_months', e.target.value)}
              placeholder="e.g. 8" className={inpCls} style={inpSty} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Interest (% per year)</label>
            <input type="number" min="0" max="60" step="0.01" value={form.annual_rate} onChange={e => set('annual_rate', e.target.value)}
              className={inpCls} style={inpSty} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>First EMI Month *</label>
            <input type="month" value={form.start_month} onChange={e => set('start_month', e.target.value)} className={inpCls} style={inpSty} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Loan Date</label>
            <input type="date" value={form.loan_date} max={istToday()} onChange={e => set('loan_date', e.target.value)} className={inpCls} style={inpSty} />
          </div>
          <div>
            <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes</label>
            <input value={form.notes} onChange={e => set('notes', e.target.value)} maxLength={300} placeholder="Optional" className={inpCls} style={inpSty} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap text-sm" style={{ color: B.brown }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.pay_out} onChange={e => set('pay_out', e.target.checked)} />
            Money paid out now (add to Daily Expenses)
          </label>
          {form.pay_out && (
            <select value={form.payment_mode} onChange={e => set('payment_mode', e.target.value)}
              className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inpSty}>
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="bank">Bank</option>
            </select>
          )}
          <span className="text-xs" style={{ color: '#a07020' }}>
            Leave unticked if the money was already given as an advance and recorded earlier.
          </span>
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button onClick={doPreview} className="px-5 py-2 rounded-xl text-sm font-bold active:scale-95"
            style={{ background: '#fff9ee', border: '1px solid #d4a017', color: B.brown }}>
            Show Schedule
          </button>
          <button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
            {saving ? 'Saving…' : 'Create Loan'}
          </button>
        </div>

        {preview && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-4 text-sm font-semibold" style={{ color: B.brown }}>
              <span>EMI: <strong style={{ color: '#dc2626' }}>{inr(preview.emi)}</strong> / month</span>
              <span>Total interest: {inr(preview.total_interest)}</span>
              <span>Total payable: {inr(preview.total_payable)}</span>
            </div>
            <ScheduleTable rows={preview.schedule} />
          </div>
        )}
      </div>

      {/* Loans */}
      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
        <div className="px-5 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
          <h3 className="font-bold text-sm" style={{ color: B.brown }}>Loans</h3>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} className="border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inpSty}>
            <option value="">All employees</option>
            {(employees || []).map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        {loading ? (
          <p className="text-center py-8 text-sm" style={{ color: '#a07020' }}>Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: '#a07020' }}>No loans yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f0e0c0' }}>
            {shown.map(l => (
              <div key={l.id} className="px-5 py-3">
                <div className="flex items-center gap-4 flex-wrap cursor-pointer" onClick={() => setOpenId(id => (id === l.id ? null : l.id))}>
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-semibold" style={{ color: B.darkBrown }}>{l.full_name}
                      <span className="ml-2 text-xs font-bold px-2 py-0.5 rounded-full"
                        style={l.status === 'closed' ? { background: '#dcfce7', color: '#16a34a' } : { background: '#fef3c7', color: '#b45309' }}>
                        {l.status === 'closed' ? 'Closed' : 'Active'}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: '#a07020' }}>
                      {inr(l.principal)} · {parseFloat(l.annual_rate) > 0 ? `${l.annual_rate}% p.a.` : 'interest-free'} ·
                      {' '}{l.tenure_months} EMIs of {inr(l.emi_amount)} · {monthLabel(l.start_month)} → {monthLabel(l.end_month)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div style={{ color: '#16a34a' }}>Recovered {inr(l.recovered)}</div>
                    <div className="font-bold" style={{ color: l.outstanding > 0 ? '#dc2626' : '#16a34a' }}>
                      Outstanding {inr(l.outstanding)} · {l.emis_left} EMI{l.emis_left !== 1 ? 's' : ''} left
                    </div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: B.gold }}>{openId === l.id ? '▲' : '▼ Schedule'}</span>
                  <button onClick={e => { e.stopPropagation(); remove(l); }} className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: '#fee2e2', color: '#dc2626' }}>Delete</button>
                </div>
                {openId === l.id && (
                  <div className="mt-3 space-y-1">
                    {l.notes && <p className="text-xs" style={{ color: '#a07020' }}>Note: {l.notes}</p>}
                    <ScheduleTable rows={l.schedule} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs px-1" style={{ color: '#a07020' }}>
        Each month&apos;s EMI is deducted automatically in the Monthly Report (Loan EMI column) until the loan is closed.
      </p>
    </div>
  );
}
