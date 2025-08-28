const CACHE_NAME = 'runbugulma-cache-v3';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Skip waiting');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Claiming clients');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Пропускаем запросы к внешним API
  if (event.request.url.includes('telegram.org') || 
      event.request.url.includes('script.google.com') ||
      event.request.url.includes('api.telegram.org')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Возвращаем из кэша если есть
        if (response) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        
        // Иначе загружаем из сети
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then(networkResponse => {
          // Проверяем валидность ответа
          if (!networkResponse || networkResponse.status !== 200 || 
              networkResponse.type !== 'basic') {
            return networkResponse;
          }
          
          // Клонируем для кэширования
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
              console.log('Service Worker: Caching new resource', event.request.url);
            });
          
          return networkResponse;
        });
      })
      .catch(() => {
        // Fallback для offline
        if (event.request.url.endsWith('.html') || 
            event.request.url === self.location.origin + '/') {
          return caches.match('./index.html');
        }
        
        // Fallback для других ресурсов
        return new Response('Offline mode', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});