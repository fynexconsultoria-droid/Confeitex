const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Mock browser environment
global.window = global;
global.document = {
  documentElement: { lang: 'pt-BR' },
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
global.navigator = {
  onLine: true
};

// Load dependencies
vm.runInThisContext(fs.readFileSync('js/i18n.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/utils.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/state.js', 'utf8'));
vm.runInThisContext(fs.readFileSync('js/ai-chat.js', 'utf8'));

console.log('--- Running AI Help Chat & Online Restriction Tests ---');

// 1. Dicionários i18n
const requiredKeys = [
  'aiChat.fabTooltip', 'aiChat.title', 'aiChat.statusOnline', 'aiChat.statusOffline',
  'aiChat.offlineBanner', 'aiChat.welcome', 'aiChat.inputPlaceholder',
  'aiChat.inputPlaceholderOffline', 'aiChat.send', 'aiChat.thinking',
  'aiChat.chipCakeCalc', 'aiChat.chipPrice', 'aiChat.chipQuotes', 'aiChat.chipBackup',
  'aiChat.respGreeting', 'aiChat.alertOffline', 'aiChat.confirmClear', 'aiChat.toastCleared',
  'settings.aiTitle', 'settings.aiDesc', 'settings.aiStatus', 'settings.aiClearHistory'
];

['pt-BR', 'en'].forEach(lang => {
  I18n.setLang(lang);
  requiredKeys.forEach(k => {
    const val = I18n.t(k);
    assert(val && val !== k, `Missing translation for key "${k}" in language "${lang}"`);
  });
});
I18n.setLang('pt-BR');
console.log('✓ All i18n dictionary keys present in pt-BR and en');

(async () => {
  // 2. Offline Mode Basic Answering Capability
  navigator.onLine = false;
  assert.strictEqual(AIChat.isOnline(), false, 'isOnline should be false when navigator.onLine is false');

  // Simular envio offline de pergunta básica de cálculo de bolo
  const initialHistLen = AIChat.history.length;
  await AIChat.sendUserMessage('Quanto de bolo para 20 pessoas?');
  assert.strictEqual(AIChat.history.length, initialHistLen + 2, 'User message and AI response should both be added in offline mode');

  const lastAiMsg = AIChat.history[AIChat.history.length - 1];
  assert.strictEqual(lastAiMsg.sender, 'ai', 'Response should be from AI');
  assert.strictEqual(lastAiMsg.isOffline, true, 'Response must be tagged as isOffline = true');
  assert(lastAiMsg.text.includes('20 pessoas') && (lastAiMsg.text.includes('2.0 Kg') || lastAiMsg.text.includes('2 Kg')), 'Offline response must calculate cake for 20 people');
  assert(lastAiMsg.text.includes('Modo Offline') || lastAiMsg.text.includes('Assistente Local'), 'Offline response must inform that it was answered by the local assistant');

  // Simular pergunta não cadastrada no modo offline
  await AIChat.sendUserMessage('Qual a distância da Terra até a Lua?');
  const fallbackAiMsg = AIChat.history[AIChat.history.length - 1];
  assert.strictEqual(fallbackAiMsg.isOffline, true, 'Fallback response must be tagged as offline');
  assert(fallbackAiMsg.text.includes('Offline') || fallbackAiMsg.text.includes('offline'), 'Fallback response should mention offline mode');
  console.log('✓ Offline basic question answering and fallback guidance verified');

// 3. Respostas da IA quando Online
navigator.onLine = true;
assert.strictEqual(AIChat.isOnline(), true, 'isOnline should be true when online');

// 3.1 Cálculo de bolo para 30 pessoas
const resp30 = AIChat.generateNativeResponse('Quanto de bolo para 30 pessoas?');
assert(resp30.includes('30 pessoas'), 'Response must address 30 people specifically');
assert(resp30.includes('3.0 Kg') || resp30.includes('3 Kg'), 'Response must calculate correct kg proportion');
console.log('✓ Cake calculation for specific number of people verified');

// 3.2 Precificação
const respPrice = AIChat.generateNativeResponse('Como calcular o preço de venda dos meus doces?');
assert(respPrice.includes('Precificação') || respPrice.includes('precificar') || respPrice.includes('CMV'), 'Response must give pricing formula');
assert(respPrice.includes('Financeiro'), 'Response should reference the Confeitex Financeiro tab');
console.log('✓ Pricing guidance verified');

// 3.3 Orçamentos no WhatsApp
const respQuotes = AIChat.generateNativeResponse('Como mandar orçamento no whatsapp?');
assert(respQuotes.includes('WhatsApp'), 'Response must mention WhatsApp');
assert(respQuotes.includes('Orçamentos'), 'Response must guide through the Quotes tab');
console.log('✓ Quotes WhatsApp workflow guidance verified');

// 3.4 Backup e troca de celular
const respBackup = AIChat.generateNativeResponse('Como fazer backup e passar para outro celular?');
assert(respBackup.includes('Backup JSON') || respBackup.includes('JSON'), 'Response must mention JSON backup');
assert(respBackup.includes('Importar Dados') || respBackup.includes('Configurações'), 'Response must mention data import');
console.log('✓ Backup & device migration guidance verified');

// 3.5 Notificações no celular
const respNotif = AIChat.generateNativeResponse('Não estou recebendo notificações no meu Samsung');
assert(respNotif.includes('Notificações'), 'Response must address notifications');
assert(respNotif.includes('Bateria') || respNotif.includes('Samsung'), 'Response must mention battery optimization tips');
console.log('✓ Troubleshooting for Android notifications verified');

// 4. Sanitização XSS e Formatação Markdown
const malicious = '<script>alert("xss")</script>**Bolo de Chocolate**';
const formatted = AIChat.formatMarkdown(malicious);
assert(!formatted.includes('<script>'), 'Script tags must be escaped');
assert(formatted.includes('&lt;script&gt;'), 'Script tags must be HTML-escaped');
assert(formatted.includes('<strong>Bolo de Chocolate</strong>'), 'Markdown bold must be rendered into strong tags');
console.log('✓ XSS sanitization and Markdown formatting verified');

// 5. Histórico e Limpeza
AIChat.clearHistory();
assert.strictEqual(AIChat.history.length, 1, 'Clear history should reset to only the initial welcome greeting');
assert(AIChat.history[0].sender === 'ai', 'First message should be from AI');
console.log('✓ Chat history clearing and welcome message initialization verified');

console.log('--- ALL AI HELP CHAT TESTS PASSED (100%) ---');
})();
