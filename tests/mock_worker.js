import http from 'http';

const PORT = 8787;

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

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Mock Worker] Rodando em http://localhost:${PORT}`);
  console.log('Para testar pagamentos offline localmente, defina o Worker URL no app para http://localhost:8787');
});
