// ============================================================================
// Confeitex - Assistente Inteligente Confeitex (AI Help Chat)
// Funciona EXCLUSIVAMENTE quando o usuário estiver ONLINE.
// Suporte a dúvidas do aplicativo, consultoria de confeitaria, cálculos e resolução de problemas.
// ============================================================================

const AIChat = {
  // ─── Estado Interno ────────────────────────────────────────────────────────
  isOpen: false,
  isThinking: false,
  history: [],
  maxHistory: 50,
  workerUrl: '',

  // ─── Inicialização ─────────────────────────────────────────────────────────
  init() {
    this.workerUrl = (safeStorage.get('confeitex_ai_worker_url') || '').trim();
    this.loadHistory();
    this.setupListeners();
    this.updateOnlineStatus();

    // Se o histórico estiver vazio, insere a saudação inicial de boas-vindas
    if (this.history.length === 0) {
      this.addWelcomeMessage();
    }
  },

  isOnline() {
    return typeof navigator !== 'undefined' ? !!navigator.onLine : true;
  },

  // ─── Histórico Local ───────────────────────────────────────────────────────
  loadHistory() {
    try {
      const raw = safeStorage.get('confeitex_chat_history');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.history = parsed.slice(-this.maxHistory);
        }
      }
    } catch (e) {
      this.history = [];
    }
  },

  saveHistory() {
    try {
      safeStorage.set('confeitex_chat_history', JSON.stringify(this.history.slice(-this.maxHistory)));
    } catch (e) {
      console.warn('[AIChat] Erro ao salvar histórico:', e);
    }
  },

  clearHistory() {
    this.history = [];
    safeStorage.remove('confeitex_chat_history');
    this.addWelcomeMessage();
    this.renderMessages();
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(I18n.t('aiChat.toastCleared') || 'Conversa reiniciada');
    }
  },

  addWelcomeMessage() {
    const userName = (State && State.userProfile && State.userProfile.userName) ? State.userProfile.userName : '';
    const bakeryName = (State && State.userProfile && State.userProfile.bakeryName) ? State.userProfile.bakeryName : '';
    
    let greeting = I18n.t('aiChat.welcome');
    if (userName) {
      greeting = I18n.t('aiChat.welcomeUser', { name: escapeHTML(userName) });
    }
    if (bakeryName) {
      greeting += ` ${I18n.t('aiChat.welcomeBakery', { bakery: escapeHTML(bakeryName) })}`;
    }

    this.history.push({
      id: 'msg_' + Date.now(),
      sender: 'ai',
      text: greeting,
      timestamp: new Date().toISOString()
    });
    this.saveHistory();
  },

  // ─── Listeners de Rede e Interação ─────────────────────────────────────────
  setupListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange(true));
      window.addEventListener('offline', () => this.handleNetworkChange(false));
    }

    // Botão flutuante FAB (desktop)
    const fab = document.getElementById('btnOpenAiChat');
    if (fab) {
      fab.addEventListener('click', () => this.toggle());
    }

    // Botão do Cabeçalho Mobile
    const btnAiHeader = document.getElementById('btnAiHeader');
    if (btnAiHeader) {
      btnAiHeader.addEventListener('click', () => this.toggle());
    }

    // Botão de fechar
    const btnClose = document.getElementById('btnAiChatClose');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    // Botão de limpar conversa
    const btnClear = document.getElementById('btnAiChatClear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm(I18n.t('aiChat.confirmClear') || 'Deseja limpar todo o histórico desta conversa?')) {
          this.clearHistory();
        }
      });
    }

    // Formulário de envio
    const form = document.getElementById('aiChatForm');
    const input = document.getElementById('aiChatInput');
    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || this.isThinking) return;
        input.value = '';
        this.sendUserMessage(text);
      });
    }

    // Sugestões rápidas (Chips)
    const chipsContainer = document.getElementById('aiChatSuggestions');
    if (chipsContainer) {
      chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.ai-chat-chip');
        if (!chip) return;
        const prompt = chip.dataset.prompt;
        if (prompt) {
          this.sendUserMessage(prompt);
        }
      });
    }
  },

  handleNetworkChange(online) {
    this.updateOnlineStatus();
    if (!online && this.isOpen) {
      this.renderMessages();
    }
  },

  updateOnlineStatus() {
    const online = this.isOnline();
    const fabBadge = document.getElementById('aiChatFabBadge');
    const statusDot = document.getElementById('aiChatStatusDot');
    const statusText = document.getElementById('aiChatStatusText');
    const offlineBanner = document.getElementById('aiChatOfflineBanner');
    const input = document.getElementById('aiChatInput');
    const btnSend = document.getElementById('btnAiChatSend');
    const chipsContainer = document.getElementById('aiChatSuggestions');

    const headerBadge = document.getElementById('aiChatHeaderBadge');

    if (fabBadge) {
      fabBadge.className = 'ai-chat-fab-status ' + (online ? 'online' : 'offline');
      fabBadge.title = online ? 'IA Conectada' : 'Modo Offline (Base Local Ativa)';
    }

    if (headerBadge) {
      headerBadge.className = 'ai-header-dot ' + (online ? 'online' : 'offline');
      headerBadge.title = online ? 'IA Conectada' : 'Modo Offline (Base Local Ativa)';
    }

    if (statusDot) {
      statusDot.className = 'ai-chat-header-dot ' + (online ? 'online' : 'offline');
    }

    if (statusText) {
      statusText.textContent = online ? I18n.t('aiChat.statusOnline') : I18n.t('aiChat.statusOffline');
    }

    if (offlineBanner) {
      offlineBanner.style.display = online ? 'none' : 'flex';
    }

    if (input) {
      input.disabled = false;
      input.placeholder = online ? I18n.t('aiChat.inputPlaceholder') : I18n.t('aiChat.inputPlaceholderOffline');
    }

    if (btnSend) {
      btnSend.disabled = false;
    }

    if (chipsContainer) {
      chipsContainer.style.opacity = '1';
      chipsContainer.style.pointerEvents = 'auto';
    }
  },

  // ─── Abertura / Fechamento ─────────────────────────────────────────────────
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  open() {
    const modal = document.getElementById('aiChatModal');
    if (!modal) return;
    this.isOpen = true;
    modal.classList.add('active');
    this.updateOnlineStatus();
    this.renderMessages();
    
    // Foco no input
    setTimeout(() => {
      const input = document.getElementById('aiChatInput');
      if (input) input.focus();
    }, 150);
  },

  close() {
    const modal = document.getElementById('aiChatModal');
    if (!modal) return;
    this.isOpen = false;
    modal.classList.remove('active');
  },

  // ─── Envio e Resposta da IA ────────────────────────────────────────────────
  async sendUserMessage(text) {
    const online = this.isOnline();

    // 1. Registra mensagem do usuário
    const userMsg = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };
    this.history.push(userMsg);
    this.saveHistory();
    this.renderMessages();

    // 2. Estado "Pensando..."
    this.isThinking = true;
    this.renderThinkingIndicator();

    // 3. Processamento de resposta
    try {
      let aiResponseText = '';

      // Se estiver ONLINE e o usuário configurou um Worker URL remoto nas Configurações, tenta chamar a API
      if (online && this.workerUrl && this.workerUrl.startsWith('https://')) {
        try {
          const res = await fetch(`${this.workerUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: text,
              history: this.history.slice(-10),
              context: {
                userProfile: State.userProfile || {},
                totalOrders: State.orders ? State.orders.length : 0,
                totalQuotes: State.quotes ? State.quotes.length : 0
              }
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.response) {
              aiResponseText = data.response;
            }
          }
        } catch (e) {
          console.warn('[AIChat] Falha no Worker remoto, acionando inteligência nativa:', e);
        }
      }

      // Se não há worker remoto, falhou ou está OFFLINE:
      // aciona a Inteligência Local do Confeitex (que roda 100% no navegador offline)
      if (!aiResponseText) {
        await new Promise(r => setTimeout(r, online ? (400 + Math.random() * 300) : 250));
        aiResponseText = this.generateNativeResponse(text, !online);
      }

      // Adiciona mensagem da IA
      this.history.push({
        id: 'msg_' + Date.now(),
        sender: 'ai',
        text: aiResponseText,
        isOffline: !online,
        timestamp: new Date().toISOString()
      });
      this.saveHistory();

    } catch (err) {
      this.history.push({
        id: 'msg_' + Date.now(),
        sender: 'ai',
        text: I18n.t('aiChat.errorGeneric'),
        timestamp: new Date().toISOString()
      });
    } finally {
      this.isThinking = false;
      this.removeThinkingIndicator();
      this.renderMessages();
    }
  },

  // ─── Motor de Inteligência Nativa Confeitex ─────────────────────────────────
  generateNativeResponse(userPrompt, isOffline = false) {
    const q = userPrompt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const offlineSuffix = isOffline ? `\n\n📶 *(Respondido pelo Assistente Local no Modo Offline)*` : '';

    // 1. Saudações
    if (/^(ola|oi|opa|bom dia|boa tarde|boa noite|hello|hi|ei|socorro|ajuda)\b/.test(q)) {
      return I18n.t('aiChat.respGreeting') + offlineSuffix;
    }

    // 2. Cálculo de Bolo por Pessoa (ex: "para 20 pessoas", "bolo para 50 pessoas")
    const matchPeople = q.match(/(\d+)\s*(pessoas|convidados|fatias)/);
    if (matchPeople || q.includes('por pessoa') || q.includes('quantos kg') || q.includes('tamanho do bolo')) {
      const numPeople = matchPeople ? parseInt(matchPeople[1], 10) : null;
      if (numPeople && numPeople > 0) {
        const kgMin = (numPeople * 0.10).toFixed(1).replace('.0', '');
        const kgMax = (numPeople * 0.15).toFixed(1).replace('.0', '');
        return `🎂 **Cálculo de Bolo para ${numPeople} pessoas:**\n\n` +
               `• **Padrão recomendado:** 100g a 150g por pessoa.\n` +
               `• **Para festas com docinhos e salgados:** Cerca de **${kgMin} Kg** de bolo já é suficiente.\n` +
               `• **Para eventos onde o bolo é a atração principal:** Recomendo entre **${kgMin} Kg e ${kgMax} Kg**.\n\n` +
               `💡 *Dica:* Em fatias, considere que 1 Kg de bolo rende em média 8 a 10 fatias generosas.` + offlineSuffix;
      }
      return `🎂 **Como calcular o tamanho do bolo por convidado:**\n\n` +
             `• **100g por pessoa:** Ideal para festas infantis ou eventos com muitos docinhos e salgados.\n` +
             `• **120g a 150g por pessoa:** Ideal quando o bolo é a sobremesa principal ou festa de adultos.\n\n` +
             `**Exemplos rápidos de referência:**\n` +
             `• 15 pessoas: **1,5 Kg a 2,0 Kg** (forma ~18-20cm)\n` +
             `• 25 pessoas: **2,5 Kg a 3,0 Kg** (forma ~22-25cm)\n` +
             `• 50 pessoas: **5,0 Kg a 6,0 Kg** (forma retangular ou 2 andares)\n\n` +
             `Você pode cadastrar esse bolo direto na aba **Pedidos / Encomendas** informando o peso e o sabor!` + offlineSuffix;
    }

    // 3. Precificação e Cálculo de Custos
    if (q.includes('precificar') || q.includes('preco') || q.includes('margem') || q.includes('lucro') || q.includes('como cobrar') || q.includes('calcular custo')) {
      return `💰 **Fórmula Profissional de Precificação na Confeitaria:**\n\n` +
             `1. **Custo Direto dos Ingredientes (CMV):** Some farinha, leite condensado, embalagem, fita e caixas.\n` +
             `2. **Custos Invisíveis (Gás, Água, Energia, Detergente):** Adicione **20% a 30%** sobre o custo dos ingredientes.\n` +
             `3. **Mão de Obra:** Estipule seu salário mensal pretendido ÷ 160 horas no mês = valor da sua hora trabalhada.\n` +
             `4. **Margem de Lucro da Empresa:** Adicione entre **25% a 40%** de lucro para reinvestir no seu negócio.\n\n` +
             `📊 **No Confeitex:**\n` +
             `Ao criar um pedido, preencha o campo **Custo (R$)** e **Valor Total**. Na aba **Financeiro**, o app calcula automaticamente seu faturamento líquido e lucro real!` + offlineSuffix;
    }

    // 4. Orçamentos e Envio no WhatsApp
    if (q.includes('orcamento') || q.includes('proposta') || q.includes('enviar whatsapp') || q.includes('mandar no whatsapp')) {
      return `📋 **Como criar e enviar Orçamentos pelo WhatsApp:**\n\n` +
             `1. Acesse a aba **Orçamentos** no menu lateral.\n` +
             `2. Clique em **Novo Orçamento** e selecione o cliente, sabor e data do evento.\n` +
             `3. O sistema calcula automaticamente o total, aplicando taxas extras ou descontos se houver.\n` +
             `4. Na listagem de orçamentos, clique no botão verde do **WhatsApp** para abrir uma mensagem profissional pronta com os detalhes e a validade da proposta!\n` +
             `5. Quando o cliente aprovar, basta clicar em **Aprovar e Gerar Pedido** para converter o orçamento em encomenda com 1 clique.` + offlineSuffix;
    }

    // 5. Catálogo e Cardápio Personalizável
    if (q.includes('catalogo') || q.includes('cardapio') || q.includes('sabor') || q.includes('perfil da confeitaria')) {
      return `🍰 **Gerenciando seu Catálogo e Cardápio:**\n\n` +
             `• **Aba Catálogo:** Exibe seu cardápio profissional com visualização por categorias (Bolos de Kg, Doces, Salgados).\n` +
             `• **Compartilhar Cardápio:** Clique em **Compartilhar Cardápio** para compilar todos os seus sabores e preços em uma mensagem elegante para enviar aos clientes no WhatsApp.\n` +
             `• **Personalização:** Use o botão **Perfil da Confeitaria** para definir sua foto, especialidade, telefone comercial e chave Pix.` + offlineSuffix;
    }

    // 6. Backup e Troca de Aparelho
    if (q.includes('backup') || q.includes('salvar dados') || q.includes('trocar de celular') || q.includes('perder dados') || q.includes('exportar') || q.includes('importar')) {
      return `💾 **Backup e Segurança dos seus Dados:**\n\n` +
             `O Confeitex salva tudo localmente no seu aparelho com máxima privacidade e funciona 100% offline.\n\n` +
             `**Para fazer Backup:**\n` +
             `1. Vá na aba **Configurações** > **Gerenciar Dados**.\n` +
             `2. Clique em **Backup JSON** (salva um arquivo seguro com todos os seus pedidos, clientes e cardápio) ou **Backup PDF**.\n\n` +
             `**Para restaurar em outro celular ou navegador:**\n` +
             `1. Em Configurações, clique em **Importar Dados** e selecione o arquivo JSON que você salvou. Seus dados serão restaurados instantaneamente!` + offlineSuffix;
    }

    // 7. Notificações e Lembretes (especialmente Android / Samsung)
    if (q.includes('notificacao') || q.includes('lembrete') || q.includes('nao recebi') || q.includes('alarme') || q.includes('samsung')) {
      return `🔔 **Como garantir que as Notificações cheguem no seu Celular:**\n\n` +
             `1. Na aba **Configurações** > **Notificações**, certifique-se de que o botão está como **Notificações Ativadas**.\n` +
             `2. Escolha o horário de envio (ex: 08:00) e a antecedência (Hoje, Amanhã, 2 dias).\n\n` +
             `📱 **Dica para aparelhos Samsung, Xiaomi e Motorola:**\n` +
             `Os celulares costumam "suspender" aplicativos em segundo plano para economizar bateria. Para resolver:\n` +
             `• Vá nas **Configurações do Celular** > **Aplicativos** > **Confeitex / Navegador**.\n` +
             `• Em **Bateria**, mude de "Otimizado" para **"Sem restrições"** (ou desative suspensão).` + offlineSuffix;
    }

    // 8. Mensagens Prontas para Clientes (Cobrança, Sinal de 50%, Pedido Pronto)
    if (q.includes('mensagem') || q.includes('cobranca') || q.includes('sinal') || q.includes('texto') || q.includes('confirmar')) {
      return `💬 **Modelos Prontos de Mensagem para Clientes:**\n\n` +
             `**1. Pedido de Sinal (50%) para Reserva de Data:**\n` +
             `*"Olá, [Nome do Cliente]! Para garantirmos a reserva da sua data em nossa agenda e encomendarmos os insumos frescos, solicitamos um sinal de 50% (R$ [Valor]). A chave Pix é [Sua Chave Pix]. Assim que efetuar, me envie o comprovante por aqui, tá bom? Muito obrigada! 🥰"*\n\n` +
             `**2. Pedido Pronto para Entrega:**\n` +
             `*"Oi, [Nome]! Sua encomenda está prontinha, feita com todo carinho! 🎂 O saldo restante é de R$ [Valor]. Você prefere retirar ou faremos a entrega no horário combinado?"*` + offlineSuffix;
    }

    // 9. Lixeira e Recuperação de Itens Excluídos
    if (q.includes('lixeira') || q.includes('apaguei') || q.includes('exclui') || q.includes('recuperar') || q.includes('restaurar')) {
      return `🗑️ **Como recuperar pedidos ou itens apagados:**\n\n` +
             `1. Na barra superior da tabela de Pedidos ou Orçamentos, clique no ícone da **Lixeira**.\n` +
             `2. Uma janela se abrirá mostrando todos os pedidos, orçamentos ou sabores excluídos nos últimos 7 dias.\n` +
             `3. Basta clicar em **Restaurar** ao lado do item e ele voltará imediatamente para sua lista ativa!` + offlineSuffix;
    }

    // 10. Pagamentos via Mercado Pago
    if (q.includes('mercado pago') || q.includes('pix') || q.includes('cartao') || q.includes('pagamento')) {
      return `💳 **Recebendo Pagamentos via Mercado Pago:**\n\n` +
             `• O Confeitex integra com Mercado Pago para gerar links de cobrança e checkout transparente.\n` +
             `• Vá na aba **Configurações** > **Mercado Pago** e informe a URL do seu Cloudflare Worker e sua Public Key.\n` +
             `• Nos pedidos, você poderá clicar em **Cobrar com Mercado Pago** para gerar QR Code Pix automático ou enviar o link direto no WhatsApp do cliente!` + offlineSuffix;
    }

    // Se estiver Offline e a dúvida não bateu com nenhum tema cadastrado
    if (isOffline) {
      return `📶 **Você está em Modo Offline.**\n\n` +
             `O assistente local do Confeitex consegue te responder sobre:\n\n` +
             `• 🎂 **Cálculo de Bolos:** *"Bolo para 20 pessoas"*\n` +
             `• 💰 **Precificação:** *"Como precificar bolos e doces?"*\n` +
             `• 📋 **Orçamentos:** *"Como enviar orçamento no WhatsApp?"*\n` +
             `• 🍰 **Catálogo:** *"Como cadastrar sabores no cardápio?"*\n` +
             `• 💾 **Backup:** *"Como fazer backup e salvar meus dados?"*\n` +
             `• 🔔 **Notificações:** *"Como ativar lembretes de entrega?"*\n` +
             `• 💬 **Mensagens:** *"Modelo de mensagem para pedir sinal de 50%"*\n\n` +
             `Para dúvidas livres ou respostas personalizadas via inteligência na nuvem, conecte-se à internet!`;
    }

    // 11. Resposta Padrão / Dúvidas Gerais (Online)
    return `👩‍🍳 **Posso te ajudar com qualquer dúvida sobre o Confeitex ou sua Confeitaria!**\n\n` +
           `Você pode me perguntar sobre:\n` +
           `• 🎂 **Cálculo de bolos:** *"Quantos kg de bolo para 35 pessoas?"*\n` +
           `• 💰 **Precificação:** *"Como calcular o preço de venda e custos?"*\n` +
           `• 📋 **Orçamentos & Catálogo:** *"Como enviar orçamentos no WhatsApp?"*\n` +
           `• 💾 **Segurança:** *"Como fazer backup e trocar de aparelho?"*\n` +
           `• 🔔 **Notificações:** *"Como ativar lembretes de encomendas?"*\n\n` +
           `O que você gostaria de saber hoje?`;
  },

  // ─── Renderização de Mensagens ─────────────────────────────────────────────
  renderMessages() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;

    if (this.history.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = this.history.map(msg => {
      const isAi = msg.sender === 'ai';
      const formattedText = this.formatMarkdown(msg.text);
      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      return `
        <div class="ai-msg-row ${isAi ? 'ai-msg-row-ai' : 'ai-msg-row-user'}">
          ${isAi ? `
            <div class="ai-msg-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4.93 4.93a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83L4.93 7.76a2 2 0 0 1 0-2.83zM2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/>
              </svg>
            </div>
          ` : ''}
          <div class="ai-msg-bubble ${isAi ? 'ai-bubble-ai' : 'ai-bubble-user'}">
            <div class="ai-msg-content">${formattedText}</div>
            <div class="ai-msg-footer">
              ${msg.isOffline ? `<span class="ai-msg-offline-badge">Offline</span>` : ''}
              <span class="ai-msg-time">${timeStr}</span>
              ${isAi ? `
                <button type="button" class="ai-msg-copy-btn" onclick="AIChat.copyMessage('${msg.id}')" title="Copiar resposta">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.scrollToBottom();
  },

  renderThinkingIndicator() {
    const container = document.getElementById('aiChatMessages');
    if (!container) return;
    const existing = document.getElementById('aiChatThinkingRow');
    if (existing) return;

    const row = document.createElement('div');
    row.id = 'aiChatThinkingRow';
    row.className = 'ai-msg-row ai-msg-row-ai';
    row.innerHTML = `
      <div class="ai-msg-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM4.93 4.93a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83L4.93 7.76a2 2 0 0 1 0-2.83zM2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"/>
        </svg>
      </div>
      <div class="ai-msg-bubble ai-bubble-ai ai-bubble-thinking">
        <span class="ai-thinking-text">${I18n.t('aiChat.thinking') || 'Pensando'}</span>
        <span class="ai-typing-dots">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;
    container.appendChild(row);
    this.scrollToBottom();
  },

  removeThinkingIndicator() {
    const el = document.getElementById('aiChatThinkingRow');
    if (el) el.remove();
  },

  scrollToBottom() {
    const body = document.getElementById('aiChatBody');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  },

  copyMessage(id) {
    const msg = this.history.find(m => m.id === id);
    if (!msg) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg.text).then(() => {
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast(I18n.t('common.copied') || 'Copiado para a área de transferência!');
        }
      });
    }
  },

  formatMarkdown(text) {
    if (!text) return '';
    let escaped = escapeHTML(text);

    // Negrito **texto**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Itálico *texto*
    escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Bullet points (linhas começando com • ou -)
    escaped = escaped.replace(/^[•\-]\s+(.+)$/gm, '<li class="ai-chat-bullet">$1</li>');
    escaped = escaped.replace(/((?:<li class="ai-chat-bullet">.*?<\/li>\s*)+)/g, '<ul class="ai-chat-list">$1</ul>');

    // Quebras de linha
    escaped = escaped.replace(/\n\n/g, '<div class="ai-chat-p-gap"></div>');
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }
};
