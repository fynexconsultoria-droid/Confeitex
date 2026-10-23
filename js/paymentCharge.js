/**
 * Confeitex — paymentCharge.js
 * Módulo de Cobrança da Confeiteira:
 * - Gera Pix Copia e Cola e QR Code localmente (BACEN padrão)
 * - Suporta qualquer banco e links externos (InfinitePay, PicPay, PagBank, etc)
 * - Envia cobrança estruturada no WhatsApp da cliente
 * - Controle de status de pagamento (Pendente, Sinal Pago, Pago)
 */

import { generatePixPayload } from './pix.js';
import { generateQRCodeSVG } from './qrcode.js';
import { safeStorage, fmt, escapeHTML, getOrderTotal } from './utils.js';
import { State } from './state.js';
import { UI } from './ui.js';
import { Orders } from './orders.js';

export const PaymentCharge = {
  KEY_PIX_KEY: 'confeitex_pix_key',
  KEY_PIX_NAME: 'confeitex_pix_name',
  KEY_PIX_CITY: 'confeitex_pix_city',
  KEY_BANK_INFO: 'confeitex_bank_info',
  KEY_PAYMENT_LINK: 'confeitex_payment_link',
  KEY_INSTRUCTIONS: 'confeitex_payment_instructions',

  getConfig() {
    return {
      pixKey: safeStorage.get(this.KEY_PIX_KEY) || '',
      pixName: safeStorage.get(this.KEY_PIX_NAME) || '',
      pixCity: safeStorage.get(this.KEY_PIX_CITY) || '',
      bankInfo: safeStorage.get(this.KEY_BANK_INFO) || '',
      paymentLink: safeStorage.get(this.KEY_PAYMENT_LINK) || '',
      instructions: safeStorage.get(this.KEY_INSTRUCTIONS) || ''
    };
  },

  saveConfig(cfg) {
    if (cfg.pixKey !== undefined) safeStorage.set(this.KEY_PIX_KEY, cfg.pixKey.trim());
    if (cfg.pixName !== undefined) safeStorage.set(this.KEY_PIX_NAME, cfg.pixName.trim());
    if (cfg.pixCity !== undefined) safeStorage.set(this.KEY_PIX_CITY, cfg.pixCity.trim());
    if (cfg.bankInfo !== undefined) safeStorage.set(this.KEY_BANK_INFO, cfg.bankInfo.trim());
    if (cfg.paymentLink !== undefined) safeStorage.set(this.KEY_PAYMENT_LINK, cfg.paymentLink.trim());
    if (cfg.instructions !== undefined) safeStorage.set(this.KEY_INSTRUCTIONS, cfg.instructions.trim());
  },

  async open(order) {
    if (!order) return;
    const config = this.getConfig();

    const modal = document.getElementById('paymentChargeModal');
    if (!modal) {
      console.warn('[PaymentCharge] Modal #paymentChargeModal não encontrado no DOM');
      return;
    }

    const totalVal = getOrderTotal(order);
    const orderTitle = document.getElementById('chargeModalOrderSummary');
    if (orderTitle) {
      orderTitle.innerHTML = `<strong>${escapeHTML(order.clientName)}</strong> · ${escapeHTML(order.flavor || 'Encomenda')} · <span class="charge-total-highlight">${fmt(totalVal)}</span>`;
    }

    const noConfigNotice = document.getElementById('chargeNoConfigNotice');
    const content = document.getElementById('chargeModalContent');
    const qrContainer = document.getElementById('chargeQrContainer');
    const pixInput = document.getElementById('chargePixCodeInput');
    const bankSection = document.getElementById('chargeBankSection');
    const bankText = document.getElementById('chargeBankText');
    const linkSection = document.getElementById('chargeLinkSection');
    const linkInput = document.getElementById('chargeLinkInput');
    const btnOpenLink = document.getElementById('btnChargeOpenLink');

    if (!config.pixKey && !config.bankInfo && !config.paymentLink) {
      if (noConfigNotice) noConfigNotice.style.display = 'block';
      if (content) content.style.display = 'none';
      modal.classList.add('active');
      return;
    }

    if (noConfigNotice) noConfigNotice.style.display = 'none';
    if (content) content.style.display = 'block';

    // Gera o payload do Pix
    let pixPayload = '';
    if (config.pixKey) {
      try {
        const shortId = (order.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'PED';
        pixPayload = generatePixPayload({
          key: config.pixKey,
          name: config.pixName || 'Confeitaria',
          city: config.pixCity || 'Cidade',
          amount: totalVal,
          txid: shortId,
          description: `Pedido ${order.flavor || ''}`.trim()
        });
      } catch (err) {
        console.warn('[PaymentCharge] Erro ao gerar Pix:', err);
      }
    }

    if (pixInput) {
      pixInput.value = pixPayload;
    }

    // Gera QR Code SVG
    if (qrContainer) {
      if (pixPayload) {
        try {
          const svg = await generateQRCodeSVG(pixPayload, { width: 190, margin: 1 });
          qrContainer.innerHTML = svg;
          qrContainer.style.display = 'flex';
        } catch (e) {
          qrContainer.style.display = 'none';
        }
      } else {
        qrContainer.style.display = 'none';
      }
    }

    // Dados bancários alternativos
    if (bankSection && bankText) {
      if (config.bankInfo) {
        bankText.textContent = config.bankInfo;
        bankSection.style.display = 'block';
      } else {
        bankSection.style.display = 'none';
      }
    }

    // Link externo opcional (InfinitePay, PicPay, etc)
    if (linkSection && linkInput) {
      if (config.paymentLink) {
        linkInput.value = config.paymentLink;
        linkSection.style.display = 'block';
        if (btnOpenLink) {
          btnOpenLink.onclick = () => window.open(config.paymentLink, '_blank', 'noopener');
        }
      } else {
        linkSection.style.display = 'none';
      }
    }

    // Botão de Copiar Pix
    const btnCopyPix = document.getElementById('btnCopyChargePix');
    if (btnCopyPix) {
      btnCopyPix.onclick = () => {
        if (!pixPayload) return;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pixPayload).then(() => {
            UI.toast('Código Pix copiado com sucesso!', 'success');
          }).catch(() => {});
        }
      };
    }

    // Botão Enviar WhatsApp
    const btnWhatsApp = document.getElementById('btnSendChargeWhatsApp');
    if (btnWhatsApp) {
      btnWhatsApp.onclick = () => {
        this.sendWhatsApp(order, totalVal, pixPayload, config);
      };
    }

    // Botão Marcar como Pago / Sinal Pago
    const btnMarkPaid = document.getElementById('btnChargeMarkPaid');
    if (btnMarkPaid) {
      btnMarkPaid.onclick = () => {
        order.paymentStatus = 'Pago';
        order.paidAmount = totalVal;
        order.paidAt = new Date().toISOString();
        State.saveOrders();
        Orders.render();
        modal.classList.remove('active');
        UI.toast('Pedido marcado como PAGO! 🎉', 'success');
      };
    }

    const btnMarkDeposit = document.getElementById('btnChargeMarkDeposit');
    if (btnMarkDeposit) {
      btnMarkDeposit.onclick = () => {
        const half = Math.round((totalVal / 2) * 100) / 100;
        order.paymentStatus = 'Sinal Pago';
        order.paidAmount = half;
        order.paidAt = new Date().toISOString();
        State.saveOrders();
        Orders.render();
        modal.classList.remove('active');
        UI.toast(`Sinal de 50% (${fmt(half)}) registrado! 👍`, 'success');
      };
    }

    modal.classList.add('active');
  },

  close() {
    const modal = document.getElementById('paymentChargeModal');
    if (modal) modal.classList.remove('active');
  },

  sendWhatsApp(order, totalVal, pixCode, config) {
    const phone = (order.clientPhone || '').replace(/\D/g, '');
    let msg = `Olá, *${order.clientName}*! Tudo bem? 🎂\n\n`;
    msg += `Passando para enviar os dados de pagamento da sua encomenda:\n`;
    msg += `📋 *Pedido:* ${order.flavor || 'Bolo/Doces'} (${order.productType || 'Encomenda'})\n`;
    msg += `💰 *Valor Total:* ${fmt(totalVal)}\n`;
    if (order.deliveryDate) {
      const dateParts = order.deliveryDate.split('-');
      const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : order.deliveryDate;
      msg += `📅 *Data de Entrega:* ${formattedDate} às ${order.deliveryTime || 'horário a combinar'}\n`;
    }
    msg += `\n`;

    if (pixCode) {
      msg += `🔑 *Chave Pix:* ${config.pixKey}\n`;
      if (config.pixName) msg += `👤 *Nome:* ${config.pixName}\n`;
      msg += `\n*Código Pix Copia e Cola:*\n\`\`\`${pixCode}\`\`\`\n\n`;
    }

    if (config.bankInfo) {
      msg += `🏦 *Dados Bancários:*\n${config.bankInfo}\n\n`;
    }

    if (config.paymentLink) {
      msg += `💳 *Ou pague pelo link:* ${config.paymentLink}\n\n`;
    }

    if (config.instructions) {
      msg += `ℹ️ ${config.instructions}\n\n`;
    }

    msg += `Assim que efetuar o pagamento, por favor nos envie o comprovante por aqui. Muito obrigado! ✨`;

    const encoded = encodeURIComponent(msg);
    const url = phone ? `https://wa.me/55${phone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank', 'noopener');
  }
};
