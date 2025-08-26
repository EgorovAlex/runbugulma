// sw.js - Service Worker для кэширования приложения
const CACHE_NAME = 'sport-event-kp-v1';
const urlsToCache = [
  './',
  './index.html'
];

// Установка Service Worker
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Кэшируем файлы для оффлайн работы');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Обработка запросов
self.addEventListener('fetch', function(event) {
  // Только GET запросы
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Возвращаем кэш если есть
        if (response) {
          return response;
        }
        
        // Иначе загружаем из сети
        return fetch(event.request).then(function(response) {
          // Кэшируем только успешные ответы
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Клонируем ответ для кэширования
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
      .catch(function() {
        // Fallback для оффлайн режима
        if (event.request.url.includes('telegram.org')) {
          return new Response('', { status: 200 });
        }
      })
  );
});