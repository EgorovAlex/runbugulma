// service-worker.js
const CACHE_NAME = 'kps-cache-v1';
const toCache = [
  '/',
  '/index.html',
  '/app.js',
  '/service-worker.js',
  'https://telegram.org/js/telegram-web-app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(toCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // Простая стратегия: сначала из кэша, иначе fetch и кешировать
  event.respondWith(
    caches.match(event.request).then(resp => {
      if (resp) return resp;
      return fetch(event.request).then(fetchResp => {
        // Не кэшируем POST и т.д.
        if (event.request.method === 'GET') {
          const copy = fetchResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return fetchResp;
      }).catch(err => {
        // Если оффлайн и нет в кэше — можно вернуть оффлайн-плейсхолдер или просто ошибку
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
