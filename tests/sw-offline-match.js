const fs = require('fs');

const swCode = fs.readFileSync('c:/Users/joaoa/Desktop/Confeitex/sw.js', 'utf8');

if (!swCode.includes("{ ignoreSearch: true }")) {
  throw new Error('Service Worker should use { ignoreSearch: true } to support versioned query strings offline.');
}

if (swCode.includes("request.url.includes('?v=')")) {
  throw new Error('Service Worker should not discard caching of assets having query versions.');
}

console.log('sw offline match checks passed');
