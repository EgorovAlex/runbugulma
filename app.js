const STORAGE_KEY = 'kps_entries_v1';
const SYNC_URL = 'https://your-server.example.com/sync'; // <-- замените на ваш endpoint

// Telegram WebApp readiness (работает в Telegram)
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
}

// Регистрация service worker для оффлайна
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js')
    .then(() => console.log('SW registered'))
    .catch(err => console.warn('SW register failed', err));
}

// Элементы
const netStatusEl = document.getElementById('netStatus');
const runnerInput = document.getElementById('runner');
const checkpointSelect = document.getElementById('checkpoint');
const markBtn = document.getElementById('markBtn');
const syncBtn = document.getElementById('syncBtn');
const listEl = document.getElementById('list');

// Состояние сети
function updateNetworkStatus() {
  const online = navigator.onLine;
  netStatusEl.textContent = online ? 'онлайн' : 'оффлайн';
  netStatusEl.style.color = online ? 'green' : 'red';
  if (online) trySync();
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

// LocalStorage helpers
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('loadEntries error', e);
    return [];
  }
}
function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Render
function render() {
  const entries = loadEntries();
  if (entries.length === 0) {
    listEl.innerHTML = '<i>Пока нет записей</i>';
    return;
  }
  listEl.innerHTML = '';
  entries.slice().reverse().forEach(e => {
    const div = document.createElement('div');
    div.className = 'entry';
    const t = new Date(e.time).toLocaleString();
    div.innerHTML = `
      <div><b>Номер:</b> ${e.runner}</div>
      <div><b>КП:</b> ${e.checkpoint}</div>
      <div><b>Время:</b> ${t}</div>
<div class="${e.synced ? 'synced' : 'not-synced'}">
        ${e.synced ? 'Синхронизировано' : 'Не синхронизировано'}
      </div>
    `;
    listEl.appendChild(div);
  });
}

// Добавление записи
markBtn.addEventListener('click', () => {
  const runner = runnerInput.value && runnerInput.value.trim();
  const checkpoint = checkpointSelect.value;
  if (!runner) {
    alert('Введите номер бегуна');
    return;
  }
  const entry = {
    id: 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
    runner,
    checkpoint,
    time: new Date().toISOString(),
    synced: false
  };
  const entries = loadEntries();
  entries.push(entry);
  saveEntries(entries);
  render();
  runnerInput.value = '';
});

// Синхронизация: отправляем все несинхронизированные записи на сервер
async function trySync() {
  if (!navigator.onLine) return;
  const entries = loadEntries();
  const unsynced = entries.filter(e => !e.synced);
  if (unsynced.length === 0) {
    console.log('Нет несинхронизированных записей');
    return;
  }

  // Попробуем отправить на сервер
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: unsynced })
    });
    if (!res.ok) throw new Error('Network response not ok');
    const result = await res.json(); // ожидаем подтверждение
    // Предполагается, что сервер вернёт список успешно принятых id
    const accepted = result.acceptedIds || unsynced.map(e => e.id);
    const newEntries = entries.map(e => {
      if (accepted.includes(e.id)) return { ...e, synced: true };
      return e;
    });
    saveEntries(newEntries);
    render();
    alert('Синхронизация прошла успешно: ' + accepted.length + ' записей');
  } catch (err) {
    console.warn('Sync failed', err);
    // Если ошибка — оставляем записи локально, попытка при следующем онлайн
  }
}

syncBtn.addEventListener('click', () => {
  if (!navigator.onLine) {
    alert('Сеть недоступна — синхронизация отложена');
    return;
  }
  trySync();
});

// Инициализация
render();
