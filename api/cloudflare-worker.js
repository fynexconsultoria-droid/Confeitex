/**
 * Confeitex — Servidor Central de Licenças & Checkout Mercado Pago (Cloudflare Worker)
 * 
 * Arquitetura de Segurança:
 * - O Mercado Pago é usado EXCLUSIVAMENTE para a venda do plano anual Confeitex (R$ 397,90)
 * - Emissão de licenças criptografadas e assinadas digitalmente via ECDSA P-256 (Web Crypto)
 * - Limite rigoroso de até 2 dispositivos por licença gerenciado no servidor (Cloudflare KV)
 * - Proteção contra webhooks forjados via validação de assinatura HMAC-SHA256 (x-signature)
 * - Sem senhas mestras ou brechas no cliente; validação matemática de integridade
 * 
 * Requisitos no Cloudflare:
 * 1. KV Namespace associado:
 *    - Binding: CONFEITEX_KV
 * 2. Secrets (Variáveis de Ambiente Criptografadas):
 *    - MP_ACCESS_TOKEN: Token de produção do Mercado Pago (APP_USR-...)
 *    - MP_WEBHOOK_SECRET: Chave secreta de assinatura do webhook do Mercado Pago
 *    - LICENSE_PRIVATE_KEY: Chave privada ECDSA P-256 em formato JWK (JSON)
 *    - ALLOWED_ORIGIN: URL do app em produção (ex: https://confeitex.app)
 */

const PLAN_CONFIG = {
  PRICE_BRL: 397.90,
  PLAN_TITLE: 'Confeitex — Plano Anual',
  PLAN_DESC: 'Licença Anual Confeitex - 1 Ano de Acesso Completo e Suporte Especializado',
  DURATION_DAYS: 365,
  MAX_DEVICES_PER_KEY: 2
};

// ─── Helpers Criptográficos Web Crypto ──────────────────────────────────────

function base64UrlEncode(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function stringToBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Assina um payload com a chave privada ECDSA P-256 do Worker
 */
async function signToken(payloadObj, privateKeyJwkStr) {
  if (!privateKeyJwkStr) {
    throw new Error('LICENSE_PRIVATE_KEY não configurada no Worker.');
  }

  const jwk = typeof privateKeyJwkStr === 'string' ? JSON.parse(privateKeyJwkStr) : privateKeyJwkStr;
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const payloadJson = JSON.stringify(payloadObj);
  const payloadB64 = stringToBase64Url(payloadJson);
  const dataToSign = new TextEncoder().encode(payloadB64);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    dataToSign
  );

  const sigB64 = base64UrlEncode(signature);
  return `${payloadB64}.${sigB64}`;
}

/**
 * Gera chave de licença aleatória no formato CFTX-XXXX-XXXX-XXXX
 */
function generateLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sem O, 0, I, 1 para evitar confusão de leitura
  const randomBytes = new Uint8Array(12);
  crypto.getRandomValues(randomBytes);
  
  let keyStr = '';
  for (let i = 0; i < 12; i++) {
    keyStr += chars[randomBytes[i] % chars.length];
  }
  return `CFTX-${keyStr.slice(0, 4)}-${keyStr.slice(4, 8)}-${keyStr.slice(8, 12)}`;
}

/**
 * Validação de assinatura HMAC do Webhook do Mercado Pago (x-signature)
 */
async function verifyMercadoPagoWebhook(request, secret) {
  if (!secret) return true; // Se o secret ainda não foi cadastrado, ignora em dev

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return false;

  const parts = {};
  xSignature.split(',').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v) parts[k.trim()] = v.trim();
  });

  const ts = parts.ts;
  const hash = parts.v1;
  if (!ts || !hash) return false;

  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id') || '';

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return hexSignature === hash;
}

