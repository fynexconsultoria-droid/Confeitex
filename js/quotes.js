// ============================================================================
// Confeitex - Módulo de Orçamentos (Quotes & Proposals)
// Geração de propostas comerciais, formatação e envio para o WhatsApp
// e conversão em pedidos com 1 clique.
// ============================================================================

const Quotes = {
  _activeFilter: 'all', // 'all' | 'Pendente' | 'Aprovado' | 'Recusado'
  _searchQuery: '',
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.setupListeners();
  },

  setupListeners() {
    const btnNew = document.getElementById('btnNewQuote');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openModal());
    }

    const searchInput = document.getElementById('quoteSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        this._searchQuery = e.target.value.toLowerCase().trim();
        this.renderList();
      }, 200));
    }

    const chips = document.querySelectorAll('.quote-filter-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this._activeFilter = chip.dataset.status || 'all';
        this.renderList();
      });
    });

    this.setupForm();
  },

  setupForm() {
    const modal = document.getElementById('quoteModal');
    const form = document.getElementById('quoteForm');
    const btnClose = document.getElementById('btnModalQuoteClose');
    const btnCancel = document.getElementById('btnModalQuoteCancel');

    if (btnClose) btnClose.onclick = () => modal.classList.remove('active');
    if (btnCancel) btnCancel.onclick = () => modal.classList.remove('active');

    // Máscara no telefone
    const phoneInput = document.getElementById('quoteClientPhone');
    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => maskPhone(e.target));
    }

    // Auto-preenchimento ao digitar nome de cliente existente
    const nameInput = document.getElementById('quoteClientName');
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        const val = nameInput.value.trim().toLowerCase();
        if (!val) return;
        const found = State.orders.find(o => o.clientName.toLowerCase() === val && o.clientPhone);
        if (found && phoneInput && !phoneInput.value) {
          phoneInput.value = found.clientPhone;
        }
      });
    }

    // Cálculo em tempo real
    ['quoteWeight', 'quoteUnitPrice', 'quoteExtraCharges', 'quoteDiscount'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', () => {
          const old = el.value;
          el.value = old.replaceAll(',', '.');
          this.calcTotal();
        });
      }
    });

    // Mudança de categoria
    const productTypeEl = document.getElementById('quoteProductType');
    if (productTypeEl) {
      productTypeEl.addEventListener('change', (e) => {
        this.updateProductLabels(e.target.value);
        this.populateFlavorSelect();
        this.calcTotal();
      });
    }

    // Mudança do sabor do catálogo
    const flavorSelect = document.getElementById('quoteFlavorSelect');
    if (flavorSelect) {
      flavorSelect.addEventListener('change', (e) => {
        const item = State.catalog.find(c => c.id === e.target.value);
        if (item) {
          document.getElementById('quoteFlavor').value = item.flavor;
          document.getElementById('quoteUnitPrice').value = item.pricePerKg.toFixed(2);
          if (item.description && !document.getElementById('quoteDetails').value) {
            document.getElementById('quoteDetails').value = item.description;
          }
          this.calcTotal();
        }
      });
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.save();
      });
    }
  },

  updateProductLabels(type) {
    const isKg = type === 'Bolo de Kg';
    const weightLabel = document.getElementById('quoteWeightLabel');
    const priceLabel = document.getElementById('quotePriceLabel');
    if (weightLabel) weightLabel.textContent = isKg ? I18n.t('quotes.weightLabel') : I18n.t('quotes.unitsLabel');
    if (priceLabel) priceLabel.textContent = isKg ? I18n.t('quotes.unitPriceLabel') : I18n.t('quotes.unitPriceUnitLabel');
  },

  populateFlavorSelect() {
    const select = document.getElementById('quoteFlavorSelect');
    if (!select) return;
    const currentType = document.getElementById('quoteProductType')?.value || 'Bolo de Kg';
    const filtered = State.catalog.filter(c => c.type === currentType && c.active !== false);

    let html = `<option value="">${I18n.t('quotes.flavorSelectPh')}</option>`;
    filtered.forEach(c => {
      const suffix = c.type === 'Bolo de Kg' ? '/Kg' : '/un';
      html += `<option value="${escapeHTML(c.id)}">${escapeHTML(c.flavor)} — ${I18n.currencySymbol()} ${c.pricePerKg.toFixed(2)}${suffix}</option>`;
    });
    select.innerHTML = html;
  },

  calcTotal() {
    const weight = parseFloat(document.getElementById('quoteWeight')?.value) || 0;
    const unitPrice = parseFloat(document.getElementById('quoteUnitPrice')?.value) || 0;
    const extra = parseFloat(document.getElementById('quoteExtraCharges')?.value) || 0;
    const discount = parseFloat(document.getElementById('quoteDiscount')?.value) || 0;

    const total = Math.max(0, +((weight * unitPrice + extra - discount).toFixed(2)));
    const totalEl = document.getElementById('quoteTotalDisplay');
    if (totalEl) {
      totalEl.textContent = fmt(total);
    }
    return total;
  },

  render() {
    this.init();
    this.renderKPIs();
    this.renderList();
  },

  renderKPIs() {
    const quotes = State.quotes || [];
    const pending = quotes.filter(q => q.status === 'Pendente');
    const approved = quotes.filter(q => q.status === 'Aprovado');

    const totalPendingVal = pending.reduce((sum, q) => sum + (q.totalValue || 0), 0);
    const convRate = quotes.length > 0 ? Math.round((approved.length / quotes.length) * 100) : 0;

    const elCount = document.getElementById('quoteKpiPendingCount');
    const elVal = document.getElementById('quoteKpiPendingVal');
    const elApproved = document.getElementById('quoteKpiApprovedCount');
    const elRate = document.getElementById('quoteKpiConvRate');

    if (elCount) elCount.textContent = pending.length;
    if (elVal) elVal.textContent = fmt(totalPendingVal);
    if (elApproved) elApproved.textContent = approved.length;
    if (elRate) elRate.textContent = `${convRate}%`;
  },

  renderList() {
    const tbody = document.getElementById('quotesTableBody');
    const emptyState = document.getElementById('quotesEmptyState');
    if (!tbody) return;

    let list = [...(State.quotes || [])];

    // Filtro por status
    if (this._activeFilter !== 'all') {
      list = list.filter(q => q.status === this._activeFilter);
    }

    // Busca textual
    if (this._searchQuery) {
      list = list.filter(q =>
        (q.clientName && q.clientName.toLowerCase().includes(this._searchQuery)) ||
        (q.flavor && q.flavor.toLowerCase().includes(this._searchQuery)) ||
        (q.clientPhone && q.clientPhone.includes(this._searchQuery))
      );
    }

    // Ordena mais recentes primeiro
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (list.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      const table = tbody.closest('table');
      if (table) table.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    const table = tbody.closest('table');
    if (table) table.style.display = 'table';

    const nowStr = fmtISO(new Date());

    tbody.innerHTML = list.map(q => {
      const isExpired = q.status === 'Pendente' && q.validUntil && q.validUntil < nowStr;
      const statusClass = isExpired ? 'badge-danger' : q.status === 'Aprovado' ? 'badge-success' : q.status === 'Recusado' ? 'badge-danger' : 'badge-pending';
      const statusLabel = isExpired ? 'Expirado' : (q.status || 'Pendente');

      const isKg = q.productType === 'Bolo de Kg';
      const measureText = isKg ? `${(q.weight || 0).toFixed(2).replace('.', ',')} Kg` : `${Math.round(q.weight || 0)} un`;

      return `
        <tr class="quote-row" data-id="${escapeHTML(q.id)}">
          <td>
            <div style="font-weight:600;color:white;font-size:0.9rem;">${escapeHTML(q.clientName)}</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);display:flex;align-items:center;gap:0.25rem;">
              <svg viewBox="0 0 24 24" fill="currentColor" style="width:12px;height:12px;color:#22c55e;"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.532 1.77.818 2.796.818 3.182 0 5.768-2.587 5.768-5.766.001-3.183-2.575-5.769-5.768-5.769zm10.024 5.766c-.001 5.547-4.512 10.057-10.055 10.057-1.747 0-3.391-.453-4.82-1.246l-5.18 1.359 1.385-5.048c-.87-1.493-1.37-3.23-1.37-5.122 0-5.545 4.51-10.055 10.054-10.055 5.544 0 10.055 4.51 10.055 10.055z"/></svg>
              ${escapeHTML(q.clientPhone || 'Sem telefone')}
            </div>
          </td>
          <td>
            <span style="font-weight:600;color:var(--text-primary);font-size:0.85rem;">${escapeHTML(q.flavor)}</span>
            <span style="font-size:0.75rem;color:var(--text-muted);display:block;">${measureText} · ${escapeHTML(I18n.value('product', q.productType))}</span>
          </td>
          <td style="font-size:0.85rem;">
            <div>📅 ${fmtDateStr(q.eventDate)}</div>
            ${q.eventTime ? `<div style="font-size:0.75rem;color:var(--text-muted);">⏰ ${escapeHTML(q.eventTime)}</div>` : ''}
          </td>
          <td style="font-size:0.8rem;color:var(--text-secondary);">
            ${q.validUntil ? `Até ${fmtDateStr(q.validUntil)}` : 'Sem validade'}
          </td>
          <td style="font-weight:700;color:var(--color-accent-pink);font-size:0.95rem;">
            ${fmt(q.totalValue)}
          </td>
          <td>
            <span class="badge ${statusClass}" style="font-size:0.7rem;padding:0.2rem 0.5rem;">${statusLabel}</span>
          </td>
          <td class="text-right">
            <div class="quote-action-btns" style="display:inline-flex;gap:0.35rem;">
              <button class="btn btn-whatsapp btn-sm btn-quote-wa" data-id="${escapeHTML(q.id)}" title="${I18n.t('quotes.actSendWhatsApp')}" aria-label="${I18n.t('quotes.actSendWhatsApp')}">
                <svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.532 1.77.818 2.796.818 3.182 0 5.768-2.587 5.768-5.766.001-3.183-2.575-5.769-5.768-5.769zm10.024 5.766c-.001 5.547-4.512 10.057-10.055 10.057-1.747 0-3.391-.453-4.82-1.246l-5.18 1.359 1.385-5.048c-.87-1.493-1.37-3.23-1.37-5.122 0-5.545 4.51-10.055 10.054-10.055 5.544 0 10.055 4.51 10.055 10.055z"/></svg>
                <span>WhatsApp</span>
              </button>

              <button class="btn btn-secondary btn-sm btn-quote-view" data-id="${escapeHTML(q.id)}" title="${I18n.t('quotes.actView')}" aria-label="${I18n.t('quotes.actView')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>

              ${q.status !== 'Aprovado' ? `
              <button class="btn btn-secondary btn-sm btn-quote-convert" data-id="${escapeHTML(q.id)}" title="${I18n.t('quotes.actConvert')}" aria-label="${I18n.t('quotes.actConvert')}" style="color:var(--color-success);border-color:rgba(16,185,129,0.25);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="20 6 9 17 4 12"/></svg>
              </button>` : ''}

              <button class="btn btn-secondary btn-sm btn-quote-edit" data-id="${escapeHTML(q.id)}" title="${I18n.t('quotes.actEdit')}" aria-label="${I18n.t('quotes.actEdit')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>

              <button class="btn btn-secondary btn-sm btn-quote-del" data-id="${escapeHTML(q.id)}" title="${I18n.t('quotes.actDelete')}" aria-label="${I18n.t('quotes.actDelete')}" style="color:var(--color-danger);border-color:rgba(239,68,68,0.25);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (!tbody.dataset.hasListener) {
      tbody.dataset.hasListener = '1';
      tbody.addEventListener('click', (e) => {
        const btnWa = e.target.closest('.btn-quote-wa');
        const btnView = e.target.closest('.btn-quote-view');
        const btnConvert = e.target.closest('.btn-quote-convert');
        const btnEdit = e.target.closest('.btn-quote-edit');
        const btnDel = e.target.closest('.btn-quote-del');

        if (btnWa) {
          this.sendWhatsApp(btnWa.dataset.id);
        } else if (btnView) {
          this.showPreview(btnView.dataset.id);
        } else if (btnConvert) {
          this.convertToOrder(btnConvert.dataset.id);
        } else if (btnEdit) {
          this.openModal(btnEdit.dataset.id);
        } else if (btnDel) {
          this.deleteQuote(btnDel.dataset.id);
        }
      });
    }
  },

  openModal(quoteId = null) {
    const modal = document.getElementById('quoteModal');
    const form = document.getElementById('quoteForm');
    const titleEl = document.getElementById('quoteModalTitle');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('quoteIdInput').value = quoteId || '';

    this.populateFlavorSelect();

    if (quoteId) {
      const q = State.quotes.find(item => item.id === quoteId);
      if (!q) return;
      if (titleEl) titleEl.textContent = I18n.t('quotes.modalEdit');
      document.getElementById('quoteClientName').value = q.clientName || '';
      document.getElementById('quoteClientPhone').value = q.clientPhone || '';
      document.getElementById('quoteProductType').value = q.productType || 'Bolo de Kg';
      document.getElementById('quoteFlavor').value = q.flavor || '';
      document.getElementById('quoteWeight').value = q.weight != null ? q.weight : '1.00';
      document.getElementById('quoteUnitPrice').value = q.unitPrice != null ? q.unitPrice.toFixed(2) : '60.00';
      document.getElementById('quoteExtraCharges').value = q.extraCharges != null ? q.extraCharges.toFixed(2) : '0.00';
      document.getElementById('quoteDiscount').value = q.discount != null ? q.discount.toFixed(2) : '0.00';
      document.getElementById('quoteEventDate').value = q.eventDate || fmtISO(new Date());
      document.getElementById('quoteEventTime').value = q.eventTime || '14:00';
      document.getElementById('quoteValidityDays').value = q.validityDays || '7';
      document.getElementById('quoteDetails').value = q.details || '';
      document.getElementById('quoteNotes').value = q.notes || '';
      document.getElementById('quoteStatus').value = q.status || 'Pendente';
      this.updateProductLabels(q.productType);
    } else {
      if (titleEl) titleEl.textContent = I18n.t('quotes.modalNew');
      document.getElementById('quoteEventDate').value = fmtISO(new Date());
      document.getElementById('quoteEventTime').value = '14:00';
      document.getElementById('quoteValidityDays').value = '7';
      document.getElementById('quoteWeight').value = '1.00';
      document.getElementById('quoteUnitPrice').value = '60.00';
      document.getElementById('quoteExtraCharges').value = '0.00';
      document.getElementById('quoteDiscount').value = '0.00';
      document.getElementById('quoteStatus').value = 'Pendente';
      document.getElementById('quoteProductType').value = 'Bolo de Kg';
      this.updateProductLabels('Bolo de Kg');
    }

    this.calcTotal();
    modal.classList.add('active');
  },

  save() {
    const clientName = document.getElementById('quoteClientName')?.value.trim();
    const clientPhone = document.getElementById('quoteClientPhone')?.value.trim();
    const productType = document.getElementById('quoteProductType')?.value || 'Bolo de Kg';
    const flavor = document.getElementById('quoteFlavor')?.value.trim();
    const eventDate = document.getElementById('quoteEventDate')?.value;
    const eventTime = document.getElementById('quoteEventTime')?.value || '14:00';
    const validityDays = parseInt(document.getElementById('quoteValidityDays')?.value, 10) || 7;
    const details = document.getElementById('quoteDetails')?.value.trim() || '';
    const notes = document.getElementById('quoteNotes')?.value.trim() || '';
    const status = document.getElementById('quoteStatus')?.value || 'Pendente';

    if (!clientName) {
      UI.alert(I18n.t('orders.alertName') || 'Por favor, informe o nome do cliente.');
      return;
    }
    if (!flavor) {
      UI.alert(I18n.t('orders.alertFlavor') || 'Por favor, informe o sabor ou produto.');
      return;
    }
    if (!eventDate) {
      UI.alert(I18n.t('orders.alertDate') || 'Por favor, informe a data do evento.');
      return;
    }

    const weight = parseFloat(document.getElementById('quoteWeight')?.value) || 1;
    const unitPrice = parseFloat(document.getElementById('quoteUnitPrice')?.value) || 0;
    const extraCharges = parseFloat(document.getElementById('quoteExtraCharges')?.value) || 0;
    const discount = parseFloat(document.getElementById('quoteDiscount')?.value) || 0;
    const totalValue = this.calcTotal();

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validityDays);
    const validUntil = fmtISO(validUntilDate);

    const quoteId = document.getElementById('quoteIdInput')?.value;

    const data = {
      clientName,
      clientPhone,
      productType,
      flavor,
      weight,
      unitPrice,
      extraCharges,
      discount,
      totalValue,
      eventDate,
      eventTime,
      validityDays,
      validUntil,
      details,
      notes,
      status,
    };

    if (quoteId) {
      const idx = State.quotes.findIndex(q => q.id === quoteId);
      if (idx !== -1) {
        Object.assign(State.quotes[idx], data);
      }
    } else {
      data.id = 'q_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2, 8));
      data.createdAt = new Date().toISOString();
      State.quotes.push(data);
    }

    State.saveQuotes();
    document.getElementById('quoteModal')?.classList.remove('active');
    this.render();
    UI.toast(I18n.t(quoteId ? 'quotes.toastUpdated' : 'quotes.toastCreated'), 'success');

    // Se acabou de criar, oferece para abrir o preview / envio imediato
    if (!quoteId) {
      this.showPreview(data.id);
    }
  },

  generateWhatsAppMessage(quote) {
    const bakery = State.bakeryProfile || {};
    const bakeryTitle = bakery.name || 'Confeitex';
    const isKg = quote.productType === 'Bolo de Kg';
    const measureStr = isKg ? `${(quote.weight || 0).toFixed(2).replace('.', ',')} Kg` : `${Math.round(quote.weight || 0)} unidades`;
    const eventDateFmt = fmtDateStr(quote.eventDate);
    const validUntilFmt = quote.validUntil ? fmtDateStr(quote.validUntil) : null;

    let msg = `🎂 *ORÇAMENTO — ${bakeryTitle.toUpperCase()}* 🎂\n\n`;
    msg += `Olá, *${quote.clientName}*! Tudo bem? Segue a proposta detalhada para a sua encomenda:\n\n`;
    msg += `🧁 *Produto / Sabor:* ${quote.flavor}\n`;
    msg += `📦 *Categoria:* ${quote.productType}\n`;
    msg += `⚖️ *Quantidade / Peso:* ${measureStr}\n`;

    if (quote.details) {
      msg += `✨ *Detalhes / Recheio:* ${quote.details}\n`;
    }

    msg += `📅 *Data Prevista:* ${eventDateFmt}${quote.eventTime ? ` às ${quote.eventTime}` : ''}\n`;

    if (quote.extraCharges > 0) {
      msg += `🚗 *Taxa / Adicionais:* ${fmt(quote.extraCharges)}\n`;
    }
    if (quote.discount > 0) {
      msg += `🎁 *Desconto Especial:* -${fmt(quote.discount)}\n`;
    }

    msg += `\n💰 *VALOR TOTAL: ${fmt(quote.totalValue)}*\n\n`;

    if (validUntilFmt) {
      msg += `⏳ _Proposta válida até ${validUntilFmt}._\n`;
    }
    if (quote.notes) {
      msg += `📌 *Condições:* ${quote.notes}\n`;
    } else if (bakery.orderNotice) {
      msg += `📌 *Condições:* ${bakery.orderNotice}\n`;
    }

    if (bakery.pix) {
      msg += `💳 *Chave Pix:* \`${bakery.pix}\`\n`;
    }

    if (bakery.instagram) {
      msg += `📸 *Instagram:* ${bakery.instagram}\n`;
    }

    msg += `\nFico à disposição para qualquer ajuste ou para confirmarmos sua encomenda! 🥰`;
    return msg;
  },

  sendWhatsApp(quoteId) {
    const q = State.quotes.find(item => item.id === quoteId);
    if (!q) return;

    let phone = (q.clientPhone || '').replace(/\D/g, '');
    if (phone.length === 10 || phone.length === 11) {
      phone = '55' + phone;
    }

    const text = this.generateWhatsAppMessage(q);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  },

  showPreview(quoteId) {
    const q = State.quotes.find(item => item.id === quoteId);
    if (!q) return;

    const modal = document.getElementById('quotePreviewModal');
    const textEl = document.getElementById('quotePreviewText');
    const btnCopy = document.getElementById('btnCopyQuoteText');
    const btnSend = document.getElementById('btnSendQuoteWhatsApp');
    const btnConvert = document.getElementById('btnConvertQuoteToOrder');
    const btnClose = document.getElementById('btnModalQuotePreviewClose');
    if (!modal || !textEl) return;

    const msg = this.generateWhatsAppMessage(q);
    textEl.value = msg;

    if (btnCopy) {
      btnCopy.onclick = () => {
        navigator.clipboard.writeText(msg).then(() => {
          UI.toast(I18n.t('quotes.toastCopied') || 'Copiado para a área de transferência!', 'success');
        }).catch(() => {
          textEl.select();
          document.execCommand('copy');
          UI.toast(I18n.t('quotes.toastCopied') || 'Copiado!', 'success');
        });
      };
    }

    if (btnSend) {
      btnSend.onclick = () => {
        this.sendWhatsApp(quoteId);
      };
    }

    if (btnConvert) {
      btnConvert.style.display = q.status !== 'Aprovado' ? 'inline-flex' : 'none';
      btnConvert.onclick = () => {
        modal.classList.remove('active');
        this.convertToOrder(quoteId);
      };
    }

    if (btnClose) {
      btnClose.onclick = () => modal.classList.remove('active');
    }

    modal.classList.add('active');
  },

  convertToOrder(quoteId) {
    const q = State.quotes.find(item => item.id === quoteId);
    if (!q) return;

    UI.confirm(I18n.t('quotes.confirmConvert') || 'Deseja aprovar este orçamento e criar um Pedido oficial agora?', () => {
      // Cria pedido
      const newOrder = {
        id: 'o_' + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
        clientName: q.clientName,
        clientPhone: q.clientPhone,
        productType: q.productType,
        flavor: q.flavor,
        details: q.details,
        weight: q.weight,
        unitPrice: q.unitPrice,
        extraCharges: q.extraCharges,
        cost: 0,
        deliveryDate: q.eventDate,
        deliveryTime: q.eventTime || '14:00',
        deliveryType: 'Retirada no Local',
        status: 'Pendente',
        notes: q.notes ? `[Orçamento]: ${q.notes}` : '',
        paymentMethod: 'Dinheiro',
        totalValue: q.totalValue,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
      };

      State.orders.push(newOrder);
      q.status = 'Aprovado';

      State.saveQuotes();
      State.saveOrders();

      if (typeof Dashboard !== 'undefined' && Dashboard.update) {
        Dashboard.update();
      }

      this.render();
      UI.toast(I18n.t('quotes.toastConverted'), 'success');

      if (typeof window.switchTab === 'function') {
        setTimeout(() => window.switchTab('orders'), 400);
      }
    });
  },

  deleteQuote(quoteId) {
    const q = State.quotes.find(item => item.id === quoteId);
    if (!q) return;

    UI.confirm(`Deseja excluir o orçamento de ${q.clientName}?`, () => {
      State.addToTrash(q, 'quote', `${q.clientName} · ${q.flavor} (${fmt(q.totalValue)})`);
      State.quotes = State.quotes.filter(item => item.id !== quoteId);
      State.saveQuotes();
      this.render();
      UI.toast(I18n.t('quotes.toastDeleted'), 'info');
    });
  }
};
