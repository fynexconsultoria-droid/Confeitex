import http from 'http';

const PORT = 8787;

// Memória de licenças para controle de limite de dispositivos (máximo 2 por chave)
const licenseStore = new Map();

const server = http.createServer((req, res) => {
  // Configura CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rota Health Check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', environment: 'mock-test' }));
    return;
  }

  // Rota Criar Pagamento Mockada
  if (req.url === '/create-payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const payload = JSON.stringify(body);
        console.log('[Mock Worker] Recebido pedido de pagamento:', payload);
        
        // Simula latência de rede (1s)
        setTimeout(() => {
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: 'mock_pay_' + Date.now(),
            status: 'approved',
            status_detail: 'accredited',
            point_of_interaction: {
              transaction_data: {
                ticket_url: 'https://www.mercadopago.com.br/mock-ticket',
                qr_code: '00020101021243650016COM.MERCADOLIBRE02013063638f1192a-5fd1-4180-a180-8bcae3556bc35204000053039865802BR5925Mock Confeitex6009SAO PAULO62070503***6304FC73',
                qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==' // pixel mock
              }
            }
          }));
        }, 1000);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON body' }));
      }
    });
    return;
  }

  // Rota Validar Cartão Mockada
  if (req.url === '/validate-card' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        valid: true,
        customer_id: 'mock_cust_' + Date.now(),
        card_id: 'mock_card_' + Date.now(),
        lastFourDigits: '4242',
        status: 'validated'
      }));
    });
    return;
  }

  // Rota Pagamento de Plano Mockada
  if (req.url === '/plan-payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        id: 'mock_plan_pay_' + Date.now(),
        status: 'approved',
        status_detail: 'accredited'
      }));
    });
    return;
  }

  // Rota Validar Licença e Limite de Dispositivos (Máximo 2)
  if (req.url === '/validate-license' && req.method === 'POST') {
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
            message: `Limite de dispositivos atingido! Esta chave já está cadastrada no limite máximo de ${maxDevices} aparelhos.`
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

  // Rota Liberar Dispositivo da Licença
  if (req.url === '/release-license' && req.method === 'POST') {
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
  console.log('Para testar pagamentos offline localmente, defina o Worker URL no app para http://localhost:8787');
});
