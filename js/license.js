/**
 * Confeitex — license.js
 * Módulo de Validação Criptográfica de Licença Anual (ECDSA P-256)
 * 
 * - Validação matemática local com a Chave Pública Oficial
 * - Proteção total contra forjação de licenças no localStorage
 * - Reivindicação automática pós-Checkout Pro do Mercado Pago
 * - Suporte a 2º aparelho e tolerância offline de até 30 dias
 */

import { safeStorage } from './utils.js';

// Chave Pública Oficial do Confeitex (ECDSA P-256)
// Apenas a chave pública fica no app (a privada fica protegida no Cloudflare Worker)
const PUBLIC_KEY_JWK = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'DSjGEBWspNXw4EjoTrzzTNZLWA9gXXnCfpH6zs7hGmg',
  y: 'DtqyJb9wpg4fuQWlIJA217fvat-PswnR9DB977dOMUE',
  crv: 'P-256'
};

const STORAGE_KEYS = {
  TOKEN: 'confeitex_license_token',
  KEY: 'confeitex_license_key',
  EXP: 'confeitex_license_exp',
  DEVICE_ID: 'confeitex_device_id',
  LAST_VERIFIED: 'confeitex_license_last_verified',
  WORKER_URL: 'confeitex_worker_url'
};

// ─── Helpers de Base64 URL ──────────────────────────────────────────────────

