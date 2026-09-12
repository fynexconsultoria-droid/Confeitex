const fs = require('fs');
const vm = require('vm');

// Cria ambiente de simulação com storage em memória
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
  setTimeout: fn => fn(),
  clearTimeout: () => {},
  localStorage: mockStorage,
  sessionStorage: mockStorage,
  window: {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => []
  }
};

vm.createContext(context);

// Carrega utils.js e plan.js
const utilsCode = fs.readFileSync('js/utils.js', 'utf8');
const planCode = fs.readFileSync('js/plan.js', 'utf8');

vm.runInContext(utilsCode, context);
const Plan = vm.runInContext(planCode + '; Plan;', context);
const getOrderTotal = context.getOrderTotal;

console.log('--- Testando Validador de CPF ---');
if (typeof Plan.isValidCPF !== 'function') {
  throw new Error('Plan.isValidCPF deve ser uma função');
}

// CPFs com checksum válido
const validCPFs = [
  '52998224725',
  '11144477735',
  '00000000191',
  '529.982.247-25'
];
for (const cpf of validCPFs) {
  if (!Plan.isValidCPF(cpf)) {
    throw new Error(`CPF válido ${cpf} foi rejeitado incorretamente`);
  }
}

// CPFs inválidos (dígitos errados, repetidos ou tamanho incorreto)
const invalidCPFs = [
  '11111111111',
  '00000000000',
  '12345678900',
  '123456',
  '',
  null,
  '52998224726' // checksum incorreto
];
for (const cpf of invalidCPFs) {
  if (Plan.isValidCPF(cpf)) {
    throw new Error(`CPF inválido ${cpf} foi aceito incorretamente`);
  }
}
console.log('✓ Testes de CPF passaram com sucesso');

console.log('--- Testando getOrderTotal ---');
// Bolo de Kg
const orderKg = { weight: 2.5, unitPrice: 80, extraCharges: 15 };
const totalKg = getOrderTotal(orderKg);
if (totalKg !== 215) {
  throw new Error(`getOrderTotal esperado 215, obtido ${totalKg}`);
}

// Doces (unidades)
const orderDoces = { productType: 'Doces / Brigadeiros', weight: 100, unitPrice: 1.5, extraCharges: 10 };
const totalDoces = getOrderTotal(orderDoces);
if (totalDoces !== 160) {
  throw new Error(`getOrderTotal esperado 160, obtido ${totalDoces}`);
}

// Valores com string
const orderStr = { weight: '1,5', unitPrice: '60', extraCharges: '0', totalValue: '90,00' };
const totalStr = getOrderTotal(orderStr);
if (totalStr !== 90) {
  throw new Error(`getOrderTotal esperado 90, obtido ${totalStr}`);
}
console.log('✓ Testes de getOrderTotal passaram com sucesso');

console.log('--- Testando Ciclo de Vida do Plano e Trial ---');
mockStorage.clear();

// 1. Inicialização do Trial sem cartão imediato
const initialStatus = Plan.getStatus();
if (initialStatus.type !== 'trial') {
  throw new Error(`Status inicial esperado 'trial', obtido '${initialStatus.type}'`);
}
if (initialStatus.daysLeft !== 7) {
  throw new Error(`Dias restantes iniciais esperados 7, obtidos ${initialStatus.daysLeft}`);
}
if (initialStatus.hasCard !== false) {
  throw new Error(`hasCard inicial esperado false, obtido ${initialStatus.hasCard}`);
}
if (!Plan.canUse('unlimited_orders')) {
  throw new Error('canUse unlimited_orders deve ser true durante o início do trial');
}

// 2. Cadastro de cartão
Plan.saveCardData({
  lastFourDigits: '1234',
  cardholderName: 'MARIA SILVA',
  expirationMonth: '12',
  expirationYear: '2028',
  brand: 'mastercard',
  email: 'maria@confeitex.app'
});
if (!Plan.hasRegisteredCard()) {
  throw new Error('hasRegisteredCard deve ser true após saveCardData');
}
const statusWithCard = Plan.getStatus();
if (statusWithCard.hasCard !== true) {
  throw new Error('status.hasCard deve ser true');
}

// 3. Ativação de Assinatura Premium
Plan.activateSubscription('SUB_TEST_123', 30, 'card', 'monthly');
if (!Plan.isSubscriptionActive()) {
  throw new Error('isSubscriptionActive deve ser true após activateSubscription');
}
const statusActive = Plan.getStatus();
if (statusActive.type !== 'active') {
  throw new Error(`status.type esperado 'active', obtido '${statusActive.type}'`);
}
if (statusActive.daysLeft < 29 || statusActive.daysLeft > 31) {
  throw new Error(`dias restantes esperados ~30, obtidos ${statusActive.daysLeft}`);
}

console.log('✓ Testes do ciclo de vida do Plano passaram com sucesso');
console.log('TODOS OS TESTES PASSARAM COM SUCESSO!');
