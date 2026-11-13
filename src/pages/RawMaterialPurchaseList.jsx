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

// Preferred supplier: the linked supplier bought from most recently
const preferredSupplier = (it) => {
  const list = (it.suppliers || []).filter(s => s.active !== false);
  if (!list.length) return null;
  return [...list].sort((a, b) => String(b.last_date || '').localeCompare(String(a.last_date || '')))[0];
};

export default function RawMaterialPurchaseList() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [items, setItems]     = useState([]);   // low-stock rows with editable qty / supplier / rate
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [toast, setToast]     = useState(null);
  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await getRawMaterialStock();
      const low = (res.data.items || []).filter(i => i.active && i.low_stock);
      setItems(low.map(i => {
        const sup = preferredSupplier(i);
        return {
          ...i,
          pick: true,
          buy_qty: String(suggestQty(i)),
          supplier_id: sup ? String(sup.id) : '',
          rate: String(sup?.last_rate ?? i.last_rate ?? ''),
        };
      }));
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) { signOut(); navigate('/login'); return; }
      setError('Failed to load raw material stock.');
    } finally { setLoading(false); }
  }, [navigate, signOut]);
  useEffect(() => { load(); }, [load]);

  const setRow = (id, field, val) => setItems(list => list.map(r => {
    if (r.id !== id) return r;
    const next = { ...r, [field]: val };
    if (field === 'supplier_id') {   // switch to that supplier's last rate
      const s = (r.suppliers || []).find(x => String(x.id) === String(val));
      next.rate = String(s?.last_rate ?? r.last_rate ?? '');
    }
    return next;
  }));

  const supplierName = (r) => (r.suppliers || []).find(s => String(s.id) === String(r.supplier_id))?.name || 'Local shop / no supplier';
  const picked  = items.filter(r => r.pick && parseFloat(r.buy_qty) > 0);
  const amount  = (r) => (parseFloat(r.buy_qty) || 0) * (parseFloat(r.rate) || 0);
  const total   = picked.reduce((s, r) => s + amount(r), 0);

  // Group the picked items by supplier for ordering
  const groups = Object.values(picked.reduce((acc, r) => {
    const key = r.supplier_id || 'none';
    acc[key] = acc[key] || { key, supplier_id: r.supplier_id, name: supplierName(r), rows: [] };
    acc[key].rows.push(r);
    return acc;
  }, {})).sort((a, b) => (a.key === 'none') - (b.key === 'none') || a.name.localeCompare(b.name));

  const listText = (g) => [
    `Crown Tea Hub — Purchase list (${todayLabel()})`,
    g ? `Supplier: ${g.name}` : '',
    ...(g ? g.rows : picked).map((r, i) => `${i + 1}. ${r.name} — ${fmtQty(r.buy_qty)} ${r.unit}`),
  ].filter(Boolean).join('\n');

  const copyList = async (g) => {
    try { await navigator.clipboard.writeText(listText(g)); showToast('List copied — paste it in WhatsApp / SMS'); }
    catch { showToast('Could not copy — select and copy the list manually', false); }
  };

  // Open Raw Material Stock → Add Purchase with this supplier's items filled in
  const recordPurchase = (g) => {
    navigate('/raw-material-stock', {
      state: {
        prefill: {
          supplier_id: g.supplier_id || '',
          lines: g.rows.map(r => ({ item_id: String(r.id), quantity: String(r.buy_qty), rate: r.rate === '' ? '' : String(r.rate) })),
        },
      },
    });
  };

  const inp = { borderColor: '#e8d5a3' };

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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="rounded-2xl shadow-md overflow-hidden print:hidden"
          style={{ background: `linear-gradient(135deg,${B.darkBrown},#5a3510)`, border: `1px solid ${B.gold}` }}>
          <div className="h-1" style={{ background: `linear-gradient(90deg,#b8860b,${B.goldLight},#b8860b)` }} />
          <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>Items to Purchase</h2>
              <p className="text-sm mt-1" style={{ color: '#c8a84b' }}>
                Raw materials at or below their alert level (or out of stock). Adjust quantities, then copy, print or record the purchase.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#c8a84b' }}>Estimated Cost</p>
              <p className="text-2xl font-extrabold" style={{ color: B.goldLight }}>{fmtINR(total)}</p>
              <p className="text-xs" style={{ color: '#c8a84b' }}>{picked.length} of {items.length} item{items.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
        </div>

        {error && <div className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ background: '#fee2e2', color: '#dc2626' }}>{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: B.gold, borderTopColor: 'transparent' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl p-10 text-center shadow-sm" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
            <p className="text-lg font-bold" style={{ color: '#16a34a' }}>All raw materials are above their alert level</p>
            <p className="text-sm mt-1" style={{ color: B.textLight }}>
              Set an <strong>Alert Level</strong> for each material on Raw Material Stock → Stock in Hand, so it appears here when it runs low.
            </p>
          </div>
        ) : (
          <>
            {/* All low-stock items */}
            <div className="rounded-2xl shadow-sm overflow-hidden print:hidden" style={{ background: '#fff', border: '1px solid #e8d5a3' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: `linear-gradient(90deg,${B.darkBrown},${B.midBrown})` }}>
                      <th className="px-3 py-3 text-left">
                        <input type="checkbox" checked={items.every(r => r.pick)}
                          onChange={e => setItems(list => list.map(r => ({ ...r, pick: e.target.checked })))} />
                      </th>
                      {['Material', 'In Stock', 'Alert Level', 'Buy Qty', 'Supplier', 'Rate ₹', 'Est. Cost'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: B.goldLight }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r, idx) => (
                      <tr key={r.id} style={{ background: idx % 2 ? '#fffbf2' : '#fff', borderBottom: '1px solid #f0e0c0', opacity: r.pick ? 1 : 0.5 }}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={r.pick} onChange={e => setRow(r.id, 'pick', e.target.checked)} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold" style={{ color: B.darkBrown }}>{r.name}</div>
                          {r.category && <div className="text-xs text-gray-400">{r.category}</div>}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="font-bold" style={{ color: '#dc2626' }}>{fmtQty(r.in_stock)} {r.unit}</span>
                          <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#fee2e2', color: '#dc2626' }}>
                            {parseFloat(r.in_stock) <= 0 ? 'Out' : 'Low'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                          {r.min_stock != null ? `${fmtQty(r.min_stock)} ${r.unit}` : 'not set'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <input type="number" min="0" step="any" value={r.buy_qty} onChange={e => setRow(r.id, 'buy_qty', e.target.value)}
                            className="w-20 border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp} />
                          <span className="ml-1 text-xs" style={{ color: B.textLight }}>{r.unit}</span>
                        </td>
                        <td className="px-3 py-2">
                          <select value={r.supplier_id} onChange={e => setRow(r.id, 'supplier_id', e.target.value)}
                            className="border-2 rounded-lg px-2 py-1 text-xs outline-none max-w-[170px]" style={inp}>
                            <option value="">Local shop / no supplier</option>
                            {(r.suppliers || []).filter(s => s.active !== false).map(s => (
                              <option key={s.id} value={s.id}>{s.name}{s.last_rate != null ? ` (₹${parseFloat(s.last_rate).toFixed(2)})` : ''}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={r.rate} onChange={e => setRow(r.id, 'rate', e.target.value)}
                            placeholder="—" className="w-20 border-2 rounded-lg px-2 py-1 text-sm outline-none" style={inp} />
                        </td>
                        <td className="px-3 py-2 font-bold whitespace-nowrap" style={{ color: B.brown }}>
                          {r.rate !== '' ? fmtINR(amount(r)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-xs" style={{ color: B.textLight }}>
                Buy Qty is suggested to bring stock up to 2 × the alert level. Supplier defaults to the one you last bought from; rate is their last price.
              </p>
            </div>

            {/* Grouped by supplier — order / record */}
            <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
              <h3 className="font-bold" style={{ color: B.brown }}>By Supplier</h3>
              <div className="flex gap-2">
                <button onClick={() => copyList(null)} disabled={!picked.length}
                  className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                  style={{ background: '#fff', border: '1px solid #d4a017', color: B.text }}>Copy Full List</button>
                <button onClick={() => window.print()} disabled={!picked.length}
                  className="text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-50"
                  style={{ background: B.darkBrown, color: B.goldLight }}>Print</button>
              </div>
            </div>

            <div id="purchase-list-print" className="grid md:grid-cols-2 gap-4">
              <div className="hidden print:block md:col-span-2">
                <h2 className="text-lg font-bold">Crown Tea Hub — Purchase List ({todayLabel()})</h2>
              </div>
              {groups.length === 0 && (
                <p className="text-sm print:hidden" style={{ color: B.textLight }}>Select items above to build the list.</p>
              )}
              {groups.map(g => {
                const gTotal = g.rows.reduce((s, r) => s + amount(r), 0);
                return (
                  <div key={g.key} className="rounded-2xl shadow-sm overflow-hidden" style={{ background: '#fff', border: '1px solid #e8d5a3', breakInside: 'avoid' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: '#fffbf2', borderBottom: '1px solid #e8d5a3' }}>
                      <span className="font-bold text-sm" style={{ color: B.darkBrown }}>{g.name}</span>
                      <span className="text-sm font-extrabold" style={{ color: B.brown }}>{fmtINR(gTotal)}</span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {g.rows.map(r => (
                          <tr key={r.id} style={{ borderTop: '1px solid #f0e0c0' }}>
                            <td className="px-4 py-1.5" style={{ color: B.darkBrown }}>{r.name}</td>
                            <td className="px-4 py-1.5 text-right font-semibold whitespace-nowrap">{fmtQty(r.buy_qty)} {r.unit}</td>
                            <td className="px-4 py-1.5 text-right text-xs whitespace-nowrap" style={{ color: B.textLight }}>
                              {r.rate !== '' ? fmtINR(amount(r)) : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="px-4 py-2 flex gap-2 print:hidden" style={{ borderTop: '1px solid #f0e0c0' }}>
                      <button onClick={() => copyList(g)} className="flex-1 text-xs font-bold py-1.5 rounded-lg"
                        style={{ background: '#fff9ee', border: '1px solid #e8d5a3', color: B.text }}>Copy</button>
                      <button onClick={() => recordPurchase(g)} className="flex-1 text-xs font-bold py-1.5 rounded-lg"
                        style={{ background: `linear-gradient(135deg,#b8860b,${B.gold},${B.goldLight})`, color: B.darkBrown }}>
                        Record Purchase →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Print only the grouped list */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #purchase-list-print, #purchase-list-print * { visibility: visible !important; }
          #purchase-list-print { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
