// ============================================================
// Confeitex - Cloudflare Worker (Backend Seguro para Mercado Pago)
// 
// Variáveis de ambiente (configure no wrangler.toml ou Cloudflare Dashboard):
//   MP_ACCESS_TOKEN  - Token de acesso do Mercado Pago (APP_USR-...)
//   APP_SECRET       - Segredo compartilhado da aplicação
//   JWT_SECRET       - Segredo para assinar/verificar tokens JWT
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-App-Secret',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function error(msg, status = 400, details = null) {
  const payload = { error: msg };
  if (details) payload.details = details;
  return json(payload, status);
}

// ─── Autenticação Segura (X-App-Secret & HMAC-SHA256 JWT) ─────────
async function verifyJWT(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigStr = atob(sigB64.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }

    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!isValid) return null;

    const payloadBytes = Uint8Array.from(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const payloadJson = JSON.parse(new TextDecoder().decode(payloadBytes));
    return payloadJson;
  } catch {
    return null;
  }
}

async function authenticate(request, env) {
  const appSecret = env.APP_SECRET;
  if (!appSecret) return true; // Se não configurado, modo aberto/dev

  // Tenta X-App-Secret header
  const headerSecret = request.headers.get('X-App-Secret');
  if (headerSecret && headerSecret === appSecret) return true;

  // Tenta Authorization Bearer (JWT com assinatura HMAC verificada)
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = await verifyJWT(token, env.JWT_SECRET || appSecret);
      if (payload && payload.exp && payload.exp > Date.now() / 1000) return true;
    } catch {}
  }

  return false;
}

