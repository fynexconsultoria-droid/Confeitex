import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Checkout } from '../js/checkout.js';
import { Plan } from '../js/plan.js';

describe('Checkout Transparente - Confeitex (PIX e Cartão sem Boleto)', () => {
  let mockStore = {};
  let originalLocalStorage;
  let originalDocument;

  beforeEach(() => {
    mockStore = {};
    originalLocalStorage = globalThis.localStorage;
    originalDocument = globalThis.document;

    globalThis.localStorage = {
      getItem: (k) => (k in mockStore ? mockStore[k] : null),
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };

    // Mock simples de DOM
    const elements = new Map();
    const createMockElement = (tag = 'div') => {
      const el = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          _classes: new Set(),
          add(c) { this._classes.add(c); el.className = Array.from(this._classes).join(' '); },
          remove(c) { this._classes.delete(c); el.className = Array.from(this._classes).join(' '); },
          contains(c) { return this._classes.has(c); }
        },
        style: {},
        attributes: {},
        textContent: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k]; },
        addEventListener: () => {},
        appendChild(child) {
          if (child && child.id) elements.set(child.id, child);
          return child;
        },
        get innerHTML() { return this._html || ''; },
        set innerHTML(val) {
          this._html = String(val);
          const matches = this._html.matchAll(/id=["']([^"']+)["']/g);
          for (const m of matches) {
            const id = m[1];
            if (!elements.has(id)) {
              const child = createMockElement('div');
              child.id = id;
              elements.set(id, child);
            }
          }
        },
        querySelector(selector) {
          if (selector === '.checkout-tabs') return createMockElement('div');
          if (selector.startsWith('#')) return elements.get(selector.slice(1)) || createMockElement('div');
          return createMockElement('div');
        },
        querySelectorAll: () => []
      };
      return el;
    };

    globalThis.document = {
      createElement: (tag) => createMockElement(tag),
      getElementById: (id) => elements.get(id) || null,
      querySelector: (selector) => {
        if (selector.startsWith('#')) return elements.get(selector.slice(1)) || null;
        return null;
      },
      querySelectorAll: () => [],
      body: {
        appendChild: (el) => {
          if (el.id) elements.set(el.id, el);
          return el;
        }
      }
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
    globalThis.document = originalDocument;
  });

  it('should have exact price of R$ 1.00 for test plan and connected Mercado Pago Pix key', () => {
    expect(Checkout.PRICE_BRL).toBe(1.00);
    expect(Plan.PRICE_BRL).toBe(1.00);
    const pixCfg = Checkout.getMerchantPixConfig();
    expect(pixCfg.key).toBe('16d0c3c4-3307-4db5-b81a-977901372845');
    expect(pixCfg.name).toBe('JOAO ANTONIO');
    expect(pixCfg.city).toBe('SAO PATRICIO');
  });

  it('should correctly detect card brands for transparent checkout', () => {
    expect(Plan.detectCardBrand('4111111111111111')).toBe('visa');
    expect(Plan.detectCardBrand('5123456789012345')).toBe('mastercard');
    expect(Plan.detectCardBrand('4011781234567890')).toBe('elo');
    expect(Plan.detectCardBrand('6062821234567890')).toBe('hipercard');
    expect(Plan.detectCardBrand('341234567890123')).toBe('amex');
    expect(Plan.detectCardBrand('1234567890123456')).toBe('credit_card');
  });

  it('should activate annual license upon approved transparent payment', () => {
    expect(Plan.isLifetimeActive()).toBe(false);

    const testKey = 'CFTX-AUTO-2026';
    Checkout.handlePaymentApproved(testKey, 'mock_token_abc.xyz');

    expect(Plan.isLifetimeActive()).toBe(true);
    expect(Plan.isPremium()).toBe(true);
    expect(Plan.getStatus().isLifetime).toBe(true);
  });

  it('should initialize modal without errors and create transparent checkout elements', () => {
    Checkout.ensureModalExists();
    const modal = document.getElementById('checkoutTransparentModal');
    expect(modal).not.toBeNull();
  });

  it('should handle Pix generation in direct mode without worker without crashing', async () => {
    Checkout.ensureModalExists();
    const inputName = document.getElementById('inputPixName');
    const inputEmail = document.getElementById('inputPixEmail');
    const inputCpf = document.getElementById('inputPixCpf');
    const btnGen = document.getElementById('btnGeneratePix');

    if (inputName) inputName.value = 'Cliente Teste';
    if (inputEmail) inputEmail.value = 'teste@confeitex.com.br';
    if (inputCpf) inputCpf.value = '12345678909';

    await Checkout.handleGeneratePix();

    const inputCode = document.getElementById('inputPixCopiaCola');
    expect(inputCode.value).toContain('000201'); // Padrão BACEN BR Code
    expect(Checkout.currentRef).toMatch(/^cftx_pix_/);
  });
});
