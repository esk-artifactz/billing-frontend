import { useState, useEffect } from 'react';
import { startSyncEngine, onPendingChange, getPendingCount } from '../offline/sync';

/**
 * Returns { online, pending, syncNow }
 * - online: navigator.onLine state, updated on 'online'/'offline' events
 * - pending: number of queued outbox items
 * - syncNow: manual flush trigger
 */
export default function useOnlineStatus(onSynced) {
  const [online,  setOnline]  = useState(navigator.onLine);
  const [pending, setPending] = useState(getPendingCount());

  useEffect(() => {
    const goOnline  = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);

    const stopEngine = startSyncEngine(onSynced);
    const offPending = onPendingChange(setPending);

    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
      stopEngine();
      offPending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncNow = async () => {
    const { flushOutbox } = await import('../offline/sync');
    return flushOutbox();
  };

  return { online, pending, syncNow };
}
