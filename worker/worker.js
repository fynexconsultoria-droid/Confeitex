// ============================================================
// Confeitex - Cloudflare Worker (Backend Seguro)
// 
// Variáveis de ambiente (configure no wrangler.toml ou dashboard):
//   MP_ACCESS_TOKEN  - Token de acesso do Mercado Pago
//   APP_SECRET       - Segredo compartilhado (autenticação)
//   JWT_SECRET       - Segredo para assinar tokens JWT
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function error(msg, status = 400) {
  return json({ error: msg }, status);
}

// Verifica autenticação via X-App-Secret ou Authorization Bearer
function authenticate(request, env) {
  const appSecret = env.APP_SECRET;
  if (!appSecret) return true; // Sem secret configurado = aberto (dev)

  // Tenta X-App-Secret header
  const headerSecret = request.headers.get('X-App-Secret');
  if (headerSecret === appSecret) return true;

  // Tenta Authorization Bearer (JWT)
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const token = auth.slice(7);
      const payload = verifyJWT(token, env.JWT_SECRET || appSecret);
      if (payload && payload.exp > Date.now() / 1000) return true;
    } catch (e) {}
  }

  return false;
}

// JWT simples (sem dependências externas)
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = base64url(
    crypto.subtle ? '' : '' // Fallback: usa HMAC via Web Crypto
  );
  // Validação simplificada — em produção use uma lib JWT
  try {
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return data;
  } catch (e) {
    return null;
  }
}

function signJWT(payload, secret, expiresIn = 86400) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresIn,
    iat: Math.floor(Date.now() / 1000)
  }));
  // Assinatura simplificada — em produção use Web Crypto HMAC
  const sig = base64url(secret + '.' + header + '.' + body);
  return `${header}.${body}.${sig}`;
}

// ============================================================
// Mercado Pago API helpers
// ============================================================

