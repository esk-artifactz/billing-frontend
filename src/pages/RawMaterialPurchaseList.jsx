import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRawMaterialStock } from '../api/client';

const B = {
  darkBrown: '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold: '#d4a017', goldLight: '#f5c842', cream: '#fdf6e3', creamMid: '#f5ead0',
  text: '#7a4e08', textLight: '#a07020',
};

const fmtINR = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtQty = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const todayLabel = () => new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });

// Suggested quantity: bring stock back up to 2 × the alert level
// (or 1 unit when no alert level is set and the item has run out)
const suggestQty = (it) => {
  const min = parseFloat(it.min_stock || 0);
  const have = Math.max(parseFloat(it.in_stock || 0), 0);
  const target = min > 0 ? min * 2 : 1;
  return Math.max(Math.ceil((target - have) * 100) / 100, 0);
};

export default function RawMaterialPurchaseList() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [items, setItems]     = useState([]);   // low-stock rows with editable buy qty
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState(null);
  const [supItem, setSupItem] = useState(null); // item whose suppliers popup is open
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getRawMaterialStock();
      const low = (res.data.items || []).filter(i => i.active && i.low_stock)
        .sort((a, b) => (parseFloat(a.in_stock) > 0) - (parseFloat(b.in_stock) > 0) || a.name.localeCompare(b.name));
      setItems(low.map(i => ({ ...i, pick: true, buy_qty: String(suggestQty(i)) })));
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); return; }
      setError('Failed to load raw material stock.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);
  useEffect(() => { load(); }, [load]);

  const setRow = (id, field, val) => setItems(list => list.map(r => (r.id === id ? { ...r, [field]: val } : r)));
  const picked = items.filter(r => r.pick && parseFloat(r.buy_qty) > 0);

  const copyList = async () => {
    const text = [
      `Crown Tea Hub — Items to buy (${todayLabel()})`,
      ...picked.map((r, i) => `${i + 1}. ${r.name} — ${fmtQty(r.buy_qty)} ${r.unit}`),
    ].join('\n');
    try { await navigator.clipboard.writeText(text); showToast('List copied — paste it in WhatsApp / SMS'); }
    catch { showToast('Could not copy — select and copy the list manually', false); }
  };

  // Open Raw Material Stock → Add Purchase with the ticked items filled in (choose the supplier there)
  const recordPurchase = () => {
    navigate('/raw-material-stock', {
      state: {
        prefill: {
          supplier_id: '',
          lines: picked.map(r => ({ item_id: String(r.id), quantity: String(r.buy_qty), rate: r.last_rate != null ? String(r.last_rate) : '' })),
        },
      },
    });
  };

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(160deg,${B.cream} 0%,${B.creamMid} 60%,#ede0c4 100%)` }}>
      {/* Navbar */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between print:hidden"
        style={{ background: `linear-gradient(135deg,${B.darkBrown},${B.midBrown},${B.brown})`, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub" className="w-10 h-10 rounded-full object-cover border-2 flex-shrink-0" style={{ borderColor: B.gold }} />
          <div>
            <h1 className="text-lg font-extrabold tracking-widest uppercase leading-tight" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Raw Material Purchase List</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <button onClick={() => navigate('/raw-material-stock')} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Raw Material Stock</button>
          <button onClick={() => navigate('/dashboard')} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>Dashboard</button>
          <button onClick={() => { signOut(); navigate('/login'); }} className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95"
            style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: '#3d1f00' }}>Logout</button>
        </div>
      </nav>

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-white font-semibold text-sm print:hidden"
          style={{ background: toast.ok ? '#16a34a' : '#dc2626' }}>{toast.msg}</div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Header + actions */}
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <div>
            <h2 className="text-xl font-extrabold" style={{ color: B.brown, fontFamily: 'Georgia, serif' }}>Items to Buy</h2>
            <p className="text-sm" style={{ color: B.textLight }}>
              {loading ? 'Loading…' : `${picked.length} of ${items.length} item${items.length !== 1 ? 's' : ''} selected · low or out of stock`}
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex gap-2">
              <button onClick={copyList} disabled={!picked.length}
                className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ background: '#fff', border: '1px solid #d4a017', color: B.text }}>Copy List</button>
              <button onClick={() => window.print()} disabled={!picked.length}
                className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ background: B.darkBrown, color: B.goldLight }}>Print</button>
              <button onClick={recordPurchase} disabled={!picked.length}
                className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>Record Purchase →</button>
            </div>
          )}
        </div>

        {error && <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl p-10 text-center shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-lg font-bold" style={{ color: '#16a34a' }}>Nothing to buy — all raw materials are above their alert level</p>
            <p className="text-sm mt-1" style={{ color: B.textLight }}>
              Set an <strong>Alert Level</strong> for each material on Raw Material Stock → Stock in Hand, so it appears here when it runs low.
            </p>
          </div>
        ) : (
          <div id="purchase-list-print" className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <div className="hidden print:block px-4 pt-4 pb-2">
              <h2 className="text-lg font-bold">Crown Tea Hub — Items to Buy ({todayLabel()})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                  <th className="px-3 py-3 text-left print:hidden">
                    <input type="checkbox" checked={items.every(r => r.pick)}
                      onChange={e => setItems(list => list.map(r => ({ ...r, pick: e.target.checked })))} />
                  </th>
                  {['#', 'Item', 'In Stock', 'Buy Qty'].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r, idx) => (
                  <tr key={r.id} className={r.pick && parseFloat(r.buy_qty) > 0 ? '' : 'print:hidden'}
                    style={{ background: idx % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0', opacity: r.pick ? 1 : 0.45 }}>
                    <td className="px-3 py-2.5 print:hidden">
                      <input type="checkbox" checked={r.pick} onChange={e => setRow(r.id, 'pick', e.target.checked)} />
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: B.textLight }}>{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setSupItem(r)} title="See suppliers"
                        className="font-semibold text-left hover:underline" style={{ color: B.darkBrown }}>
                        {r.name}
                      </button>
                      {r.category && <div className="text-xs text-gray-400 print:hidden">{r.category}</div>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-bold" style={{ color: '#dc2626' }}>{fmtQty(r.in_stock)} {r.unit}</span>
                      <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full print:hidden" style={{ background: '#fee2e2', color: '#dc2626' }}>
                        {parseFloat(r.in_stock) <= 0 ? 'Out' : 'Low'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <input type="number" min="0" step="any" value={r.buy_qty} onChange={e => setRow(r.id, 'buy_qty', e.target.value)}
                        className="w-20 border-2 rounded-lg px-2 py-1 text-sm outline-none print:hidden" style={{ borderColor: '#e8d5a3' }} />
                      <span className="hidden print:inline font-bold">{fmtQty(r.buy_qty)}</span>
                      <span className="ml-1 text-xs" style={{ color: B.textLight }}>{r.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs print:hidden" style={{ color: B.textLight }}>
              Buy Qty is suggested to bring stock up to 2 × the alert level — change it as needed. Tap an item name to see its suppliers.
            </p>
          </div>
        )}
      </div>

      {/* Suppliers popup for one item */}
      {supItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 print:hidden" style={{ background: 'rgba(45,26,14,0.6)' }}
          onClick={ev => { if (ev.target === ev.currentTarget) setSupItem(null); }}>
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff', border: `2px solid ${B.gold}` }}>
            <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
            <div className="px-5 pt-4 pb-2 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-extrabold" style={{ color: B.brown }}>{supItem.name}</h3>
                <p className="text-xs" style={{ color: B.textLight }}>
                  In stock {fmtQty(supItem.in_stock)} {supItem.unit}
                  {supItem.min_stock != null && ` · alert at ${fmtQty(supItem.min_stock)} ${supItem.unit}`}
                </p>
              </div>
              <button onClick={() => setSupItem(null)} autoFocus className="text-2xl font-bold leading-none" style={{ color: B.textLight }}>×</button>
            </div>
            <div className="px-5 pb-5">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: B.textLight }}>Suppliers</p>
              {(supItem.suppliers || []).length === 0 ? (
                <p className="text-sm" style={{ color: B.textLight }}>
                  No supplier linked. Link one on Raw Material Stock → Stock in Hand → tap the In Stock figure → + Link supplier.
                  {supItem.last_rate != null && <><br />Last bought at {fmtINR(supItem.last_rate)}/{supItem.unit}.</>}
                </p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8d5a3' }}>
                  {[...supItem.suppliers]
                    .sort((a, b) => String(b.last_date || '').localeCompare(String(a.last_date || '')))
                    .map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2.5"
                        style={{ borderTop: i ? '1px solid #f0e0c0' : 'none', opacity: s.active === false ? 0.5 : 1 }}>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: B.darkBrown }}>
                            {s.name}{i === 0 && s.last_date && <span className="ml-1 text-xs font-bold" style={{ color: '#16a34a' }}>· last used</span>}
                          </div>
                          <div className="text-xs" style={{ color: B.textLight }}>
                            {s.last_date ? `Last bought ${String(s.last_date).slice(0, 10)}` : 'Not bought yet'}
                          </div>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap" style={{ color: B.brown }}>
                          {s.last_rate != null ? `${fmtINR(s.last_rate)}/${supItem.unit}` : '—'}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print only the list */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #purchase-list-print, #purchase-list-print * { visibility: visible !important; }
          #purchase-list-print { position: absolute; top: 0; left: 0; width: 100%; border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
