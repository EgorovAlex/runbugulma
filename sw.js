const CACHE_NAME = 'athlete-app-v1';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/offline.html',
  // если есть CSS/изображения — добавьте сюда
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  const req = evt.request;
  // Навигационные запросы: отдаём index или offline
  if(req.mode === 'navigate'){
    evt.respondWith(
      fetch(req).then(resp => {
        // обновляем кэш
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => {
        return caches.match(req).then(r => r || caches.match(OFFLINE_URL));
      })
    );
    return;
  }

  // Для остальных — cache first, затем сеть
  evt.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(resp => {
        // кэшируем статические ресурсы
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(req, resp.clone());
          return resp;
        });
      }).catch(()=> {
        // если не в кэше и нет сети — отдаём оффлайн
        return caches.match(OFFLINE_URL);
      });
    })
  );
});