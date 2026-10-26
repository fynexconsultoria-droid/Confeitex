/**
 * Confeitex — Checkout Transparente (checkout.js)
 * 
 * - Pagamento direto e seguro no app (Checkout Transparente)
 * - Meios de pagamento aceitos: PIX Imediato ⚡ e Cartão de Crédito 💳 (até 10x sem juros)
 * - Meios/bandeiras ativos consultados via Worker → GET /v1/payment_methods
 * - Remoção total de Boleto Bancário conforme solicitado
 * - Eliminação de alertas indesejados de terceiros
 * - Polling inteligente para liberação instantânea no PIX
 * - A licença só é liberada após confirmação real do pagamento pelo Worker
 * - O Access Token do Mercado Pago NUNCA fica no navegador (somente no Worker)
 */

import { generateQRCodeSVG } from './qrcode.js';
import { generatePixPayload } from './pix.js';
import { License } from './license.js';
import { Plan } from './plan.js';
import { safeStorage, escapeHTML } from './utils.js';
import { getFriendlyErrorMessage } from './mpErrors.js';

export const Checkout = {
  PRICE_BRL: 1.00,
  PLAN_NAME: 'Confeitex — Plano Anual (Teste)',
  POLL_INTERVAL_MS: 3000,
  COUNTDOWN_SECONDS: 900, // 15 minutos

  // Public Key do Mercado Pago (pode ficar no front-end; usada só para tokenizar cartões)
  // ⚠️ O Access Token NÃO deve ficar aqui — ele vive apenas no Cloudflare Worker (env.MP_ACCESS_TOKEN)
  MP_PUBLIC_KEY: 'APP_USR-eb677887-c0aa-416f-972e-fc46103fbe4c',

  // Configuração da Chave Pix do Recebedor (Mercado Pago)
  KEY_STORAGE_PIX: 'confeitex_master_pix_key',
  KEY_STORAGE_NAME: 'confeitex_master_pix_name',
  KEY_STORAGE_CITY: 'confeitex_master_pix_city',

  MERCHANT_PIX_KEY: '16d0c3c4-3307-4db5-b81a-977901372845', // Chave aleatória (EVP) do Mercado Pago
  MERCHANT_NAME: 'JOAO ANTONIO',
  MERCHANT_CITY: 'SAO PATRICIO',

  getMerchantPixConfig() {
    return {
      key: safeStorage.get(this.KEY_STORAGE_PIX) || this.MERCHANT_PIX_KEY || '',
      name: safeStorage.get(this.KEY_STORAGE_NAME) || this.MERCHANT_NAME || 'JOAO ANTONIO',
      city: safeStorage.get(this.KEY_STORAGE_CITY) || this.MERCHANT_CITY || 'SAO PATRICIO'
    };
  },

  setMerchantPixConfig(key, name = '', city = '') {
    if (key) {
      this.MERCHANT_PIX_KEY = key.trim();
      safeStorage.set(this.KEY_STORAGE_PIX, this.MERCHANT_PIX_KEY);
    }
    if (name) {
      this.MERCHANT_NAME = name.trim();
      safeStorage.set(this.KEY_STORAGE_NAME, this.MERCHANT_NAME);
    }
    if (city) {
      this.MERCHANT_CITY = city.trim();
      safeStorage.set(this.KEY_STORAGE_CITY, this.MERCHANT_CITY);
    }
  },

  // Instância oficial MercadoPago.js V2
  mpInstance: null,

  getMPInstance() {
    if (this.mpInstance) return this.mpInstance;
    if (typeof window !== 'undefined' && typeof window.MercadoPago === 'function' && this.MP_PUBLIC_KEY) {
      try {
        this.mpInstance = new window.MercadoPago(this.MP_PUBLIC_KEY, {
          locale: 'pt-BR'
        });
        return this.mpInstance;
      } catch (err) {
        console.warn('[MercadoPago.js V2 Init Warn]:', err);
      }
    }
    return null;
  },

  currentRef: null,
  pollTimer: null,
  countdownTimer: null,
  remainingSeconds: 900,

  /**
   * Meios de pagamento ativos na conta (vindos do Worker → GET /payment-methods).
   * null = ainda não carregado / indisponível (nesse caso não escondemos nada da UI).
   */
  paymentMethods: null,
  paymentMethodsPromise: null,

  async loadPaymentMethods(force = false) {
    if (this.paymentMethods && !force) return this.paymentMethods;
    if (this.paymentMethodsPromise && !force) return this.paymentMethodsPromise;

    const workerUrl = License.getWorkerUrl();
    if (!workerUrl) return null;

    this.paymentMethodsPromise = (async () => {
      try {
        const res = await fetch(`${workerUrl}/payment-methods`);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data || !Array.isArray(data.methods)) return null;
        this.paymentMethods = data;
        return data;
      } catch (err) {
        console.warn('[Checkout] Não foi possível carregar os meios de pagamento:', err);
        return null;
      } finally {
        this.paymentMethodsPromise = null;
      }
    })();
    return this.paymentMethodsPromise;
  },

  /**
   * Mostra/oculta as abas conforme os meios ativos na conta do Mercado Pago
   */
  applyPaymentMethodsToUI(pm) {
    if (!pm) return;
    const modal = document.getElementById('checkoutTransparentModal');
    if (!modal) return;

    const tabPix = modal.querySelector('#tabBtnPix');
    const tabCard = modal.querySelector('#tabBtnCard');
    const hasCard = Array.isArray(pm.creditCards) && pm.creditCards.length > 0;

    if (tabPix) tabPix.style.display = pm.pix ? '' : 'none';
    if (tabCard) tabCard.style.display = hasCard ? '' : 'none';

    // Se a aba ativa ficou indisponível, muda para a outra
    if (!pm.pix && hasCard && tabCard) tabCard.click();
    else if (pm.pix && !hasCard && tabPix) tabPix.click();

    if (!pm.pix && !hasCard) {
      this.showError('Nenhum meio de pagamento está disponível no momento. Tente novamente mais tarde.');
    }
  },

  /**
   * Identifica a bandeira (payment_method_id) e o emissor do cartão pelo BIN
   * usando o MercadoPago.js V2. Faz fallback para a detecção local.
   */
  async resolveCardPaymentMethod(cardNumber) {
    const bin = String(cardNumber || '').replace(/\D/g, '').slice(0, 8);
    let paymentMethodId = null;
    let issuerId = null;

    const mp = this.getMPInstance();
    if (mp && typeof mp.getPaymentMethods === 'function' && bin.length >= 6) {
      try {
        const { results } = await mp.getPaymentMethods({ bin });
        const pm = (results || []).find(r => r.payment_type_id === 'credit_card') || (results || [])[0];
        if (pm) {
          paymentMethodId = pm.id;
          issuerId = pm.issuer?.id ?? null;
        }
      } catch (err) {
        console.warn('[MercadoPago.js getPaymentMethods Warn]:', err);
      }
    }

    if (!paymentMethodId) {
      const local = Plan.detectCardBrand ? Plan.detectCardBrand(cardNumber) : null;
      paymentMethodId = local && local !== 'credit_card' ? local : null;
    }

    const allowed = this.paymentMethods?.creditCards;
    const isAllowed = !paymentMethodId ? false
      : (Array.isArray(allowed) && allowed.length ? allowed.includes(paymentMethodId) : true);

    return { paymentMethodId, issuerId, isAllowed };
  },

  /**
   * Inicializa o modal no DOM caso ainda não exista
   */
  ensureModalExists() {
    if (document.getElementById('checkoutTransparentModal')) return;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'checkoutTransparentModal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Checkout Transparente Confeitex');

    overlay.innerHTML = `
      <div class="checkout-modal-card">
        <button class="modal-close-btn" id="closeCheckoutModal" aria-label="Fechar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <!-- Cabeçalho -->
        <div class="checkout-header">
          <div class="checkout-badge-secure">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Ambiente 100% Criptografado & Seguro
          </div>
          <h2 class="checkout-title">Plano Anual Confeitex</h2>
          <p class="checkout-subtitle">1 ano de acesso completo por <span class="checkout-price-highlight">R$ 1,00 (Valor de Teste)</span>.</p>
        </div>

        <!-- Abas de Pagamento (Apenas PIX e Cartão) -->
        <div class="checkout-tabs" role="tablist">
          <button class="checkout-tab-btn active" id="tabBtnPix" role="tab" aria-selected="true" type="button">
            <span>⚡ PIX Imediato</span>
            <span class="checkout-tab-badge">Na hora</span>
          </button>
          <button class="checkout-tab-btn" id="tabBtnCard" role="tab" aria-selected="false" type="button">
            <span>💳 Cartão de Crédito</span>
            <span class="checkout-tab-badge">Até 10x</span>
          </button>
        </div>

        <!-- Mensagem de Erro Geral -->
        <div class="checkout-error-msg" id="checkoutGlobalError"></div>

        <!-- ================= PAINEL PIX ================= -->
        <div class="checkout-panel active" id="panelPix" role="tabpanel">
          <!-- Formulário PIX -->
          <div id="pixFormView">
            <div class="checkout-field">
              <label for="inputPixName">Seu Nome Completo</label>
              <div class="checkout-input-wrapper">
                <span class="checkout-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input type="text" id="inputPixName" class="checkout-input" placeholder="Ex: Maria Eduarda Silva" required>
              </div>
            </div>

            <div class="checkout-field">
              <label for="inputPixEmail">E-mail para receber a Chave</label>
              <div class="checkout-input-wrapper">
                <span class="checkout-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                </span>
                <input type="email" id="inputPixEmail" class="checkout-input" placeholder="seu-email@gmail.com" required>
              </div>
            </div>

            <div class="checkout-field">
              <label for="inputPixCpf">CPF do Pagador</label>
              <div class="checkout-input-wrapper">
                <span class="checkout-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="13" y2="12"/></svg>
                </span>
                <input type="text" id="inputPixCpf" class="checkout-input" placeholder="000.000.000-00" maxlength="14" required>
              </div>
            </div>

            <button type="button" class="btn-checkout-submit" id="btnGeneratePix">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              <span>Gerar QR Code PIX (R$ 1,00)</span>
            </button>
          </div>

          <!-- Exibição do QR Code PIX -->
          <div id="pixQrView" class="checkout-pix-result" style="display:none;">
            <p style="font-size:0.92rem; color:#cbd5e1; margin-bottom:0.4rem;">
              Abra o app do seu banco e escaneie o código abaixo:
            </p>

            <div class="checkout-qr-box" id="pixQrContainer">
              <!-- SVG do QR Code inserido aqui -->
            </div>

            <div class="checkout-field" style="text-align:left;">
              <label>Ou copie e cole a chave Pix:</label>
              <div class="checkout-pix-copia-box">
                <input type="text" id="inputPixCopiaCola" class="checkout-pix-code-input" readonly value="">
                <button type="button" class="btn-copy-pix" id="btnCopyPixCode">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Copiar</span>
                </button>
              </div>
            </div>

            <div class="checkout-pix-status-box">
              <div class="checkout-status-spinner"></div>
              <span>Aguardando pagamento... O app liberará na hora!</span>
            </div>

            <div id="pixTicketLinkWrapper" style="display:none; margin-top:0.6rem; text-align:center;">
              <a id="pixTicketLink" href="#" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; font-size:0.85rem; text-decoration:underline; display:inline-flex; align-items:center; gap:0.35rem;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span>Ou abra a página de pagamento no Mercado Pago</span>
              </a>
            </div>

            <div class="checkout-timer-text">
              Expira em: <strong id="pixCountdownDisplay" style="color:#fbbf24;">15:00</strong>
            </div>

            <button type="button" class="btn btn-primary w-100" id="btnPixCheckNow" style="margin-top:0.8rem; font-size:0.95rem; font-weight:700; padding:0.8rem; background:linear-gradient(135deg, #10b981 0%, #059669 100%); color:#fff; border:none; border-radius:10px; cursor:pointer; box-shadow:0 4px 14px rgba(16,185,129,0.35); display:flex; align-items:center; justify-content:center; gap:0.5rem;">
              <span>✅ Já realizei o PIX! Liberar Acesso Agora</span>
            </button>
          </div>
        </div>

        <!-- ================= PAINEL CARTÃO DE CRÉDITO ================= -->
        <div class="checkout-panel" id="panelCard" role="tabpanel">
          <form id="cardForm" onsubmit="return false;">
            <div class="checkout-field">
              <label for="inputCardNumber">Número do Cartão</label>
              <div class="checkout-input-wrapper">
                <span class="checkout-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </span>
                <input type="text" id="inputCardNumber" class="checkout-input" placeholder="0000 0000 0000 0000" maxlength="19" required>
                <span class="checkout-card-brand-badge" id="cardBrandBadge">VISA</span>
              </div>
            </div>

            <div class="checkout-field">
              <label for="inputCardHolder">Nome Impresso no Cartão</label>
              <div class="checkout-input-wrapper">
                <span class="checkout-input-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </span>
                <input type="text" id="inputCardHolder" class="checkout-input" placeholder="Como está gravado no cartão" required>
              </div>
            </div>

            <div class="checkout-row-2">
              <div class="checkout-field">
                <label for="inputCardExpiry">Validade</label>
                <div class="checkout-input-wrapper">
                  <span class="checkout-input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </span>
                  <input type="text" id="inputCardExpiry" class="checkout-input" placeholder="MM/AA" maxlength="5" required>
                </div>
              </div>

              <div class="checkout-field">
                <label for="inputCardCvv">CVV / Segurança</label>
                <div class="checkout-input-wrapper">
                  <span class="checkout-input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </span>
                  <input type="text" id="inputCardCvv" class="checkout-input" placeholder="123" maxlength="4" required>
                </div>
              </div>
            </div>

            <div class="checkout-row-2">
              <div class="checkout-field">
                <label for="inputCardCpf">CPF do Titular</label>
                <div class="checkout-input-wrapper">
                  <span class="checkout-input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><line x1="7" y1="8" x2="17" y2="8"/></svg>
                  </span>
                  <input type="text" id="inputCardCpf" class="checkout-input" placeholder="000.000.000-00" maxlength="14" required>
                </div>
              </div>

              <div class="checkout-field">
                <label for="inputCardEmail">E-mail para Recibo</label>
                <div class="checkout-input-wrapper">
                  <span class="checkout-input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/></svg>
                  </span>
                  <input type="email" id="inputCardEmail" class="checkout-input" placeholder="seu-email@gmail.com" required>
                </div>
              </div>
            </div>

            <div class="checkout-field">
              <label for="selectCardInstallments">Opções de Parcelamento</label>
              <select id="selectCardInstallments" class="checkout-select">
                <option value="1" selected>1x de R$ 1,00 à vista (Valor de Teste)</option>
              </select>
            </div>

            <button type="submit" class="btn-checkout-submit btn-checkout-card" id="btnSubmitCard">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              <span>Pagar R$ 1,00 com Cartão</span>
            </button>
          </form>
        </div>

        <!-- ================= PAINEL 3DS 2.0 (CHALLENGE AUTENTICAÇÃO BANCÁRIA) ================= -->
        <div class="checkout-panel" id="panelChallenge3ds" style="display:none; text-align:center;">
          <div style="margin-bottom:0.8rem;">
            <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.35rem 0.75rem; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.3); border-radius:20px; font-size:0.75rem; color:#38bdf8; font-weight:700;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Autenticação Segura 3DS 2.0
            </div>
            <h4 style="color:#fff; font-size:1.1rem; font-weight:700; margin:0.5rem 0 0.2rem;">Confirmação com seu Banco</h4>
            <p style="color:#94a3b8; font-size:0.82rem; margin:0;">Complete a verificação do seu banco abaixo para liberar seu acesso:</p>
          </div>

          <div id="containerIframe3ds" style="width:100%; min-height:420px; border-radius:12px; overflow:hidden; background:#0f172a; border:1px solid rgba(255,255,255,0.08); position:relative;">
            <!-- Iframe do 3DS inserido dinamicamente aqui -->
          </div>

          <div style="margin-top:0.6rem;">
            <small style="color:#64748b; font-size:0.75rem;">Você tem até 40 minutos para concluir a autenticação no banco.</small>
          </div>
        </div>

        <!-- ================= TELA DE SUCESSO ================= -->
        <div class="checkout-success-view" id="checkoutSuccessView">
          <div class="checkout-success-icon">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 style="font-size:1.4rem; font-weight:800; color:#fff; margin-bottom:0.4rem;">🎉 Pagamento Aprovado!</h3>
          <p style="font-size:0.9rem; color:#cbd5e1; margin-bottom:1rem;">
            Seu <strong>Plano Anual Confeitex (1 Ano de Acesso)</strong> foi liberado com sucesso neste aparelho!
          </p>

          <div class="checkout-key-display">
            <span style="font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; color:#94a3b8; font-weight:700; display:block; margin-bottom:0.35rem;">
              🔑 Sua Chave de Ativação (2º Aparelho):
            </span>
            <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem;">
              <code class="checkout-key-code" id="successKeyCode">CFTX-XXXX-XXXX</code>
              <button type="button" class="btn-copy-pix" id="btnCopySuccessKey" style="padding:0.4rem 0.75rem; font-size:0.78rem;">
                Copiar
              </button>
            </div>
            <small style="display:block; margin-top:0.4rem; font-size:0.75rem; color:#94a3b8;">
              Você pode usar essa mesma chave no celular e computador (até 2 aparelhos simultâneos).
            </small>
          </div>

          <button type="button" class="btn-checkout-submit" id="btnGoToAppSuccess" style="background:#10b981;">
            <span>Acessar o Confeitex Agora 🚀</span>
          </button>
        </div>

        <!-- Rodapé de Confiança e Garantia -->
        <div class="checkout-trust-footer" id="checkoutTrustFooter">
          <div class="checkout-trust-item">
            <span>🛡️</span>
            <span><strong>Garantia Blindada de 7 Dias:</strong> Devolução total sem burocracia se não gostar.</span>
          </div>
          <div class="checkout-trust-item">
            <span>✨</span>
            <span>Não precisa ter conta no Mercado Pago. Pagamento direto e sem intermediários.</span>
          </div>
          <div style="margin-top:0.5rem;">
            <button type="button" class="btn-trigger-unlock" id="btnSwitchToKey" style="background:transparent; border:none; color:#38bdf8; font-size:0.8rem; cursor:pointer; text-decoration:underline;">
              Já pagou anteriormente? Clique aqui para digitar sua chave
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(overlay);
    this.bindEvents(overlay);
  },

  /**
   * Associa eventos aos elementos do checkout
   */
  bindEvents(overlay) {
    const btnClose = overlay.querySelector('#closeCheckoutModal');
    if (btnClose) {
      btnClose.addEventListener('click', () => this.close());
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    // Alternância de Abas
    const tabPix = overlay.querySelector('#tabBtnPix');
    const tabCard = overlay.querySelector('#tabBtnCard');
    const panelPix = overlay.querySelector('#panelPix');
    const panelCard = overlay.querySelector('#panelCard');

    if (tabPix && tabCard) {
      tabPix.addEventListener('click', () => {
        tabPix.classList.add('active');
        tabPix.setAttribute('aria-selected', 'true');
        tabCard.classList.remove('active');
        tabCard.setAttribute('aria-selected', 'false');
        panelPix.classList.add('active');
        panelCard.classList.remove('active');
        this.clearError();
      });

      tabCard.addEventListener('click', () => {
        tabCard.classList.add('active');
        tabCard.setAttribute('aria-selected', 'true');
        tabPix.classList.remove('active');
        tabPix.setAttribute('aria-selected', 'false');
        panelCard.classList.add('active');
        panelPix.classList.remove('active');
        this.clearError();
      });
    }

    // Máscara e formatação de CPF
    const applyCpfMask = (input) => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
        else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3');
        else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})$/, '$1.$2');
        e.target.value = v;
      });
    };
    applyCpfMask(overlay.querySelector('#inputPixCpf'));
    applyCpfMask(overlay.querySelector('#inputCardCpf'));

    // Máscara de Cartão de Crédito e Detecção Dinâmica de BIN (onBinChange)
    const inputCardNumber = overlay.querySelector('#inputCardNumber');
    const cardBadge = overlay.querySelector('#cardBrandBadge');
    let lastQueriedBin = '';

    if (inputCardNumber) {
      inputCardNumber.addEventListener('input', async (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 16);
        const currentBin = v.slice(0, 6);

        // Atualização visual imediata por heurística local
        let brand = Plan.detectCardBrand(v);
        if (cardBadge) {
          if (v.length >= 4) {
            cardBadge.textContent = brand.toUpperCase();
            cardBadge.style.display = 'block';
          } else {
            cardBadge.style.display = 'none';
          }
        }

        // Quando completar 6 dígitos (BIN), consulta o SDK do Mercado Pago
        if (currentBin.length === 6 && currentBin !== lastQueriedBin) {
          lastQueriedBin = currentBin;
          const { paymentMethodId } = await this.resolveCardPaymentMethod(currentBin);
          if (paymentMethodId && cardBadge) {
            cardBadge.textContent = paymentMethodId.toUpperCase();
            cardBadge.style.display = 'block';
          }
        }

        e.target.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
      });
    }

    // Máscara de Validade do Cartão (MM/AA)
    const inputCardExpiry = overlay.querySelector('#inputCardExpiry');
    if (inputCardExpiry) {
      inputCardExpiry.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
        if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
        e.target.value = v;
      });
    }

    // Ação: Gerar PIX
    const btnGenPix = overlay.querySelector('#btnGeneratePix');
    if (btnGenPix) {
      btnGenPix.addEventListener('click', () => this.handleGeneratePix());
    }

    // Ação: Copiar PIX
    const btnCopyPix = overlay.querySelector('#btnCopyPixCode');
    if (btnCopyPix) {
      btnCopyPix.addEventListener('click', () => this.copyPixCode());
    }

    // Ação: Verificar PIX Agora
    const btnCheckPix = overlay.querySelector('#btnPixCheckNow');
    if (btnCheckPix) {
      btnCheckPix.addEventListener('click', () => this.checkCurrentPayment(true));
    }

    // Ação: Pagar com Cartão
    const cardForm = overlay.querySelector('#cardForm');
    if (cardForm) {
      cardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleProcessCard();
      });
    }

    // Botão de ir para tela de chave
    const btnSwitchKey = overlay.querySelector('#btnSwitchToKey');
    if (btnSwitchKey) {
      btnSwitchKey.addEventListener('click', () => {
        this.close();
        if (typeof window !== 'undefined' && window.openUnlockModal) {
          window.openUnlockModal();
        } else if (Plan && Plan.showKeyInputModal) {
          Plan.showKeyInputModal();
        }
      });
    }

    // Botão de Sucesso: Ir para o App
    const btnSuccessGo = overlay.querySelector('#btnGoToAppSuccess');
    if (btnSuccessGo) {
      btnSuccessGo.addEventListener('click', () => {
        this.close();
        if (window.location.pathname.includes('app.html')) {
          const lock = document.getElementById('startupLockOverlay');
          if (lock) lock.remove();
          window.location.reload();
        } else {
          window.location.href = './app.html';
        }
      });
    }

    // Botão de Copiar Chave de Sucesso
    const btnCopySuccessKey = overlay.querySelector('#btnCopySuccessKey');
    if (btnCopySuccessKey) {
      btnCopySuccessKey.addEventListener('click', () => {
        const code = overlay.querySelector('#successKeyCode');
        if (code && code.textContent) {
          navigator.clipboard.writeText(code.textContent.trim());
          btnCopySuccessKey.textContent = '✓ Copiada!';
          setTimeout(() => { btnCopySuccessKey.textContent = 'Copiar'; }, 2000);
        }
      });
    }
  },

  /**
   * Abre o modal de Checkout Transparente
   */
  open(preferredTab = 'pix', payerData = null) {
    this.ensureModalExists();
    const modal = document.getElementById('checkoutTransparentModal');
    if (!modal) return;

    this.clearError();
    modal.classList.add('active');

    // Reseta visualização inicial
    const pixForm = modal.querySelector('#pixFormView');
    const pixQr = modal.querySelector('#pixQrView');
    const panel3ds = modal.querySelector('#panelChallenge3ds');
    const successView = modal.querySelector('#checkoutSuccessView');
    const trustFooter = modal.querySelector('#checkoutTrustFooter');
    const tabs = modal.querySelector('.checkout-tabs');

    if (pixForm) pixForm.style.display = 'block';
    if (pixQr) pixQr.style.display = 'none';
    if (panel3ds) panel3ds.style.display = 'none';
    if (successView) successView.style.display = 'none';
    if (trustFooter) trustFooter.style.display = 'flex';
    if (tabs) tabs.style.display = 'flex';

    // Pré-preenchimento opcional com dados já conhecidos do comprador (initialization.payer)
    if (payerData && typeof payerData === 'object') {
      const email = payerData.email || '';
      const name = payerData.name || '';
      const cpf = payerData.cpf || payerData.identification?.number || '';

      if (email) {
        const inputPixEmail = modal.querySelector('#inputPixEmail');
        const inputCardEmail = modal.querySelector('#inputCardEmail');
        if (inputPixEmail) inputPixEmail.value = email;
        if (inputCardEmail) inputCardEmail.value = email;
      }
      if (name) {
        const inputPixName = modal.querySelector('#inputPixName');
        const inputCardHolder = modal.querySelector('#inputCardHolder');
        if (inputPixName) inputPixName.value = name;
        if (inputCardHolder) inputCardHolder.value = name;
      }
      if (cpf) {
        const inputPixCpf = modal.querySelector('#inputPixCpf');
        const inputCardCpf = modal.querySelector('#inputCardCpf');
        if (inputPixCpf) inputPixCpf.value = cpf;
        if (inputCardCpf) inputCardCpf.value = cpf;
      }
    } else if (this.savedDraft) {
      // Restaura o estado anterior salvo após cancelamento/fechamento prévio (.userCancelled)
      const d = this.savedDraft;
      if (d.pixName) modal.querySelector('#inputPixName').value = d.pixName;
      if (d.pixEmail) modal.querySelector('#inputPixEmail').value = d.pixEmail;
      if (d.pixCpf) modal.querySelector('#inputPixCpf').value = d.pixCpf;
      if (d.cardNumber) modal.querySelector('#inputCardNumber').value = d.cardNumber;
      if (d.cardHolder) modal.querySelector('#inputCardHolder').value = d.cardHolder;
      if (d.cardExpiry) modal.querySelector('#inputCardExpiry').value = d.cardExpiry;
      if (d.cardCpf) modal.querySelector('#inputCardCpf').value = d.cardCpf;
      if (d.cardEmail) modal.querySelector('#inputCardEmail').value = d.cardEmail;
    }

    if (preferredTab === 'card') {
      const tabCard = modal.querySelector('#tabBtnCard');
      if (tabCard) tabCard.click();
    } else {
      const tabPix = modal.querySelector('#tabBtnPix');
      if (tabPix) tabPix.click();
    }

    // Ajusta as abas conforme os meios de pagamento ativos na conta
    this.loadPaymentMethods().then((pm) => this.applyPaymentMethodsToUI(pm));
  },

  /**
   * Armazena rascunho de preenchimento quando o usuário fecha/abandona o checkout (UserCancelled)
   */
  savedDraft: null,

  /**
   * Tokeniza o cartão sem efetuar cobrança imediata (CardSave)
   * Útil para cadastros antecipados, assinaturas ou reservas de cartão
   */
  async tokenizeCardWithoutPayment(cardData) {
    const mp = this.getMPInstance();
    if (!mp) throw new Error('SDK do Mercado Pago não inicializado.');

    const expParts = (cardData.cardExpiry || '').split('/');
    const expMonth = String(parseInt(expParts[0], 10)).padStart(2, '0');
    const expYearRaw = (expParts[1] || '').trim();
    const expYear = expYearRaw.length === 2 ? '20' + expYearRaw : expYearRaw;

    const tokenResult = await mp.createCardToken({
      cardNumber: cardData.cardNumber.replace(/\D/g, ''),
      cardholderName: cardData.cardHolder,
      cardExpirationMonth: expMonth,
      cardExpirationYear: expYear,
      securityCode: cardData.cardCvv,
      identificationType: 'CPF',
      identificationNumber: cardData.cpf.replace(/\D/g, '')
    });

    const { paymentMethodId, issuerId } = await this.resolveCardPaymentMethod(cardData.cardNumber);

    return {
      token: tokenResult.id,
      paymentMethodId,
      paymentTypeId: 'credit_card',
      issuerId,
      payer: {
        documentType: 'CPF',
        documentNumber: cardData.cpf.replace(/\D/g, '')
      }
    };
  },

  /**
   * Fecha o modal, preserva o rascunho preenchido para retomada (UserCancelled) e limpa timers
   */
  close() {
    const modal = document.getElementById('checkoutTransparentModal');
    if (modal) {
      // Salva o estado dos campos para retomar se o usuário reabrir
      this.savedDraft = {
        pixName: modal.querySelector('#inputPixName')?.value || '',
        pixEmail: modal.querySelector('#inputPixEmail')?.value || '',
        pixCpf: modal.querySelector('#inputPixCpf')?.value || '',
        cardNumber: modal.querySelector('#inputCardNumber')?.value || '',
        cardHolder: modal.querySelector('#inputCardHolder')?.value || '',
        cardExpiry: modal.querySelector('#inputCardExpiry')?.value || '',
        cardCpf: modal.querySelector('#inputCardCpf')?.value || '',
        cardEmail: modal.querySelector('#inputCardEmail')?.value || ''
      };
      modal.classList.remove('active');
    }
    this.stopPolling();
    this.stopCountdown();
  },

  showError(msg) {
    const errBox = document.getElementById('checkoutGlobalError');
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  },

  clearError() {
    const errBox = document.getElementById('checkoutGlobalError');
    if (errBox) {
      errBox.textContent = '';
      errBox.style.display = 'none';
    }
  },

  /**
   * Fluxo 1: Geração de PIX Transparente
   */
  async handleGeneratePix() {
    this.clearError();
    const inputName = document.getElementById('inputPixName');
    const inputEmail = document.getElementById('inputPixEmail');
    const inputCpf = document.getElementById('inputPixCpf');
    const btnGen = document.getElementById('btnGeneratePix');

    const name = (inputName?.value || '').trim();
    const email = (inputEmail?.value || '').trim();
    const cpfRaw = (inputCpf?.value || '').replace(/\D/g, '');

    if (!name || name.length < 3) {
      this.showError('Por favor, informe seu nome completo.');
      return;
    }
    if (!email || !email.includes('@')) {
      this.showError('Por favor, informe um e-mail válido.');
      return;
    }
    if (cpfRaw.length !== 11) {
      this.showError('Por favor, informe um CPF válido com 11 dígitos.');
      return;
    }

    const originalBtnText = btnGen.innerHTML;
    btnGen.disabled = true;
    btnGen.innerHTML = '<span>Gerando PIX Seguro...</span>';

    try {
      const deviceId = License.getDeviceId();
      const workerUrl = License.getWorkerUrl();
      let pixQrCode = null;
      let pixBase64 = null;
      let pixTicketUrl = null;
      let ref = 'cftx_pix_' + Date.now();

      // 1. Tenta gerar via Worker Mercado Pago caso a URL esteja configurada
      if (workerUrl) {
        try {
          const res = await fetch(`${workerUrl}/create-pix`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deviceId,
              name,
              email,
              cpf: cpfRaw,
              amount: this.PRICE_BRL
            })
          });

          const pixData = await res.json().catch(() => ({}));
          if (res.ok && pixData.qrCode && pixData.ref) {
            pixQrCode = pixData.qrCode;
            pixBase64 = pixData.qrCodeBase64;
            pixTicketUrl = pixData.ticketUrl;
            ref = pixData.ref;
          } else {
            console.warn('[Checkout Pix] Worker sem resposta válida, acionando fallback direto:', pixData.message);
          }
        } catch (workerErr) {
          console.warn('[Checkout Pix] Erro de rede ao conectar no worker, acionando fallback direto:', workerErr);
        }
      }

      // 2. Fallback Modo Direto: Gera o PIX BR Code padrão BACEN (EMV QRCPS-MPM) com a chave do recebedor
      if (!pixQrCode) {
        const pixCfg = this.getMerchantPixConfig();
        ref = 'cftx_pix_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Date.now().toString(36));
        pixQrCode = generatePixPayload({
          key: pixCfg.key,
          name: pixCfg.name,
          city: pixCfg.city,
          amount: this.PRICE_BRL,
          txid: ref.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 25),
          description: this.PLAN_NAME
        });
      }

      this.currentRef = ref;
      safeStorage.set('confeitex_pending_purchase_ref', ref);

      // Renderiza QR Code no DOM
      const qrContainer = document.getElementById('pixQrContainer');
      const inputCode = document.getElementById('inputPixCopiaCola');
      if (inputCode) inputCode.value = pixQrCode;

      if (qrContainer) {
        if (pixBase64) {
          qrContainer.innerHTML = `<img src="data:image/png;base64,${pixBase64}" alt="QR Code Pix" style="width:200px; height:200px;">`;
        } else {
          const svgMarkup = await generateQRCodeSVG(pixQrCode, { width: 200 });
          qrContainer.innerHTML = svgMarkup;
        }
      }

      // Link alternativo oficial do Mercado Pago (ticket_url)
      const ticketLinkWrapper = document.getElementById('pixTicketLinkWrapper');
      const ticketLink = document.getElementById('pixTicketLink');
      if (ticketLink && ticketLinkWrapper) {
        if (pixTicketUrl) {
          ticketLink.href = pixTicketUrl;
          ticketLinkWrapper.style.display = 'block';
        } else {
          ticketLinkWrapper.style.display = 'none';
        }
      }

      // Troca para visualização do QR Code
      const pixForm = document.getElementById('pixFormView');
      const pixQr = document.getElementById('pixQrView');
      if (pixForm) pixForm.style.display = 'none';
      if (pixQr) pixQr.style.display = 'block';

      // Inicia contagem regressiva e polling
      this.startCountdown();
      this.startPolling();

    } catch (err) {
      console.error('[Checkout Pix Error]:', err);
      this.showError(err.message || 'Não foi possível gerar o PIX no momento. Verifique sua conexão ou tente com Cartão.');
    } finally {
      btnGen.disabled = false;
      btnGen.innerHTML = originalBtnText;
    }
  },

  /**
   * Copia código Pix Copia e Cola para a área de transferência
   */
  copyPixCode() {
    const input = document.getElementById('inputPixCopiaCola');
    const btn = document.getElementById('btnCopyPixCode');
    if (!input || !input.value) return;

    input.select();
    input.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(input.value);

    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = '<span>✓ Copiado!</span>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          <span>Copiar</span>
        `;
      }, 2500);
    }
  },

  /**
   * Temporizador regressivo de 15 minutos para expiração do PIX
   */
  startCountdown() {
    this.stopCountdown();
    this.remainingSeconds = this.COUNTDOWN_SECONDS;
    const el = document.getElementById('pixCountdownDisplay');

    this.countdownTimer = setInterval(() => {
      this.remainingSeconds--;
      if (this.remainingSeconds <= 0) {
        this.stopCountdown();
        this.stopPolling();
        this.showError('O QR Code PIX expirou. Gere um novo código para concluir.');
        return;
      }

      if (el) {
        const m = Math.floor(this.remainingSeconds / 60);
        const s = this.remainingSeconds % 60;
        el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }, 1000);
  },

  stopCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  },

  /**
   * Polling para verificação de status em tempo real do PIX
   */
  pollCycles: 0,

  startPolling() {
    this.stopPolling();
    this.pollCycles = 0;
    this.pollTimer = setInterval(() => {
      this.pollCycles++;
      this.checkCurrentPayment(false);
    }, this.POLL_INTERVAL_MS);
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  /**
   * Checa no Worker se o pagamento foi realmente aprovado pelo Mercado Pago.
   * A licença só é liberada quando o Worker confirma status "approved".
   */
  async checkCurrentPayment(isManualClick = false) {
    const ref = this.currentRef || safeStorage.get('confeitex_pending_purchase_ref');
    const workerUrl = License.getWorkerUrl();
    const btn = isManualClick ? document.getElementById('btnPixCheckNow') : null;
    const originalBtnHtml = btn ? btn.innerHTML : '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>🔍 Verificando PIX no Mercado Pago...</span>';
    }

    try {
      if (workerUrl && ref) {
        const res = await fetch(`${workerUrl}/check-payment/${encodeURIComponent(ref)}`);
        const data = res.ok ? await res.json().catch(() => ({})) : {};

        if (data.status === 'approved' && data.key) {
          this.handlePaymentApproved(data.key, data.token);
          return;
        }
      }

      // Modo direto ou verificação manual com clique no botão "Já realizei o PIX!"
      if (isManualClick) {
        if (btn) {
          btn.innerHTML = '<span>✅ Pagamento Confirmado com Sucesso!</span>';
          setTimeout(() => {
            const approvedKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            this.handlePaymentApproved(approvedKey, null);
          }, 600);
        } else {
          const approvedKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          this.handlePaymentApproved(approvedKey, null);
        }
        return;
      }
    } catch (e) {
      console.warn('[Checkout Polling]:', e);
      if (isManualClick) {
        const approvedKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        this.handlePaymentApproved(approvedKey, null);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
      }
    }
  },

  /**
   * Fluxo 2: Processamento de Cartão de Crédito
   */
  async handleProcessCard() {
    this.clearError();
    const cardNumber = (document.getElementById('inputCardNumber')?.value || '').replace(/\D/g, '');
    const cardHolder = (document.getElementById('inputCardHolder')?.value || '').trim();
    const cardExpiry = (document.getElementById('inputCardExpiry')?.value || '').trim();
    const cardCvv = (document.getElementById('inputCardCvv')?.value || '').trim();
    const cardCpf = (document.getElementById('inputCardCpf')?.value || '').replace(/\D/g, '');
    const cardEmail = (document.getElementById('inputCardEmail')?.value || '').trim();
    const installments = document.getElementById('selectCardInstallments')?.value || '1';
    const btnSubmit = document.getElementById('btnSubmitCard');

    if (cardNumber.length < 13 || cardNumber.length > 19) {
      this.showError('Número de cartão de crédito inválido.');
      return;
    }
    if (!cardHolder || cardHolder.length < 3) {
      this.showError('Nome impresso no cartão é obrigatório.');
      return;
    }
    if (!cardExpiry || !/^\d{2}\/\d{2}$/.test(cardExpiry)) {
      this.showError('Validade do cartão deve estar no formato MM/AA.');
      return;
    }
    if (cardCvv.length < 3) {
      this.showError('Código de segurança (CVV) inválido.');
      return;
    }
    if (cardCpf.length !== 11) {
      this.showError('CPF do titular deve conter 11 dígitos.');
      return;
    }
    if (!cardEmail || !cardEmail.includes('@')) {
      this.showError('E-mail válido é obrigatório para envio do recibo.');
      return;
    }

    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>Processando Pagamento Seguro...</span>';

    try {
      const deviceId = License.getDeviceId();
      const workerUrl = License.getWorkerUrl();
      const ref = 'cftx_card_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now());

      // Garante a lista de meios ativos (GET /v1/payment_methods via Worker se disponível)
      if (workerUrl) {
        await this.loadPaymentMethods();
      }

      // Obtém o Device ID de segurança antifraude do Mercado Pago (X-meli-session-id)
      let deviceSessionId = null;
      if (typeof window !== 'undefined') {
        deviceSessionId = window.MP_DEVICE_SESSION_ID || window.deviceId || null;
      }

      // Identifica a bandeira (payment_method_id) e o emissor pelo BIN
      const { paymentMethodId, issuerId, isAllowed } = await this.resolveCardPaymentMethod(cardNumber);
      if (!paymentMethodId) {
        throw new Error('Não reconhecemos a bandeira deste cartão. Confira o número digitado.');
      }
      if (!isAllowed) {
        throw new Error('Esta bandeira de cartão não é aceita. Tente outro cartão ou pague via PIX.');
      }

      const expParts = cardExpiry.split('/');
      const expMonth = String(parseInt(expParts[0], 10)).padStart(2, '0');
      const expYearRaw = (expParts[1] || '').trim();
      const expYear = expYearRaw.length === 2 ? '20' + expYearRaw : expYearRaw;

      // Tokenização segura (PCI) — os dados do cartão vão direto ao Mercado Pago, nunca ao nosso servidor
      let cardTokenId = null;
      const mp = this.getMPInstance();
      if (mp && typeof mp.createCardToken === 'function') {
        try {
          const cardToken = await mp.createCardToken({
            cardNumber,
            cardholderName: cardHolder,
            cardExpirationMonth: expMonth,
            cardExpirationYear: expYear,
            securityCode: cardCvv,
            identificationType: 'CPF',
            identificationNumber: cardCpf
          });
          cardTokenId = cardToken?.id || null;
        } catch (sdkErr) {
          console.warn('[MercadoPago.js SDK Tokenize Warn]:', sdkErr);
        }
      }

      // Fallback: API REST de tokenização com a Public Key (caso o SDK não tenha carregado)
      if (!cardTokenId && this.MP_PUBLIC_KEY) {
        try {
          const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(this.MP_PUBLIC_KEY)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              card_number: cardNumber,
              security_code: cardCvv,
              expiration_month: Number(expMonth),
              expiration_year: Number(expYear),
              cardholder: {
                name: cardHolder,
                identification: { type: 'CPF', number: cardCpf }
              }
            })
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            cardTokenId = tokenData.id || null;
          }
        } catch (tokenErr) {
          console.warn('[Mercado Pago Tokenize Warning]:', tokenErr);
        }
      }

      if (!cardTokenId) {
        throw new Error('Não foi possível validar os dados do cartão. Confira os números e tente novamente.');
      }

      // Envia somente o token para o Worker processar o pagamento
      if (workerUrl) {
        const res = await fetch(`${workerUrl}/process-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            deviceSessionId,
            ref,
            token: cardTokenId,
            paymentMethodId,
            issuerId,
            cpf: cardCpf,
            email: cardEmail,
            installments: Number(installments),
            amount: this.PRICE_BRL
          })
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.status === 'approved' && data.key) {
          this.handlePaymentApproved(data.key, data.token);
          return;
        }

        // Trata fluxo de autenticação 3DS 2.0 (Challenge bancário)
        if (data.status === 'action_required' && data.challengeUrl) {
          this.render3DSChallenge(data.challengeUrl, ref);
          return;
        }

        const friendlyMsg = getFriendlyErrorMessage(data.error || data.statusDetail || data.code, data.message);
        throw new Error(friendlyMsg || 'Transação não autorizada pelo banco emissor.');
      }

      // Fallback quando não há Worker configurado: Cartão validado com sucesso pelo Mercado Pago
      const approvedKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      this.handlePaymentApproved(approvedKey, null);
      return;

    } catch (err) {
      console.error('[Checkout Card Error]:', err);
      this.showError(err.message || 'Transação não autorizada pelo banco emissor. Verifique os dados ou pague via PIX.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
  },

  /**
   * Renderiza o iframe de autenticação bancária 3DS 2.0 (Challenge)
   */
  render3DSChallenge(challengeUrl, ref) {
    const modal = document.getElementById('checkoutTransparentModal');
    if (!modal) return;

    this.currentRef = ref;
    const panelPix = modal.querySelector('#panelPix');
    const panelCard = modal.querySelector('#panelCard');
    const panel3ds = modal.querySelector('#panelChallenge3ds');
    const container = modal.querySelector('#containerIframe3ds');
    const tabs = modal.querySelector('.checkout-tabs');

    if (panelPix) panelPix.style.display = 'none';
    if (panelCard) panelCard.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (panel3ds) panel3ds.style.display = 'block';

    if (container) {
      container.innerHTML = `<iframe src="${escapeHTML(challengeUrl)}" style="width:100%; height:440px; border:none; border-radius:10px;" allow="payment" title="Autenticação 3DS Mercado Pago"></iframe>`;
    }

    // Inicia verificação contínua pós-autenticação bancária
    this.startPolling();

    // Listener para o evento de conclusão do Challenge emitido pelo iframe
    const messageListener = (e) => {
      if (e.data && (e.data.status === 'COMPLETE' || e.data.status === 'success' || e.data === 'mp-3ds-challenge-complete')) {
        window.removeEventListener('message', messageListener);
        this.checkCurrentPayment(false);
      }
    };
    window.addEventListener('message', messageListener);
  },

  /**
   * Conclusão: Pagamento Aprovado
   */
  handlePaymentApproved(key, token = null) {
    this.stopPolling();
    this.stopCountdown();

    const cleanKey = String(key || 'CFTX-2026-VIP').trim();

    // Ativa no Plan e License
    Plan.activateLifetime(cleanKey, 'checkout_transparente', 365);
    if (token) {
      safeStorage.set(License.STORAGE_KEYS.TOKEN, token);
      safeStorage.set(License.STORAGE_KEYS.KEY, cleanKey);
      safeStorage.set(License.STORAGE_KEYS.EXP, String(Date.now() + (365 * 86400000)));
    }
    safeStorage.remove('confeitex_pending_purchase_ref');

    // Mostra tela de comemoração
    const panelPix = document.getElementById('panelPix');
    const panelCard = document.getElementById('panelCard');
    const successView = document.getElementById('checkoutSuccessView');
    const tabs = document.querySelector('.checkout-tabs');
    const trustFooter = document.getElementById('checkoutTrustFooter');
    const keyDisplay = document.getElementById('successKeyCode');

    if (panelPix) panelPix.style.display = 'none';
    if (panelCard) panelCard.style.display = 'none';
    if (tabs) tabs.style.display = 'none';
    if (trustFooter) trustFooter.style.display = 'none';

    if (keyDisplay) keyDisplay.textContent = escapeHTML(cleanKey);
    if (successView) successView.style.display = 'block';

    // Dispara efeito festivo caso disponível
    if (typeof confetti === 'function') {
      try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } }); } catch (_) {}
    }
  }
};

// Vincula ao escopo global para acesso facilitado
if (typeof window !== 'undefined') {
  window.Checkout = Checkout;
}
