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
  './js/i18n.js',
  './js/app.js',
  './js/trash.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
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
// Versões com ?v= servem da rede para garantir conteúdo novo
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // version.txt sempre vai à rede — essencial para detectar atualizações
  if (event.request.url.includes('version.txt')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Arquivos com ?v= (cache-bust) servem da rede para garantir conteúdo novo
  if (event.request.url.includes('?v=')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));
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

// Mini-dicionário para as notificações em segundo plano (idioma salvo pelo usuário)
const SW_NOTIF_STRINGS = {
  'pt-BR': { d0: 'Hoje', d1: 'Amanhã', d2: 'em 2 Dias', d3: 'em 3 Dias', sched: '{count} entrega(s) agendada(s) para {day}:', more: '\ne mais {count} pedido(s)...', total: '\n💰 Valor total: {value}', today: 'Confeitex - Entregas de Hoje! 🎂', reminder: 'Confeitex - Lembrete: Entregas {day} 🎂', overdueBody: '{count} pedido(s) com entrega atrasada:', overdueTitle: 'Confeitex - Pedidos Atrasados ⚠️' },
  en: { d0: 'Today', d1: 'Tomorrow', d2: 'in 2 Days', d3: 'in 3 Days', sched: '{count} delivery(ies) scheduled for {day}:', more: '\nand {count} more order(s)...', total: '\n💰 Total value: {value}', today: 'Confeitex - Deliveries Today! 🎂', reminder: 'Confeitex - Reminder: Deliveries {day} 🎂', overdueBody: '{count} order(s) with late delivery:', overdueTitle: 'Confeitex - Overdue Orders ⚠️' },
  es: { d0: 'Hoy', d1: 'Mañana', d2: 'en 2 Días', d3: 'en 3 Días', sched: '{count} entrega(s) programada(s) para {day}:', more: '\ny {count} pedido(s) más...', total: '\n💰 Valor total: {value}', today: 'Confeitex - ¡Entregas de Hoy! 🎂', reminder: 'Confeitex - Recordatorio: Entregas {day} 🎂', overdueBody: '{count} pedido(s) con entrega atrasada:', overdueTitle: 'Confeitex - Pedidos Atrasados ⚠️' }
};

function swInterp(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ''));
}

function swNotif(lang) {
  return SW_NOTIF_STRINGS[lang] || SW_NOTIF_STRINGS['pt-BR'];
}

function swFmtMoney(value, currency, lang) {
  const locale = { 'pt-BR': 'pt-BR', en: 'en-US', es: 'es-ES' }[lang] || 'pt-BR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'BRL' }).format(value).replace(/\u00A0/g, ' ');
  } catch (e) {
    const sym = { BRL: 'R$', USD: '$', EUR: '€' }[currency] || 'R$';
    return sym + ' ' + Number(value).toFixed(2).replace('.', ',');
  }
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
  const todayStr = swFmtISO(now);
  const s = swNotif(snapshot.lang);
  const dayLabels = { 0: s.d0, 1: s.d1, 2: s.d2, 3: s.d3 };
  const newSent = { ...sent };

  // Horário de silêncio: não notifica dentro do intervalo configurado
  if (swInQuietHours(settings)) return;

  // Limpa chaves de datas passadas
  for (const k in newSent) {
    const m = k.match(/^notif_d(\d+)_(\d{4}-\d{2}-\d{2})$/);
    if (m && m[2] < todayStr) delete newSent[k];
    const o = k.match(/^overdue_(\d{4}-\d{2}-\d{2})$/);
    if (o && o[1] < todayStr) delete newSent[k];
  }

  for (const dayOffset of daysBeforeList) {
    const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
    const targetDateStr = swFmtISO(targetDateObj);

    const matchingOrders = (snapshot.orders || []).filter(o =>
      o.deliveryDate === targetDateStr && allowedStatuses.includes(o.status));
    if (matchingOrders.length === 0) continue;

    const cacheKey = `notif_d${dayOffset}_${targetDateStr}`;
    if (sent[cacheKey]) continue;

    let bodyMsg = swInterp(s.sched, { count: matchingOrders.length, day: dayLabels[dayOffset] || targetDateStr }) + '\n';
    bodyMsg += matchingOrders.slice(0, 3).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
    if (matchingOrders.length > 3) {
      bodyMsg += swInterp(s.more, { count: matchingOrders.length - 3 });
    }
    if (settings.alertPendingPayment !== false) {
      const withPendingVal = matchingOrders.filter(o => (o.totalValue || 0) > 0);
      if (withPendingVal.length > 0) {
        const totalVal = withPendingVal.reduce((sum, o) => sum + (o.totalValue || 0), 0);
        bodyMsg += swInterp(s.total, { value: swFmtMoney(totalVal, snapshot.currency, snapshot.lang) });
      }
    }

    const title = dayOffset === 0
      ? s.today
      : swInterp(s.reminder, { day: dayLabels[dayOffset] || targetDateStr });

    self.registration.showNotification(title, {
      body: bodyMsg,
      icon: 'icons/icon-192x192.png',
      tag: `confeitex-day-${dayOffset}-${targetDateStr}`
    });

    newSent[cacheKey] = true;
  }

  // Alertas de pedidos atrasados (data de entrega vencida e ainda pendente)
  if (settings.overdueAlerts !== false) {
    const overdueOrders = (snapshot.orders || []).filter(o =>
      allowedStatuses.includes(o.status) && o.deliveryDate && o.deliveryDate < todayStr);
    if (overdueOrders.length > 0) {
      const cacheKey = `overdue_${todayStr}`;
      if (!sent[cacheKey]) {
        let bodyMsg = swInterp(s.overdueBody, { count: overdueOrders.length }) + '\n';
        bodyMsg += overdueOrders.slice(0, 3).map(o =>
          `• ${o.clientName}: ${o.flavor} (${o.deliveryDate.split('-').reverse().join('/')})`).join('\n');
        if (overdueOrders.length > 3) {
          bodyMsg += swInterp(s.more, { count: overdueOrders.length - 3 });
        }
        const title = s.overdueTitle;
        self.registration.showNotification(title, {
          body: bodyMsg,
          icon: 'icons/icon-192x192.png',
          tag: `confeitex-overdue-${todayStr}`
        });
        newSent[cacheKey] = true;
      }
    }
  }

  await swSet('confeitex_sent', newSent);
}

// Data local em formato ISO (YYYY-MM-DD) — evita o bug de UTC (dia errado à noite)
function swFmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Verifica se agora está dentro do horário de silêncio configurado
function swInQuietHours(settings) {
  if (!settings.quietHoursEnabled) return false;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = (settings.quietHoursStart || '22:00').split(':').map(Number);
  const [eh, em] = (settings.quietHoursEnd || '07:00').split(':').map(Number);
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end;
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
