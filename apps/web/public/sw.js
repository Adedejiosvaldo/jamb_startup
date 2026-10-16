/* ScoreCoach service worker (spec §13): open the app and continue a test with no network.
 * - Next.js static assets: cache-first (they are content-hashed).
 * - Page navigations: network-first, falling back to the last cached copy.
 *   Dynamic routes share one cached shell per pattern (e.g. every /test/:id),
 *   because they render on the client from the URL.
 * - API calls are never cached here; the test runner keeps its own offline copy.
 */
const VERSION = 'sc-v1';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ['/', '/home', '/practice', '/progress', '/account', '/login', '/offline.html', '/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => undefined))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function shellKey(pathname) {
  if (/^\/test\/[^/]+\/results\/?$/.test(pathname)) return '/__shell/test-results';
  if (/^\/test\/[^/]+\/?$/.test(pathname)) return '/__shell/test';
  return pathname;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    const key = shellKey(url.pathname);
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(req);
          if (res.ok) cache.put(key, res.clone());
          return res;
        } catch {
          return (await cache.match(key)) || (await cache.match('/offline.html')) || Response.error();
        }
      })(),
    );
  }
});
