// Offline-Fähigkeit: App-Dateien netzwerk-zuerst (Updates kommen sofort an), CDN-Bibliothek cache-zuerst.
// Das Erkennungsmodell cacht transformers.js selbst (eigener Cache "transformers-cache").
const CACHE = 'outfit-v2';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png',
  'js/app.js', 'js/catalog.js', 'js/classify.js', 'js/color.js', 'js/db.js', 'js/generator.js',
  'js/lib.js', 'js/rules.js', 'js/segment.js', 'js/wada.js', 'js/weather.js'];

self.addEventListener('install', e => e.waitUntil(
  caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())));

self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('outfit-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

const store = (req, res) => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; };

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(res => store(e.request, res)).catch(() => caches.match(e.request)));
  } else if (url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => store(e.request, res))));
  }
});
