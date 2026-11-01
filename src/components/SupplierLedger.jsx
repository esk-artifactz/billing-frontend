import { useState, useEffect, useCallback } from 'react';
import {
  getSupplierLedgerSummary, getSupplierLedger, addSupplierPayment, deleteSupplierLedgerEntry,
} from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', text: '#7a4e08', textLight: '#a07020',
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const isoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const TYPE_META = {
  opening: { label: 'Opening Balance', color: '#6b7280', bg: '#f3f4f6' },
  bill:    { label: 'Bill (Stock Received)', color: '#b45309', bg: '#fef3c7' },
  payment: { label: 'Payment', color: '#16a34a', bg: '#dcfce7' },
  return:  { label: 'Purchase Return', color: '#1d4ed8', bg: '#dbeafe' },
};

const STATUS_META = {
  paid:    { label: 'Paid',    color: '#16a34a', bg: '#dcfce7' },
  partial: { label: 'Partial', color: '#d97706', bg: '#fef3c7' },
  unpaid:  { label: 'Unpaid',  color: '#dc2626', bg: '#fee2e2' },
};

const Badge = ({ meta }) => (
  <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: meta.bg, color: meta.color }}>
    {meta.label}
  </span>
);

const balanceText = (bal) => (bal > 0 ? `${fmtINR(bal)} pending` : bal < 0 ? `${fmtINR(-bal)} advance` : 'Settled');
const balanceColor = (bal) => (bal > 0 ? '#dc2626' : bal < 0 ? '#1d4ed8' : '#16a34a');

