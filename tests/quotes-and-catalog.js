/**
 * Tests for Confeitex Quotes (Orçamentos) & Customizable Catalog modules
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const memoryStorage = {};
const mockStorage = {
  getItem(k) { return memoryStorage[k] !== undefined ? memoryStorage[k] : null; },
  setItem(k, v) { memoryStorage[k] = String(v); },
  removeItem(k) { delete memoryStorage[k]; },
  clear() { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
};

const context = {
  console,
  Date,
  Intl,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  encodeURIComponent,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  localStorage: mockStorage,
  sessionStorage: mockStorage,
  navigator: { onLine: true, language: 'pt-BR' },
  location: { hash: '', search: '' },
  crypto: { randomUUID: () => 'uuid_' + Math.random().toString(36).slice(2, 10) },
  window: {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    documentElement: { lang: 'pt-BR' }
  },
  UI: {
    toast(msg, type) {},
    confirm(msg, cb) { if (cb) cb(); },
    alert(msg) {}
  }
};
context.window = context;

vm.createContext(context);

// Execute files in VM and expose top-level consts
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, context);
context.validateStateDump = vm.runInContext('validateStateDump;', context);
context.safeStorage = vm.runInContext('safeStorage;', context);
context.fmt = vm.runInContext('fmt;', context);
context.fmtISO = vm.runInContext('fmtISO;', context);
context.fmtDateStr = vm.runInContext('fmtDateStr;', context);
context.escapeHTML = vm.runInContext('escapeHTML;', context);
context.sanitizeText = vm.runInContext('sanitizeText;', context);

const i18nCode = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
context.I18n = vm.runInContext(i18nCode + '; I18n;', context);

const stateCode = fs.readFileSync(path.join(__dirname, '../js/state.js'), 'utf8');
context.State = vm.runInContext(stateCode + '; State;', context);

const quotesCode = fs.readFileSync(path.join(__dirname, '../js/quotes.js'), 'utf8');
context.Quotes = vm.runInContext(quotesCode + '; Quotes;', context);

const catalogCode = fs.readFileSync(path.join(__dirname, '../js/catalog.js'), 'utf8');
context.Catalog = vm.runInContext(catalogCode + '; Catalog;', context);

const { State, Quotes, Catalog, validateStateDump } = context;

console.log('--- Running Quotes & Catalog Tests ---');

// 1. State initialization
State.load();
assert(Array.isArray(State.quotes), 'State.quotes should be an array');
assert(Array.isArray(State.catalog), 'State.catalog should be an array');
assert(typeof State.bakeryProfile === 'object', 'State.bakeryProfile should be an object');
console.log('✓ State initialization ok');

// 2. State dump validation includes quotes and bakeryProfile
const dump = {
  quotes: [
    {
      id: 'q1',
      clientName: 'Mariana Lima',
      clientPhone: '(11) 98765-4321',
      productType: 'Bolo de Kg',
      flavor: 'Bolo Brigadeiro Gourmet',
      weight: 2.5,
      unitPrice: 80.0,
      extraCharges: 15.0,
      discount: 10.0,
      totalValue: 205.0,
      eventDate: '2026-10-15',
      eventTime: '15:00',
      validityDays: 7,
      validUntil: '2026-10-22',
      details: 'Massa cacau 100%, recheio brigadeiro belga',
      notes: 'Sinal de 50%',
      status: 'Pendente'
    }
  ],
  bakeryProfile: {
    name: 'Doce Encanto Ateliê',
    tagline: 'Bolos de Festa Personalizados',
    phone: '11999998888',
    instagram: '@doceencanto',
    pix: 'contato@doceencanto.com.br',
    orderNotice: 'Encomendas com 48h de antecedência'
  },
  catalog: [
    {
      id: 'cat_test_1',
      name: 'Bolo Red Velvet Supreme',
      flavor: 'Bolo Red Velvet Supreme',
      type: 'Bolo de Kg',
      category: 'Bolo de Kg',
      price: 95.0,
      salePrice: 95.0,
      pricePerKg: 95.0,
      badge: 'bestseller',
      description: 'Massa aveludada com recheio de cream cheese frosting',
      servingSize: '20 fatias',
      minOrder: '1.5 Kg',
      active: true
    }
  ]
};

const validated = validateStateDump(dump);
assert.strictEqual(validated.quotes.length, 1, 'Validated dump should have 1 quote');
assert.strictEqual(validated.quotes[0].clientName, 'Mariana Lima', 'Quote client name preserved');
assert.strictEqual(validated.bakeryProfile.name, 'Doce Encanto Ateliê', 'Bakery profile name preserved');
assert.strictEqual(validated.catalog[0].badge, 'bestseller', 'Catalog badge preserved');
console.log('✓ validateStateDump for quotes, catalog, and bakeryProfile ok');

// 3. Quotes: WhatsApp message formatting
State.quotes = [...dump.quotes];
State.bakeryProfile = { ...dump.bakeryProfile };
State.catalog = [...dump.catalog];

const waMessage = Quotes.generateWhatsAppMessage(State.quotes[0]);
assert(waMessage.includes('DOCE ENCANTO ATELIÊ'), 'Message should contain bakery name uppercase');
assert(waMessage.includes('Mariana Lima'), 'Message should address client');
assert(waMessage.includes('Bolo Brigadeiro Gourmet'), 'Message should specify flavor');
assert(waMessage.includes('2,50 Kg') || waMessage.includes('2.50 Kg'), 'Message should show weight');
assert(waMessage.includes('205,00') || waMessage.includes('205.00'), 'Message should show total calculated value');
assert(waMessage.includes('contato@doceencanto.com.br'), 'Message should include Pix key');
console.log('✓ Quotes WhatsApp message generation ok');

// 4. Quotes: 1-click Conversion to official order
const initialOrdersCount = State.orders.length;
Quotes.convertToOrder('q1');
assert.strictEqual(State.orders.length, initialOrdersCount + 1, 'Orders count should increase by 1');
const createdOrder = State.orders[State.orders.length - 1];
assert.strictEqual(createdOrder.clientName, 'Mariana Lima', 'Converted order client name matches');
assert.strictEqual(createdOrder.flavor, 'Bolo Brigadeiro Gourmet', 'Converted order flavor matches');
assert.strictEqual(createdOrder.totalValue, 205.0, 'Converted order total matches');
assert.strictEqual(State.quotes[0].status, 'Aprovado', 'Quote status should become Aprovado');
console.log('✓ Quotes 1-click conversion to order ok');

// 5. Catalog: WhatsApp catalog menu generation
const catalogMsg = Catalog.generateWhatsAppCatalog();
assert(catalogMsg.includes('DOCE ENCANTO ATELIÊ'), 'Catalog message should include bakery title');
assert(catalogMsg.includes('Bolo Red Velvet Supreme'), 'Catalog message should include item name');
assert(catalogMsg.includes('Mais Pedido') || catalogMsg.includes('Best Seller'), 'Catalog message should include badge label');
assert(catalogMsg.includes('20 fatias'), 'Catalog message should include serving size');
assert(catalogMsg.includes('contato@doceencanto.com.br'), 'Catalog message should include Pix key');
console.log('✓ Catalog WhatsApp menu compilation ok');

// 6. Trash & Restoration
State.addToTrash(State.quotes[0], 'quote', 'Orçamento Mariana Lima');
const trashQuoteEntry = State.trash[State.trash.length - 1];
assert.strictEqual(trashQuoteEntry.type, 'quote', 'Trash entry type should be quote');

State.addToTrash(State.catalog[0], 'catalog', 'Red Velvet Supreme');
const trashCatEntry = State.trash[State.trash.length - 1];
assert.strictEqual(trashCatEntry.type, 'catalog', 'Trash entry type should be catalog');

const initialQuotesCount = State.quotes.length;
State.restoreFromTrash(trashQuoteEntry.id);
assert.strictEqual(State.quotes.length, initialQuotesCount + 1, 'Restored quote should be back in State.quotes');

const initialCatalogCount = State.catalog.length;
State.restoreFromTrash(trashCatEntry.id);
assert.strictEqual(State.catalog.length, initialCatalogCount + 1, 'Restored catalog item should be back in State.catalog');

console.log('✓ Quotes & Catalog trash and restore ok');
console.log('--- ALL QUOTES & CATALOG TESTS PASSED ---');
