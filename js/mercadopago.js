// ============================================================================
// MercadoPagoCheckout — Integração Mercado Pago Checkout Bricks (Confeitex)
// Frontend: usa PUBLIC KEY (seguro). Backend: Worker no Cloudflare.
// ============================================================================

const MercadoPagoCheckout = {
  // ─── Configuração ──────────────────────────────────────────────────
  PUBLIC_KEY: 'APP_USR-eb677887-c0aa-416f-972e-fc46103fbe4c',
  // URL do Cloudflare Worker — substitua pelo seu domínio após deploy
  WORKER_URL: '',

  // ─── Estado interno ────────────────────────────────────────────────
  _mp: null,
  _bricksBuilder: null,
  _loaded: false,
  _currentOrderId: null,
  _paymentId: null,

  // ─── Inicialização ─────────────────────────────────────────────────
  init() {
    // Detecta automaticamente a URL do Worker (mesmo domínio ou configuração)
    if (!this.WORKER_URL) {
      // Tenta usar o Worker no mesmo domínio (via _worker subdomínio ou path)
      // Substitua pela URL real do seu Worker após deploy
      this.WORKER_URL = localStorage.getItem('confeitex_mp_worker_url') || '';
    }
  },

  setWorkerUrl(url) {
    this.WORKER_URL = url;
    localStorage.setItem('confeitex_mp_worker_url', url);
  },

  // ─── Carrega o SDK do Mercado Pago ─────────────────────────────────
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
        setTimeout(() => { clearInterval(check); reject(new Error('Timeout carregando SDK')); }, 10000);
        return;
      }
      const script = document.createElement('script');
      script.id = 'mercadopago-sdk';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        this._loaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'));
      document.head.appendChild(script);
    });
  },

  // ─── Inicializa o SDK e o bricksBuilder ────────────────────────────
  async _ensureReady() {
    await this._loadSDK();
    if (!this._mp) {
      this._mp = new MercadoPago(this.PUBLIC_KEY);
      this._bricksBuilder = this._mp.bricks();
    }
  },

  // ─── Verifica se o Worker está configurado ─────────────────────────
  _checkWorker() {
    if (!this.WORKER_URL) {
      UI.alert(I18n.t('mp.alertNoWorker'));
      return false;
    }
    return true;
  },

  // ─── Abre o checkout para um pedido ────────────────────────────────
  async openCheckout(order) {
    if (!this._checkWorker()) return;

    this._currentOrderId = order.id;

    // Abre o modal
    const modal = document.getElementById('mpCheckoutModal');
    const container = document.getElementById('mpBrickContainer');
    const loading = document.getElementById('mpBrickLoading');
    const success = document.getElementById('mpBrickSuccess');
    const error = document.getElementById('mpBrickError');

    if (!modal) { console.error('[MP] Modal não encontrado'); return; }

    container.innerHTML = '';
    loading.style.display = 'flex';
    success.style.display = 'none';
    error.style.display = 'none';
    modal.classList.add('active');

    try {
      await this._ensureReady();

      // 1. Criar pagamento via Worker
      const res = await fetch(`${this.WORKER_URL}/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.totalValue,
          description: `${order.flavor} — ${order.clientName}`,
          order_id: order.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar pagamento');
      }

      const payment = await res.json();
      this._paymentId = payment.id;

      // 2. Renderizar o Payment Brick
      loading.style.display = 'none';
      container.style.display = 'block';

      this._renderBrick(container, order, payment);

    } catch (err) {
      console.error('[MP Checkout Error]', err);
      loading.style.display = 'none';
      error.style.display = 'flex';
      error.querySelector('span').textContent = err.message || 'Erro ao inicializar checkout';
    }
  },

  // ─── Renderiza o Payment Brick ─────────────────────────────────────
  _renderBrick(container, order, paymentData) {
    container.innerHTML = '';

    const settings = {
      initialization: {
        amount: order.totalValue,
        payer: {
          email: '',
        },
      },
      customization: {
        paymentMethods: {
          creditCard: 'all',
          debitCard: 'all',
          ticket: 'all',
          bankTransfer: 'all',
          onboarding: 'all',
        },
        visual: {
          style: {
            theme: 'dark',
          },
        },
      },
      callbacks: {
        onReady: () => {
          console.log('[MP Brick] Pronto');
        },
        onSubmit: async (cardFormData) => {
          // Envia os dados do cartão para o backend criar o pagamento
          try {
            const res = await fetch(`${this.WORKER_URL}/create-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: order.totalValue,
                description: `${order.flavor} — ${order.clientName}`,
                order_id: order.id,
                payment_method_id: cardFormData.payment_method_id,
                token: cardFormData.token,
                installments: cardFormData.installments,
                payer_email: cardFormData.payer?.email,
              }),
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Erro ao processar pagamento');
            }

            const result = await res.json();
            this._onPaymentResult(result, order);
          } catch (err) {
            console.error('[MP onSubmit Error]', err);
            this._showError(err.message);
          }
        },
        onError: (error) => {
          console.error('[MP Brick Error]', error);
          this._showError(error.message || 'Erro no formulário de pagamento');
        },
      },
    };

    this._bricksBuilder.create('payment', 'mpBrickContainer', settings);
  },

  // ─── Resultado do pagamento ────────────────────────────────────────
  _onPaymentResult(payment, order) {
    const modal = document.getElementById('mpCheckoutModal');
    const container = document.getElementById('mpBrickContainer');
    const success = document.getElementById('mpBrickSuccess');

    container.style.display = 'none';
    success.style.display = 'flex';

    const statusEl = success.querySelector('.mp-success-status');
    const detailsEl = success.querySelector('.mp-success-details');

    if (payment.status === 'approved' || payment.status === 'pending') {
      statusEl.textContent = I18n.t('mp.paymentApproved');
      statusEl.style.color = 'var(--color-success)';

      // Atualizar pedido: marcar como pago
      const idx = State.orders.findIndex(o => o.id === order.id);
      if (idx !== -1) {
        State.orders[idx].mpPaymentId = payment.id;
        State.orders[idx].mpPaymentStatus = payment.status;
        State.orders[idx].paymentMethod = 'Mercado Pago';
        if (payment.status === 'approved') {
          State.orders[idx].status = 'Entregue';
          State.orders[idx].deliveredAt = new Date().toISOString();
        }
        State.saveOrders();
      }

      detailsEl.innerHTML = `
        <span>${I18n.t('mp.paymentId')}: ${payment.id}</span>
        <span>${I18n.t('mp.orderValue')}: ${fmt(order.totalValue)}</span>
        ${payment.qr_code ? `<span>Pix Copia e Cola: <code style="font-size:0.7rem;word-break:break-all;">${payment.qr_code}</code></span>` : ''}
      `;
    } else {
      statusEl.textContent = I18n.t('mp.paymentPending');
      statusEl.style.color = 'var(--color-warning)';
      detailsEl.innerHTML = `<span>${I18n.t('mp.paymentPendingMsg')}</span>`;
    }
  },

  // ─── Mostra erro no modal ──────────────────────────────────────────
  _showError(msg) {
    const container = document.getElementById('mpBrickContainer');
    const loading = document.getElementById('mpBrickLoading');
    const error = document.getElementById('mpBrickError');

    if (loading) loading.style.display = 'none';
    if (container) container.style.display = 'none';
    if (error) {
      error.style.display = 'flex';
      error.querySelector('span').textContent = msg;
    }
  },

  // ─── Fecha o modal ─────────────────────────────────────────────────
  closeCheckout() {
    const modal = document.getElementById('mpCheckoutModal');
    if (modal) modal.classList.remove('active');
    this._currentOrderId = null;
    this._paymentId = null;
  },

  // ─── Gera link de pagamento alternativo (Checkout Pro) ─────────────
  async generatePaymentLink(order) {
    if (!this._checkWorker()) return null;

    try {
      const res = await fetch(`${this.WORKER_URL}/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: order.totalValue,
          items: [{
            title: `${order.flavor} — ${order.clientName}`,
            unit_price: order.totalValue,
            quantity: 1,
            currency_id: 'BRL',
          }],
          order_id: order.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao criar link');
      }

      const data = await res.json();
      return data.init_point || data.sandbox_init_point;
    } catch (err) {
      console.error('[MP Link Error]', err);
      UI.toast(err.message || 'Erro ao gerar link de pagamento', 'danger');
      return null;
    }
  },

  // ─── Abre link de pagamento em nova aba ────────────────────────────
  async openPaymentLink(order) {
    const link = await this.generatePaymentLink(order);
    if (link) {
      window.open(link, '_blank');
    }
  },
};
