// Fyntex Confeitaria - Service Worker (PWA Offline Support)
// Estratégia: Cache-First — prioriza cache local, perfeito para app 100% offline

const CACHE_NAME = 'fyntex-confeitaria-v1';

// Arquivos que serão cacheados na instalação do Service Worker
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
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
  // Ignora requisições que não são GET (POST, PUT, etc.)
  if (event.request.method !== 'GET') return;

  // Ignora requisições para URLs externas (chrome-extension://, etc.)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Se encontrou no cache, retorna do cache
        if (cachedResponse) {
          return cachedResponse;
        }

        // Se não encontrou no cache, busca da rede e cacheia para o futuro
        return fetch(event.request)
          .then((networkResponse) => {
            // Verifica se a resposta é válida
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clona a resposta para guardar no cache (stream só pode ser lido uma vez)
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(() => {
            // Se falhar na rede e não tem cache, retorna uma resposta offline genérica
            // Como o Fyntex é 100% offline, isso raramente aconteceria
            return new Response('Fyntex está offline. Recarregue a página.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' })
            });
          });
      })
  );
});
