import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getProducts, getCategories,
  checkout as apiCheckout,
  holdSale, getHeldSales, getHeldSale, deleteHeldSale,
  getReceipt, createCreditBill,
} from '../api/client';
import OfflineBanner from '../components/OfflineBanner';
import Receipt from '../components/Receipt';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

// ─── Brand colours ────────────────────────────────────────────────────────────
const B = {
  darkBrown:  '#2d1a0e',
  midBrown:   '#4a2c0a',
  brown:      '#3d2008',
  gold:       '#d4a017',
  goldLight:  '#f5c842',
  goldDark:   '#b8860b',
  cream:      '#fdf6e3',
  creamMid:   '#f5ead0',
  creamDark:  '#ede0c4',
  text:       '#7a4e08',
  textLight:  '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:     'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const fmt = (n) => parseFloat(n || 0).toFixed(2);

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}
        style={{ background: B.pageGrad, border: B.goldBorder }}>
        {/* Gold top bar */}
        <div className="h-1.5 w-full flex-shrink-0" style={{ background: B.goldGrad }} />
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
          <h2 className="font-bold text-base tracking-wide" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none font-light transition-opacity hover:opacity-70"
            style={{ color: B.goldLight }}>&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ cart, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountTendered, setAmountTendered] = useState('');
  const [discount, setDiscount]             = useState('');
  const [customerName, setCustomerName]     = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const subtotal    = cart.reduce((s, i) => s + parseFloat(i.selling_price) * i.quantity, 0);
  const discountVal = parseFloat(discount) || 0;
  const grandBefore = subtotal - discountVal;
  const grandTotal  = Math.round(grandBefore);
  const roundOff    = grandTotal - grandBefore;
  const tendered    = parseFloat(amountTendered) || 0;
  const change      = paymentMethod === 'cash' ? Math.max(0, tendered - grandTotal) : 0;

  const inputStyle = {
    background: '#fff9ee', border: `1.5px solid ${B.gold}`, color: B.brown,
    borderRadius: 12, padding: '10px 14px', width: '100%', fontSize: 14, outline: 'none',
  };

  const handleCheckout = async () => {
    if (paymentMethod === 'cash' && tendered < grandTotal) { setError('Amount tendered must be ≥ grand total'); return; }
    setLoading(true); setError('');
    try {
      const res = await apiCheckout({
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, discount_amount: 0 })),
        discount_total:  discountVal,
        payment_method:  paymentMethod,
        amount_tendered: paymentMethod === 'cash' ? tendered : grandTotal,
        customer_name:   customerName.trim() || undefined,
        customer_mobile: customerMobile.trim() || undefined,
      });
      onSuccess(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Checkout failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Checkout" onClose={onClose}>
      <div className="space-y-4">

        {/* Customer (optional) */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: '#fff9ee', border: B.goldBorder }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: B.textLight }}>Customer (Optional)</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)}
              placeholder="Customer Name" style={{ ...inputStyle, padding: '8px 12px' }} />
            <input type="tel" value={customerMobile} onChange={e => setCustomerMobile(e.target.value)}
              placeholder="Mobile Number" style={{ ...inputStyle, padding: '8px 12px' }} maxLength={15} />
          </div>
        </div>

        {/* Order summary */}
        <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: '#fff9ee', border: B.goldBorder }}>
          <div className="flex justify-between" style={{ color: B.textLight }}><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
          {discountVal > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-₹{fmt(discountVal)}</span></div>}
          {roundOff !== 0 && <div className="flex justify-between text-xs" style={{ color: '#aaa' }}><span>Round Off</span><span>₹{fmt(roundOff)}</span></div>}
          <div className="flex justify-between font-bold text-lg border-t pt-2" style={{ borderColor: B.gold, color: B.text }}>
            <span>Total</span><span style={{ color: B.goldDark }}>₹{fmt(grandTotal)}</span>
          </div>
        </div>

        {/* Discount */}
        <div>
          <label className="block text-sm font-semibold mb-1.5" style={{ color: B.text }}>Discount (₹)</label>
          <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
            placeholder="0.00" min="0" style={inputStyle} />
        </div>

        {/* Payment method */}
        <div>
          <label className="block text-sm font-semibold mb-2" style={{ color: B.text }}>Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['cash', 'upi', 'card'].map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className="py-3 rounded-xl text-sm font-bold capitalize transition-all active:scale-95"
                style={paymentMethod === m
                  ? { background: B.goldGrad, color: B.brown, border: `2px solid ${B.goldDark}` }
                  : { background: '#fff9ee', color: B.text, border: `2px solid ${B.gold}` }}>
                {m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Tendered (cash only) */}
        {paymentMethod === 'cash' && (
          <div>
            <label className="block text-sm font-semibold mb-1.5" style={{ color: B.text }}>Amount Tendered (₹)</label>
            <input type="number" value={amountTendered} onChange={e => setAmountTendered(e.target.value)}
              placeholder={fmt(grandTotal)} min={grandTotal} style={inputStyle} />
            <div className="flex gap-2 mt-2 flex-wrap">
              {[grandTotal, Math.ceil(grandTotal / 10) * 10, Math.ceil(grandTotal / 50) * 50, Math.ceil(grandTotal / 100) * 100]
                .filter((v, i, a) => a.indexOf(v) === i).map(v => (
                  <button key={v} onClick={() => setAmountTendered(String(v))}
                    className="px-3 py-1 text-sm font-semibold rounded-lg transition-all active:scale-95"
                    style={{ background: '#fff9ee', border: B.goldBorder, color: B.text }}>
                    ₹{v}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Change */}
        {paymentMethod === 'cash' && tendered > 0 && (
          <div className="rounded-xl p-3 flex justify-between items-center"
            style={{ background: '#fffbe8', border: `1.5px solid ${B.gold}` }}>
            <span className="font-semibold" style={{ color: B.text }}>Change to Return</span>
            <span className="font-extrabold text-2xl" style={{ color: B.goldDark }}>₹{fmt(change)}</span>
          </div>
        )}

        {error && <p className="text-red-600 text-sm font-medium">{error}</p>}

        <button onClick={handleCheckout} disabled={loading}
          className="w-full font-bold py-3.5 rounded-xl text-base uppercase tracking-wider transition-all active:scale-95"
          style={{ background: loading ? '#c8a84b' : B.goldGrad, color: B.brown, letterSpacing: '0.1em',
            boxShadow: '0 4px 15px rgba(180,130,10,0.35)' }}>
          {loading ? 'Processing...' : `Confirm Payment  ₹${fmt(grandTotal)}`}
        </button>
      </div>
    </Modal>
  );
}

// ─── Held Bills Modal ─────────────────────────────────────────────────────────

function HeldBillsModal({ onClose, onRetrieve }) {
  const [heldSales, setHeldSales] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const res = await getHeldSales(); setHeldSales(res.data.held_sales || []); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleRetrieve = async (ref) => {
    try { const res = await getHeldSale(ref); onRetrieve(res.data); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to retrieve'); }
  };

  const handleDelete = async (ref) => {
    if (!window.confirm(`Delete held bill ${ref}?`)) return;
    setDeleting(ref);
    try { await deleteHeldSale(ref); setHeldSales(prev => prev.filter(h => h.hold_reference !== ref)); }
    catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
    finally { setDeleting(null); }
  };

  return (
    <Modal title="Held Bills" onClose={onClose} wide>
      {loading ? (
        <p className="text-center py-8" style={{ color: B.textLight }}>Loading...</p>
      ) : heldSales.length === 0 ? (
        <p className="text-center py-8" style={{ color: B.textLight }}>No held bills</p>
      ) : (
        <div className="space-y-3">
          {heldSales.map(h => (
            <div key={h.id} className="rounded-xl p-4 flex items-center justify-between gap-4"
              style={{ background: '#fff9ee', border: B.goldBorder }}>
              <div className="flex-1">
                <p className="font-bold" style={{ color: B.text }}>{h.hold_reference}</p>
                <p className="text-xs" style={{ color: B.textLight }}>Cashier: {h.cashier_username}</p>
                <p className="text-xs" style={{ color: '#aaa' }}>{new Date(h.created_at).toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold" style={{ color: B.goldDark }}>₹{fmt(h.grand_total)}</p>
                <p className="text-xs" style={{ color: '#aaa' }}>Tax: ₹{fmt(h.tax_total)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => handleRetrieve(h.hold_reference)}
                  className="text-sm font-bold px-4 py-2 rounded-lg active:scale-95 transition-all"
                  style={{ background: B.goldGrad, color: B.brown }}>
                  Retrieve
                </button>
                <button onClick={() => handleDelete(h.hold_reference)} disabled={deleting === h.hold_reference}
                  className="text-sm font-bold px-4 py-2 rounded-lg active:scale-95 transition-all"
                  style={{ background: '#fff0f0', color: '#c62828', border: '1px solid #e57373' }}>
                  {deleting === h.hold_reference ? '...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({ cart, updateQuantity, removeFromCart, onCheckout, onHold, onShowHeld, subtotal, gstTotal, grandTotal }) {
  return (
    <div className="flex flex-col h-full" style={{ background: B.cream }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
        style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
        <h2 className="font-bold text-base" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
          Cart <span style={{ color: B.gold }}>({cart.length})</span>
        </h2>
        <button onClick={onShowHeld}
          className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
          style={{ background: 'rgba(212,160,23,0.2)', color: B.goldLight, border: `1px solid ${B.gold}` }}>
          Held Bills
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="text-center py-10 text-sm" style={{ color: B.textLight }}>Cart is empty</div>
        ) : cart.map(item => (
          <div key={item.id} className="rounded-xl p-3" style={{ background: '#fff9ee', border: B.goldBorder }}>
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0 pr-2">
                <p className="font-semibold text-sm truncate" style={{ color: B.text }}>{item.name}</p>
                <p className="text-xs" style={{ color: B.textLight }}>₹{fmt(item.selling_price)} each</p>
                {item.track_stock && item.current_stock != null && parseFloat(item.current_stock) <= 0 && (
                  <p className="text-xs font-bold mt-0.5" style={{ color: '#dc2626' }}>Out of stock</p>
                )}
              </div>
              <button onClick={() => removeFromCart(item.id)}
                className="text-xl leading-none transition-opacity hover:opacity-70" style={{ color: '#c62828' }}>
                &times;
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(item.id, -1)}
                  className="w-8 h-8 rounded-full font-bold flex items-center justify-center transition-all active:scale-90"
                  style={{ background: '#e8d5a3', color: B.brown }}>−</button>
                <span className="w-8 text-center font-bold text-sm" style={{ color: B.text }}>{item.quantity}</span>
                <button onClick={() => updateQuantity(item.id, 1)}
                  className="w-8 h-8 rounded-full font-bold flex items-center justify-center transition-all active:scale-90"
                  style={{ background: B.goldGrad, color: B.brown }}>+</button>
              </div>
              <span className="font-bold text-sm" style={{ color: B.goldDark }}>
                ₹{fmt(parseFloat(item.selling_price) * item.quantity)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Totals + buttons */}
      {cart.length > 0 && (
        <div className="p-4 flex-shrink-0" style={{ borderTop: B.goldBorder, background: '#fff9ee' }}>
          <div className="space-y-1 mb-4 text-sm">
            <div className="flex justify-between" style={{ color: B.textLight }}><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
            <div className="flex justify-between" style={{ color: B.textLight }}><span>GST</span><span>₹{fmt(gstTotal)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2" style={{ borderTop: `1px dashed ${B.gold}`, color: B.text }}>
              <span>Total</span>
              <span style={{ color: B.goldDark }}>₹{Math.round(grandTotal)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onHold}
              className="flex-1 font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
              style={{ background: '#fff9ee', color: B.text, border: `2px solid ${B.gold}` }}>
              Hold Bill
            </button>
            <button onClick={onCheckout}
              className="flex-grow-[2] font-bold py-3 rounded-xl text-sm transition-all active:scale-95"
              style={{ background: B.goldGrad, color: B.brown, boxShadow: '0 3px 12px rgba(180,130,10,0.35)' }}>
              Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Billing Page ────────────────────────────────────────────────────────

export default function Billing() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart]             = useState([]);
  const [loading, setLoading]       = useState(true);

  const [showCheckout, setShowCheckout]     = useState(false);
  const [showHeld, setShowHeld]             = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [receiptData, setReceiptData]       = useState(null);
  const [holdingMsg, setHoldingMsg]         = useState('');
  const [retrievedHoldRef, setRetrievedHoldRef] = useState(null);
  const [showScanner, setShowScanner]       = useState(false);

  const searchRef = useRef(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try { const res = await getProducts(); setProducts(res.data.products || []); }
    catch { /* silent */ } finally { setLoading(false); }
  }, []);

  const fetchCategories = useCallback(async () => {
    try { const res = await getCategories(); setCategories(res.data.categories || []); }
    catch { /* silent */ }
  }, []);

  useEffect(() => { fetchProducts(); fetchCategories(); }, [fetchProducts, fetchCategories]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter' && document.activeElement === searchRef.current) {
        // Fallback for scanners that append Enter after the barcode
        const match = products.find(p => p.barcode && p.barcode === searchQuery.trim());
        if (match) { addToCart(match); setSearchQuery(''); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const filteredProducts = products.filter(p => {
    const matchCat    = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch = !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchQuery));
    return matchCat && matchSearch && p.active;
  });

  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId, delta) => {
    setCart(prev =>
      prev.map(i => i.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
          .filter(i => i.quantity > 0)
    );
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.id !== productId));

  // Camera scan result → add matching product, return status message for the modal
  const handleScanResult = (code) => {
    const match = products.find(p => p.barcode && p.barcode === code);
    if (!match) return `No product for barcode ${code}`;
    addToCart(match);
    return `Added: ${match.name}`;
  };

  const subtotal  = cart.reduce((s, i) => s + parseFloat(i.selling_price) * i.quantity, 0);
  const gstTotal  = cart.reduce((s, i) => s + parseFloat(i.selling_price) * i.quantity * parseFloat(i.gst_percentage || 0) / 100, 0);
  const grandTotal = subtotal + gstTotal;

  const handleHold = async () => {
    if (cart.length === 0) return;
    try {
      setHoldingMsg('Holding...');
      const payload = {
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, discount_amount: 0 })),
        discount_total: 0,
      };
      // Re-holding a retrieved bill updates it in place — no duplicate hold
      if (retrievedHoldRef) payload.hold_reference = retrievedHoldRef;
      const res = await holdSale(payload);
      setCart([]);
      setRetrievedHoldRef(null);
      setHoldingMsg(retrievedHoldRef ? `Updated: ${res.data.hold_reference}` : `Held: ${res.data.hold_reference}`);
      setTimeout(() => setHoldingMsg(''), 3000);
    } catch (err) {
      setHoldingMsg(err.response?.data?.detail || 'Hold failed');
      setTimeout(() => setHoldingMsg(''), 3000);
    }
  };

  const handleRetrieveHeld = ({ held_sale, items }) => {
    if (!items || !items.length) { alert('Held bill has no items.'); return; }
    const newCart = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      return product
        ? { ...product, quantity: parseFloat(item.quantity) }
        : { id: item.product_id, name: item.product_name, selling_price: item.unit_price, gst_percentage: 0, barcode: null, track_stock: false, current_stock: null, active: true, quantity: parseFloat(item.quantity) };
    });
    setCart(newCart);
    // Keep the held record on the server until checkout actually succeeds —
    // deleting it here loses the bill if checkout fails for any reason.
    setRetrievedHoldRef(held_sale.hold_reference);
    setShowHeld(false); setShowMobileCart(false);
  };

  const handleCheckoutSuccess = async (data) => {
    setShowCheckout(false); setCart([]);
    // Checkout succeeded — release the held bill if this cart came from one
    if (retrievedHoldRef) {
      try {
        await deleteHeldSale(retrievedHoldRef);
      } catch (err) {
        // 404 = already gone (fine). Anything else — tell the user to clean up.
        if (err.response?.status !== 404) {
          setHoldingMsg('Bill completed, but the held copy could not be removed — delete it from Held Bills.');
          setTimeout(() => setHoldingMsg(''), 5000);
        }
      }
      setRetrievedHoldRef(null);
    }
    if (data._queued) {
      // Bill saved locally — will sync when the network returns
      setHoldingMsg('Bill saved offline — will sync when network returns');
      setTimeout(() => setHoldingMsg(''), 5000);
      return;
    }
    try { const res = await getReceipt(data.invoice_number); setReceiptData(res.data); }
    catch { setReceiptData({ sale: data.sale, items: [] }); }
    fetchProducts();
  };

  const cartProps = {
    cart, updateQuantity, removeFromCart,
    onCheckout: () => { setShowMobileCart(false); setShowCheckout(true); },
    onHold: handleHold,
    onShowHeld: () => { setShowMobileCart(false); setShowHeld(true); },
    subtotal, gstTotal, grandTotal,
  };

  // Smart emoji picker — matches product name + category name keywords
  const getEmoji = (product) => {
    const cat = categories.find(c => c.id === product.category_id);
    const h = (product.name + ' ' + (cat ? cat.name : '')).toLowerCase();
    if (h.includes('masala tea') || h.includes('masala chai') || h.includes('chai')) return String.fromCodePoint(0x1F375);
    if (h.includes('tea'))             return String.fromCodePoint(0x1F375);  // 🍵
    if (h.includes('coffee') || h.includes('cappuccino') || h.includes('latte') || h.includes('espresso') || h.includes('mocha')) return String.fromCodePoint(0x2615); // ☕
    if (h.includes('juice') || h.includes('fresh juice') || h.includes('lemon') || h.includes('orange juice') || h.includes('mango juice')) return String.fromCodePoint(0x1F9C3); // 🧃
    if (h.includes('lassi') || h.includes('buttermilk') || h.includes('chaas')) return String.fromCodePoint(0x1F95B); // 🥛
    if (h.includes('milkshake') || h.includes('shake') || h.includes('smoothie')) return String.fromCodePoint(0x1F964); // 🥤
    if (h.includes('cold drink') || h.includes('soda') || h.includes('cola') || h.includes('pepsi') || h.includes('sprite')) return String.fromCodePoint(0x1F964); // 🥤
    if (h.includes('water'))           return String.fromCodePoint(0x1F4A7); // 💧
    if (h.includes('sandwich') || h.includes('burger') || h.includes('sub') || h.includes('wrap') || h.includes('roll')) return String.fromCodePoint(0x1F96A); // 🥪
    if (h.includes('pizza'))           return String.fromCodePoint(0x1F355); // 🍕
    if (h.includes('pasta') || h.includes('noodle') || h.includes('maggi')) return String.fromCodePoint(0x1F35D); // 🍝
    if (h.includes('biryani') || h.includes('rice') || h.includes('pulao')) return String.fromCodePoint(0x1F35A); // 🍚
    if (h.includes('dosa') || h.includes('idli') || h.includes('vada') || h.includes('uttapam') || h.includes('paratha') || h.includes('roti') || h.includes('chapati') || h.includes('naan') || h.includes('bread')) return String.fromCodePoint(0x1FAD3); // 🫓
    if (h.includes('egg') || h.includes('omelette'))       return String.fromCodePoint(0x1F373); // 🍳
    if (h.includes('cake') || h.includes('pastry') || h.includes('brownie') || h.includes('muffin') || h.includes('cupcake')) return String.fromCodePoint(0x1F382); // 🎂
    if (h.includes('biscuit') || h.includes('cookie') || h.includes('cracker')) return String.fromCodePoint(0x1F36A); // 🍪
    if (h.includes('chocolate') || h.includes('choco')) return String.fromCodePoint(0x1F36B); // 🍫
    if (h.includes('chips') || h.includes('fries') || h.includes('popcorn') || h.includes('crisps')) return String.fromCodePoint(0x1F35F); // 🍟
    if (h.includes('samosa') || h.includes('pakoda') || h.includes('pakora') || h.includes('bhajia') || h.includes('vada pav')) return String.fromCodePoint(0x1F95F); // 🥟
    if (h.includes('soup'))            return String.fromCodePoint(0x1F35C); // 🍜
    if (h.includes('salad'))           return String.fromCodePoint(0x1F957); // 🥗
    if (h.includes('ice cream') || h.includes('icecream') || h.includes('kulfi') || h.includes('gelato')) return String.fromCodePoint(0x1F366); // 🍦
    if (h.includes('sweet') || h.includes('mithai') || h.includes('halwa') || h.includes('ladoo') || h.includes('barfi')) return String.fromCodePoint(0x1F36C); // 🍬
    if (h.includes('peanut') || h.includes('nuts') || h.includes('cashew') || h.includes('almond')) return String.fromCodePoint(0x1F95C); // 🥜
    if (h.includes('snack') || h.includes('namkeen') || h.includes('mixture')) return String.fromCodePoint(0x1F37F); // 🍿
    if (h.includes('thali') || h.includes('meal') || h.includes('lunch') || h.includes('dinner')) return String.fromCodePoint(0x1F371); // 🍱
    if (h.includes('milk') || h.includes('paneer') || h.includes('cheese') || h.includes('butter') || h.includes('ghee') || h.includes('dairy')) return String.fromCodePoint(0x1F9C8); // 🧈
    if (h.includes('bakery') || h.includes('croissant') || h.includes('puff')) return String.fromCodePoint(0x1F950); // 🥐
    if (h.includes('beverage') || h.includes('drink')) return String.fromCodePoint(0x1F964); // 🥤
    if (h.includes('food') || h.includes('meal'))      return String.fromCodePoint(0x1F374); // 🍴
    return String.fromCodePoint(0x1F6D2); // 🛒 default
  };

  return (
    <div className="min-h-screen flex flex-col print:bg-white" style={{ background: B.pageGrad }}>

      {/* ── Header ── */}
      <header className="flex-shrink-0 px-4 py-2 shadow-lg print:hidden"
        style={{ background: B.bgGrad, borderBottom: `2px solid ${B.gold}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Crown Tea Hub"
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${B.gold}` }} />
            <div>
              <h1 className="text-lg font-extrabold uppercase leading-tight"
                style={{ color: B.goldLight, fontFamily: 'Georgia, serif', letterSpacing: '0.1em' }}>
                Crown Tea Hub
              </h1>
              <p className="text-xs leading-none" style={{ color: '#c8a84b' }}>Bakery &amp; Café</p>
            </div>
            {holdingMsg && (
              <span className="text-xs font-bold px-3 py-1 rounded-full ml-2"
                style={{ background: B.gold, color: B.brown }}>{holdingMsg}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm hidden sm:inline" style={{ color: '#c8a84b' }}>{user?.full_name}</span>
            <button onClick={() => navigate('/dashboard')}
              className="text-sm px-3 py-1.5 rounded-lg font-medium transition-all"
              style={{ background: 'rgba(212,160,23,0.15)', color: B.goldLight, border: `1px solid rgba(212,160,23,0.4)` }}>
              Dashboard
            </button>
            <button onClick={() => { signOut(); navigate('/login'); }}
              className="text-sm font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
              style={{ background: B.goldGrad, color: B.brown }}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Offline / pending-sync banner */}
      <OfflineBanner onSynced={() => fetchProducts()} />

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden print:hidden">

        {/* ── Category Sidebar ── */}
        <aside className="w-40 flex-shrink-0 overflow-y-auto hidden lg:block"
          style={{ background: B.cream, borderRight: B.goldBorder }}>
          <div className="p-3">
            <p className="text-xs font-bold uppercase tracking-widest mb-3 px-1" style={{ color: B.textLight }}>Category</p>
            {[{ id: null, name: 'All Items' }, ...categories].map(cat => (
              <button key={cat.id ?? 'all'} onClick={() => setSelectedCategory(cat.id)}
                className="w-full text-left px-3 py-2.5 rounded-xl text-sm mb-1 font-semibold transition-all active:scale-95"
                style={selectedCategory === cat.id
                  ? { background: B.goldGrad, color: B.brown }
                  : { color: B.text, background: 'transparent' }
                }>
                {cat.name}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Products Area ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Search bar */}
          <div className="flex-shrink-0 px-4 py-3 print:hidden"
            style={{ background: '#fff9ee', borderBottom: B.goldBorder }}>
            <div className="flex gap-2">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search or scan barcode..."
                value={searchQuery}
                onChange={e => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  // Exact barcode match → add to cart instantly (works with
                  // scanners that don't send Enter, and for typed barcodes)
                  const match = products.find(p => p.barcode && p.barcode === q.trim());
                  if (match) { addToCart(match); setSearchQuery(''); }
                }}
                autoFocus
                className="flex-1 text-sm outline-none rounded-xl px-4 py-2.5"
                style={{ background: B.cream, border: `1.5px solid ${B.gold}`, color: B.brown }}
              />
              {/* Camera barcode scan (mobile/tablet) */}
              <button onClick={() => setShowScanner(true)} title="Scan barcode with camera"
                className="rounded-xl px-3 py-2.5 flex items-center justify-center active:scale-95 transition-all"
                style={{ background: B.goldGrad, color: B.brown }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M4 10h16M4 14h16" />
                </svg>
              </button>
              <select
                value={selectedCategory || ''}
                onChange={e => setSelectedCategory(e.target.value ? parseInt(e.target.value) : null)}
                className="lg:hidden text-sm rounded-xl px-3 py-2.5 outline-none"
                style={{ background: B.cream, border: `1.5px solid ${B.gold}`, color: B.brown }}>
                <option value="">All</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <p className="text-center py-16 font-medium" style={{ color: B.textLight }}>Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-center py-16 font-medium" style={{ color: B.textLight }}>No products found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map(product => {
                  const inCart = cart.find(i => i.id === product.id);
                  const outOfStock = product.track_stock && product.current_stock != null &&
                    parseFloat(product.current_stock) <= 0;
                  const lowStock = !outOfStock && product.track_stock && product.current_stock != null &&
                    parseFloat(product.current_stock) <= parseFloat(product.minimum_stock_level || 0);
                  return (
                    <button key={product.id} onClick={() => addToCart(product)}
                      className="relative text-left rounded-2xl overflow-hidden transition-all active:scale-95"
                      style={{
                        background: 'white',
                        border: inCart ? `2px solid ${B.goldDark}` : outOfStock ? `1.5px solid #f87171` : `1.5px solid #e8d5a3`,
                        boxShadow: inCart ? `0 4px 14px rgba(180,130,10,0.25)` : '0 2px 6px rgba(0,0,0,0.07)',
                      }}>
                      {/* In-cart badge */}
                      {inCart && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center z-10"
                          style={{ background: B.goldGrad, color: B.brown }}>
                          {inCart.quantity}
                        </span>
                      )}
                      {/* Out-of-stock ribbon — warning only, doesn't block the sale */}
                      {outOfStock && (
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs font-bold z-10"
                          style={{ background: '#dc2626', color: '#fff' }}>
                          Out
                        </span>
                      )}
                      {/* Image area */}
                      <div className="aspect-square flex items-center justify-center text-4xl"
                        style={{ background: `linear-gradient(135deg, ${B.cream}, ${B.creamMid})`, opacity: outOfStock ? 0.5 : 1 }}>
                        {getEmoji(product)}
                      </div>
                      {/* Info */}
                      <div className="p-2.5">
                        <p className="font-semibold text-sm leading-tight line-clamp-2" style={{ color: B.text }}>{product.name}</p>
                        {product.brand && <p className="text-xs mt-0.5" style={{ color: B.textLight }}>{product.brand}</p>}
                        <p className="font-extrabold mt-1" style={{ color: B.goldDark }}>₹{fmt(product.selling_price)}</p>
                        {outOfStock ? (
                          <span className="text-xs font-bold" style={{ color: '#dc2626' }}>Out of stock — selling anyway</span>
                        ) : lowStock && (
                          <span className="text-xs font-semibold text-red-600">Low stock</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        {/* ── Cart Sidebar (desktop XL+) ── */}
        <aside className="w-80 flex-shrink-0 hidden xl:flex flex-col"
          style={{ borderLeft: B.goldBorder }}>
          <CartPanel {...cartProps} />
        </aside>
      </div>

      {/* ── Cart FAB (mobile/tablet) ── */}
      <div className="xl:hidden fixed bottom-5 right-5 z-40 print:hidden">
        <button onClick={() => setShowMobileCart(true)}
          className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center relative active:scale-95 transition-transform"
          style={{ background: B.goldGrad }}>
          <svg className="w-7 h-7" fill="none" stroke={B.brown} strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center"
              style={{ background: '#c62828', color: 'white' }}>
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Mobile Cart Bottom Sheet ── */}
      {showMobileCart && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end xl:hidden print:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowMobileCart(false)} />
          <div className="relative rounded-t-3xl shadow-2xl flex flex-col max-h-[82vh] overflow-hidden"
            style={{ background: B.cream, border: `2px solid ${B.gold}` }}>
            {/* Drag handle */}
            <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-1" style={{ background: B.gold }} />
            <CartPanel {...cartProps} />
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showCheckout && <CheckoutModal cart={cart} onClose={() => setShowCheckout(false)} onSuccess={handleCheckoutSuccess} />}
      {showHeld      && <HeldBillsModal onClose={() => setShowHeld(false)} onRetrieve={handleRetrieveHeld} />}
      {showScanner   && <BarcodeScannerModal onScan={handleScanResult} onClose={() => setShowScanner(false)} />}
      {receiptData   && <Receipt sale={receiptData.sale} items={receiptData.items} onClose={() => setReceiptData(null)} />}
    </div>
  );
}
