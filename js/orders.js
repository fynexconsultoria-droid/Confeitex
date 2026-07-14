const Orders = {
  render() {
    const tbody = document.getElementById('ordersTableBody');
    const search = document.getElementById('orderSearchInput').value.toLowerCase();
    const filterStatus = document.getElementById('orderFilterStatus').value;
    const filterDate = document.getElementById('orderFilterDate').value;
    const empty = document.getElementById('ordersEmptyState');

    let filtered = State.orders.filter(o => {
      const matchSearch = o.clientName.toLowerCase().includes(search) || o.flavor.toLowerCase().includes(search) || o.clientPhone?.includes(search);
      const matchStatus = filterStatus === 'all' ? true : filterStatus === 'Pendente' ? (o.status === 'Pendente' || o.status === 'Em Produção') : o.status === filterStatus;
      return matchSearch && matchStatus && (!filterDate || o.deliveryDate === filterDate);
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
    let html = '';
    filtered.forEach(o => {
      const badge = badgeClass(o.status);
      const profit = o.totalValue - (o.cost || 0);
      const currentStatusIdx = ['Pendente', 'Em Produção', 'Entregue'].indexOf(o.status);
      html += `<tr class="order-row" data-id="${o.id}">
        <td>
          <span class="customer-name">${escapeHTML(o.clientName)}</span>
          ${o.clientPhone ? `<br><span style="font-size:0.7rem;color:var(--text-secondary);">${escapeHTML(o.clientPhone)}</span>` : ''}
        </td>
        <td>
          <span style="font-weight:600;color:white;">${escapeHTML(o.flavor)}</span>
          <br><span style="font-size:0.7rem;color:var(--text-muted);">${escapeHTML(o.productType)} · ${formatWeight(o)}</span>
        </td>
        <td><span style="font-weight:500;font-size:0.85rem;">${fmtDateStr(o.deliveryDate)}</span><br><span style="font-size:0.7rem;color:var(--text-secondary);">${o.deliveryTime}</span></td>
        <td class="text-right" style="font-weight:700;color:var(--color-accent-pink);font-size:0.9rem;">${fmt(o.totalValue)}</td>
        <td class="text-center"><span class="badge ${badge}" style="font-size:0.65rem;padding:0.15rem 0.4rem;">${o.status}</span></td>
      </tr>
      <tr class="order-detail-row" id="detail-${o.id.replace(/[^a-zA-Z0-9_-]/g, '')}" style="display:none;">
        <td colspan="5">
          <div class="order-detail-content">
            <div class="order-detail-grid">
              <div class="order-detail-item">
                <span class="order-detail-label">Telefone</span>
                <span>${escapeHTML(o.clientPhone || '—')}</span>
              </div>
              <div class="order-detail-item">
                <span class="order-detail-label">Peso / Quantidade</span>
                <span>${formatWeight(o)}</span>
              </div>
              <div class="order-detail-item">
                <span class="order-detail-label">Forma de Pagamento</span>
                <span>${o.paymentMethod || 'Dinheiro'}</span>
              </div>
              <div class="order-detail-item">
                <span class="order-detail-label">Lucro Estimado</span>
                <span style="color:${profit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${fmt(profit)}</span>
              </div>
              <div class="order-detail-item">
                <span class="order-detail-label">Custo do Pedido</span>
                <span>${o.cost ? fmt(o.cost) : '—'}</span>
              </div>
              <div class="order-detail-item">
                <span class="order-detail-label">Tipo</span>
                <span>${escapeHTML(o.productType)}</span>
              </div>
              ${o.details ? `<div class="order-detail-item" style="grid-column:1/-1;">
                <span class="order-detail-label">Recheio / Cobertura</span>
                <span>${escapeHTML(o.details)}</span>
              </div>` : ''}
              ${o.notes ? `<div class="order-detail-item" style="grid-column:1/-1;">
                <span class="order-detail-label">Observações</span>
                <span style="color:var(--color-warning);">${escapeHTML(o.notes)}</span>
              </div>` : ''}
            </div>
            <div class="order-detail-actions">
              <button class="btn btn-secondary btn-sm btn-edit" data-id="${o.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              ${currentStatusIdx >= 0 && currentStatusIdx < 2 ? `
              <button class="btn btn-secondary btn-sm btn-status-next" data-id="${o.id}" style="color:var(--color-success);border-color:rgba(16,185,129,0.2);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Avançar Status
              </button>` : o.status === 'Entregue' ? `
              <span style="font-size:0.75rem;color:var(--color-success);display:flex;align-items:center;gap:0.35rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                Pedido Entregue
              </span>` : `
              <button class="btn btn-secondary btn-sm btn-status-next" data-id="${o.id}" style="color:var(--color-warning);border-color:rgba(245,158,11,0.2);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                Reabrir Pedido
              </button>`}
              <button class="btn btn-secondary btn-sm btn-delete" data-id="${o.id}" style="color:var(--color-danger);border-color:rgba(239,68,68,0.2);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Excluir
              </button>
            </div>
          </div>
        </td>
      </tr>`;
    });
    tbody.innerHTML = html;

    // Row click to toggle detail
    tbody.querySelectorAll('.order-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const id = row.dataset.id;
        const detail = document.getElementById('detail-' + id.replace(/[^a-zA-Z0-9_-]/g, ''));
        if (detail) {
          const isVisible = detail.style.display !== 'none';
          detail.style.display = isVisible ? 'none' : 'table-row';
          row.classList.toggle('expanded', !isVisible);
        }
      });
      row.style.cursor = 'pointer';
    });

    tbody.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.openEdit(b.dataset.id); }));
    tbody.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.delete(b.dataset.id); }));
    tbody.querySelectorAll('.btn-status-next').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this.advanceStatus(b.dataset.id); }));

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

      const clientName = document.getElementById('orderClientName').value.trim();
      const flavor = document.getElementById('orderFlavor').value.trim();
      const deliveryDate = document.getElementById('orderDeliveryDate').value;
      const deliveryTime = document.getElementById('orderDeliveryTime').value;
      if (!clientName) { UI.alert('Informe o nome do cliente.'); return; }
      if (!flavor) { UI.alert('Informe o sabor do pedido.'); return; }
      if (!deliveryDate) { UI.alert('Informe a data de entrega.'); return; }
      if (!deliveryTime) { UI.alert('Informe o horário de entrega.'); return; }

      const id = document.getElementById('orderIdInput').value;
      const data = {
        clientName,
        clientPhone: document.getElementById('orderClientPhone').value.trim(),
        productType: document.getElementById('orderProductType').value,
        flavor,
        details: document.getElementById('orderDetails').value.trim(),
        weight: parseFloat(document.getElementById('orderWeight').value) || 0,
        unitPrice: parseFloat(document.getElementById('orderUnitPrice').value) || 0,
        extraCharges: parseFloat(document.getElementById('orderExtraCharges').value) || 0,
        cost: parseFloat(document.getElementById('orderCost').value) || 0,
        deliveryDate,
        deliveryTime,
        status: document.getElementById('orderStatus').value,
        notes: document.getElementById('orderNotes').value.trim(),
        paymentMethod: document.getElementById('orderPaymentMethod').value
      };
      data.totalValue = (data.weight * data.unitPrice) + data.extraCharges;

      if (id) {
        const idx = State.orders.findIndex(o => o.id === id);
        if (idx !== -1) {
          Object.assign(State.orders[idx], data);
          State.orders[idx].deliveredAt = data.status === 'Entregue' ? new Date().toISOString() : null;
        }
      } else {
        data.id = 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        data.createdAt = new Date().toISOString();
        data.deliveredAt = data.status === 'Entregue' ? new Date().toISOString() : null;
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
