// Service worker for Team Calendar — offline app shell + installability.
// Self-contained: caches only same-origin app files. Never touches the host
// (GitHub/GitLab) API, so saving still commits normally.
const CACHE = 'team-calendar-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/theme.css',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/dates.js',
  './assets/js/model.js',
  './assets/js/host.js',
  './assets/js/store.js',
  './assets/js/token.js',
  './assets/js/render.js',
  './assets/js/ui.js',
  './config.json',
  './events.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Let cross-origin and host-API traffic (read/commit) pass straight through.
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return;

  // Calendar data: network-first so edits show, falling back to cache offline.
  if (url.pathname.endsWith('/events.json')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./events.json', copy));
          return res;
        })
        .catch(() => caches.match('./events.json'))
    );
    return;
  }

  // App shell: stale-while-revalidate — instant load, refreshes for next time.
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    )
  );
});
