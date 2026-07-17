const Dashboard = {
  update() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = State.orders.filter(o => o.deliveryDate === todayStr && o.status !== 'Cancelado');

    document.getElementById('kpiSalesToday').textContent = fmt(todayOrders.reduce((s, o) => s + (+o.totalValue || 0), 0));
    document.getElementById('kpiWeightToday').textContent = todayOrders.reduce((s, o) => s + (o.weight || 0), 0).toFixed(1).replace('.', ',') + ' Kg';

    const pending = State.orders.filter(o => o.status === 'Pendente' || o.status === 'Em Produção').length;
    document.getElementById('kpiPendingOrders').textContent = pending;
    document.getElementById('kpiPendingCard').style.cursor = 'pointer';
    document.getElementById('kpiPendingCard').onclick = () => {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === 'orders'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'orders'));
      document.getElementById('mainTitle').textContent = 'Encomendas';
      document.getElementById('mainSubtitle').textContent = 'Gerencie e busque todos os pedidos registrados.';
      document.getElementById('orderFilterStatus').value = 'Pendente';
      document.getElementById('orderSearchInput').value = '';
      document.getElementById('orderFilterDate').value = '';
      Orders.render();
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    });

    document.getElementById('kpiTotalEarnings').textContent = fmt(State.orders.filter(o => o.status !== 'Cancelado').reduce((s, o) => s + (+o.totalValue || 0), 0));

    this.renderDeliveries();
    this.calcDayTotals(document.getElementById('calcDateInput').value);
    Chart.render();
  },

  renderDeliveries() {
    const container = document.getElementById('todayDeliveriesList');
    const todayStr = new Date().toISOString().split('T')[0];
    const orders = State.orders.filter(o => o.deliveryDate === todayStr).sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));

    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:1.5rem 0;">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>Nenhuma entrega para hoje</h3><p style="font-size:0.8rem;">Crie novas encomendas.</p></div>`;
      return;
    }

    container.innerHTML = orders.map(o => {
      const badge = badgeClass(o.status);
      const profit = o.totalValue - (o.cost || 0);
      return `<div class="client-history-item" style="cursor:pointer;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);padding:0.75rem;border-radius:var(--border-radius-md);display:flex;justify-content:space-between;align-items:center;gap:0.5rem;" data-id="${o.id}">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
            <span style="font-weight:700;font-size:0.85rem;color:var(--color-accent-pink);">${o.deliveryTime}</span>
            <span class="customer-name" style="font-size:0.9rem;max-width:120px;">${escapeHTML(o.clientName)}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${escapeHTML(o.flavor)} (${formatWeight(o)})${o.cost ? ` · Lucro: ${fmt(profit)}` : ''}</div>

        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;">
          <span class="badge ${badge}" style="font-size:0.65rem;padding:0.15rem 0.5rem;">${o.status}</span>
          <span style="font-weight:700;font-size:0.85rem;color:white;">${fmt(o.totalValue)}</span>
          <span style="font-size:0.65rem;color:var(--text-muted);">${o.paymentMethod}</span>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => Orders.openEdit(el.dataset.id)));
  },

  calcDayTotals(dateStr) {
    if (!dateStr) return;
    const orders = State.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
    document.getElementById('calcDayValue').value = fmt(orders.reduce((s, o) => s + (+o.totalValue || 0), 0));
    document.getElementById('calcDayWeight').value = orders.reduce((s, o) => s + (o.weight || 0), 0).toFixed(2).replace('.', ',') + ' Kg';
  }
};
