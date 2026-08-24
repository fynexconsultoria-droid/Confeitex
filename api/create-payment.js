// ============================================================================
// Cloudflare Worker — Confeitex × Mercado Pago
// Deploy: copie este código no painel do Cloudflare Workers
// Variáveis de ambiente (Settings > Variables):
//   MP_ACCESS_TOKEN = APP_USR-7079855594959143-082419-...
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ── Rota: criar pagamento ──────────────────────────────────────────
    if (url.pathname === '/create-payment' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { amount, description, order_id, payer_email } = body;

        if (!amount || amount <= 0) {
          return jsonResponse({ error: 'Valor inválido' }, 400);
        }

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            transaction_amount: Number(amount),
            description: description || 'Pedido Confeitex',
            payment_method_id: 'pix', // Pode ser sobrescrito pelo Brick
            external_reference: order_id || '',
            payer: payer_email ? { email: payer_email } : undefined,
          }),
        });

        const payment = await mpResponse.json();

        if (!mpResponse.ok) {
          console.error('[MP Error]', JSON.stringify(payment));
          return jsonResponse({ error: payment.message || 'Erro ao criar pagamento' }, mpResponse.status);
        }

        return jsonResponse({
          id: payment.id,
          status: payment.status,
          qr_code: payment.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: payment.point_of_interaction?.transaction_data?.qr_code_base64,
          ticket_url: payment.point_of_interaction?.transaction_data?.ticket_url,
        });
      } catch (err) {
        console.error('[Worker Error]', err);
        return jsonResponse({ error: 'Erro interno do servidor' }, 500);
      }
    }

    // ── Rota: criar preferência (Checkout Pro — link de pagamento) ─────
    if (url.pathname === '/create-preference' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { items, order_id } = body;

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}`,
          },
          body: JSON.stringify({
            items: items || [{
              title: 'Pedido Confeitex',
              unit_price: Number(body.amount) || 0,
              quantity: 1,
              currency_id: 'BRL',
            }],
            external_reference: order_id || '',
            payment_methods: {
              excluded_payment_types: [],
              installments: 12,
            },
            back_urls: {
              success: body.success_url || '',
              failure: body.failure_url || '',
              pending: body.pending_url || '',
            },
            auto_return: 'approved',
          }),
        });

        const preference = await mpResponse.json();

        if (!mpResponse.ok) {
          return jsonResponse({ error: preference.message || 'Erro ao criar preferência' }, mpResponse.status);
        }

        return jsonResponse({
          id: preference.id,
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
        });
      } catch (err) {
        console.error('[Worker Error]', err);
        return jsonResponse({ error: 'Erro interno do servidor' }, 500);
      }
    }

    // ── Rota: consultar pagamento ──────────────────────────────────────
    if (url.pathname.startsWith('/payment/') && request.method === 'GET') {
      try {
        const paymentId = url.pathname.split('/payment/')[1];
        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
        });
        const payment = await mpResponse.json();
        return jsonResponse({ id: payment.id, status: payment.status, status_detail: payment.status_detail });
      } catch (err) {
        return jsonResponse({ error: 'Erro ao consultar pagamento' }, 500);
      }
    }

    // ── Rota: Webhook (notificação de pagamento) ───────────────────────
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { type, data } = body;

        if (type === 'payment' && data?.id) {
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
            headers: { 'Authorization': `Bearer ${env.MP_ACCESS_TOKEN}` },
          });
          const payment = await mpResponse.json();

          // Aqui você pode atualizar o pedido no banco de dados
          // Por enquanto, apenas logamos
          console.log(`[Webhook] Pagamento ${payment.id}: ${payment.status} (ref: ${payment.external_reference})`);

          // TODO: Integrar com banco de dados para atualizar status do pedido
          // Ex: Se payment.status === 'approved', marcar pedido como 'Pago'
        }

        return jsonResponse({ received: true });
      } catch (err) {
        console.error('[Webhook Error]', err);
        return jsonResponse({ error: 'Erro no webhook' }, 500);
      }
    }

    // ── Rota: status do worker ─────────────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({ status: 'ok', service: 'Confeitex API', version: '1.0.0' });
    }

    return jsonResponse({ error: 'Rota não encontrada' }, 404);
  },
};
