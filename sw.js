/* Parlo PWA service worker — çevrimdışı açılış + hızlı yükleme.
   Uygulama kabuğu (index.html, ikonlar, yasal sayfalar) önbelleğe alınır.
   Gezinme (navigate) ağ-öncelikli: çevrimiçiyken hep en yeni sürüm gelir,
   çevrimdışıyken önbellekten açılır. Backend/API ve /img (farklı origin) dokunulmaz. */
const CACHE = 'parlo-v2';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon-180.png', './icon-32.png',
  './mesafeli-satis.html', './gizlilik.html', './iptal-iade.html', './iletisim.html'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // backend/görseller: ağ (SW karışmaz)

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((r) => { const cl = r.clone(); caches.open(CACHE).then((c) => c.put('./index.html', cl)); return r; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((r) => {
      if (r && r.ok) { const cl = r.clone(); caches.open(CACHE).then((c) => c.put(req, cl)); }
      return r;
    }).catch(() => cached))
  );
});
