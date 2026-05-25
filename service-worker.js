/* ════════════════════════════════════════════════════════════
   EngHub Pro — Service Worker
   Offline-first PWA. Caches the app shell + CDN assets.
   ════════════════════════════════════════════════════════════ */
const CACHE = 'enghub-v1';

// Core app shell (relative paths — works under /saud/ subpath on Pages)
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
];

// CDN assets we want available offline (fonts, KaTeX, Three.js)
const CDN = [
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Shell is critical — fail install if it can't cache
    await cache.addAll(SHELL);
    // CDN is best-effort (don't fail install if a CDN is unreachable)
    await Promise.allSettled(CDN.map((u) =>
      fetch(u, { mode: 'no-cors' }).then((r) => cache.put(u, r)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for navigations (fresh content when online, cached when not)
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  // Cache-first for static assets + CDN (stale-while-revalidate)
  e.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchPromise = fetch(req).then((res) => {
      if (res && (res.status === 200 || res.type === 'opaque')) {
        caches.open(CACHE).then((c) => c.put(req, res.clone()));
      }
      return res;
    }).catch(() => cached);
    return cached || fetchPromise;
  })());
});
