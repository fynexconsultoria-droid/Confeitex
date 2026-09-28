// ============================================================
// Confeitex - API Handler (Cloudflare Worker)
// ============================================================
// Este arquivo é um stub. A implementação real roda como
// Cloudflare Worker separado do repositório principal.
//
// Para configurar:
// 1. Crie um Worker no Cloudflare Dashboard (workers.cloudflare.com)
// 2. Implante o código do worker com as variáveis de ambiente:
//    - MP_ACCESS_TOKEN  → Token de acesso do Mercado Pago
//    - ALLOWED_ORIGIN   → URL do seu app (ex: https://seu-user.github.io)
// 3. Cole a URL do Worker nas Configurações > Mercado Pago do app.
//
// Endpoints esperados pelo app:
//   POST /create-payment  → cria pagamento no MP
//   POST /create-link      → cria Checkout Pro link
//   GET  /health           → verifica disponibilidade do worker
//   GET  /payment/{id}     → consulta status de um pagamento
// ============================================================
