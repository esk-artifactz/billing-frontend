/* Crown Tea Hub — Service Worker
 *
 * Strategy:
 *  - Navigation requests (page loads):  network-first, fall back to cached
 *    /index.html so the app opens even with zero connectivity.
 *  - Static assets (/assets/*, /logo.jpg): stale-while-revalidate — serve
 *    from cache instantly, update cache in the background.
 *  - API calls & non-GET requests: bypass entirely (offline data is handled
 *    by the IndexedDB outbox layer, not this worker).
 *
 * Install: precaches the shell, then fetches index.html and extracts the
 * hashed /assets/*.js|css URLs Vite generates so the very FIRST visit is
 * enough to make the whole app offline-capable.
 */

const CACHE = 'cth-shell-v1';
const SHELL = ['/', '/index.html', '/logo.jpg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    // Warm the hashed asset cache so first-visit installs are offline-ready
    try {
      const res  = await fetch('/index.html', { cache: 'no-store' });
      const html = await res.text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
        .map(m => m[1]);
      if (assets.length) await cache.addAll(assets);
      await cache.put('/index.html', new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      }));
    } catch { /* asset warm-up is best-effort */ }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests — let API calls and POSTs pass through
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page navigations → network-first, cached shell as fallback
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        return (await cache.match('/index.html')) ||
               (await cache.match('/')) ||
               new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Static assets → stale-while-revalidate
  event.respondWith((async () => {
    const cache  = await caches.open(CACHE);
    const cached = await cache.match(request);
    const freshPromise = fetch(request).then(res => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await freshPromise) ||
           new Response('', { status: 504, statusText: 'Offline' });
  })());
});
