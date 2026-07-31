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
