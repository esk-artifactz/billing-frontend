import useOnlineStatus from '../hooks/useOnlineStatus';

/**
 * Fixed banner shown at the top when:
 *   - browser is offline, or
 *   - there are queued items waiting to sync
 *
 * Props:
 *   onSynced(res) — called after a successful flush so the page can refresh
 */
export default function OfflineBanner({ onSynced }) {
  const { online, pending, syncNow } = useOnlineStatus(onSynced);

  if (online && pending === 0) return null;

  return (
    <div
      className="w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-bold flex-wrap"
      style={{
        background: online ? '#d97706' : '#7f1d1d',
        color: '#fff',
      }}
    >
      <span>
        {online
          ? `Syncing ${pending} pending item${pending !== 1 ? 's' : ''}…`
          : `You're offline${pending > 0 ? ` — ${pending} item${pending !== 1 ? 's' : ''} will sync when network returns` : ''}`}
      </span>
      {online && pending > 0 && (
        <button
          onClick={syncNow}
          className="text-xs font-extrabold px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-all"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