function base64UrlDecodeToUint8Array(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeToString(base64Url) {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

// ─── Módulo License ─────────────────────────────────────────────────────────

export const License = {
  PUBLIC_KEY_JWK,
  STORAGE_KEYS,
  OFFLINE_GRACE_DAYS: 30,

  /**
   * Obtém a URL do Worker de licenças configurada (ou padrão)
   */
  getWorkerUrl() {
    return (safeStorage.get(STORAGE_KEYS.WORKER_URL) || safeStorage.get('confeitex_mp_worker_url') || '').trim().replace(/\/+$/, '');
  },

  setWorkerUrl(url) {
    if (url) safeStorage.set(STORAGE_KEYS.WORKER_URL, url.trim().replace(/\/+$/, ''));
  },

  /**
   * Obtém ou gera o DeviceId único deste aparelho
   */
  getDeviceId() {
    let id = safeStorage.get(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = 'dev_' + crypto.randomUUID();
      } else {
        id = 'dev_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      }
      safeStorage.set(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
  },

  /**
   * Valida a assinatura matemática ECDSA P-256 do token
   */
  async verifyToken(token, expectedDeviceId = null) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      return { valid: false, error: 'invalid_format' };
    }

    try {
      const [payloadB64, sigB64] = token.split('.');
      if (!payloadB64 || !sigB64) {
        return { valid: false, error: 'malformed_token' };
      }

      const subtle = (typeof crypto !== 'undefined' && crypto.subtle) ? crypto.subtle : null;
      if (!subtle) {
        return { valid: false, error: 'webcrypto_unavailable' };
      }

      // Importa a chave pública
      const publicKey = await subtle.importKey(
        'jwk',
        this.PUBLIC_KEY_JWK,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );

      const dataToVerify = new TextEncoder().encode(payloadB64);
      const signatureBytes = base64UrlDecodeToUint8Array(sigB64);

      // Validação da assinatura ECDSA
      const isSignatureValid = await subtle.verify(
        { name: 'ECDSA', hash: { name: 'SHA-256' } },
        publicKey,
        signatureBytes,
        dataToVerify
      );

      if (!isSignatureValid) {
        return { valid: false, error: 'invalid_signature' };
      }

      // Assinatura válida! Lê o conteúdo do payload
      const payloadStr = base64UrlDecodeToString(payloadB64);
      const payload = JSON.parse(payloadStr);

      // Valida vinculação do dispositivo
      const deviceId = expectedDeviceId || this.getDeviceId();
      if (payload.deviceId && payload.deviceId !== deviceId) {
        return { valid: false, error: 'device_mismatch', payload };
      }

      // Valida expiração (1 ano)
      const now = Date.now();
      if (payload.exp && now > payload.exp) {
        return { valid: false, error: 'expired', payload };
      }

      return { valid: true, payload };
    } catch (err) {
      console.warn('[License] Erro na validação matemática do token:', err);
      return { valid: false, error: err.message };
    }
  },

  /**
   * Verifica se o app está com licença anual válida ativa
   */
  async isPlanActive() {
    const token = safeStorage.get(STORAGE_KEYS.TOKEN);
    if (!token) return false;

    const result = await this.verifyToken(token);
    if (!result.valid) return false;

    // Tolerância offline: se verificado com sucesso recentemente
    safeStorage.set(STORAGE_KEYS.LAST_VERIFIED, String(Date.now()));
    return true;
  },

  /**
   * Inicia fluxo de compra no Mercado Pago Checkout Pro (R$ 397,90)
   */
  async startPurchase(email = '') {
    const workerUrl = this.getWorkerUrl();
    if (!workerUrl) {
      throw new Error('Servidor de pagamentos não configurado.');
    }

    const deviceId = this.getDeviceId();
    const res = await fetch(`${workerUrl}/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, email })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.init_point) {
      throw new Error(data.message || 'Falha ao conectar com o Mercado Pago.');
    }

    // Salva o ref local para acompanhamento
    if (data.ref) {
      safeStorage.set('confeitex_pending_purchase_ref', data.ref);
    }

    return data;
  },

  /**
   * Resgata a licença pós-compra do Mercado Pago via ref
   */
  async claimPurchase(ref) {
    const workerUrl = this.getWorkerUrl();
    if (!workerUrl || !ref) return { status: 'error', message: 'Dados insuficientes' };

    const deviceId = this.getDeviceId();
    const res = await fetch(`${workerUrl}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, deviceId })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.status === 'approved' && data.token) {
      // Valida o token recebido antes de salvar
      const check = await this.verifyToken(data.token, deviceId);
      if (check.valid) {
        safeStorage.set(STORAGE_KEYS.TOKEN, data.token);
        safeStorage.set(STORAGE_KEYS.KEY, data.key);
        safeStorage.set(STORAGE_KEYS.EXP, String(data.exp));
        safeStorage.set(STORAGE_KEYS.LAST_VERIFIED, String(Date.now()));
        safeStorage.remove('confeitex_pending_purchase_ref');
        return { status: 'approved', key: data.key, exp: data.exp };
      }
    }

    return data;
  },

  /**
   * Ativação manual no 2º aparelho através da chave CFTX-XXXX-XXXX-XXXX
   */
  async activateWithKey(rawKey, deviceName = 'Meu Aparelho') {
    const key = (rawKey || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!key) throw new Error('Informe a chave de ativação.');

    const workerUrl = this.getWorkerUrl();
    if (!workerUrl) throw new Error('Servidor de licenças não configurado.');

    const deviceId = this.getDeviceId();
    const res = await fetch(`${workerUrl}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, deviceId, deviceName })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.valid || !data.token) {
      if (data.error === 'device_limit_exceeded') {
        throw new Error('Limite atingido! Esta chave já está ativa nos 2 aparelhos permitidos.');
      }
      if (data.error === 'expired_key') {
        throw new Error('Esta licença anual já expirou.');
      }
      throw new Error(data.message || 'Chave de licença inválida.');
    }

    const check = await this.verifyToken(data.token, deviceId);
    if (!check.valid) {
      throw new Error('Falha na validação de segurança da licença recebida.');
    }

    safeStorage.set(STORAGE_KEYS.TOKEN, data.token);
    safeStorage.set(STORAGE_KEYS.KEY, data.key);
    safeStorage.set(STORAGE_KEYS.EXP, String(data.exp));
    safeStorage.set(STORAGE_KEYS.LAST_VERIFIED, String(Date.now()));
    return data;
  },

  /**
   * Libera o aparelho atual da licença
   */
  async releaseDevice() {
    const key = safeStorage.get(STORAGE_KEYS.KEY);
    const workerUrl = this.getWorkerUrl();
    const deviceId = this.getDeviceId();

    if (workerUrl && key) {
      try {
        await fetch(`${workerUrl}/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, deviceId })
        });
      } catch (e) {
        console.warn('[License] Erro ao avisar servidor sobre liberação:', e);
      }
    }

    safeStorage.remove(STORAGE_KEYS.TOKEN);
    safeStorage.remove(STORAGE_KEYS.KEY);
    safeStorage.remove(STORAGE_KEYS.EXP);
    safeStorage.remove(STORAGE_KEYS.LAST_VERIFIED);
  }
};
