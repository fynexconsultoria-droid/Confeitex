import http from 'http';

const PORT = 8787;

// Memória de licenças para controle de limite de dispositivos (máximo 2 por chave)
const licenseStore = new Map();
const refStore = new Map();

const server = http.createServer((req, res) => {
  // Configura CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Health Check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'confeitex-mock-worker', environment: 'mock-test' }));
    return;
  }

  // 2. Criar Compra Mercado Pago Checkout Pro (POST /purchase)
  if (req.url === '/purchase' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ref = 'mock_ref_' + Date.now();
        refStore.set(ref, {
          ref,
          deviceId: payload.deviceId,
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        // Simula aprovação automática após 2 segundos em mock
        setTimeout(() => {
          const rec = refStore.get(ref);
          if (rec) {
            const key = 'CFTX-MOCK-TEST-2026';
            rec.status = 'approved';
            rec.key = key;
            rec.exp = Date.now() + (365 * 86400000);
            licenseStore.set(key, {
              key,
              exp: rec.exp,
              devices: [{ deviceId: rec.deviceId, activatedAt: new Date().toISOString() }]
            });
          }
        }, 1500);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ref,
          init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock_${ref}`
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }

  // 2.1 Criar PIX Mock (POST /create-pix)
  if (req.url === '/create-pix' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ref = 'mock_pix_' + Date.now();
        const key = 'CFTX-MOCK-PIX-2026';
        refStore.set(ref, {
          ref,
          deviceId: payload.deviceId,
          status: 'pending',
          key,
          exp: Date.now() + (365 * 86400000),
          createdAt: new Date().toISOString()
        });

        setTimeout(() => {
          const rec = refStore.get(ref);
          if (rec) rec.status = 'approved';
        }, 1500);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ref,
          status: 'pending',
          paymentId: 987654321,
          qrCode: '00020101021226840014br.gov.bcb.pixmocktest123456789',
          qrCodeBase64: null
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }

  // 2.2 Processar Cartão Mock (POST /process-card)
  if (req.url === '/process-card' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const key = 'CFTX-MOCK-CARD-2026';
        const exp = Date.now() + (365 * 86400000);
        licenseStore.set(key, {
          key,
          exp,
          devices: [{ deviceId: payload.deviceId, activatedAt: new Date().toISOString() }]
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'approved',
          key,
          exp,
          message: 'Pagamento aprovado!'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }

  // 2.3 Checar Pagamento Mock (GET /check-payment/:ref)
  if (req.url && req.url.startsWith('/check-payment/')) {
    const ref = req.url.replace('/check-payment/', '').trim();
    const rec = refStore.get(ref);
    if (rec && rec.status === 'approved') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'approved', key: rec.key, exp: rec.exp }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'pending' }));
    }
    return;
  }

  // 3. Reivindicação Pós-compra (POST /claim)
  if (req.url === '/claim' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const ref = payload.ref;
        const rec = refStore.get(ref);

        if (!rec || rec.status !== 'approved') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'pending', message: 'Aguardando aprovação do pagamento...' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'approved',
          key: rec.key,
          exp: rec.exp,
          message: 'Licença confirmada!'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }

  // 4. Validar Licença e Limite de Dispositivos (POST /validate-license ou /activate)
  if ((req.url === '/validate-license' || req.url === '/activate') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const key = (payload.key || '').trim().toUpperCase();
        const deviceId = (payload.deviceId || '').trim();
        const deviceName = payload.deviceName || 'Dispositivo';
        const maxDevices = Number(payload.maxDevices) || 2;

        if (!key || !deviceId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: 'missing_params', message: 'Chave e deviceId são obrigatórios.' }));
          return;
        }

        let record = licenseStore.get(key);
        if (!record) {
          record = { key, devices: [] };
          licenseStore.set(key, record);
        }

        const existingDevIndex = record.devices.findIndex(d => d.deviceId === deviceId);
        if (existingDevIndex !== -1) {
          record.devices[existingDevIndex].lastSeen = new Date().toISOString();
          record.devices[existingDevIndex].deviceName = deviceName;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            valid: true,
            devicesCount: record.devices.length,
            maxDevices,
            message: `Dispositivo já autorizado (${record.devices.length} de ${maxDevices}).`
          }));
          return;
        }

        if (record.devices.length >= maxDevices) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            valid: false,
            error: 'device_limit_exceeded',
            devicesCount: record.devices.length,
            maxDevices,
            message: `Limite de dispositivos atingido! Esta chave já está ativa em ${record.devices.length} de ${maxDevices} aparelhos permitidos.`
          }));
          return;
        }

        record.devices.push({
          deviceId,
          deviceName,
          activatedAt: new Date().toISOString()
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          valid: true,
          devicesCount: record.devices.length,
          maxDevices,
          message: `Dispositivo vinculado com sucesso (${record.devices.length} de ${maxDevices})!`
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ valid: false, error: 'invalid_json' }));
      }
    });
    return;
  }

  // 5. Liberar Dispositivo da Licença (POST /release-license ou /release)
  if ((req.url === '/release-license' || req.url === '/release') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const key = (payload.key || '').trim().toUpperCase();
        const deviceId = (payload.deviceId || '').trim();

        const record = licenseStore.get(key);
        if (record) {
          record.devices = record.devices.filter(d => d.deviceId !== deviceId);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          devicesCount: record ? record.devices.length : 0,
          message: 'Dispositivo liberado com sucesso.'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_json' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Mock Worker] Rodando em http://localhost:${PORT}`);
});
