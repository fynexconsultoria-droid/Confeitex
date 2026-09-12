/**
 * Tests for SetupWizard and User/Company Registration in Confeitex
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
  requestAnimationFrame: (fn) => fn(),
  localStorage: mockStorage,
  sessionStorage: mockStorage,
  navigator: { onLine: true, language: 'pt-BR' },
  location: { hash: '#dashboard', search: '' },
  crypto: { randomUUID: () => 'uuid_' + Math.random().toString(36).slice(2, 10) },
  window: {},
  document: {
    createElement: () => ({
      setAttribute: () => {},
      classList: { add: () => {}, remove: () => {} },
      appendChild: () => {},
      querySelectorAll: () => []
    }),
    body: { appendChild: () => {} },
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
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

// Load scripts
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, context);
context.validateStateDump = vm.runInContext('validateStateDump;', context);
context.safeStorage = vm.runInContext('safeStorage;', context);
context.escapeHTML = vm.runInContext('escapeHTML;', context);
context.sanitizeText = vm.runInContext('sanitizeText;', context);

const i18nCode = fs.readFileSync(path.join(__dirname, '../js/i18n.js'), 'utf8');
context.I18n = vm.runInContext(i18nCode + '; I18n;', context);

const stateCode = fs.readFileSync(path.join(__dirname, '../js/state.js'), 'utf8');
context.State = vm.runInContext(stateCode + '; State;', context);

const wizardCode = fs.readFileSync(path.join(__dirname, '../js/setup-wizard.js'), 'utf8');
context.SetupWizard = vm.runInContext(wizardCode + '; SetupWizard;', context);

const { State, SetupWizard, validateStateDump, safeStorage, I18n } = context;

console.log('--- Running SetupWizard & User/Company Profile Tests ---');

// 1. validateStateDump includes userProfile
const testDump = {
  userProfile: {
    name: 'Carolina Mendes',
    email: 'carolina@docearte.com',
    phone: '11988887777',
    role: 'Confeiteira Chefe',
    goal: 'organize',
    weeklyVolume: 'vol2'
  },
  bakeryProfile: {
    name: 'Doce Arte Ateliê',
    phone: '11988887777',
    pix: 'carolina@docearte.com',
    orderNotice: '48h antecedência'
  }
};

const safeResult = validateStateDump(testDump);
assert(safeResult.userProfile, 'safeResult should include userProfile');
assert.strictEqual(safeResult.userProfile.name, 'Carolina Mendes');
assert.strictEqual(safeResult.userProfile.email, 'carolina@docearte.com');
assert.strictEqual(safeResult.userProfile.weeklyVolume, 'vol2');
console.log('✓ validateStateDump for userProfile ok');

// 2. SetupWizard.shouldShow logic
safeStorage.remove(SetupWizard.KEY_COMPLETED);
State.userProfile = { name: '', email: '', phone: '', role: '', goal: '', weeklyVolume: '' };
State.bakeryProfile = { name: '', phone: '', instagram: '', bio: '', pix: '', orderNotice: '' };

assert.strictEqual(SetupWizard.shouldShow(), true, 'Should show when nothing is configured');

safeStorage.set(SetupWizard.KEY_COMPLETED, 'true');
assert.strictEqual(SetupWizard.shouldShow(), false, 'Should not show when KEY_COMPLETED is true');

safeStorage.remove(SetupWizard.KEY_COMPLETED);
State.userProfile.name = 'Juliana';
assert.strictEqual(SetupWizard.shouldShow(), false, 'Should not show when userProfile.name is already set');
console.log('✓ SetupWizard.shouldShow() conditionals ok');

// 3. SetupWizard saveAndFinish persistence
safeStorage.remove(SetupWizard.KEY_COMPLETED);
SetupWizard.data = {
  userName: 'Camila Doces',
  userEmail: 'camila@email.com',
  userGoal: 'professional',
  bakeryName: 'Camila Confeitaria Fina',
  bakerySpecialty: 'sweets',
  bakeryPhone: '(11) 97777-6666',
  bakeryPix: '11977776666',
  weeklyVolume: 'vol3',
  depositPolicy: 'deposit50'
};

SetupWizard.saveAndFinish();

assert.strictEqual(safeStorage.get(SetupWizard.KEY_COMPLETED), 'true', 'KEY_COMPLETED should be set');
assert.strictEqual(State.userProfile.name, 'Camila Doces', 'State.userProfile.name should be updated');
assert.strictEqual(State.bakeryProfile.name, 'Camila Confeitaria Fina', 'State.bakeryProfile.name should be updated');
assert(State.bakeryProfile.orderNotice.includes('50%'), 'Order notice should include 50% deposit policy');

// Test State.load restores userProfile
State.userProfile = null;
State.load();
assert(State.userProfile, 'State.userProfile should be re-loaded');
assert.strictEqual(State.userProfile.name, 'Camila Doces', 'State.userProfile.name persisted correctly');
console.log('✓ SetupWizard saveAndFinish & State persistence ok');

// 3.1 Test Avatar and Logo sanitization and persistence
const sampleAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const sampleLogo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const dumpWithImages = validateStateDump({
  userProfile: { name: 'Mariana', avatar: sampleAvatar },
  bakeryProfile: { name: 'Doce Sonho', logo: sampleLogo }
});
assert.strictEqual(dumpWithImages.userProfile.avatar, sampleAvatar, 'Valid data URL avatar should be preserved');
assert.strictEqual(dumpWithImages.bakeryProfile.logo, sampleLogo, 'Valid data URL logo should be preserved');

// XSS in image data must be sanitized to empty string
const dumpXss = validateStateDump({
  userProfile: { name: 'Hacker', avatar: 'javascript:alert(1)' },
  bakeryProfile: { name: 'Hacker Shop', logo: '<script>alert(1)</script>' }
});
assert.strictEqual(dumpXss.userProfile.avatar, '', 'Invalid image protocol must be rejected');
assert.strictEqual(dumpXss.bakeryProfile.logo, '', 'Script injection in logo must be rejected');
console.log('✓ Avatar and Logo validation & sanitization ok');

// 4. i18n translation coverage for wizard
const requiredKeys = [
  'wizard.welcomeTitle',
  'wizard.welcomeSub',
  'wizard.step1Title',
  'wizard.step1Sub',
  'wizard.userName',
  'wizard.uploadPhoto',
  'wizard.uploadLogo',
  'wizard.removePhoto',
  'wizard.step2Title',
  'wizard.step2Sub',
  'wizard.bakeryName',
  'wizard.step3Title',
  'wizard.step3Sub',
  'wizard.btnNext',
  'wizard.btnBack',
  'wizard.btnFinish',
  'wizard.btnSkip'
];

requiredKeys.forEach(key => {
  const pt = I18n.dict['pt-BR'][key];
  const en = I18n.dict['en'][key];
  assert(pt, `Missing pt-BR key: ${key}`);
  assert(en, `Missing en key: ${key}`);
});
console.log('✓ Wizard i18n translations ok in pt-BR and en');

console.log('--- ALL SETUP WIZARD TESTS PASSED ---');
