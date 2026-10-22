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

  it('should validate activation keys correctly', () => {
    expect(Plan.PRICE_BRL).toBe(397.90);
    expect(Plan.verifyKey('CONFEITEXVIP')).toBe(true);
    expect(Plan.verifyKey('cftx-8990')).toBe(true);
    expect(Plan.verifyKey('cftx-397')).toBe(true);
    expect(Plan.verifyKey('CFTX39790')).toBe(true);
    expect(Plan.verifyKey('CFTX-2026-ABCD')).toBe(true);
    expect(Plan.verifyKey('KWF-9876543210')).toBe(true);
    expect(Plan.verifyKey('HOT-9876543210')).toBe(true);
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

  it('should auto-activate annual plan when Mercado Pago returns with payment=success', () => {
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
    const result = Plan.handleMercadoPagoReturn();
    expect(result).toBe(true);
    expect(Plan.isLifetimeActive()).toBe(true);
    expect(globalThis.localStorage.getItem('confeitex_activation_key')).toBe('MP-9876543210');

    globalThis.window = originalWindow;
  });
});
