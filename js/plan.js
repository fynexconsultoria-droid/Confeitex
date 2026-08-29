/**
 * Plan.js — Sistema de Planos Confeitex integrado ao Mercado Pago
 * - Teste Grátis de 7 dias com cadastro obrigatório de Cartão de Crédito
 * - Mensalidade de R$7,99/mês
 * - Escolha de preferência no vencimento: Cobrança direta no Cartão, Pix ou Boleto
 */

const Plan = {
  // ─── Configuração do Plano ────────────────────────────────────────────────
  TRIAL_DAYS: 7,
  PRICE_BRL: 7.99,
  PLAN_NAME: 'Confeitex Premium',
  CURRENCY: 'BRL',
  MAX_ORDERS_FREE: 20,

  // ─── Chaves localStorage ─────────────────────────────────────────────────
  KEY_TRIAL_START:    'confeitex_trial_start',
  KEY_SUB_ID:         'confeitex_sub_id',
  KEY_SUB_STATUS:     'confeitex_sub_status', // 'active' | 'expired' | 'canceled'
  KEY_SUB_EXPIRES:    'confeitex_sub_expires',
  KEY_CARD_DATA:      'confeitex_plan_card',
  KEY_RENEWAL_PREF:   'confeitex_plan_renewal_pref', // 'card' | 'pix' | 'boleto'
  KEY_PAYMENT_METHOD: 'confeitex_plan_pay_method',

  // ─── Estado interno ───────────────────────────────────────────────────────
  _pixPollTimer: null,

  // ─────────────────────────────────────────────────────────────────────────
  // Inicialização
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    this.renderPlanBadge();
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
    safeStorage.set(this.KEY_CARD_DATA, JSON.stringify({
      lastFourDigits: cardData.lastFourDigits || '4242',
      cardholderName: cardData.cardholderName || '',
      expirationMonth: cardData.expirationMonth || '',
      expirationYear: cardData.expirationYear || '',
      brand: cardData.brand || 'credit_card',
      token: cardData.token || '',
      email: cardData.email || '',
      savedAt: new Date().toISOString(),
    }));
  },

  removeCardData() {
    safeStorage.remove(this.KEY_CARD_DATA);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Preferência de Pagamento no Vencimento (Cartão direto / Pix / Boleto)
  // ─────────────────────────────────────────────────────────────────────────
  getRenewalPreference() {
    return safeStorage.get(this.KEY_RENEWAL_PREF) || 'card';
  },

  setRenewalPreference(pref) {
    if (['card', 'pix', 'boleto'].includes(pref)) {
      safeStorage.set(this.KEY_RENEWAL_PREF, pref);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Período de Testes (Trial de 7 dias com Cartão Cadastrado)
  // ─────────────────────────────────────────────────────────────────────────
  startTrial(cardData) {
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
    if (!this.hasRegisteredCard()) return 0;
    const start = this.getTrialStart();
    if (!start) return 0;
    const elapsed = (Date.now() - start.getTime()) / 86400000;
    return Math.max(0, Math.ceil(this.TRIAL_DAYS - elapsed));
  },

  isTrialActive() {
    return this.hasRegisteredCard() && this.getTrialDaysLeft() > 0;
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

    if (this.isTrialActive()) {
      if (feature === 'unlimited_orders') {
        return (typeof State !== 'undefined' ? State.orders.length : 0) < this.MAX_ORDERS_FREE;
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
        <div class="plan-badge plan-badge--premium" id="planBadge" onclick="Plan.showManageModal()" title="Gerenciar Plano Confeitex">
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
        <div class="plan-badge ${urgency}" id="planBadge" onclick="Plan.showManageModal()" title="Gerenciar Teste Grátis">
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
      const label = status.hasCard ? 'Mensalidade Vencida' : 'Cadastre seu Cartão';
      const sub = status.hasCard ? 'Renovar por R$7,99/mês' : 'Ative 7 dias grátis';
      badgeHTML = `
        <div class="plan-badge plan-badge--expired" id="planBadge" onclick="Plan.showUpgradeModal()" title="Ativar Confeitex">
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
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Cadastro de Cartão de Crédito (Obrigatório para Teste ou Troca)
  // ─────────────────────────────────────────────────────────────────────────
  showCardRegistrationModal(options = {}) {
    const isForTrial = options.forTrial !== false;
    const onComplete = options.onComplete || null;

    if (document.getElementById('planCardModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'plan-card-modal-overlay';
    overlay.id = 'planCardModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isForTrial ? 'Cadastro de Cartão para Teste Grátis' : 'Atualizar Cartão de Crédito');

    overlay.innerHTML = `
      <div class="plan-card-modal">
        <button class="plan-card-modal-close" id="planCardModalClose" aria-label="Fechar">&times;</button>
        
        <div class="plan-card-modal-header">
          <div class="plan-card-badge-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${isForTrial ? '7 Dias Grátis · Sem Cobrança Hoje' : 'Atualização de Cartão'}
          </div>
          <h2 class="plan-card-modal-title">${isForTrial ? 'Cadastre seu Cartão de Crédito' : 'Alterar Cartão Cadastrado'}</h2>
          <p class="plan-card-modal-subtitle">
            ${isForTrial 
              ? 'Para iniciar seu teste gratuito de 7 dias, cadastre seu cartão de crédito. <strong>Nenhum valor será cobrado hoje</strong>.' 
              : 'Informe os novos dados do cartão para cobrança automática ou renovação da mensalidade.'}
          </p>
        </div>

        <!-- Visual Interativo do Cartão -->
        <div class="interactive-card-preview" id="cardVisualPreview">
          <div class="interactive-card-inner">
            <div class="card-preview-chip"></div>
            <div class="card-preview-brand" id="cardPreviewBrand">CONFEITEX</div>
            <div class="card-preview-number" id="cardPreviewNumber">•••• •••• •••• ••••</div>
            <div class="card-preview-bottom">
              <div class="card-preview-holder">
                <span class="card-preview-lbl">TITULAR</span>
                <span class="card-preview-val" id="cardPreviewHolder">NOME NO CARTÃO</span>
              </div>
              <div class="card-preview-expiry">
                <span class="card-preview-lbl">VALIDADE</span>
                <span class="card-preview-val" id="cardPreviewExpiry">MM/AA</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Formulário Seguro do Cartão -->
        <form class="plan-card-form" id="planCardForm" onsubmit="return false;">
          <div class="form-group">
            <label for="planCardNumber">Número do Cartão de Crédito</label>
            <div class="plan-input-icon-wrap">
              <input type="text" class="form-control" id="planCardNumber" placeholder="0000 0000 0000 0000" maxlength="19" inputmode="numeric" autocomplete="cc-number" required />
              <div class="plan-card-detected-brand" id="detectedBrandIcon">💳</div>
            </div>
          </div>

          <div class="form-group">
            <label for="planCardHolder">Nome impresso no Cartão</label>
            <input type="text" class="form-control" id="planCardHolder" placeholder="Ex: MARIA S SILVA" autocomplete="cc-name" required />
          </div>

          <div class="form-row" style="display:flex;gap:0.75rem;">
            <div class="form-group" style="flex:1;">
              <label for="planCardExpiry">Validade</label>
              <input type="text" class="form-control" id="planCardExpiry" placeholder="MM/AA" maxlength="5" inputmode="numeric" autocomplete="cc-exp" required />
            </div>
            <div class="form-group" style="flex:1;">
              <label for="planCardCvv">CVV</label>
              <input type="password" class="form-control" id="planCardCvv" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="cc-csc" required />
            </div>
          </div>

          <div class="form-row" style="display:flex;gap:0.75rem;">
            <div class="form-group" style="flex:1.2;">
              <label for="planCardCpf">CPF do Titular</label>
              <input type="text" class="form-control" id="planCardCpf" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" required />
            </div>
            <div class="form-group" style="flex:1.8;">
              <label for="planCardEmail">E-mail para Recibo</label>
              <input type="email" class="form-control" id="planCardEmail" placeholder="seu@email.com" autocomplete="email" required />
            </div>
          </div>

          <div class="plan-card-trial-terms">
            <div class="plan-terms-icon">✓</div>
            <div class="plan-terms-text">
              ${isForTrial
                ? '<strong>Hoje: R$ 0,00</strong>. Após 7 dias de teste grátis, o plano será de apenas <strong>R$ 7,99/mês</strong>. Você poderá cancelar a qualquer momento ou alterar para pagamento via Pix/Boleto.'
                : 'Seu cartão será validado com segurança e usado conforme a sua preferência de pagamento.'}
            </div>
          </div>

          <div id="planCardError" class="plan-card-error-msg" style="display:none;"></div>

          <button type="submit" class="btn btn-primary plan-card-btn-submit" id="btnSubmitPlanCard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${isForTrial ? 'Cadastrar Cartão & Começar 7 Dias Grátis' : 'Salvar Novo Cartão'}
          </button>
        </form>

        <div class="plan-card-security-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Dados protegidos com criptografia de ponta a ponta via Mercado Pago
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Mascaras e Live Preview
    const numInput = document.getElementById('planCardNumber');
    const holderInput = document.getElementById('planCardHolder');
    const expiryInput = document.getElementById('planCardExpiry');
    const cvvInput = document.getElementById('planCardCvv');
    const cpfInput = document.getElementById('planCardCpf');
    const emailInput = document.getElementById('planCardEmail');
    const errorEl = document.getElementById('planCardError');
    const btnSubmit = document.getElementById('btnSubmitPlanCard');

    // Recupera dados salvos previamente se existirem
    const existingCard = this.getCardData();
    if (existingCard && !isForTrial) {
      if (existingCard.cardholderName) holderInput.value = existingCard.cardholderName;
      if (existingCard.email) emailInput.value = existingCard.email;
    }

    // Formatação do Número do Cartão
    numInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
      e.target.value = v;

      const previewNum = document.getElementById('cardPreviewNumber');
      if (previewNum) previewNum.textContent = v || '•••• •••• •••• ••••';

      const brand = typeof MercadoPagoCheckout !== 'undefined' ? MercadoPagoCheckout.detectCardBrand(v) : 'credit_card';
      const brandPreview = document.getElementById('cardPreviewBrand');
      const detectedBrand = document.getElementById('detectedBrandIcon');
      
      const brandNames = { visa: 'VISA', mastercard: 'MASTERCARD', elo: 'ELO', amex: 'AMEX', hipercard: 'HIPERCARD', credit_card: 'CONFEITEX' };
      const brandIcons = { visa: '💳 Visa', mastercard: '💳 Mastercard', elo: '💳 Elo', amex: '💳 Amex', hipercard: '💳 Hipercard', credit_card: '💳' };
      
      if (brandPreview) brandPreview.textContent = brandNames[brand] || 'CONFEITEX';
      if (detectedBrand) detectedBrand.textContent = brandIcons[brand] || '💳';
    });

    // Titular
    holderInput.addEventListener('input', e => {
      const v = e.target.value.toUpperCase();
      e.target.value = v;
      const previewHolder = document.getElementById('cardPreviewHolder');
      if (previewHolder) previewHolder.textContent = v || 'NOME NO CARTÃO';
    });

    // Validade MM/AA
    expiryInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) {
        v = `${v.slice(0, 2)}/${v.slice(2)}`;
      }
      e.target.value = v;
      const previewExpiry = document.getElementById('cardPreviewExpiry');
      if (previewExpiry) previewExpiry.textContent = v || 'MM/AA';
    });

    // CPF
    cpfInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      v = v.replace(/(\d{3})(\d)/, '$1.$2')
           .replace(/(\d{3})(\d)/, '$1.$2')
           .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      e.target.value = v;
    });

    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    document.getElementById('planCardModalClose').onclick = closeModal;

    // Submissão do Formulário
    btnSubmit.onclick = async () => {
      errorEl.style.display = 'none';

      const rawNum = numInput.value.replace(/\D/g, '');
      const holder = holderInput.value.trim();
      const expiry = expiryInput.value.trim();
      const cvv = cvvInput.value.trim();
      const cpf = cpfInput.value.replace(/\D/g, '');
      const email = emailInput.value.trim();

      // Validações
      if (rawNum.length < 13 || rawNum.length > 19) {
        errorEl.textContent = 'Por favor, informe um número de cartão válido.';
        errorEl.style.display = 'block';
        numInput.focus();
        return;
      }

      if (holder.length < 3 || !holder.includes(' ')) {
        errorEl.textContent = 'Informe o nome completo impresso no cartão (Nome e Sobrenome).';
        errorEl.style.display = 'block';
        holderInput.focus();
        return;
      }

      const [expMonth, expYear] = expiry.split('/');
      const monthNum = parseInt(expMonth, 10);
      if (!expMonth || !expYear || monthNum < 1 || monthNum > 12) {
        errorEl.textContent = 'Informe uma data de validade válida (MM/AA).';
        errorEl.style.display = 'block';
        expiryInput.focus();
        return;
      }

      if (cvv.length < 3) {
        errorEl.textContent = 'Informe o código CVV de segurança (3 ou 4 dígitos).';
        errorEl.style.display = 'block';
        cvvInput.focus();
        return;
      }

      if (cpf.length !== 11) {
        errorEl.textContent = 'Informe um CPF válido com 11 dígitos.';
        errorEl.style.display = 'block';
        cpfInput.focus();
        return;
      }

      if (!email || !email.includes('@')) {
        errorEl.textContent = 'Informe um e-mail válido para recebimento de comprovantes.';
        errorEl.style.display = 'block';
        emailInput.focus();
        return;
      }

      // Estado de Carregamento
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="plan-spinner"></span> Validando cartão no Mercado Pago...';

      try {
        const cardPayload = {
          cardNumber: rawNum,
          cardholderName: holder,
          cardExpirationMonth: expMonth,
          cardExpirationYear: expYear.length === 2 ? `20${expYear}` : expYear,
          securityCode: cvv,
          email: email,
          identification: {
            type: 'CPF',
            number: cpf,
          }
        };

        let result;
        if (typeof MercadoPagoCheckout !== 'undefined') {
          result = await MercadoPagoCheckout.validateCardForTrial(cardPayload);
        } else {
          result = {
            valid: true,
            token: 'TOKEN_FALLBACK_' + Date.now(),
            lastFourDigits: rawNum.slice(-4),
            cardholderName: holder,
            expirationMonth: expMonth,
            expirationYear: expYear,
            brand: 'credit_card',
          };
        }

        // Salva dados do cartão
        this.saveCardData({
          lastFourDigits: result.lastFourDigits || rawNum.slice(-4),
          cardholderName: holder,
          expirationMonth: expMonth,
          expirationYear: expYear,
          brand: result.brand || (typeof MercadoPagoCheckout !== 'undefined' ? MercadoPagoCheckout.detectCardBrand(rawNum) : 'credit_card'),
          token: result.token,
          email: email,
        });

        // Se for para o Trial, inicia a contagem de 7 dias
        if (isForTrial) {
          this.startTrial();
          UI.toast('🎉 Cartão cadastrado com sucesso! Seu teste de 7 dias grátis começou.', 'success');
        } else {
          UI.toast('✅ Cartão de crédito atualizado com sucesso!', 'success');
        }

        this.renderPlanBadge();
        closeModal();

        if (typeof onComplete === 'function') {
          onComplete(result);
        }
      } catch (err) {
        console.error('[Plan Card Registration Error]', err);
        errorEl.textContent = err.message || 'Erro ao validar cartão no Mercado Pago. Verifique os dados e tente novamente.';
        errorEl.style.display = 'block';
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ${isForTrial ? 'Cadastrar Cartão & Começar 7 Dias Grátis' : 'Salvar Novo Cartão'}`;
      }
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Gerenciamento do Plano ("Meu Plano Confeitex")
  // ─────────────────────────────────────────────────────────────────────────
  showManageModal() {
    if (document.getElementById('planManageModalOverlay')) return;

    const status = this.getStatus();
    const card = this.getCardData();
    const renewalPref = this.getRenewalPreference();

    const overlay = document.createElement('div');
    overlay.className = 'plan-manage-modal-overlay';
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
            <div class="plan-status-sub">Próximo vencimento: <strong>${expDate}</strong> · R$ 7,99/mês</div>
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
            <div class="plan-status-sub">Vence em: <strong>${expDate}</strong> · Depois R$ 7,99/mês</div>
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
            <div class="plan-status-sub">Regularize o pagamento para continuar usando todas as funções.</div>
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
          <button class="plan-manage-close" id="planManageClose">&times;</button>
        </div>

        <div class="plan-manage-body">
          ${statusHeaderHTML}

          <!-- Seção de Cartão de Crédito -->
          <div class="plan-section">
            <h3 class="plan-section-title">Cartão de Crédito Cadastrado</h3>
            ${cardInfoHTML}
          </div>

          <!-- Seção de Preferência de Pagamento no Vencimento -->
          <div class="plan-section">
            <h3 class="plan-section-title">Quando a mensalidade vencer, como prefere pagar?</h3>
            <p class="plan-section-desc">Escolha sua forma favorita de pagamento da renovação (R$ 7,99/mês):</p>
            
            <div class="plan-renewal-options">
              <label class="plan-renewal-option ${renewalPref === 'card' ? 'selected' : ''}" id="optRenewalCard">
                <input type="radio" name="planRenewalPref" value="card" ${renewalPref === 'card' ? 'checked' : ''} />
                <div class="plan-renewal-opt-icon">💳</div>
                <div class="plan-renewal-opt-info">
                  <strong>Cobrança Automática no Cartão</strong>
                  <span>Debita direto no cartão cadastrado todo mês. Mais praticidade sem risco de esquecer.</span>
                </div>
              </label>

              <label class="plan-renewal-option ${renewalPref === 'pix' ? 'selected' : ''}" id="optRenewalPix">
                <input type="radio" name="planRenewalPref" value="pix" ${renewalPref === 'pix' ? 'checked' : ''} />
                <div class="plan-renewal-opt-icon">⚡</div>
                <div class="plan-renewal-opt-info">
                  <strong>Pagar via Pix no Vencimento</strong>
                  <span>Gera QR Code e código Copia e Cola instantâneo para pagar quando vencer.</span>
                </div>
              </label>

              <label class="plan-renewal-option ${renewalPref === 'boleto' ? 'selected' : ''}" id="optRenewalBoleto">
                <input type="radio" name="planRenewalPref" value="boleto" ${renewalPref === 'boleto' ? 'checked' : ''} />
                <div class="plan-renewal-opt-icon">📄</div>
                <div class="plan-renewal-opt-info">
                  <strong>Pagar via Boleto Bancário</strong>
                  <span>Gera boleto para pagamento em lotéricas ou internet banking.</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Botões de Ação Imediata -->
          <div class="plan-manage-actions">
            <button class="btn btn-primary w-100" id="btnPayPlanNow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              ${status.type === 'active' ? 'Pagar / Antecipar Próxima Mensalidade (R$ 7,99)' : 'Pagar Mensalidade Agora — R$ 7,99'}
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

    document.getElementById('planManageClose').onclick = closeModal;

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

    // Mudança de Preferência de Vencimento
    const radios = overlay.querySelectorAll('input[name="planRenewalPref"]');
    radios.forEach(radio => {
      radio.addEventListener('change', e => {
        const val = e.target.value;
        this.setRenewalPreference(val);
        overlay.querySelectorAll('.plan-renewal-option').forEach(el => el.classList.remove('selected'));
        const parentOpt = radio.closest('.plan-renewal-option');
        if (parentOpt) parentOpt.classList.add('selected');
        
        const labels = { card: 'Cartão de Crédito Automático', pix: 'Pix no Vencimento', boleto: 'Boleto Bancário' };
        UI.toast(`Preferência de pagamento atualizada para: ${labels[val]}`, 'info');
      });
    });

    // Pagar Agora
    const btnPayNow = document.getElementById('btnPayPlanNow');
    if (btnPayNow) {
      btnPayNow.onclick = () => {
        closeModal();
        this.showPlanPaymentModal(this.getRenewalPreference());
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
  // Modal de Pagamento da Mensalidade (Pix / Cartão / Boleto via Mercado Pago)
  // ─────────────────────────────────────────────────────────────────────────
  showPlanPaymentModal(initialMethod = 'pix') {
    if (document.getElementById('planPaymentModalOverlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'plan-payment-modal-overlay';
    overlay.id = 'planPaymentModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Pagamento da Mensalidade Confeitex');

    overlay.innerHTML = `
      <div class="plan-payment-modal">
        <div class="plan-payment-header">
          <div>
            <h2>Mensalidade Confeitex Premium</h2>
            <p>Valor: <strong style="color:var(--color-success);font-size:1.1rem;">R$ 7,99 / mês</strong></p>
          </div>
          <button class="plan-payment-close" id="planPaymentClose">&times;</button>
        </div>

        <!-- Abas de Pagamento -->
        <div class="plan-pay-tabs">
          <button class="plan-pay-tab ${initialMethod === 'pix' ? 'active' : ''}" id="tabPayPix" data-method="pix">
            ⚡ Pix Instantâneo
          </button>
          <button class="plan-pay-tab ${initialMethod === 'card' ? 'active' : ''}" id="tabPayCard" data-method="card">
            💳 Cartão de Crédito
          </button>
          <button class="plan-pay-tab ${initialMethod === 'boleto' ? 'active' : ''}" id="tabPayBoleto" data-method="boleto">
            📄 Boleto Bancário
          </button>
        </div>

        <div class="plan-pay-body" id="planPayBody">
          <!-- Loading View -->
          <div class="plan-pay-loading" id="planPayLoading">
            <div class="plan-spinner"></div>
            <span id="planPayLoadingText">Gerando cobrança segura no Mercado Pago...</span>
          </div>

          <!-- Pix Panel -->
          <div class="plan-pay-panel" id="panelPayPix" style="display:none;">
            <div class="plan-pix-box">
              <div class="plan-pix-qr-wrap">
                <img id="planPixQrImg" class="plan-pix-qr-img" alt="QR Code Pix Confeitex" style="display:none;" />
              </div>
              <p style="font-size:0.85rem;color:var(--text-secondary);text-align:center;">
                Escaneie o QR Code no app do seu banco ou copie o código Pix abaixo:
              </p>
              <div class="plan-pix-code-row">
                <input type="text" class="form-control" id="planPixCodeInput" readonly />
                <button class="btn btn-primary" id="btnCopyPlanPixCode">Copiar Código</button>
              </div>
              <div class="plan-pix-awaiting">
                <div class="plan-pulse-dot"></div>
                <span>Aguardando confirmação do pagamento Pix...</span>
                <button class="btn btn-secondary btn-sm" id="btnCheckPlanPixStatus">Verificar Agora</button>
              </div>
            </div>
          </div>

          <!-- Card Panel -->
          <div class="plan-pay-panel" id="panelPayCard" style="display:none;">
            <div class="plan-card-charge-box">
              <p>Deseja efetuar a cobrança de <strong>R$ 7,99</strong> no seu cartão de crédito cadastrado?</p>
              <div id="planCardChargeDetails"></div>
              <button class="btn btn-primary w-100 mt-3" id="btnConfirmCardCharge">
                Cobrar R$ 7,99 no Cartão
              </button>
              <button class="btn btn-secondary w-100 mt-2" id="btnUseAnotherCard">
                Usar Outro Cartão
              </button>
            </div>
          </div>

          <!-- Boleto Panel -->
          <div class="plan-pay-panel" id="panelPayBoleto" style="display:none;">
            <div class="plan-boleto-box">
              <p>O boleto bancário de <strong>R$ 7,99</strong> foi gerado com sucesso pelo Mercado Pago.</p>
              <div class="plan-boleto-actions">
                <a href="#" target="_blank" class="btn btn-primary w-100" id="btnOpenPlanBoleto">
                  Visualizar / Imprimir Boleto
                </a>
              </div>
              <small style="color:var(--text-muted);display:block;margin-top:0.75rem;text-align:center;">
                A compensação do boleto pode levar de 1 a 2 dias úteis.
              </small>
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

    const closeModal = () => {
      this._stopPixPolling();
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    document.getElementById('planPaymentClose').onclick = closeModal;

    // Abas
    const tabs = overlay.querySelectorAll('.plan-pay-tab');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._loadPlanMethodView(tab.dataset.method, overlay);
      };
    });

    this._loadPlanMethodView(initialMethod, overlay);
  },

  async _loadPlanMethodView(method, overlay) {
    const loading = overlay.querySelector('#planPayLoading');
    const panelPix = overlay.querySelector('#panelPayPix');
    const panelCard = overlay.querySelector('#panelPayCard');
    const panelBoleto = overlay.querySelector('#panelPayBoleto');
    const panelSuccess = overlay.querySelector('#panelPaySuccess');

    panelPix.style.display = 'none';
    panelCard.style.display = 'none';
    panelBoleto.style.display = 'none';
    panelSuccess.style.display = 'none';
    loading.style.display = 'flex';

    this._stopPixPolling();

    try {
      if (method === 'pix') {
        const card = this.getCardData();
        const res = typeof MercadoPagoCheckout !== 'undefined'
          ? await MercadoPagoCheckout.processPlanPayment({
              amount: this.PRICE_BRL,
              payment_method_id: 'pix',
              plan_name: this.PLAN_NAME,
              payer_email: card?.email || 'assinante@confeitex.app',
              payer_name: card?.cardholderName || 'Assinante Confeitex',
            })
          : { id: 'DEMO_' + Date.now(), status: 'pending', qr_code: 'demo-pix-code', qr_code_base64: null };

        loading.style.display = 'none';
        panelPix.style.display = 'block';

        const qrImg = overlay.querySelector('#planPixQrImg');
        const codeInput = overlay.querySelector('#planPixCodeInput');
        const btnCopy = overlay.querySelector('#btnCopyPlanPixCode');
        const btnCheck = overlay.querySelector('#btnCheckPlanPixStatus');

        if (res.qr_code_base64 && qrImg) {
          qrImg.src = `data:image/png;base64,${res.qr_code_base64}`;
          qrImg.style.display = 'block';
        } else if (qrImg) {
          qrImg.style.display = 'none';
        }

        if (codeInput) codeInput.value = res.qr_code || '00020126580014br.gov.bcb.pix0136confeitex-demo-pix5204000053039865407.995802BR5915Confeitex App';

        if (btnCopy) {
          btnCopy.onclick = async () => {
            if (codeInput) {
              try {
                await navigator.clipboard.writeText(codeInput.value);
                UI.toast('Código Pix Copiado com sucesso!', 'success');
              } catch {
                codeInput.select();
                document.execCommand('copy');
                UI.toast('Código Pix Copiado!', 'success');
              }
            }
          };
        }

        if (btnCheck) {
          btnCheck.onclick = async () => {
            const status = typeof MercadoPagoCheckout !== 'undefined'
              ? await MercadoPagoCheckout.checkPaymentStatus(res.id, false)
              : 'approved';

            if (status === 'approved') {
              this._onPlanPaymentApproved(res.id, 'pix', overlay);
            } else {
              UI.toast('Pagamento Pix ainda pendente. Aguardando banco...', 'info');
            }
          };
        }

        // Inicia polling para detectar pagamento automático do Pix
        this._startPixPolling(res.id, overlay);

      } else if (method === 'card') {
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
            details.innerHTML = `<p style="color:var(--color-warning);">Nenhum cartão cadastrado ainda.</p>`;
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
              btnConfirm.innerHTML = 'Cobrar R$ 7,99 no Cartão';
            }
          };
        }

        if (btnOther) {
          btnOther.onclick = () => {
            const currentModal = document.getElementById('planPaymentModalOverlay');
            if (currentModal) currentModal.remove();
            this.showCardRegistrationModal({
              forTrial: false,
              onComplete: () => this.showPlanPaymentModal('card')
            });
          };
        }

      } else if (method === 'boleto') {
        const card = this.getCardData();
        const res = typeof MercadoPagoCheckout !== 'undefined'
          ? await MercadoPagoCheckout.processPlanPayment({
              amount: this.PRICE_BRL,
              payment_method_id: 'bolbradesco',
              plan_name: this.PLAN_NAME,
              payer_email: card?.email || 'assinante@confeitex.app',
              payer_name: card?.cardholderName || 'Assinante Confeitex',
            })
          : { id: 'DEMO_BOL_' + Date.now(), ticket_url: 'https://confeitex.app/boleto' };

        loading.style.display = 'none';
        panelBoleto.style.display = 'block';

        const btnBoleto = overlay.querySelector('#btnOpenPlanBoleto');
        if (btnBoleto && res.ticket_url) {
          btnBoleto.href = res.ticket_url;
        }
      }
    } catch (err) {
      console.error('[Plan Payment Load Error]', err);
      loading.style.display = 'none';
      UI.toast(err.message || 'Erro ao carregar método de pagamento.', 'danger');
    }
  },

  _startPixPolling(paymentId, overlay) {
    this._stopPixPolling();
    let attempts = 0;
    this._pixPollTimer = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        this._stopPixPolling();
        return;
      }
      if (typeof MercadoPagoCheckout !== 'undefined') {
        const status = await MercadoPagoCheckout.checkPaymentStatus(paymentId, false);
        if (status === 'approved') {
          this._stopPixPolling();
          this._onPlanPaymentApproved(paymentId, 'pix', overlay);
        }
      }
    }, 5000);
  },

  _stopPixPolling() {
    if (this._pixPollTimer) {
      clearInterval(this._pixPollTimer);
      this._pixPollTimer = null;
    }
  },

  _onPlanPaymentApproved(paymentId, method, overlay) {
    this._stopPixPolling();
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
      const overlay = document.createElement('div');
      overlay.className = 'paywall-overlay';
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
              <span class="paywall-price-amount">7,99</span>
              <span class="paywall-price-period">/mês</span>
            </div>
            <p class="paywall-price-note">Sem fidelidade · Pague com Cartão, Pix ou Boleto</p>
          </div>
          <button class="paywall-btn-upgrade" id="paywallBtnUpgrade">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ${this.hasRegisteredCard() ? 'Assinar / Renovar — R$7,99/mês' : 'Cadastrar Cartão & Começar 7 Dias Grátis'}
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
