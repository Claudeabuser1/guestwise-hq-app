// Keeps the app shell on the device so it opens instantly from the home screen.
// Network first for the app's own files (so a deploy shows up at once), cache as the fallback when offline.
// Data (Supabase) and the CDN are never cached here.
const CACHE = 'gw-hq-202611251659';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/store.js', 'js/progress.js', 'js/config.js',
  'fonts/inter-tight-latin.woff2', 'img/gw-g.svg', 'img/favicon.svg', 'manifest.webmanifest'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))));
});
