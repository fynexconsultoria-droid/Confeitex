// Confeitex - Service Worker (PWA Offline Support)
// Estratégia: Stale-While-Revalidate — version.txt sempre vai à rede
// O nome do cache usa a versão da URL (?v=X) para invalidar automaticamente

const SW_VERSION = (self.location.search.match(/[?&]v=([^&]+)/) || [null, '1.0.0'])[1];
const CACHE_NAME = 'confeitex-cache-v' + SW_VERSION;

// Arquivos que serão cacheados na instalação do Service Worker
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/state.js',
  './js/auth.js',
  './js/utils.js',
  './js/ui.js',
  './js/pwa.js',
  './js/chart.js',
  './js/notifications.js',
  './js/dashboard.js',
  './js/orders.js',
  './js/clients.js',
  './js/settings.js',
  './js/finances.js',
  './js/updates.js',
  './js/app.js',
  './js/trash.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// INSTALAÇÃO — cacheia todos os arquivos essenciais (tolerante a falhas)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando arquivos do Confeitex...');
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(url =>
            cache.add(url).catch(() => {
              console.warn('[SW] Falha ao cachear: ' + url);
            })
          )
        );
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// ATIVAÇÃO — limpa caches antigos quando uma nova versão do SW é ativada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Toma controle imediato de todas as páginas abertas
      return self.clients.claim();
    })
  );
});

// FETCH — intercepta requisições e serve do cache (Cache-First)
// IMPORTANTE: não revalida em segundo plano. O conteúdo do cache só muda quando
// um novo Service Worker (nova versão aceita pelo usuário) instala o próprio cache.
// Assim, clicar em "Mais Tarde" realmente adia a atualização.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // version.txt sempre vai à rede — essencial para detectar atualizações
  if (event.request.url.includes('version.txt')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se está no cache, serve direto (sem substituir pelo conteúdo novo)
        if (cachedResponse) return cachedResponse;

        // Cache miss: busca na rede e guarda (menos URLs com ?v=, que são temporárias)
        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            if (!event.request.url.includes('?v=')) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse || new Response('Offline', { status: 504, statusText: 'Offline' }));
      })
  );
});

// ============================================================================
// Notificações em segundo plano
// ============================================================================

// Mini-banco IndexedDB (compartilhado com a página — mesma estrutura que notifications.js)
function swOpenDB() {
  return new Promise((resolve) => {
    const req = indexedDB.open('confeitex-sw-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function swGet(key) {
  return swOpenDB().then((db) => new Promise((resolve) => {
    if (!db) return resolve(undefined);
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  }));
}

function swSet(key, value) {
  return swOpenDB().then((db) => new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  }));
}

// Periodic Background Sync — fallback para navegadores Chromium sem Notification Triggers.
// O navegador acorda o service worker periodicamente e executamos a checagem.
self.addEventListener('periodicsync', (event) => {
  if (event.tag !== 'confeitex-notif-sync') return;
  event.waitUntil(swRunCheck());
});

async function swRunCheck() {
  if (!('Notification' in self) || Notification.permission !== 'granted') return;

  const snapshot = await swGet('confeitex_snapshot');
  if (!snapshot || !snapshot.enabled) return;

  const settings = snapshot.settings || {};
  const daysBeforeList = settings.daysBefore || [0, 1];
  const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];
  const sent = await swGet('confeitex_sent') || {};
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const dayLabels = { 0: 'Hoje', 1: 'Amanhã', 2: 'em 2 Dias', 3: 'em 3 Dias' };
  const newSent = { ...sent };

  // Limpa chaves de datas passadas
  for (const k in newSent) {
    const m = k.match(/^notif_d(\d+)_(\d{4}-\d{2}-\d{2})$/);
    if (m && m[2] < todayStr) delete newSent[k];
  }

  for (const dayOffset of daysBeforeList) {
    const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
    const targetDateStr = targetDateObj.toISOString().split('T')[0];

    const matchingOrders = (snapshot.orders || []).filter(o =>
      o.deliveryDate === targetDateStr && allowedStatuses.includes(o.status));
    if (matchingOrders.length === 0) continue;

    const cacheKey = `notif_d${dayOffset}_${targetDateStr}`;
    if (sent[cacheKey]) continue;

    let bodyMsg = `${matchingOrders.length} entrega(s) agendada(s) para ${dayLabels[dayOffset] || targetDateStr}:\n`;
    bodyMsg += matchingOrders.slice(0, 3).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
    if (matchingOrders.length > 3) {
      bodyMsg += `\ne mais ${matchingOrders.length - 3} pedido(s)...`;
    }
    if (settings.alertPendingPayment !== false) {
      const withPendingVal = matchingOrders.filter(o => (o.totalValue || 0) > 0);
      if (withPendingVal.length > 0) {
        const totalVal = withPendingVal.reduce((s, o) => s + (o.totalValue || 0), 0);
        bodyMsg += `\n💰 Valor total: R$ ${totalVal.toFixed(2).replace('.', ',')}`;
      }
    }

    const title = dayOffset === 0
      ? 'Confeitex - Entregas de Hoje! 🎂'
      : `Confeitex - Lembrete: Entregas ${dayLabels[dayOffset] || 'em breve'} 🎂`;

    self.registration.showNotification(title, {
      body: bodyMsg,
      icon: 'icons/icon-192x192.png',
      tag: `confeitex-day-${dayOffset}-${targetDateStr}`
    });

    newSent[cacheKey] = true;
  }

  await swSet('confeitex_sent', newSent);
}

// Ao tocar/clicar na notificação, abre ou foca o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow('./');
  })());
});
