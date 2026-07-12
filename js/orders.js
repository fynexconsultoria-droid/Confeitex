const Orders = {
  render() {
    const tbody = document.getElementById('ordersTableBody');
    const search = document.getElementById('orderSearchInput').value.toLowerCase();
    const filterStatus = document.getElementById('orderFilterStatus').value;
    const filterDate = document.getElementById('orderFilterDate').value;
    const empty = document.getElementById('ordersEmptyState');

    let filtered = State.orders.filter(o => {
      const matchSearch = o.clientName.toLowerCase().includes(search) || o.flavor.toLowerCase().includes(search) || o.clientPhone?.includes(search);
      return matchSearch && (filterStatus === 'all' || o.status === filterStatus) && (!filterDate || o.deliveryDate === filterDate);
    });

    filtered.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.deliveryTime.localeCompare(a.deliveryTime));

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'flex';
      document.getElementById('ordersTable').style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    document.getElementById('ordersTable').style.display = 'table';
    tbody.innerHTML = filtered.map(o => {
      const badge = badgeClass(o.status);
      return `<tr>
        <td><div class="customer-info-box"><span class="customer-name">${escapeHTML(o.clientName)}</span><span class="customer-phone">${escapeHTML(o.clientPhone || 'Sem telefone')}</span></div></td>
        <td>
          <div style="font-weight:600;color:white;">${escapeHTML(o.flavor)} <span style="font-size:0.75rem;color:var(--color-accent-pink);background:rgba(236,72,153,0.1);padding:0.1rem 0.4rem;border-radius:4px;margin-left:0.25rem;">${escapeHTML(o.productType)}</span></div>
          ${o.details ? `<div class="product-desc">${escapeHTML(o.details)}</div>` : ''}
          ${o.notes ? `<div style="font-size:0.75rem;color:var(--color-warning);margin-top:0.2rem;">Obs: ${escapeHTML(o.notes)}</div>` : ''}

        </td>
        <td><div style="font-weight:500;">${fmtDateStr(o.deliveryDate)}</div><div style="font-size:0.8rem;color:var(--text-secondary);">${o.deliveryTime}</div></td>
        <td class="text-right" style="font-weight:500;">${formatWeight(o)}</td>
        <td class="text-right" style="font-weight:700;color:var(--color-accent-pink);">${fmt(o.totalValue)}</td>
        <td class="text-center"><span class="badge ${badge}">${o.status}</span></td>
        <td class="text-center">
          <div style="display:flex;gap:0.4rem;justify-content:center;">
            <button class="btn btn-secondary btn-icon-only btn-edit" data-id="${o.id}" title="Editar" style="padding:0.4rem;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-secondary btn-icon-only btn-status-next" data-id="${o.id}" title="Avançar Status" style="padding:0.4rem;color:var(--color-success);border-color:rgba(16,185,129,0.2);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </button>
            <button class="btn btn-secondary btn-icon-only btn-delete" data-id="${o.id}" title="Excluir" style="padding:0.4rem;color:var(--color-danger);border-color:rgba(239,68,68,0.2);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => this.openEdit(b.dataset.id)));
    tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => this.delete(b.dataset.id)));
    tbody.querySelectorAll('.btn-status-next').forEach(b => b.addEventListener('click', () => this.advanceStatus(b.dataset.id)));

    // Filter listeners (once)
    ['orderFilterStatus', 'orderFilterDate'].forEach(id => {
      const el = document.getElementById(id);
      if (!el.dataset.hasListener) { el.addEventListener('change', () => this.render()); el.dataset.hasListener = '1'; }
    });
    const searchInput = document.getElementById('orderSearchInput');
    if (!searchInput.dataset.hasListener) {
      searchInput.addEventListener('input', () => this.render());
      searchInput.dataset.hasListener = '1';
    }
    const btnClear = document.getElementById('btnClearFilters');
    if (!btnClear.dataset.hasListener) {
      btnClear.addEventListener('click', () => {
        document.getElementById('orderSearchInput').value = '';
        document.getElementById('orderFilterStatus').value = 'all';
        document.getElementById('orderFilterDate').value = '';
        this.render();
      });
      btnClear.dataset.hasListener = '1';
    }
  },

  openEdit(id) {
    const o = State.orders.find(item => item.id === id);
    if (!o) return;
    document.getElementById('orderIdInput').value = o.id;
    document.getElementById('modalOrderTitleText').textContent = 'Editar Encomenda';
    this.fillForm(o);
    document.getElementById('orderModal').classList.add('active');
  },

  fillForm(o) {
    const fieldMap = {
      orderClientName: 'clientName', orderClientPhone: 'clientPhone', orderProductType: 'productType',
      orderFlavor: 'flavor', orderDetails: 'details', orderWeight: 'weight', orderUnitPrice: 'unitPrice',
      orderExtraCharges: 'extraCharges', orderDeliveryDate: 'deliveryDate', orderDeliveryTime: 'deliveryTime',
      orderStatus: 'status', orderNotes: 'notes', orderPaymentMethod: 'paymentMethod', orderCost: 'cost'
    };
    Object.entries(fieldMap).forEach(([elId, stateKey]) => {
      const el = document.getElementById(elId);
      if (el) el.value = o[stateKey] ?? '';
    });
    const label = document.getElementById('orderProductType').value;
    this.updateLabels(label);
    this.populateFlavorSelect();
    this.calcTotal();

    // Set phone mask value
    const phoneInput = document.getElementById('orderClientPhone');
    if (phoneInput && o.clientPhone) phoneInput.value = o.clientPhone;
  },

  updateLabels(type) {
    document.getElementById('labelWeight').textContent = type === 'Bolo de Kg' ? 'Peso (Kg) *' : 'Quantidade *';
    document.getElementById('labelUnitPrice').textContent = type === 'Bolo de Kg' ? 'Preço por Kg (R$) *' : 'Preço Unitário (R$) *';
    document.getElementById('orderWeight').step = type === 'Bolo de Kg' ? '0.05' : '1';
  },

  populateFlavorSelect() {
    const sel = document.getElementById('orderFlavorSelect');
    const type = document.getElementById('orderProductType').value;
    sel.innerHTML = '<option value="">-- Personalizado / Catálogo --</option>';
    State.catalog.filter(i => type === 'Bolo de Kg' ? i.type === 'Bolo de Kg' : i.type !== 'Bolo de Kg')
      .forEach(i => sel.innerHTML += `<option value="${i.id}">${escapeHTML(i.flavor)} (R$ ${i.pricePerKg.toFixed(2)}${i.type === 'Bolo de Kg' ? '/Kg' : '/un'})</option>`);
  },

  calcTotal() {
    const w = parseFloat(document.getElementById('orderWeight').value) || 0;
    const p = parseFloat(document.getElementById('orderUnitPrice').value) || 0;
    const e = parseFloat(document.getElementById('orderExtraCharges').value) || 0;
    document.getElementById('orderTotalValDisplay').value = fmt((w * p) + e);
  },

  async delete(id) {
    const confirmed = await UI.confirm({ title: 'Excluir Pedido', message: 'Tem certeza que deseja excluir esta encomenda permanentemente?', confirmText: 'Excluir', variant: 'danger' });
    if (!confirmed) return;
    State.orders = State.orders.filter(o => o.id !== id);
    State.saveOrders();
    this.render();
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'dashboard') Dashboard.update();
    else if (tab === 'clients') Clients.render();
    UI.toast('Pedido excluído');
  },

  advanceStatus(id) {
    const idx = State.orders.findIndex(o => o.id === id);
    if (idx === -1) return;
    const cycle = ['Pendente', 'Em Produção', 'Entregue'];
    const cur = State.orders[idx].status;
    const ci = cycle.indexOf(cur);
    if (ci !== -1 && ci < cycle.length - 1) {
      State.orders[idx].status = cycle[ci + 1];
      if (cycle[ci + 1] === 'Entregue') State.orders[idx].deliveredAt = new Date().toISOString();
      State.saveOrders();
      this.render();
      const tab = document.querySelector('.nav-link.active')?.dataset.tab;
      if (tab === 'dashboard') Dashboard.update();
      UI.toast(`Status atualizado para ${cycle[ci + 1]}`);
    } else if (cur === 'Cancelado') {
      State.orders[idx].status = 'Pendente';
      State.saveOrders();
      this.render();
      UI.toast('Pedido reaberto como Pendente');
    } else if (cur === 'Entregue') {
      UI.alert('Esta encomenda já foi entregue.');
    }
  },

  setupForm() {
    const modal = document.getElementById('orderModal');
    const form = document.getElementById('orderForm');

    document.getElementById('btnNewOrder').addEventListener('click', () => {
      form.reset();
      document.getElementById('orderIdInput').value = '';
      document.getElementById('modalOrderTitleText').textContent = 'Novo Pedido';
      document.getElementById('orderDeliveryDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('orderDeliveryTime').value = '14:00';
      document.getElementById('orderWeight').value = '1.00';
      document.getElementById('orderUnitPrice').value = '60.00';
      document.getElementById('orderExtraCharges').value = '0.00';
      document.getElementById('orderCost').value = '0.00';
      document.getElementById('orderPaymentMethod').value = 'Dinheiro';
      document.getElementById('orderStatus').value = 'Pendente';
      this.updateLabels('Bolo de Kg');
      this.populateFlavorSelect();
      this.calcTotal();
      modal.classList.add('active');
    });

    document.getElementById('btnModalOrderClose').addEventListener('click', () => modal.classList.remove('active'));
    document.getElementById('btnModalOrderCancel').addEventListener('click', () => modal.classList.remove('active'));

    // Phone mask
    document.getElementById('orderClientPhone').addEventListener('input', (e) => maskPhone(e.target));

    ['orderWeight', 'orderUnitPrice', 'orderExtraCharges'].forEach(id =>
      document.getElementById(id).addEventListener('input', () => this.calcTotal()));

    document.getElementById('orderProductType').addEventListener('change', (e) => {
      this.updateLabels(e.target.value);
      this.populateFlavorSelect();
      this.calcTotal();
    });

    document.getElementById('orderFlavorSelect').addEventListener('change', (e) => {
      const item = State.catalog.find(c => c.id === e.target.value);
      if (item) {
        document.getElementById('orderFlavor').value = item.flavor;
        document.getElementById('orderUnitPrice').value = item.pricePerKg.toFixed(2);
        this.calcTotal();
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('orderIdInput').value;
      const data = {
        clientName: document.getElementById('orderClientName').value.trim(),
        clientPhone: document.getElementById('orderClientPhone').value.trim(),
        productType: document.getElementById('orderProductType').value,
        flavor: document.getElementById('orderFlavor').value.trim(),
        details: document.getElementById('orderDetails').value.trim(),
        weight: parseFloat(document.getElementById('orderWeight').value) || 0,
        unitPrice: parseFloat(document.getElementById('orderUnitPrice').value) || 0,
        extraCharges: parseFloat(document.getElementById('orderExtraCharges').value) || 0,
        cost: parseFloat(document.getElementById('orderCost').value) || 0,
        deliveryDate: document.getElementById('orderDeliveryDate').value,
        deliveryTime: document.getElementById('orderDeliveryTime').value,
        status: document.getElementById('orderStatus').value,
        notes: document.getElementById('orderNotes').value.trim(),
        paymentMethod: document.getElementById('orderPaymentMethod').value
      };
      data.totalValue = (data.weight * data.unitPrice) + data.extraCharges;

      if (id) {
        const idx = State.orders.findIndex(o => o.id === id);
        if (idx !== -1) Object.assign(State.orders[idx], data);
      } else {
        data.id = 'o_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        data.createdAt = new Date().toISOString();
        data.deliveredAt = null;
        State.orders.push(data);
      }

      State.saveOrders();
      modal.classList.remove('active');
      const tab = document.querySelector('.nav-link.active')?.dataset.tab;
      if (tab === 'dashboard') Dashboard.update();
      else this.render();
      if (tab === 'clients') Clients.render();
      UI.toast(id ? 'Pedido atualizado' : 'Pedido criado');
    });
  }
};
