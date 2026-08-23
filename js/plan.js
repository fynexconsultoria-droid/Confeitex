/**
 * Plan.js — Sistema de Planos Confeitex
 * Trial 7 dias grátis → Assinatura R$7,99/mês via PayPal
 *
 * Para ativar pagamentos reais:
 * 1. Crie um plano de assinatura em https://developer.paypal.com
 * 2. Substitua PAYPAL_CLIENT_ID e PAYPAL_PLAN_ID abaixo pelos seus valores reais
 */

const Plan = {
  // ─── Configuração PayPal ─────────────────────────────────────────────────
  // TODO: Substitua pelos seus valores reais do PayPal
  PAYPAL_CLIENT_ID: 'YOUR_PAYPAL_CLIENT_ID',
  PAYPAL_PLAN_ID:   'YOUR_PAYPAL_PLAN_ID',

  // ─── Configuração do Plano ────────────────────────────────────────────────
  TRIAL_DAYS: 7,
  MAX_ORDERS_FREE: 20,
  PRICE_BRL: 7.99,
  CURRENCY: 'BRL',

  // ─── Chaves localStorage ─────────────────────────────────────────────────
  KEY_TRIAL_START:  'confeitex_trial_start',
  KEY_SUB_ID:       'confeitex_sub_id',
  KEY_SUB_STATUS:   'confeitex_sub_status',
  KEY_SUB_EXPIRES:  'confeitex_sub_expires',

  // ─── Estado interno ───────────────────────────────────────────────────────
  _paypalLoaded: false,

  // ─────────────────────────────────────────────────────────────────────────
  // Inicialização
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    // Se nunca acessou, inicia o trial agora
    if (!safeStorage.get(this.KEY_TRIAL_START)) {
      this.startTrial();
    }
    this.renderPlanBadge();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Trial
  // ─────────────────────────────────────────────────────────────────────────
  startTrial() {
    safeStorage.set(this.KEY_TRIAL_START, new Date().toISOString());
  },

  getTrialStart() {
    const v = safeStorage.get(this.KEY_TRIAL_START);
    return v ? new Date(v) : null;
  },

  getTrialDaysLeft() {
    const start = this.getTrialStart();
    if (!start) return 0;
    const elapsed = (Date.now() - start.getTime()) / 86400000;
    return Math.max(0, Math.ceil(this.TRIAL_DAYS - elapsed));
  },

  isTrialActive() {
    return this.getTrialDaysLeft() > 0;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Assinatura
  // ─────────────────────────────────────────────────────────────────────────
  activateSubscription(subscriptionId) {
    safeStorage.set(this.KEY_SUB_ID, subscriptionId);
    safeStorage.set(this.KEY_SUB_STATUS, 'active');
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // Renovação anual como fallback
    safeStorage.set(this.KEY_SUB_EXPIRES, expires.toISOString());
    this.renderPlanBadge();
  },

  isSubscriptionActive() {
    return safeStorage.get(this.KEY_SUB_STATUS) === 'active';
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Status geral
  // ─────────────────────────────────────────────────────────────────────────
  getStatus() {
    if (this.isSubscriptionActive()) {
      return {
        type: 'active',
        daysLeft: null,
        expiresAt: safeStorage.get(this.KEY_SUB_EXPIRES)
      };
    }
    if (this.isTrialActive()) {
      const start = this.getTrialStart();
      const expiresAt = start
        ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
        : null;
      return { type: 'trial', daysLeft: this.getTrialDaysLeft(), expiresAt };
    }
    const start = this.getTrialStart();
    const expiresAt = start
      ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
      : null;
    return { type: 'expired', daysLeft: 0, expiresAt };
  },

  isPremium() {
    const s = this.getStatus();
    return s.type === 'active' || s.type === 'trial';
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Verificação de features
  // ─────────────────────────────────────────────────────────────────────────
  canUse(feature) {
    if (this.isSubscriptionActive()) return true;

    if (this.isTrialActive()) {
      // Durante o trial, apenas o limite de pedidos é verificado
      if (feature === 'unlimited_orders') {
        return (typeof State !== 'undefined' ? State.orders.length : 0) < this.MAX_ORDERS_FREE;
      }
      return true;
    }

    // Trial expirado — tudo bloqueado exceto visualização
    return false;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Badge da Sidebar
  // ─────────────────────────────────────────────────────────────────────────
  renderPlanBadge() {
    const container = document.getElementById('planBadgeContainer');
    if (!container) return;

    const status = this.getStatus();
    let badgeHTML = '';

    if (status.type === 'active') {
      badgeHTML = `
        <div class="plan-badge plan-badge--premium" id="planBadge" onclick="Plan.showManageModal()">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">Plano Premium</span>
            <span class="plan-badge-sub">Ativo ✓</span>
          </div>
        </div>`;
    } else if (status.type === 'trial') {
      const d = status.daysLeft;
      const urgency = d <= 2 ? 'plan-badge--urgent' : d <= 4 ? 'plan-badge--warning' : 'plan-badge--trial';
      badgeHTML = `
        <div class="plan-badge ${urgency}" id="planBadge" onclick="Plan.showUpgradeModal()">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">Teste Grátis</span>
            <span class="plan-badge-sub">${d} dia${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}</span>
          </div>
          <svg class="plan-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    } else {
      badgeHTML = `
        <div class="plan-badge plan-badge--expired" id="planBadge" onclick="Plan.showUpgradeModal()">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">Trial Expirado</span>
            <span class="plan-badge-sub">Assine por R$7,99/mês</span>
          </div>
          <svg class="plan-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    }

    container.innerHTML = badgeHTML;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Paywall — bloqueia funcionalidade e abre modal de upgrade
  // ─────────────────────────────────────────────────────────────────────────
  async showPaywall(featureName) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'paywall-overlay';
      overlay.id = 'paywallOverlay';

      overlay.innerHTML = `
        <div class="paywall-modal">
          <div class="paywall-header">
            <div class="paywall-lock-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 class="paywall-title">Confeitex Premium</h2>
            <p class="paywall-subtitle">${featureName} está disponível apenas no plano pago.</p>
          </div>
          <div class="paywall-features">
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Pedidos ilimitados
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Relatórios financeiros completos
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Exportação PDF e JSON
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Gestão de clientes ilimitada
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Notificações e lembretes
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Atualizações gratuitas
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Suporte prioritário
            </div>
          </div>
          <div class="paywall-price">
            <div class="paywall-price-value">
              <span class="paywall-price-currency">R$</span>
              <span class="paywall-price-amount">7,99</span>
              <span class="paywall-price-period">/mês</span>
            </div>
            <p class="paywall-price-note">Sem fidelidade · Cancele quando quiser</p>
          </div>
          <button class="paywall-btn-upgrade" id="paywallBtnUpgrade">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Assinar Agora — R$7,99/mês
          </button>
          <button class="paywall-btn-cancel" id="paywallBtnCancel">Agora não</button>
        </div>`;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const close = (result) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 400);
        resolve(result);
      };

      document.getElementById('paywallBtnCancel').onclick = () => close(false);
      document.getElementById('paywallBtnUpgrade').onclick = () => {
        close(false);
        this.showUpgradeModal();
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Assinatura com PayPal
  // ─────────────────────────────────────────────────────────────────────────
  showUpgradeModal() {
    if (document.getElementById('planUpgradeOverlay')) return;

    const status = this.getStatus();
    const daysLeft = status.type === 'trial' ? status.daysLeft : 0;
    const trialNote = status.type === 'trial'
      ? `<div class="plan-trial-note">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
           </svg>
           Seu período gratuito termina em <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</strong>
         </div>`
      : `<div class="plan-trial-note plan-trial-note--expired">
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
           </svg>
           Seu período gratuito expirou. Assine para continuar!
         </div>`;

    const overlay = document.createElement('div');
    overlay.className = 'plan-upgrade-overlay';
    overlay.id = 'planUpgradeOverlay';

    overlay.innerHTML = `
      <div class="plan-upgrade-modal">
        <button class="plan-upgrade-close" id="planUpgradeClose" aria-label="Fechar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div class="plan-upgrade-header">
          <div class="plan-upgrade-crown">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <h2 class="plan-upgrade-title">Confeitex Premium</h2>
          <p class="plan-upgrade-subtitle">Tudo que você precisa para crescer sua confeitaria</p>
        </div>

        ${trialNote}

        <div class="plan-upgrade-benefits">
          <div class="plan-benefit">
            <div class="plan-benefit-icon">📋</div>
            <div class="plan-benefit-text">
              <strong>Pedidos ilimitados</strong>
              <span>Sem limite de encomendas cadastradas</span>
            </div>
          </div>
          <div class="plan-benefit">
            <div class="plan-benefit-icon">📊</div>
            <div class="plan-benefit-text">
              <strong>Relatórios financeiros completos</strong>
              <span>Análise detalhada de lucro e despesas</span>
            </div>
          </div>
          <div class="plan-benefit">
            <div class="plan-benefit-icon">📤</div>
            <div class="plan-benefit-text">
              <strong>Exportação PDF e JSON</strong>
              <span>Backup completo dos seus dados</span>
            </div>
          </div>
          <div class="plan-benefit">
            <div class="plan-benefit-icon">👥</div>
            <div class="plan-benefit-text">
              <strong>Gestão de clientes ilimitada</strong>
              <span>Histórico completo por cliente</span>
            </div>
          </div>
          <div class="plan-benefit">
            <div class="plan-benefit-icon">🔔</div>
            <div class="plan-benefit-text">
              <strong>Notificações e lembretes</strong>
              <span>Nunca perca uma entrega</span>
            </div>
          </div>
          <div class="plan-benefit">
            <div class="plan-benefit-icon">⭐</div>
            <div class="plan-benefit-text">
              <strong>Atualizações gratuitas</strong>
              <span>Sempre a versão mais recente</span>
            </div>
          </div>
        </div>

        <div class="plan-upgrade-price-box">
          <div class="plan-price-main">
            <span class="plan-price-currency">R$</span>
            <span class="plan-price-amount">7,99</span>
            <span class="plan-price-period">/mês</span>
          </div>
          <p class="plan-price-cancel">Sem fidelidade · Cancele quando quiser</p>
        </div>

        <div class="plan-paypal-container" id="planPaypalContainer">
          <div class="plan-paypal-loading" id="planPaypalLoading">
            <div class="plan-paypal-spinner"></div>
            <span>Carregando checkout seguro...</span>
          </div>
          <div id="paypal-button-container" style="display:none;"></div>
        </div>

        <button class="plan-upgrade-btn-back" id="planUpgradeBack">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Voltar
        </button>

        <div class="plan-upgrade-secure">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Pagamento 100% seguro via PayPal
        </div>
      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    document.getElementById('planUpgradeClose').onclick = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 400);
    };

    document.getElementById('planUpgradeBack').onclick = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 400);
    };

    // Carrega o PayPal SDK e renderiza o botão
    this._loadPayPalButton();
  },

  showManageModal() {
    UI.alert('Sua assinatura Premium está ativa! Para gerenciar, acesse paypal.com/myaccount/autopay');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PayPal SDK
  // ─────────────────────────────────────────────────────────────────────────
  _loadPayPalButton() {
    const containerId = 'paypal-button-container';
    const loadingId   = 'planPaypalLoading';

    const renderButton = () => {
      const loading = document.getElementById(loadingId);
      const container = document.getElementById(containerId);
      if (!loading || !container) return;

      loading.style.display = 'none';
      container.style.display = 'block';

      // Verifica se o PLAN_ID está configurado
      if (this.PAYPAL_PLAN_ID === 'YOUR_PAYPAL_PLAN_ID') {
        container.innerHTML = `
          <div class="paypal-demo-notice">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;flex-shrink:0;">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <strong>Modo de demonstração</strong><br>
              <small>Configure seu PAYPAL_CLIENT_ID e PAYPAL_PLAN_ID em js/plan.js para ativar o pagamento real.</small>
            </div>
          </div>
          <button class="paypal-demo-btn" id="paypalDemoActivate">
            ✅ Simular Assinatura (Demo)
          </button>`;
        document.getElementById('paypalDemoActivate').onclick = () => {
          this.activateSubscription('DEMO_SUB_' + Date.now());
          const overlay = document.getElementById('planUpgradeOverlay');
          if (overlay) { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 400); }
          UI.toast('✅ Assinatura ativada (modo demo)!', 'success');
        };
        return;
      }

      // PayPal real
      if (typeof paypal === 'undefined') {
        container.innerHTML = `<p style="color:var(--color-danger);text-align:center;font-size:0.85rem;">Erro ao carregar PayPal. Verifique sua conexão.</p>`;
        return;
      }

      paypal.Buttons({
        style: {
          shape:  'rect',
          color:  'gold',
          layout: 'vertical',
          label:  'subscribe'
        },
        createSubscription: (data, actions) => {
          return actions.subscription.create({ plan_id: this.PAYPAL_PLAN_ID });
        },
        onApprove: (data) => {
          this.activateSubscription(data.subscriptionID);
          const overlay = document.getElementById('planUpgradeOverlay');
          if (overlay) { overlay.classList.remove('active'); setTimeout(() => overlay.remove(), 400); }
          UI.toast('🎉 Assinatura ativada com sucesso!', 'success');
        },
        onError: (err) => {
          console.warn('[Confeitex] PayPal error:', err);
          UI.toast('Erro no pagamento. Tente novamente.', 'danger');
        }
      }).render('#' + containerId);
    };

    // Se já carregou o SDK anteriormente
    if (this._paypalLoaded && typeof paypal !== 'undefined') {
      renderButton();
      return;
    }

    // Carrega o SDK dinamicamente
    if (this.PAYPAL_CLIENT_ID === 'YOUR_PAYPAL_CLIENT_ID') {
      // Modo demo — não carrega o SDK real
      setTimeout(renderButton, 600);
      return;
    }

    if (document.getElementById('paypal-sdk')) {
      // Script já no DOM, aguarda carregar
      const check = setInterval(() => {
        if (typeof paypal !== 'undefined') {
          clearInterval(check);
          this._paypalLoaded = true;
          renderButton();
        }
      }, 200);
      return;
    }

    const script = document.createElement('script');
    script.id  = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${this.PAYPAL_CLIENT_ID}&vault=true&intent=subscription&currency=${this.CURRENCY}`;
    script.onload = () => {
      this._paypalLoaded = true;
      renderButton();
    };
    script.onerror = () => {
      const loading = document.getElementById(loadingId);
      if (loading) loading.innerHTML = '<p style="color:var(--color-danger)">Erro ao carregar PayPal.</p>';
    };
    document.head.appendChild(script);
  }
};
