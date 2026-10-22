import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AiSupport } from '../js/aiSupport.js';

describe('AiSupport & 7-Day Guarantee System', () => {
  let mockStore = {};
  let originalLocalStorage;

  beforeEach(() => {
    mockStore = {};
    originalLocalStorage = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k) => (k in mockStore ? mockStore[k] : null),
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('should initialize with 7 days of VIP support and calculate days correctly', () => {
    AiSupport.init();
    expect(AiSupport.SUPPORT_DAYS).toBe(7);
    expect(AiSupport.REFUND_AMOUNT_BRL).toBe('397,90');
    expect(AiSupport.getDaysElapsed()).toBe(1);
    expect(AiSupport.getDaysRemaining()).toBe(7);
    expect(AiSupport.isWithinGuarantee()).toBe(true);
  });

  it('should distinguish onboarding mode (first 7 days) from permanent lifetime support mode', () => {
    // Primeiros 7 dias
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.localStorage.setItem('confeitex_activation_date', twoDaysAgo);
    expect(AiSupport.getMode()).toBe('onboarding');
    expect(AiSupport.getBadgeLabel()).toContain('Onboarding VIP');

    // Após 7 dias: acesso permanente ativo
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.localStorage.setItem('confeitex_activation_date', tenDaysAgo);
    expect(AiSupport.getMode()).toBe('permanent');
    expect(AiSupport.getBadgeLabel()).toBe('Suporte IA Vitalício · Online');
  });

  it('should provide specialized confectionery answers in knowledge response engine', () => {
    // Precificação
    const pricingResp = AiSupport.getKnowledgeResponse('Como precificar meu bolo?');
    expect(pricingResp).toContain('Margem de Lucro');
    expect(pricingResp).toContain('Custos Invisíveis');

    // Pedidos
    const orderResp = AiSupport.getKnowledgeResponse('Como cadastrar uma encomenda?');
    expect(orderResp).toContain('Nova Encomenda');
    expect(orderResp).toContain('50% de sinal');

    // WhatsApp
    const waResp = AiSupport.getKnowledgeResponse('Enviar comprovante no whatsapp');
    expect(waResp).toContain('Comprovante WhatsApp');
    expect(waResp).toContain('Pix');

    // Aros e fatias
    const aroResp = AiSupport.getKnowledgeResponse('Quantas fatias rende o aro 20?');
    expect(aroResp).toContain('Aro 20 cm');
    expect(aroResp).toContain('20 a 25 fatias');

    // Acesso pós 7 dias
    const after7Resp = AiSupport.getKnowledgeResponse('O suporte de IA acaba depois dos 7 dias?');
    expect(after7Resp).toContain('ano de assinatura');
    expect(after7Resp).toContain('Sem nenhuma mensalidade');
  });

  it('should manage chat history and support reset', () => {
    AiSupport.saveChatHistory([
      { sender: 'user', text: 'Oi', time: '10:00' },
      { sender: 'bot', text: 'Olá confeiteira!', time: '10:00' }
    ]);
    expect(AiSupport.getChatHistory().length).toBe(2);

    AiSupport.clearChatHistory();
    expect(AiSupport.getChatHistory().length).toBe(0);
  });
});

