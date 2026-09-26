// Offline sync engine.
//
// - queueMutation(): saves a POST request into the outbox when offline.
// - flushOutbox(): replays queued requests against the API in order.
// - startSyncEngine(): listens for 'online' events + polls every 15s as a
//   safety net (navigator.onLine is not always reliable).
//
// Notify listeners whenever the pending count changes so the UI banner
// stays live without polling the DB from components.

import api from '../api/client';
import {
  outboxAdd, outboxAll, outboxRemove, outboxUpdate, outboxCount,
  cacheSet, cacheGet,
} from './db';

// ── Listeners ──────────────────────────────────────────────────────────────

const _listeners = new Set();
let _pendingCount = 0;

export function onPendingChange(fn) {
  _listeners.add(fn);
  fn(_pendingCount);
  return () => _listeners.delete(fn);
}

async function _emitPending() {
  try {
    _pendingCount = await outboxCount();
  } catch {
    _pendingCount = 0;
  }
  _listeners.forEach(fn => { try { fn(_pendingCount); } catch { /* noop */ } });
}

export function getPendingCount() { return _pendingCount; }

// ── Queue a mutation ────────────────────────────────────────────────────────

export async function queueMutation({ url, data, label }) {
  await outboxAdd({ url, data, label });
  await _emitPending();
}

export async function getQueuedByUrl(urlPrefix) {
  const all = await outboxAll();
  return all.filter(i => i.url.startsWith(urlPrefix));
}

export async function getAllQueued() {
  return outboxAll();
}

// ── Is the error a network failure (vs a server response)? ─────────────────

export function isNetworkError(err) {
  // Axios sets `err.response` when the server replies. No response + message
  // like "Network Error" or a timeout means we never reached the server.
  return !err.response;
}

// ── Flush ──────────────────────────────────────────────────────────────────

let _flushing = false;

export async function flushOutbox() {
  if (_flushing) return { synced: 0, failed: 0, skipped: 0 };
  _flushing = true;
  let synced = 0, failed = 0, skipped = 0;
  try {
    const items = await outboxAll();
    for (const item of items) {
      try {
        await api.post(item.url, item.data);
        await outboxRemove(item.id);
        synced++;
      } catch (err) {
        if (isNetworkError(err)) {
          // Still offline — stop here and keep remaining items queued
          break;
        }
        // Server rejected (4xx/5xx) — mark it and continue with the rest
        skipped++;
        await outboxUpdate({
          ...item,
          attempts: (item.attempts || 0) + 1,
          last_error: err.response?.data?.detail || `HTTP ${err.response?.status}`,
        });
      }
    }
  } finally {
    _flushing = false;
    await _emitPending();
  }
  return { synced, failed, skipped };
}

// ── Engine ─────────────────────────────────────────────────────────────────

let _started = false;
let _intervalId = null;
let _onSynced = null;

export function startSyncEngine(onSynced) {
  _onSynced = onSynced;
  if (_started) return;
  _started = true;

  const handleOnline = async () => {
    const res = await flushOutbox();
    if (res.synced > 0 && typeof _onSynced === 'function') {
      _onSynced(res);
    }
  };

  window.addEventListener('online', handleOnline);
  _intervalId = setInterval(handleOnline, 15000);

  // Prime pending count
  _emitPending();
  // Try an immediate flush in case we're already online with stale items
  handleOnline();

  return () => {
    window.removeEventListener('online', handleOnline);
    if (_intervalId) clearInterval(_intervalId);
    _started = false;
  };
}

export function stopSyncEngine() {
  _started = false;
  if (_intervalId) { clearInterval(_intervalId); _intervalId = null; }
}

// ── Cache helpers re-exported for convenience ──────────────────────────────

export { cacheSet, cacheGet };
