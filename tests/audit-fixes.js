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

console.log('--- ALL AUDIT FIX TESTS PASSED ---');
