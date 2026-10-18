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

    // Trigger no Header
    const btnHeader = document.getElementById('btnAiSupportHeader');
    if (btnHeader) {
      btnHeader.addEventListener('click', (e) => {
        e.preventDefault();
        this.openModal();
      });
    }

    // Trigger no Menu Lateral Direito
    const btnSidebar = document.getElementById('rsb-ai-support');
    if (btnSidebar) {
      btnSidebar.addEventListener('click', (e) => {
        e.preventDefault();
        const rsb = document.getElementById('rightSidebar');
        if (rsb) rsb.classList.remove('active');
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
      badge.textContent = `Dia ${currentDay} de ${this.SUPPORT_DAYS} de Acompanhamento VIP`;
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
    overlay.style.zIndex = '10500';

    overlay.innerHTML = `
      <div class="modal-container ai-support-card" style="max-width:580px; background:#130e28; border:1px solid rgba(236,72,153,0.35); border-radius:24px; padding:0; overflow:hidden; box-shadow:0 25px 70px rgba(0,0,0,0.85);">
        
        <!-- Header do Modal com Gradiente -->
        <div style="background:linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(139,92,246,0.2) 100%); padding:1.4rem 1.6rem 1.2rem; border-bottom:1px solid rgba(255,255,255,0.08); position:relative;">
          <button id="closeAiSupportModal" style="position:absolute; top:1.2rem; right:1.2rem; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          <div style="display:flex; align-items:center; gap:0.85rem;">
            <div style="width:52px; height:52px; border-radius:16px; background:linear-gradient(135deg, #009ee3, #8b5cf6); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 24px rgba(0,158,227,0.4);">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><rect x="4" y="8" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1.5" fill="#fff"/><circle cx="15" cy="13" r="1.5" fill="#fff"/><path d="M9 17h6"/></svg>
            </div>
            <div>
              <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
                <h3 style="font-size:1.2rem; font-weight:800; color:#fff; margin:0;">Suporte Confeitex com IA</h3>
                <span id="aiSupportDayBadge" style="font-size:0.68rem; font-weight:800; background:#10b981; color:#fff; padding:0.15rem 0.55rem; border-radius:20px;">
                  Dia 1 de 7 VIP
                </span>
              </div>
              <p style="font-size:0.82rem; color:#cbd5e1; margin:0; line-height:1.4;">
                Sua assistente inteligente para tirar dúvidas na hora e dominar o app nos seus primeiros 7 dias.
              </p>
            </div>
          </div>
        </div>

        <!-- Conteúdo do Chat / Perguntas Rápidas -->
        <div style="padding:1.4rem 1.6rem; max-height:60vh; overflow-y:auto;" id="aiSupportBody">
          
          <!-- Mensagem de Boas-vindas -->
          <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:1rem; margin-bottom:1.25rem; font-size:0.86rem; color:#f1f5f9; line-height:1.5;">
            🍰 <strong>Olá, confeiteira!</strong> Parabéns pelo seu acesso vitalício. Durante seus primeiros <strong>7 dias</strong>, estou aqui para te ajudar em cada detalhe. Toque nas dúvidas rápidas abaixo ou me faça uma pergunta:
          </div>

          <!-- Chips de Dúvidas Rápidas -->
          <div style="margin-bottom:1.25rem;">
            <div style="font-size:0.75rem; font-weight:700; color:#94a3b8; text-transform:uppercase; margin-bottom:0.6rem; letter-spacing:0.05em;">
              Dúvidas Mais Frequentes:
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:0.45rem;" id="aiQuickChips">
              <button class="ai-chip-btn" data-query="precificacao" style="background:rgba(236,72,153,0.12); border:1px solid rgba(236,72,153,0.3); color:#f472b6; padding:0.4rem 0.75rem; border-radius:12px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                💰 Como precificar meu bolo?
              </button>
              <button class="ai-chip-btn" data-query="encomenda" style="background:rgba(0,158,227,0.12); border:1px solid rgba(0,158,227,0.3); color:#38bdf8; padding:0.4rem 0.75rem; border-radius:12px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                🎂 Como cadastrar uma encomenda?
              </button>
              <button class="ai-chip-btn" data-query="whatsapp" style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#34d399; padding:0.4rem 0.75rem; border-radius:12px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                📱 Como enviar recibo no WhatsApp?
              </button>
              <button class="ai-chip-btn" data-query="offline" style="background:rgba(251,191,36,0.12); border:1px solid rgba(251,191,36,0.3); color:#fbbf24; padding:0.4rem 0.75rem; border-radius:12px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                📶 Como usar offline na cozinha?
              </button>
              <button class="ai-chip-btn" data-query="backup" style="background:rgba(139,92,246,0.12); border:1px solid rgba(139,92,246,0.3); color:#c084fc; padding:0.4rem 0.75rem; border-radius:12px; font-size:0.8rem; font-weight:700; cursor:pointer;">
                💾 Como fazer backup dos dados?
              </button>
            </div>
          </div>

          <!-- Área de Resposta da IA -->
          <div id="aiResponseBox" style="background:#0a0618; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:1.1rem; margin-bottom:1.25rem; display:none;">
            <div style="display:flex; align-items:center; gap:0.4rem; font-size:0.8rem; font-weight:800; color:#38bdf8; margin-bottom:0.5rem;">
              <span>🤖 Resposta da IA:</span>
            </div>
            <div id="aiResponseText" style="font-size:0.88rem; color:#f8fafc; line-height:1.6;"></div>
          </div>

          <!-- Caixa de Pergunta Manual -->
          <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem;">
            <input 
              type="text" 
              id="aiInputQuery" 
              placeholder="Digite sua dúvida sobre o app..." 
              style="flex:1; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.18); border-radius:12px; padding:0.75rem 1rem; color:#fff; font-size:0.9rem;"
            >
            <button id="btnAiSend" style="background:linear-gradient(135deg, #009ee3, #8b5cf6); border:none; color:#fff; border-radius:12px; padding:0.75rem 1.1rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:0.35rem;">
              <span>Perguntar</span>
            </button>
          </div>

          <!-- Seção de Garantia Blindada de 7 Dias & Reembolso -->
          <div style="background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.25); border-radius:18px; padding:1.15rem; margin-top:0.5rem;">
            <div style="display:flex; align-items:flex-start; gap:0.75rem;">
              <div style="font-size:1.5rem; line-height:1;">🛡️</div>
              <div style="flex:1;">
                <div style="font-size:0.92rem; font-weight:800; color:#f87171; margin-bottom:0.25rem;">
                  Garantia Incondicional de 7 Dias
                </div>
                <p style="font-size:0.8rem; color:#cbd5e1; margin:0 0 0.85rem 0; line-height:1.45;">
                  Queremos que você se sinta 100% segura. Se durante os seus primeiros 7 dias você sentir que o Confeitex não é para você, você tem direito ao <strong>reembolso integral de R$ ${this.REFUND_AMOUNT_BRL}</strong> sem perguntas e sem complicação.
                </p>
                <button id="btnRequestRefund" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4); color:#fca5a5; font-size:0.8rem; font-weight:800; padding:0.55rem 0.95rem; border-radius:10px; cursor:pointer; display:flex; align-items:center; gap:0.4rem;">
                  <span>Solicitar Reembolso Completo (R$ ${this.REFUND_AMOUNT_BRL})</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- Footer do Modal -->
        <div style="background:rgba(0,0,0,0.4); padding:0.85rem 1.6rem; border-top:1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; color:#94a3b8;">
          <span>Confeitex IA Support v1.3</span>
          <a href="https://wa.me/?text=Ol%C3%A1!%20Preciso%20de%20ajuda%20com%20o%20meu%20Confeitex." target="_blank" rel="noopener" style="color:#38bdf8; text-decoration:none; font-weight:700;">
            Falar no WhatsApp
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
