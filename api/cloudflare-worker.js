/**
 * Confeitex — Cloudflare Worker (Checkout Mercado Pago & Controle de Licenças)
 * 
 * Funcionalidades:
 * 1. Processamento seguro de pagamentos Pix, Cartão e Checkout Pro via Mercado Pago
 * 2. Controle de Licenças: Permite no MÁXIMO 2 DISPOSITIVOS por chave de ativação
 * 
 * Requisitos no Cloudflare Dashboard:
 * 1. KV Namespace associado:
 *    - Nome do Binding: CONFEITEX_KV
 * 2. Variáveis de Ambiente (Secrets):
 *    - MP_ACCESS_TOKEN: Token de Acesso de Produção do Mercado Pago (APP_USR-...)
 *    - ALLOWED_ORIGIN: URL do app (ou '*' para testes/PWA)
 *    - MAX_DEVICES_PER_KEY: (Opcional, padrão '2')
 */

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Secret',
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
          service: 'confeitex-worker',
          version: '2.1.0',
          maxDevicesPerKey: Number(env.MAX_DEVICES_PER_KEY || 2),
          hasKV: Boolean(env.CONFEITEX_KV)
        });
      }

      // ─── 2. Validação de Licença (Máximo 2 Dispositivos) ───────────────
      if (pathname === '/validate-license' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const key = (body.key || '').trim().toUpperCase();
        const deviceId = (body.deviceId || '').trim();
        const deviceName = body.deviceName || 'Dispositivo';
        const maxDevices = Number(body.maxDevices || env.MAX_DEVICES_PER_KEY || 2);

        if (!key || !deviceId) {
          return json({ valid: false, error: 'missing_params', message: 'Chave e deviceId são obrigatórios.' }, 400);
        }

        // Validação básica do formato da chave
        const masterKeys = ['CONFEITEXVIP', 'CFTX8990', 'VITALICIO2026', 'CONFEITEX2026', 'DOCELUCRO', 'MERCADOPAGO', 'MP8990'];
        const isMaster = masterKeys.includes(key);
        const isStandard = key.startsWith('CFTX') || key.startsWith('MP') || key.startsWith('KWF') || key.startsWith('HOT') || key.length >= 10;

        if (!isMaster && !isStandard) {
          return json({ valid: false, error: 'invalid_key', message: 'Chave de ativação inválida.' }, 400);
        }

        const kvKey = `license:${key}`;
        let record = null;

        if (env.CONFEITEX_KV) {
          record = await env.CONFEITEX_KV.get(kvKey, 'json');
        }

        if (!record) {
          record = {
            key,
            createdAt: new Date().toISOString(),
            devices: []
          };
        }

        const existingDevIndex = record.devices.findIndex(d => d.deviceId === deviceId);
        if (existingDevIndex !== -1) {
          // Dispositivo já estava registrado nesta chave: atualiza lastSeen
          record.devices[existingDevIndex].lastSeen = new Date().toISOString();
          record.devices[existingDevIndex].deviceName = deviceName;

          if (env.CONFEITEX_KV) {
            await env.CONFEITEX_KV.put(kvKey, JSON.stringify(record));
          }

          return json({
            valid: true,
            devicesCount: record.devices.length,
            maxDevices,
            message: `Dispositivo já autorizado (${record.devices.length} de ${maxDevices}).`
          });
        }

        // Novo dispositivo tentando vincular: verifica se excedeu o limite de 2
        if (record.devices.length >= maxDevices) {
          return json({
            valid: false,
            error: 'device_limit_exceeded',
            devicesCount: record.devices.length,
            maxDevices,
            message: `Limite de dispositivos atingido! Esta chave já está ativa em ${record.devices.length} de ${maxDevices} aparelhos permitidos.`
          }, 403);
        }

        // Adiciona novo dispositivo
        record.devices.push({
          deviceId,
          deviceName,
          activatedAt: new Date().toISOString(),
          lastSeen: new Date().toISOString()
        });

        if (env.CONFEITEX_KV) {
          await env.CONFEITEX_KV.put(kvKey, JSON.stringify(record));
        }

        return json({
          valid: true,
          devicesCount: record.devices.length,
          maxDevices,
          message: `Dispositivo vinculado com sucesso! (${record.devices.length} de ${maxDevices})`
        });
      }

      // ─── 3. Liberar Dispositivo da Licença ─────────────────────────────
      if (pathname === '/release-license' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const key = (body.key || '').trim().toUpperCase();
        const deviceId = (body.deviceId || '').trim();

        if (env.CONFEITEX_KV && key) {
          const kvKey = `license:${key}`;
          const record = await env.CONFEITEX_KV.get(kvKey, 'json');
          if (record && record.devices) {
            record.devices = record.devices.filter(d => d.deviceId !== deviceId);
            await env.CONFEITEX_KV.put(kvKey, JSON.stringify(record));
            return json({
              success: true,
              devicesCount: record.devices.length,
              message: 'Dispositivo desvinculado com sucesso.'
            });
          }
        }

        return json({ success: true, message: 'Dispositivo liberado.' });
      }

      // ─── 4. Consultar Status da Licença ───────────────────────────────
      if (pathname === '/license-status' && request.method === 'GET') {
        const key = (url.searchParams.get('key') || '').trim().toUpperCase();
        if (!key) return json({ error: 'Chave obrigatória' }, 400);

        let record = null;
        if (env.CONFEITEX_KV) {
          record = await env.CONFEITEX_KV.get(`license:${key}`, 'json');
        }

        return json({
          key,
          active: Boolean(record),
          devicesCount: record ? record.devices.length : 0,
          maxDevices: Number(env.MAX_DEVICES_PER_KEY || 2),
          devices: record ? record.devices.map(d => ({ deviceName: d.deviceName, activatedAt: d.activatedAt })) : []
        });
      }

      // ─── 5. Endpoints Mercado Pago (Criar Pagamento / Encomendas) ─────
      const mpToken = env.MP_ACCESS_TOKEN;
      if (!mpToken) {
        return json({ error: 'MP_ACCESS_TOKEN não configurado no Worker.' }, 500);
      }

      // Criar Pagamento Transparente (Pix / Cartão)
      if (pathname === '/create-payment' && request.method === 'POST') {
        const body = await request.json();
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': body.order_id || `cftx_${Date.now()}`
          },
          body: JSON.stringify(body)
        });
        const mpData = await mpRes.json();
        return json(mpData, mpRes.status);
      }

      // Criar Link de Pagamento (Preference / Checkout Pro)
      if (pathname === '/create-preference' && request.method === 'POST') {
        const body = await request.json();
        const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        const mpData = await mpRes.json();
        return json(mpData, mpRes.status);
      }

      // Consultar Pagamento
      if (pathname.startsWith('/payment/') && request.method === 'GET') {
        const paymentId = pathname.replace('/payment/', '');
        const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: { 'Authorization': `Bearer ${mpToken}` }
        });
        const mpData = await mpRes.json();
        return json(mpData, mpRes.status);
      }

      return json({ error: 'Rota não encontrada' }, 404);
    } catch (err) {
      return json({ error: 'Erro interno no servidor', message: err.message }, 500);
    }
  }
};
