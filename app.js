// Простая логика хранения в localStorage
const STORAGE_KEY = 'athletes_offline_v1';
const netStatusEl = document.getElementById('netStatus');
const listEl = document.getElementById('list');
const input = document.getElementById('num');
const addBtn = document.getElementById('addBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

function loadItems(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch(e){ return []; }
}
function saveItems(items){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
function render(){
  const items = loadItems();
  listEl.innerHTML = '';
  if(items.length === 0){
    listEl.innerHTML = '<li><em>Список пуст</em></li>';
    return;
  }
  items.forEach((it, idx) => {
    const li = document.createElement('li');
    li.textContent = `${it.number} `;
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `(введён: ${new Date(it.time).toLocaleString()})`;
    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.style.marginLeft='8px';
    del.onclick = ()=> {
      items.splice(idx,1);
      saveItems(items);
      render();
    };
    li.appendChild(meta);
    li.appendChild(del);
    listEl.appendChild(li);
  });
}

addBtn.onclick = ()=>{
  const val = input.value.trim();
  if(!val) return alert('Введите номер');
  const items = loadItems();
  items.push({number: val, time: Date.now()});
  saveItems(items);
  input.value = '';
  render();
};

exportBtn.onclick = ()=>{
  const items = loadItems();
  const blob = new Blob([JSON.stringify(items, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'athletes.json';
  a.click();
  URL.revokeObjectURL(url);
};

// Удалить всё
clearBtn.onclick = ()=>{
  if(confirm('Очистить весь список?')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
};

// Сеть
function updateNetworkStatus(){
  if(navigator.onLine){
  netStatusEl.textContent = 'ONLINE';
    netStatusEl.className = 'online';
    // здесь можно автоматически попытаться синхронизовать сохранённые данные с сервером
  } else {
    netStatusEl.textContent = 'OFFLINE';
    netStatusEl.className = 'offline';
  }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Регистрация service worker
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(()=> {
    console.log('SW зарегистрирован');
  }).catch(err => console.warn('SW регистр. ошибка', err));
}

render();
updateNetworkStatus();
```

sw.js
```javascript
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