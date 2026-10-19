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
        
        <!-- Minimalist Header (Single Row) -->
        <div class="ai-support-header">
          <div class="ai-header-left">
            <div class="ai-avatar-mini">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
                <rect x="4" y="8" width="16" height="12" rx="2"/>
                <circle cx="9" cy="13" r="1.5" fill="currentColor"/>
                <circle cx="15" cy="13" r="1.5" fill="currentColor"/>
                <path d="M9 17h6"/>
              </svg>
            </div>
            <div class="ai-header-info">
              <h3 class="ai-header-title">Assistente Confeitex</h3>
              <div class="ai-status-row">
                <span class="ai-live-dot"></span>
                <span id="aiSupportDayBadge">Dia 1 de 7 · VIP</span>
              </div>
            </div>
          </div>
          <button id="closeAiSupportModal" class="ai-close-btn" type="button" aria-label="Fechar assistente">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="ai-support-body" id="aiSupportBody">
          
          <!-- Greeting -->
          <div class="ai-greeting">
            <div class="ai-greeting-title">Como posso te ajudar hoje?</div>
            <p class="ai-greeting-sub">Tire dúvidas sobre o app nos seus 7 dias VIP ou toque em um atalho:</p>
          </div>

          <!-- Prompt Suggestions (Clean Grid with Sleek Icons) -->
          <div class="ai-prompts-section">
            <div class="ai-prompts-label">Atalhos Frequentes</div>
            <div class="ai-prompts-grid" id="aiQuickChips">
              <button class="ai-prompt-btn ai-chip-btn" data-query="precificacao" type="button">
                <svg class="ai-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <span class="ai-prompt-text">Precificação & Lucro</span>
              </button>

              <button class="ai-prompt-btn ai-chip-btn" data-query="encomenda" type="button">
                <svg class="ai-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span class="ai-prompt-text">Novo Pedido</span>
              </button>

              <button class="ai-prompt-btn ai-chip-btn" data-query="whatsapp" type="button">
                <svg class="ai-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                <span class="ai-prompt-text">Recibo no WhatsApp</span>
              </button>

              <button class="ai-prompt-btn ai-chip-btn" data-query="offline" type="button">
                <svg class="ai-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
                <span class="ai-prompt-text">Uso Offline</span>
              </button>

              <button class="ai-prompt-btn ai-chip-btn full-width" data-query="backup" type="button">
                <svg class="ai-prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span class="ai-prompt-text">Backup & Restauração</span>
              </button>
            </div>
          </div>

          <!-- AI Response Box -->
          <div id="aiResponseBox" class="ai-response-box" style="display:none;">
            <div class="ai-response-header">
              <div class="ai-response-badge">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1.5" fill="currentColor"/><circle cx="15" cy="13" r="1.5" fill="currentColor"/><path d="M9 17h6"/></svg>
                <span>Resposta da IA</span>
              </div>
              <button type="button" class="ai-response-close" id="aiBtnCloseResponse" title="Fechar resposta" aria-label="Fechar resposta">✕</button>
            </div>
            <div id="aiResponseText" class="ai-response-text"></div>
          </div>

          <!-- Input Bar -->
          <div class="ai-input-bar">
            <input 
              type="text" 
              id="aiInputQuery" 
              class="ai-input-field"
              placeholder="Digite sua dúvida sobre o app..." 
              aria-label="Digite sua dúvida sobre o app"
            >
            <button id="btnAiSend" class="ai-btn-send" type="button" title="Enviar pergunta" aria-label="Enviar pergunta">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>

          <!-- Guarantee Trust Note (Minimalist) -->
          <div class="ai-trust-card">
            <div class="ai-trust-info">
              <svg class="ai-trust-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <p class="ai-trust-text">
                <strong>Garantia de 7 dias:</strong> Reembolso de 100% (R$ ${this.REFUND_AMOUNT_BRL}) sem perguntas.
              </p>
            </div>
            <button id="btnRequestRefund" class="ai-btn-refund-link" type="button">
              Estorno
            </button>
          </div>

        </div>

        <!-- Rodapé do Modal -->
        <div class="ai-support-footer">
          <span>Confeitex IA · 100% Seguro</span>
          <a href="https://wa.me/?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20meu%20Confeitex." target="_blank" rel="noopener" class="ai-wa-link">
            <span>WhatsApp Oficial</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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
