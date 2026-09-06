// ============================================================================
// MercadoPagoCheckout — Integração Mercado Pago Checkout Bricks & Pro (Confeitex)
// Suporta: Payment Brick (Cartão de Crédito/Débito, Pix), Link de Pagamento e WhatsApp
// ============================================================================

const MercadoPagoCheckout = {
  // ─── Configuração Padrão ────────────────────────────────────────────────
  DEFAULT_PUBLIC_KEY: '', // Não usar chave padrão — cada usuário deve configurar a sua
  PUBLIC_KEY: '',
  WORKER_URL: '',
  APP_SECRET: '',

  // ─── Estado Interno ─────────────────────────────────────────────────────
  _mp: null,
  _bricksBuilder: null,
  _currentBrickController: null,
  _loaded: false,
  _currentOrder: null,
  _currentPaymentId: null,
  _pollTimer: null,
  _activeTab: 'brick', // 'brick' | 'link'

  // ─── Inicialização ──────────────────────────────────────────────────────
  init() {
    this.PUBLIC_KEY = safeStorage.get('confeitex_mp_public_key') || this.DEFAULT_PUBLIC_KEY;
    this.WORKER_URL = (safeStorage.get('confeitex_mp_worker_url') || '').trim().replace(/\/+$/, '');
    this.APP_SECRET = (safeStorage.get('confeitex_mp_app_secret') || '').trim();
    if (!this.PUBLIC_KEY && !this.WORKER_URL) {
      console.warn('[MercadoPago] Chave pública e Worker URL não configurados. Vá em Configurações > Mercado Pago.');
    }
  },

  setWorkerUrl(url) {
    this.WORKER_URL = (url || '').trim().replace(/\/+$/, '');
    safeStorage.set('confeitex_mp_worker_url', this.WORKER_URL);
  },

  setPublicKey(key) {
    this.PUBLIC_KEY = (key || '').trim();
    safeStorage.set('confeitex_mp_public_key', this.PUBLIC_KEY);
    this._mp = null;
    this._bricksBuilder = null;
  },

  setAppSecret(secret) {
    this.APP_SECRET = (secret || '').trim();
    safeStorage.set('confeitex_mp_app_secret', this.APP_SECRET);
  },

  _getHeaders(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this.APP_SECRET) h['X-App-Secret'] = this.APP_SECRET;
    return h;
  },

  isConfigured() {
    return Boolean(this.WORKER_URL);
  },

  // ─── Carregamento do SDK Oficial do Mercado Pago ─────────────────────────
  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (this._loaded && window.MercadoPago) {
        resolve();
        return;
      }
      if (document.getElementById('mercadopago-sdk')) {
        const check = setInterval(() => {
          if (window.MercadoPago) {
            clearInterval(check);
            this._loaded = true;
            resolve();
          }
        }, 200);
        setTimeout(() => {
          clearInterval(check);
          if (window.MercadoPago) {
            this._loaded = true;
            resolve();
          } else {
            reject(new Error(I18n.t('mp.errSdkTimeout')));
          }
        }, 10000);
        return;
      }
      const script = document.createElement('script');
      script.id = 'mercadopago-sdk';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        this._loaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error(I18n.t('mp.errSdkLoad')));
      document.head.appendChild(script);
    });
  },

  async _ensureReady() {
    await this._loadSDK();
    if (!this._mp) {
      const pubKey = this.PUBLIC_KEY || this.DEFAULT_PUBLIC_KEY;
      this._mp = new MercadoPago(pubKey, {
        locale: 'pt-BR'
      });
      this._bricksBuilder = this._mp.bricks();
    }
  },

  // ─── Abertura do Modal de Checkout ──────────────────────────────────────
  async openCheckout(order) {
    if (!order) return;
    this._currentOrder = order;
    this._currentPaymentId = null;
    this._stopPolling();

    const modal = document.getElementById('mpCheckoutModal');
    if (!modal) {
      console.error('[MP] Modal mpCheckoutModal não encontrado no DOM');
      return;
    }

    // Atualiza cabeçalho com dados do pedido
    const orderTitle = document.getElementById('mpModalOrderSummary');
    if (orderTitle) {
      const val = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);
      orderTitle.innerHTML = `<strong>${escapeHTML(order.clientName)}</strong> · ${escapeHTML(order.flavor)} · <span class="mp-total-highlight">${fmt(val)}</span>`;
    }

    // Reseta estado dos containers
    this._showView('loading');
    modal.classList.add('active');

    // Inicializa abas
    this._setupTabs(order);

    // Se Worker não estiver configurado, exibe aviso com opção de demonstração
    if (!this.isConfigured()) {
      this._renderNoWorkerNotice(order);
      return;
    }

    await this._renderBrickFlow(order);
  },

  // ─── Alternância de Abas (Direto vs Link) ───────────────────────────────
  _setupTabs(order) {
    const tabDirect = document.getElementById('mpTabDirect');
    const tabLink = document.getElementById('mpTabLink');
    const panelDirect = document.getElementById('mpPanelDirect');
    const panelLink = document.getElementById('mpPanelLink');

    if (tabDirect && tabLink) {
      tabDirect.onclick = () => {
        tabDirect.classList.add('active');
        tabLink.classList.remove('active');
        if (panelDirect) panelDirect.style.display = 'block';
        if (panelLink) panelLink.style.display = 'none';
        this._activeTab = 'brick';
      };

      tabLink.onclick = () => {
        tabLink.classList.add('active');
        tabDirect.classList.remove('active');
        if (panelDirect) panelDirect.style.display = 'none';
        if (panelLink) panelLink.style.display = 'block';
        this._activeTab = 'link';
        this._loadLinkTab(order);
      };

      // Reset para aba inicial
      tabDirect.classList.add('active');
      tabLink.classList.remove('active');
      if (panelDirect) panelDirect.style.display = 'block';
      if (panelLink) panelLink.style.display = 'none';
    }
  },

  // ─── Renderiza o Fluxo Principal do Payment Brick ─────────────────────────
  async _renderBrickFlow(order) {
    const totalVal = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);
    const container = document.getElementById('mpBrickContainer');
    if (!container) return;

    this._showView('loading');

    try {
      await this._ensureReady();

      // Limpa brick anterior se houver
      if (this._currentBrickController) {
        try { this._currentBrickController.unmount(); } catch (e) {}
        this._currentBrickController = null;
      }
      container.innerHTML = '';

      this._showView('brick');

      const settings = {
        initialization: {
          amount: Number(totalVal),
          payer: {
            email: order.clientEmail || '',
          },
        },
        customization: {
          paymentMethods: {
            bankTransfer: 'all', // Pix
            creditCard: 'all',   // Cartão de Crédito
            debitCard: 'all',    // Cartão de Débito
            ticket: 'all',       // Boleto
          },
          visual: {
            style: {
              theme: 'dark',
              customVariables: {
                formBackgroundColor: '#120d24',
                baseColor: '#ec4899',
                secondaryColor: '#8b5cf6',
                buttonTextColor: '#ffffff',
              }
            },
          },
        },
        callbacks: {
          onReady: () => {
            const loading = document.getElementById('mpBrickLoading');
            if (loading) loading.style.display = 'none';
          },
          onSubmit: async (formData) => {
            return this._processPaymentSubmission(formData, order);
          },
          onError: (error) => {
            console.error('[MP Brick Error]', error);
            this._showError(error.message || I18n.t('mp.errBrickForm'));
          },
        },
      };

      this._currentBrickController = await this._bricksBuilder.create('payment', 'mpBrickContainer', settings);
    } catch (err) {
      console.error('[MP Brick Init Error]', err);
      this._showError(err.message || I18n.t('mp.errInitCheckout'));
    }
  },

  // ─── Processa o Envio do Pagamento para o Worker ─────────────────────────
  async _processPaymentSubmission(formData, order) {
    const totalVal = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);
    this._showView('loading');
    const loadingText = document.getElementById('mpLoadingText');
    if (loadingText) loadingText.textContent = I18n.t('mp.processingPayment');

    try {
      const payload = {
        amount: totalVal,
        transaction_amount: totalVal,
        description: `${order.flavor} — ${order.clientName}`,
        order_id: order.id,
        payment_method_id: formData.payment_method_id,
        token: formData.token,
        installments: formData.installments,
        issuer_id: formData.issuer_id,
        payer: {
          email: formData.payer?.email || order.clientEmail || 'cliente@confeitex.app',
          identification: formData.payer?.identification,
          first_name: order.clientName,
        },
      };

      const res = await fetch(`${this.WORKER_URL}/create-payment`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(payload),
      });

      const payment = await res.json();

      if (!res.ok || payment.error) {
        throw new Error(payment.error || I18n.t('mp.errPaymentFail'));
      }

      this._currentPaymentId = payment.id;
      this._handlePaymentResult(payment, order);
    } catch (err) {
      console.error('[MP Process Error]', err);
      this._showError(err.message || I18n.t('mp.errPaymentFail'));
    }
  },

  // ─── Trata o Resultado do Pagamento ──────────────────────────────────────
  _handlePaymentResult(payment, order) {
    const status = payment.status;

    if (status === 'approved') {
      this._onPaymentApproved(payment, order);
    } else if (status === 'pending' || status === 'in_process') {
      if (payment.qr_code || payment.qr_code_base64) {
        this._renderPixPendingView(payment, order);
      } else {
        this._renderGenericPendingView(payment, order);
      }
    } else {
      this._showError(I18n.t('mp.paymentRejected', { detail: payment.status_detail || status }));
    }
  },

  // ─── Pagamento Aprovado com Sucesso ──────────────────────────────────────
  _onPaymentApproved(payment, order) {
    this._stopPolling();
    this._showView('success');

    // Atualiza o pedido no State
    this._markOrderAsPaid(order.id, payment.id, payment.payment_method_id || 'Mercado Pago');

    const statusEl = document.getElementById('mpSuccessStatus');
    const detailsEl = document.getElementById('mpSuccessDetails');

    if (statusEl) {
      statusEl.textContent = I18n.t('mp.paymentApprovedTitle');
      statusEl.style.color = 'var(--color-success)';
    }

    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="mp-success-card">
          <div class="mp-detail-row">
            <span>${I18n.t('mp.paymentId')}:</span>
            <strong>#${payment.id}</strong>
          </div>
          <div class="mp-detail-row">
            <span>${I18n.t('mp.orderValue')}:</span>
            <strong style="color:var(--color-success);">${fmt(payment.transaction_amount || order.totalValue)}</strong>
          </div>
          <div class="mp-detail-row">
            <span>${I18n.t('mp.client')}:</span>
            <span>${escapeHTML(order.clientName)}</span>
          </div>
          <div class="mp-detail-row">
            <span>${I18n.t('mp.method')}:</span>
            <span style="text-transform:capitalize;">${escapeHTML(payment.payment_method_id || 'Mercado Pago')}</span>
          </div>
        </div>
      `;
    }

    UI.toast(I18n.t('mp.toastApproved'), 'success');
  },

  // ─── Exibe tela de PIX Pendente com QR Code e Copia e Cola ───────────────
  _renderPixPendingView(payment, order) {
    this._showView('pix');

    const qrImg = document.getElementById('mpPixQrImg');
    const qrCodeInput = document.getElementById('mpPixCodeInput');
    const pixVal = document.getElementById('mpPixAmount');
    const pixTimerText = document.getElementById('mpPixTimerText');

    if (pixVal) pixVal.textContent = fmt(payment.transaction_amount || order.totalValue);

    if (qrImg) {
      if (payment.qr_code_base64) {
        qrImg.src = `data:image/png;base64,${payment.qr_code_base64}`;
        qrImg.style.display = 'block';
      } else {
        qrImg.style.display = 'none';
      }
    }

    if (qrCodeInput) {
      qrCodeInput.value = payment.qr_code || '';
    }

    // Inicia polling automático a cada 5 segundos para verificar compensação do Pix
    this._startPixPolling(payment.id, order);
  },

  // ─── Tela Pendente Genérica (Boleto / Análise) ───────────────────────────
  _renderGenericPendingView(payment, order) {
    this._showView('success');
    const statusEl = document.getElementById('mpSuccessStatus');
    const detailsEl = document.getElementById('mpSuccessDetails');

    if (statusEl) {
      statusEl.textContent = I18n.t('mp.paymentPendingTitle');
      statusEl.style.color = 'var(--color-warning)';
    }

    if (detailsEl) {
      detailsEl.innerHTML = `
        <div class="mp-success-card">
          <p>${I18n.t('mp.paymentPendingDesc')}</p>
          <div class="mp-detail-row">
            <span>${I18n.t('mp.paymentId')}:</span>
            <strong>#${payment.id}</strong>
          </div>
          ${payment.ticket_url ? `<a href="${payment.ticket_url}" target="_blank" class="btn btn-primary w-100 mt-2">${I18n.t('mp.btnViewBoleto')}</a>` : ''}
        </div>
      `;
    }
  },

  // ─── Polling de Verificação do Pix ───────────────────────────────────────
  _startPixPolling(paymentId, order) {
    this._stopPolling();
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos (60 * 5s)

    this._pollTimer = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        this._stopPolling();
        return;
      }

      const status = await this.checkPaymentStatus(paymentId, false);
      if (status === 'approved') {
        this._stopPolling();
        this._onPaymentApproved({ id: paymentId, transaction_amount: order.totalValue, payment_method_id: 'pix' }, order);
      }
    }, 5000);
  },

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  // ─── Consulta manual do status do pagamento ──────────────────────────────
  async checkPaymentStatus(paymentId, showToast = true) {
    if (!paymentId || !this.WORKER_URL) return null;

    try {
      const res = await fetch(`${this.WORKER_URL}/payment/${paymentId}`, {
        headers: this._getHeaders(),
      });
      if (!res.ok) return null;
      const data = await res.json();

      if (showToast) {
        if (data.status === 'approved') {
          UI.toast(I18n.t('mp.toastPixConfirmed'), 'success');
          if (this._currentOrder) {
            this._onPaymentApproved(data, this._currentOrder);
          }
        } else {
          UI.toast(I18n.t('mp.toastPixPending'), 'info');
        }
      }

      return data.status;
    } catch (e) {
      console.warn('[MP Status Check Error]', e);
      return null;
    }
  },

  // ─── Copia o Código Pix Copia e Cola ─────────────────────────────────────
  async copyPixCode() {
    const input = document.getElementById('mpPixCodeInput');
    const btn = document.getElementById('btnCopyPixCode');
    if (!input || !input.value) return;

    try {
      await navigator.clipboard.writeText(input.value);
      if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<span>✓ ${I18n.t('mp.pixCopied')}</span>`;
        btn.classList.add('btn-copied');
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.classList.remove('btn-copied');
        }, 2500);
      }
      UI.toast(I18n.t('mp.toastPixCopied'), 'success');
    } catch (err) {
      input.select();
      document.execCommand('copy');
      UI.toast(I18n.t('mp.toastPixCopied'), 'success');
    }
  },

  // ─── Aba: Link de Pagamento (Checkout Pro & WhatsApp) ────────────────────
  async _loadLinkTab(order) {
    const container = document.getElementById('mpLinkContainer');
    const loading = document.getElementById('mpLinkLoading');
    const content = document.getElementById('mpLinkContent');
    if (!container) return;

    if (loading) loading.style.display = 'flex';
    if (content) content.style.display = 'none';

    try {
      let link = null;
      if (this.isConfigured()) {
        link = await this.generatePaymentLink(order);
      } else {
        // Modo demo
        link = `https://confeitex.app/pay/demo_${order.id}`;
      }

      if (loading) loading.style.display = 'none';
      if (content) content.style.display = 'block';

      const inputLink = document.getElementById('mpPaymentLinkInput');
      if (inputLink) inputLink.value = link || '';

      const btnCopyLink = document.getElementById('btnCopyPaymentLink');
      if (btnCopyLink) {
        btnCopyLink.onclick = async () => {
          if (!link) return;
          try {
            await navigator.clipboard.writeText(link);
            UI.toast(I18n.t('mp.toastLinkCopied'), 'success');
          } catch (e) {
            inputLink.select();
            document.execCommand('copy');
            UI.toast(I18n.t('mp.toastLinkCopied'), 'success');
          }
        };
      }

      const btnWhatsApp = document.getElementById('btnSendPaymentWhatsApp');
      if (btnWhatsApp) {
        btnWhatsApp.onclick = () => this.shareOnWhatsApp(order, link);
      }

      const btnOpenLink = document.getElementById('btnOpenPaymentLink');
      if (btnOpenLink) {
        btnOpenLink.onclick = () => {
          if (link) window.open(link, '_blank');
        };
      }
    } catch (err) {
      console.error('[MP Link Tab Error]', err);
      if (loading) loading.style.display = 'none';
      if (content) {
        content.style.display = 'block';
        content.innerHTML = `<p style="color:var(--color-danger);text-align:center;">${err.message || I18n.t('mp.errGenerateLink')}</p>`;
      }
    }
  },

  // ─── Gera Link de Pagamento (Checkout Pro Preference) ────────────────────
  async generatePaymentLink(order) {
    if (!this.isConfigured()) return null;
    const totalVal = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);

    const res = await fetch(`${this.WORKER_URL}/create-preference`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify({
        order_id: order.id,
        client_name: order.clientName,
        client_phone: order.clientPhone,
        client_email: order.clientEmail,
        amount: totalVal,
        title: `Encomenda Confeitex: ${order.flavor} (${order.clientName})`,
        items: [{
          title: `Bolo/Doce: ${order.flavor} — ${order.clientName}`,
          unit_price: Number(totalVal),
          quantity: 1,
          currency_id: 'BRL',
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || I18n.t('mp.errGenerateLink'));
    }

    const data = await res.json();
    return data.init_point || data.sandbox_init_point;
  },

  // ─── Compartilha Cobrança no WhatsApp ────────────────────────────────────
  shareOnWhatsApp(order, link) {
    if (!order) return;
    const totalVal = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);
    const phone = (order.clientPhone || '').replace(/\D/g, '');

    const greeting = 'Olá, tudo bem?';
    let message = `${greeting} Segue o link seguro para pagamento da sua encomenda na *Confeitex* 🎂:\n\n`;
    message += `📋 *Pedido:* ${order.flavor} (${order.productType || 'Encomenda'})\n`;
    message += `💰 *Valor Total:* ${fmt(totalVal)}\n`;
    message += `📅 *Data de Entrega:* ${typeof fmtDateStr === 'function' ? fmtDateStr(order.deliveryDate) : order.deliveryDate} às ${order.deliveryTime || ''}\n\n`;
    message += `💳 *Pague via Pix ou Cartão pelo link:*\n${link}\n\n`;
    message += `Muito obrigado pela preferência! ✨`;

    const encodedMsg = encodeURIComponent(message);
    const waUrl = phone ? `https://wa.me/55${phone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  },

  // ─── Modo Demonstração (Quando o Worker ainda não foi configurado) ────────
  _renderNoWorkerNotice(order) {
    this._showView('brick');
    const container = document.getElementById('mpBrickContainer');
    if (!container) return;

    const totalVal = typeof getOrderTotal === 'function' ? getOrderTotal(order) : (order.totalValue || 0);

    container.innerHTML = `
      <div class="mp-demo-container">
        <div class="mp-demo-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px;color:var(--color-warning);"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <strong>${I18n.t('mp.demoNoticeTitle')}</strong>
            <p>${I18n.t('mp.demoNoticeDesc')}</p>
          </div>
        </div>

        <div class="mp-demo-actions">
          <button class="btn btn-primary w-100" id="btnSimulatePixPayment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            ${I18n.t('mp.btnSimulatePix')}
          </button>
          <button class="btn btn-secondary w-100" id="btnSimulateCardPayment">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            ${I18n.t('mp.btnSimulateCard')}
          </button>
        </div>

        <div class="mp-demo-config-link">
          <small>${I18n.t('mp.configureWorkerTip')} <a href="javascript:void(0)" id="mpLinkToSettings">${I18n.t('mp.goToSettings')}</a></small>
        </div>
      </div>
    `;

    document.getElementById('btnSimulatePixPayment').onclick = () => {
      const mockPix = {
        id: 'DEMO_PIX_' + Date.now(),
        status: 'pending',
        transaction_amount: totalVal,
        qr_code: '00020126580014br.gov.bcb.pix0136demo-confeitex-chave-pix520400005303986540' + totalVal.toFixed(2) + '5802BR5915Confeitex App6009Sao Paulo62070503***6304ABCD',
        qr_code_base64: null,
      };
      this._renderPixPendingView(mockPix, order);
    };

    document.getElementById('btnSimulateCardPayment').onclick = () => {
      const mockPayment = {
        id: 'DEMO_CARD_' + Date.now(),
        status: 'approved',
        transaction_amount: totalVal,
        payment_method_id: 'cartao_credito',
      };
      this._onPaymentApproved(mockPayment, order);
    };

    const linkSettings = document.getElementById('mpLinkToSettings');
    if (linkSettings) {
      linkSettings.onclick = () => {
        this.closeCheckout();
        const settingsTab = document.querySelector('.nav-link[data-tab="settings"]');
        if (settingsTab) settingsTab.click();
      };
    }
  },

  // ─── Atualiza o Pedido no Estado Local como Pago ─────────────────────────
  _markOrderAsPaid(orderId, paymentId, method) {
    if (typeof State === 'undefined' || !State.orders) return;
    const idx = State.orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      State.orders[idx].mpPaymentId = paymentId;
      State.orders[idx].mpPaymentStatus = 'approved';
      State.orders[idx].paymentMethod = method ? `Mercado Pago (${method})` : 'Mercado Pago';
      // Se não estava entregue, pode manter ou sugerir
      State.saveOrders();
      if (typeof Dashboard !== 'undefined' && Dashboard.update) Dashboard.update();
      if (typeof Orders !== 'undefined' && Orders.render) Orders.render();
    }
  },

  // ─── Controle Visual de Telas no Modal ───────────────────────────────────
  _showView(viewName) {
    const loading = document.getElementById('mpBrickLoading');
    const container = document.getElementById('mpBrickContainer');
    const success = document.getElementById('mpBrickSuccess');
    const error = document.getElementById('mpBrickError');
    const pix = document.getElementById('mpBrickPix');

    if (loading) loading.style.display = viewName === 'loading' ? 'flex' : 'none';
    if (container) container.style.display = viewName === 'brick' ? 'block' : 'none';
    if (success) success.style.display = viewName === 'success' ? 'flex' : 'none';
    if (error) error.style.display = viewName === 'error' ? 'flex' : 'none';
    if (pix) pix.style.display = viewName === 'pix' ? 'block' : 'none';
  },

  _showError(msg) {
    this._stopPolling();
    this._showView('error');
    const errorMsgEl = document.getElementById('mpErrorMessage');
    if (errorMsgEl) {
      errorMsgEl.textContent = msg || I18n.t('mp.errGeneric');
    }
  },

  closeCheckout() {
    this._stopPolling();
    const modal = document.getElementById('mpPaymentModal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => { modal.style.display = 'none'; }, 200);
    }
    if (this._currentBrickController && typeof this._currentBrickController.unmount === 'function') {
      try { this._currentBrickController.unmount(); } catch (e) {}
      this._currentBrickController = null;
    }
    this._currentOrder = null;
    this._currentPaymentId = null;
  },

  // ─── Helpers de Plano & Assinatura ───────────────────────────────────────
  async createCardToken(cardData) {
    await this._ensureReady();
    if (!this._mp || typeof this._mp.createCardToken !== 'function') {
      throw new Error('SDK do Mercado Pago não suporta tokenização no momento.');
    }

    try {
      const token = await this._mp.createCardToken({
        cardNumber: (cardData.cardNumber || '').replace(/\D/g, ''),
        cardholderName: (cardData.cardholderName || '').trim(),
        cardExpirationMonth: String(cardData.cardExpirationMonth || '').padStart(2, '0'),
        cardExpirationYear: String(cardData.cardExpirationYear || '').length === 2 ? `20${cardData.cardExpirationYear}` : String(cardData.cardExpirationYear),
        securityCode: String(cardData.securityCode || '').trim(),
        identification: cardData.identification ? {
          type: cardData.identification.type || 'CPF',
          number: (cardData.identification.number || '').replace(/\D/g, ''),
        } : undefined,
      });

      return token;
    } catch (err) {
      console.error('[MP createCardToken Error]', err);
      throw err;
    }
  },

  async validateCardForTrial(cardData) {
    if (!this.isConfigured()) {
      // Modo Demonstração quando worker não configurado
      return {
        valid: true,
        demo: true,
        token: 'DEMO_CARD_TOKEN_' + Date.now(),
        lastFourDigits: (cardData.cardNumber || '').replace(/\D/g, '').slice(-4) || '4242',
        cardholderName: cardData.cardholderName || 'Cliente Confeitex',
        expirationMonth: cardData.cardExpirationMonth,
        expirationYear: cardData.cardExpirationYear,
        brand: this.detectCardBrand(cardData.cardNumber),
      };
    }

    try {
      const tokenObj = await this.createCardToken(cardData);
      const token = tokenObj.id;

      const res = await fetch(`${this.WORKER_URL}/validate-card`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify({
          token: token,
          email: cardData.email || 'assinante@confeitex.app',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Não foi possível validar o cartão no Mercado Pago.');
      }

      return {
        valid: true,
        token: token,
        lastFourDigits: tokenObj.last_four_digits || (cardData.cardNumber || '').replace(/\D/g, '').slice(-4),
        cardholderName: cardData.cardholderName,
        expirationMonth: cardData.cardExpirationMonth,
        expirationYear: cardData.cardExpirationYear,
        brand: tokenObj.payment_method_id || this.detectCardBrand(cardData.cardNumber),
      };
    } catch (err) {
      console.error('[MP validateCardForTrial Error]', err);
      throw err;
    }
  },

  async processPlanPayment(payload) {
    if (!this.isConfigured()) {
      // Modo demonstração
      if (payload.payment_method_id === 'pix') {
        return {
          id: 'DEMO_PLAN_PIX_' + Date.now(),
          status: 'pending',
          transaction_amount: payload.amount || 7.99,
          qr_code: '00020126580014br.gov.bcb.pix0136demo-confeitex-plano5204000053039865407.995802BR5915Confeitex App6009Sao Paulo62070503***6304ABCD',
          qr_code_base64: null,
        };
      } else if (payload.payment_method_id === 'bolbradesco' || payload.payment_method_id === 'ticket') {
        return {
          id: 'DEMO_PLAN_BOLETO_' + Date.now(),
          status: 'pending',
          transaction_amount: payload.amount || 7.99,
          ticket_url: 'https://confeitex.app/boleto-demo',
        };
      } else {
        return {
          id: 'DEMO_PLAN_CARD_' + Date.now(),
          status: 'approved',
          transaction_amount: payload.amount || 7.99,
          date_approved: new Date().toISOString(),
        };
      }
    }

    const res = await fetch(`${this.WORKER_URL}/plan-payment`, {
      method: 'POST',
      headers: this._getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Erro ao processar cobrança do plano.');
    }
    return data;
  },

  detectCardBrand(cardNumber) {
    const clean = String(cardNumber || '').replace(/\D/g, '');
    if (/^4/.test(clean)) return 'visa';
    if (/^(5[1-5]|2[2-7])/.test(clean)) return 'mastercard';
    if (/^(401178|401179|431274|438935|451416|457393|457631|457632|504175|627780|636297|636368|5067|5090|6504|6505|6509|6516|6550)/.test(clean)) return 'elo';
    if (/^3[47]/.test(clean)) return 'amex';
    if (/^(606282|3841)/.test(clean)) return 'hipercard';
    return 'credit_card';
  },
};
