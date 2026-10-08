import { Dashboard } from './dashboard.js';
import { MercadoPagoCheckout } from './mercadopago.js';
import { State } from './state.js';
import { UI } from './ui.js';
import { safeStorage } from './utils.js';

/**
 * Plan.js — Sistema de Planos Confeitex integrado ao Mercado Pago
 * - Teste Grátis de 7 dias com cadastro obrigatório de Cartão de Crédito
 * - Mensalidade de R$ 16,99/mês
 * - Pagamento automático no Cartão de Crédito cadastrado (Débito em conta automático)
 */

export const Plan = {
  // ─── Configuração do Plano ────────────────────────────────────────────────
  TRIAL_DAYS: 7,
  PRICE_BRL: 16.99,
  PLAN_NAME: 'Confeitex Premium',
  CURRENCY: 'BRL',
  MAX_ORDERS_FREE: 20,

  // ─── Chaves localStorage ─────────────────────────────────────────────────
  KEY_TRIAL_START:    'confeitex_trial_start',
  KEY_SUB_ID:         'confeitex_sub_id',
  KEY_SUB_STATUS:     'confeitex_sub_status', // 'active' | 'expired' | 'canceled'
  KEY_SUB_EXPIRES:    'confeitex_sub_expires',
  KEY_CARD_DATA:      'confeitex_plan_card',
  KEY_CUSTOMER_ID:    'confeitex_mp_customer_id', // ID do cliente no MP (seguro armazenar)
  KEY_CARD_ID:        'confeitex_mp_card_id',     // ID do cartão no MP (seguro armazenar)
  KEY_RENEWAL_PREF:   'confeitex_plan_renewal_pref', // 'card'
  KEY_PAYMENT_METHOD: 'confeitex_plan_pay_method',

  // ─── Estado interno ───────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Inicialização
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    this.checkSubscriptionStatus().then(() => {
      if (!this.getTrialStart() && !this.isSubscriptionActive()) {
        this.startTrial();
      }
      this.renderPlanBadge();
    });
  },

  async checkSubscriptionStatus() {
    if (typeof MercadoPagoCheckout === 'undefined' || !MercadoPagoCheckout.WORKER_URL) return;
    const subId = safeStorage.get(this.KEY_SUB_ID);
    if (!subId) return;

    try {
      const res = await fetch(`${MercadoPagoCheckout.WORKER_URL}/subscription/${subId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'active') {
          safeStorage.set(this.KEY_SUB_STATUS, 'active');
          if (data.expiresAt) safeStorage.set(this.KEY_SUB_EXPIRES, data.expiresAt);
        } else {
          safeStorage.set(this.KEY_SUB_STATUS, data.status);
        }
        this.renderPlanBadge();
      }
    } catch (e) {
      console.warn('[Plan] Erro ao checar assinatura:', e);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Gerenciamento do Cartão de Crédito
  // ─────────────────────────────────────────────────────────────────────────
  hasRegisteredCard() {
    const card = this.getCardData();
    return Boolean(card && card.lastFourDigits);
  },

  getCardData() {
    try {
      const data = safeStorage.get(this.KEY_CARD_DATA);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  saveCardData(cardData) {
    // Segurança: NÃO salva o token no localStorage
    // Apenas dados seguros: últimos 4 dígitos, nome, validade, bandeira
    safeStorage.set(this.KEY_CARD_DATA, JSON.stringify({
      lastFourDigits: cardData.lastFourDigits || '4242',
      cardholderName: cardData.cardholderName || '',
      expirationMonth: cardData.expirationMonth || '',
      expirationYear: cardData.expirationYear || '',
      brand: cardData.brand || 'credit_card',
      email: cardData.email || '',
      savedAt: new Date().toISOString(),
    }));
    // Salva customer_id e card_id se fornecidos (seguro armazenar)
    if (cardData.customer_id) safeStorage.set(this.KEY_CUSTOMER_ID, cardData.customer_id);
    if (cardData.card_id) safeStorage.set(this.KEY_CARD_ID, cardData.card_id);
  },

  removeCardData() {
    safeStorage.remove(this.KEY_CARD_DATA);
    safeStorage.remove(this.KEY_CUSTOMER_ID);
    safeStorage.remove(this.KEY_CARD_ID);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Preferência de Pagamento no Vencimento (Cartão direto)
  // ─────────────────────────────────────────────────────────────────────────
  getRenewalPreference() {
    return 'card';
  },

  setRenewalPreference(pref) {
    // Apenas cartão é aceito
    safeStorage.set(this.KEY_RENEWAL_PREF, 'card');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Período de Testes (Trial de 7 dias com Cartão Cadastrado)
  // ─────────────────────────────────────────────────────────────────────────
  startTrial(cardData) {
    // Não reinicia se o trial já está ativo
    if (this.isTrialActive()) return;
    if (cardData) {
      this.saveCardData(cardData);
    }
    safeStorage.set(this.KEY_TRIAL_START, new Date().toISOString());
    this.renderPlanBadge();
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
  // Assinatura Ativa
  // ─────────────────────────────────────────────────────────────────────────
  activateSubscription(subscriptionId, days = 30, method = 'card') {
    safeStorage.set(this.KEY_SUB_ID, subscriptionId || `SUB_${Date.now()}`);
    safeStorage.set(this.KEY_SUB_STATUS, 'active');
    safeStorage.set(this.KEY_PAYMENT_METHOD, method);

    const expires = new Date();
    expires.setDate(expires.getDate() + days);
    safeStorage.set(this.KEY_SUB_EXPIRES, expires.toISOString());

    this.renderPlanBadge();
    if (typeof Dashboard !== 'undefined' && Dashboard.update) Dashboard.update();
  },

  isSubscriptionActive() {
    if (safeStorage.get(this.KEY_SUB_STATUS) !== 'active') return false;
    const expiresStr = safeStorage.get(this.KEY_SUB_EXPIRES);
    if (!expiresStr) return true;
    return new Date(expiresStr).getTime() > Date.now();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Status Geral do Plano
  // ─────────────────────────────────────────────────────────────────────────
  getStatus() {
    if (this.isSubscriptionActive()) {
      return {
        type: 'active',
        daysLeft: null,
        expiresAt: safeStorage.get(this.KEY_SUB_EXPIRES),
        hasCard: this.hasRegisteredCard(),
      };
    }

    if (this.isTrialActive()) {
      const start = this.getTrialStart();
      const expiresAt = start
        ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
        : null;
      return {
        type: 'trial',
        daysLeft: this.getTrialDaysLeft(),
        expiresAt,
        hasCard: true,
      };
    }

    const start = this.getTrialStart();
    const expiresAt = start
      ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
      : null;

    return {
      type: 'expired',
      daysLeft: 0,
      expiresAt,
      hasCard: this.hasRegisteredCard(),
    };
  },

  isPremium() {
    const s = this.getStatus();
    return s.type === 'active' || s.type === 'trial';
  },

  canUse(feature) {
    if (this.isSubscriptionActive()) return true;

    // Feature sempre liberada por lei LGPD (Fase 3): export
    if (feature === 'export') return true;

    if (feature === 'unlimited_orders') {
      return (typeof State !== 'undefined' ? State.orders.length : 0) < this.MAX_ORDERS_FREE;
    }

    if (this.isTrialActive()) {
      if (['finances_tab', 'backup_restore', 'pdf_export', 'trash_bin', 'import'].includes(feature)) {
        return false;
      }
      return true;
    }

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
        <div class="plan-badge plan-badge--premium" id="planBadge" title="Gerenciar Plano Confeitex">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">Plano Premium</span>
            <span class="plan-badge-sub">Ativo ✓</span>
          </div>
          <svg class="plan-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    } else if (status.type === 'trial') {
      const d = status.daysLeft;
      const urgency = d <= 2 ? 'plan-badge--urgent' : d <= 4 ? 'plan-badge--warning' : 'plan-badge--trial';
      badgeHTML = `
        <div class="plan-badge ${urgency}" id="planBadge" title="Gerenciar Teste Grátis">
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
      const label = status.hasCard ? 'Mensalidade Vencida' : 'Tempo Esgotado';
      const sub = 'Assine por R$ 16,99/mês';
      badgeHTML = `
        <div class="plan-badge plan-badge--expired" id="planBadge" title="Ativar Confeitex">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">${label}</span>
            <span class="plan-badge-sub">${sub}</span>
          </div>
          <svg class="plan-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    }

    container.innerHTML = badgeHTML;
    const planBadge = document.getElementById('planBadge');
    if (planBadge) {
      planBadge.addEventListener('click', () => {
        if (status.type === 'active' || status.type === 'trial') {
          this.showManageModal();
        } else {
          this.showUpgradeModal();
        }
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Cadastro de Cartão de Crédito (Obrigatório para Teste ou Troca)
  // ─────────────────────────────────────────────────────────────────────────
  showCardRegistrationModal(options = {}) {
    const isForTrial = options.forTrial !== false;
    const onComplete = options.onComplete || null;

    const existing = document.getElementById('planCardModalOverlay');
    if (existing) {
      if (existing.classList.contains('active')) return;
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'plan-card-modal-overlay modal-overlay';
    overlay.id = 'planCardModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isForTrial ? 'Cadastro de Cartão para Teste Grátis' : 'Atualizar Cartão de Crédito');

    overlay.innerHTML = `
      <div class="plan-card-modal">
        <div class="plan-card-modal-header">
          <div class="plan-card-badge-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${isForTrial ? '7 Dias Grátis · Sem Cobrança Hoje' : 'Atualização de Cartão'}
          </div>
          <h2 class="plan-card-modal-title">${isForTrial ? 'Ativar Assinatura Confeitex' : 'Alterar Cartão Cadastrado'}</h2>
          <p class="plan-card-modal-subtitle">
            ${isForTrial 
              ? 'Inicie seus 7 dias gratuitos. O plano é de apenas <strong>R$ 16,99/mês</strong> com débito automático no cartão e você pode cancelar a qualquer momento.' 
              : 'Informe os novos dados do cartão para o débito automático mensal da sua assinatura.'}
          </p>
        </div>

        <div class="plan-pricing-summary">
          <div class="plan-pricing-pill">
            <span class="plan-pricing-tag">Plano Premium</span>
            <div class="plan-pricing-cost">
              <strong>R$ 16,99</strong><span>/mês</span>
            </div>
          </div>
          <div class="plan-pricing-features">
            <div class="plan-pricing-benefit">
              <span class="plan-pricing-check">✓</span> 7 dias grátis para testar
            </div>
            <div class="plan-pricing-benefit">
              <span class="plan-pricing-check">✓</span> Débito automático no cartão
            </div>
            <div class="plan-pricing-benefit">
              <span class="plan-pricing-check">✓</span> Cancele quando quiser sem multa
            </div>
          </div>
        </div>

        <!-- Formulário Seguro do Cartão (Mercado Pago Brick) -->
        <div id="planCardBrickContainer" style="min-height: 300px; margin-top: 1rem;"></div>
        <div id="planCardLoading" style="display:flex; justify-content:center; padding: 2rem;">
          <span class="plan-spinner" style="border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--color-accent-pink); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite;"></span>
        </div>
        <div id="planCardError" class="plan-card-error-msg" style="display:none; margin-top:1rem;"></div>

        <div class="plan-card-security-footer" style="margin-top:1.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Cobrança 100% segura via Mercado Pago · PCI Compliance
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const errorEl = document.getElementById('planCardError');
    const loadingEl = document.getElementById('planCardLoading');

    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const renderBrick = async () => {
      try {
        await MercadoPagoCheckout._ensureReady();
        if (!MercadoPagoCheckout._bricksBuilder) throw new Error('MP Bricks não disponível.');

        const settings = {
          initialization: {
            amount: 16.99,
          },
          customization: {
            visual: {
              style: { theme: 'dark' }
            },
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'off',
              ticket: 'off',
              bankTransfer: 'off'
            }
          },
          callbacks: {
            onReady: () => {
              loadingEl.style.display = 'none';
            },
            onSubmit: async (formData) => {
              try {
                if (!MercadoPagoCheckout.WORKER_URL) {
                  throw new Error('Worker do Mercado Pago não configurado. Não é possível cadastrar cartão seguro em modo demo.');
                }
                const res = await fetch(`${MercadoPagoCheckout.WORKER_URL}/validate-card`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: formData.token, payer: formData.payer })
                });

                if (!res.ok) {
                  const errObj = await res.json();
                  throw new Error(errObj.error || 'Erro ao validar cartão.');
                }

                const result = await res.json();
                
                // Salva token e assina
                this.saveCardData({
                  lastFourDigits: result.lastFourDigits || '****',
                  cardholderName: formData.payer.email || 'Cliente Confeitex',
                  brand: 'credit_card',
                  token: formData.token,
                  email: formData.payer.email
                });

                if (isForTrial) {
                  this.startTrial();
                  UI.toast('🎉 Cartão cadastrado com sucesso!', 'success');
                } else {
                  UI.toast('✅ Cartão de crédito atualizado com sucesso!', 'success');
                }

                this.renderPlanBadge();
                closeModal();
                if (typeof onComplete === 'function') onComplete(result);
              } catch (e) {
                errorEl.textContent = e.message;
                errorEl.style.display = 'block';
              }
            },
            onError: (error) => {
              console.error('[MP Brick Error]', error);
              errorEl.textContent = 'Erro ao processar o formulário seguro.';
              errorEl.style.display = 'block';
            }
          }
        };

        window.planCardController = await MercadoPagoCheckout._bricksBuilder.create(
          'payment',
          'planCardBrickContainer',
          settings
        );
      } catch (err) {
        loadingEl.style.display = 'none';
        errorEl.textContent = 'Erro ao carregar o Mercado Pago. Tente novamente.';
        errorEl.style.display = 'block';
      }
    };

    renderBrick();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Gerenciamento do Plano ("Meu Plano Confeitex")
  // ─────────────────────────────────────────────────────────────────────────
  showManageModal() {
    const existing = document.getElementById('planManageModalOverlay');
    if (existing) {
      if (existing.classList.contains('active')) return;
      existing.remove();
    }

    const status = this.getStatus();
    const card = this.getCardData();
    const renewalPref = this.getRenewalPreference();

    const overlay = document.createElement('div');
    overlay.className = 'plan-manage-modal-overlay modal-overlay';
    overlay.id = 'planManageModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Gerenciamento do Plano Confeitex');

    let statusHeaderHTML = '';
    if (status.type === 'active') {
      const expDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : 'Auto-renovação';
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--active">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Assinatura Premium Ativa</div>
            <div class="plan-status-sub">Próximo débito automático: <strong>${expDate}</strong> · R$ 16,99/mês</div>
          </div>
        </div>`;
    } else if (status.type === 'trial') {
      const d = status.daysLeft;
      const expDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : '';
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--trial">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Período de Testes: ${d} dia${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}</div>
            <div class="plan-status-sub">Primeiro débito em: <strong>${expDate}</strong> · Depois R$ 16,99/mês</div>
          </div>
        </div>`;
    } else {
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--expired">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Mensalidade Vencida</div>
            <div class="plan-status-sub">Regularize sua assinatura (R$ 16,99/mês) para continuar usando todas as funções.</div>
          </div>
        </div>`;
    }

    // Informações do Cartão Cadastrado
    let cardInfoHTML = '';
    if (card) {
      const brandUpper = (card.brand || 'CARTÃO').toUpperCase();
      cardInfoHTML = `
        <div class="plan-saved-card-box">
          <div class="plan-saved-card-left">
            <div class="plan-saved-card-icon">💳</div>
            <div>
              <strong>${brandUpper} •••• ${card.lastFourDigits || '4242'}</strong>
              <div class="plan-saved-card-holder">${card.cardholderName || 'Titular Cadastrado'} · Validade: ${card.expirationMonth}/${card.expirationYear}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" id="btnChangePlanCard">Alterar Cartão</button>
        </div>
      `;
    } else {
      cardInfoHTML = `
        <div class="plan-no-card-box">
          <span>Nenhum cartão cadastrado ainda.</span>
          <button class="btn btn-primary btn-sm" id="btnAddPlanCard">Cadastrar Cartão</button>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="plan-manage-modal">
        <div class="plan-manage-header">
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Meu Plano Confeitex
          </h2>
        </div>

        <div class="plan-manage-body">
          ${statusHeaderHTML}

          <!-- Banner Informativo de Débito Automático -->
          <div class="plan-auto-debit-banner">
            <div class="plan-auto-debit-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="plan-auto-debit-text">
              <strong>Débito Automático Mensal no Cartão</strong>
              <p>Sua mensalidade de <strong>R$ 16,99/mês</strong> é debitada automaticamente no cartão cadastrado. Sem necessidade de boletos ou renovação manual.</p>
            </div>
          </div>

          <!-- Seção de Cartão de Crédito -->
          <div class="plan-section">
            <h3 class="plan-section-title">Cartão de Crédito Cadastrado</h3>
            ${cardInfoHTML}
          </div>

          <!-- Botões de Ação Imediata -->
          <div class="plan-manage-actions">
            <button class="btn btn-primary w-100" id="btnPayPlanNow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              ${status.type === 'active' ? 'Antecipar Débito / Renovar Mensalidade (R$ 16,99)' : 'Pagar Mensalidade Agora — R$ 16,99'}
            </button>
          </div>
        </div>

        <div class="plan-manage-footer">
          <div class="plan-manage-secure">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Cobrança processada com segurança pelo Mercado Pago · Sem carência ou fidelidade
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    // Ações do Cartão
    const btnChangeCard = document.getElementById('btnChangePlanCard');
    const btnAddCard = document.getElementById('btnAddPlanCard');
    if (btnChangeCard) {
      btnChangeCard.onclick = () => {
        closeModal();
        this.showCardRegistrationModal({ forTrial: false, onComplete: () => this.showManageModal() });
      };
    }
    if (btnAddCard) {
      btnAddCard.onclick = () => {
        closeModal();
        this.showCardRegistrationModal({ forTrial: false, onComplete: () => this.showManageModal() });
      };
    }

    // Pagar Agora
    const btnPayNow = document.getElementById('btnPayPlanNow');
    if (btnPayNow) {
      btnPayNow.onclick = () => {
        closeModal();
        this.showPlanPaymentModal('card');
      };
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Assinatura / Upgrade
  // ─────────────────────────────────────────────────────────────────────────
  showUpgradeModal() {
    if (!this.hasRegisteredCard()) {
      this.showCardRegistrationModal({ forTrial: true });
    } else {
      this.showManageModal();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Pagamento da Mensalidade (Cartão via Mercado Pago)
  // ─────────────────────────────────────────────────────────────────────────
  showPlanPaymentModal() {
    const existing = document.getElementById('planPaymentModalOverlay');
    if (existing) {
      if (existing.classList.contains('active')) return;
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'plan-payment-modal-overlay modal-overlay';
    overlay.id = 'planPaymentModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pagamento da Mensalidade Confeitex');

    overlay.innerHTML = `
      <div class="plan-payment-modal">
        <div class="plan-payment-header" style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 1rem; gap: 1rem;">
          <div>
            <h2 style="margin-bottom: 0.5rem; line-height: 1.2;">Mensalidade Confeitex Premium</h2>
            <p style="margin-bottom: 0;">Valor: <strong style="color:var(--color-success);font-size:1.15rem;">R$ 16,99 / mês</strong></p>
          </div>
        </div>

        <div class="plan-pay-body" id="planPayBody">
          <!-- Loading View -->
          <div class="plan-pay-loading" id="planPayLoading">
            <div class="plan-spinner"></div>
            <span id="planPayLoadingText">Processando pagamento no Mercado Pago...</span>
          </div>

          <!-- Card Panel -->
          <div class="plan-pay-panel" id="panelPayCard" style="display:none;">
            <div class="plan-card-charge-box">
              <p style="margin-bottom: 1.5rem;">Deseja efetuar o débito de <strong>R$ 16,99</strong> no seu cartão de crédito cadastrado?</p>
              <div id="planCardChargeDetails"></div>
              <button class="btn btn-primary w-100 mt-3" id="btnConfirmCardCharge" style="margin-top: 1rem; margin-bottom: 0.5rem;">
                Confirmar Débito de R$ 16,99 no Cartão
              </button>
              <button class="btn btn-secondary w-100 mt-2" id="btnUseAnotherCard" style="margin-top: 0.5rem;">
                Usar Outro Cartão
              </button>
            </div>
          </div>

          <!-- Success Panel -->
          <div class="plan-pay-panel" id="panelPaySuccess" style="display:none;">
            <div class="plan-success-box">
              <div class="plan-success-icon">🎉</div>
              <h3>Mensalidade Confirmada com Sucesso!</h3>
              <p>Sua assinatura do <strong>Confeitex Premium</strong> foi ativada/renovada por mais 30 dias.</p>
              <button class="btn btn-primary w-100 mt-3" id="btnPlanSuccessDone">Continuar</button>
            </div>
          </div>
        </div>

        <div class="plan-payment-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Pagamento 100% seguro via Mercado Pago
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    history.pushState({ planPaymentModalOpen: true }, '');
    const handlePopState = () => closeModal(true);
    window.addEventListener('popstate', handlePopState);

    const closeModal = (fromPopState = false) => {
      window.removeEventListener('popstate', handlePopState);
      if (!fromPopState) {
        history.back();
      }
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    this._loadPlanCardView(overlay, closeModal);
  },

  async _loadPlanCardView(overlay, closeModal) {
    const loading = overlay.querySelector('#planPayLoading');
    const panelCard = overlay.querySelector('#panelPayCard');
    const panelSuccess = overlay.querySelector('#panelPaySuccess');

    panelCard.style.display = 'none';
    panelSuccess.style.display = 'none';
    loading.style.display = 'flex';

    try {
      loading.style.display = 'none';
      panelCard.style.display = 'block';

      const card = this.getCardData();
      const details = overlay.querySelector('#planCardChargeDetails');
      if (details) {
        if (card) {
          details.innerHTML = `
            <div class="plan-saved-card-box" style="margin-top:0.75rem;">
              <div class="plan-saved-card-left">
                <div class="plan-saved-card-icon">💳</div>
                <div>
                  <strong>${(card.brand || 'Cartão').toUpperCase()} •••• ${card.lastFourDigits || '4242'}</strong>
                  <div class="plan-saved-card-holder">${card.cardholderName || 'Titular'}</div>
                </div>
              </div>
            </div>`;
        } else {
          details.innerHTML = `<div class="plan-clean-no-card" style="margin-bottom: 1rem;">Nenhum cartão cadastrado ainda.</div>`;
        }
      }

      const btnConfirm = overlay.querySelector('#btnConfirmCardCharge');
      const btnOther = overlay.querySelector('#btnUseAnotherCard');

      if (btnConfirm) {
        btnConfirm.onclick = async () => {
          if (!card) {
            this.showCardRegistrationModal({ forTrial: false });
            return;
          }
          btnConfirm.disabled = true;
          btnConfirm.innerHTML = '<span class="plan-spinner"></span> Processando cobrança...';

          try {
            const res = typeof MercadoPagoCheckout !== 'undefined'
              ? await MercadoPagoCheckout.processPlanPayment({
                  amount: this.PRICE_BRL,
                  payment_method_id: card.brand || 'credit_card',
                  token: card.token,
                  plan_name: this.PLAN_NAME,
                  payer_email: card.email || 'assinante@confeitex.app',
                  payer_name: card.cardholderName,
                })
              : { id: 'DEMO_' + Date.now(), status: 'approved' };

            if (res.status === 'approved') {
              this._onPlanPaymentApproved(res.id, 'card', overlay);
            } else {
              throw new Error('O pagamento com cartão foi recusado pela operadora.');
            }
          } catch (err) {
            UI.toast(err.message || 'Erro ao processar cartão.', 'danger');
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Confirmar Débito de R$ 16,99 no Cartão';
          }
        };
      }

      if (btnOther) {
        btnOther.onclick = () => {
          if (typeof closeModal === 'function') closeModal(false);
          this.showCardRegistrationModal({
            forTrial: false,
            onComplete: () => this.showPlanPaymentModal()
          });
        };
      }
    } catch (err) {
      console.error('[Plan Payment Load Error]', err);
      loading.style.display = 'none';
      UI.toast(err.message || 'Erro ao carregar método de pagamento.', 'danger');
    }
  },

  _onPlanPaymentApproved(paymentId, method, overlay) {
    this.activateSubscription(paymentId, 30, method);

    if (overlay) {
      const panels = overlay.querySelectorAll('.plan-pay-panel, .plan-pay-loading');
      panels.forEach(p => p.style.display = 'none');
      const success = overlay.querySelector('#panelPaySuccess');
      if (success) success.style.display = 'block';

      const btnDone = overlay.querySelector('#btnPlanSuccessDone');
      if (btnDone) {
        btnDone.onclick = () => {
          overlay.classList.remove('active');
          setTimeout(() => overlay.remove(), 350);
        };
      }
    }

    UI.toast('🎉 Mensalidade Confeitex renovada com sucesso!', 'success');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Paywall — bloqueio de funcionalidade premium
  // ─────────────────────────────────────────────────────────────────────────
  async showPaywall(featureName) {
    return new Promise(resolve => {
      const existing = document.getElementById('paywallOverlay');
      if (existing) {
        if (existing.classList.contains('active')) return resolve(false);
        existing.remove();
      }

      const overlay = document.createElement('div');
      overlay.className = 'paywall-overlay modal-overlay';
      overlay.id = 'paywallOverlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Recurso Premium');

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
            <p class="paywall-subtitle">${featureName} está disponível no plano pago.</p>
          </div>
          <div class="paywall-features">
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Pedidos e encomendas ilimitadas
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Relatórios financeiros completos
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Exportação PDF e backup completo
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Gestão de clientes ilimitada
            </div>
          </div>
          <div class="paywall-price">
            <div class="paywall-price-value">
              <span class="paywall-price-currency">R$</span>
              <span class="paywall-price-amount">16,99</span>
              <span class="paywall-price-period">/mês</span>
            </div>
            <p class="paywall-price-note">Débito automático no Cartão de Crédito · Sem fidelidade</p>
          </div>
          <button class="paywall-btn-upgrade" id="paywallBtnUpgrade">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ${this.hasRegisteredCard() ? 'Assinar / Renovar — R$ 16,99/mês' : 'Cadastrar Cartão & Começar 7 Dias Grátis'}
          </button>
          <button class="paywall-btn-cancel" id="paywallBtnCancel">Agora não</button>
        </div>`;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const close = (result) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 350);
        resolve(result);
      };

      document.getElementById('paywallBtnCancel').onclick = () => close(false);
      document.getElementById('paywallBtnUpgrade').onclick = () => {
        close(false);
        this.showUpgradeModal();
      };
    });
  }
};
