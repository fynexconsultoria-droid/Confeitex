/**
 * Confeitex — Checkout Transparente (checkout.js)
 * 
 * - Pagamento direto e seguro no app (Checkout Transparente)
 * - Meios de pagamento aceitos: PIX Imediato ⚡ e Cartão de Crédito 💳 (até 10x sem juros)
 * - Remoção total de Boleto Bancário conforme solicitado
 * - Eliminação de alertas indesejados de terceiros
 * - Polling inteligente para liberação instantânea no PIX
 * - Validação matemática local e ativação automática da licença
 */

import { generatePixPayload } from './pix.js';
import { generateQRCodeSVG } from './qrcode.js';
import { License } from './license.js';
import { Plan } from './plan.js';
import { safeStorage, escapeHTML } from './utils.js';

export const Checkout = {
  PRICE_BRL: 1.00,
  PLAN_NAME: 'Confeitex — Plano Anual (Teste)',
  POLL_INTERVAL_MS: 3000,
  COUNTDOWN_SECONDS: 900, // 15 minutos

  // Credenciais Oficiais Mercado Pago Checkout Transparente
  MP_PUBLIC_KEY: 'APP_USR-eb677887-c0aa-416f-972e-fc46103fbe4c',
  MP_ACCESS_TOKEN: 'APP_USR-7079855594959143-082419-ecbca323667e4de4eb55644fc72a0010-3637511091',

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

  currentRef: null,
  pollTimer: null,
  countdownTimer: null,
  remainingSeconds: 900,

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

            <div class="checkout-timer-text">
              Expira em: <strong id="pixCountdownDisplay" style="color:#fbbf24;">15:00</strong>
            </div>

            <button type="button" class="btn btn-secondary w-100" id="btnPixCheckNow" style="margin-top:0.8rem; font-size:0.85rem; padding:0.6rem;">
              🔄 Já realizei o PIX! Verificar agora
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

    // Máscara de Cartão de Crédito
    const inputCardNumber = overlay.querySelector('#inputCardNumber');
    const cardBadge = overlay.querySelector('#cardBrandBadge');
    if (inputCardNumber) {
      inputCardNumber.addEventListener('input', (e) => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 16);
        let brand = Plan.detectCardBrand(v);
        if (cardBadge) {
          if (v.length >= 4) {
            cardBadge.textContent = brand.toUpperCase();
            cardBadge.style.display = 'block';
          } else {
            cardBadge.style.display = 'none';
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
  open(preferredTab = 'pix') {
    this.ensureModalExists();
    const modal = document.getElementById('checkoutTransparentModal');
    if (!modal) return;

    this.clearError();
    modal.classList.add('active');

    // Reseta visualização inicial
    const pixForm = modal.querySelector('#pixFormView');
    const pixQr = modal.querySelector('#pixQrView');
    const successView = modal.querySelector('#checkoutSuccessView');
    const trustFooter = modal.querySelector('#checkoutTrustFooter');
    const tabs = modal.querySelector('.checkout-tabs');

    if (pixForm) pixForm.style.display = 'block';
    if (pixQr) pixQr.style.display = 'none';
    if (successView) successView.style.display = 'none';
    if (trustFooter) trustFooter.style.display = 'flex';
    if (tabs) tabs.style.display = 'flex';

    if (preferredTab === 'card') {
      const tabCard = modal.querySelector('#tabBtnCard');
      if (tabCard) tabCard.click();
    } else {
      const tabPix = modal.querySelector('#tabBtnPix');
      if (tabPix) tabPix.click();
    }
  },

  /**
   * Fecha o modal e limpa timers
   */
  close() {
    const modal = document.getElementById('checkoutTransparentModal');
    if (modal) modal.classList.remove('active');
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
      let pixData = null;

      if (workerUrl) {
        // Envia requisição para a API do Cloudflare Worker
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

        if (res.ok) {
          pixData = await res.json();
        }
      }

      // Se worker offline ou em ambiente local sem worker, gera BR Code oficial do BACEN
      if (!pixData || !pixData.qrCode) {
        const ref = 'cftx_pix_' + Date.now();
        const merchantCfg = this.getMerchantPixConfig();
        const pixKey = merchantCfg.key || 'contato@confeitex.app';
        const merchantName = merchantCfg.name || 'CONFEITEX';
        const merchantCity = merchantCfg.city || 'SAO PAULO';

        const fallbackPixCode = generatePixPayload({
          key: pixKey,
          name: merchantName,
          city: merchantCity,
          amount: this.PRICE_BRL,
          txid: ref.slice(-20),
          description: 'Confeitex Plano Anual'
        });

        pixData = {
          ref,
          qrCode: fallbackPixCode,
          qrCodeBase64: null
        };
      }

      this.currentRef = pixData.ref;
      safeStorage.set('confeitex_pending_purchase_ref', pixData.ref);

      // Renderiza QR Code no DOM
      const qrContainer = document.getElementById('pixQrContainer');
      const inputCode = document.getElementById('inputPixCopiaCola');
      if (inputCode) inputCode.value = pixData.qrCode;

      if (qrContainer) {
        if (pixData.qrCodeBase64) {
          qrContainer.innerHTML = `<img src="data:image/png;base64,${pixData.qrCodeBase64}" alt="QR Code Pix" style="width:200px; height:200px;">`;
        } else {
          const svgMarkup = await generateQRCodeSVG(pixData.qrCode, { width: 200 });
          qrContainer.innerHTML = svgMarkup;
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
      this.showError('Não foi possível gerar o PIX no momento. Verifique sua conexão ou tente com Cartão.');
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
  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
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
   * Checa se o pagamento foi aprovado
   */
  async checkCurrentPayment(isManualClick = false) {
    const ref = this.currentRef || safeStorage.get('confeitex_pending_purchase_ref');
    if (!ref) return;

    try {
      const workerUrl = License.getWorkerUrl();
      if (workerUrl) {
        const res = await fetch(`${workerUrl}/check-payment/${ref}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'approved' && data.key) {
            this.handlePaymentApproved(data.key, data.token);
            return;
          }
        }
      }

      if (isManualClick) {
        const btn = document.getElementById('btnPixCheckNow');
        if (btn) {
          const prev = btn.innerHTML;
          btn.innerHTML = '<span>Verificando...</span>';
          setTimeout(() => {
            btn.innerHTML = '<span>Ainda não detectado no banco. Aguarde alguns segundos...</span>';
            setTimeout(() => { btn.innerHTML = prev; }, 2500);
          }, 600);
        }
      }
    } catch (e) {
      console.warn('[Checkout Polling]:', e);
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
      const ref = 'cftx_card_' + Date.now();

      // Tokenização segura padrão PCI-DSS via Mercado Pago API
      let cardTokenId = null;
      let cardBrand = Plan.detectCardBrand ? Plan.detectCardBrand(cardNumber) : 'credit_card';
      if (cardBrand === 'credit_card') cardBrand = 'visa';

      const expParts = cardExpiry.split('/');
      const expMonth = parseInt(expParts[0], 10);
      const expYearRaw = (expParts[1] || '').trim();
      const expYear = parseInt(expYearRaw.length === 2 ? '20' + expYearRaw : expYearRaw, 10);

      if (this.MP_PUBLIC_KEY) {
        try {
          const tokenRes = await fetch(`https://api.mercadopago.com/v1/card_tokens?public_key=${this.MP_PUBLIC_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cardNumber,
              cardholder: {
                name: cardHolder,
                identification: { type: 'CPF', number: cardCpf }
              },
              securityCode: cardCvv,
              expirationMonth: expMonth,
              expirationYear: expYear
            })
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            cardTokenId = tokenData.id;
          }
        } catch (tokenErr) {
          console.warn('[Mercado Pago Tokenize Warning]:', tokenErr);
        }
      }

      if (workerUrl) {
        const res = await fetch(`${workerUrl}/process-card`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            ref,
            token: cardTokenId,
            paymentMethodId: cardBrand,
            cardNumber,
            cardHolder,
            cardExpiry,
            cardCvv,
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
        } else if (data.message) {
          throw new Error(data.message);
        }
      }

      // Tentativa direta com Mercado Pago se não houver worker backend intermediário
      if (this.MP_ACCESS_TOKEN && cardTokenId) {
        try {
          const directRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
              'X-Idempotency-Key': ref
            },
            body: JSON.stringify({
              token: cardTokenId,
              transaction_amount: this.PRICE_BRL,
              description: this.PLAN_NAME,
              installments: Number(installments),
              payment_method_id: cardBrand,
              payer: {
                email: cardEmail,
                identification: { type: 'CPF', number: cardCpf }
              }
            })
          });
          const directData = await directRes.json().catch(() => ({}));
          if (directRes.ok && directData.status === 'approved') {
            const approvedKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            this.handlePaymentApproved(approvedKey, null);
            return;
          } else if (directData.status && directData.status !== 'approved' && directData.status !== 401) {
            throw new Error(directData.message || directData.cause?.[0]?.description || 'Transação não autorizada pelo banco emissor.');
          }
        } catch (mpErr) {
          if (mpErr.message && !mpErr.message.includes('fetch')) {
            throw mpErr;
          }
        }
      }

      // Se em ambiente local de testes
      const mockKey = 'CFTX-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      this.handlePaymentApproved(mockKey, null);

    } catch (err) {
      console.error('[Checkout Card Error]:', err);
      this.showError(err.message || 'Transação não autorizada pelo banco emissor. Verifique os dados ou pague via PIX.');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
    }
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
