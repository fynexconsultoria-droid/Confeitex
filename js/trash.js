const Trash = {
  openModal() {
    State.purgeTrash();
    this.render();
    this.updateBadge();
    document.getElementById('trashModal').classList.add('active');
  },

  closeModal() {
    document.getElementById('trashModal').classList.remove('active');
  },

  render() {
    const container = document.getElementById('trashListContainer');
    const empty = document.getElementById('trashEmptyState');
    const btnEmpty = document.getElementById('btnEmptyTrash');
    if (!container) return;

    if (State.trash.length === 0) {
      container.innerHTML = '';
      empty.style.display = 'flex';
      btnEmpty.disabled = true;
      return;
    }

    empty.style.display = 'none';
    btnEmpty.disabled = false;
    container.innerHTML = State.trash.map(t => {
      const daysLeft = Math.max(0, Math.ceil((new Date(t.expiresAt).getTime() - Date.now()) / 86400000));
      const detail = t.type === 'client'
        ? `${t.count} pedido(s) · Expira em ${daysLeft} dia(s)`
        : `${t.orders[0]?.flavor || ''} · ${fmt(getOrderTotal(t.orders[0]))} · Expira em ${daysLeft} dia(s)`;
      return `<div class="trash-item">
        <div style="flex:1;min-width:0;">
          <div class="trash-item-title">${escapeHTML(t.label)}</div>
          <div class="trash-item-detail">${escapeHTML(detail)}</div>
        </div>
        <div class="trash-item-actions">
          <button class="btn btn-secondary btn-sm btn-trash-restore" data-id="${t.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            Restaurar
          </button>
          <button class="btn btn-danger btn-sm btn-trash-delete" data-id="${t.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Excluir
          </button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.btn-trash-restore').forEach(b => b.addEventListener('click', () => this.restore(b.dataset.id)));
    container.querySelectorAll('.btn-trash-delete').forEach(b => b.addEventListener('click', () => this.remove(b.dataset.id)));
  },

  async restore(id) {
    const entry = State.trash.find(t => t.id === id);
    if (!entry) return;
    if (!State.restoreFromTrash(id)) return;
    this.render();
    this.updateBadge();
    this.refreshActiveTab();
    UI.toast(entry.type === 'client' ? 'Cliente restaurado' : 'Pedido restaurado');
  },

  async remove(id) {
    const confirmed = await UI.confirm({
      title: 'Excluir Permanentemente',
      message: 'Este item será excluído de forma definitiva. Essa ação não pode ser desfeita.',
      confirmText: 'Excluir',
      variant: 'danger'
    });
    if (!confirmed) return;
    State.trash = State.trash.filter(t => t.id !== id);
    State.saveTrash();
    this.render();
    this.updateBadge();
    UI.toast('Item excluído permanentemente');
  },

  async empty() {
    const confirmed = await UI.confirm({
      title: 'Esvaziar Lixeira',
      message: 'Todos os itens da lixeira serão excluídos permanentemente. Essa ação não pode ser desfeita.',
      confirmText: 'Esvaziar',
      variant: 'danger'
    });
    if (!confirmed) return;
    State.emptyTrash();
    this.render();
    this.updateBadge();
    UI.toast('Lixeira esvaziada');
  },

  updateBadge() {
    const count = State.trash.length;
    document.querySelectorAll('[data-trash-count]').forEach(el => {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  refreshActiveTab() {
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'orders') Orders.render();
    else if (tab === 'clients') Clients.render();
    else if (tab === 'dashboard') Dashboard.update();
    else if (tab === 'finances') Finance.render();
  },

  setup() {
    document.querySelectorAll('.btn-open-trash').forEach(btn => btn.addEventListener('click', () => this.openModal()));
    document.getElementById('btnTrashClose').addEventListener('click', () => this.closeModal());
    document.getElementById('btnTrashCloseBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('btnEmptyTrash').addEventListener('click', () => this.empty());
    this.updateBadge();
  }
};
