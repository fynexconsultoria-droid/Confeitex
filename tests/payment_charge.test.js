import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PaymentCharge } from '../js/paymentCharge.js';
import { State } from '../js/state.js';

describe('PaymentCharge - Universal Pix and Bank Charging Module', () => {
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
    State.orders = [];
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
  });

  it('should save and retrieve confectioner payment configurations correctly', () => {
    PaymentCharge.saveConfig({
      pixKey: 'confeitaria@doces.com.br',
      pixName: 'Doces da Maria',
      pixCity: 'Sao Paulo',
      bankInfo: 'Banco Inter (077) Ag 0001 CC 12345-6',
      paymentLink: 'https://infinitepay.io/pay/maria',
      instructions: 'Enviar comprovante com nome e número do pedido.'
    });

    const cfg = PaymentCharge.getConfig();
    expect(cfg.pixKey).toBe('confeitaria@doces.com.br');
    expect(cfg.pixName).toBe('Doces da Maria');
    expect(cfg.pixCity).toBe('Sao Paulo');
    expect(cfg.bankInfo).toBe('Banco Inter (077) Ag 0001 CC 12345-6');
    expect(cfg.paymentLink).toBe('https://infinitepay.io/pay/maria');
    expect(cfg.instructions).toBe('Enviar comprovante com nome e número do pedido.');
  });

  it('should sanitize and trim config fields when saving', () => {
    PaymentCharge.saveConfig({
      pixKey: '  11999998888  ',
      pixName: '  Doces Finos  ',
      pixCity: '  Campinas  '
    });

    const cfg = PaymentCharge.getConfig();
    expect(cfg.pixKey).toBe('11999998888');
    expect(cfg.pixName).toBe('Doces Finos');
    expect(cfg.pixCity).toBe('Campinas');
  });

  it('should correctly build WhatsApp charge URL and message with Pix code and bank info', () => {
    let openedUrl = '';
    const origOpen = globalThis.window?.open;
    if (!globalThis.window) globalThis.window = {};
    globalThis.window.open = (url) => { openedUrl = url; };

    const order = {
      id: 'ord_123',
      clientName: 'Ana Souza',
      clientPhone: '(11) 98765-4321',
      flavor: 'Bolo de Morango',
      productType: 'Bolo',
      totalValue: 120.00,
      deliveryDate: '2026-11-15',
      deliveryTime: '15:00'
    };

    const config = {
      pixKey: '11987654321',
      pixName: 'Maria Silva',
      bankInfo: 'Nubank Ag 0001 C/C 99999-9',
      paymentLink: 'https://pag.link/123'
    };

    PaymentCharge.sendWhatsApp(order, 120.00, '00020126580014BR.GOV.BCB.PIX...', config);

    expect(openedUrl).toContain('https://wa.me/5511987654321?text=');
    const decodedText = decodeURIComponent(openedUrl.split('?text=')[1]);

    expect(decodedText).toContain('Ana Souza');
    expect(decodedText).toContain('Bolo de Morango');
    expect(decodedText).toContain('15/11/2026');
    expect(decodedText).toContain('*Chave Pix:* 11987654321');
    expect(decodedText).toContain('00020126580014BR.GOV.BCB.PIX...');
    expect(decodedText).toContain('Nubank Ag 0001 C/C 99999-9');
    expect(decodedText).toContain('https://pag.link/123');

    if (origOpen) globalThis.window.open = origOpen;
  });
});
