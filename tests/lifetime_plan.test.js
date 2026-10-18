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
    expect(Plan.verifyKey('CONFEITEXVIP')).toBe(true);
    expect(Plan.verifyKey('cftx-8990')).toBe(true);
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
});
