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
    expect(AiSupport.REFUND_AMOUNT_BRL).toBe('89,90');
    expect(AiSupport.getDaysElapsed()).toBe(1);
    expect(AiSupport.getDaysRemaining()).toBe(7);
    expect(AiSupport.isWithinGuarantee()).toBe(true);
  });

  it('should handle elapsed days and guarantee expiration boundary', () => {
    // Simula 3 dias decorridos
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.localStorage.setItem('confeitex_activation_date', threeDaysAgo);
    expect(AiSupport.getDaysElapsed()).toBe(4);
    expect(AiSupport.isWithinGuarantee()).toBe(true);

    // Simula 8 dias decorridos (fora do prazo de 7 dias)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    globalThis.localStorage.setItem('confeitex_activation_date', eightDaysAgo);
    expect(AiSupport.isWithinGuarantee()).toBe(false);
  });
});