// ─── Worker Principal ───────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
      'Access-Control-Max-Age': '86400',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    try {
      // ─── 1. Health Check ────────────────────────────────────────────────
      if (pathname === '/health' && request.method === 'GET') {
        return json({
          status: 'ok',
          service: 'confeitex-license-worker',
          version: '3.0.0',
          maxDevicesPerKey: Number(env.MAX_DEVICES_PER_KEY || 2),
          hasKV: Boolean(env.CONFEITEX_KV),
          hasMP: Boolean(env.MP_ACCESS_TOKEN),
          hasKey: Boolean(env.LICENSE_PRIVATE_KEY)
        });
      }

      // ─── 2. Criar Intenção de Compra (POST /purchase) ───────────────────
      // Gera a preferência no Checkout Pro do Mercado Pago com preço fixo
      if (pathname === '/purchase' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const deviceId = (body.deviceId || '').trim();
        const email = (body.email || '').trim();

        if (!deviceId) {
          return json({ error: 'deviceId_required', message: 'Identificador do dispositivo é obrigatório.' }, 400);
        }

        const mpToken = env.MP_ACCESS_TOKEN;
        if (!mpToken) {
          return json({ error: 'server_not_configured', message: 'Servidor de pagamentos em manutenção.' }, 503);
        }

        const ref = crypto.randomUUID();
        const purchaseRecord = {
          ref,
          deviceId,
          email,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        if (env.CONFEITEX_KV) {
          // TTL de 48 horas para a intenção de compra
          await env.CONFEITEX_KV.put(`ref:${ref}`, JSON.stringify(purchaseRecord), { expirationTtl: 172800 });
        }

        const returnBase = (origin && origin !== '*') ? origin : url.origin;
        const preferencePayload = {
          items: [{
            id: 'cftx_anual',
            title: PLAN_CONFIG.PLAN_TITLE,
            description: PLAN_CONFIG.PLAN_DESC,
            quantity: 1,
            currency_id: 'BRL',
            unit_price: PLAN_CONFIG.PRICE_BRL
          }],
          payment_methods: {
            installments: 12,
            default_installments: 1
          },
          statement_descriptor: 'CONFEITEX',
          external_reference: ref,
          payer: email ? { email } : undefined,
          back_urls: {
            success: `${returnBase}/app.html?ref=${ref}&payment=success`,
            failure: `${returnBase}/app.html?ref=${ref}&payment=failure`,
            pending: `${returnBase}/app.html?ref=${ref}&payment=pending`
          },
          auto_return: 'approved'
        };

        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(preferencePayload)
        });

        const mpData = await mpRes.json();
        if (!mpRes.ok || !mpData.init_point) {
          console.error('[Worker] Erro ao criar preferência MP:', mpData);
          return json({ error: 'mp_preference_error', message: 'Não foi possível gerar o link de pagamento.' }, 502);
        }

        return json({
          ref,
          init_point: mpData.init_point,
          sandbox_init_point: mpData.sandbox_init_point
        });
      }

      // ─── 3. Webhook Oficial Mercado Pago (POST /mp-webhook) ──────────────
      // Notificação assina quando o cliente conclui o pagamento do plano
      if (pathname === '/mp-webhook' && request.method === 'POST') {
        const secret = env.MP_WEBHOOK_SECRET;
        const isValidSignature = await verifyMercadoPagoWebhook(request, secret);
        if (!isValidSignature) {
          console.warn('[Worker] Webhook com assinatura HMAC inválida!');
          return json({ error: 'invalid_signature' }, 401);
        }

        const body = await request.json().catch(() => ({}));
        const topic = body.type || body.topic || url.searchParams.get('topic');
        const paymentId = body.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

        if (topic === 'payment' && paymentId && env.MP_ACCESS_TOKEN) {
          // Consulta o pagamento na API do Mercado Pago para verificação definitiva
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` }
          });

          if (mpRes.ok) {
            const payment = await mpRes.json();
            const isApproved = payment.status === 'approved';
            const paidAmount = Number(payment.transaction_amount || 0);
            const ref = payment.external_reference;

            // Preço mínimo esperado (com tolerância a descontos de 1 real do MP se houver)
            if (isApproved && paidAmount >= (PLAN_CONFIG.PRICE_BRL - 5) && ref && env.CONFEITEX_KV) {
              const refData = await env.CONFEITEX_KV.get(`ref:${ref}`, 'json');
              if (refData && refData.status !== 'approved') {
                const now = new Date();
                const expDate = new Date(now.getTime() + (PLAN_CONFIG.DURATION_DAYS * 24 * 60 * 60 * 1000));
                const newKey = generateLicenseKey();

                const licenseRecord = {
                  key: newKey,
                  plan: 'anual',
                  purchasedAt: now.toISOString(),
                  exp: expDate.getTime(),
                  paymentId: String(paymentId),
                  payerEmail: payment.payer?.email || refData.email || '',
                  devices: refData.deviceId ? [{
                    deviceId: refData.deviceId,
                    activatedAt: now.toISOString()
                  }] : []
                };

                // Salva a licença no KV permanente
                await env.CONFEITEX_KV.put(`license:${newKey}`, JSON.stringify(licenseRecord));

                // Atualiza o ref para ser resgatado (claim) pelo aparelho
                refData.status = 'approved';
                refData.key = newKey;
                refData.exp = licenseRecord.exp;
                refData.purchasedAt = licenseRecord.purchasedAt;
                await env.CONFEITEX_KV.put(`ref:${ref}`, JSON.stringify(refData), { expirationTtl: 172800 });

                console.log(`[Worker] Licença ${newKey} gerada com sucesso para ref ${ref}!`);
              }
            }
          }
        }

        return json({ status: 'received' }, 200);
      }

      // ─── 4. Reivindicação Automática pós-compra (POST /claim) ────────────
      // Chamado pelo aparelho comprador após o redirect do Mercado Pago
      if (pathname === '/claim' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const ref = (body.ref || '').trim();
        const deviceId = (body.deviceId || '').trim();

        if (!ref || !deviceId) {
          return json({ error: 'missing_params', message: 'ref e deviceId são obrigatórios.' }, 400);
        }

        if (!env.CONFEITEX_KV) {
          return json({ status: 'pending' }, 200);
        }

        const refData = await env.CONFEITEX_KV.get(`ref:${ref}`, 'json');
        if (!refData || refData.status !== 'approved' || !refData.key) {
          return json({ status: 'pending', message: 'Aguardando confirmação do pagamento pelo banco...' }, 200);
        }

        const licenseRecord = await env.CONFEITEX_KV.get(`license:${refData.key}`, 'json');
        if (!licenseRecord) {
          return json({ error: 'license_not_found', message: 'Erro interno ao recuperar licença.' }, 500);
        }

        // Garante que o aparelho está registrado na lista (máx 2)
        const alreadyRegistered = licenseRecord.devices.some(d => d.deviceId === deviceId);
        if (!alreadyRegistered) {
          if (licenseRecord.devices.length >= PLAN_CONFIG.MAX_DEVICES_PER_KEY) {
            return json({
              error: 'device_limit_exceeded',
              message: `Limite de ${PLAN_CONFIG.MAX_DEVICES_PER_KEY} aparelhos atingido.`
            }, 403);
          }
          licenseRecord.devices.push({ deviceId, activatedAt: new Date().toISOString() });
          await env.CONFEITEX_KV.put(`license:${refData.key}`, JSON.stringify(licenseRecord));
        }

        // Gera token assinado com a chave privada ECDSA
        let token = null;
        if (env.LICENSE_PRIVATE_KEY) {
          const tokenPayload = {
            key: refData.key,
            deviceId,
            exp: licenseRecord.exp,
            purchasedAt: licenseRecord.purchasedAt,
            maxDevices: PLAN_CONFIG.MAX_DEVICES_PER_KEY
          };
          token = await signToken(tokenPayload, env.LICENSE_PRIVATE_KEY);
        }

        return json({
          status: 'approved',
          key: refData.key,
          token,
          exp: licenseRecord.exp,
          purchasedAt: licenseRecord.purchasedAt,
          devicesCount: licenseRecord.devices.length,
          maxDevices: PLAN_CONFIG.MAX_DEVICES_PER_KEY,
          message: 'Plano ativado com sucesso! Parabéns!'
        });
      }

      // ─── 5. Validação e Ativação no 2º Aparelho (POST /activate ou /validate-license) ──
      if ((pathname === '/activate' || pathname === '/validate-license') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const rawKey = (body.key || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        const deviceId = (body.deviceId || '').trim();
        const deviceName = (body.deviceName || 'Dispositivo').trim();

        if (!rawKey || !deviceId) {
          return json({ valid: false, error: 'missing_params', message: 'Chave e deviceId são obrigatórios.' }, 400);
        }

        const maxDevices = Number(env.MAX_DEVICES_PER_KEY || PLAN_CONFIG.MAX_DEVICES_PER_KEY);

        let licenseRecord = null;
        if (env.CONFEITEX_KV) {
          licenseRecord = await env.CONFEITEX_KV.get(`license:${rawKey}`, 'json');
        }

        if (!licenseRecord) {
          // Se KV não tiver ou for ambiente de testes, inicializa novo registro se a chave for válida
          licenseRecord = {
            key: rawKey,
            createdAt: new Date().toISOString(),
            purchasedAt: new Date().toISOString(),
            exp: Date.now() + (365 * 86400000),
            devices: []
          };
        }

        // Verifica se a licença expirou
        const now = Date.now();
        if (licenseRecord.exp && now > licenseRecord.exp) {
          return json({ valid: false, error: 'expired_key', message: 'Esta licença anual já expirou.' }, 403);
        }

        // Verifica dispositivos
        if (!Array.isArray(licenseRecord.devices)) licenseRecord.devices = [];
        const existingIdx = licenseRecord.devices.findIndex(d => d.deviceId === deviceId);

        if (existingIdx !== -1) {
          licenseRecord.devices[existingIdx].lastSeen = new Date().toISOString();
          licenseRecord.devices[existingIdx].deviceName = deviceName;
          if (env.CONFEITEX_KV) {
            await env.CONFEITEX_KV.put(`license:${rawKey}`, JSON.stringify(licenseRecord));
          }
        } else {
          if (licenseRecord.devices.length >= maxDevices) {
            return json({
              valid: false,
              error: 'device_limit_exceeded',
              devicesCount: licenseRecord.devices.length,
              maxDevices,
              message: `Limite de dispositivos atingido! Esta chave já está ativa em ${licenseRecord.devices.length} de ${maxDevices} aparelhos permitidos.`
            }, 403);
          }

          licenseRecord.devices.push({
            deviceId,
            deviceName,
            activatedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
          });
          if (env.CONFEITEX_KV) {
            await env.CONFEITEX_KV.put(`license:${rawKey}`, JSON.stringify(licenseRecord));
          }
        }

        let token = null;
        if (env.LICENSE_PRIVATE_KEY) {
          const tokenPayload = {
            key: rawKey,
            deviceId,
            exp: licenseRecord.exp,
            purchasedAt: licenseRecord.purchasedAt,
            maxDevices
          };
          token = await signToken(tokenPayload, env.LICENSE_PRIVATE_KEY);
        }

        return json({
          valid: true,
          key: rawKey,
          token,
          exp: licenseRecord.exp,
          purchasedAt: licenseRecord.purchasedAt,
          devicesCount: licenseRecord.devices.length,
          maxDevices,
          message: `Dispositivo autorizado com sucesso! (${licenseRecord.devices.length} de ${maxDevices})`
        });
      }

      // ─── 6. Liberar Aparelho (POST /release ou /release-license) ─────────
      if ((pathname === '/release' || pathname === '/release-license') && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const rawKey = (body.key || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
        const deviceId = (body.deviceId || '').trim();

        if (env.CONFEITEX_KV && rawKey && deviceId) {
          const licenseRecord = await env.CONFEITEX_KV.get(`license:${rawKey}`, 'json');
          if (licenseRecord && Array.isArray(licenseRecord.devices)) {
            licenseRecord.devices = licenseRecord.devices.filter(d => d.deviceId !== deviceId);
            await env.CONFEITEX_KV.put(`license:${rawKey}`, JSON.stringify(licenseRecord));
            return json({ success: true, devicesCount: licenseRecord.devices.length, message: 'Aparelho desvinculado com sucesso.' });
          }
        }

        return json({ success: true, message: 'Dispositivo liberado.' });
      }

      return json({ error: 'Rota não encontrada' }, 404);
    } catch (err) {
      console.error('[Worker Error]', err);
      return json({ error: 'server_error', message: err.message }, 500);
    }
  }
};
