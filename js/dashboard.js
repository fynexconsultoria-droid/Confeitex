const Dashboard = {
  update() {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = State.orders.filter(o => o.deliveryDate === todayStr && o.status !== 'Cancelado');

    const todaySales = todayOrders.reduce((s, o) => s + getOrderTotal(o), 0);
    const todayWeight = todayOrders.reduce((s, o) => s + (o.weight || 0), 0);
    const pending = State.orders.filter(o => o.status === 'Pendente' || o.status === 'Em Produção').length;
    const totalEarnings = State.orders.filter(o => o.status !== 'Cancelado').reduce((s, o) => s + getOrderTotal(o), 0);

    const salesEl = document.getElementById('kpiSalesToday');
    if (salesEl) salesEl.textContent = fmt(todaySales);

    const weightEl = document.getElementById('kpiWeightToday');
    if (weightEl) weightEl.textContent = todayWeight.toFixed(1).replace('.', ',') + ' Kg';

    const pendingEl = document.getElementById('kpiPendingOrders');
    if (pendingEl) pendingEl.textContent = pending;

    const totalEl = document.getElementById('kpiTotalEarnings');
    if (totalEl) totalEl.textContent = fmt(totalEarnings);

    const pendingCard = document.getElementById('kpiPendingCard');
    if (pendingCard) {
      pendingCard.style.cursor = 'pointer';
      pendingCard.onclick = () => {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('active');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === 'orders'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'orders'));
        document.getElementById('mainTitle').textContent = 'Encomendas';
        document.getElementById('mainSubtitle').textContent = 'Gerencie e busque todos os pedidos registrados.';
        const filterStatus = document.getElementById('orderFilterStatus');
        if (filterStatus) filterStatus.value = 'Pendente';
        const searchInput = document.getElementById('orderSearchInput');
        if (searchInput) searchInput.value = '';
        const filterDate = document.getElementById('orderFilterDate');
        if (filterDate) filterDate.value = '';
        try { Orders.render(); } catch (e) { console.warn('[Confeitex]', e); }
      };
    }

    this.renderDeliveries();
    const dateInput = document.getElementById('calcDateInput');
    if (dateInput) this.calcDayTotals(dateInput.value);
    Chart.render();
  },

  renderDeliveries() {
    const container = document.getElementById('todayDeliveriesList');
    if (!container) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const orders = State.orders.filter(o => o.deliveryDate === todayStr).sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));

    if (orders.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding:1.5rem 0;">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>Nenhuma entrega para hoje</h3><p style="font-size:0.8rem;">Crie novas encomendas para acompanhar as entregas do dia.</p></div>`;
      return;
    }

    container.innerHTML = orders.map(o => {
      const badge = badgeClass(o.status);
      const val = getOrderTotal(o);
      const profit = val - (o.cost || 0);
      return `<div class="client-history-item" style="cursor:pointer;background:rgba(255,255,255,0.02);border:1px solid var(--border-color);padding:0.75rem;border-radius:var(--border-radius-md);display:flex;justify-content:space-between;align-items:center;gap:0.5rem;transition:all 0.2s ease;" data-id="${o.id}">
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">
            <span style="font-weight:700;font-size:0.85rem;color:var(--color-accent-pink);background:rgba(236,72,153,0.1);padding:0.1rem 0.4rem;border-radius:4px;">${o.deliveryTime}</span>
            <span class="customer-name" style="font-size:0.9rem;font-weight:600;">${escapeHTML(o.clientName)}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);">${escapeHTML(o.flavor)} (${formatWeight(o)})${o.cost ? ` · Lucro: <span style="color:var(--color-success);font-weight:600;">${fmt(profit)}</span>` : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.35rem;">
          <span class="badge ${badge}" style="font-size:0.65rem;padding:0.15rem 0.5rem;">${o.status}</span>
          <span style="font-weight:700;font-size:0.9rem;color:white;">${fmt(val)}</span>
          <span style="font-size:0.65rem;color:var(--text-muted);">${o.paymentMethod || 'Dinheiro'}</span>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('[data-id]').forEach(el => el.addEventListener('click', () => Orders.openEdit(el.dataset.id)));
  },

  calcDayTotals(dateStr) {
    if (!dateStr) return;
    const orders = State.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
    const dayVal = document.getElementById('calcDayValue');
    if (dayVal) dayVal.value = fmt(orders.reduce((s, o) => s + getOrderTotal(o), 0));
    const dayWeight = document.getElementById('calcDayWeight');
    if (dayWeight) dayWeight.value = orders.reduce((s, o) => s + (o.weight || 0), 0).toFixed(2).replace('.', ',') + ' Kg';
  }
};

