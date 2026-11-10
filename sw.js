/* Parlo service worker — app shell cache + Web Push.
   Not: push/notificationclick eklendi; cache adı parlo-v5'e yükseltildi (eski önbellekler temizlenir). */
const CACHE = 'parlo-v5';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-32.png', './icon-180.png', './icon-192.png', './icon-512.png',
  './mesafeli-satis.html', './gizlilik.html', './iptal-iade.html', './iletisim.html'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(
    ASSETS.map((u) => c.add(u).catch(() => {}))
  )));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // backend/görseller worker'ı atlar

  if (req.mode === 'navigate') {
    // navigasyon: önce ağ, başarısızsa önbellek
    e.respondWith(
      fetch(req).then((res) => {
        try {
          const path = url.pathname;
          const copy = res.clone();
          caches.open(CACHE).then((c) => {
            if (/(mesafeli-satis|gizlilik|iptal-iade|iletisim)\.html$/.test(path)) c.put(req, copy);
            else c.put('./index.html', copy); // uygulama girişi
          });
        } catch (_) {}
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }
  // diğer GET: önce önbellek, sonra ağ
  e.respondWith(
    caches.match(req).then((m) => m || fetch(req).then((res) => {
      try { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } catch (_) {}
      return res;
    }).catch(() => m))
  );
});

/* ---- Web Push ---- */
self.addEventListener('push', (e) => {
  let data = { title: 'Parlo', body: 'Bugün İngilizce için küçük bir mola? 🌸', url: './' };
  try { if (e.data) { const j = e.data.json(); if (j && typeof j === 'object') data = Object.assign(data, j); } } catch (_) {
    try { if (e.data) data.body = e.data.text(); } catch (__) {}
  }
  const opts = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: data.tag || 'parlo-daily',
    renotify: true,
    data: { url: data.url || './' }
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Parlo', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) { try { c.navigate(target); } catch (_) {} return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
