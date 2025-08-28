const GAS_URL = 'https://script.google.com/macros/s/ВАШ_GAS_ID/exec';
let tg = window.Telegram?.WebApp;
let eventData = {
    kpId: null,
    participants: [],
    kpList: [],
    syncQueue: []
};

// Инициализация
async function init() {
    console.log('Initializing app...');
    
    // Инициализация Telegram WebApp
    if (tg) {
        tg.expand();
        tg.ready();
    }
    
    // Загрузка данных
    await loadKpList();
    loadLocalData();
    setupEventListeners();
    startTimers();
    
    console.log('App initialized');
}

// Загрузка списка КП
async function loadKpList() {
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_kp_list' })
        });
        
        const data = await response.json();
        eventData.kpList = data.kpList || [];
        populateKpSelect();
        
        // Сохраняем в localStorage для оффлайн работы
        localStorage.setItem('kp_list', JSON.stringify(eventData.kpList));
        
    } catch (error) {
        console.error('Error loading KP list:', error);
        // Пробуем загрузить из кэша
        const cached = localStorage.getItem('kp_list');
        if (cached) {
            eventData.kpList = JSON.parse(cached);
            populateKpSelect();
        }
    }
}

// Заполнение выбора КП
function populateKpSelect() {
    const select = document.getElementById('kpSelect');
    select.innerHTML = '';
    
    eventData.kpList.forEach(kp => {
        const option = document.createElement('option');
        option.value = kp.id;
        option.textContent = `${kp.number}. ${kp.name}`;
        option.dataset.total = kp.totalParticipants;
        select.appendChild(option);
    });
    
    // Выбираем первый КП по умолчанию
    if (eventData.kpList.length > 0) {
        select.value = eventData.kpList[0].id;
        eventData.kpId = eventData.kpList[0].id;
        updateKpStats();
    }
}

// Загрузка локальных данных
function loadLocalData() {
    const saved = localStorage.getItem('event_data');
    if (saved) {
        const data = JSON.parse(saved);
        eventData.participants = data.participants || [];
        eventData.kpId = data.kpId || eventData.kpList[0]?.id;
        
        if (eventData.kpId) {
            document.getElementById('kpSelect').value = eventData.kpId;
        }
        
        renderParticipants();
        updateCounter();
    }
}

// Сохранение данных
function saveData() {
    localStorage.setItem('event_data', JSON.stringify({
        participants: eventData.participants,
        kpId: eventData.kpId
    }));
    updateCounter();
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Выбор КП
    document.getElementById('kpSelect').addEventListener('change', function() {
        eventData.kpId = this.value;
        updateKpStats();
        saveData();
    });
    
    // Ввод с клавиатуры
    document.getElementById('participantInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            markParticipant();
        }
    });
    
    // Онлайн/оффлайн статус
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
}

// Таймеры
function startTimers() {
    setInterval(updateTime, 1000);
    setInterval(updateConnectionStatus, 5000);
    setInterval(autoSync, 30000); // Автосинхронизация каждые 30 сек
}

// Отметка участника
function markParticipant() {
    const input = document.getElementById('participantInput');
    const number = input.value.trim();
    
    if (!number || !eventData.kpId) return;
    
    const participant = {
        id: Date.now(),
        number: number,
        kpId: eventData.kpId,
        kpNumber: eventData.kpList.find(kp => kp.id == eventData.kpId)?.number,
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString('ru-RU')
    };
    
    eventData.participants.push(participant);
    eventData.syncQueue.push(participant);
    
    saveData();
    renderParticipants();
    input.value = '';
    input.focus();
    
    // Пробуем сразу синхронизировать
    if (navigator.onLine) {
        syncData();
    }
}

// Синхронизация данных
async function syncData() {
    if (!navigator.onLine || eventData.syncQueue.length === 0) return;
    
    try {
        const queue = [...eventData.syncQueue];
        
        for (const participant of queue) {
            const success = await sendToServer(participant);
            if (success) {
                // Удаляем из очереди синхронизации
                eventData.syncQueue = eventData.syncQueue.filter(p => p.id !== participant.id);
            } else {
                break; // Прерываем при ошибке
            }
        }
        
        saveData();
        
    } catch (error) {
        console.error('Sync error:', error);
    }
}

// Автосинхронизация
async function autoSync() {
    if (navigator.onLine && eventData.syncQueue.length > 0) {
        await syncData();
    }
}

// Отправка на сервер
async function sendToServer(participant) {
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sync_participant',
                participant: participant,
                chatId: tg?.initDataUnsafe?.user?.id
            })
        });
        
        return response.ok;
    } catch (error) {
        return false;
    }
}

// Обновление интерфейса
function renderParticipants() {
    const container = document.getElementById('participantsList');
    const currentKpParticipants = eventData.participants.filter(p => p.kpId == eventData.kpId);
    
    if (currentKpParticipants.length === 0) {
        container.innerHTML = '<p class="text-center">Нет отмеченных участников</p>';
        return;
    }
    
    container.innerHTML = currentKpParticipants
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(participant => `
            <div class="participant-item">
                <div class="participant-info">
                    <div class="participant-number">№${participant.number}</div>
                    <div class="participant-time">${participant.time}</div>
                </div>
                ${eventData.syncQueue.some(p => p.id === participant.id) ? '🔄' : '✅'}
            </div>
        `).join('');
}

// Вспомогательные функции
function addDigit(digit) {
    const input = document.getElementById('participantInput');
    input.value += digit;
}

function clearInput() {
    document.getElementById('participantInput').value = '';
}

function updateCounter() {
    const count = eventData.participants.filter(p => p.kpId == eventData.kpId).length;
    document.getElementById('participantsCount').textContent = `Участников: ${count}`;
}

function updateKpStats() {
    const kp = eventData.kpList.find(k => k.id == eventData.kpId);
    if (kp) {
        const passed = eventData.participants.filter(p => p.kpId == eventData.kpId).length;
        const percent = kp.totalParticipants > 0 ? (passed / kp.totalParticipants) * 100 : 0;
        
        document.getElementById('passedCount').textContent = passed;
        document.getElementById('totalCount').textContent = kp.totalParticipants;
        document.getElementById('progressFill').style.width = `${percent}%`;
    }
}

function updateTime() {
    document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('ru-RU');
}

function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    document.getElementById('connectionStatus').textContent = isOnline ? '🌐 Онлайн' : '🔌 Оффлайн';
    document.getElementById('offlineIndicator').classList.toggle('hidden', isOnline);
}

function clearData() {
    if (confirm('Очистить все данные?')) {
        eventData.participants = [];
        eventData.syncQueue = [];
        saveData();
        renderParticipants();
        updateCounter();
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);