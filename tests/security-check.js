const fs = require('fs');
const vm = require('vm');

const code = fs.readFileSync('js/utils.js', 'utf8');
const failingStorage = {
  getItem() { throw new Error('storage unavailable'); },
  setItem() { throw new Error('storage unavailable'); },
  removeItem() { throw new Error('storage unavailable'); },
};

const context = {
  console,
  Intl,
  Date,
  Number,
  isNaN,
  parseFloat,
  String,
  Array,
  Object,
  Map,
  Set,
  localStorage: failingStorage,
  sessionStorage: failingStorage,
};

vm.createContext(context);
vm.runInContext(code, context);

if (typeof context.sanitizeForStorage !== 'function') {
  throw new Error('sanitizeForStorage missing');
}
if (typeof context.validateStateDump !== 'function') {
  throw new Error('validateStateDump missing');
}
if (!context.safeStorage || typeof context.safeStorage.get !== 'function' || typeof context.safeStorage.set !== 'function' || typeof context.safeStorage.remove !== 'function') {
  throw new Error('safeStorage missing');
}
if (context.safeStorage.get('any') !== null || context.safeStorage.set('k', 'v') !== false || context.safeStorage.remove('k') !== false) {
  throw new Error('safeStorage should fail safely when storage is unavailable');
}

const secret = {
  clientName: '<img src=x onerror=alert(1)>',
  flavor: 'Bolo <script>alert(1)</script>',
  notes: 'A & B',
  totalValue: '123,50',
  weight: '2,5',
};
const cleaned = context.sanitizeForStorage(secret);

if (/<|>/.test(cleaned.clientName) || /onerror\s*=|src\s*=|alert\s*\(/i.test(cleaned.clientName)) {
  throw new Error('clientName was not sanitized');
}
if (/<|>/.test(cleaned.flavor) || /onerror\s*=|src\s*=|alert\s*\(/i.test(cleaned.flavor)) {
  throw new Error('flavor was not sanitized');
}
if (Number(cleaned.totalValue) !== 123.5) {
  throw new Error('numeric-like strings should remain numeric-safe');
}
if (cleaned.weight !== 2.5) {
  throw new Error('weight should be numeric-safe');
}

const valid = context.validateStateDump({
  orders: [{ id: '1', clientName: '<b>Maria</b>', productType: 'Bolo de Kg', flavor: 'Chocolate', weight: 1.5, unitPrice: 50, extraCharges: 0, totalValue: 75, status: 'Pendente' }],
  catalog: [{ id: 'c1', flavor: 'Morango', pricePerKg: 70, type: 'Bolo de Kg' }],
  expenses: [{ id: 'e1', description: 'Farinha', amount: 80, date: '2026-08-13' }],
  trash: [{ id: 't1', orders: [], type: 'order', label: 'x', count: 0 }],
});
if (!Array.isArray(valid.orders) || !Array.isArray(valid.catalog) || !Array.isArray(valid.expenses) || !Array.isArray(valid.trash)) {
  throw new Error('state dump validation failed');
}
if (!valid.orders[0].clientName || valid.orders[0].clientName.includes('<')) {
  throw new Error('order name still contains HTML tags');
}

console.log('security checks passed');
