import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProducts, getCategories, createCreditBill, getCreditBills, payCreditBill, deleteCreditBill } from '../api/client';

// ── Colour palette ────────────────────────────────────────────────────────────
const B = {
  darkBrown:  '#2d1a0e', midBrown: '#4a2c0a', brown: '#3d2008',
  gold:       '#d4a017', goldLight: '#f5c842', goldDark: '#b8860b',
  cream:      '#fdf6e3', text: '#7a4e08', textLight: '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:     'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const fmt  = (n) => parseFloat(n || 0).toFixed(2);
const fmtN = (n) => parseFloat(n || 0).toLocaleString('en-IN');

function getEmoji(name = '') {
  const n = name.toLowerCase();
  if (/tea|chai/.test(n))       return '🍵';
  if (/coffee|cappuccino|latte/.test(n)) return '☕';
  if (/juice|lemon|lime/.test(n)) return '🥤';
  if (/cake|pastry|dessert/.test(n)) return '🎂';
  if (/bread|toast|sandwich/.test(n)) return '🍞';
  if (/biscuit|cookie/.test(n)) return '🍪';
  if (/milk|shake/.test(n))     return '🥛';
  if (/snack|chips/.test(n))    return '🍿';
  return '🏷️';
}

const STATUS_COLORS = {
  pending: { bg: '#fff3cd', text: '#856404', border: '#ffc107' },
  partial: { bg: '#d1ecf1', text: '#0c5460', border: '#bee5eb' },
  paid:    { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CreditBills() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // Tabs: 'list' | 'new'
  const [tab, setTab] = useState('list');

  // List state
  const [bills, setBills]         = useState([]);
  const [summary, setSummary]     = useState({});
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError]   = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [mobileSearch, setMobileSearch] = useState('');

  // Pay modal state
  const [payBill, setPayBill]     = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError]   = useState('');

  // Expand/collapse
  const [expanded, setExpanded]   = useState({});

  // New bill state
  const [products, setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [selCategory, setSelCategory] = useState('all');
  const [searchQ, setSearchQ]     = useState('');
  const [cart, setCart]           = useState([]);
  const [custName, setCustName]   = useState('');
  const [custMobile, setCustMobile] = useState('');
  const [discount, setDiscount]   = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes]         = useState('');
  const [newLoading, setNewLoading] = useState(false);
  const [newError, setNewError]   = useState('');
  const [newSuccess, setNewSuccess] = useState('');

  // ── Fetch bills ─────────────────────────────────────────────────────────────
  const fetchBills = useCallback(async () => {
    setListLoading(true); setListError('');
    try {
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (mobileSearch.trim()) params.mobile = mobileSearch.trim();
      const res = await getCreditBills(params);
      setBills(res.data.credit_bills || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      if (err.response?.status === 401) { signOut(); navigate('/login'); }
      setListError('Failed to load credit bills.');
    } finally { setListLoading(false); }
  }, [filterStatus, mobileSearch, navigate, signOut]);

  useEffect(() => { if (tab === 'list') fetchBills(); }, [tab, fetchBills]);

  // ── Fetch products for new bill ─────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'new') return;
    Promise.all([getProducts(), getCategories()])
      .then(([pr, cr]) => {
        setProducts(pr.data.products || []);
        setCategories(cr.data.categories || []);
      })
      .catch(() => {});
  }, [tab]);

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const subtotal    = cart.reduce((s, i) => s + parseFloat(i.selling_price) * i.quantity, 0);
  const discountVal = parseFloat(discount) || 0;
  const grandTotal  = Math.max(0, subtotal - discountVal);
  const paidVal     = parseFloat(amountPaid) || 0;
  const balanceDue  = Math.max(0, grandTotal - paidVal);

  const filteredProducts = products.filter(p => {
    const matchCat = selCategory === 'all' || String(p.category_id) === selCategory;
    const matchQ   = !searchQ || p.name.toLowerCase().includes(searchQ.toLowerCase());
    return p.active && matchCat && matchQ;
  });

  // ── Submit new credit bill ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setNewError(''); setNewSuccess('');
    if (!custName.trim()) { setNewError('Customer name is required'); return; }
    if (!custMobile.trim()) { setNewError('Mobile number is required'); return; }
    if (cart.length === 0) { setNewError('Add at least one item'); return; }
    setNewLoading(true);
    try {
      const res = await createCreditBill({
        customer_name:   custName.trim(),
        customer_mobile: custMobile.trim(),
        items:           cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
        discount_total:  discountVal,
        amount_paid:     paidVal,
        notes:           notes.trim() || undefined,
      });
      const inv = res.data.invoice_number;
      setNewSuccess(`Credit bill ${inv} created!`);
      setCart([]); setCustName(''); setCustMobile(''); setDiscount(''); setAmountPaid(''); setNotes('');
      setTimeout(() => { setTab('list'); setNewSuccess(''); }, 1500);
    } catch (err) {
      setNewError(err.response?.data?.detail || 'Failed to create credit bill.');
    } finally { setNewLoading(false); }
  };

  // ── Pay ──────────────────────────────────────────────────────────────────────
  const handlePay = async () => {
    setPayError('');
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { setPayError('Enter a valid amount'); return; }
    setPayLoading(true);
    try {
      await payCreditBill(payBill.id, { amount: amt });
      setPayBill(null); setPayAmount('');
      fetchBills();
    } catch (err) {
      setPayError(err.response?.data?.detail || 'Payment failed');
    } finally { setPayLoading(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (bill) => {
    if (!window.confirm(`Delete credit bill ${bill.invoice_number}? This cannot be undone.`)) return;
    try {
      await deleteCreditBill(bill.id);
      fetchBills();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed');
    }
  };

  const inputSty = {
    background: '#fff9ee', border: `1.5px solid ${B.gold}`, color: B.brown,
    borderRadius: 10, padding: '9px 13px', fontSize: 14, outline: 'none',
  };

  return (
    <div className="min-h-screen" style={{ background: B.pageGrad }}>

      {/* ── Navbar ── */}
      <nav className="px-6 py-3 shadow-lg flex items-center justify-between"
        style={{ background: B.bgGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Crown Tea Hub"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            style={{ border: `2px solid ${B.gold}` }} />
          <div>
            <h1 className="text-base font-extrabold uppercase leading-tight"
              style={{ color: B.goldLight, fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>
              Crown Tea Hub
            </h1>
            <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Bakery &amp; Café</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
          <span className="text-xs font-bold px-3 py-1 rounded-full"
            style={{ background: 'rgba(212,160,23,0.25)', color: B.goldLight, border: '1px solid rgba(212,160,23,0.5)' }}>
            {user?.role}
          </span>
          <button onClick={() => navigate('/dashboard')}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'rgba(212,160,23,0.15)', color: B.goldLight, border: `1px solid rgba(212,160,23,0.4)` }}>
            Dashboard
          </button>
          <button onClick={() => { signOut(); navigate('/login'); }}
            className="text-sm font-bold px-4 py-1.5 rounded-lg active:scale-95 transition-all"
            style={{ background: B.goldGrad, color: B.brown }}>
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto mt-8 px-4 pb-12 space-y-6">

        {/* ── Header + tabs ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>
              Credit Bills
            </h2>
            <p className="text-sm mt-0.5" style={{ color: B.textLight }}>Manage customer credit / outstanding bills</p>
          </div>
          <div className="flex gap-2">
            {[{ key: 'list', label: 'All Bills' }, { key: 'new', label: '+ New Credit Bill' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="font-bold px-5 py-2.5 rounded-xl text-sm active:scale-95 transition-all"
                style={tab === t.key
                  ? { background: B.goldGrad, color: B.brown }
                  : { background: 'white', border: B.goldBorder, color: B.text }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════ LIST TAB ══════════════════ */}
        {tab === 'list' && (
          <>
            {/* Summary cards */}
            {summary.total_bills > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <SCard label="Total Bills"    value={fmtN(summary.total_bills)}            icon="📋" />
                <SCard label="Total Amount"   value={`₹${fmt(summary.total_amount)}`}      icon="💳" />
                <SCard label="Balance Due"    value={`₹${fmt(summary.total_due)}`}         icon="⏳" red />
                <SCard label="Collected"      value={`₹${fmt(summary.total_collected)}`}   icon="✅" />
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex gap-2">
                {[{ v: 'pending', l: 'Pending' }, { v: 'partial', l: 'Partial' }, { v: 'paid', l: 'Paid' }, { v: 'all', l: 'All' }].map(f => (
                  <button key={f.v} onClick={() => setFilterStatus(f.v)}
                    className="px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                    style={filterStatus === f.v
                      ? { background: B.goldGrad, color: B.brown }
                      : { background: 'white', border: B.goldBorder, color: B.text }}>
                    {f.l}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-1 min-w-[200px]">
                <input type="tel" placeholder="Search by mobile..." value={mobileSearch}
                  onChange={e => setMobileSearch(e.target.value)}
                  style={{ ...inputSty, flex: 1 }} />
                <button onClick={fetchBills}
                  className="px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-all"
                  style={{ background: B.goldGrad, color: B.brown }}>
                  Search
                </button>
              </div>
            </div>

            {listError && <ErrBox msg={listError} />}
            {listLoading && <div className="py-16 text-center text-lg font-medium" style={{ color: B.textLight }}>Loading...</div>}

            {!listLoading && bills.length === 0 && (
              <div className="py-16 text-center rounded-2xl" style={{ background: 'white', border: B.goldBorder }}>
                <div className="text-5xl mb-3">📋</div>
                <p className="font-bold" style={{ color: B.text }}>No credit bills found</p>
                <p className="text-sm mt-1" style={{ color: B.textLight }}>Create a new one using "+ New Credit Bill"</p>
              </div>
            )}

            {/* Bills list */}
            <div className="space-y-3">
              {bills.map(bill => {
                const sc = STATUS_COLORS[bill.status] || STATUS_COLORS.pending;
                const isExp = expanded[bill.id];
                return (
                  <div key={bill.id} className="rounded-2xl overflow-hidden shadow-sm"
                    style={{ border: B.goldBorder, background: 'white' }}>
                    {/* Header row */}
                    <div className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-extrabold"
                          style={{ background: B.goldGrad, color: B.brown }}>
                          {(bill.customer_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: B.text }}>{bill.customer_name}</p>
                          <p className="text-sm" style={{ color: B.textLight }}>📱 {bill.customer_mobile}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#aaa' }}>
                            {bill.invoice_number} · {new Date(bill.bill_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="text-xs font-bold px-3 py-1 rounded-full border"
                          style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
                          {bill.status.toUpperCase()}
                        </span>
                        <div className="text-right">
                          <p className="font-extrabold" style={{ color: B.text }}>₹{fmt(bill.grand_total)}</p>
                          {parseFloat(bill.balance_due) > 0 && (
                            <p className="text-xs font-bold" style={{ color: '#c62828' }}>Due: ₹{fmt(bill.balance_due)}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expand row */}
                    <div className="px-5 pb-4 flex gap-2 flex-wrap">
                      <button onClick={() => setExpanded(p => ({ ...p, [bill.id]: !p[bill.id] }))}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg active:scale-95"
                        style={{ background: '#fff9ee', border: B.goldBorder, color: B.textLight }}>
                        {isExp ? 'Hide Items ▲' : 'Show Items ▼'}
                      </button>
                      {bill.status !== 'paid' && (
                        <button onClick={() => { setPayBill(bill); setPayAmount(fmt(bill.balance_due)); setPayError(''); }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                          style={{ background: B.goldGrad, color: B.brown }}>
                          Record Payment
                        </button>
                      )}
                      <button onClick={() => handleDelete(bill)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95"
                        style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
                        Delete
                      </button>
                    </div>

                    {/* Items */}
                    {isExp && (
                      <div className="px-5 pb-4 space-y-1.5"
                        style={{ borderTop: '1px solid #e8d5a3' }}>
                        <table className="w-full text-sm mt-3">
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${B.gold}` }}>
                              {['Item', 'Qty', 'Rate', 'Amount'].map(h => (
                                <th key={h} className="pb-1.5 text-left text-xs font-bold uppercase tracking-wider pr-3"
                                  style={{ color: B.textLight }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(bill.items || []).map((it, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f0e8d0' }}>
                                <td className="py-1.5 pr-3 font-medium" style={{ color: B.text }}>
                                  {getEmoji(it.product_name)} {it.product_name}
                                </td>
                                <td className="py-1.5 pr-3" style={{ color: B.textLight }}>{fmtN(it.quantity)}</td>
                                <td className="py-1.5 pr-3" style={{ color: B.textLight }}>₹{fmt(it.unit_price)}</td>
                                <td className="py-1.5 font-bold" style={{ color: B.text }}>₹{fmt(it.line_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="flex justify-between text-sm pt-2" style={{ color: B.textLight }}>
                          <span>Subtotal</span><span>₹{fmt(bill.subtotal)}</span>
                        </div>
                        {parseFloat(bill.discount_total) > 0 && (
                          <div className="flex justify-between text-sm text-red-600">
                            <span>Discount</span><span>-₹{fmt(bill.discount_total)}</span>
                          </div>
                        )}
                        {parseFloat(bill.amount_paid) > 0 && (
                          <div className="flex justify-between text-sm" style={{ color: '#2e7d32' }}>
                            <span>Amount Paid</span><span>₹{fmt(bill.amount_paid)}</span>
                          </div>
                        )}
                        {bill.notes && (
                          <p className="text-xs mt-1 italic" style={{ color: '#888' }}>Note: {bill.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ══════════════════ NEW BILL TAB ══════════════════ */}
        {tab === 'new' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* ── Left: product picker ── */}
            <div className="lg:col-span-3 space-y-4">

              {/* Customer details */}
              <Card title="Customer Details" subtitle="Name and mobile are required">
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
                      Customer Name *
                    </label>
                    <input type="text" value={custName} onChange={e => setCustName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar" style={{ ...inputSty, width: '100%' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
                      Mobile Number *
                    </label>
                    <input type="tel" value={custMobile} onChange={e => setCustMobile(e.target.value)}
                      placeholder="e.g. 9876543210" maxLength={15} style={{ ...inputSty, width: '100%' }} />
                  </div>
                </div>
              </Card>

              {/* Product search + category filter */}
              <Card title="Add Items" subtitle="Tap a product to add to the credit bill">
                <div className="mt-3 space-y-3">
                  <input type="text" placeholder="Search products..." value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    style={{ ...inputSty, width: '100%' }} />

                  {/* Category chips */}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setSelCategory('all')}
                      className="px-3 py-1.5 rounded-full text-xs font-bold active:scale-95"
                      style={selCategory === 'all'
                        ? { background: B.goldGrad, color: B.brown }
                        : { background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                      All
                    </button>
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setSelCategory(String(c.id))}
                        className="px-3 py-1.5 rounded-full text-xs font-bold active:scale-95"
                        style={selCategory === String(c.id)
                          ? { background: B.goldGrad, color: B.brown }
                          : { background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                        {c.name}
                      </button>
                    ))}
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => addToCart(p)}
                        className="rounded-xl p-3 text-left active:scale-95 transition-transform"
                        style={{ background: '#fff9ee', border: B.goldBorder }}>
                        <div className="text-2xl mb-1">{getEmoji(p.name)}</div>
                        <p className="text-xs font-bold leading-tight" style={{ color: B.text }}>{p.name}</p>
                        <p className="text-sm font-extrabold mt-1" style={{ color: B.goldDark }}>₹{fmt(p.selling_price)}</p>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="col-span-3 text-center py-8 text-sm" style={{ color: B.textLight }}>No products found</p>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* ── Right: credit bill summary ── */}
            <div className="lg:col-span-2 space-y-4">
              <Card title="Credit Bill" subtitle="Items to be added on credit">
                {cart.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: B.textLight }}>No items added yet</p>
                ) : (
                  <div className="space-y-2 mt-3 max-h-60 overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                        style={{ background: '#fff9ee', border: B.goldBorder }}>
                        <span className="text-xs font-bold flex-1 truncate" style={{ color: B.text }}>
                          {getEmoji(item.name)} {item.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="w-6 h-6 rounded-full text-sm font-bold active:scale-90"
                            style={{ background: B.goldGrad, color: B.brown }}>−</button>
                          <span className="text-xs font-bold w-5 text-center" style={{ color: B.text }}>
                            {item.quantity}
                          </span>
                          <button onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="w-6 h-6 rounded-full text-sm font-bold active:scale-90"
                            style={{ background: B.goldGrad, color: B.brown }}>+</button>
                        </div>
                        <span className="text-xs font-extrabold w-14 text-right" style={{ color: B.goldDark }}>
                          ₹{fmt(parseFloat(item.selling_price) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between" style={{ color: B.textLight }}>
                    <span>Subtotal</span><span>₹{fmt(subtotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-shrink-0" style={{ color: B.textLight }}>Discount (₹)</span>
                    <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                      placeholder="0" min="0" style={{ ...inputSty, flex: 1, padding: '5px 10px', fontSize: 13 }} />
                  </div>
                  <div className="flex justify-between font-bold text-base border-t pt-2" style={{ borderColor: B.gold, color: B.text }}>
                    <span>Grand Total</span>
                    <span style={{ color: B.goldDark }}>₹{fmt(grandTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm flex-shrink-0" style={{ color: '#2e7d32' }}>Amount Paid (₹)</span>
                    <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                      placeholder="0" min="0" max={grandTotal}
                      style={{ ...inputSty, flex: 1, padding: '5px 10px', fontSize: 13, borderColor: '#4caf50' }} />
                  </div>
                  <div className="flex justify-between font-extrabold text-base rounded-xl px-3 py-2"
                    style={{ background: balanceDue > 0 ? '#fff3cd' : '#d4edda',
                      color: balanceDue > 0 ? '#856404' : '#155724',
                      border: `1px solid ${balanceDue > 0 ? '#ffc107' : '#c3e6cb'}` }}>
                    <span>Balance Due</span>
                    <span>₹{fmt(balanceDue)}</span>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3">
                  <label className="block text-xs font-bold mb-1 uppercase tracking-wide" style={{ color: B.textLight }}>
                    Notes (optional)
                  </label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Delivery scheduled for Friday" rows={2}
                    style={{ ...inputSty, width: '100%', resize: 'none' }} />
                </div>

                {newError   && <ErrBox msg={newError} />}
                {newSuccess && (
                  <div className="rounded-xl px-4 py-3 text-sm font-bold text-center"
                    style={{ background: '#d4edda', border: '1px solid #c3e6cb', color: '#155724' }}>
                    {newSuccess}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={newLoading || cart.length === 0}
                  className="w-full mt-3 font-bold py-3 rounded-xl text-sm uppercase tracking-wider active:scale-95 transition-all"
                  style={{ background: (newLoading || cart.length === 0) ? '#e8d5a3' : B.goldGrad,
                    color: (newLoading || cart.length === 0) ? '#999' : B.brown }}>
                  {newLoading ? 'Saving...' : 'Save Credit Bill'}
                </button>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* ── Pay Modal ── */}
      {payBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            style={{ border: B.goldBorder }}>
            <div className="h-1" style={{ background: B.goldGrad }} />
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: B.bgGrad }}>
              <h3 className="font-bold text-base" style={{ color: B.goldLight }}>Record Payment</h3>
              <button onClick={() => setPayBill(null)} style={{ color: B.goldLight }}>✕</button>
            </div>
            <div className="p-5 space-y-4" style={{ background: 'white' }}>
              <div>
                <p className="font-bold" style={{ color: B.text }}>{payBill.customer_name}</p>
                <p className="text-sm" style={{ color: B.textLight }}>📱 {payBill.customer_mobile}</p>
                <p className="text-sm mt-1">Outstanding: <span className="font-extrabold" style={{ color: '#c62828' }}>₹{fmt(payBill.balance_due)}</span></p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: B.text }}>Amount Received (₹)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  style={{ ...inputSty, width: '100%' }} min="0" max={payBill.balance_due} />
                {/* Quick buttons */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[payBill.balance_due].concat(
                    [50, 100, 200, 500].filter(v => v < parseFloat(payBill.balance_due))
                  ).slice(0, 4).map(v => (
                    <button key={v} onClick={() => setPayAmount(fmt(v))}
                      className="px-3 py-1 text-sm font-semibold rounded-lg active:scale-95"
                      style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                      ₹{fmt(v)}
                    </button>
                  ))}
                </div>
              </div>
              {payError && <ErrBox msg={payError} />}
              <div className="flex gap-3">
                <button onClick={() => setPayBill(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: '#f5f5f5', color: '#555' }}>
                  Cancel
                </button>
                <button onClick={handlePay} disabled={payLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold active:scale-95"
                  style={{ background: B.goldGrad, color: B.brown }}>
                  {payLoading ? 'Saving...' : 'Confirm Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helper components ─────────────────────────────────────────────────────────

function SCard({ label, value, icon, red }) {
  return (
    <div className="rounded-2xl p-4 shadow-sm" style={{ background: 'white', border: B.goldBorder }}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: B.textLight }}>{label}</p>
      </div>
      <p className="text-xl font-extrabold" style={{ color: red ? '#c62828' : B.goldDark }}>{value}</p>
    </div>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl shadow-md overflow-hidden" style={{ border: B.goldBorder }}>
      <div className="h-1" style={{ background: B.goldGrad }} />
      <div className="px-5 py-3" style={{ background: B.bgGrad }}>
        <h3 className="font-bold text-base" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#c8a84b' }}>{subtitle}</p>}
      </div>
      <div className="p-5" style={{ background: 'white' }}>{children}</div>
    </div>
  );
}

function ErrBox({ msg }) {
  return (
    <div className="rounded-xl px-4 py-2.5 text-sm font-medium"
      style={{ background: '#fff0f0', border: '1px solid #e57373', color: '#c62828' }}>
      {msg}
    </div>
  );
}
