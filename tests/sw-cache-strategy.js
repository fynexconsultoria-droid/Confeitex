const fs = require('fs');

const swCode = fs.readFileSync('c:/Users/joaoa/Desktop/Confeitex/sw.js', 'utf8');

if (!swCode.includes("event.request.mode === 'navigate'")) {
  throw new Error('Service Worker should prioritise navigation requests via network-first strategy.');
}

if (!swCode.includes("fetch(event.request, { cache: 'no-store' })")) {
  throw new Error('Service Worker should bypass browser cache for app assets to pick up new versions.');
}

console.log('service worker cache strategy check passed');
