const Clients = {
  render() {
    const tbody = document.getElementById('clientsTableBody');
    const search = document.getElementById('clientSearchInput').value.toLowerCase();
    const empty = document.getElementById('clientsEmptyState');

    const map = {};
    State.orders.forEach(o => {
      const key = o.clientPhone ? `${o.clientName.trim()}_${o.clientPhone.trim()}` : o.clientName.trim();
      if (!map[key]) map[key] = { name: o.clientName, phone: o.clientPhone || 'Sem telefone', totalOrders: 0, totalSpent: 0, ordersList: [] };
      map[key].totalOrders++;
      if (o.status !== 'Cancelado') map[key].totalSpent += o.totalValue;
      map[key].ordersList.push(o);
    });

    let clients = Object.values(map).filter(c => c.name.toLowerCase().includes(search) || c.phone.includes(search));
    clients.sort((a, b) => b.totalSpent - a.totalSpent);

    if (clients.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'flex';
      const table = tbody.closest('table');
      if (table) table.style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    const table = tbody.closest('table');
    if (table) table.style.display = 'table';
    const clientMap = {};
    tbody.innerHTML = clients.map((c, idx) => {
      clientMap[idx] = c;
      return `<tr>
        <td><span style="font-weight:600;color:white;font-size:0.85rem;">${escapeHTML(c.name)}</span></td>
        <td style="font-size:0.8rem;color:var(--text-secondary);">${escapeHTML(c.phone)}</td>
        <td class="text-center" style="font-weight:600;font-size:0.85rem;">${c.totalOrders}</td>
        <td class="text-right" style="font-weight:700;color:var(--color-accent-pink);font-size:0.85rem;">${fmt(c.totalSpent)}</td>
        <td class="text-center" style="display:flex;gap:0.35rem;justify-content:center;">
          <button class="btn btn-secondary btn-icon-only btn-edit-client" data-idx="${idx}" title="Editar Cliente" style="padding:0.35rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-secondary btn-icon-only btn-view-history" data-idx="${idx}" title="Histórico" style="padding:0.35rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-view-history').forEach(b => {
      b.addEventListener('click', () => this.openHistory(clientMap[b.dataset.idx]));
    });
    tbody.querySelectorAll('.btn-edit-client').forEach(b => {
      b.addEventListener('click', () => this.openEdit(clientMap[b.dataset.idx]));
    });

    const searchInput = document.getElementById('clientSearchInput');
    if (!searchInput.dataset.hasListener) {
      searchInput.addEventListener('input', () => this.render());
      searchInput.dataset.hasListener = '1';
    }
  },

  openEdit(client) {
    document.getElementById('editClientName').value = client.name;
    document.getElementById('editClientPhone').value = client.phone === 'Sem telefone' ? '' : client.phone;
    document.getElementById('editClientOriginalName').value = client.name;
    document.getElementById('editClientOriginalPhone').value = client.phone === 'Sem telefone' ? '' : client.phone;
    document.getElementById('clientEditModal').classList.add('active');
  },

  saveEdit() {
    const origName = document.getElementById('editClientOriginalName').value;
    const origPhone = document.getElementById('editClientOriginalPhone').value;
    const newName = document.getElementById('editClientName').value.trim();
    const newPhone = document.getElementById('editClientPhone').value.trim();

    if (!newName) { UI.alert('O nome do cliente é obrigatório.'); return; }

    State.orders.forEach(o => {
      const matchName = o.clientName === origName;
      const matchPhone = origPhone ? o.clientPhone === origPhone : true;
      if (matchName && matchPhone) {
        o.clientName = newName;
        o.clientPhone = newPhone;
      }
    });
    State.saveOrders();
    document.getElementById('clientEditModal').classList.remove('active');
    this.render();
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'dashboard') Dashboard.update();
    UI.toast('Cliente atualizado em todos os pedidos');
  },

  openHistory(client) {
    document.getElementById('clientDetailName').textContent = client.name;
    document.getElementById('clientDetailPhone').textContent = `Telefone: ${client.phone}`;
    document.getElementById('clientDetailOrdersCount').textContent = client.totalOrders;
    document.getElementById('clientDetailSpent').textContent = fmt(client.totalSpent);
    document.getElementById('btnEditFromHistory').dataset.name = client.name;
    document.getElementById('btnEditFromHistory').dataset.phone = client.phone === 'Sem telefone' ? '' : client.phone;

    const list = document.getElementById('clientOrdersHistoryList');
    const sorted = [...client.ordersList].sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
    list.innerHTML = sorted.map(o => {
      const badge = badgeClass(o.status);
      return `<div class="client-history-item">
        <div>
          <div style="font-weight:700;font-size:0.9rem;color:white;">${escapeHTML(o.flavor)} <span style="font-size:0.7rem;color:var(--text-muted);">(${o.productType})</span></div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.2rem;">Entrega: ${fmtDateStr(o.deliveryDate)} às ${o.deliveryTime}</div>
        </div>
        <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;">
          <span class="badge ${badge}" style="font-size:0.65rem;padding:0.1rem 0.4rem;">${o.status}</span>
          <strong style="color:var(--color-accent-pink);font-size:0.9rem;">${fmt(o.totalValue)}</strong>
          <span style="font-size:0.65rem;color:var(--text-muted);">${o.paymentMethod}</span>
        </div>
      </div>`;
    }).join('');

    document.getElementById('clientModal').classList.add('active');
    document.getElementById('btnModalClientClose').onclick = () => document.getElementById('clientModal').classList.remove('active');
    document.getElementById('btnModalClientCloseBtn').onclick = () => document.getElementById('clientModal').classList.remove('active');
    document.getElementById('btnEditFromHistory').onclick = () => {
      document.getElementById('clientModal').classList.remove('active');
      this.openEdit({ name: document.getElementById('btnEditFromHistory').dataset.name, phone: document.getElementById('btnEditFromHistory').dataset.phone || 'Sem telefone' });
    };
  },

  setupEditModal() {
    document.getElementById('btnClientEditClose').addEventListener('click', () => document.getElementById('clientEditModal').classList.remove('active'));
    document.getElementById('btnClientEditCancel').addEventListener('click', () => document.getElementById('clientEditModal').classList.remove('active'));
    document.getElementById('btnClientEditSave').addEventListener('click', () => this.saveEdit());
    document.getElementById('editClientPhone').addEventListener('input', (e) => maskPhone(e.target));
  }
};