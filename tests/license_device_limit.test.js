import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Plan } from '../js/plan.js';

describe('Confeitex 2-Device Limit per License Key', () => {
  let mockStore = {};
  let originalLocalStorage;
  let originalFetch;

  beforeEach(() => {
    mockStore = {};
    originalLocalStorage = globalThis.localStorage;
    originalFetch = globalThis.fetch;

    globalThis.localStorage = {
      getItem: (k) => (k in mockStore ? mockStore[k] : null),
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
      clear: () => { mockStore = {}; }
    };
  });

  afterEach(() => {
    globalThis.localStorage = originalLocalStorage;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('should generate and persist a unique device id', () => {
    const devId1 = Plan.getDeviceId();
    expect(devId1).toBeTruthy();
    expect(devId1.startsWith('cftx_')).toBe(true);

    // Calling again returns the exact same device ID
    const devId2 = Plan.getDeviceId();
    expect(devId2).toBe(devId1);
  });

  it('should detect a readable device name', () => {
    const devName = Plan.getDeviceName();
    expect(devName).toBeTruthy();
    expect(typeof devName).toBe('string');
  });

  it('should reject invalid or empty keys before calling the network', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    const resEmpty = await Plan.validateKeyWithDevice('');
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.error).toBe('empty_key');
    expect(fetchSpy).not.toHaveBeenCalled();

    const resInvalid = await Plan.validateKeyWithDevice('ABC-123');
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.error).toBe('invalid_key');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should allow up to 2 devices and block the 3rd device with device_limit_exceeded', async () => {
    const mockWorkerUrl = 'https://confeitex-api.test.workers.dev';
    globalThis.localStorage.setItem('confeitex_mp_worker_url', mockWorkerUrl);

    // Simula o banco de dispositivos da chave no worker
    const activeDevices = new Set();

    globalThis.fetch = vi.fn(async (url, opts) => {
      if (url.endsWith('/validate-license')) {
        const body = JSON.parse(opts.body);
        const { deviceId, maxDevices = 2 } = body;

        if (activeDevices.has(deviceId)) {
          return {
            ok: true,
            json: async () => ({
              valid: true,
              devicesCount: activeDevices.size,
              maxDevices,
              message: 'Dispositivo já autorizado.'
            })
          };
        }

        if (activeDevices.size >= maxDevices) {
          return {
            ok: false,
            status: 403,
            json: async () => ({
              valid: false,
              error: 'device_limit_exceeded',
              devicesCount: activeDevices.size,
              maxDevices,
              message: `Limite de dispositivos atingido! Esta chave já está ativa em ${activeDevices.size} de ${maxDevices} aparelhos permitidos.`
            })
          };
        }

        activeDevices.add(deviceId);
        return {
          ok: true,
          json: async () => ({
            valid: true,
            devicesCount: activeDevices.size,
            maxDevices,
            message: 'Dispositivo vinculado com sucesso!'
          })
        };
      }

      if (url.endsWith('/release-license')) {
        const body = JSON.parse(opts.body);
        activeDevices.delete(body.deviceId);
        return {
          ok: true,
          json: async () => ({
            success: true,
            devicesCount: activeDevices.size,
            message: 'Dispositivo liberado com sucesso.'
          })
        };
      }

      return { ok: false, status: 404, json: async () => ({ error: 'not_found' }) };
    });

    const testKey = 'CFTX-8990-TEST';

    // 1. Primeiro Dispositivo (Aparelho 1)
    globalThis.localStorage.setItem('confeitex_device_id', 'cftx_device_1');
    const res1 = await Plan.validateKeyWithDevice(testKey);
    expect(res1.valid).toBe(true);
    expect(res1.devicesCount).toBe(1);
    expect(res1.maxDevices).toBe(2);

    // 2. Segundo Dispositivo (Aparelho 2)
    globalThis.localStorage.setItem('confeitex_device_id', 'cftx_device_2');
    const res2 = await Plan.validateKeyWithDevice(testKey);
    expect(res2.valid).toBe(true);
    expect(res2.devicesCount).toBe(2);
    expect(res2.maxDevices).toBe(2);

    // 3. Terceiro Dispositivo (Aparelho 3) -> Deve ser BLOQUEADO!
    globalThis.localStorage.setItem('confeitex_device_id', 'cftx_device_3');
    const res3 = await Plan.validateKeyWithDevice(testKey);
    expect(res3.valid).toBe(false);
    expect(res3.error).toBe('device_limit_exceeded');
    expect(res3.message).toContain('Limite de dispositivos atingido');

    // 4. Se o Aparelho 1 liberar/desvincular a licença
    globalThis.localStorage.setItem('confeitex_device_id', 'cftx_device_1');
    globalThis.localStorage.setItem('confeitex_activation_key', testKey);
    await Plan.releaseDevice();
    expect(Plan.isLifetimeActive()).toBe(false);

    // 5. Agora o Aparelho 3 tenta novamente -> Deve CONSEGUIR ativar!
    globalThis.localStorage.setItem('confeitex_device_id', 'cftx_device_3');
    const res3Retry = await Plan.validateKeyWithDevice(testKey);
    expect(res3Retry.valid).toBe(true);
    expect(res3Retry.devicesCount).toBe(2);
  });

  it('should require internet connection to activate a new key and reject unauthorized bypasses', async () => {
    globalThis.localStorage.setItem('confeitex_mp_worker_url', 'https://confeitex-api.offline.workers.dev');

    // Simula erro de conexão (offline)
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch (offline)'));

    const res = await Plan.validateKeyWithDevice('CFTX-8990-TEST');
    expect(res.valid).toBe(false);
    expect(res.error).toBe('network_error');
    expect(res.message).toContain('Verifique sua conexão');
  });
});
