const Settings = {
  renderCatalog() {
    const container = document.getElementById('catalogListContainer');
    container.innerHTML = State.catalog.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.03);gap:0.5rem;">
        <div style="flex:1;">
          <span style="font-weight:600;font-size:0.9rem;color:white;">${escapeHTML(item.flavor)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);display:block;">${item.type}</span>
        </div>
        <div style="font-weight:700;color:var(--color-accent-pink);font-size:0.9rem;margin-right:0.5rem;">R$ ${item.pricePerKg.toFixed(2)}${item.type === 'Bolo de Kg' ? '/Kg' : '/un'}</div>
        <button class="btn btn-secondary btn-icon-only btn-del-cat" data-id="${item.id}" style="padding:0.3rem;color:var(--color-danger);border-color:rgba(239,68,68,0.2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-del-cat').forEach(b => b.addEventListener('click', () => {
      State.catalog = State.catalog.filter(c => c.id !== b.dataset.id);
      State.saveCatalog();
      this.renderCatalog();
    }));
  },

  setup() {
    document.getElementById('btnExportData').addEventListener('click', () => {
      const dataStr = JSON.stringify({ orders: State.orders, catalog: State.catalog }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `backup_fyntex_${new Date().toISOString().split('T')[0]}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      UI.toast('Backup baixado');
    });

    document.getElementById('btnImportData').addEventListener('click', () => document.getElementById('importFileInput').click());

    document.getElementById('importFileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data.orders || !Array.isArray(data.orders) || data.orders.length === 0) throw new Error('invalid');
          // Validate each order has required fields
          const valid = data.orders.every(o => o.clientName && o.flavor && o.deliveryDate && o.totalValue !== undefined);
          if (!valid) throw new Error('missing fields');
          State.orders = data.orders.map(migrateOrder);
          if (data.catalog && Array.isArray(data.catalog)) State.catalog = data.catalog;
          State.saveOrders();
          State.saveCatalog();
          UI.toast('Dados importados com sucesso!');
          const tab = document.querySelector('.nav-link.active')?.dataset.tab;
          if (tab === 'dashboard') Dashboard.update();
          else if (tab === 'orders') Orders.render();
          else if (tab === 'clients') Clients.render();
          else if (tab === 'settings') this.renderCatalog();
        } catch {
          UI.alert('Arquivo inválido. Verifique o formato do backup.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    document.getElementById('btnLoadDemo').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Carregar Dados Demo', message: 'Isso substituirá TODOS os dados atuais pelos dados de demonstração. Deseja continuar?', confirmText: 'Carregar', variant: 'danger' });
      if (!ok) return;
      State.loadDemo(true);
      Dashboard.update();
      UI.toast('Dados de demonstração carregados');
    });

    document.getElementById('btnClearAllData').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Apagar Todos os Dados', message: 'ATENÇÃO: Isso apagará TODOS os dados permanentemente. Deseja continuar?', confirmText: 'Apagar', variant: 'danger' });
      if (!ok) return;
      State.orders = [];
      State.saveOrders();
      Dashboard.update();
      UI.toast('Todos os dados foram excluídos');
    });

    // Catalog add with type selection
    document.getElementById('btnAddCatalogItem').addEventListener('click', () => {
      const flavor = document.getElementById('newCatalogFlavor').value.trim();
      const price = parseFloat(document.getElementById('newCatalogPrice').value) || 0;
      const type = document.getElementById('newCatalogType').value;

      if (!flavor || price <= 0) {
        UI.alert('Preencha o sabor e um preço válido.');
        return;
      }

      State.catalog.push({ id: 'cat_' + Date.now(), flavor, pricePerKg: price, type });
      State.saveCatalog();
      document.getElementById('newCatalogFlavor').value = '';
      document.getElementById('newCatalogPrice').value = '';
      this.renderCatalog();
      UI.toast('Sabor adicionado ao catálogo');
    });

    // CSV export
    document.getElementById('btnExportCSV').addEventListener('click', () => {
      const headers = 'Cliente,Telefone,Produto,Sabor,Peso/Quant,Valor Unit.,Taxa Extra,Custo,Valor Total,Pagamento,Data Entrega,Hora,Status,Obs';
      const rows = State.orders.map(o => [
        `"${o.clientName}"`, `"${o.clientPhone || ''}"`, `"${o.productType}"`, `"${o.flavor}"`,
        o.weight, o.unitPrice.toFixed(2), o.extraCharges.toFixed(2), (o.cost || 0).toFixed(2),
        o.totalValue.toFixed(2), `"${o.paymentMethod || 'Dinheiro'}"`,
        o.deliveryDate, o.deliveryTime, `"${o.status}"`,
        `"${(o.notes || '').replace(/"/g, '""')}"`
      ].join(','));
      const csv = '\uFEFF' + headers + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `fyntex_relatorio_${new Date().toISOString().split('T')[0]}.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      UI.toast('Relatório CSV exportado');
    });

    // Notificações programadas
    document.getElementById('btnEnableNotifications').addEventListener('click', async () => {
      if (!('Notification' in window)) { UI.alert('Notificações não suportadas neste navegador.'); return; }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        UI.toast('Notificações ativadas! Você receberá lembretes das entregas pendentes.');
        Notifications.schedule();
        Notifications.check();
      } else {
        UI.alert('Permissão de notificações negada. Ative nas configurações do navegador.');
      }
    });
  }
};
