// ============================================================
// Confeitex - API Handler (Cloudflare Worker)
// ============================================================
// A implementação completa para Cloudflare Worker está disponível em:
//   api/cloudflare-worker.js
//
// Funcionalidades inclusas:
// 1. Controle de Licenças: Máximo de 2 dispositivos por chave
// 2. Checkout Transparente Pix & Cartão Mercado Pago
// 3. Checkout Pro (Geração de Link de Pagamento)
//
// Instruções de Implantação:
// 1. Crie um Worker no Cloudflare Dashboard (workers.cloudflare.com)
// 2. Cole o código de api/cloudflare-worker.js
// 3. Crie um KV Namespace chamado CONFEITEX_KV e vincule ao Worker
// 4. Defina a variável de ambiente:
//    - MP_ACCESS_TOKEN → Token de Produção Mercado Pago
// 5. Cole a URL do Worker em Configurações > Mercado Pago no Confeitex.
// ============================================================

