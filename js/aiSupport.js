/**
 * Confeitex — aiSupport.js
 * Módulo de Suporte Inteligente via IA por 7 Dias + Garantia de Reembolso Integral (100%)
 */

import { safeStorage } from './utils.js';

export const AiSupport = {
  SUPPORT_DAYS: 7,
  REFUND_AMOUNT_BRL: '89,90',

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

  bindGlobalTriggers() {
    if (typeof document === 'undefined') return;

    // Triggers no Header (Mobile ao lado das 3 barras e Desktop)
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

    // Trigger no Menu Lateral Direito
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
    if (!overlay) {
      overlay = this.createModalElement();
      document.body.appendChild(overlay);
    }

    // Atualiza contadores dinâmicos
    const currentDay = this.getDaysElapsed();
    const daysLeft = this.getDaysRemaining();
    const badge = overlay.querySelector('#aiSupportDayBadge');
    if (badge) {
      badge.textContent = `Dia ${currentDay} de ${this.SUPPORT_DAYS} · VIP`;
    }

    overlay.classList.add('active');
  },

  closeModal() {
    const overlay = document.getElementById('aiSupportModalOverlay');
    if (overlay) overlay.classList.remove('active');
  },

  createModalElement() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay ai-support-overlay';
    overlay.id = 'aiSupportModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Suporte com Inteligência Artificial e Garantia');

    overlay.innerHTML = `
      <div class="modal-container ai-support-card">
        
        <!-- Header do Modal com Linha Superior Separada para Badge e Fechar -->
        <div class="ai-support-header">
          <div class="ai-header-top-row">
            <div class="ai-day-badge-wrap">
              <span class="ai-badge-dot"></span>
              <span id="aiSupportDayBadge">Dia 1 de 7 · VIP</span>
            </div>
            <button id="closeAiSupportModal" class="ai-close-btn" type="button" aria-label="Fechar suporte">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="ai-header-main">
            <div class="ai-robot-avatar">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1.5" fill="#fff"/><circle cx="15" cy="13" r="1.5" fill="#fff"/><path d="M9 17h6"/></svg>
            </div>
            <div class="ai-header-titles">
              <h3 class="ai-modal-title">Suporte Confeitex com IA</h3>
              <p class="ai-modal-desc">Sua assistente inteligente para dominar o app nos seus primeiros 7 dias.</p>
            </div>
          </div>
        </div>

        <!-- Conteúdo do Chat / Perguntas Rápidas -->
        <div class="ai-support-body" id="aiSupportBody">
          
          <!-- Mensagem de Boas-vindas -->
          <div class="ai-welcome-card">
            <span class="ai-welcome-icon">🍰</span>
            <div>
              <strong>Olá, confeiteira!</strong> Parabéns pelo seu acesso vitalício. Durante seus primeiros <strong>7 dias</strong>, estou aqui para te ajudar em cada detalhe. Toque nas dúvidas rápidas abaixo ou me faça uma pergunta:
            </div>
          </div>

          <!-- Lista Estruturada de Dúvidas Rápidas -->
          <div>
            <div class="ai-section-title">Dúvidas Mais Frequentes</div>
            <div class="ai-quick-list" id="aiQuickChips">
              <button class="ai-chip-card ai-chip-btn" data-query="precificacao" type="button">
                <div class="ai-chip-card-content">
                  <span class="ai-chip-emoji">💰</span>
                  <span class="ai-chip-text">Como precificar meu bolo?</span>
                </div>
                <svg class="ai-chip-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button class="ai-chip-card ai-chip-btn" data-query="encomenda" type="button">
                <div class="ai-chip-card-content">
                  <span class="ai-chip-emoji">🎂</span>
                  <span class="ai-chip-text">Como cadastrar uma encomenda?</span>
                </div>
                <svg class="ai-chip-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button class="ai-chip-card ai-chip-btn" data-query="whatsapp" type="button">
                <div class="ai-chip-card-content">
                  <span class="ai-chip-emoji">📱</span>
                  <span class="ai-chip-text">Como enviar recibo no WhatsApp?</span>
                </div>
                <svg class="ai-chip-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button class="ai-chip-card ai-chip-btn" data-query="offline" type="button">
                <div class="ai-chip-card-content">
                  <span class="ai-chip-emoji">📶</span>
                  <span class="ai-chip-text">Como usar offline na cozinha?</span>
                </div>
                <svg class="ai-chip-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button class="ai-chip-card ai-chip-btn" data-query="backup" type="button">
                <div class="ai-chip-card-content">
                  <span class="ai-chip-emoji">💾</span>
                  <span class="ai-chip-text">Como fazer backup dos dados?</span>
                </div>
                <svg class="ai-chip-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <!-- Área de Resposta da IA -->
          <div id="aiResponseBox" class="ai-response-box" style="display:none;">
            <div class="ai-response-header">
              <div class="ai-response-badge">
                <span>🤖 Resposta da IA</span>
              </div>
              <button type="button" class="ai-response-close" id="aiBtnCloseResponse" title="Fechar resposta" aria-label="Fechar resposta">✕</button>
            </div>
            <div id="aiResponseText" class="ai-response-text"></div>
          </div>

          <!-- Caixa de Pergunta Manual -->
          <div class="ai-input-bar">
            <input 
              type="text" 
              id="aiInputQuery" 
              class="ai-input-field"
              placeholder="Digite sua dúvida sobre o app..." 
              aria-label="Digite sua dúvida sobre o app"
            >
            <button id="btnAiSend" class="ai-btn-send" type="button">
              <span>Perguntar</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

          <!-- Seção de Garantia Blindada de 7 Dias & Reembolso -->
          <div class="ai-guarantee-card">
            <div class="ai-guarantee-top">
              <div class="ai-guarantee-icon">🛡️</div>
              <div class="ai-guarantee-info">
                <div class="ai-guarantee-title">Garantia Incondicional de 7 Dias</div>
                <p class="ai-guarantee-desc">
                  Se durante seus primeiros 7 dias você sentir que o Confeitex não é para você, você tem direito ao <strong>reembolso integral de R$ ${this.REFUND_AMOUNT_BRL}</strong> sem perguntas e sem burocracia.
                </p>
              </div>
            </div>
            <button id="btnRequestRefund" class="ai-btn-refund" type="button">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>
              <span>Solicitar Reembolso Integral (R$ ${this.REFUND_AMOUNT_BRL})</span>
            </button>
          </div>

        </div>

        <!-- Rodapé do Modal -->
        <div class="ai-support-footer">
          <span>Confeitex IA Support v1.3.4</span>
          <a href="https://wa.me/?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20meu%20Confeitex." target="_blank" rel="noopener" class="ai-wa-link">
            <span>Falar no WhatsApp</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>

      </div>
    `;

    // Ações internas do modal
    const closeBtn = overlay.querySelector('#closeAiSupportModal');
    if (closeBtn) closeBtn.onclick = () => this.closeModal();

    overlay.onclick = (e) => {
      if (e.target === overlay) this.closeModal();
    };

    // Fechar caixa de resposta
    const btnCloseResp = overlay.querySelector('#aiBtnCloseResponse');
    if (btnCloseResp) {
      btnCloseResp.onclick = () => {
        const box = overlay.querySelector('#aiResponseBox');
        if (box) box.style.display = 'none';
      };
    }

    // Chips de perguntas rápidas
    const chips = overlay.querySelectorAll('.ai-chip-btn');
    chips.forEach(chip => {
      chip.onclick = () => {
        const queryType = chip.dataset.query;
        this.processAiResponse(queryType, overlay);
      };
    });

    // Envio manual de pergunta
    const input = overlay.querySelector('#aiInputQuery');
    const btnSend = overlay.querySelector('#btnAiSend');
    const sendFn = () => {
      const q = input.value.trim();
      if (!q) return;
      this.processCustomQuery(q, overlay);
      input.value = '';
    };

    if (btnSend) btnSend.onclick = sendFn;
    if (input) {
      input.onkeydown = (e) => {
        if (e.key === 'Enter') sendFn();
      };
    }

    // Botão de Reembolso 100%
    const btnRefund = overlay.querySelector('#btnRequestRefund');
    if (btnRefund) {
      btnRefund.onclick = () => {
        this.triggerRefundFlow();
      };
    }

    return overlay;
  },

  processAiResponse(type, overlay) {
    const box = overlay.querySelector('#aiResponseBox');
    const text = overlay.querySelector('#aiResponseText');
    if (!box || !text) return;

    let response = '';

    switch (type) {
      case 'precificacao':
        response = `
          <strong>Como calcular seus custos e lucros:</strong><br>
          1. Vá até a aba <strong>Financeiro</strong>.<br>
          2. Use a calculadora de custos para somar leite condensado, farinha, embalagem e horas de trabalho.<br>
          3. O Confeitex soma tudo e sugere sua <em>margem de lucro real (30% a 50%)</em>, garantindo que você nunca mais tome prejuízo!
        `;
        break;

      case 'encomenda':
        response = `
          <strong>Como cadastrar seu primeiro pedido:</strong><br>
          1. No menu principal, toque em <strong>Pedidos / Encomendas</strong>.<br>
          2. Toque no botão <strong>+ Nova Encomenda</strong>.<br>
          3. Preencha o nome da cliente, o bolo/doce, peso, data e hora da entrega.<br>
          4. O app organiza sua agenda de produção e te avisa quando o pedido estiver próximo da entrega!
        `;
        break;

      case 'whatsapp':
        response = `
          <strong>Como enviar o comprovante com 1 toque:</strong><br>
          1. Abra a encomenda da cliente na lista de pedidos.<br>
          2. Toque no botão verde <strong>Comprovante WhatsApp</strong>.<br>
          3. O Confeitex monta a mensagem com valor, sabores, data e chave Pix, abrindo o WhatsApp pronto para enviar!
        `;
        break;

      case 'offline':
        response = `
          <strong>Uso 100% Offline:</strong><br>
          • O Confeitex salva todas as informações diretamente no seu celular.<br>
          • Se a internet cair ou você estiver na cozinha sem Wi-Fi, pode cadastrar pedidos normalmente.<br>
          • Tudo continua funcionando e não se perde nada!
        `;
        break;

      case 'backup':
        response = `
          <strong>Como fazer o backup dos seus dados:</strong><br>
          1. Abra o menu lateral e toque em <strong>Configurações</strong>.<br>
          2. Role até a área de <em>Backup & Restauração</em>.<br>
          3. Toque em <strong>Exportar Dados</strong>. Um arquivo seguro será salvo no seu celular para restaurar quando trocar de aparelho.
        `;
        break;

      default:
        response = 'Estou à disposição para responder qualquer dúvida sobre as funções do app!';
    }

    text.innerHTML = response;
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  processCustomQuery(userQuery, overlay) {
    const box = overlay.querySelector('#aiResponseBox');
    const text = overlay.querySelector('#aiResponseText');
    if (!box || !text) return;

    const q = userQuery.toLowerCase();
    let answer = '';

    if (q.includes('preço') || q.includes('custo') || q.includes('lucro') || q.includes('precific')) {
      this.processAiResponse('precificacao', overlay);
      return;
    } else if (q.includes('pedido') || q.includes('encomenda') || q.includes('bolo') || q.includes('cadastro')) {
      this.processAiResponse('encomenda', overlay);
      return;
    } else if (q.includes('zap') || q.includes('whatsapp') || q.includes('recibo') || q.includes('comprovante')) {
      this.processAiResponse('whatsapp', overlay);
      return;
    } else if (q.includes('internet') || q.includes('offline') || q.includes('cair') || q.includes('conex')) {
      this.processAiResponse('offline', overlay);
      return;
    } else if (q.includes('backup') || q.includes('salvar') || q.includes('celular') || q.includes('trocar')) {
      this.processAiResponse('backup', overlay);
      return;
    } else if (q.includes('reembolso') || q.includes('dinheiro') || q.includes('devolver') || q.includes('garantia') || q.includes('estorno')) {
      answer = `
        <strong>Política de Garantia e Reembolso:</strong><br>
        Você tem <strong>7 dias de garantia incondicional</strong> a partir do momento da compra.<br>
        Se não gostar ou não se adaptar, basta clicar no botão vermelho abaixo para solicitar o reembolso total de R$ ${this.REFUND_AMOUNT_BRL}!
      `;
    } else if (q.includes('pagamento') || q.includes('mercado pago') || q.includes('pix') || q.includes('cartao')) {
      answer = `
        <strong>Pagamentos no Confeitex:</strong><br>
        • O app é liberado mediante pagamento único de R$ ${this.REFUND_AMOUNT_BRL} via Mercado Pago (PIX ou até 2x no cartão).<br>
        • Para cobrar suas clientes, você também pode configurar sua chave Pix ou link do Mercado Pago em <em>Configurações</em>!
      `;
    } else {
      answer = `
        Entendi sua dúvida sobre "<em>${userQuery}</em>"!<br>
        • O Confeitex organiza todos os seus pedidos, clientes e custos de confeitaria em um só lugar.<br>
        • Você pode explorar as abas <strong>Dashboard</strong>, <strong>Pedidos</strong> e <strong>Financeiro</strong> no menu principal.<br>
        • Se precisar de auxílio humano individualizado, utilize o link de suporte WhatsApp no rodapé deste painel!
      `;
    }

    text.innerHTML = answer;
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  triggerRefundFlow() {
    const textMsg = encodeURIComponent(
      `Olá! Gostaria de solicitar o reembolso integral da minha licença Confeitex (R$ ${this.REFUND_AMOUNT_BRL}) adquirida via Mercado Pago dentro do prazo de garantia de 7 dias.`
    );
    const whatsappUrl = `https://wa.me/?text=${textMsg}`;
    
    if (confirm('Deseja abrir a solicitação de reembolso total de 100% (R$ 89,90) via WhatsApp com nossa equipe de atendimento?')) {
      window.open(whatsappUrl, '_blank');
    }
  }
};
