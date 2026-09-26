const B = {
  brown:      '#3d2008',
  gold:       '#d4a017',
  goldLight:  '#f5c842',
  goldDark:   '#b8860b',
  text:       '#7a4e08',
  textLight:  '#a07020',
  goldBorder: '1px solid #d4a017',
  goldGrad:   'linear-gradient(135deg, #b8860b, #d4a017, #f5c842, #d4a017, #b8860b)',
  bgGrad:     'linear-gradient(135deg, #2d1a0e 0%, #4a2c0a 50%, #3d2008 100%)',
  pageGrad:   'linear-gradient(160deg, #fdf6e3 0%, #f5ead0 60%, #ede0c4 100%)',
};

const fmt = (n) => parseFloat(n || 0).toFixed(2);

function ReceiptModal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden ${wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}`}
        style={{ background: B.pageGrad, border: B.goldBorder }}>
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

/**
 * Printable receipt modal.
 * Props: sale (object), items (array of sale_items), onClose
 * Prints only the #receipt-print region (see print styles in the page using it,
 * or the global styles in App.css).
 */
export default function Receipt({ sale, items, onClose }) {
  const handlePrint = () => {
    setTimeout(() => window.print(), 50);
  };

  return (
    <ReceiptModal title="Receipt" onClose={onClose}>
      <div id="receipt-print" className="font-mono text-sm">
        <div className="flex items-center gap-3 mb-3">
          <img src="/logo.jpg" alt="Crown Tea Hub"
            style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${B.gold}`, flexShrink: 0 }} />
          <div className="flex-1 text-center">
            <p className="font-extrabold text-base tracking-widest uppercase" style={{ color: B.text, fontFamily: 'Georgia, serif' }}>Crown Tea Hub</p>
            <p className="text-xs" style={{ color: B.textLight }}>Bakery &amp; Café</p>
            <p className="text-xs" style={{ color: '#888' }}>Refresh · Relax · Repeat</p>
          </div>
        </div>
        <div className="h-px my-2" style={{ background: `linear-gradient(90deg, transparent, ${B.gold}, transparent)` }} />
        <div className="text-center mb-3 text-xs space-y-0.5" style={{ color: '#555' }}>
          <p className="font-semibold">Invoice: {sale.invoice_number}</p>
          <p>{new Date(sale.sale_time).toLocaleString('en-IN')}</p>
          <p>Cashier: {sale.cashier_username}</p>
          {sale.customer_name && (
            <p className="font-semibold mt-1" style={{ color: B.text }}>
              Customer: {sale.customer_name}
              {sale.customer_mobile ? ` · ${sale.customer_mobile}` : ''}
            </p>
          )}
        </div>
        <hr className="border-dashed my-2" style={{ borderColor: B.goldDark }} />
        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="border-b border-dashed" style={{ borderColor: B.goldDark }}>
              <th className="text-left pb-1">Item</th>
              <th className="text-right pb-1">Qty</th>
              <th className="text-right pb-1">Rate</th>
              <th className="text-right pb-1">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-dotted" style={{ borderColor: '#e8d5a3' }}>
                <td className="py-1 pr-2 max-w-[120px] truncate">{item.product_name}</td>
                <td className="py-1 text-right">{parseFloat(item.quantity)}</td>
                <td className="py-1 text-right">₹{fmt(item.unit_price)}</td>
                <td className="py-1 text-right">₹{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr className="border-dashed my-2" style={{ borderColor: B.goldDark }} />
        <div className="space-y-1 text-xs">
          <div className="flex justify-between"><span style={{ color: '#666' }}>Subtotal</span><span>₹{fmt(sale.subtotal)}</span></div>
          {parseFloat(sale.discount_total) > 0 && (
            <div className="flex justify-between text-red-600"><span>Discount</span><span>-₹{fmt(sale.discount_total)}</span></div>
          )}
          {parseFloat(sale.tax_total) > 0 && (
            <div className="flex justify-between text-xs" style={{ color: '#666' }}><span>GST</span><span>₹{fmt(sale.tax_total)}</span></div>
          )}
          {parseFloat(sale.round_off) !== 0 && (
            <div className="flex justify-between text-xs" style={{ color: '#999' }}><span>Round Off</span><span>₹{fmt(sale.round_off)}</span></div>
          )}
        </div>
        <hr className="border-dashed my-2" style={{ borderColor: B.goldDark }} />
        <div className="flex justify-between font-bold text-base" style={{ color: B.text }}>
          <span>Total</span><span>₹{fmt(sale.grand_total)}</span>
        </div>
        {sale.amount_tendered && (
          <div className="mt-2 text-xs space-y-1">
            <div className="flex justify-between"><span>Payment ({(sale.payment_method || '').toUpperCase()})</span><span>₹{fmt(sale.amount_tendered)}</span></div>
            <div className="flex justify-between font-semibold"><span>Change</span><span>₹{fmt(sale.change_amount)}</span></div>
          </div>
        )}
        <div className="h-px my-3" style={{ background: `linear-gradient(90deg, transparent, ${B.gold}, transparent)` }} />
        <p className="text-center text-xs" style={{ color: B.textLight }}>Made with love, served with Crown</p>
        <p className="text-center text-xs mt-0.5" style={{ color: '#aaa' }}>Thank you for visiting!</p>
      </div>
      <div className="mt-4 flex gap-3 print:hidden">
        <button onClick={handlePrint}
          className="flex-1 font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95"
          style={{ background: B.goldGrad, color: B.brown }}>
          Print Receipt
        </button>
        <button onClick={onClose}
          className="flex-1 font-semibold py-2.5 rounded-xl text-sm border transition-colors"
          style={{ borderColor: B.gold, color: B.text, background: 'white' }}>
          Close
        </button>
      </div>
      {/* Print styles — only the receipt content prints, everything else hidden */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; }
          #receipt-print {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            font-size: 12px !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </ReceiptModal>
  );
}
