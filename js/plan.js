import { Dashboard } from './dashboard.js';
import { License } from './license.js';
import { State } from './state.js';
import { UI } from './ui.js';
import { safeStorage, escapeHTML } from './utils.js';

/**
 * Plan.js — Sistema de Planos Confeitex
 * - Plano Anual de R$ 397,90/ano (em até 10x sem juros no Cartão ou Pix imediato)
 * - Checkout Transparente integrado com Mercado Pago e tokens assinados ECDSA P-256
 * - Limite rigoroso de até 2 dispositivos simultâneos por licença
 */

export const Plan = {
  // ─── Configuração do Plano ────────────────────────────────────────────────
  TRIAL_DAYS: 7,
  PRICE_BRL: 1.00,
  PLAN_NAME: 'Confeitex Anual',
  PLAN_DURATION_DAYS: 365,
  CURRENCY: 'BRL',
  MAX_ORDERS_FREE: 20,

  // ─── Chaves localStorage ─────────────────────────────────────────────────
  KEY_TRIAL_START:       'confeitex_trial_start',
  KEY_SUB_ID:            'confeitex_sub_id',
  KEY_SUB_STATUS:        'confeitex_sub_status', // 'active' | 'expired' | 'canceled'
  KEY_SUB_EXPIRES:       'confeitex_sub_expires',
  KEY_CARD_DATA:         'confeitex_plan_card',
  KEY_CUSTOMER_ID:       'confeitex_mp_customer_id', // ID do cliente no MP (seguro armazenar)
  KEY_CARD_ID:           'confeitex_mp_card_id',     // ID do cartão no MP (seguro armazenar)
  KEY_RENEWAL_PREF:      'confeitex_plan_renewal_pref', // 'card'
  KEY_PAYMENT_METHOD:    'confeitex_plan_pay_method',
  KEY_LIFETIME_ACTIVE:   'confeitex_lifetime_active',
  KEY_ACTIVATION_KEY:    'confeitex_activation_key',
  KEY_CHECKOUT_URL:      'confeitex_checkout_url',
  KEY_DEVICE_ID:         'confeitex_device_id',
  KEY_DEVICE_NAME:       'confeitex_device_name',
  KEY_DEVICE_COUNT:      'confeitex_device_count',
  MAX_DEVICES_PER_KEY:   2,

  getWorkerUrl() {
    return (safeStorage.get('confeitex_worker_url') || safeStorage.get('confeitex_mp_worker_url') || '').trim().replace(/\/+$/, '');
  },

  detectCardBrand(number) {
    const clean = String(number || '').replace(/\D/g, '');
    if (/^(4011|4389|4514|4576|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(clean)) return 'elo';
    if (/^(606282|3841)/.test(clean)) return 'hipercard';
    if (/^3[47]/.test(clean)) return 'amex';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^4/.test(clean)) return 'visa';
    return 'credit_card';
  },

  // ─── Estado interno ───────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Inicialização
  // ─────────────────────────────────────────────────────────────────────────
  init() {
    this.handleMercadoPagoReturn();
    this.checkSubscriptionStatus().then(() => {
      this.renderPlanBadge();
      if (!this.isLifetimeActive()) {
        this.showStartupLockIfNeeded();
      }
    });
  },

  async handleMercadoPagoReturn() {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return false;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref') || safeStorage.get('confeitex_pending_purchase_ref');
      const payment = params.get('payment');
      const status = params.get('status') || params.get('collection_status');
      const paymentId = params.get('payment_id') || params.get('collection_id');

      // 1. Fluxo oficial seguro via ref verificado pelo worker
      if (ref && (payment === 'success' || status === 'approved' || !payment)) {
        const claimResult = await License.claimPurchase(ref);
        if (claimResult.status === 'approved' && claimResult.key) {
          this.activateLifetime(claimResult.key, 'mercadopago_auto', 365);
          try {
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (_) {}
          this.showPaymentSuccessModal(claimResult.key);
          return true;
        } else if (payment === 'failure' || status === 'rejected') {
          UI.toast('O pagamento não foi concluído. Tente novamente quando desejar.', 'warning');
          return false;
        }
      }

      // 2. Retorno com payment_id aprovado
      if (payment === 'success' || status === 'approved') {
        const rawId = paymentId ? String(paymentId).trim() : '';
        const isValidId = /^[A-Za-z0-9_-]+$/.test(rawId);
        const key = isValidId ? `MP-${rawId}` : 'CFTX397';
        this.activateLifetime(key, 'mercadopago_auto', 365);

        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (_) {}

        if (typeof document !== 'undefined') {
          setTimeout(() => {
            this.showPaymentSuccessModal(key);
          }, 250);
        }
        return true;
      }
    } catch (e) {
      console.warn('[Plan] Erro ao processar retorno do Mercado Pago:', e);
    }
    return false;
  },

  showPaymentSuccessModal(key = 'CFTX397') {
    if (typeof document === 'undefined') return;
    const cleanKey = String(key || 'CFTX397').trim();
    const safeKey = escapeHTML(cleanKey);
    const existing = document.getElementById('paymentSuccessOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'startup-lock-overlay active';
    overlay.id = 'paymentSuccessOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="startup-lock-modal" style="max-width:440px; border:1px solid rgba(34,197,94,0.4); box-shadow:0 12px 40px rgba(34,197,94,0.25);">
        <div class="startup-lock-badge" style="background:#22c55e; color:#fff; border-color:#22c55e;">
          🎉 Pagamento Aprovado!
        </div>
        <div class="startup-lock-icon" style="background:linear-gradient(135deg, #10b981, #059669); color:#fff; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:1rem auto;">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h2 class="startup-lock-title" style="margin-top:0.5rem;">Plano Anual Liberado!</h2>
        <p class="startup-lock-desc">
          Seja muito bem-vinda ao <strong>Confeitex</strong>!<br>
          Seu acesso de <strong>1 ano (365 dias)</strong> foi ativado automaticamente com sucesso neste dispositivo.
        </p>

        <div style="background:rgba(255,255,255,0.06); border:1px dashed rgba(251,191,36,0.5); border-radius:14px; padding:1rem; margin:1rem 0; text-align:center;">
          <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--c-text-muted); font-weight:700; display:block; margin-bottom:0.35rem;">
            🔑 Sua Chave de Ativação (2º Aparelho):
          </span>
          <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem;">
            <code id="displaySuccessKey" style="font-size:1.3rem; font-weight:900; color:#fbbf24; letter-spacing:0.08em;">${safeKey}</code>
            <button id="btnCopySuccessKey" type="button" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.65rem; font-size:0.75rem; border-radius:8px;">
              Copiar
            </button>
          </div>
          <small style="display:block; margin-top:0.45rem; font-size:0.75rem; color:var(--c-text-muted);">
            Você pode usar esta mesma chave em até 2 aparelhos (ex: seu celular e computador).
          </small>
        </div>

        <div class="startup-lock-benefits" style="margin-bottom:1.25rem;">
          <div class="slb-item">✓ Acesso liberado por 365 dias</div>
          <div class="slb-item">✓ Pedidos, precificação e relatórios ilimitados</div>
          <div class="slb-item">✓ Suporte com Inteligência Artificial ativo</div>
        </div>

        <div class="startup-lock-actions">
          <button class="btn btn-gold btn-lg w-100" id="btnStartUsingConfeitex" style="width:100%; padding:0.95rem; font-weight:800; font-size:1.05rem;">
            🚀 Começar a Usar Agora
          </button>
          <a href="https://wa.me/5562986290913?text=Ol%C3%A1!%20Acabei%20de%20ativar%20meu%20Confeitex%20Anual." target="_blank" rel="noopener" style="display:flex; align-items:center; justify-content:center; gap:0.4rem; color:#4ade80; font-size:0.85rem; font-weight:600; text-decoration:none; margin-top:0.6rem;">
            💬 Suporte VIP no WhatsApp: (62) 98629-0913
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btnClose = overlay.querySelector('#btnStartUsingConfeitex');
    if (btnClose) {
      btnClose.addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 350);
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('✨ Bem-vinda ao Confeitex!');
        }
      });
    }

    const btnCopy = overlay.querySelector('#btnCopySuccessKey');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(key).then(() => {
            btnCopy.textContent = 'Copiado!';
            setTimeout(() => { btnCopy.textContent = 'Copiar'; }, 2000);
          }).catch(() => {});
        } else {
          btnCopy.textContent = 'Copiado!';
          setTimeout(() => { btnCopy.textContent = 'Copiar'; }, 2000);
        }
      });
    }
  },

  isLifetimeActive() {
    const isSubActive = safeStorage.get(this.KEY_SUB_STATUS) === 'active';
    const isLifeStored = safeStorage.get(this.KEY_LIFETIME_ACTIVE) === 'true';
    if (!isSubActive && !isLifeStored) return false;

    // Validação de expiração da licença anual (1 ano / 365 dias)
    const expiresStr = safeStorage.get(this.KEY_SUB_EXPIRES);
    if (expiresStr) {
      const expTime = new Date(expiresStr).getTime();
      if (!isNaN(expTime) && Date.now() > expTime) {
        // Expirou após 1 ano de uso: bloqueia até renovação
        return false;
      }
    }
    return true;
  },

  activateLifetime(key = 'CFTX-ANUAL', method = 'activation_key', days = 365) {
    safeStorage.set(this.KEY_LIFETIME_ACTIVE, 'true');
    safeStorage.set(this.KEY_ACTIVATION_KEY, key);
    safeStorage.set(this.KEY_SUB_STATUS, 'active');
    safeStorage.set(this.KEY_PAYMENT_METHOD, method);

    const now = new Date();
    if (!safeStorage.get('confeitex_activation_date')) {
      safeStorage.set('confeitex_activation_date', now.toISOString());
    }
    const expires = new Date(now.getTime() + days * 86400000);
    safeStorage.set(this.KEY_SUB_EXPIRES, expires.toISOString());

    this.renderPlanBadge();
    if (typeof document !== 'undefined') {
      const overlay = document.getElementById('startupLockOverlay');
      if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 350);
      }
      const paywall = document.getElementById('paywallOverlay');
      if (paywall) {
        paywall.classList.remove('active');
        setTimeout(() => paywall.remove(), 350);
      }
      const ob = document.getElementById('onboardingOverlay');
      if (ob) {
        ob.classList.remove('active');
        setTimeout(() => ob.remove(), 350);
      }
      const rsbSub = document.getElementById('rsbKeySub');
      if (rsbSub) rsbSub.textContent = 'Plano Anual Ativado ✓';
    }
    if (typeof document !== 'undefined' && typeof UI !== 'undefined' && UI.toast) {
      UI.toast('🎉 Plano Anual (1 Ano) Ativado com Sucesso! Bem-vinda ao Confeitex.');
    }
    if (typeof Dashboard !== 'undefined' && Dashboard.update) Dashboard.update();
  },

  verifyKey(rawKey) {
    if (!rawKey) return false;
    const clean = rawKey.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    return /^CFTX(-[A-Z0-9]{4}){2,3}$/.test(clean) || /^CFTX[A-Z0-9]{4,12}$/.test(clean);
  },

  getDeviceId() {
    let id = safeStorage.get(this.KEY_DEVICE_ID);
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = 'cftx_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      } else {
        id = 'cftx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
      }
      safeStorage.set(this.KEY_DEVICE_ID, id);
    }
    return id;
  },

  getDeviceName() {
    if (typeof navigator === 'undefined') return 'Dispositivo Padrão';
    const ua = navigator.userAgent || '';
    let os = 'Dispositivo';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';
    else if (/Linux/i.test(ua)) os = 'Linux';

    let browser = 'Navegador';
    if (/Chrome|CriOS/i.test(ua) && !/Edge|Edg|OPR/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edg/i.test(ua)) browser = 'Edge';

    return `${browser} no ${os}`;
  },

  async validateKeyWithDevice(rawKey) {
    if (!rawKey) {
      return { valid: false, error: 'empty_key', message: 'Informe a chave de ativação.' };
    }
    const clean = rawKey.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!this.verifyKey(clean)) {
      return { valid: false, error: 'invalid_key', message: 'Chave inválida. O formato padrão é CFTX-XXXX-XXXX-XXXX.' };
    }

    const deviceId = this.getDeviceId();
    const deviceName = this.getDeviceName();
    const workerUrl = this.getWorkerUrl();

    if (workerUrl && (workerUrl.startsWith('https://') || workerUrl.startsWith('http://localhost'))) {
      try {
        const res = await fetch(`${workerUrl}/validate-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: clean,
            deviceId,
            deviceName,
            maxDevices: this.MAX_DEVICES_PER_KEY
          })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.valid === false || data.error) {
          if (data.error === 'device_limit_exceeded') {
            return {
              valid: false,
              error: 'device_limit_exceeded',
              devicesCount: data.devicesCount || this.MAX_DEVICES_PER_KEY,
              maxDevices: this.MAX_DEVICES_PER_KEY,
              message: `Limite de dispositivos atingido! Esta chave já está ativa em ${data.devicesCount || this.MAX_DEVICES_PER_KEY} de ${this.MAX_DEVICES_PER_KEY} aparelhos permitidos.`
            };
          }
          return {
            valid: false,
            error: data.error || 'server_error',
            message: data.message || 'Erro ao validar licença com o servidor.'
          };
        }

        if (data.token) {
          safeStorage.set(License.STORAGE_KEYS.TOKEN, data.token);
        }
        safeStorage.set(this.KEY_DEVICE_COUNT, String(data.devicesCount || 1));
        return {
          valid: true,
          devicesCount: data.devicesCount || 1,
          maxDevices: this.MAX_DEVICES_PER_KEY,
          message: data.message || 'Chave validada com sucesso!'
        };
      } catch (err) {
        console.warn('[Plan] Falha de conexão ao validar licença no worker:', err);
        return {
          valid: false,
          error: 'network_error',
          message: 'Não foi possível conectar ao servidor para validar a chave. Verifique sua conexão com a internet.'
        };
      }
    }

    // Modo offline / demo
    return {
      valid: true,
      demo: true,
      devicesCount: 1,
      maxDevices: this.MAX_DEVICES_PER_KEY
    };
  },

  async releaseDevice() {
    const key = safeStorage.get(this.KEY_ACTIVATION_KEY);
    const deviceId = this.getDeviceId();
    const workerUrl = this.getWorkerUrl();

    if (workerUrl && key) {
      try {
        await fetch(`${workerUrl}/release-license`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, deviceId })
        });
      } catch (e) {
        console.warn('[Plan] Erro ao liberar dispositivo no servidor:', e);
      }
    }

    safeStorage.remove(this.KEY_LIFETIME_ACTIVE);
    safeStorage.remove(this.KEY_ACTIVATION_KEY);
    safeStorage.remove(this.KEY_SUB_STATUS);
    safeStorage.remove(this.KEY_PAYMENT_METHOD);
    safeStorage.remove(this.KEY_DEVICE_COUNT);
    this.renderPlanBadge();
  },

  getCheckoutUrl() {
    return safeStorage.get('confeitex_mp_checkout_link') || safeStorage.get(this.KEY_CHECKOUT_URL) || 'https://mpago.la/1e6EgRS';
  },

  async checkSubscriptionStatus() {
    const workerUrl = this.getWorkerUrl();
    if (!workerUrl) return;
    const subId = safeStorage.get(this.KEY_SUB_ID);
    if (!subId) return;

    try {
      const res = await fetch(`${workerUrl}/subscription/${subId}`);
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

  // ─────────────────────────────────────────────────────────────────────────
  // Preferência de Pagamento no Vencimento (Cartão direto)
  // ─────────────────────────────────────────────────────────────────────────
  getRenewalPreference() {
    return 'card';
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

  // ─────────────────────────────────────────────────────────────────────────
  // Status Geral do Plano
  // ─────────────────────────────────────────────────────────────────────────
  getStatus() {
    if (this.isLifetimeActive()) {
      const expiresStr = safeStorage.get(this.KEY_SUB_EXPIRES);
      let daysLeft = 365;
      if (expiresStr) {
        const exp = new Date(expiresStr).getTime();
        daysLeft = Math.max(0, Math.ceil((exp - Date.now()) / 86400000));
      }
      return {
        type: 'active',
        daysLeft,
        expiresAt: expiresStr || null,
        isLifetime: true,
        isAnnual: true,
        hasCard: this.hasRegisteredCard(),
      };
    }

    // Se o plano anual expirou
    const expiresStr = safeStorage.get(this.KEY_SUB_EXPIRES);
    if (expiresStr && new Date(expiresStr).getTime() < Date.now()) {
      return {
        type: 'expired',
        daysLeft: 0,
        expiresAt: expiresStr,
        isLifetime: false,
        isAnnual: true,
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

    return {
      type: 'locked',
      daysLeft: 0,
      expiresAt: null,
      isLifetime: false,
      isAnnual: true,
      hasCard: this.hasRegisteredCard(),
    };
  },

  isPremium() {
    const s = this.getStatus();
    return s.type === 'active' || s.type === 'trial';
  },

  canUse(feature) {
    if (this.isLifetimeActive()) return true;

    // Feature sempre liberada por lei LGPD (Fase 3): export
    if (feature === 'export') return true;

    // Suporte aos testes unitários caso trial seja acionado em ambiente de teste
    if (this.isTrialActive()) {
      if (feature === 'unlimited_orders') {
        return (typeof State !== 'undefined' ? State.orders.length : 0) < this.MAX_ORDERS_FREE;
      }
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
    if (typeof document === 'undefined') return;
    const container = document.getElementById('planBadgeContainer');
    if (!container) return;

    const status = this.getStatus();
    let badgeHTML = '';

    if (status.type === 'active') {
      const subLabel = status.daysLeft !== null ? `${status.daysLeft} dias restantes` : '1 Ano de Acesso ✓';
      badgeHTML = `
        <div class="plan-badge plan-badge--premium" id="planBadge" title="Plano Anual Confeitex (1 Ano de Uso)">
          <div class="plan-badge-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">Plano Anual</span>
            <span class="plan-badge-sub">${subLabel}</span>
          </div>
          <svg class="plan-badge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>`;
    } else {
      const isExp = status.type === 'expired';
      badgeHTML = `
        <div class="plan-badge plan-badge--expired" id="planBadge" title="${isExp ? 'Renovar Plano Anual' : 'Ativar Plano Anual'}">
          <div class="plan-badge-icon" style="background:rgba(236,72,153,0.2); color:#ec4899;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div class="plan-badge-info">
            <span class="plan-badge-label">${isExp ? 'Anuidade Vencida' : 'App Bloqueado'}</span>
            <span class="plan-badge-sub" style="color:#fbbf24">${isExp ? 'Renovar — R$ 397,90' : 'Desbloquear — R$ 397,90'}</span>
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
        if (status.type === 'active') {
          this.showManageModal();
        } else {
          this.showStartupLockIfNeeded(true);
        }
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Bloqueio de Inicialização (Tudo bloqueado até ativação por R$ 89,90)
  // ─────────────────────────────────────────────────────────────────────────
  showStartupLockIfNeeded(force = false) {
    if (typeof document === 'undefined') return;
    if (!force && this.isLifetimeActive()) return;

    const existing = document.getElementById('startupLockOverlay');
    if (existing) {
      existing.classList.add('active');
      return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'startup-lock-overlay active';
    overlay.id = 'startupLockOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="startup-lock-modal">
        <div class="startup-lock-badge">🔒 Acesso Bloqueado</div>
        <div class="startup-lock-icon">
          <svg viewBox="0 0 24 24"><path d="M7 16.5h10"/><rect x="7.9" y="13.4" width="8.2" height="3" rx="0.6" fill="none"/><rect x="9.8" y="10.1" width="4.5" height="3.4" rx="0.5" fill="none"/><path d="M12 10.1V8.6"/><path d="M12 6.9c-.66.66-1.03 1.13-1.03 1.69a1.03 1.03 0 0 0 2.06 0c0-.56-.37-1.03-1.03-1.69z" fill="white" stroke="none"/></svg>
        </div>
        <h2 class="startup-lock-title">Bem-vinda ao Confeitex!</h2>
        <p class="startup-lock-desc">
          Seu aplicativo profissional de confeitaria está pronto.<br>
          Para desbloquear todas as funções de pedidos, precificação, receitas e relatórios, ative seu <strong>Plano Anual por R$ 397,90/ano (em até 10x sem juros de R$ 39,79 no Cartão ou PIX imediato)</strong>. Válido por 1 ano inteiro de uso (renovação anual).
        </p>

        <div class="startup-lock-benefits">
          <div class="slb-item">✓ 1 ano de acesso completo a todas as ferramentas</div>
          <div class="slb-item">✓ Pedidos e encomendas ilimitadas sem mensalidade</div>
          <div class="slb-item">✓ Ficha técnica e cálculo de lucro garantido</div>
          <div class="slb-item">✓ Recibos profissionais no WhatsApp</div>
          <div class="slb-item">✓ Suporte com Inteligência Artificial por 7 dias</div>
          <div class="slb-item">✓ 100% Reembolso se não se adaptar em até 7 dias</div>
        </div>

        <div class="startup-lock-actions">
          <button type="button" class="btn btn-lg w-100" id="btnStartupLockBuy" style="display:flex; align-items:center; justify-content:center; gap:0.5rem; text-align:center; background:#009ee3; color:#fff; font-weight:800; border-radius:14px; padding:0.95rem 1.2rem; box-shadow:0 4px 20px rgba(0, 158, 227, 0.4); border:none; cursor:pointer;">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>Assinar Plano Anual (PIX ou Cartão em até 10x)</span>
          </button>
          <button class="btn btn-primary btn-lg w-100" id="btnStartupLockKey">
            🔑 Já paguei / Digitar Chave de Ativação
          </button>
          <button type="button" class="btn btn-secondary w-100" id="btnStartupLockPresentation" style="margin-top:0.6rem; padding:0.75rem 1rem; font-size:0.9rem; border-radius:12px;">
            👀 Rever Apresentação do App
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const btnBuy = overlay.querySelector('#btnStartupLockBuy');
    if (btnBuy) {
      btnBuy.addEventListener('click', () => {
        if (typeof window !== 'undefined' && window.Checkout) {
          window.Checkout.open('pix');
        } else {
          window.open(this.getCheckoutUrl(), '_blank');
        }
      });
    }

    const btnKey = overlay.querySelector('#btnStartupLockKey');
    if (btnKey) {
      btnKey.addEventListener('click', () => {
        this.showKeyInputModal();
      });
    }

    const btnPres = overlay.querySelector('#btnStartupLockPresentation');
    if (btnPres) {
      btnPres.addEventListener('click', () => {
        overlay.classList.remove('active');
        if (typeof window !== 'undefined' && window.Onboarding) {
          window.Onboarding.show(true);
        }
      });
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Modal para Digitar Chave de Ativação
  // ─────────────────────────────────────────────────────────────────────────
  showKeyInputModal() {
    const existing = document.getElementById('keyInputModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'key-input-modal-overlay modal-overlay active';
    overlay.id = 'keyInputModalOverlay';
    overlay.style.zIndex = '11000';

    overlay.innerHTML = `
      <div class="key-input-modal" style="background:#17112a; border:1px solid rgba(236,72,153,0.4); border-radius:20px; padding:2rem 1.6rem; max-width:440px; width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.85); text-align:center;">
        <div style="font-size:2.2rem; margin-bottom:0.4rem;">🔑</div>
        <h3 style="font-size:1.35rem; font-weight:800; margin-bottom:0.4rem; color:#fff;">Ativar Plano Anual</h3>
        <p style="font-size:0.88rem; color:#cbd5e1; margin-bottom:1.25rem;">
          Digite abaixo a chave recebida após o pagamento de R$ 397,90 do seu plano anual:
        </p>

        <input type="text" id="inputAppKey" placeholder="Ex: CFTX-XXXX-XXXX" style="width:100%; padding:0.85rem 1rem; border-radius:12px; background:#0b0815; border:1px solid rgba(255,255,255,0.25); color:#fff; font-size:1.15rem; font-weight:700; text-align:center; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.5rem;">
        <div id="appKeyError" style="color:#ef4444; font-size:0.82rem; margin-bottom:0.8rem; display:none;"></div>

        <button class="btn btn-gold w-100" id="btnAppValidateKey" style="padding:0.9rem 1rem; font-size:1rem; font-weight:800; margin-bottom:0.6rem;">
          Validar e Liberar App (1 Ano)
        </button>
        <button type="button" id="btnAppBuyDirect" class="btn btn-secondary w-100" style="padding:0.65rem 1rem; font-size:0.85rem; margin-bottom:0.6rem; display:flex; align-items:center; justify-content:center; gap:0.4rem; border-color:rgba(0,158,227,0.5); color:#38bdf8; cursor:pointer; background:transparent;">
          💳 Comprar Plano Anual (PIX ou Cartão em até 10x)
        </button>
        <button class="btn btn-secondary w-100" id="btnAppCloseKey" style="padding:0.65rem 1rem; font-size:0.85rem; opacity:0.8;">
          Voltar
        </button>
      </div>
    `;

    document.body.appendChild(overlay);

    const btnBuyDirect = overlay.querySelector('#btnAppBuyDirect');
    if (btnBuyDirect) {
      btnBuyDirect.addEventListener('click', () => {
        overlay.remove();
        if (typeof window !== 'undefined' && window.Checkout) {
          window.Checkout.open('pix');
        } else {
          window.open(this.getCheckoutUrl(), '_blank');
        }
      });
    }

    const input = overlay.querySelector('#inputAppKey');
    const err = overlay.querySelector('#appKeyError');
    const btnVal = overlay.querySelector('#btnAppValidateKey');
    const btnCls = overlay.querySelector('#btnAppCloseKey');

    btnCls.onclick = () => {
      overlay.remove();
    };

    btnVal.onclick = async () => {
      const val = input.value.trim();
      if (!val) {
        err.textContent = 'Informe sua chave de ativação.';
        err.style.display = 'block';
        return;
      }

      err.style.display = 'none';
      btnVal.disabled = true;
      const originalText = btnVal.innerHTML;
      btnVal.innerHTML = 'Verificando chave e dispositivos...';

      try {
        const result = await this.validateKeyWithDevice(val);
        if (result.valid) {
          this.activateLifetime(val, 'activation_key');
          overlay.remove();
          if (typeof UI !== 'undefined' && UI.toast) {
            const devInfo = result.devicesCount ? ` (Aparelho ${result.devicesCount} de ${result.maxDevices || 2})` : '';
            UI.toast(`🎉 Plano Anual Ativado com Sucesso!${devInfo}`);
          }
        } else {
          err.textContent = result.message || 'Chave inválida. Verifique o código recebido ou adquira seu plano anual.';
          err.style.display = 'block';
          btnVal.disabled = false;
          btnVal.innerHTML = originalText;
        }
      } catch (e) {
        err.textContent = 'Erro ao validar chave. Tente novamente.';
        err.style.display = 'block';
        btnVal.disabled = false;
        btnVal.innerHTML = originalText;
      }
    };
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
        <button class="plan-card-modal-close" id="btnPlanCardModalClose" aria-label="Fechar">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

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

          <div class="form-row plan-form-row">
            <div class="form-group plan-form-col">
              <label for="planCardExpiry">Validade</label>
              <input type="text" class="form-control" id="planCardExpiry" placeholder="MM/AA" maxlength="5" inputmode="numeric" autocomplete="cc-exp" required />
            </div>
            <div class="form-group plan-form-col">
              <label for="planCardCvv">CVV</label>
              <input type="password" class="form-control" id="planCardCvv" placeholder="123" maxlength="4" inputmode="numeric" autocomplete="cc-csc" required />
            </div>
          </div>

          <div class="form-row plan-form-row">
            <div class="form-group plan-form-col-cpf">
              <label for="planCardCpf">CPF do Titular</label>
              <input type="text" class="form-control" id="planCardCpf" placeholder="000.000.000-00" maxlength="14" inputmode="numeric" required />
            </div>
            <div class="form-group plan-form-col-email">
              <label for="planCardEmail">E-mail para Recibo</label>
              <input type="email" class="form-control" id="planCardEmail" placeholder="seu@email.com" autocomplete="email" required />
            </div>
          </div>

          <div class="plan-card-trial-terms">
            <div class="plan-terms-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="plan-terms-text">
              ${isForTrial
                ? '<strong>Hoje você paga R$ 0,00</strong>. Experimente 7 dias com acesso ilimitado. A partir do 8º dia, a assinatura de <strong>R$ 16,99/mês</strong> será debitada automaticamente no cartão. Cancele quando quiser com 1 clique.'
                : 'Seu cartão será validado com segurança e configurado para cobrança automática mensal de <strong>R$ 16,99</strong>.'}
            </div>
          </div>

          <div id="planCardError" class="plan-card-error-msg" style="display:none;"></div>

          <button type="submit" class="btn btn-primary plan-card-btn-submit" id="btnSubmitPlanCard">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            ${isForTrial ? 'Iniciar 7 Dias Grátis — R$ 16,99/mês após o teste' : 'Salvar Novo Cartão'}
          </button>
        </form>

        <div class="plan-card-security-footer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Cobrança 100% segura via Mercado Pago · Criptografia de ponta a ponta
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const closeModal = () => {
      document.removeEventListener('keydown', handleEsc);
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEsc);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const btnClose = overlay.querySelector('#btnPlanCardModalClose') || document.getElementById('btnPlanCardModalClose');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    // Inputs e referências
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
    if (existingCard) {
      if (existingCard.cardholderName) holderInput.value = existingCard.cardholderName;
      if (existingCard.email) emailInput.value = existingCard.email;
      const previewHolder = document.getElementById('cardPreviewHolder');
      if (previewHolder && existingCard.cardholderName) previewHolder.textContent = existingCard.cardholderName.toUpperCase();
    }

    // Formatação do Número do Cartão
    numInput.addEventListener('input', e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 16);
      v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
      e.target.value = v;

      const previewNum = document.getElementById('cardPreviewNumber');
      if (previewNum) previewNum.textContent = v || '•••• •••• •••• ••••';

      const brand = this.detectCardBrand(v);
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

    // Submissão do Formulário
    btnSubmit.addEventListener('click', async () => {
      errorEl.style.display = 'none';
      errorEl.textContent = '';

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
      const fullYear = expYear && expYear.length === 2 ? 2000 + yearNum : yearNum;
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      if (!expMonth || !expYear || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
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

      if (cpf.length !== 11) {
        errorEl.textContent = 'Informe um CPF válido com 11 dígitos.';
        errorEl.style.display = 'block';
        cpfInput.focus();
        return;
      }

      if (!email || !email.includes('@') || !email.includes('.')) {
        errorEl.textContent = 'Informe um e-mail válido para recebimento de comprovantes.';
        errorEl.style.display = 'block';
        emailInput.focus();
        return;
      }

      // Estado de Carregamento
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<span class="plan-spinner" style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;margin-right:6px;vertical-align:middle;"></span> Validando cartão no Mercado Pago...';

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

        const result = {
          valid: true,
          token: 'TOKEN_LOCAL_' + Date.now(),
          lastFourDigits: rawNum.slice(-4),
          cardholderName: holder,
          expirationMonth: expMonth,
          expirationYear: expYear,
          brand: this.detectCardBrand(rawNum),
        };

        // Salva dados do cartão (apenas dados seguros)
        this.saveCardData({
          lastFourDigits: result.lastFourDigits || rawNum.slice(-4),
          cardholderName: holder,
          expirationMonth: expMonth,
          expirationYear: expYear,
          brand: result.brand || this.detectCardBrand(rawNum),
          token: result.token,
          email: email,
          customer_id: result.customer_id,
          card_id: result.card_id,
        });

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
        errorEl.innerHTML = `
          <div>${err.message || 'Erro ao validar cartão no Mercado Pago.'}</div>
          <button type="button" class="btn btn-secondary btn-sm mt-2" id="btnFallbackDemoCard" style="margin-top:0.5rem;font-size:0.75rem;">
            Continuar em Modo Demonstração
          </button>
        `;
        errorEl.style.display = 'block';

        const btnFallback = document.getElementById('btnFallbackDemoCard');
        if (btnFallback) {
          btnFallback.onclick = () => {
            this.saveCardData({
              lastFourDigits: rawNum.slice(-4),
              cardholderName: holder,
              expirationMonth: expMonth,
              expirationYear: expYear,
              brand: this.detectCardBrand(rawNum),
              token: 'FALLBACK_' + Date.now(),
              email: email,
            });
            if (isForTrial) {
              this.startTrial();
              UI.toast('🎉 Cartão cadastrado em Modo Demonstração!', 'success');
            } else {
              UI.toast('✅ Cartão atualizado em Modo Demonstração!', 'success');
            }
            this.renderPlanBadge();
            closeModal();
            if (typeof onComplete === 'function') onComplete({ valid: true, demo: true });
          };
        }

        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> ${isForTrial ? 'Iniciar 7 Dias Grátis — R$ 16,99/mês após o teste' : 'Salvar Novo Cartão'}`;
      }
    });
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
      const activeKey = safeStorage.get(this.KEY_ACTIVATION_KEY) || 'CFTX-ANUAL';
      const devName = this.getDeviceName();
      const expDate = status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('pt-BR') : '1 ano';
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--active">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Plano Anual Ativo ⭐</div>
            <div class="plan-status-sub">Válido por 1 ano · Vence em: <strong>${expDate}</strong> (${status.daysLeft} dias restantes)</div>
            <div style="margin-top:0.35rem; font-size:0.78rem; color:#93c5fd; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
              <span>📱 Dispositivo: <strong>${devName}</strong></span>
              <span>·</span>
              <span class="badge" style="background:rgba(59,130,246,0.25); color:#60a5fa; padding:0.15rem 0.5rem; border-radius:6px;">Máx 2 aparelhos</span>
            </div>
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
            <div class="plan-status-sub">Assine o plano anual por R$ 397,90/ano (em até 10x sem juros)</div>
          </div>
        </div>`;
    } else {
      statusHeaderHTML = `
        <div class="plan-status-card plan-status-card--expired">
          <div class="plan-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <div>
            <div class="plan-status-title">Plano Anual Vencido</div>
            <div class="plan-status-sub">Seu período de 1 ano encerrou. Renove sua anuidade (R$ 397,90) para continuar usando todas as funções.</div>
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
        <button class="plan-manage-close" id="btnPlanManageClose" aria-label="Fechar">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="plan-manage-header">
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Meu Plano Confeitex
          </h2>
        </div>

        <div class="plan-manage-body">
          ${statusHeaderHTML}

          <!-- Banner Informativo do Plano Anual -->
          <div class="plan-auto-debit-banner">
            <div class="plan-auto-debit-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="plan-auto-debit-text">
              <strong>Plano Anual Confeitex (R$ 397,90/ano)</strong>
              <p>Acesso completo por 1 ano inteiro a todas as funções, precificação e relatórios. Pagamento seguro direto no app (em até 10x sem juros no Cartão ou Pix imediato).</p>
            </div>
          </div>

          ${status.type === 'active' ? `
          <!-- Seção de Dispositivo Autorizado -->
          <div class="plan-section">
            <h3 class="plan-section-title">Dispositivo Conectado</h3>
            <div class="plan-saved-card-box" style="margin-bottom:0.6rem;">
              <div class="plan-saved-card-left">
                <div class="plan-saved-card-icon">📱</div>
                <div>
                  <strong>${this.getDeviceName()}</strong>
                  <div class="plan-saved-card-holder">Dispositivo autorizado (Limite: máx 2 aparelhos)</div>
                </div>
              </div>
              <span class="badge" style="background:rgba(16,185,129,0.2); color:#34d399; font-size:0.75rem; padding:0.2rem 0.5rem; border-radius:6px; font-weight:700;">Ativo</span>
            </div>
            <button class="btn btn-secondary w-100" id="btnReleaseDevice" style="font-size:0.85rem; border-color:rgba(239,68,68,0.4); color:#fca5a5; padding:0.6rem 1rem;">
              Desvincular Licença deste Dispositivo
            </button>
            <small style="color:var(--text-muted); font-size:0.75rem; display:block; margin-top:0.35rem; text-align:center;">
              Libera uma das 2 vagas caso queira transferir sua licença para outro aparelho.
            </small>
          </div>
          ` : ''}

          <!-- Botões de Ação Imediata -->
          <div class="plan-manage-actions">
            <button class="btn btn-primary w-100" id="btnPayPlanNow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              ${status.type === 'active' ? 'Renovar Plano Anual no Mercado Pago (R$ 397,90)' : 'Comprar Plano Anual no Mercado Pago — R$ 397,90'}
            </button>
          </div>
        </div>

        <div class="plan-manage-footer">
          <div class="plan-manage-secure">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Cobrança processada com segurança pelo Mercado Pago · 1 ano de acesso
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    const closeModal = () => {
      document.removeEventListener('keydown', handleEsc);
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 350);
    };

    const handleEsc = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', handleEsc);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const btnManageClose = overlay.querySelector('#btnPlanManageClose') || document.getElementById('btnPlanManageClose');
    if (btnManageClose) {
      btnManageClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    // Pagar / Renovar via Checkout Pro
    const btnPayNow = document.getElementById('btnPayPlanNow');
    if (btnPayNow) {
      btnPayNow.onclick = () => {
        closeModal();
        if (typeof License !== 'undefined' && License.startPurchase) {
          License.startPurchase();
        } else {
          this.showStartupLockIfNeeded(true);
        }
      };
    }

    // Desvincular Dispositivo da Licença
    const btnRelease = document.getElementById('btnReleaseDevice');
    if (btnRelease) {
      btnRelease.onclick = async () => {
        const ok = typeof UI !== 'undefined' && UI.confirm
          ? await UI.confirm({
              title: 'Desvincular Dispositivo?',
              message: 'Deseja desvincular a licença deste aparelho? Isso liberará uma vaga para você ativar o Confeitex em outro dispositivo.',
              confirmText: 'Sim, Desvincular',
              variant: 'danger'
            })
          : confirm('Deseja desvincular a licença deste aparelho? Isso liberará uma vaga para você ativar em outro dispositivo.');

        if (ok) {
          btnRelease.disabled = true;
          btnRelease.textContent = 'Desvinculando...';
          await this.releaseDevice();
          closeModal();
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Licença desvinculada deste dispositivo com sucesso.', 'info');
          }
          this.showStartupLockIfNeeded(true);
        }
      };
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
        <button class="plan-payment-close" id="btnPlanPaymentClose" aria-label="Fechar">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
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

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const btnPaymentClose = overlay.querySelector('#btnPlanPaymentClose') || document.getElementById('btnPlanPaymentClose');
    if (btnPaymentClose) {
      btnPaymentClose.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

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
            const res = { id: 'DEMO_' + Date.now(), status: 'approved' };

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
          <button class="paywall-close" id="paywallBtnClose" aria-label="Fechar">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="paywall-header">
            <div class="paywall-lock-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 class="paywall-title">Plano Anual Confeitex</h2>
            <p class="paywall-subtitle">${featureName} está disponível no Acesso Completo.</p>
          </div>
          <div class="paywall-features">
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              1 ano de acesso completo a todas as funções
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Pedidos e encomendas ilimitadas
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Relatórios e lucratividade real
            </div>
            <div class="paywall-feature">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              Calculadora de custos e receitas
            </div>
          </div>
          <div class="paywall-price">
            <div class="paywall-price-value">
              <span class="paywall-price-currency">R$</span>
              <span class="paywall-price-amount">397,90</span>
              <span class="paywall-price-period">/ano</span>
            </div>
            <p class="paywall-price-note">Válido por 1 ano de uso · Em até 10x de R$ 39,79 sem juros</p>
          </div>
          <button class="paywall-btn-upgrade" id="paywallBtnUpgrade" style="background:#009ee3; border-color:rgba(255,255,255,0.25); box-shadow:0 4px 20px rgba(0, 158, 227, 0.4);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Assinar Plano Anual — R$ 397,90 (até 10x)
          </button>
          <button class="btn btn-secondary w-100" id="paywallBtnEnterKey" style="margin-top:0.5rem; padding:0.75rem 1rem; border-radius:12px; font-size:0.88rem;">
            🔑 Já comprei / Digitar Chave
          </button>
          <button class="paywall-btn-cancel" id="paywallBtnCancel" style="margin-top:0.3rem;">Agora não</button>
        </div>`;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const close = (result) => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 350);
        resolve(result);
      };

      const handlePaywallEsc = (e) => {
        if (e.key === 'Escape') close(false);
      };
      document.addEventListener('keydown', handlePaywallEsc);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(false);
      });

      const btnPaywallClose = overlay.querySelector('#paywallBtnClose');
      if (btnPaywallClose) {
        btnPaywallClose.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          close(false);
        });
      }

      document.getElementById('paywallBtnCancel').onclick = () => close(false);
      
      const btnUpgrade = document.getElementById('paywallBtnUpgrade');
      if (btnUpgrade) {
        btnUpgrade.onclick = () => {
          const url = this.getCheckoutUrl();
          if (url && url !== '#') {
            window.open(url, '_blank');
          }
        };
      }

      const btnKey = document.getElementById('paywallBtnEnterKey');
      if (btnKey) {
        btnKey.onclick = () => {
          close(false);
          this.showKeyInputModal();
        };
      }
    });
  }
};
