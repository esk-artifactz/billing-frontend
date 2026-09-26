import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPurchaseOrders, getPurchaseOrder, receivePurchaseOrder, deletePurchaseOrder } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
};

const STATUS_META = {
  open:     { label: 'Open',     color: '#1d4ed8', bg: '#dbeafe' },
  partial:  { label: 'Partial',  color: '#d97706', bg: '#fef3c7' },
  received: { label: 'Received', color: '#16a34a', bg: '#dcfce7' },
};

function statusBadge(status) {
  const m = STATUS_META[status] || { label: status, color: '#555', bg: '#f3f4f6' };
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

export default function ReceiveStock() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState('open');
  const [orders,       setOrders]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  // Selected PO for receiving
  const [selectedPO,   setSelectedPO]   = useState(null); // full PO with items
  const [loadingPO,    setLoadingPO]    = useState(false);
  // received quantities per item: { [po_item_id]: qty_string }
  const [recvQty,      setRecvQty]      = useState({});
  const [recvNotes,    setRecvNotes]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState('');

  const [toast, setToast] = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };
  const handleLogout = () => { signOut(); navigate('/login'); };

  // ── Load PO list ───────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (sf) => {
    setLoading(true); setError('');
    try {
      const res = await getPurchaseOrders(sf);
      setOrders(res.data.purchase_orders || []);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); }
      setError('Failed to load purchase orders.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);

  useEffect(() => { loadOrders(statusFilter); }, [statusFilter, loadOrders]);

  // ── Select a PO to receive ─────────────────────────────────────────────────
  const openPO = async (id) => {
    setLoadingPO(true); setSaveError(''); setRecvNotes('');
    try {
      const res = await getPurchaseOrder(id);
      const po  = res.data.purchase_order;
      setSelectedPO(po);
      // Pre-fill remaining qty for each item
      const init = {};
      po.items.forEach(item => {
        const remaining = Math.max(0, parseFloat(item.ordered_qty) - parseFloat(item.received_qty || 0));
        init[item.id] = remaining > 0 ? String(remaining) : '';
      });
      setRecvQty(init);
    } catch {
      showToast('Failed to load PO details.', false);
    } finally { setLoadingPO(false); }
  };

  const closePO = () => { setSelectedPO(null); setRecvQty({}); setSaveError(''); };

  // ── Submit receive ─────────────────────────────────────────────────────────
  const handleReceive = async () => {
    const items = selectedPO.items
      .map(item => ({ po_item_id: item.id, received_qty: parseFloat(recvQty[item.id] || 0) }))
      .filter(i => i.received_qty > 0);

    if (items.length === 0) {
      setSaveError('Enter received quantity for at least one item.');
      return;
    }

    setSaving(true); setSaveError('');
    try {
      await receivePurchaseOrder(selectedPO.id, { items, notes: recvNotes || null });
      showToast(`Stock received for PO ${selectedPO.po_number}!`);
      closePO();
      loadOrders(statusFilter);
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to receive stock.');
    } finally { setSaving(false); }
  };

  // ── Delete PO ──────────────────────────────────────────────────────────────
  const handleDelete = async (po) => {
    if (!window.confirm(`Delete PO ${po.po_number}? This cannot be undone.`)) return;
    try {
      await deletePurchaseOrder(po.id);
      showToast(`PO ${po.po_number} deleted.`);
      loadOrders(statusFilter);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete.', false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const poItemProgress = (item) => {
    const ord  = parseFloat(item.ordered_qty);
    const recv = parseFloat(item.received_qty || 0);
    return ord > 0 ? Math.min(100, Math.round((recv / ord) * 100)) : 0;
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg, ${B.cream} 0%, ${B.creamMid} 60%, #ede0c4 100%)` }}>

      {/* Navbar */}
      <nav className="text-white px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${B.darkBrown} 0%, ${B.midBrown} 50%, ${B.brown} 100%)`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Receive Stock</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/purchase-order')}
            className="text-sm font-semibold px-3 py-1.5 rounded-lg transition-all active:scale-95 mr-1"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Create PO
          </button>
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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${B.darkBrown}, #5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
                Receive Stock Against Purchase Orders
              </h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Select a purchase order, enter received quantities, and update stock
              </p>
            </div>
            <button onClick={() => navigate('/purchase-order')}
              className="font-bold px-5 py-2 rounded-xl text-sm transition-all active:scale-95 flex-shrink-0"
              style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
              + Create New PO
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap">
          {['open', 'partial', 'received', 'all'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className="px-4 py-2 rounded-xl text-sm font-bold capitalize transition-all"
              style={{
                background: statusFilter === s ? (STATUS_META[s]?.color || B.gold) : '#fff',
                color:      statusFilter === s ? '#fff' : '#7a4e08',
                border:     `2px solid ${STATUS_META[s]?.color || '#e8d5a3'}`,
              }}>
              {s === 'all' ? 'All Orders' : STATUS_META[s]?.label || s}
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</div>}

        {/* PO List */}
        <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16" style={{ color: '#a07020' }}>
              <p className="text-lg font-semibold">No {statusFilter !== 'all' ? statusFilter : ''} purchase orders</p>
              <p className="text-sm mt-2">
                <button onClick={() => navigate('/purchase-order')} className="underline font-semibold" style={{ color: B.gold }}>
                  Create a purchase order
                </button> to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                    {['PO Number', 'Brand', 'Supplier', 'Items', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                        style={{ color: B.goldLight }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((po, idx) => {
                    const totalOrdered  = po.items.reduce((s, i) => s + parseFloat(i.ordered_qty), 0);
                    const totalReceived = po.items.reduce((s, i) => s + parseFloat(i.received_qty || 0), 0);
                    const pct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                    return (
                      <tr key={po.id}
                        style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color: B.brown }}>{po.po_number}</td>
                        <td className="px-4 py-3 text-xs font-semibold" style={{ color: '#7a4e08' }}>{po.brand || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{po.supplier_name || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="text-xs font-semibold" style={{ color: B.brown }}>
                            {po.items.length} product{po.items.length !== 1 ? 's' : ''}
                          </div>
                          {/* Progress bar */}
                          <div className="mt-1 w-28 h-1.5 rounded-full overflow-hidden" style={{ background: '#e8d5a3' }}>
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#d97706' }} />
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{pct}% received</div>
                        </td>
                        <td className="px-4 py-3">{statusBadge(po.status)}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>
                          {po.created_at ? new Date(po.created_at).toLocaleDateString('en-IN') : '—'}
                          <div className="text-gray-400">{po.created_by}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {po.status !== 'received' && (
                              <button onClick={() => openPO(po.id)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                                Receive
                              </button>
                            )}
                            {po.status === 'received' && (
                              <button onClick={() => openPO(po.id)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                style={{ background: '#f3f4f6', color: '#374151' }}>
                                View
                              </button>
                            )}
                            {po.status === 'open' && (
                              <button onClick={() => handleDelete(po)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                                style={{ background: '#fee2e2', color: '#dc2626' }}>
                                Delete
                              </button>
                            )}
                          </div>
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

      {/* ━━━━━━━━━ Receive Modal ━━━━━━━━━ */}
      {(selectedPO || loadingPO) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: 'rgba(45,26,14,0.6)' }}>
          <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1 flex-shrink-0" style={{ background: `linear-gradient(90deg, #b8860b, ${B.goldLight}, #b8860b)` }} />

            {loadingPO ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
              </div>
            ) : selectedPO && (
              <>
                {/* Modal header */}
                <div className="p-5 border-b flex-shrink-0" style={{ borderColor: '#f0e0c0' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold" style={{ color: B.brown }}>
                        {selectedPO.status === 'received' ? 'View' : 'Receive Stock'} — {selectedPO.po_number}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs" style={{ color: '#a07020' }}>
                        {selectedPO.brand && <span>Brand: <strong>{selectedPO.brand}</strong></span>}
                        {selectedPO.supplier_name && <span>· Supplier: <strong>{selectedPO.supplier_name}</strong></span>}
                        <span>· {statusBadge(selectedPO.status)}</span>
                      </div>
                      {selectedPO.notes && (
                        <p className="text-xs mt-1 italic" style={{ color: '#a07020' }}>{selectedPO.notes}</p>
                      )}
                    </div>
                    <button onClick={closePO} className="text-2xl font-bold flex-shrink-0" style={{ color: '#a07020' }}>×</button>
                  </div>
                </div>

                {/* Items */}
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0">
                      <tr style={{ background: `linear-gradient(90deg, ${B.darkBrown}, ${B.midBrown})` }}>
                        {['Product', 'Unit', 'Ordered', 'Already Received', 'Remaining', 'Receive Now'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            style={{ color: B.goldLight }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => {
                        const ordered   = parseFloat(item.ordered_qty);
                        const prevRecv  = parseFloat(item.received_qty || 0);
                        const remaining = Math.max(0, ordered - prevRecv);
                        const pct       = poItemProgress(item);
                        const fullyRecv = prevRecv >= ordered;
                        return (
                          <tr key={item.id}
                            style={{ background: idx % 2 === 0 ? '#fff' : '#fffbf2', borderBottom: '1px solid #f0e0c0' }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: B.darkBrown }}>
                              {item.product_name}
                              {item.purchase_price && (
                                <div className="text-xs text-gray-400">₹{parseFloat(item.purchase_price).toFixed(2)}/unit</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs" style={{ color: '#7a4e08' }}>{item.unit}</td>
                            <td className="px-4 py-3 font-semibold text-center" style={{ color: B.brown }}>{ordered}</td>
                            <td className="px-4 py-3">
                              <div className="text-center font-semibold" style={{ color: fullyRecv ? '#16a34a' : '#d97706' }}>
                                {prevRecv}
                              </div>
                              <div className="mt-1 w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#e8d5a3' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fullyRecv ? '#16a34a' : '#d97706' }} />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold" style={{ color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                              {remaining}
                            </td>
                            <td className="px-4 py-3">
                              {selectedPO.status === 'received' ? (
                                <span className="text-xs text-gray-400 italic">Fully received</span>
                              ) : (
                                <input
                                  type="number" min="0" step="any"
                                  value={recvQty[item.id] ?? ''}
                                  onChange={e => setRecvQty(q => ({ ...q, [item.id]: e.target.value }))}
                                  placeholder="0"
                                  className="w-24 border-2 rounded-lg px-2 py-1.5 text-sm outline-none text-center"
                                  style={{ borderColor: recvQty[item.id] > 0 ? B.gold : '#e8d5a3' }}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                {selectedPO.status !== 'received' && (
                  <div className="p-4 border-t flex-shrink-0 space-y-3" style={{ borderColor: '#f0e0c0' }}>
                    {saveError && (
                      <div className="px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>
                        {saveError}
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-bold mb-1 block" style={{ color: B.brown }}>Notes (optional)</label>
                      <input type="text" value={recvNotes} onChange={e => setRecvNotes(e.target.value)}
                        className="w-full border-2 rounded-xl px-3 py-2 text-sm outline-none"
                        style={{ borderColor: '#e8d5a3' }} placeholder="Delivery note no., remarks…" />
                    </div>
                    <div className="flex gap-3">
                      <button onClick={closePO}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f5f5f5', color: '#555' }}>
                        Cancel
                      </button>
                      <button onClick={handleReceive} disabled={saving}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
                        style={{ background: `linear-gradient(135deg, #b8860b, ${B.gold}, ${B.goldLight})`, color: B.darkBrown }}>
                        {saving ? 'Updating Stock…' : 'Confirm & Update Stock'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
