import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

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

/**
 * Camera barcode scanner for mobile/tablet.
 * Props:
 *   onScan(code) → return a status message string shown to the cashier
 *   onClose()
 * Stays open for continuous scanning — same code is ignored for 2s to
 * avoid double-adds while the camera still sees the label.
 */
export default function BarcodeScannerModal({ onScan, onClose }) {
  const [error, setError]     = useState('');
  const [status, setStatus]   = useState(null);   // { msg, ok }
  const [started, setStarted] = useState(false);
  const scannerRef = useRef(null);
  const lastRef    = useRef({ code: null, time: 0 });
  const statusTimer = useRef(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('barcode-reader');
    scannerRef.current = scanner;

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 130 }, aspectRatio: 1.4 },
      (decodedText) => {
        const now = Date.now();
        const last = lastRef.current;
        if (decodedText === last.code && now - last.time < 2000) return; // debounce repeats
        lastRef.current = { code: decodedText, time: now };

        const msg = onScan(decodedText.trim());
        setStatus({ msg, ok: !msg.startsWith('No product') });
        if (statusTimer.current) clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus(null), 2500);
        try { navigator.vibrate?.(80); } catch { /* unsupported */ }
      },
      () => { /* per-frame decode miss — ignore */ }
    ).then(() => setStarted(true))
     .catch(err => setError(
       typeof err === 'string' ? err :
       'Camera unavailable — check browser camera permission and that the site is on HTTPS.'
     ));

    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
      try { scanner.stop().catch(() => {}); scanner.clear(); } catch { /* already stopped */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ background: B.pageGrad, border: B.goldBorder }}>
        <div className="h-1.5 w-full" style={{ background: B.goldGrad }} />
        <div className="flex items-center justify-between px-5 py-3"
          style={{ background: B.bgGrad, borderBottom: B.goldBorder }}>
          <h2 className="font-bold text-base tracking-wide" style={{ color: B.goldLight, fontFamily: 'Georgia, serif' }}>
            Scan Barcode
          </h2>
          <button onClick={onClose} className="text-2xl leading-none font-light" style={{ color: B.goldLight }}>&times;</button>
        </div>

        <div className="p-4">
          {error ? (
            <div className="rounded-xl p-4 text-sm text-center" style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {error}
            </div>
          ) : (
            <>
              <div id="barcode-reader" className="rounded-xl overflow-hidden"
                style={{ border: `2px solid ${B.goldDark}`, background: '#000' }} />
              <p className="text-center text-xs mt-2" style={{ color: B.textLight }}>
                {started ? 'Point the camera at the product barcode' : 'Starting camera…'}
              </p>
            </>
          )}

          {status && (
            <div className="mt-3 rounded-xl px-4 py-2.5 text-sm font-bold text-center"
              style={status.ok
                ? { background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }
                : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' }}>
              {status.msg}
            </div>
          )}

          <button onClick={onClose}
            className="w-full mt-4 font-bold py-2.5 rounded-xl text-sm uppercase tracking-wider active:scale-95"
            style={{ background: B.goldGrad, color: B.brown }}>
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
}
