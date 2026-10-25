import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Plan } from '../js/plan.js';

describe('Confeitex Lifetime Plan & Lock System', () => {
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

  it('should be locked by default until single payment / activation key is provided', () => {
    expect(Plan.isLifetimeActive()).toBe(false);
    const status = Plan.getStatus();
    expect(status.type).toBe('locked');
    expect(status.isLifetime).toBe(false);
    expect(Plan.canUse('unlimited_orders')).toBe(false);
    expect(Plan.canUse('finances_tab')).toBe(false);
  });

  it('should validate activation keys correctly and reject backdoors', () => {
    expect(Plan.PRICE_BRL).toBe(1.00);
    // Chaves padrão Confeitex válidas
    expect(Plan.verifyKey('CFTX-2026-ABCD')).toBe(true);
    expect(Plan.verifyKey('CFTX-ABCD-EFGH-JKLM')).toBe(true);
    expect(Plan.verifyKey('CFTX39790')).toBe(true);
    // Backdoors e chaves mestras inseguras foram removidas
    expect(Plan.verifyKey('CONFEITEXVIP')).toBe(false);
    expect(Plan.verifyKey('KWF-9876543210')).toBe(false);
    expect(Plan.verifyKey('HOT-9876543210')).toBe(false);
    expect(Plan.verifyKey('123')).toBe(false);
    expect(Plan.verifyKey('')).toBe(false);
  });

  it('should activate lifetime access and unlock all features forever', () => {
    Plan.activateLifetime('CFTX-VITALICIO-TEST');
    expect(Plan.isLifetimeActive()).toBe(true);
    expect(Plan.isPremium()).toBe(true);
    const status = Plan.getStatus();
    expect(status.type).toBe('active');
    expect(status.isLifetime).toBe(true);

    expect(Plan.canUse('unlimited_orders')).toBe(true);
    expect(Plan.canUse('finances_tab')).toBe(true);
    expect(Plan.canUse('pdf_export')).toBe(true);
    expect(Plan.canUse('backup_restore')).toBe(true);
  });

  it('should require presentation and key input when not activated', async () => {
    const { Onboarding } = await import('../js/onboarding.js');
    expect(Plan.isLifetimeActive()).toBe(false);
    expect(Onboarding.shouldShow()).toBe(true);

    Plan.activateLifetime('CONFEITEXVIP');
    expect(Plan.isLifetimeActive()).toBe(true);
    Onboarding.markSeen();
    expect(Onboarding.shouldShow()).toBe(false);
  });

  it('should expire after 1 year (365 days) and require renewal', () => {
    Plan.activateLifetime('CFTX-ANUAL-2026');
    expect(Plan.isLifetimeActive()).toBe(true);

    // Simula data de expiração no passado (após 1 ano)
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    globalThis.localStorage.setItem('confeitex_sub_expires', expiredDate);

    expect(Plan.isLifetimeActive()).toBe(false);
    const status = Plan.getStatus();
    expect(status.type).toBe('expired');
    expect(Plan.canUse('unlimited_orders')).toBe(false);
  });

  it('should auto-activate annual plan when Mercado Pago returns with payment=success', async () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: {
        search: '?payment=success&payment_id=9876543210',
        pathname: '/app.html'
      },
      history: {
        replaceState: () => {}
      }
    };

    expect(Plan.isLifetimeActive()).toBe(false);
    const result = await Plan.handleMercadoPagoReturn();
    expect(result).toBe(true);
    expect(Plan.isLifetimeActive()).toBe(true);
    expect(globalThis.localStorage.getItem('confeitex_activation_key')).toBe('MP-9876543210');

    globalThis.window = originalWindow;
  });

  it('should sanitize payment_id and prevent XSS injection in modal', async () => {
    const originalWindow = globalThis.window;
    const originalDoc = globalThis.document;

    // Simula URL com payload XSS no payment_id
    globalThis.window = {
      location: {
        search: '?payment=success&payment_id=%3Cimg%20src=x%20onerror=alert(1)%3E',
        pathname: '/app.html'
      },
      history: {
        replaceState: () => {}
      }
    };

    await Plan.handleMercadoPagoReturn();
    // Como o payment_id tem caracteres inválidos (< > =), deve cair no fallback seguro 'CFTX397'
    const storedKey = globalThis.localStorage.getItem('confeitex_activation_key');
    expect(storedKey).toBe('CFTX397');
    expect(storedKey).not.toContain('<img');

    // Testa escape no showPaymentSuccessModal diretamente com um mock DOM
    const createdElements = [];
    globalThis.document = {
      getElementById: () => null,
      createElement: (tag) => {
        const el = {
          tagName: tag,
          className: '',
          id: '',
          innerHTML: '',
          setAttribute: () => {},
          querySelector: () => null
        };
        createdElements.push(el);
        return el;
      },
      body: {
        appendChild: () => {}
      }
    };

    Plan.showPaymentSuccessModal('<script>alert("xss")</script>');
    const modalOverlay = createdElements[0];
    expect(modalOverlay.innerHTML).not.toContain('<script>');
    expect(modalOverlay.innerHTML).toContain('&lt;script&gt;');

    globalThis.window = originalWindow;
    globalThis.document = originalDoc;
  });
});