export default function SupplierLedger({ dateFrom, dateTo, showToast }) {
  const [summary, setSummary]       = useState(null);
  const [selectedId, setSelectedId] = useState('');
  const [ledger, setLedger]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const emptyPay = { amount: '', payment_mode: 'cash', payment_date: isoToday(), reference: '', note: '' };
  const [pay, setPay]         = useState(emptyPay);
  const [paySaving, setPaySaving] = useState(false);
  const [payErr, setPayErr]   = useState('');

  const loadSummary = useCallback(async () => {
    try { const res = await getSupplierLedgerSummary(); setSummary(res.data); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to load supplier balances.'); }
  }, []);

  const loadLedger = useCallback(async (id) => {
    if (!id) { setLedger(null); return; }
    setLoading(true); setError('');
    try {
      const res = await getSupplierLedger(id, { from: dateFrom || undefined, to: dateTo || undefined });
      setLedger(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load ledger.');
    } finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadLedger(selectedId); }, [selectedId, loadLedger]);

  const refreshAll = () => { loadSummary(); loadLedger(selectedId); };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(pay.amount);
    if (!amt || amt <= 0) { setPayErr('Enter the amount paid'); return; }
    setPaySaving(true); setPayErr('');
    try {
      await addSupplierPayment(selectedId, { ...pay, amount: amt });
      setPay(emptyPay);
      showToast?.(`Payment of ${fmtINR(amt)} recorded — also added to Daily Expenses`);
      refreshAll();
    } catch (err) {
      setPayErr(err.response?.data?.detail || 'Failed to record payment.');
    } finally { setPaySaving(false); }
  };

  const deleteEntry = async (row) => {
    const what = row.entry_type === 'payment' ? 'payment (its Daily Expense entry will also be removed)' : 'bill';
    if (!window.confirm(`Delete this ${what} of ${fmtINR(row.amount)}?`)) return;
    try {
      await deleteSupplierLedgerEntry(row.id);
      showToast?.('Entry deleted');
      refreshAll();
    } catch (err) {
      showToast?.(err.response?.data?.detail || 'Delete failed', false);
    }
  };

  const inputSty = { borderColor: '#e8d5a3' };
  const pendingBalance = ledger?.balance || 0;

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</div>}

      {/* Supplier picker + overall totals */}
      <div className="rounded-2xl p-4 shadow-sm flex flex-wrap items-end gap-4" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
        <div className="flex-1 min-w-[220px]">
          <label className="text-xs font-bold block mb-1" style={{ color: B.textLight }}>Supplier</label>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
            className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none" style={inputSty}>
            <option value="">— All suppliers (balances) —</option>
            {(summary?.suppliers || []).map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.balance ? ` — ${balanceText(s.balance)}` : ''}
              </option>
            ))}
          </select>
        </div>
        {summary && (
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs font-bold uppercase" style={{ color: B.textLight }}>Total Pending</p>
              <p className="text-xl font-extrabold" style={{ color: '#dc2626' }}>{fmtINR(summary.total_pending)}</p>
            </div>
            {summary.total_advance > 0 && (
              <div>
                <p className="text-xs font-bold uppercase" style={{ color: B.textLight }}>Advance Paid</p>
                <p className="text-xl font-extrabold" style={{ color: '#1d4ed8' }}>{fmtINR(summary.total_advance)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* All suppliers — balance summary */}
      {!selectedId && summary && (
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          <div className="px-5 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
            <h3 className="font-bold text-sm" style={{ color: B.text }}>Supplier Balances (all dates) — click a supplier for the full statement</h3>
          </div>
          {summary.suppliers.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: B.textLight }}>No suppliers yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                    {['Supplier', 'Opening', 'Billed', 'Paid', 'Returns', 'Balance', 'Last Payment'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.suppliers.map((s, i) => (
                    <tr key={s.id} onClick={() => setSelectedId(String(s.id))} className="cursor-pointer hover:bg-amber-50"
                      style={{ background: i % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0' }}>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: B.darkBrown }}>
                        {s.name}{!s.active && <span className="ml-1 text-xs text-gray-400">(inactive)</span>}
                      </td>
                      <td className="px-4 py-2.5">{s.opening ? fmtINR(s.opening) : '—'}</td>
                      <td className="px-4 py-2.5">{fmtINR(s.billed)}</td>
                      <td className="px-4 py-2.5" style={{ color: '#16a34a' }}>{fmtINR(s.paid)}</td>
                      <td className="px-4 py-2.5" style={{ color: '#1d4ed8' }}>{s.returned ? fmtINR(s.returned) : '—'}</td>
                      <td className="px-4 py-2.5 font-extrabold whitespace-nowrap" style={{ color: balanceColor(s.balance) }}>{balanceText(s.balance)}</td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: B.textLight }}>{fmtDate(s.last_payment_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Selected supplier — statement */}
      {selectedId && loading && !ledger && (
        <div className="flex justify-center py-12">
          <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
        </div>
      )}

      {selectedId && ledger && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Billed (period)',   val: ledger.period_totals.billed,   color: '#b45309' },
              { label: 'Paid (period)',     val: ledger.period_totals.paid,     color: '#16a34a' },
              { label: 'Returns (period)',  val: ledger.period_totals.returned, color: '#1d4ed8' },
            ].map(c => (
              <div key={c.label} className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
                <p className="text-xs font-bold uppercase" style={{ color: B.textLight }}>{c.label}</p>
                <p className="text-lg font-extrabold" style={{ color: c.color }}>{fmtINR(c.val)}</p>
              </div>
            ))}
            <div className="rounded-2xl p-4 shadow-sm" style={{ background: '#fff', border: `2px solid ${balanceColor(pendingBalance)}` }}>
              <p className="text-xs font-bold uppercase" style={{ color: B.textLight }}>Balance Now</p>
              <p className="text-lg font-extrabold" style={{ color: balanceColor(pendingBalance) }}>{balanceText(pendingBalance)}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            {/* Record payment */}
            <form onSubmit={submitPayment} className="rounded-2xl p-4 shadow-sm space-y-2" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <h3 className="font-bold text-sm" style={{ color: B.text }}>Record Payment to {ledger.supplier.name}</h3>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.01" value={pay.amount} placeholder="Amount ₹"
                  onChange={e => setPay(p => ({ ...p, amount: e.target.value }))}
                  className="flex-1 border-2 rounded-lg px-3 py-2 text-sm outline-none" style={inputSty} />
                {pendingBalance > 0 && (
                  <button type="button" onClick={() => setPay(p => ({ ...p, amount: String(pendingBalance) }))}
                    className="text-xs font-bold px-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
                    Full {fmtINR(pendingBalance)}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={pay.payment_mode} onChange={e => setPay(p => ({ ...p, payment_mode: e.target.value }))}
                  className="border-2 rounded-lg px-2 py-2 text-sm outline-none" style={inputSty}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank">Bank</option>
                </select>
                <input type="date" value={pay.payment_date} onChange={e => setPay(p => ({ ...p, payment_date: e.target.value }))}
                  className="border-2 rounded-lg px-2 py-2 text-sm outline-none" style={inputSty} />
              </div>
              <input type="text" value={pay.reference} placeholder="Reference (cheque / UTR / invoice no.)" maxLength={100}
                onChange={e => setPay(p => ({ ...p, reference: e.target.value }))}
                className="w-full border-2 rounded-lg px-3 py-2 text-sm outline-none" style={inputSty} />
              <input type="text" value={pay.note} placeholder="Note (optional)"
                onChange={e => setPay(p => ({ ...p, note: e.target.value }))}
                className="w-full border-2 rounded-lg px-3 py-2 text-sm outline-none" style={inputSty} />
              {payErr && <p className="text-xs font-semibold text-red-600">{payErr}</p>}
              <button type="submit" disabled={paySaving}
                className="w-full py-2 rounded-xl text-sm font-bold active:scale-95 disabled:opacity-60"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                {paySaving ? 'Saving…' : 'Save Payment'}
              </button>
              <p className="text-xs" style={{ color: B.textLight }}>Adjusted against the oldest pending bills first. Also shown in Daily Expenses.</p>
            </form>

            {/* Pending bills */}
            <div className="lg:col-span-2 rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <div className="px-5 py-3 border-b flex justify-between" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
                <h3 className="font-bold text-sm" style={{ color: B.text }}>Pending Bills</h3>
                <span className="text-xs font-bold" style={{ color: '#dc2626' }}>{ledger.pending_bills.length} pending</span>
              </div>
              {ledger.pending_bills.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: '#16a34a' }}>No pending bills — all settled</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#fffbf2' }}>
                      {['Date', 'Reference', 'Bill', 'Paid', 'Pending', 'Status'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-bold uppercase" style={{ color: B.textLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.pending_bills.map(b => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-2 text-xs whitespace-nowrap">{fmtDate(b.entry_date)}</td>
                        <td className="px-4 py-2 text-xs font-mono">{b.entry_type === 'opening' ? 'Opening balance' : (b.reference || b.po_number || '—')}</td>
                        <td className="px-4 py-2">{fmtINR(b.amount)}</td>
                        <td className="px-4 py-2" style={{ color: '#16a34a' }}>{fmtINR(b.paid)}</td>
                        <td className="px-4 py-2 font-bold" style={{ color: '#dc2626' }}>{fmtINR(b.pending)}</td>
                        <td className="px-4 py-2"><Badge meta={STATUS_META[b.status]} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Statement */}
          <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <div className="px-5 py-3 border-b" style={{ background: '#fffbf2', borderColor: '#e8d5a3' }}>
              <h3 className="font-bold text-sm" style={{ color: B.text }}>
                Account Statement — {ledger.supplier.name}
                <span className="font-normal ml-2" style={{ color: B.textLight }}>
                  {dateFrom || dateTo ? `${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` : 'All dates'}
                </span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                    {['Date', 'Type', 'Reference', 'Details', 'Bill (Dr)', 'Paid (Cr)', 'Balance', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(dateFrom && ledger.opening_brought_forward !== 0) && (
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0e0c0' }}>
                      <td className="px-4 py-2 text-xs">{fmtDate(dateFrom)}</td>
                      <td className="px-4 py-2 text-xs font-semibold" colSpan={5} style={{ color: '#6b7280' }}>Balance brought forward</td>
                      <td className="px-4 py-2 font-bold" style={{ color: balanceColor(ledger.opening_brought_forward) }}>{fmtINR(ledger.opening_brought_forward)}</td>
                      <td />
                    </tr>
                  )}
                  {ledger.entries.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: B.textLight }}>No transactions in this period</td></tr>
                  ) : ledger.entries.map((r, i) => (
                    <tr key={r.id} style={{ background: i % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0' }}>
                      <td className="px-4 py-2 text-xs whitespace-nowrap">{fmtDate(r.entry_date)}</td>
                      <td className="px-4 py-2"><Badge meta={TYPE_META[r.entry_type] || { label: r.entry_type, color: '#555', bg: '#eee' }} /></td>
                      <td className="px-4 py-2 text-xs font-mono">{r.reference || r.po_number || '—'}</td>
                      <td className="px-4 py-2 text-xs" style={{ color: B.textLight }}>
                        {r.notes || r.expense_description || ''}
                        {r.payment_mode && <span className="ml-1 uppercase font-bold">· {r.payment_mode}</span>}
                        {r.recorded_by && <span className="ml-1 text-gray-400">· {r.recorded_by}</span>}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: '#b45309' }}>{r.debit ? fmtINR(r.debit) : ''}</td>
                      <td className="px-4 py-2 whitespace-nowrap" style={{ color: '#16a34a' }}>{r.credit ? fmtINR(r.credit) : ''}</td>
                      <td className="px-4 py-2 font-bold whitespace-nowrap" style={{ color: balanceColor(r.balance) }}>
                        {fmtINR(Math.abs(r.balance))}{r.balance < 0 ? ' adv' : ''}
                      </td>
                      <td className="px-4 py-2">
                        {(r.entry_type === 'bill' || r.entry_type === 'payment') && (
                          <button onClick={() => deleteEntry(r)} title="Delete entry"
                            className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {ledger.entries.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#fff9ee', borderTop: `2px solid ${B.gold}` }}>
                      <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: B.text }}>Closing balance</td>
                      <td className="px-4 py-2.5 font-bold" style={{ color: '#b45309' }}>{fmtINR(ledger.period_totals.billed)}</td>
                      <td className="px-4 py-2.5 font-bold" style={{ color: '#16a34a' }}>{fmtINR(ledger.period_totals.paid + ledger.period_totals.returned)}</td>
                      <td className="px-4 py-2.5 font-extrabold" style={{ color: balanceColor(ledger.closing_balance) }}>{balanceText(ledger.closing_balance)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
