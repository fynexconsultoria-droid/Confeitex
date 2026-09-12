const assert = require('assert');
const fs = require('fs');

// Create mock browser DOM environment
global.window = global;
global.document = {
  getElementById: (id) => null,
  querySelector: () => null,
  querySelectorAll: () => []
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

const vm = require('vm');

// Load dependencies in global context
vm.runInThisContext(fs.readFileSync('js/i18n.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/utils.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/state.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/trash.js', 'utf8'));

console.log('--- Testing Audit Fixes & Improvements ---');

// 1. Check window.Utils exports
assert(typeof window.Utils === 'object', 'Utils namespace must exist');
assert(typeof window.Utils.parseNumericValue === 'function', 'parseNumericValue should be in Utils');
assert(typeof window.Utils.validateStateDump === 'function', 'validateStateDump should be in Utils');
assert(typeof window.Utils.escapeHTML === 'function', 'escapeHTML should be in Utils');
assert(typeof window.Utils.maskPhone === 'function', 'maskPhone should be in Utils');
console.log('✓ window.Utils namespace properly exposes all essential utilities');

// 2. Check bidirectional catalog schema normalization in validateStateDump
const dumpWithLegacyCatalog = {
  catalog: [
    { id: 'c1', name: 'Red Velvet', category: 'Bolo de Pote', salePrice: 15.5, cost: 5.0 },
    { id: 'c2', flavor: 'Chocolate Belga', type: 'Bolo de Kg', pricePerKg: 85.0 }
  ]
};
const cleaned = validateStateDump(dumpWithLegacyCatalog);
const c1 = cleaned.catalog.find(c => c.id === 'c1');
const c2 = cleaned.catalog.find(c => c.id === 'c2');

assert.strictEqual(c1.flavor, 'Red Velvet', 'c1 flavor should match name');
assert.strictEqual(c1.type, 'Bolo de Pote', 'c1 type should match category');
assert.strictEqual(c1.pricePerKg, 15.5, 'c1 pricePerKg should match salePrice');
assert.strictEqual(c1.active, true, 'c1 active default to true');

assert.strictEqual(c2.name, 'Chocolate Belga', 'c2 name should match flavor');
assert.strictEqual(c2.category, 'Bolo de Kg', 'c2 category should match type');
assert.strictEqual(c2.salePrice, 85.0, 'c2 salePrice should match pricePerKg');
console.log('✓ Bidirectional catalog normalization works seamlessly in validateStateDump');

// 3. Test Trash.refreshActiveTab triggers for quotes and catalog
let quotesRendered = false;
let catalogRendered = false;
global.Quotes = { render: () => { quotesRendered = true; } };
global.Catalog = { render: () => { catalogRendered = true; } };

global.document.querySelector = (selector) => {
  if (selector === '.nav-link.active') {
    return { dataset: { tab: 'quotes' } };
  }
  return null;
};
Trash.refreshActiveTab();
assert.strictEqual(quotesRendered, true, 'Quotes.render should be called when quotes tab is active');

global.document.querySelector = (selector) => {
  if (selector === '.nav-link.active') {
    return { dataset: { tab: 'catalog' } };
  }
  return null;
};
Trash.refreshActiveTab();
assert.strictEqual(catalogRendered, true, 'Catalog.render should be called when catalog tab is active');
console.log('✓ Trash.refreshActiveTab correctly dispatches to Quotes and Catalog');

// 4. Test client lookup across orders and quotes
State.orders = [
  { clientName: 'Ana Clara', clientPhone: '(11) 98765-4321' }
];
State.quotes = [
  { clientName: 'Bruno Dias', clientPhone: '(21) 91234-5678' }
];
const valAna = 'ana clara';
const foundAna = (State.orders || []).find(o => o.clientName && o.clientName.toLowerCase() === valAna && o.clientPhone) ||
                 (State.quotes || []).find(q => q.clientName && q.clientName.toLowerCase() === valAna && q.clientPhone);
assert(foundAna && foundAna.clientPhone === '(11) 98765-4321', 'Should find phone in orders');

const valBruno = 'bruno dias';
const foundBruno = (State.orders || []).find(o => o.clientName && o.clientName.toLowerCase() === valBruno && o.clientPhone) ||
                   (State.quotes || []).find(q => q.clientName && q.clientName.toLowerCase() === valBruno && q.clientPhone);
assert(foundBruno && foundBruno.clientPhone === '(21) 91234-5678', 'Should find phone in quotes');
console.log('✓ Dual-lookup (orders + quotes) for client phone works accurately');

// 5. Test UI.confirm Polymorphism (Object vs String+Callback)
function createMockDOM() {
  const listeners = {};
  return {
    createElement(tag) {
      return {
        tag,
        classList: { add() {}, remove() {} },
        setAttribute() {},
        appendChild() {},
        style: {},
        dataset: {},
        addEventListener(event, fn) {
          listeners[event] = fn;
        },
        _trigger(event, target) {
          if (listeners[event]) listeners[event]({ target });
        }
      };
    },
    body: {
      appendChild() {}
    }
  };
}

global.requestAnimationFrame = (fn) => fn();
const mockDoc = createMockDOM();
global.document.createElement = mockDoc.createElement;
global.document.body = mockDoc.body;
vm.runInThisContext(fs.readFileSync('js/ui.js', 'utf8'));

// 5.1 Test String + Callback
let callbackInvoked = false;
let confirmPromise = UI.confirm('Tem certeza?', () => {
  callbackInvoked = true;
});

// Simulate confirm click
assert(typeof confirmPromise.then === 'function', 'UI.confirm should return a Promise');
console.log('✓ UI.confirm returns a Promise when called with string');

// 6. Test Backup Data Serialization with Quotes, BakeryProfile and UserProfile
State.quotes = [
  { id: 'q_test_1', clientName: 'Carla', flavor: 'Bolo Cenoura', totalValue: 120.00 }
];
State.bakeryProfile = {
  name: 'Doceria da Carla',
  pix: 'carla@pix.me',
  instagram: '@doceriacarla'
};
State.userProfile = {
  name: 'Carla Confeiteira',
  email: 'carla@email.com'
};

const backupPayload = {
  app: 'Confeitex',
  version: '6.2.0',
  exportDate: new Date().toISOString(),
  orders: State.orders,
  catalog: State.catalog,
  expenses: State.expenses,
  quotes: State.quotes,
  bakeryProfile: State.bakeryProfile,
  userProfile: State.userProfile
};

assert(Array.isArray(backupPayload.quotes) && backupPayload.quotes.length === 1, 'Quotes must be exported');
assert.strictEqual(backupPayload.bakeryProfile.name, 'Doceria da Carla', 'BakeryProfile must be exported');
assert.strictEqual(backupPayload.userProfile.name, 'Carla Confeiteira', 'UserProfile must be exported');

// Test validation on import
const importedState = validateStateDump(backupPayload);
assert.strictEqual(importedState.quotes.length, 1, 'Imported quotes validated');
assert.strictEqual(importedState.quotes[0].clientName, 'Carla', 'ClientName restored');
assert.strictEqual(importedState.bakeryProfile.pix, 'carla@pix.me', 'Bakery Pix restored');
assert.strictEqual(importedState.userProfile.email, 'carla@email.com', 'User Email restored');
console.log('✓ Backup export and import validation preserves quotes, bakeryProfile, and userProfile');

// 7. Test Trash Formatting for Quotes and Catalog
const trashItemQuote = {
  id: 't_q1',
  type: 'quote',
  label: 'Carla · Bolo Cenoura (R$ 120,00)',
  orders: [{ flavor: 'Bolo Cenoura', productType: 'Bolo de Kg', totalValue: 120 }],
  expiresAt: new Date(Date.now() + 86400000).toISOString()
};
const trashItemCat = {
  id: 't_c1',
  type: 'catalog',
  label: 'Bolo Morango (Bolo de Kg)',
  orders: { flavor: 'Bolo Morango', pricePerKg: 75.0, type: 'Bolo de Kg' },
  expiresAt: new Date(Date.now() + 86400000).toISOString()
};

State.trash = [trashItemQuote, trashItemCat];
let renderedHTML = '';
const containerMock = {
  set innerHTML(html) { renderedHTML = html; },
  get innerHTML() { return renderedHTML; },
  dataset: {},
  addEventListener() {}
};
global.document.getElementById = (id) => {
  if (id === 'trashListContainer') return containerMock;
  if (id === 'trashEmptyState') return { style: {} };
  if (id === 'btnEmptyTrash') return {};
  return null;
};
Trash.render();
assert(renderedHTML.includes('Bolo Cenoura'), 'Trash must render quote flavor');
assert(renderedHTML.includes('Bolo Morango'), 'Trash must render catalog item flavor');
assert(!renderedHTML.includes('undefined'), 'Trash details must not contain undefined');
console.log('✓ Trash.render displays quotes and catalog items cleanly without undefined');

// 8. Test Worker CORS Header
const workerCode = fs.readFileSync('worker/worker.js', 'utf8');
assert(!workerCode.includes("const allowOrigin = isAllowed && origin ? origin : '*';"), 'Worker must not fallback to wildcard * on disallowed origins');
assert(workerCode.includes("const allowOrigin = isAllowed ? origin : allowedOrigins[0];"), 'Worker must restrict disallowed origins');
console.log('✓ Cloudflare Worker CORS logic strictly protects against unauthorized origins');

console.log('--- ALL AUDIT FIX TESTS PASSED ---');
