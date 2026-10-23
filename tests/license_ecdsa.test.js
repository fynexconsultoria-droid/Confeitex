import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { License } from '../js/license.js';

// Chave Privada correspondente à pública para gerar tokens assinados nos testes
const TEST_PRIVATE_KEY_JWK = {
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: 'DSjGEBWspNXw4EjoTrzzTNZLWA9gXXnCfpH6zs7hGmg',
  y: 'DtqyJb9wpg4fuQWlIJA217fvat-PswnR9DB977dOMUE',
  crv: 'P-256',
  d: 'PA9Kbdp8NLj8Vxj1be3yj7Nrm_c5hCbzZfVvGGR2nxg'
};

async function createSignedToken(payloadObj) {
  const subtle = globalThis.crypto.subtle;
  const privateKey = await subtle.importKey(
    'jwk',
    TEST_PRIVATE_KEY_JWK,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const payloadStr = JSON.stringify(payloadObj);
  const payloadB64 = Buffer.from(payloadStr, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const dataToSign = new TextEncoder().encode(payloadB64);
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    dataToSign
  );

  const sigB64 = Buffer.from(signature)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${payloadB64}.${sigB64}`;
}

describe('License - ECDSA P-256 Cryptographic Verification', () => {
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

  it('should successfully verify an authentic ECDSA signed token', async () => {
    const deviceId = 'dev_test_device_123';
    const futureExp = Date.now() + (365 * 24 * 60 * 60 * 1000); // +1 ano

    const token = await createSignedToken({
      key: 'CFTX-ABCD-EFGH-JKLM',
      deviceId,
      exp: futureExp,
      purchasedAt: new Date().toISOString()
    });

    const result = await License.verifyToken(token, deviceId);
    expect(result.valid).toBe(true);
    expect(result.payload.key).toBe('CFTX-ABCD-EFGH-JKLM');
    expect(result.payload.deviceId).toBe(deviceId);
  });

  it('should reject a tampered payload with invalid signature', async () => {
    const deviceId = 'dev_legitimate';
    const futureExp = Date.now() + 10000000;

    const token = await createSignedToken({
      key: 'CFTX-ORIG-INAL-KEY1',
      deviceId,
      exp: futureExp
    });

    // Atacante altera a chave no payload base64 sem ter a chave privada para assinar
    const [payloadB64, sigB64] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    decoded.key = 'CFTX-HACK-EDKY-HACK';
    const forgedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString('base64').replace(/=/g, '');

    const forgedToken = `${forgedPayloadB64}.${sigB64}`;
    const result = await License.verifyToken(forgedToken, deviceId);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('invalid_signature');
  });

  it('should reject token issued for a different device', async () => {
    const futureExp = Date.now() + 10000000;
    const token = await createSignedToken({
      key: 'CFTX-ABCD-EFGH-JKLM',
      deviceId: 'dev_phone_A',
      exp: futureExp
    });

    // Tentando usar o mesmo token no dispositivo B
    const result = await License.verifyToken(token, 'dev_phone_B');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('device_mismatch');
  });

  it('should reject an expired license token', async () => {
    const deviceId = 'dev_test';
    const pastExp = Date.now() - 10000; // expirou no passado

    const token = await createSignedToken({
      key: 'CFTX-ABCD-EFGH-JKLM',
      deviceId,
      exp: pastExp
    });

    const result = await License.verifyToken(token, deviceId);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('expired');
  });

  it('should reject invalid or garbage tokens', async () => {
    expect((await License.verifyToken('')).valid).toBe(false);
    expect((await License.verifyToken('not-a-token')).valid).toBe(false);
    expect((await License.verifyToken('abc.def')).valid).toBe(false);
  });
});
