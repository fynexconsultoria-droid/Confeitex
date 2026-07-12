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
      tbody.closest('table').style.display = 'none';
      return;
    }

    empty.style.display = 'none';
    tbody.closest('table').style.display = 'table';
    const clientMap = {};
    tbody.innerHTML = clients.map(c => {
      const idx = Object.keys(clientMap).length;
      clientMap[idx] = c;
      return `<tr>
        <td><span style="font-weight:700;color:white;">${escapeHTML(c.name)}</span></td>
        <td>${escapeHTML(c.phone)}</td>
        <td class="text-center" style="font-weight:500;">${c.totalOrders}</td>
        <td class="text-right" style="font-weight:700;color:var(--color-accent-pink);">${fmt(c.totalSpent)}</td>
        <td class="text-center"><button class="btn btn-secondary btn-icon-only btn-view-history" data-idx="${idx}" title="Histórico" style="padding:0.4rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-view-history').forEach(b => {
      b.addEventListener('click', () => this.openHistory(clientMap[b.dataset.idx]));
    });

    const searchInput = document.getElementById('clientSearchInput');
    if (!searchInput.dataset.hasListener) {
      searchInput.addEventListener('input', () => this.render());
      searchInput.dataset.hasListener = '1';
    }
  },

  openHistory(client) {
    document.getElementById('clientDetailName').textContent = client.name;
    document.getElementById('clientDetailPhone').textContent = `Telefone: ${client.phone}`;
    document.getElementById('clientDetailOrdersCount').textContent = client.totalOrders;
    document.getElementById('clientDetailSpent').textContent = fmt(client.totalSpent);

    const list = document.getElementById('clientOrdersHistoryList');
    const sorted = [...client.ordersList].sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
    list.innerHTML = sorted.map(o => {
      const badge = badgeClass(o.status);
      return `<div class="client-history-item">
        <div>
          <div style="font-weight:700;font-size:0.9rem;color:white;">${escapeHTML(o.flavor)} <span style="font-size:0.7rem;color:var(--text-muted);">(${o.productType})</span></div>
          <div style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.2rem;">Entrega: ${fmtDateStr(o.deliveryDate)} às ${o.deliveryTime}</div>
          ${o.address ? `<div style="font-size:0.7rem;color:var(--text-muted);">${escapeHTML(o.address)}, ${o.addressNumber}</div>` : ''}
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
  }
};
