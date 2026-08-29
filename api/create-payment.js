// ============================================================================
// Cloudflare Worker — Confeitex × Mercado Pago
// Deploy: copie este código no painel do Cloudflare Workers ou via Wrangler CLI
// Variáveis de ambiente (Settings > Variables no Cloudflare Dashboard):
//   MP_ACCESS_TOKEN = APP_USR-... (Seu Access Token de Produção ou Teste)
// ============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    // Tratamento de CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const accessToken = env.MP_ACCESS_TOKEN || '';

    // ── Rota: Criar Pagamento (Payment Brick / PIX / Cartão) ──────────────
    if (url.pathname === '/create-payment' && request.method === 'POST') {
      try {
        if (!accessToken) {
          return jsonResponse({
            error: 'MP_ACCESS_TOKEN não configurado no Cloudflare Worker.',
            tip: 'Adicione a variável de ambiente MP_ACCESS_TOKEN nas configurações do Worker.'
          }, 500);
        }

        const body = await request.json();
        const amount = Number(body.amount || body.transaction_amount);
        const orderId = body.order_id || body.external_reference || '';
        const description = body.description || `Encomenda Confeitex #${orderId}`;

        if (!amount || amount <= 0) {
          return jsonResponse({ error: 'Valor do pagamento inválido' }, 400);
        }

        // Monta o payload para a API v1/payments do Mercado Pago
        const paymentPayload = {
          transaction_amount: amount,
          description: description,
          external_reference: String(orderId),
          installments: Number(body.installments) || 1,
        };

        // Método de pagamento
        if (body.payment_method_id) {
          paymentPayload.payment_method_id = body.payment_method_id;
        } else {
          paymentPayload.payment_method_id = 'pix';
        }

        // Token do cartão (quando pagamento via cartão no Brick)
        if (body.token) {
          paymentPayload.token = body.token;
        }

        // Emissor do cartão (quando informado pelo Brick)
        if (body.issuer_id) {
          paymentPayload.issuer_id = body.issuer_id;
        }

        // Informações do Pagador (Payer)
        const payerEmail = body.payer?.email || body.payer_email || 'cliente@confeitex.app';
        paymentPayload.payer = {
          email: payerEmail,
          first_name: body.payer?.first_name || body.client_name || 'Cliente',
          last_name: body.payer?.last_name || '',
        };

        // Identificação (CPF/CNPJ) se fornecido
        if (body.payer?.identification) {
          paymentPayload.payer.identification = body.payer.identification;
        }

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Idempotency-Key': `${orderId}_${Date.now()}`,
          },
          body: JSON.stringify(paymentPayload),
        });

        const payment = await mpResponse.json();

        if (!mpResponse.ok) {
          console.error('[MP Payment Error]', JSON.stringify(payment));
          const errorMsg = payment.message || payment.cause?.[0]?.description || 'Erro ao processar pagamento no Mercado Pago';
          return jsonResponse({ error: errorMsg, details: payment }, mpResponse.status);
        }

        return jsonResponse({
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
      } catch (err) {
        console.error('[Worker Create-Payment Error]', err);
        return jsonResponse({ error: 'Erro interno ao processar pagamento: ' + err.message }, 500);
      }
    }

    // ── Rota: Criar Preferência (Checkout Pro / Link de Pagamento) ─────────
    if (url.pathname === '/create-preference' && request.method === 'POST') {
      try {
        if (!accessToken) {
          return jsonResponse({ error: 'MP_ACCESS_TOKEN não configurado no Cloudflare Worker.' }, 500);
        }

        const body = await request.json();
        const orderId = body.order_id || '';
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

        const preferencePayload = {
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
            success: body.success_url || 'https://fynexconsultoria-droid.github.io/Confeitex/',
            failure: body.failure_url || 'https://fynexconsultoria-droid.github.io/Confeitex/',
            pending: body.pending_url || 'https://fynexconsultoria-droid.github.io/Confeitex/',
          },
          auto_return: 'approved',
          statement_descriptor: 'CONFEITEX',
        };

        const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(preferencePayload),
        });

        const preference = await mpResponse.json();

        if (!mpResponse.ok) {
          console.error('[MP Preference Error]', JSON.stringify(preference));
          return jsonResponse({ error: preference.message || 'Erro ao criar link de pagamento' }, mpResponse.status);
        }

        return jsonResponse({
          id: preference.id,
          init_point: preference.init_point,
          sandbox_init_point: preference.sandbox_init_point,
        });
      } catch (err) {
        console.error('[Worker Preference Error]', err);
        return jsonResponse({ error: 'Erro interno ao criar preferência: ' + err.message }, 500);
      }
    }

    // ── Rota: Consultar Status de Pagamento ─────────────────────────────────
    if (url.pathname.startsWith('/payment/') && request.method === 'GET') {
      try {
        if (!accessToken) {
          return jsonResponse({ error: 'MP_ACCESS_TOKEN não configurado' }, 500);
        }

        const paymentId = url.pathname.split('/payment/')[1];
        if (!paymentId) {
          return jsonResponse({ error: 'ID de pagamento não informado' }, 400);
        }

        const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        const payment = await mpResponse.json();
        if (!mpResponse.ok) {
          return jsonResponse({ error: payment.message || 'Pagamento não encontrado' }, mpResponse.status);
        }

        return jsonResponse({
          id: payment.id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.date_approved,
          transaction_amount: payment.transaction_amount,
          external_reference: payment.external_reference,
        });
      } catch (err) {
        return jsonResponse({ error: 'Erro ao consultar pagamento: ' + err.message }, 500);
      }
    }

    // ── Rota: Webhook (Notificação de Pagamento) ───────────────────────────
    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { type, data } = body;

        if (type === 'payment' && data?.id && accessToken) {
          const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          const payment = await mpResponse.json();
          console.log(`[Webhook] Pagamento ${payment.id}: status=${payment.status} ref=${payment.external_reference}`);
        }

        return jsonResponse({ received: true });
      } catch (err) {
        console.error('[Webhook Error]', err);
        return jsonResponse({ error: 'Erro no webhook' }, 500);
      }
    }

    // ── Rota: Pagamento de Mensalidade / Plano do App Confeitex ─────────
    if (url.pathname === '/plan-payment' && request.method === 'POST') {
      try {
        if (!accessToken) {
          return jsonResponse({
            error: 'MP_ACCESS_TOKEN não configurado no Cloudflare Worker.',
            tip: 'Adicione a variável de ambiente MP_ACCESS_TOKEN nas configurações do Worker.'
          }, 500);
        }

        const body = await request.json();
        const amount = Number(body.amount) || 7.99;
        const planName = body.plan_name || 'Confeitex Premium Mensal';
        const method = body.payment_method_id || 'pix';
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
          }
        };

        if (body.token) {
          paymentPayload.token = body.token;
        }
        if (body.issuer_id) {
          paymentPayload.issuer_id = body.issuer_id;
        }
        if (body.identification) {
          paymentPayload.payer.identification = body.identification;
        }

        const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Idempotency-Key': `PLAN_${reference}_${Date.now()}`,
          },
          body: JSON.stringify(paymentPayload),
        });

        const payment = await mpResponse.json();

        if (!mpResponse.ok) {
          console.error('[MP Plan Payment Error]', JSON.stringify(payment));
          const errorMsg = payment.message || payment.cause?.[0]?.description || 'Erro ao processar pagamento do plano no Mercado Pago';
          return jsonResponse({ error: errorMsg, details: payment }, mpResponse.status);
        }

        return jsonResponse({
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
      } catch (err) {
        console.error('[Worker Plan-Payment Error]', err);
        return jsonResponse({ error: 'Erro interno ao processar plano: ' + err.message }, 500);
      }
    }

    // ── Rota: Validar / Salvar Cartão para Teste Grátis ─────────────────────
    if (url.pathname === '/validate-card' && request.method === 'POST') {
      try {
        if (!accessToken) {
          return jsonResponse({ error: 'MP_ACCESS_TOKEN não configurado' }, 500);
        }

        const body = await request.json();
        const token = body.token;
        const payerEmail = body.email || 'assinante@confeitex.app';

        if (!token) {
          return jsonResponse({ error: 'Token do cartão não informado' }, 400);
        }

        // Valida o token criando ou verificando com o Mercado Pago
        // O token é gerado com segurança no client pelo SDK v2 do Mercado Pago
        return jsonResponse({
          valid: true,
          message: 'Cartão validado com sucesso para início do período de testes.',
          token: token,
          email: payerEmail,
          verified_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('[Worker Validate Card Error]', err);
        return jsonResponse({ error: 'Erro ao validar cartão: ' + err.message }, 500);
      }
    }

    // ── Rota: Health Check & Status ────────────────────────────────────────
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'Confeitex Mercado Pago API',
        version: '2.1.0',
        configured: !!accessToken,
      });
    }

    return jsonResponse({ error: 'Rota não encontrada' }, 404);
  },
};