// ─── Helper de Chamadas à API do Mercado Pago ─────────────────────
async function mpFetch(env, path, options = {}) {
  const accessToken = env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MP_ACCESS_TOKEN não configurado no Cloudflare Worker.');
  }

  const url = `https://api.mercadopago.com${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.message || data.cause?.[0]?.description || `Erro Mercado Pago (${res.status})`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

// ─── Handler Principal ────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Tratamento de CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── Health check (sem auth) ───────────────────────────
      if (path === '/' || path === '/health') {
        return json({
          status: 'ok',
          service: 'Confeitex Mercado Pago API',
          version: '5.2.0',
          configured: Boolean(env.MP_ACCESS_TOKEN),
          timestamp: Date.now(),
        });
      }

      // ─── Webhook (sem auth para permitir callbacks do MP) ───
      if (path === '/webhook' && request.method === 'POST') {
        try {
          const body = await request.json().catch(() => ({}));
          const { type, data } = body;
          if (type === 'payment' && data?.id && env.MP_ACCESS_TOKEN) {
            const payment = await mpFetch(env, `/v1/payments/${data.id}`);
            console.log(`[Webhook] Pagamento ${payment.id}: status=${payment.status} ref=${payment.external_reference}`);
          }
          return json({ received: true });
        } catch (err) {
          console.error('[Webhook Error]', err);
          return error('Erro ao processar webhook', 500);
        }
      }

      // ─── Autenticação para endpoints da aplicação ──────────
      const isAuthorized = await authenticate(request, env);
      if (!isAuthorized) {
        return error('Acesso não autorizado: credenciais inválidas.', 401);
      }

      // ─── Rota: Criar Pagamento (Payment Brick / Pix / Cartão) ─
      if (path === '/create-payment' && request.method === 'POST') {
        const body = await request.json();
        const amount = Number(body.amount || body.transaction_amount);
        const orderId = body.order_id || body.external_reference || '';
        const description = body.description || `Encomenda Confeitex #${orderId}`;

        if (!amount || amount <= 0) {
          return error('Valor do pagamento inválido', 400);
        }

        const paymentPayload = {
          transaction_amount: amount,
          description: description,
          external_reference: String(orderId),
          installments: Number(body.installments) || 1,
          payment_method_id: body.payment_method_id || 'pix',
          statement_descriptor: 'CONFEITEX',
        };

        if (body.token) paymentPayload.token = body.token;
        if (body.issuer_id) paymentPayload.issuer_id = Number(body.issuer_id);

        const payerEmail = body.payer?.email || body.payer_email || 'cliente@confeitex.app';
        paymentPayload.payer = {
          email: payerEmail,
          first_name: body.payer?.first_name || body.client_name || 'Cliente',
          last_name: body.payer?.last_name || '',
        };

        if (body.payer?.identification) {
          paymentPayload.payer.identification = body.payer.identification;
        }

        const payment = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': `${orderId}_${Date.now()}`,
          },
          body: JSON.stringify(paymentPayload),
        });

        return json({
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
          payment_method_id: payment.payment_method_id,
          payment_type_id: payment.payment_type_id,
          transaction_amount: payment.transaction_amount,
          date_approved: payment.date_approved,
          qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
          qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
        });
      }

      // ─── Rota: Consultar Pagamento ─────────────────────────
      if (path.startsWith('/payment/') && request.method === 'GET') {
        const paymentId = path.split('/payment/')[1];
        if (!paymentId) return error('ID do pagamento não informado', 400);

        const payment = await mpFetch(env, `/v1/payments/${paymentId}`);
        return json({
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.date_approved,
          transaction_amount: payment.transaction_amount,
          external_reference: payment.external_reference,
          qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
          qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
        });
      }

      // ─── Rota: Criar Preferência (Checkout Pro / Link de Pagamento) ──
      if (path === '/create-preference' && request.method === 'POST') {
        const body = await request.json();
        const orderId = body.order_id || body.external_reference || '';
        const clientName = body.client_name || 'Cliente';
        const clientPhone = body.client_phone || '';
        const clientEmail = body.payer_email || body.client_email || 'cliente@confeitex.app';
        const amount = Number(body.amount || body.unit_price) || 0;
        const title = body.title || `Encomenda Confeitex - ${clientName}`;

        const items = body.items || [{
          title: title,
          unit_price: amount,
          quantity: 1,
          currency_id: 'BRL',
        }];

        const prefData = {
          items: items,
          external_reference: String(orderId),
          payer: {
            name: clientName,
            email: clientEmail,
            phone: clientPhone ? { number: clientPhone.replace(/\D/g, '') } : undefined,
          },
          payment_methods: {
            excluded_payment_types: [],
            installments: 12,
          },
          back_urls: {
            success: body.success_url || `${url.origin}/#tab=dashboard`,
            failure: body.failure_url || `${url.origin}/#tab=dashboard`,
            pending: body.pending_url || `${url.origin}/#tab=dashboard`,
          },
          auto_return: 'approved',
          statement_descriptor: 'CONFEITEX',
        };

        const preference = await mpFetch(env, '/checkout/preferences', {
          method: 'POST',
          body: JSON.stringify(prefData),
        });

        return json({
          id: preference.id,
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
        });
      }

      // ─── Rota: Validar / Salvar Cartão para Teste Grátis ───
      if (path === '/validate-card' && request.method === 'POST') {
        const body = await request.json();
        const token = body.token;
        const payerEmail = body.email || 'assinante@confeitex.app';

        if (!token) return error('Token do cartão não informado', 400);

        const cardData = await mpFetch(env, `/v1/card_tokens/${token}`);

        return json({
          valid: true,
          message: 'Cartão validado com sucesso para início do período de testes.',
          token: token,
          email: payerEmail,
          last_four_digits: cardData.last_four_digits || '',
          cardholder: cardData.cardholder?.name || '',
          expiration_month: cardData.expiration_month || '',
          expiration_year: cardData.expiration_year || '',
          verified_at: new Date().toISOString(),
        });
      }

      // ─── Rota: Pagamento de Mensalidade / Plano ────────────
      if (path === '/plan-payment' && request.method === 'POST') {
        const body = await request.json();
        const amount = Number(body.amount) || 7.99;
        const planName = body.plan_name || 'Confeitex Premium Mensal';
        const method = body.payment_method_id || 'credit_card';
        const userEmail = body.payer_email || body.email || 'assinante@confeitex.app';
        const userName = body.payer_name || body.name || 'Confeiteira(o)';
        const reference = body.reference || `PLAN_${Date.now()}`;

        const paymentPayload = {
          transaction_amount: amount,
          description: `Assinatura Confeitex — ${planName}`,
          payment_method_id: method,
          external_reference: reference,
          installments: 1,
          payer: {
            email: userEmail,
            first_name: userName,
          },
          statement_descriptor: 'CONFEITEX',
        };

        if (body.customer_id && body.card_id) {
          paymentPayload.token = undefined;
          paymentPayload.payer = { type: 'registered', id: body.customer_id };
        } else if (body.token) {
          paymentPayload.token = body.token;
        }

        if (body.issuer_id) paymentPayload.issuer_id = body.issuer_id;
        if (body.identification) paymentPayload.payer.identification = body.identification;

        const payment = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          headers: {
            'X-Idempotency-Key': `PLAN_${reference}_${Date.now()}`,
          },
          body: JSON.stringify(paymentPayload),
        });

        return json({
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
          payment_method_id: payment.payment_method_id,
          payment_type_id: payment.payment_type_id,
          transaction_amount: payment.transaction_amount,
          date_approved: payment.date_approved,
          qr_code: payment.point_of_interaction?.transaction_data?.qr_code || null,
          qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64 || null,
          ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url || null,
        });
      }

      // ─── Rota: Criar Cliente MP (para salvar cartão) ───────
      if (path === '/create-customer' && request.method === 'POST') {
        const body = await request.json();
        const { email, name, token } = body;
        if (!email) return error('Email obrigatório', 400);

        const customer = await mpFetch(env, '/v1/customers', {
          method: 'POST',
          body: JSON.stringify({ email, first_name: name || '' }),
        });

        let card = null;
        if (token && customer.id) {
          try {
            card = await mpFetch(env, `/v1/customers/${customer.id}/cards`, {
              method: 'POST',
              body: JSON.stringify({ token }),
            });
          } catch (e) {
            console.warn('[Worker] Erro ao salvar cartão no cliente:', e.message);
          }
        }

        return json({
          customer_id: customer.id,
          card_id: card?.id || null,
          card_last_four: card?.last_four_digits || null,
          card_brand: card?.payment_method?.id || null,
        });
      }

      // ─── Rota: Cobrar com Cartão Salvo ─────────────────────
      if (path === '/charge-saved-card' && request.method === 'POST') {
        const body = await request.json();
        const { customer_id, card_id, amount, description } = body;
        if (!customer_id || !card_id || !amount) {
          return error('Parâmetros obrigatórios: customer_id, card_id, amount', 400);
        }

        const payment = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          body: JSON.stringify({
            transaction_amount: Number(amount),
            description: description || 'Confeitex - Assinatura',
            payment_method_id: 'credit_card',
            token: undefined,
            payer: { type: 'registered', id: customer_id },
            installments: 1,
            statement_descriptor: 'CONFEITEX',
          }),
        });

        return json({
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
        });
      }

      return error('Endpoint não encontrado', 404);

    } catch (err) {
      console.error('[Worker Error]', err);
      return error(err.message || 'Erro interno do servidor', err.status || 500, err.details || null);
    }
  },
};
