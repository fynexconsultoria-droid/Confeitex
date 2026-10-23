import { describe, it, expect } from 'vitest';
import { generatePixPayload, crc16, normalizePixKey, cleanText } from '../js/pix.js';

describe('Pix BACEN Generator (pix.js)', () => {
  it('calculates CRC16-CCITT correctly for BACEN standard payloads', () => {
    // Exemplo de teste clássico de CRC16
    const sample = '00020126360014br.gov.bcb.pix0114+551199999999520400005303986540510.505802BR5910CONFEITEX6009SAO PAULO62070503***6304';
    const crc = crc16(sample);
    expect(crc).toMatch(/^[0-9A-F]{4}$/);
    expect(crc.length).toBe(4);
  });

  it('normalizes different Pix key formats', () => {
    expect(normalizePixKey('teste@confeitex.com.br')).toBe('teste@confeitex.com.br');
    expect(normalizePixKey('123.456.789-00')).toBe('12345678900');
    expect(normalizePixKey('12.345.678/0001-90')).toBe('12345678000190');
    expect(normalizePixKey('11999998888')).toBe('+5511999998888');
    expect(normalizePixKey('+5511999998888')).toBe('+5511999998888');
  });

  it('cleans accented characters and special symbols for bank readers', () => {
    expect(cleanText('Jéssica Doces & Cia')).toBe('Jessica Doces  Cia');
    expect(cleanText('São Paulo - SP', 15)).toBe('Sao Paulo  SP');
  });

  it('generates a valid BR Code string with all required fields', () => {
    const payload = generatePixPayload({
      key: '11999998888',
      name: 'Maria Bolos',
      city: 'São Paulo',
      amount: 150.00,
      txid: 'PED123'
    });

    // Campo 00 (Format Indicator) deve ser 01
    expect(payload.startsWith('000201')).toBe(true);
    // Deve conter domínio BACEN
    expect(payload).toContain('br.gov.bcb.pix');
    // Moeda Real (986)
    expect(payload).toContain('5303986');
    // Valor 150.00 formatado
    expect(payload).toContain('5406150.00');
    // País BR
    expect(payload).toContain('5802BR');
    // Nome do recebedor limpo
    expect(payload).toContain('5911Maria Bolos');
    // Cidade limpa
    expect(payload).toContain('6009Sao Paulo');
    // Txid
    expect(payload).toContain('PED123');
    // Termina com 6304 + 4 hex chars de CRC
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });

  it('generates a valid BR Code without amount if not informed', () => {
    const payload = generatePixPayload({
      key: 'contato@confeitex.com',
      name: 'Doce Sonho',
      city: 'Goiania'
    });

    expect(payload).not.toContain('540');
    expect(payload).toContain('contato@confeitex.com');
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
  });
});
