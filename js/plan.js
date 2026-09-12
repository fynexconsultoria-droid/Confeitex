/**
 * Plan.js — Sistema de Planos Confeitex integrado ao Mercado Pago
 * - Teste Grátis de 7 dias com cadastro obrigatório de Cartão de Crédito
 * - Mensalidade de R$9,99/mês
 * - Pagamento automático e renovação exclusiva no Cartão de Crédito cadastrado
 */

const Plan = {
  // ─── Configuração do Plano ────────────────────────────────────────────────
  TRIAL_DAYS: 7,
  PRICE_BRL: 9.99,
  ANNUAL_PRICE_BRL: 79.90, // Economia de 2 meses grátis
  PLAN_NAME: 'Confeitex Premium',
  CURRENCY: 'BRL',
  MAX_ORDERS_FREE: 20,

  // ─── Chaves localStorage ─────────────────────────────────────────────────
  KEY_TRIAL_START:    'confeitex_trial_start',
  KEY_SUB_ID:         'confeitex_sub_id',
  KEY_SUB_STATUS:     'confeitex_sub_status', // 'active' | 'expired' | 'canceled'
  KEY_SUB_EXPIRES:    'confeitex_sub_expires',
  KEY_SUB_CYCLE:      'confeitex_sub_cycle',   // 'monthly' | 'annual'
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
    if (cardData) {
      this.saveCardData(cardData);
    }
    safeStorage.set(this.KEY_TRIAL_START, new Date().toISOString());
    this.renderPlanBadge();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Validação de Documentos
  // ─────────────────────────────────────────────────────────────────────────
  isValidCPF(cpf) {
    if (!cpf) return false;
    const clean = String(cpf).replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;

    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean.charAt(i), 10) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(9), 10)) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(clean.charAt(i), 10) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(clean.charAt(10), 10)) return false;

    return true;
  },

  getTrialStart() {
    let v = safeStorage.get(this.KEY_TRIAL_START);
    if (!v) {
      v = new Date().toISOString();
      safeStorage.set(this.KEY_TRIAL_START, v);
    }
    return new Date(v);
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
  activateSubscription(subscriptionId, days = 30, method = 'card', cycle = 'monthly') {
    safeStorage.set(this.KEY_SUB_ID, subscriptionId || `SUB_${Date.now()}`);
    safeStorage.set(this.KEY_SUB_STATUS, 'active');
    safeStorage.set(this.KEY_PAYMENT_METHOD, method);
    safeStorage.set(this.KEY_SUB_CYCLE, cycle);

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
    const cycle = safeStorage.get(this.KEY_SUB_CYCLE) || 'monthly';
    const expiresAt = safeStorage.get(this.KEY_SUB_EXPIRES);
    const start = this.getTrialStart();

    if (this.isSubscriptionActive()) {
      let daysLeft = null;
      if (expiresAt) {
        const diff = new Date(expiresAt).getTime() - Date.now();
        daysLeft = Math.max(0, Math.ceil(diff / 86400000));
      }
      return {
        type: 'active',
        daysLeft,
        expiresAt,
        hasCard: this.hasRegisteredCard(),
        cycle,
      };
    }

    if (this.isTrialActive()) {
      const trialExpires = start
        ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
        : null;
      return {
        type: 'trial',
        daysLeft: this.getTrialDaysLeft(),
        expiresAt: trialExpires,
        hasCard: this.hasRegisteredCard(),
        cycle: 'monthly',
      };
    }

    const expiredDate = expiresAt || (start
      ? new Date(start.getTime() + this.TRIAL_DAYS * 86400000).toISOString()
      : null);

    return {
      type: 'expired',
      daysLeft: 0,
      expiresAt: expiredDate,
      hasCard: this.hasRegisteredCard(),
      cycle,
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
      const sub = status.hasCard ? 'Renovar por R$9,99/mês' : 'Ative 7 dias grátis';
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
            ${isForTrial ? '7 Dias Grátis · Ativação com Cartão' : 'Atualização de Cartão'}
          </div>
          <h2 class="plan-card-modal-title">${isForTrial ? 'Cadastre seu Cartão de Crédito' : 'Alterar Cartão Cadastrado'}</h2>
          <p class="plan-card-modal-subtitle">
            ${isForTrial 
              ? 'Para iniciar seu teste gratuito de 7 dias, cadastre seu cartão de crédito. <strong>Nenhum valor é cobrado hoje</strong> (débito automático de R$ 9,99/mês somente após os 7 dias).' 
              : 'Informe os novos dados do cartão para débito automático ou renovação da mensalidade.'}
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
                ? '<strong>Hoje: R$ 0,00</strong>. O teste de 7 dias é liberado somente com cartão cadastrado. Após os 7 dias, será realizado o débito automático da mensalidade de <strong>R$ 9,99/mês</strong>. Você pode cancelar a qualquer momento sem taxas.'
                : 'Seu cartão será validado com segurança e usado para o débito automático da mensalidade de R$ 9,99/mês.'}
            </div>
          </div>

          <div id="planCardError" class="plan-card-error-msg" style="display:none;"></div>

          <button type="submit" class="btn btn-primary plan-card-btn-submit" id="btnSubmitPlanCard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${isForTrial ? 'Cadastrar Cartão & Ativar 7 Dias Grátis' : 'Salvar Novo Cartão'}
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
      safeStorage.set('confeitex_trial_prompted', 'true');
      if (isForTrial && !this.hasRegisteredCard()) {
        UI.toast('💡 Teste de 7 dias grátis ativo! Cadastre seu cartão quando desejar pelo menu do plano.', 'info');
      }
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
      const yearNum = parseInt(expYear, 10);
      const fullYear = expYear.length === 2 ? 2000 + yearNum : yearNum;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      if (!expMonth || !expYear || monthNum < 1 || monthNum > 12) {
        errorEl.textContent = 'Informe uma data de validade válida (MM/AA).';
        errorEl.style.display = 'block';
        expiryInput.focus();
        return;
      }
      if (fullYear < currentYear || (fullYear === currentYear && monthNum < currentMonth)) {
        errorEl.textContent = 'Este cartão está expirado. Informe um cartão válido.';
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

      if (!this.isValidCPF(cpf)) {
        errorEl.textContent = 'CPF inválido. Por favor, verifique os dígitos digitados.';
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
        btnSubmit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ${isForTrial ? 'Cadastrar Cartão & Ativar 7 Dias Grátis' : 'Salvar Novo Cartão'}`;
      }
    };
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Efeito de Celebração de Confetes
  // ─────────────────────────────────────────────────────────────────────────
  _triggerConfetti() {
    try {
      const count = 40;
      const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
      for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'plan-confetti-particle';
        el.style.left = `${Math.random() * 100}vw`;
        el.style.top = '-10px';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.width = `${Math.random() * 8 + 6}px`;
        el.style.height = `${Math.random() * 8 + 6}px`;
        el.style.position = 'fixed';
        el.style.zIndex = '999999';
        el.style.pointerEvents = 'none';
        el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        el.style.transform = `rotate(${Math.random() * 360}deg)`;
        el.style.transition = `transform ${Math.random() * 2 + 1.5}s cubic-bezier(0.25, 1, 0.5, 1), top ${Math.random() * 2 + 1.5}s cubic-bezier(0.25, 1, 0.5, 1), opacity 2s ease-out`;
        document.body.appendChild(el);

        requestAnimationFrame(() => {
          el.style.top = `${Math.random() * 70 + 20}vh`;
          el.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 120 - 60}px)`;
          el.style.opacity = '0';
        });

        setTimeout(() => el.remove(), 2500);
      }
    } catch (e) {}
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal de Gerenciamento do Plano ("Meu Plano Confeitex")
  // ─────────────────────────────────────────────────────────────────────────
  showManageModal() {
    if (document.getElementById('planManageModalOverlay')) return;

    const status = this.getStatus();
    const card = this.getCardData();
    const isConfiguredMP = typeof MercadoPagoCheckout !== 'undefined' && MercadoPagoCheckout.isConfigured();

    const overlay = document.createElement('div');
    overlay.className = 'plan-manage-modal-overlay';
    overlay.id = 'planManageModalOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Gerenciamento do Plano Confeitex');

    // Cabeçalho de Status
    let statusHeaderHTML = '';
    let timelineHTML = '';
    const expDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : 'Auto-renovação';

    if (status.type === 'active') {
      const daysLeft = status.daysLeft !== null ? status.daysLeft : 30;
      const totalCycleDays = 30;
      const progressPercent = Math.min(100, Math.max(5, Math.round(((totalCycleDays - daysLeft) / totalCycleDays) * 100)));

      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--active">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div class="plan-status-title"><span class="plan-pulse-live"></span> Assinatura Premium Ativa</div>
            <div class="plan-status-sub">Vencimento: <strong>${expDate}</strong> · Plano Mensal (R$ 9,99/mês)</div>
          </div>
        </div>`;

      timelineHTML = `
        <div class="plan-timeline-box">
          <div class="plan-timeline-header">
            <span>Ciclo Mensal</span>
            <strong>${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}</strong>
          </div>
          <div class="plan-timeline-bar-bg">
            <div class="plan-timeline-bar-fill" style="width:${progressPercent}%;"></div>
          </div>
          <div class="plan-timeline-footer">
            <span>Início do ciclo</span>
            <span>Próxima renovação: ${expDate}</span>
          </div>
        </div>`;
    } else if (status.type === 'trial') {
      const d = status.daysLeft;
      const progressPercent = Math.min(100, Math.max(10, Math.round(((7 - d) / 7) * 100)));

      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--trial">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <div class="plan-status-title"><span class="plan-pulse-live"></span> Período de Testes: ${d} dia${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}</div>
            <div class="plan-status-sub">Vence em: <strong>${expDate}</strong> · Depois apenas R$ 9,99/mês (Débito automático no cartão)</div>
          </div>
        </div>`;

      timelineHTML = `
        <div class="plan-timeline-box">
          <div class="plan-timeline-header">
            <span>Progresso dos 7 Dias Grátis</span>
            <strong>${d} dias restantes</strong>
          </div>
          <div class="plan-timeline-bar-bg">
            <div class="plan-timeline-bar-fill" style="width:${progressPercent}%;"></div>
          </div>
          <div class="plan-timeline-footer">
            <span>Cadastro do Cartão ✓</span>
            <span>Primeira mensalidade: ${expDate}</span>
          </div>
        </div>`;
    } else {
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--expired">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Assinatura Pendente de Renovação</div>
            <div class="plan-status-sub">Renove agora para continuar criando pedidos e usando todos os recursos.</div>
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
          <button class="btn btn-secondary btn-sm" id="btnChangePlanCard">Trocar Cartão</button>
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
            Assinatura Confeitex Premium
          </h2>
          <button class="plan-manage-close" id="planManageClose" aria-label="Fechar">&times;</button>
        </div>

        <div class="plan-manage-body">
          ${statusHeaderHTML}
          ${timelineHTML}

          <!-- Plano Mensal (Sem plano anual) -->
          <div class="plan-section">
            <h3 class="plan-section-title">Plano Mensal Confeitex Premium</h3>
            <div class="plan-monthly-card">
              <div class="plan-monthly-info">
                <div class="plan-monthly-price">
                  <span class="plan-currency">R$</span>
                  <span class="plan-amount">9,99</span>
                  <span class="plan-period">/mês</span>
                </div>
                <div class="plan-monthly-tag">Débito Automático no Cartão</div>
              </div>
              <p class="plan-monthly-desc">
                Acesso completo e ilimitado a todos os recursos. Sem fidelidade, flexibilidade total para cancelar quando quiser.
              </p>
            </div>
          </div>

          <!-- Benefícios Inclusos -->
          <div class="plan-section">
            <h3 class="plan-section-title">Tudo incluso na sua assinatura</h3>
            <div class="plan-benefits-grid">
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Pedidos Ilimitados</span>
              </div>
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Relatórios de Lucro Real</span>
              </div>
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Alertas na Barra do Celular</span>
              </div>
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Backup Automático Nuvem</span>
              </div>
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Cobrança via WhatsApp</span>
              </div>
              <div class="plan-benefit-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Exportação em PDF</span>
              </div>
            </div>
          </div>

          <!-- Seção de Cartão de Crédito -->
          <div class="plan-section">
            <h3 class="plan-section-title">Forma de Cobrança Principal</h3>
            ${cardInfoHTML}
          </div>

          <!-- Ações de Renovação Imediata -->
          <div class="plan-manage-actions">
            <button class="btn btn-primary w-100 plan-btn-renew-card" id="btnPayPlanNow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span id="btnPayPlanNowText">Renovar com Cartão — R$ 9,99</span>
            </button>
          </div>
        </div>

        <div class="plan-manage-footer">
          <div class="plan-manage-secure">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Pagamento 100% criptografado e seguro · Mercado Pago · Cancele quando quiser
          </div>
          <div style="text-align:center;">
            <span class="plan-mp-status-pill ${isConfiguredMP ? 'connected' : 'demo'}">
              ${isConfiguredMP ? '● Mercado Pago Conectado' : '⚡ Modo Demonstração'}
            </span>
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

    // Pagar com Cartão
    const btnPayNow = document.getElementById('btnPayPlanNow');
    if (btnPayNow) {
      btnPayNow.onclick = () => {
        closeModal();
        this.showPlanPaymentModal();
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
  // Modal de Pagamento da Mensalidade (Cartão & Pix via Mercado Pago)
  // ─────────────────────────────────────────────────────────────────────────
  showPlanPaymentModal() {
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
            <h2>Renovação Confeitex Premium</h2>
            <p id="planPaymentSub">Pagamento seguro via Cartão de Crédito</p>
          </div>
          <button class="plan-payment-close" id="planPaymentClose" aria-label="Fechar">&times;</button>
        </div>

        <div class="plan-pay-body" id="planPayBody">
          <!-- Loading View -->
          <div class="plan-pay-loading" id="planPayLoading" style="display:none;">
            <div class="plan-spinner"></div>
            <span id="planPayLoadingText">Processando com segurança no Mercado Pago...</span>
          </div>

          <!-- Card Panel -->
          <div class="plan-pay-panel" id="panelPayCard" style="display:block;">
            <div class="plan-card-charge-box">
              <div class="plan-charge-summary">
                <span class="plan-charge-summary-title">Plano Mensal (30 Dias)</span>
                <span class="plan-charge-summary-price">R$ 9,99</span>
              </div>
              <div id="planCardChargeDetails"></div>
              <button class="btn btn-primary w-100 plan-btn-renew-card" id="btnConfirmCardCharge">
                <span id="btnConfirmCardText">Confirmar Cobrança de R$ 9,99</span>
              </button>
              <button class="btn btn-secondary w-100 mt-2" id="btnUseAnotherCard">
                Usar / Cadastrar Outro Cartão
              </button>
            </div>
          </div>

          <!-- Success Panel -->
          <div class="plan-pay-panel" id="panelPaySuccess" style="display:none;">
            <div class="plan-success-box">
              <div class="plan-success-icon">🎉</div>
              <h3>Assinatura Renovada com Sucesso!</h3>
              <p style="color:var(--text-secondary);font-size:0.9rem;line-height:1.5;">
                Seu plano <strong>Confeitex Premium</strong> está ativo e liberado com todas as ferramentas de produção, clientes e relatórios.
              </p>
              <div id="planSuccessValidity" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);padding:0.75rem;border-radius:12px;margin:1rem 0;color:#34d399;font-weight:600;font-size:0.85rem;"></div>
              <button class="btn btn-primary w-100 plan-btn-renew-card mt-2" id="btnPlanSuccessDone">Continuar no Confeitex</button>
            </div>
          </div>
        </div>

        <div class="plan-payment-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Cobrança segura via Cartão de Crédito · Mercado Pago · Cancele quando quiser
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    document.getElementById('planPaymentClose').onclick = closeModal;
    this._loadPlanCardView(overlay);
  },

  async _loadPlanCardView(overlay) {
    const card = this.getCardData();
    const details = overlay.querySelector('#planCardChargeDetails');
    const amount = this.PRICE_BRL;

    if (details) {
      if (card) {
        details.innerHTML = `
          <div class="plan-saved-card-box" style="margin-top:0.75rem;">
            <div class="plan-saved-card-left">
              <div class="plan-saved-card-icon">💳</div>
              <div>
                <strong>${(card.brand || 'Cartão').toUpperCase()} •••• ${card.lastFourDigits || '4242'}</strong>
                <div class="plan-saved-card-holder">${card.cardholderName || 'Titular'} · Validade: ${card.expirationMonth}/${card.expirationYear}</div>
              </div>
            </div>
          </div>`;
      } else {
        details.innerHTML = `<p style="color:var(--color-warning);font-size:0.85rem;margin-top:0.5rem;">Nenhum cartão cadastrado ainda. Clique abaixo para cadastrar.</p>`;
      }
    }

    const btnConfirm = overlay.querySelector('#btnConfirmCardCharge');
    const btnOther = overlay.querySelector('#btnUseAnotherCard');

    if (btnConfirm) {
      btnConfirm.onclick = async () => {
        if (!card) {
          this.showCardRegistrationModal({ forTrial: false, onComplete: () => this.showPlanPaymentModal() });
          return;
        }
        btnConfirm.disabled = true;
        btnConfirm.innerHTML = '<span class="plan-spinner"></span> Processando cobrança no Mercado Pago...';

        try {
          const res = typeof MercadoPagoCheckout !== 'undefined'
            ? await MercadoPagoCheckout.processPlanPayment({
                amount: amount,
                payment_method_id: card.brand || 'credit_card',
                token: card.token,
                plan_name: 'Confeitex Premium Mensal',
                payer_email: card.email || 'assinante@confeitex.app',
                payer_name: card.cardholderName,
              })
            : { id: 'DEMO_' + Date.now(), status: 'approved' };

          if (res.status === 'approved') {
            this._onPlanPaymentApproved(res.id, 'card', overlay, 30, 'monthly');
          } else {
            throw new Error('A cobrança do cartão não foi autorizada pela operadora.');
          }
        } catch (err) {
          UI.toast(err.message || 'Erro ao processar cartão.', 'danger');
          btnConfirm.disabled = false;
          btnConfirm.innerHTML = `<span>Confirmar Cobrança de R$ ${amount.toFixed(2).replace('.', ',')}</span>`;
        }
      };
    }

    if (btnOther) {
      btnOther.onclick = () => {
        const currentModal = document.getElementById('planPaymentModalOverlay');
        if (currentModal) currentModal.remove();
        this.showCardRegistrationModal({
          forTrial: false,
          onComplete: () => this.showPlanPaymentModal()
        });
      };
    }
  },

  _onPlanPaymentApproved(paymentId, method, overlay, days = 30, cycle = 'monthly') {
    this.activateSubscription(paymentId, days, 'card', 'monthly');
    this._triggerConfetti();

    if (overlay) {
      const panels = overlay.querySelectorAll('.plan-pay-panel, .plan-pay-loading');
      panels.forEach(p => p.style.display = 'none');
      const success = overlay.querySelector('#panelPaySuccess');
      if (success) success.style.display = 'block';

      const validityEl = overlay.querySelector('#planSuccessValidity');
      if (validityEl) {
        const expiresStr = safeStorage.get(this.KEY_SUB_EXPIRES);
        const expDate = expiresStr ? new Date(expiresStr).toLocaleDateString('pt-BR') : '';
        validityEl.innerHTML = `✓ Assinatura ativa até <strong>${expDate}</strong> (Plano Mensal)`;
      }

      const btnDone = overlay.querySelector('#btnPlanSuccessDone');
      if (btnDone) {
        btnDone.onclick = () => {
          overlay.classList.remove('active');
          setTimeout(() => overlay.remove(), 350);
        };
      }
    }

    UI.toast('🎉 Mensalidade Confeitex confirmada no cartão com sucesso!', 'success');
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
      overlay.setAttribute('aria-label', 'Recurso Premium Confeitex');

      overlay.innerHTML = `
        <div class="paywall-modal">
          <div class="paywall-header">
            <div class="paywall-lock-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <h2 class="paywall-title">Confeitex Premium</h2>
            <p class="paywall-subtitle">${featureName || 'Este recurso'} é exclusivo para assinantes Premium.</p>
          </div>
          <div class="paywall-features">
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Pedidos e encomendas 100% ilimitadas
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Relatórios financeiros com cálculo de lucro
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Notificações e lembretes na barra do celular
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Exportação em PDF e Backup em Nuvem
            </div>
          </div>
          <div class="paywall-price">
            <div class="paywall-price-value">
              <span class="paywall-price-currency">R$</span>
              <span class="paywall-price-amount">9,99</span>
              <span class="paywall-price-period">/mês</span>
            </div>
            <p class="paywall-price-note">Sem fidelidade · Débito automático e renovação via Cartão de Crédito</p>
          </div>
          <button class="paywall-btn-upgrade plan-btn-renew-card" id="paywallBtnUpgrade">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            ${this.hasRegisteredCard() ? 'Renovar com Cartão de Crédito' : 'Cadastrar Cartão & 7 Dias Grátis'}
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
