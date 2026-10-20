/**
 * Confeitex — aiSupport.js
 * Módulo de Suporte Inteligente via IA
 * • Primeiros 7 Dias: Onboarding VIP & Garantia Incondicional de Reembolso Integral (100%)
 * • Acesso Vitalício Permanente: Assistente contínua disponível 24/7 sempre que precisar
 * • Design moderno estilo Intercom / Zendesk / WhatsApp com Body Scroll Lock anti-vazamento
 */

import { safeStorage } from './utils.js';

export const AiSupport = {
  SUPPORT_DAYS: 7,
  REFUND_AMOUNT_BRL: '89,90',
  SUPPORT_PHONE: '5562986290913',
  STORAGE_KEY_CONV: 'confeitex_ai_chat_history',
  _memoryHistory: [],

  init() {
    this.ensureActivationDate();
    this.bindGlobalTriggers();
  },

  ensureActivationDate() {
    let date = safeStorage.get('confeitex_activation_date');
    if (!date) {
      date = new Date().toISOString();
      safeStorage.set('confeitex_activation_date', date);
    }
    return date;
  },

  getDaysElapsed() {
    const raw = this.ensureActivationDate();
    const start = new Date(raw).getTime();
    const now = Date.now();
    const diff = now - start;
    return Math.max(1, Math.min(this.SUPPORT_DAYS, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1));
  },

  getDaysRemaining() {
    const elapsed = this.getDaysElapsed();
    return Math.max(0, this.SUPPORT_DAYS - elapsed + 1);
  },

  isWithinGuarantee() {
    const raw = this.ensureActivationDate();
    const start = new Date(raw).getTime();
    const diffDays = (Date.now() - start) / (1000 * 60 * 60 * 24);
    return diffDays <= this.SUPPORT_DAYS;
  },

  getMode() {
    return this.isWithinGuarantee() ? 'onboarding' : 'permanent';
  },

  getBadgeLabel() {
    if (this.isWithinGuarantee()) {
      return `Dia ${this.getDaysElapsed()} de ${this.SUPPORT_DAYS} · Onboarding VIP`;
    }
    return `Suporte IA Vitalício · Online`;
  },

  getChatHistory() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        const stored = sessionStorage.getItem(this.STORAGE_KEY_CONV);
        if (stored) return JSON.parse(stored);
      }
    } catch {
      // safe fallback
    }
    return this._memoryHistory;
  },

  saveChatHistory(history) {
    this._memoryHistory = history;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(this.STORAGE_KEY_CONV, JSON.stringify(history));
      }
    } catch {
      // safe fallback
    }
  },

  clearChatHistory() {
    this._memoryHistory = [];
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(this.STORAGE_KEY_CONV);
      }
    } catch {
      // safe fallback
    }
  },

  bindGlobalTriggers() {
    if (typeof document === 'undefined') return;

    ['btnAiSupportHeader', 'btnAiSupportDesktop'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.openModal();
        });
      }
    });

    document.querySelectorAll('.btn-ai-support-header, .btn-ai-header').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal();
      });
    });

    const btnSidebar = document.getElementById('rsb-ai-support');
    if (btnSidebar) {
      btnSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        const rsb = document.getElementById('rightSidebar');
        if (rsb) rsb.classList.remove('open');
        const overlay = document.getElementById('rightSidebarOverlay');
        if (overlay) overlay.classList.remove('active');
        this.openModal();
      });
    }
  },

  openModal() {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('aiSupportModalOverlay');
    if (overlay) {
      overlay.remove();
    }
    overlay = this.createModalElement();
    document.body.appendChild(overlay);

    this.updateModalState(overlay);

    // Trava de rolagem da tela de fundo (Body Scroll Lock)
    document.body.classList.add('ai-modal-open');
    overlay.classList.add('active');

    // Foca suavemente o input
    setTimeout(() => {
      const input = overlay.querySelector('#aiInputQuery');
      if (input) input.focus();
      this.scrollToBottom(overlay);
    }, 150);
  },

  closeModal() {
    const overlay = document.getElementById('aiSupportModalOverlay');
    if (overlay) overlay.classList.remove('active');
    if (typeof document !== 'undefined') {
      document.body.classList.remove('ai-modal-open');
    }
  },

  updateModalState(overlay) {
    const isGuarantee = this.isWithinGuarantee();
    const elapsed = this.getDaysElapsed();

    const badgeText = overlay.querySelector('#aiSupportDayBadge');
    if (badgeText) {
      if (isGuarantee) {
        badgeText.textContent = `Dia ${elapsed} de ${this.SUPPORT_DAYS} · Onboarding VIP`;
        badgeText.className = 'ai-header-badge mode-onboarding';
      } else {
        badgeText.textContent = `Suporte IA Vitalício · Online`;
        badgeText.className = 'ai-header-badge mode-lifetime';
      }
    }

    const refundBtn = overlay.querySelector('#btnFooterRefund');
    if (refundBtn) {
      if (isGuarantee) {
        refundBtn.style.display = 'inline-flex';
        refundBtn.onclick = (e) => {
          e.preventDefault();
          this.triggerRefundFlow();
        };
      } else {
        refundBtn.style.display = 'none';
      }
    }

    // Renderiza mensagens salvas ou mensagem inicial
    this.renderChatStream(overlay);
  },

  getInitialBotMessage() {
    const isGuarantee = this.isWithinGuarantee();

    if (isGuarantee) {
      return `
        <p>👋 <strong>Olá, confeiteira! Seja bem-vinda!</strong></p>
        <p>Estou aqui para tirar dúvidas sobre <strong>precificação, encomendas e uso do app</strong>. Toque em uma sugestão abaixo ou faça sua pergunta:</p>
      `;
    }

    return `
      <p>👋 <strong>Olá, confeiteira!</strong></p>
      <p>Sua assistente está online para tirar dúvidas de <strong>precificação, fatias e pedidos</strong>.</p>
      <p>Como posso te ajudar agora?</p>
    `;
  },

  renderChatStream(overlay) {
    const stream = overlay.querySelector('#aiChatStream');
    if (!stream) return;

    const history = this.getChatHistory();
    stream.innerHTML = '';

    if (!history || history.length === 0) {
      const initialHtml = this.getInitialBotMessage();
      this.appendMessageElement(stream, 'bot', initialHtml, false);
    } else {
      history.forEach((msg) => {
        this.appendMessageElement(stream, msg.sender, msg.text, false, msg.time);
      });
    }

    this.scrollToBottom(overlay);
  },

  appendMessageElement(stream, sender, textHtml, save = true, timeStr = null) {
    const time = timeStr || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const row = document.createElement('div');
    row.className = `ai-msg-row ai-msg-${sender}`;

    if (sender === 'bot') {
      row.innerHTML = `
        <div class="ai-msg-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
            <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
          </svg>
        </div>
        <div class="ai-bubble ai-bubble-bot">
          <div class="ai-bubble-content">${textHtml}</div>
          <div class="ai-msg-footer">
            <span>${time}</span>
            <button type="button" class="ai-msg-copy-btn" title="Copiar resposta">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copiar</span>
            </button>
          </div>
        </div>
      `;

      // Botão de copiar
      const copyBtn = row.querySelector('.ai-msg-copy-btn');
      if (copyBtn) {
        copyBtn.onclick = () => {
          const plain = row.querySelector('.ai-bubble-content')?.innerText || '';
          if (navigator.clipboard) {
            navigator.clipboard.writeText(plain).then(() => {
              const label = copyBtn.querySelector('span');
              if (label) {
                const prev = label.textContent;
                label.textContent = '✓ Copiado!';
                setTimeout(() => { label.textContent = prev; }, 1800);
              }
            }).catch(() => {});
          }
        };
      }
    } else {
      row.innerHTML = `
        <div class="ai-bubble ai-bubble-user">
          <div class="ai-bubble-content">${textHtml}</div>
          <div class="ai-msg-footer">
            <span>${time}</span>
          </div>
        </div>
      `;
    }

    stream.appendChild(row);

    if (save) {
      const history = this.getChatHistory();
      history.push({ sender, text: textHtml, time });
      this.saveChatHistory(history);
    }
  },

  showTypingIndicator(stream) {
    this.hideTypingIndicator(stream);
    const typing = document.createElement('div');
    typing.className = 'ai-msg-row ai-msg-bot ai-typing-row';
    typing.id = 'aiTypingIndicator';
    typing.innerHTML = `
      <div class="ai-msg-avatar" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
        </svg>
      </div>
      <div class="ai-bubble ai-bubble-bot ai-typing-bubble">
        <span class="ai-typing-text">Assistente pensando</span>
        <span class="ai-typing-dots">
          <span></span><span></span><span></span>
        </span>
      </div>
    `;
    stream.appendChild(typing);
  },

  hideTypingIndicator(stream) {
    const el = stream.querySelector('#aiTypingIndicator');
    if (el) el.remove();
  },

  scrollToBottom(overlay) {
    const stream = overlay.querySelector('#aiChatStream');
    if (stream) {
      stream.scrollTop = stream.scrollHeight;
    }
  },

  sendUserMessage(userQuery, overlay) {
    const q = userQuery.trim();
    if (!q) return;

    const stream = overlay.querySelector('#aiChatStream');
    if (!stream) return;

    // Escapa HTML básico da pergunta do usuário
    const safeText = q.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    this.appendMessageElement(stream, 'user', safeText, true);
    this.scrollToBottom(overlay);

    // Mostra indicador de digitação
    this.showTypingIndicator(stream);
    this.scrollToBottom(overlay);

    // Resposta inteligente da IA com delay natural
    setTimeout(() => {
      this.hideTypingIndicator(stream);
      const botResponseHtml = this.getKnowledgeResponse(q);
      this.appendMessageElement(stream, 'bot', botResponseHtml, true);
      this.scrollToBottom(overlay);
    }, 420);
  },

  resetConversation(overlay) {
    this.clearChatHistory();
    this.renderChatStream(overlay);
  },

  getKnowledgeResponse(query) {
    const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 1. Precificação & Custos
    if (q.includes('precif') || q.includes('preco') || q.includes('custo') || q.includes('lucro') || q.includes('calcular preco') || q.includes('quanto cobrar')) {
      return `
        <p><strong>💰 Como calcular o preço perfeito para nunca ter prejuízo:</strong></p>
        <p>O Confeitex utiliza a fórmula profissional de confeitaria:</p>
        <p><em>Preço = (Ingredientes + Custos Invisíveis + Mão de Obra) × Margem de Lucro</em></p>
        <ol>
          <li><strong>Ingredientes:</strong> Some o valor exato gasto (leite condensado, chocolate, farinha, etc).</li>
          <li><strong>Custos Invisíveis (+20%):</strong> Gás, energia, água, papel toalha e embalagem.</li>
          <li><strong>Mão de Obra:</strong> Calcule o valor da sua hora trabalhada (ex: se quer tirar R$ 2.500/mês e trabalha 160h, sua hora vale R$ 15,62).</li>
          <li><strong>Margem de Lucro (30% a 50%):</strong> Esse é o lucro livre que fica para reinvestir no seu negócio!</li>
        </ol>
        <p>💡 <strong>Dica de ouro:</strong> Abra a aba <strong>Financeiro</strong> no menu principal e use a <em>Calculadora de Custos</em> para preencher seus dados automaticamente!</p>
      `;
    }

    // 2. Mão de Obra
    if (q.includes('mao de obra') || q.includes('minha hora') || q.includes('salario') || q.includes('valor da hora')) {
      return `
        <p><strong>⏱️ Como calcular o valor da sua Mão de Obra:</strong></p>
        <p>Muitas confeiteiras erram ao não receber pelo próprio tempo de trabalho. Siga este passo simples:</p>
        <ol>
          <li>Defina seu <strong>salário pretendido</strong> (exemplo: R$ 2.500,00).</li>
          <li>Estime suas <strong>horas trabalhadas no mês</strong> (exemplo: 20 dias × 8 horas = 160 horas).</li>
          <li>Divida o salário pelas horas: <em>R$ 2.500 ÷ 160h = R$ 15,62 por hora</em>.</li>
          <li>Se você levou 3 horas para fazer e decorar um bolo: <em>3h × R$ 15,62 = R$ 46,86 de mão de obra</em>!</li>
        </ol>
        <p>Esse valor deve ser adicionado ao custo dos ingredientes antes de aplicar sua margem de lucro!</p>
      `;
    }

    // 3. Pedidos & Encomendas
    if (q.includes('pedido') || q.includes('encomenda') || q.includes('cadastr') || q.includes('novo pedido') || q.includes('agendar')) {
      return `
        <p><strong>🎂 Como cadastrar e organizar suas encomendas:</strong></p>
        <ol>
          <li>No menu principal, toque em <strong>Pedidos / Encomendas</strong>.</li>
          <li>Clique no botão <strong>+ Nova Encomenda</strong>.</li>
          <li>Informe o <strong>nome da cliente</strong>, contato, data e horário de entrega.</li>
          <li>Selecione o bolo/doce, peso estimado, sabor da massa e recheio.</li>
          <li>Cadastre o <strong>valor total</strong> e o sinal já pago.</li>
        </ol>
        <p>💡 <strong>Regra de ouro da confeiteira:</strong> Sempre cobre <em>50% de sinal no ato do pedido</em> para comprar os ingredientes e garantir o compromisso da cliente!</p>
      `;
    }

    // 4. WhatsApp & Comprovantes
    if (q.includes('whatsapp') || q.includes('zap') || q.includes('recibo') || q.includes('comprovante') || q.includes('mensagem')) {
      return `
        <p><strong>📱 Como enviar comprovante profissional no WhatsApp com 1 toque:</strong></p>
        <ol>
          <li>Vá até a lista de <strong>Pedidos</strong> e toque sobre o pedido da cliente.</li>
          <li>Clique no botão verde <strong>Comprovante WhatsApp</strong>.</li>
          <li>O Confeitex gera a mensagem pronta com:
            <ul>
              <li>Nome da cliente e data/hora da entrega;</li>
              <li>Sabores da massa, recheio e peso;</li>
              <li>Valor total, sinal pago e valor restante na entrega;</li>
              <li>Sua chave Pix cadastrada para pagamento facilitado!</li>
            </ul>
          </li>
          <li>O WhatsApp abre automaticamente com a mensagem pronta para enviar!</li>
        </ol>
      `;
    }

    // 5. Tamanhos, Aros e Fatias
    if (q.includes('aro') || q.includes('fatia') || q.includes('tamanho') || q.includes('rendimento') || q.includes('quantas pessoas') || q.includes('peso do bolo')) {
      return `
        <p><strong>📏 Tabela Prática de Fatias e Aros de Bolo:</strong></p>
        <p>Baseada em bolos de 10cm de altura (com 3 a 4 camadas de recheio):</p>
        <ul>
          <li><strong>Aro 15 cm:</strong> Rende de 10 a 12 fatias (~1,2 kg a 1,5 kg). Ideal para mini festas e mesversários.</li>
          <li><strong>Aro 20 cm:</strong> Rende de 20 a 25 fatias (~2,0 kg a 2,5 kg). O tamanho mais pedido!</li>
          <li><strong>Aro 25 cm:</strong> Rende de 35 a 40 fatias (~3,5 kg a 4,0 kg). Perfeito para aniversários médios.</li>
          <li><strong>Aro 30 cm:</strong> Rende de 50 a 60 fatias (~5,0 kg a 6,0 kg). Festas grandes.</li>
        </ul>
        <p>💡 <strong>Dica de cálculo:</strong> Para festas com salgados e docinhos, calcule <em>100g de bolo por convidado</em>. Se for apenas o bolo, calcule de <em>120g a 150g por pessoa</em>!</p>
      `;
    }

    // 6. Conservação & Validade
    if (q.includes('conserv') || q.includes('geladeira') || q.includes('validade') || q.includes('congelar') || q.includes('freezer') || q.includes('estragar')) {
      return `
        <p><strong>🍓 Prazos de Validade & Conservação para Confeitaria:</strong></p>
        <ul>
          <li><strong>Brigadeiros Tradicionais:</strong> 5 a 7 dias em temperatura ambiente (em local fresco), até 15 dias na geladeira em pote bem vedado, ou até 90 dias congelados.</li>
          <li><strong>Bolos com Frutas Frescas (morango, uva, kiwi):</strong> Validade máxima de 24h a 48h, <em>sempre refrigerados</em>, pois soltam água e fermentam rápido.</li>
          <li><strong>Bolos com Brigadeiro / Ganache:</strong> Até 5 dias refrigerados com segurança.</li>
          <li><strong>Massas de Pão de Ló / Amanteigadas:</strong> Podem ser congeladas embaladas em plástico filme por até 60 dias sem perder a maciez!</li>
        </ul>
      `;
    }

    // 7. Chantininho & Coberturas
    if (q.includes('chantininho') || q.includes('chantilly') || q.includes('ponto') || q.includes('poroso') || q.includes('derreter')) {
      return `
        <p><strong>🧁 Dica para Chantininho Perfeito e Sem Porosidade:</strong></p>
        <ol>
          <li><strong>Receita básica estável:</strong> 500ml de chantilly bem gelado (mínimo 12h de geladeira e 20min de freezer) + 100g de leite em pó + 25g de pó para glacê real.</li>
          <li>Bata na batedeira até abrir um buraco no meio e agarrar no batedor (ponto bem firme).</li>
          <li><strong>Hidratação (o segredo do ponto de seda):</strong> Adicione leite condensado gelado aos poucos, mexendo com espátula até ficar cremoso e sem bolhas de ar.</li>
        </ol>
      `;
    }

    // 8. Modo Offline & Instalação
    if (q.includes('offline') || q.includes('internet') || q.includes('cair') || q.includes('sem conex') || q.includes('instalar') || q.includes('app') || q.includes('tela inicial')) {
      return `
        <p><strong>📶 Uso 100% Offline & Como Instalar no Celular:</strong></p>
        <ul>
          <li><strong>Funciona na cozinha sem Wi-Fi:</strong> O Confeitex salva todos os seus dados diretamente no seu aparelho. Se a internet cair, você continua cadastrando pedidos normalmente!</li>
          <li><strong>No Android (Chrome):</strong> Toque nos 3 pontinhos no canto superior e selecione <em>"Adicionar à tela inicial"</em> ou <em>"Instalar aplicativo"</em>.</li>
          <li><strong>No iPhone (Safari):</strong> Toque no ícone de Compartilhar (o quadradinho com a seta para cima) e escolha <em>"Adicionar à Tela de Início"</em>.</li>
        </ul>
        <p>Pronto! O ícone do Confeitex aparecerá junto aos seus aplicativos como um app nativo!</p>
      `;
    }

    // 9. Backup & Segurança
    if (q.includes('backup') || q.includes('salvar') || q.includes('perder') || q.includes('restaurar') || q.includes('trocar de celular') || q.includes('exportar')) {
      return `
        <p><strong>💾 Como fazer backup e nunca perder seus dados:</strong></p>
        <ol>
          <li>Abra o menu lateral e toque em <strong>Configurações</strong>.</li>
          <li>Role até a área <strong>Backup & Restauração</strong>.</li>
          <li>Clique em <strong>Exportar Dados</strong>.</li>
          <li>Um arquivo seguro será baixado no seu celular. Guarde-o no Google Drive, envie para o seu próprio WhatsApp ou salve no computador.</li>
        </ol>
        <p>Se trocar de celular, basta abrir a mesma tela e clicar em <em>Importar Dados</em> para restaurar tudo em segundos!</p>
      `;
    }

    // 10. Dúvida sobre o suporte após os 7 dias / Acesso vitalício
    if (q.includes('depois') || q.includes('apos') || q.includes('vai acabar') || q.includes('expira') || q.includes('acaba') || q.includes('mensalidade') || q.includes('vitalicio')) {
      return `
        <p><strong>💜 O Suporte com IA continua depois dos 7 dias?</strong></p>
        <p><strong>SIM, com certeza!</strong></p>
        <p>Os <em>primeiros 7 dias</em> são sua fase de onboarding especial, com garantia de reembolso de 100%. Depois desse período, seu <strong>acesso continua liberado vitaliciamente</strong>!</p>
        <ul>
          <li>Você pode abrir este chat e tirar dúvidas de confeitaria sempre que precisar;</li>
          <li>Sem nenhuma cobrança adicional e sem mensalidades;</li>
          <li>Acesso total às ferramentas de precificação, encomendas, financeiro e clientes.</li>
        </ul>
      `;
    }

    // 11. Garantia de 7 Dias & Reembolso
    if (q.includes('garantia') || q.includes('reembolso') || q.includes('estorno') || q.includes('dinheiro de volta') || q.includes('devolver') || q.includes('7 dias')) {
      if (this.isWithinGuarantee()) {
        const remaining = this.getDaysRemaining();
        return `
          <p><strong>🛡️ Garantia Blindada de 7 Dias (Ativa):</strong></p>
          <p>Você tem ainda <strong>${remaining} dia(s) de garantia incondicional</strong> para testar o Confeitex na sua rotina de confeitaria.</p>
          <p>Se você achar que o app não atendeu às suas expectativas, basta clicar no botão <em>"Solicitar Reembolso Integral (R$ ${this.REFUND_AMOUNT_BRL})"</em> logo abaixo no rodapé deste painel para estorno imediato no Mercado Pago, sem burocracia!</p>
        `;
      }
      return `
        <p><strong>🛡️ Período de Garantia Inicial Concluído:</strong></p>
        <p>Parabéns! Seus primeiros 7 dias de adaptação inicial foram concluídos com sucesso.</p>
        <p>Agora você é membro vitalícia oficial do Confeitex, e tem acesso contínuo às atualizações, ferramentas de cálculo e a este <strong>Suporte com IA liberado permanentemente</strong> para te ajudar sempre que precisar!</p>
      `;
    }

    // 12. Cumprimentos e conversa casual
    if (q === 'oi' || q === 'ola' || q === 'bom dia' || q === 'boa tarde' || q === 'boa noite' || q.includes('quem e voce') || q.includes('obrigad') || q.includes('valeu') || q === 'ajuda') {
      return `
        <p>👋 <strong>Olá! É um prazer imenso conversar com você!</strong></p>
        <p>Eu sou a <strong>Assistente Inteligente do Confeitex</strong>, especializada em te ajudar na rotina doce da confeitaria.</p>
        <p>Você pode me perguntar sobre:</p>
        <ul>
          <li>Cálculo de custos e lucros de bolos e doces 💰</li>
          <li>Como cadastrar e gerenciar seus pedidos 🎂</li>
          <li>Tabela de rendimento de fatias por tamanho de aro 📏</li>
          <li>Dicas de validade e conservação 🍓</li>
        </ul>
        <p>O que você gostaria de ver agora?</p>
      `;
    }

    // 13. Resposta contextual inteligente com sugestão
    return `
      <p>Entendi sua pergunta sobre <strong>"${query}"</strong>!</p>
      <p>O Confeitex foi projetado exatamente para simplificar o seu dia a dia na confeitaria:</p>
      <ul>
        <li>Para calcular preços e ingredientes, veja a aba <strong>Financeiro</strong>;</li>
        <li>Para organizar entregas e clientes, veja a aba <strong>Pedidos</strong>;</li>
        <li>Para estatísticas de vendas, consulte o <strong>Painel de Controle (Dashboard)</strong>.</li>
      </ul>
      <p>Deseja ver uma dica específica sobre <em>precificação</em>, <em>tamanhos de formas</em> ou <em>envio de comprovante no WhatsApp</em>? Você também pode falar diretamente com o criador do Confeitex no link do WhatsApp abaixo!</p>
    `;
  },

  triggerRefundFlow() {
    const textMsg = encodeURIComponent(
      `Olá! Gostaria de solicitar o reembolso integral da minha licença Confeitex (R$ ${this.REFUND_AMOUNT_BRL}) adquirida via Mercado Pago dentro do prazo de garantia de 7 dias.`
    );
    const whatsappUrl = `https://wa.me/${this.SUPPORT_PHONE}?text=${textMsg}`;

    if (confirm(`Deseja abrir a solicitação de reembolso total de 100% (R$ ${this.REFUND_AMOUNT_BRL}) via WhatsApp com o criador do Confeitex?`)) {
      window.open(whatsappUrl, '_blank');
    }
  },

  createModalElement() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ai-support-overlay';
    overlay.id = 'aiSupportModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Suporte Confeitex IA');

    overlay.innerHTML = `
      <div class="modal-container ai-support-card">

        <!-- Cabeçalho Compacto (Linha Única) -->
        <div class="ai-support-header">
          <div class="ai-header-brand">
            <div class="ai-robot-avatar">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
                <path d="M18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z"/>
              </svg>
              <span class="ai-avatar-status-dot" title="Online"></span>
            </div>
            <div class="ai-header-titles">
              <span class="ai-modal-title">Suporte IA</span>
              <span class="ai-header-badge" id="aiSupportDayBadge">${this.getBadgeLabel()}</span>
            </div>
          </div>
          <div class="ai-header-actions">
            <button id="aiBtnResetChat" class="ai-header-btn" type="button" aria-label="Limpar conversa" title="Recomeçar conversa">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
            </button>
            <button id="closeAiSupportModal" class="ai-close-btn" type="button" aria-label="Fechar suporte">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Conteúdo do Chat -->
        <div class="ai-support-body" id="aiSupportBody">
          
          <!-- Fluxo de Mensagens do Chat -->
          <div class="ai-chat-stream" id="aiChatStream"></div>

          <!-- Carrossel de Dúvidas Rápidas (Chips) -->
          <div class="ai-chips-carousel" id="aiQuickChips">
            <button class="ai-chip-pill" data-query="Como precificar meu primeiro bolo?" type="button">
              <span>💰</span><span>Precificar bolo</span>
            </button>
            <button class="ai-chip-pill" data-query="Como cadastrar e salvar um pedido?" type="button">
              <span>🎂</span><span>Cadastrar pedido</span>
            </button>
            <button class="ai-chip-pill" data-query="Como enviar recibo no WhatsApp da cliente?" type="button">
              <span>📱</span><span>Recibo WhatsApp</span>
            </button>
            <button class="ai-chip-pill" data-query="Quantas fatias rende cada aro de bolo?" type="button">
              <span>📏</span><span>Rendimento & Aros</span>
            </button>
            <button class="ai-chip-pill" data-query="Como funciona a garantia de 7 dias?" type="button">
              <span>🛡️</span><span>Garantia 7 dias</span>
            </button>
          </div>

          <!-- Barra de Digitação Manual -->
          <div class="ai-input-bar">
            <input 
              type="text" 
              id="aiInputQuery" 
              class="ai-input-field" 
              placeholder="Digite sua dúvida aqui..." 
              aria-label="Digite sua dúvida sobre o app ou confeitaria"
            >
            <button id="btnAiSend" class="ai-btn-send" type="button" title="Enviar pergunta" aria-label="Enviar pergunta">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

        </div>

        <!-- Rodapé Minimalista -->
        <div class="ai-support-footer">
          <button id="btnFooterRefund" class="ai-footer-refund-btn" type="button" title="Garantia Incondicional de 7 Dias com 100% Reembolso">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Garantia 7 Dias (100% Reembolso)</span>
          </button>
          <a href="https://wa.me/5562986290913?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20meu%20Confeitex." target="_blank" rel="noopener" class="ai-wa-link" title="Falar com o Criador do Confeitex no WhatsApp">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.41a8.16 8.16 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.14.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.35-.77-1.85-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.13.17 1.77 2.7 4.29 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.17-.48-.29"/></svg>
            <span>WhatsApp</span>
          </a>
        </div>

      </div>
    `;

    // Fechar modal
    const closeBtn = overlay.querySelector('#closeAiSupportModal');
    if (closeBtn) closeBtn.onclick = () => this.closeModal();

    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };

    // Bloqueia rolagem da tela de fundo por toque no overlay (Mobile Touch Lock)
    overlay.addEventListener('touchmove', (e) => {
      if (!e.target.closest('.ai-chat-stream, .ai-chips-carousel, .ai-input-field')) {
        e.preventDefault();
      }
    }, { passive: false });

    // Fecha ao pressionar Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    // Botão de resetar conversa
    const resetBtn = overlay.querySelector('#aiBtnResetChat');
    if (resetBtn) {
      resetBtn.onclick = () => {
        this.resetConversation(overlay);
      };
    }

    // Chips de perguntas rápidas
    const chips = overlay.querySelectorAll('.ai-chip-pill');
    chips.forEach((chip) => {
      chip.onclick = () => {
        const q = chip.dataset.query;
        if (q) this.sendUserMessage(q, overlay);
      };
    });

    // Envio manual de pergunta
    const input = overlay.querySelector('#aiInputQuery');
    const btnSend = overlay.querySelector('#btnAiSend');
    const sendFn = () => {
      const q = input.value.trim();
      if (!q) return;
      this.sendUserMessage(q, overlay);
      input.value = '';
    };

    if (btnSend) btnSend.onclick = sendFn;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') sendFn();
      };
    }

    return overlay;
  }
};
