// Zero-dependency IndexedDB wrapper for Crown Tea Hub offline support.
//
// Stores:
//   outbox  — pending POST requests to replay when back online
//             { id (auto), url, data, label, created_at, attempts, last_error }
//   cache   — last successful GET responses
//             { key, data, saved_at }

const DB_NAME = 'crown-tea-hub-offline';
const DB_VERSION = 1;

let _dbPromise = null;

export function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported in this browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result);
    t.onerror    = () => reject(t.error);
    t.onabort    = () => reject(t.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Cache helpers ──────────────────────────────────────────────────────────

export async function cacheSet(key, data) {
  const db = await getDB();
  return tx(db, 'cache', 'readwrite', (s) => s.put({ key, data, saved_at: Date.now() }));
}

export async function cacheGet(key) {
  const db = await getDB();
  return tx(db, 'cache', 'readonly', (s) => reqToPromise(s.get(key)))
    .then(row => row ? row.data : null);
}

// ── Outbox helpers ─────────────────────────────────────────────────────────

export async function outboxAdd(item) {
  const db = await getDB();
  return tx(db, 'outbox', 'readwrite', (s) =>
    s.add({ ...item, created_at: Date.now(), attempts: 0, last_error: null })
  );
}

export async function outboxAll() {
  const db = await getDB();
  return tx(db, 'outbox', 'readonly', (s) => reqToPromise(s.getAll()))
    .then(rows => rows.sort((a, b) => a.id - b.id));
}

export async function outboxRemove(id) {
  const db = await getDB();
  return tx(db, 'outbox', 'readwrite', (s) => s.delete(id));
}

export async function outboxUpdate(item) {
  const db = await getDB();
  return tx(db, 'outbox', 'readwrite', (s) => s.put(item));
}

export async function outboxCount() {
  const db = await getDB();
  return tx(db, 'outbox', 'readonly', (s) => reqToPromise(s.count()));
}
