/**
 * Catálogo e Dicionário de Erros da API Mercado Pago (Orders, Payments, Refunds, Chargebacks)
 * Confeitex — Base de conhecimento e tradução amigável para tratamento preventivo e diagnósticos.
 */

export const MercadoPagoErrorCatalog = {
  // ─── 1. Erros Comuns de Requisição e Validação ───────────────────────────
  json_syntax_error: {
    status: 400,
    category: 'request_error',
    title: 'Sintaxe JSON Inválida',
    userMessage: 'Ocorreu um erro no formato da requisição. Tente novamente.',
    action: 'Verifique se a requisição possui uma estrutura JSON válida com chaves e valores adequados.'
  },
  required_properties: {
    status: 400,
    category: 'validation_error',
    title: 'Propriedades Obrigatórias Ausentes',
    userMessage: 'Faltam dados obrigatórios para concluir o pagamento. Confira o formulário.',
    action: 'Assegure-se de incluir todas as propriedades obrigatórias da API (ex: email, identificação, token).'
  },
  unsupported_properties: {
    status: 400,
    category: 'validation_error',
    title: 'Propriedades Não Suportadas',
    userMessage: 'Algum dado informado não é reconhecido pelo sistema de pagamentos.',
    action: 'Revise o corpo da requisição e remova campos não suportados.'
  },
  minimum_properties: {
    status: 400,
    category: 'validation_error',
    title: 'Propriedades Mínimas Não Atingidas',
    userMessage: 'Dados incompletos para a transação. Verifique seus dados.',
    action: 'Adicione as propriedades mínimas necessárias para a operação.'
  },
  property_type: {
    status: 400,
    category: 'validation_error',
    title: 'Tipo de Propriedade Inválido',
    userMessage: 'Formato de dado incorreto no formulário.',
    action: 'Garanta que números sejam enviados como números ou strings conforme a especificação do endpoint.'
  },
  property_value: {
    status: 400,
    category: 'validation_error',
    title: 'Valor de Propriedade Inválido',
    userMessage: 'Um dos valores informados é inválido (ex: e-mail ou CPF inválido).',
    action: 'Valide se o e-mail possui formato e domínio válidos, CPF com 11 dígitos numéricos e prazos em formato ISO 8601.'
  },
  maximum_items: {
    status: 400,
    category: 'validation_error',
    title: 'Número Máximo de Itens Excedido',
    userMessage: 'Quantidade de itens excedeu o limite permitido.',
    action: 'Reduza a quantidade de itens enviados.'
  },
  minimum_items: {
    status: 400,
    category: 'validation_error',
    title: 'Número Mínimo de Itens Não Atingido',
    userMessage: 'Nenhum item válido informado para pagamento.',
    action: 'Inclua ao menos um item válido na transação.'
  },
  invalid_path_param: {
    status: 400,
    category: 'request_error',
    title: 'Parâmetro de URL Inválido',
    userMessage: 'Identificador de transação não localizado.',
    action: 'Verifique se o ID fornecido na URL é válido.'
  },
  invalid_properties: {
    status: 400,
    category: 'validation_error',
    title: 'Propriedades Inválidas',
    userMessage: 'Dados com formato incorreto. Revise os campos preenchidos.',
    action: 'Revise as propriedades enviadas e verifique as especificações da API.'
  },
  empty_required_header: {
    status: 400,
    category: 'request_error',
    title: 'Cabeçalho Obrigatório Vazio',
    userMessage: 'Erro de comunicação segura com o servidor de pagamentos.',
    action: 'Certifique-se de que headers como Authorization e X-Idempotency-Key estão preenchidos.'
  },
  invalid_idempotency_key_length: {
    status: 400,
    category: 'idempotency_error',
    title: 'Tamanho da Chave de Idempotência Inválido',
    userMessage: 'Erro na chave de transação única.',
    action: 'O header X-Idempotency-Key aceita valores entre 1 e 128 caracteres. Use UUID v4.'
  },
  invalid_order_mode_for_operation: {
    status: 400,
    category: 'order_error',
    title: 'Modo de Order Inválido para a Operação',
    userMessage: 'Modo de processamento incompatível.',
    action: 'Verifique se está utilizando processing_mode correto (automatic vs manual).'
  },
  invalid_transaction_id: {
    status: 400,
    category: 'order_error',
    title: 'ID da Transação Inválido',
    userMessage: 'Identificador de pagamento não localizado.',
    action: 'Certifique-se de que o ID da transação está correto.'
  },
  invalid_total_amount: {
    status: 400,
    category: 'validation_error',
    title: 'Valor Total Divergente',
    userMessage: 'O valor total não confere com a soma das transações.',
    action: 'Garanta que total_amount coincida exatamente com a soma de transactions.payments.amount.'
  },

  // ─── 2. Autenticação e Permissões (401 / 403) ────────────────────────────
  '401': {
    status: 401,
    category: 'auth_error',
    title: 'Acesso Não Autorizado',
    userMessage: 'Servidor de pagamentos temporariamente indisponível. Tente novamente mais tarde.',
    action: 'Access Token incorreto ou expirado. Revise as credenciais configuradas no Worker.'
  },
  invalid_credentials: {
    status: 401,
    category: 'auth_error',
    title: 'Credenciais Inválidas',
    userMessage: 'Falha na autenticação com o provedor de pagamento.',
    action: 'Utilize credenciais de teste com usuários de teste em sandbox ou credenciais de produção no ambiente produtivo.'
  },
  forbidden: {
    status: 403,
    category: 'permission_error',
    title: 'Acesso Proibido',
    userMessage: 'A aplicação não tem permissão para acessar este recurso.',
    action: 'Verifique os escopos e permissões do Access Token na aplicação do Mercado Pago.'
  },
  PA_UNAUTHORIZED_RESULT_FROM_POLICIES: {
    status: 403,
    category: 'policy_error',
    title: 'Conta Bloqueada por Políticas',
    userMessage: 'Conta suspensa pelo provedor de pagamentos. Contate o suporte.',
    action: 'A conta foi bloqueada pelo Policy Agent. Contate o Suporte Oficial do Mercado Pago.'
  },

  // ─── 3. Localização de Recurso e Estado (404 / 409 / 423 / 429) ─────────
  order_not_found: {
    status: 404,
    category: 'not_found',
    title: 'Order Não Encontrada',
    userMessage: 'Pedido de pagamento não encontrado.',
    action: 'Verifique se o order_id enviado está correto.'
  },
  transaction_not_found: {
    status: 404,
    category: 'not_found',
    title: 'Transação Não Encontrada',
    userMessage: 'Transação não encontrada para este pagamento.',
    action: 'Verifique o ID da transação informada.'
  },
  idempotency_key_already_used: {
    status: 409,
    category: 'idempotency_error',
    title: 'Chave de Idempotência Já Utilizada',
    userMessage: 'Esta operação já foi processada anteriormente.',
    action: 'Gere um novo UUID para a próxima requisição.'
  },
  resource_locked: {
    status: 423,
    category: 'concurrency_error',
    title: 'Recurso Temporariamente Bloqueado',
    userMessage: 'Aguarde alguns segundos e tente novamente.',
    action: 'A chave de idempotência está bloqueada. Aguarde alguns instantes antes de reenviar.'
  },
  usage_quota_exceeded: {
    status: 429,
    category: 'rate_limit',
    title: 'Limite de Requisições Excedido',
    userMessage: 'Muitas requisições simultâneas. Aguarde alguns instantes.',
    action: 'Respeite o header Retry-After e implemente backoff exponencial com jitter.'
  },

  // ─── 4. Reembolso, Cancelamento e Captura ─────────────────────────────────
  refund_amount_exceeds: {
    status: 400,
    category: 'refund_error',
    title: 'Valor do Reembolso Excede o Disponível',
    userMessage: 'O valor solicitado para reembolso é maior que o valor disponível na transação.',
    action: 'Ajuste o valor para não exceder o total pago menos reembolsos anteriores.'
  },
  cannot_refund_order: {
    status: 409,
    category: 'refund_error',
    title: 'Status Não Permite Reembolso',
    userMessage: 'Este pagamento não está em um estado que permita reembolso.',
    action: 'Apenas pagamentos aprovados e capturados podem ser reembolsados.'
  },
  order_already_refunded: {
    status: 409,
    category: 'refund_error',
    title: 'Order Já Reembolsada',
    userMessage: 'Esta compra já foi totalmente reembolsada anteriormente.',
    action: 'Não tente estornar pedidos que já possuem status refunded.'
  },
  order_refund_already_in_process: {
    status: 409,
    category: 'refund_error',
    title: 'Reembolso Já em Processamento',
    userMessage: 'Já existe um pedido de reembolso em andamento para esta compra.',
    action: 'Aguarde a conclusão do processamento em andamento.'
  },
  cannot_capture_order: {
    status: 409,
    category: 'capture_error',
    title: 'Não é Possível Capturar a Order',
    userMessage: 'Não foi possível capturar o pagamento.',
    action: 'Verifique se a order foi criada com processing_mode=automatic ou se já expirou os 5 dias.'
  },
  cannot_cancel_order: {
    status: 409,
    category: 'cancel_error',
    title: 'Não é Possível Cancelar a Order',
    userMessage: 'Este pedido não pode ser cancelado no estado atual.',
    action: 'Apenas pagamentos pendentes/autorizados podem ser cancelados.'
  },
  order_already_canceled: {
    status: 409,
    category: 'cancel_error',
    title: 'Order Já Cancelada',
    userMessage: 'Este pagamento já foi cancelado anteriormente.',
    action: 'Não execute operações sobre orders já canceladas.'
  },

  // ─── 5. Erros de Servidor (500) ──────────────────────────────────────────
  idempotency_validation_failed: {
    status: 500,
    category: 'server_error',
    title: 'Falha na Validação de Idempotência',
    userMessage: 'Erro temporário nos servidores de pagamento. Tente novamente em instantes.',
    action: 'Gere uma nova chave de idempotência e tente novamente. Guarde o x-request-id para suporte.'
  },
  internal_error: {
    status: 500,
    category: 'server_error',
    title: 'Erro Interno no Mercado Pago',
    userMessage: 'Servidor de pagamentos instável no momento. Tente novamente ou use o PIX.',
    action: 'Aguarde alguns instantes e tente novamente. Se persistir, consulte o status do Mercado Pago.'
  },

  // ─── 6. Erros do SDK Mobile (Android / iOS / PWA / Webview) ─────────────
  NETWORK_CONNECTION_FAILED: {
    status: 0,
    category: 'mobile_network',
    title: 'Sem Conexão com a Internet',
    userMessage: 'Sem conexão com a internet. Verifique seu Wi-Fi ou dados móveis e tente novamente.',
    action: 'O dispositivo não conseguiu abrir conexão de rede (offline, modo avião ou falha de DNS).'
  },
  NETWORK_TIMEOUT: {
    status: 408,
    category: 'mobile_network',
    title: 'Tempo de Conexão Esgotado',
    userMessage: 'A conexão demorou muito para responder. Tente novamente em instantes.',
    action: 'A requisição passou do tempo limite. Trate como erro recuperável e ofereça botão de retry.'
  },
  SERVICE_ERROR: {
    status: 502,
    category: 'mobile_service',
    title: 'Erro no Serviço de Pagamento',
    userMessage: 'Não foi possível comunicar com o serviço de pagamentos. Tente novamente ou use o PIX.',
    action: 'Erro no servidor ou na comunicação com a API. Verifique parâmetros enviados e logs do backend.'
  },
  INTEGRATION_ERROR: {
    status: 500,
    category: 'mobile_config',
    title: 'Erro de Configuração do Checkout',
    userMessage: 'Falha de inicialização no checkout seguro. Recarregue a página.',
    action: 'O SDK foi inicializado incorretamente ou sem a Public Key/país obrigatórios.'
  },
  UNKNOWN: {
    status: 500,
    category: 'unknown',
    title: 'Erro Inesperado',
    userMessage: 'Ocorreu um erro inesperado. Tente novamente ou conclua via PIX.',
    action: 'Exceção não categorizada no SDK mobile/web.'
  },

  // ─── Aliases iOS (Swift - camelCase) ────────────────────────────────────
  networkConnectionFailed: {
    status: 0,
    category: 'mobile_network',
    title: 'Sem Conexão com a Internet',
    userMessage: 'Sem conexão com a internet. Verifique seu Wi-Fi ou dados móveis e tente novamente.',
    action: 'O dispositivo mobile não conseguiu abrir conexão de rede. Verifique a conectividade e tente novamente.'
  },
  networkTimeout: {
    status: 408,
    category: 'mobile_network',
    title: 'Tempo de Conexão Esgotado',
    userMessage: 'A conexão demorou muito para responder. Tente novamente em instantes.',
    action: 'A requisição passou do tempo limite. Trate como recuperável e ofereça um retry ao usuário.'
  },
  serviceError: {
    status: 502,
    category: 'mobile_service',
    title: 'Erro no Serviço de Pagamento',
    userMessage: 'Não foi possível comunicar com o serviço de pagamentos. Tente novamente ou use o PIX.',
    action: 'Erro no servidor ou na comunicação com a API. Verifique errorDescription e locationDescription.'
  },
  integrationError: {
    status: 500,
    category: 'mobile_config',
    title: 'Erro de Configuração do Checkout',
    userMessage: 'Falha de inicialização no checkout seguro. Recarregue o aplicativo.',
    action: 'Garanta que MercadoPagoSDK.shared.initialize seja chamado com Public Key e country correspondentes.'
  },
  unknown: {
    status: 500,
    category: 'unknown',
    title: 'Erro Inesperado',
    userMessage: 'Ocorreu um erro inesperado. Tente novamente ou conclua via PIX.',
    action: 'Exceção inesperada ou tipo de erro indeterminado no iOS SDK.'
  }
};

/**
 * Retorna mensagem amigável e ação recomendada para qualquer código de erro retornado pela API
 * @param {string|number} errorCode Código de erro ou status
 * @param {string} fallbackMsg Mensagem padrão se não localizado
 */
export function getFriendlyErrorMessage(errorCode, fallbackMsg = 'Não foi possível concluir a transação no momento.') {
  if (!errorCode) return fallbackMsg;
  const key = String(errorCode).trim();
  const entry = MercadoPagoErrorCatalog[key];
  if (entry && entry.userMessage) {
    return entry.userMessage;
  }
  return fallbackMsg;
}
