/**
 * CONFEITEX - Customizable Catalog Module (js/catalog.js)
 * Allows confectioners to showcase products with categories, descriptions, badges,
 * manage their bakery profile (name, whatsapp, instagram, bio, pix, policy),
 * and export an attractive formatted menu directly to WhatsApp.
 */

const Catalog = {
  currentCategory: 'all',
  searchQuery: '',
  _initialized: false,

  init() {
    if (this._initialized) return;
    this._initialized = true;
    this.setupListeners();
    this.render();
  },

  setupListeners() {
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', debounce((e) => {
        this.setSearch(e.target.value);
      }, 200));
    }

    const btnNew = document.getElementById('btnNewCatalogItem');
    if (btnNew) {
      btnNew.addEventListener('click', () => this.openItemModal());
    }

    const btnProfile = document.getElementById('btnEditBakeryProfile');
    if (btnProfile) {
      btnProfile.addEventListener('click', () => this.openProfileModal());
    }

    const btnShare = document.getElementById('btnShareWhatsAppCatalog');
    if (btnShare) {
      btnShare.addEventListener('click', () => this.shareWhatsApp());
    }

    const itemModalClose = document.getElementById('btnCatalogItemModalClose');
    const itemModalCancel = document.getElementById('btnCatalogItemModalCancel');
    if (itemModalClose) itemModalClose.onclick = () => this.closeItemModal();
    if (itemModalCancel) itemModalCancel.onclick = () => this.closeItemModal();

    const profileModalClose = document.getElementById('btnBakeryProfileModalClose');
    const profileModalCancel = document.getElementById('btnBakeryProfileModalCancel');
    if (profileModalClose) profileModalClose.onclick = () => this.closeProfileModal();
    if (profileModalCancel) profileModalCancel.onclick = () => this.closeProfileModal();

    const itemForm = document.getElementById('catalogItemForm');
    if (itemForm) {
      itemForm.onsubmit = (e) => this.saveItem(e);
    }

    const profileForm = document.getElementById('bakeryProfileForm');
    if (profileForm) {
      profileForm.onsubmit = (e) => this.saveProfile(e);
    }
  },

  render() {
    this.init();
    this.renderProfileCard();
    this.renderCategoryFilter();
    this.renderProductGrid();
  },

  renderProfileCard() {
    const profileBox = document.getElementById('catalogProfileBanner');
    if (!profileBox) return;

    const profile = State.bakeryProfile || {
      name: 'Minha Confeitaria',
      tagline: 'Doces & Bolos Artesanais Feitos com Amor',
      phone: '',
      instagram: '',
      pix: '',
      orderNotice: 'Encomendas com no mínimo 48h de antecedência.'
    };

    profileBox.innerHTML = `
      <div class="catalog-store-header">
        <div class="catalog-store-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>
        </div>
        <div class="catalog-store-info">
          <div class="catalog-store-title-row">
            <h2>${escapeHTML(profile.name || 'Confeitaria Artesanal')}</h2>
            <button class="btn btn-sm btn-secondary" onclick="Catalog.openProfileModal()" title="${I18n.t('catalog.edit_profile')}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>${I18n.t('catalog.edit_profile')}</span>
            </button>
          </div>
          ${profile.tagline ? `<p class="catalog-store-tagline">${escapeHTML(profile.tagline)}</p>` : ''}
          <div class="catalog-store-meta">
            ${profile.phone ? `<span class="meta-item"><svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;color:#22c55e;"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.532 1.77.818 2.796.818 3.182 0 5.768-2.587 5.768-5.766.001-3.183-2.575-5.769-5.768-5.769zm10.024 5.766c-.001 5.547-4.512 10.057-10.055 10.057-1.747 0-3.391-.453-4.82-1.246l-5.18 1.359 1.385-5.048c-.87-1.493-1.37-3.23-1.37-5.122 0-5.545 4.51-10.055 10.054-10.055 5.544 0 10.055 4.51 10.055 10.055z"/></svg> ${escapeHTML(profile.phone)}</span>` : ''}
            ${profile.instagram ? `<span class="meta-item">📸 ${escapeHTML(profile.instagram)}</span>` : ''}
            ${profile.pix ? `<span class="meta-item">🔑 Pix: <code>${escapeHTML(profile.pix)}</code></span>` : ''}
          </div>
          ${profile.orderNotice ? `<div class="catalog-store-notice">ℹ️ ${escapeHTML(profile.orderNotice)}</div>` : ''}
        </div>
      </div>
    `;
  },

  renderCategoryFilter() {
    const filterContainer = document.getElementById('catalogCategoryFilters');
    if (!filterContainer) return;

    // Collect all distinct categories/types from catalog items
    const items = State.catalog || [];
    const categories = ['all'];
    items.forEach(it => {
      const cat = (it.type || it.category || 'Geral').trim();
      if (cat && !categories.includes(cat)) {
        categories.push(cat);
      }
    });

    filterContainer.innerHTML = categories.map(cat => {
      const activeClass = this.currentCategory === cat ? 'active' : '';
      const label = cat === 'all' ? I18n.t('catalog.all_categories') : escapeHTML(cat);
      return `
        <button type="button" class="filter-chip ${activeClass}" onclick="Catalog.setCategory('${escapeHTML(cat)}')">
          ${label}
        </button>
      `;
    }).join('');
  },

  setCategory(cat) {
    this.currentCategory = cat;
    this.renderCategoryFilter();
    this.renderProductGrid();
  },

  setSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderProductGrid();
  },

  renderProductGrid() {
    const grid = document.getElementById('catalogProductsGrid');
    if (!grid) return;

    let items = State.catalog || [];

    // Filter by category
    if (this.currentCategory !== 'all') {
      items = items.filter(it => (it.type || it.category || 'Geral').toLowerCase() === this.currentCategory.toLowerCase());
    }

    // Filter by search
    if (this.searchQuery) {
      items = items.filter(it => {
        const name = (it.flavor || it.name || '').toLowerCase();
        const desc = (it.description || '').toLowerCase();
        const cat = (it.type || it.category || '').toLowerCase();
        return name.includes(this.searchQuery) || desc.includes(this.searchQuery) || cat.includes(this.searchQuery);
      });
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 3rem 1rem;">
          <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <h3>${I18n.t('catalog.empty_state')}</h3>
          <p>${I18n.t('catalog.empty_sub') || 'Cadastre seus bolos, doces e salgados para compartilhar com seus clientes.'}</p>
          <button class="btn btn-primary btn-sm" onclick="Catalog.openItemModal()" style="margin-top: 1rem;">
            + ${I18n.t('catalog.new_item')}
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(item => {
      const name = item.flavor || item.name || 'Produto';
      const cat = item.type || item.category || 'Geral';
      const price = item.pricePerKg != null ? item.pricePerKg : (item.salePrice != null ? item.salePrice : (item.price || 0));
      const priceFormatted = fmt(price);
      const isKg = cat === 'Bolo de Kg';
      const priceSuffix = isKg ? '/Kg' : '/un';

      const badgeHtml = item.badge ? `<span class="catalog-badge badge-${escapeHTML(item.badge)}">${this.getBadgeLabel(item.badge)}</span>` : '';
      const servingHtml = item.servingSize ? `<span class="catalog-serving">👥 ${escapeHTML(item.servingSize)}</span>` : '';
      const minOrderHtml = item.minOrder ? `<span class="catalog-min-order">📦 Mín: ${escapeHTML(item.minOrder)}</span>` : '';

      return `
        <div class="catalog-card ${item.active === false ? 'catalog-card-inactive' : ''}">
          <div class="catalog-card-top">
            <div class="catalog-card-header">
              <span class="catalog-card-category">${escapeHTML(cat)}</span>
              ${badgeHtml}
            </div>
            <h3 class="catalog-card-title">${escapeHTML(name)}</h3>
            ${item.description ? `<p class="catalog-card-desc">${escapeHTML(item.description)}</p>` : '<p class="catalog-card-desc text-muted"><em>Sem descrição</em></p>'}
            
            <div class="catalog-card-specs">
              ${servingHtml}
              ${minOrderHtml}
            </div>
          </div>

          <div class="catalog-card-bottom">
            <div class="catalog-price-row">
              <div class="catalog-price-main">
                <span class="catalog-price-label">${I18n.t('catalog.price')}:</span>
                <span class="catalog-price-val">${priceFormatted} <small style="font-size:0.75rem;color:var(--text-secondary);">${priceSuffix}</small></span>
              </div>
            </div>

            <div class="catalog-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="Catalog.createQuoteFromItem('${item.id}')" title="${I18n.t('catalog.create_quote_direct')}">
                <span>📝 Orçar</span>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Catalog.openItemModal('${item.id}')" title="${I18n.t('common.edit') || 'Editar'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-secondary btn-sm" style="color:var(--color-danger);border-color:rgba(239,68,68,0.25);" onclick="Catalog.deleteItem('${item.id}')" title="${I18n.t('common.delete') || 'Excluir'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  getBadgeLabel(badge) {
    const badges = {
      'bestseller': '⭐ ' + I18n.t('catalog.badge_bestseller'),
      'new': '✨ ' + I18n.t('catalog.badge_new'),
      'seasonal': '🎄 ' + I18n.t('catalog.badge_seasonal'),
      'special': '💎 ' + I18n.t('catalog.badge_special')
    };
    return badges[badge] || badge;
  },

  openItemModal(id = null) {
    const modal = document.getElementById('catalogItemModal');
    if (!modal) return;

    const titleEl = document.getElementById('catalogItemModalTitle');
    const form = document.getElementById('catalogItemForm');
    if (form) form.reset();

    const idInput = document.getElementById('catalogItemId');
    const nameInput = document.getElementById('catalogItemName');
    const categoryInput = document.getElementById('catalogItemCategory');
    const priceInput = document.getElementById('catalogItemPrice');
    const descInput = document.getElementById('catalogItemDescription');
    const servingInput = document.getElementById('catalogItemServing');
    const minOrderInput = document.getElementById('catalogItemMinOrder');
    const badgeInput = document.getElementById('catalogItemBadge');

    if (id) {
      const item = (State.catalog || []).find(it => it.id === id);
      if (item) {
        if (titleEl) titleEl.innerText = I18n.t('catalog.edit_item');
        if (idInput) idInput.value = item.id;
        if (nameInput) nameInput.value = item.flavor || item.name || '';
        if (categoryInput) categoryInput.value = item.type || item.category || 'Bolo de Kg';
        if (priceInput) priceInput.value = item.pricePerKg != null ? item.pricePerKg : (item.salePrice || item.price || '');
        if (descInput) descInput.value = item.description || '';
        if (servingInput) servingInput.value = item.servingSize || '';
        if (minOrderInput) minOrderInput.value = item.minOrder || '';
        if (badgeInput) badgeInput.value = item.badge || '';
      }
    } else {
      if (titleEl) titleEl.innerText = I18n.t('catalog.new_item');
      if (idInput) idInput.value = '';
      if (categoryInput) categoryInput.value = 'Bolo de Kg';
    }

    modal.classList.add('active');
  },

  saveItem(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('catalogItemId')?.value;
    const name = document.getElementById('catalogItemName')?.value?.trim();
    const category = document.getElementById('catalogItemCategory')?.value?.trim() || 'Bolo de Kg';
    const price = parseFloat(document.getElementById('catalogItemPrice')?.value) || 0;
    const description = document.getElementById('catalogItemDescription')?.value?.trim() || '';
    const servingSize = document.getElementById('catalogItemServing')?.value?.trim() || '';
    const minOrder = document.getElementById('catalogItemMinOrder')?.value?.trim() || '';
    const badge = document.getElementById('catalogItemBadge')?.value || '';

    if (!name || price <= 0) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(I18n.t('catalog.err_fill_fields'), 'warning');
      } else {
        alert(I18n.t('catalog.err_fill_fields'));
      }
      return;
    }

    if (!Array.isArray(State.catalog)) {
      State.catalog = [];
    }

    const itemData = {
      flavor: sanitizeText(name),
      name: sanitizeText(name),
      type: sanitizeText(category),
      category: sanitizeText(category),
      pricePerKg: price,
      salePrice: price,
      price: price,
      description: sanitizeText(description),
      servingSize: sanitizeText(servingSize),
      minOrder: sanitizeText(minOrder),
      badge: badge,
      active: true,
      updatedAt: new Date().toISOString()
    };

    if (id) {
      const idx = State.catalog.findIndex(it => it.id === id);
      if (idx !== -1) {
        State.catalog[idx] = {
          ...State.catalog[idx],
          ...itemData
        };
      }
    } else {
      itemData.id = 'cat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      itemData.createdAt = new Date().toISOString();
      State.catalog.unshift(itemData);
    }

    State.saveCatalog();
    this.closeItemModal();
    this.render();

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(I18n.t('catalog.saved_success'), 'success');
    }
  },

  deleteItem(id) {
    if (!id) return;
    const item = (State.catalog || []).find(it => it.id === id);
    if (!item) return;

    const doDelete = () => {
      const label = (item.flavor || item.name) + ` (${fmt(item.pricePerKg || item.salePrice || 0)})`;
      State.addToTrash(item, 'catalog', label);
      State.catalog = State.catalog.filter(it => it.id !== id);
      State.saveCatalog();
      this.render();
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(I18n.t('catalog.deleted_success'), 'info');
      }
    };

    if (typeof UI !== 'undefined' && UI.confirm) {
      UI.confirm(`${I18n.t('catalog.confirm_delete')} "${item.flavor || item.name}"?`, doDelete);
    } else if (confirm(`${I18n.t('catalog.confirm_delete')} "${item.flavor || item.name}"?`)) {
      doDelete();
    }
  },

  closeItemModal() {
    const modal = document.getElementById('catalogItemModal');
    if (modal) modal.classList.remove('active');
  },

  openProfileModal() {
    const modal = document.getElementById('bakeryProfileModal');
    if (!modal) return;

    const profile = State.bakeryProfile || {};
    const nameEl = document.getElementById('profileBakeryName');
    const taglineEl = document.getElementById('profileBakeryTagline');
    const phoneEl = document.getElementById('profileBakeryPhone');
    const instaEl = document.getElementById('profileBakeryInstagram');
    const pixEl = document.getElementById('profileBakeryPix');
    const noticeEl = document.getElementById('profileBakeryNotice');

    if (nameEl) nameEl.value = profile.name || '';
    if (taglineEl) taglineEl.value = profile.tagline || '';
    if (phoneEl) {
      phoneEl.value = profile.phone || '';
      maskPhone(phoneEl);
    }
    if (instaEl) instaEl.value = profile.instagram || '';
    if (pixEl) pixEl.value = profile.pix || '';
    if (noticeEl) noticeEl.value = profile.orderNotice || '';

    modal.classList.add('active');
  },

  saveProfile(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('profileBakeryName')?.value?.trim() || 'Minha Confeitaria';
    const tagline = document.getElementById('profileBakeryTagline')?.value?.trim() || '';
    const phone = document.getElementById('profileBakeryPhone')?.value?.trim() || '';
    const instagram = document.getElementById('profileBakeryInstagram')?.value?.trim() || '';
    const pix = document.getElementById('profileBakeryPix')?.value?.trim() || '';
    const orderNotice = document.getElementById('profileBakeryNotice')?.value?.trim() || '';

    State.bakeryProfile = {
      name: sanitizeText(name),
      tagline: sanitizeText(tagline),
      phone: sanitizeText(phone),
      instagram: sanitizeText(instagram),
      pix: sanitizeText(pix),
      orderNotice: sanitizeText(orderNotice),
      updatedAt: new Date().toISOString()
    };

    State.saveBakeryProfile();
    this.closeProfileModal();
    this.render();

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(I18n.t('catalog.profile_saved'), 'success');
    }
  },

  closeProfileModal() {
    const modal = document.getElementById('bakeryProfileModal');
    if (modal) modal.classList.remove('active');
  },

  createQuoteFromItem(itemId) {
    const item = (State.catalog || []).find(it => it.id === itemId);
    if (!item) return;

    if (typeof window.switchTab === 'function') {
      window.switchTab('quotes');
    }

    setTimeout(() => {
      if (typeof Quotes !== 'undefined' && Quotes.openModal) {
        Quotes.openModal();
        const typeEl = document.getElementById('quoteProductType');
        const flavorEl = document.getElementById('quoteFlavor');
        const priceEl = document.getElementById('quoteUnitPrice');
        const detailsEl = document.getElementById('quoteDetails');

        if (typeEl) {
          typeEl.value = item.type || item.category || 'Bolo de Kg';
          Quotes.updateProductLabels(typeEl.value);
        }
        if (flavorEl) flavorEl.value = item.flavor || item.name || '';
        if (priceEl) priceEl.value = (item.pricePerKg != null ? item.pricePerKg : (item.salePrice || item.price || 0)).toFixed(2);
        if (detailsEl && item.description) detailsEl.value = item.description;

        Quotes.calcTotal();
      }
    }, 100);
  },

  /**
   * Generates a formatted WhatsApp text menu of the catalog
   */
  generateWhatsAppCatalog() {
    const profile = State.bakeryProfile || { name: 'Confeitaria Artesanal' };
    const items = (State.catalog || []).filter(it => it.active !== false);

    if (items.length === 0) {
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(I18n.t('catalog.no_items_to_share'), 'warning');
      }
      return null;
    }

    let msg = `🍰 *CARDÁPIO & CATÁLOGO — ${profile.name.toUpperCase()}*\n`;
    if (profile.tagline) msg += `_${profile.tagline}_\n`;
    msg += `--------------------------------------\n\n`;

    // Group items by category / type
    const categories = {};
    items.forEach(it => {
      const cat = it.type || it.category || 'Especiais';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(it);
    });

    Object.keys(categories).forEach(cat => {
      msg += `📌 *${cat.toUpperCase()}*\n`;
      categories[cat].forEach(it => {
        const badgeStr = it.badge ? ` [${this.getBadgeLabel(it.badge)}]` : '';
        const priceVal = it.pricePerKg != null ? it.pricePerKg : (it.salePrice || it.price || 0);
        const suffix = cat === 'Bolo de Kg' ? '/Kg' : '/un';
        msg += `• *${it.flavor || it.name}*${badgeStr} — *${fmt(priceVal)}${suffix}*\n`;
        if (it.description) msg += `  _${it.description}_\n`;
        if (it.servingSize) msg += `  👥 Rende: ${it.servingSize}\n`;
        if (it.minOrder) msg += `  📦 Pedido mínimo: ${it.minOrder}\n`;
        msg += `\n`;
      });
    });

    msg += `--------------------------------------\n`;
    if (profile.orderNotice) msg += `ℹ️ *Avisos:* ${profile.orderNotice}\n`;
    if (profile.pix) msg += `💳 *Chave Pix:* \`${profile.pix}\`\n`;
    if (profile.instagram) msg += `📸 *Instagram:* ${profile.instagram}\n`;
    msg += `\n✨ _Para encomendar, responda esta mensagem informando os itens desejados!_`;

    return msg;
  },

  shareWhatsApp() {
    const msg = this.generateWhatsAppCatalog();
    if (!msg) return;

    const encoded = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  }
};

window.Catalog = Catalog;
