import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MercadoPagoCheckout } from '../js/mercadopago.js';
import { Plan } from '../js/plan.js';

describe('MercadoPago and Card Registration', () => {
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

  it('should detect card brands correctly', () => {
    expect(MercadoPagoCheckout.detectCardBrand('4111111111111111')).toBe('visa');
    expect(MercadoPagoCheckout.detectCardBrand('5500000000000004')).toBe('mastercard');
    expect(MercadoPagoCheckout.detectCardBrand('378282246310005')).toBe('amex');
    expect(MercadoPagoCheckout.detectCardBrand('4011781234567890')).toBe('elo');
    expect(MercadoPagoCheckout.detectCardBrand('6062821234567890')).toBe('hipercard');
  });

  it('should return safe demo card validation when worker is not configured', async () => {
    MercadoPagoCheckout.WORKER_URL = '';
    MercadoPagoCheckout.PUBLIC_KEY = '';

    const cardPayload = {
      cardNumber: '4111 1111 1111 1111',
      cardholderName: 'Maria Silva',
      cardExpirationMonth: '12',
      cardExpirationYear: '2028',
      securityCode: '123',
      email: 'maria@exemplo.com'
    };

    const result = await MercadoPagoCheckout.validateCardForTrial(cardPayload);
    expect(result.valid).toBe(true);
    expect(result.demo).toBe(true);
    expect(result.lastFourDigits).toBe('1111');
    expect(result.brand).toBe('visa');
  });

  it('should correctly save and retrieve card data safely without exposing sensitive CVV or full PAN', () => {
    Plan.saveCardData({
      lastFourDigits: '1111',
      cardholderName: 'Maria Silva',
      expirationMonth: '12',
      expirationYear: '28',
      brand: 'visa',
      email: 'maria@exemplo.com',
      token: 'TOKEN_123'
    });

    expect(Plan.hasRegisteredCard()).toBe(true);
    const saved = Plan.getCardData();
    expect(saved.lastFourDigits).toBe('1111');
    expect(saved.cardholderName).toBe('Maria Silva');
    expect(saved.brand).toBe('visa');
    // Ensure raw card details are never saved in card data
    expect(saved.securityCode).toBeUndefined();
    expect(saved.cardNumber).toBeUndefined();
  });

  it('should calculate trial days left and status correctly', () => {
    Plan.startTrial({
      lastFourDigits: '4242',
      cardholderName: 'Teste',
      brand: 'mastercard'
    });

    const status = Plan.getStatus();
    expect(status.type).toBe('trial');
    expect(status.daysLeft).toBeGreaterThan(0);
    expect(Plan.isPremium()).toBe(true);
  });
});
