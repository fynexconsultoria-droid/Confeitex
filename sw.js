// Fyntex Confeitaria - Service Worker (PWA Offline Support)
// Estratégia: Stale-While-Revalidate — version.txt sempre vai à rede

const CACHE_NAME = 'fyntex-cache-v' + (self.location.search.match(/v=([\w.]+)/)?.[1] || '1');

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
  './js/updates.js',
  './js/app.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// INSTALAÇÃO — cacheia todos os arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando arquivos do Fyntex...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Força ativação imediata sem esperar tabs existentes fecharem
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
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(event.request, responseToCache));
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
  );
});
