import { useEffect } from 'react';

/**
 * Calls `onClose` when the user presses Escape.
 * Pass `enabled = false` to temporarily disable (e.g. when no modal is open).
 *
 * Usage:
 *   useEscClose(() => closeModal(), !!modal);
 *   useEscClose(() => setShowCheckout(false), showCheckout);
 */
export function useEscClose(onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, enabled]);
}