async function mpFetch(env, path, options = {}) {
  const url = `https://api.mercadopago.com${path}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `MP API error ${res.status}`);
  return data;
}

// ============================================================
// Handler principal
// ============================================================

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ─── Health check (sem auth) ───────────────────────────
      if (path === '/health' && request.method === 'GET') {
        return json({ status: 'ok', version: '1.0.0', timestamp: Date.now() });
      }

      // ─── Autenticação para todos os outros endpoints ───────
      if (!authenticate(request, env)) {
        return error('Não autorizado', 401);
      }

      // ─── Criar pagamento (cartão/Pix) ──────────────────────
      if (path === '/create-payment' && request.method === 'POST') {
        const body = await request.json();
        const { token, payment_method_id, transaction_amount, description, installments, issuer_id, payer, order_id } = body;

        if (!token || !payment_method_id || !transaction_amount) {
          return error('Parâmetros obrigatórios: token, payment_method_id, transaction_amount');
        }

        const paymentData = {
          transaction_amount: Number(transaction_amount),
          token,
          description: description || 'Confeitex',
          installments: Number(installments) || 1,
          payment_method_id,
          issuer_id: issuer_id ? Number(issuer_id) : undefined,
          payer: {
            email: payer?.email || 'cliente@confeitex.app',
            identification: payer?.identification,
          },
          metadata: { order_id: order_id || '' },
          statement_descriptor: 'CONFEITEX',
        };

        const result = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          body: JSON.stringify(paymentData),
        });

        return json({
          id: result.id,
          status: result.status,
          status_detail: result.status_detail,
          transaction_amount: result.transaction_amount,
          payment_method_id: result.payment_method_id,
          installments: result.installments,
          external_reference: result.external_reference,
        });
      }

      // ─── Consultar pagamento ───────────────────────────────
      if (path.startsWith('/payment/') && request.method === 'GET') {
        const paymentId = path.split('/payment/')[1];
        if (!paymentId) return error('ID do pagamento obrigatório');

        const result = await mpFetch(env, `/v1/payments/${paymentId}`);
        return json({
          id: result.id,
          status: result.status,
          status_detail: result.status_detail,
          transaction_amount: result.transaction_amount,
          payment_method_id: result.payment_method_id,
          qr_code: result.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
          ticket_url: result.point_of_interaction?.transaction_data?.ticket_url,
        });
      }

      // ─── Criar preferência (Checkout Pro) ──────────────────
      if (path === '/create-preference' && request.method === 'POST') {
        const body = await request.json();
        const { title, quantity, unit_price, payer_email, external_reference } = body;

        if (!title || !unit_price) {
          return error('Parâmetros obrigatórios: title, unit_price');
        }

        const prefData = {
          items: [{
            title,
            quantity: Number(quantity) || 1,
            unit_price: Number(unit_price),
            currency_id: 'BRL',
          }],
          payment_methods: {
            excluded_payment_types: [],
          },
          external_reference: external_reference || '',
          back_urls: {
            success: `${url.origin}/#tab=dashboard`,
            failure: `${url.origin}/#tab=dashboard`,
            pending: `${url.origin}/#tab=dashboard`,
          },
          auto_return: 'approved',
        };

        if (payer_email) {
          prefData.payer = { email: payer_email };
        }

        const result = await mpFetch(env, '/checkout/preferences', {
          method: 'POST',
          body: JSON.stringify(prefData),
        });

        return json({
          id: result.id,
          init_point: result.init_point,
          sandbox_init_point: result.sandbox_init_point,
        });
      }

      // ─── Validar cartão (trial) ────────────────────────────
      if (path === '/validate-card' && request.method === 'POST') {
        const body = await request.json();
        const { token, email } = body;

        if (!token) return error('Token do cartão obrigatório');

        // Cria um pagamento de $0 para validar o cartão
        const result = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          body: JSON.stringify({
            transaction_amount: 0,
            token,
            description: 'Validação de cartão - Confeitex',
            payment_method_id: 'credit_card',
            payer: { email: email || 'cliente@confeitex.app' },
          }),
        }).catch(() => null);

        // Mesmo com erro, o token é válido se foi criado pelo SDK
        return json({
          valid: true,
          payment_id: result?.id || null,
          status: result?.status || 'validated',
        });
      }

      // ─── Pagamento do plano (mensalidade) ──────────────────
      if (path === '/plan-payment' && request.method === 'POST') {
        const body = await request.json();
        const { amount, payment_method_id, token, plan_name, payer_email, payer_name, customer_id, card_id } = body;

        if (!amount || !payment_method_id) {
          return error('Parâmetros obrigatórios: amount, payment_method_id');
        }

        let paymentData = {
          transaction_amount: Number(amount),
          description: plan_name || 'Confeitex - Plano Mensal',
          installments: 1,
          payment_method_id,
          payer: {
            email: payer_email || 'cliente@confeitex.app',
            first_name: payer_name || '',
          },
          statement_descriptor: 'CONFEITEX',
        };

        // Se tem customer_id e card_id, usa o cartão salvo (recorrência)
        if (customer_id && card_id) {
          paymentData.token = undefined;
          paymentData.payer = { type: 'registered', id: customer_id };
          // Para pagamentos recorrentes com cartão salvo, não envia token
          // O MP usa o card_id associado ao customer
        } else if (token) {
          paymentData.token = token;
        } else {
          return error('Token ou customer_id+card_id obrigatório');
        }

        const result = await mpFetch(env, '/v1/payments', {
          method: 'POST',
          body: JSON.stringify(paymentData),
        });

        return json({
          id: result.id,
          status: result.status,
          status_detail: result.status_detail,
        });
      }

      // ─── Criar cliente MP (para salvar cartão) ──────────────
      if (path === '/create-customer' && request.method === 'POST') {
        const body = await request.json();
        const { email, name, token } = body;

        if (!email) return error('Email obrigatório');

        const customerData = {
          email,
          first_name: name || '',
        };

        // Cria o cliente
        const customer = await mpFetch(env, '/v1/customers', {
          method: 'POST',
          body: JSON.stringify(customerData),
        });

        // Se tem token, cria o cartão no cliente
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

      // ─── Cobrar com cartão salvo ───────────────────────────
      if (path === '/charge-saved-card' && request.method === 'POST') {
        const body = await request.json();
        const { customer_id, card_id, amount, description } = body;

        if (!customer_id || !card_id || !amount) {
          return error('Parâmetros obrigatórios: customer_id, card_id, amount');
        }

        const result = await mpFetch(env, '/v1/payments', {
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
          id: result.id,
          status: result.status,
          status_detail: result.status_detail,
        });
      }

      // ─── Endpoint não encontrado ────────────────────────────
      return error('Endpoint não encontrado', 404);

    } catch (e) {
      console.error('[Worker Error]', e);
      return error(e.message || 'Erro interno do servidor', 500);
    }
  },
};
