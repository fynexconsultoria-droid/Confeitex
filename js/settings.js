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
      const win = window.open('', '_blank');
      if (!win) { UI.alert('Permita pop-ups para gerar o PDF.'); return; }
      const hoje = new Date().toLocaleDateString('pt-BR');
      const linhas = State.orders.map(o =>
        `<tr>
          <td>${escapeHTML(o.clientName)}<br><small>${escapeHTML(o.clientPhone || '')}</small></td>
          <td>${escapeHTML(o.flavor)}<br><small>${escapeHTML(o.productType)}</small></td>
          <td>${fmtDateStr(o.deliveryDate)} ${o.deliveryTime}</td>
          <td style="text-align:right">${o.weight}${o.productType === 'Bolo de Kg' ? ' Kg' : ' un'}</td>
          <td style="text-align:right">${fmt(o.totalValue)}</td>
          <td style="text-align:center">${o.status}</td>
        </tr>`
      ).join('');
      win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Backup Confeitex - ${hoje}</title>
<style>
  body{font-family:sans-serif;color:#222;padding:2rem}
  h1{font-size:1.4rem;margin-bottom:0.25rem}
  p{color:#666;font-size:0.85rem;margin-bottom:1.5rem}
  table{width:100%;border-collapse:collapse;font-size:0.8rem}
  th,td{padding:0.5rem;border:1px solid #ddd;text-align:left}
  th{background:#f5f5f5;font-weight:700}
  small{color:#999;font-size:0.7rem}
  @media print{body{padding:0.5rem}th{background:#eee!important}}
</style></head><body>
<h1>Confeitex - Relatório de Pedidos</h1>
<p>Gerado em ${hoje} — Total de ${State.orders.length} pedido(s)</p>
<table><thead><tr>
<th>Cliente</th><th>Produto</th><th>Entrega</th><th>Peso/Qtd</th><th>Valor</th><th>Status</th>
</tr></thead><tbody>${linhas}</tbody></table>
</body></html>`);
      win.document.close();
      setTimeout(() => { try { win.focus(); win.print(); } catch(e) {} }, 300);
      UI.toast('PDF gerado — salve como PDF no diálogo de impressão');
    });

    document.getElementById('btnImportData').addEventListener('click', () => document.getElementById('importFileInput').click());

    document.getElementById('importFileInput').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + '\n';
        }

        const lines = fullText.split('\n').map(l => l.trim()).filter(l => l);
        const orders = [];
        let inTable = false;

        for (const line of lines) {
          if (line.includes('Cliente') && line.includes('Produto') && line.includes('Entrega')) {
            inTable = true;
            continue;
          }
          if (!inTable) continue;
          if (line.includes('Confeitex') || line.includes('Gerado em') || line.includes('Total')) continue;

          const parts = line.split(/\s{2,}/).filter(p => p.trim());
          if (parts.length < 4) continue;

          const clientPart = parts[0];
          const flavorPart = parts[1] || '';
          const deliveryPart = parts[2] || '';
          const weightPart = parts[3] || '';
          const valuePart = parts[4] || '';
          const statusPart = parts[5] || '';

          const clientName = clientPart.replace(/\s*\(.*?\)\s*$/, '').trim();
          const phoneMatch = clientPart.match(/\((\d{2,3})\)\s*(\d{4,5})-?(\d{4})/);
          const clientPhone = phoneMatch ? `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}` : '';

          const flavor = flavorPart.replace(/\s*\(.*?\)\s*$/, '').trim();
          const productTypeMatch = flavorPart.match(/\(([^)]+)\)/);
          const productType = productTypeMatch ? productTypeMatch[1] : 'Bolo de Kg';

          const dateMatch = deliveryPart.match(/(\d{2}\/\d{2}\/\d{4})\s*(\d{2}:\d{2})/);
          const deliveryDate = dateMatch ? dateMatch[1].split('/').reverse().join('-') : '';
          const deliveryTime = dateMatch ? dateMatch[2] : '';

          const weight = parseFloat(weightPart.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
          const totalValue = parseFloat(valuePart.replace(/[^0-9,]/g, '').replace(',', '.')) || 0;
          const unitPrice = productType === 'Bolo de Kg' ? totalValue / (weight || 1) : totalValue;

          if (clientName && flavor && deliveryDate) {
            orders.push({
              id: 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              clientName,
              clientPhone,
              productType,
              flavor,
              details: '',
              weight,
              unitPrice: Math.round(unitPrice * 100) / 100,
              extraCharges: 0,
              cost: 0,
              deliveryDate,
              deliveryTime,
              status: statusPart || 'Pendente',
              notes: '',
              paymentMethod: 'Dinheiro',
              totalValue,
              createdAt: new Date().toISOString(),
              deliveredAt: statusPart === 'Entregue' ? new Date().toISOString() : null
            });
          }
        }

        if (orders.length === 0) throw new Error('no orders found');

        const ok = await UI.confirm({
          title: 'Importar Dados do PDF',
          message: `Foram encontrados ${orders.length} pedido(s) no PDF. Deseja importá-los? (Os dados atuais serão substituídos.)`,
          confirmText: 'Importar',
          variant: 'danger'
        });
        if (!ok) { e.target.value = ''; return; }

        State.orders = orders.map(migrateOrder);
        State.saveOrders();
        UI.toast(`${orders.length} pedido(s) importados do PDF com sucesso!`);
        const tab = document.querySelector('.nav-link.active')?.dataset.tab;
        if (tab === 'dashboard') Dashboard.update();
        else if (tab === 'orders') Orders.render();
        else if (tab === 'clients') Clients.render();
        else if (tab === 'settings') this.renderCatalog();
      } catch (err) {
        UI.alert('Não foi possível ler o PDF. Verifique se é um relatório exportado do Confeitex.');
      }
      e.target.value = '';
    });

    document.getElementById('btnLoadDemo').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Carregar Dados Demo', message: 'Isso substituirá TODOS os dados atuais pelos dados de demonstração. Deseja continuar?', confirmText: 'Carregar', variant: 'danger' });
      if (!ok) return;
      State.loadDemo(true);
      const tab = document.querySelector('.nav-link.active')?.dataset.tab;
      if (tab === 'dashboard') Dashboard.update();
      else if (tab === 'orders') Orders.render();
      else if (tab === 'clients') Clients.render();
      UI.toast('Dados de demonstração carregados');
    });

    document.getElementById('btnClearAllData').addEventListener('click', async () => {
      const ok = await UI.confirm({ title: 'Apagar Todos os Dados', message: 'ATENÇÃO: Isso apagará TODOS os dados permanentemente. Deseja continuar?', confirmText: 'Apagar', variant: 'danger' });
      if (!ok) return;
      State.orders = [];
      State.catalog = [...DEFAULT_CATALOG];
      State.saveOrders();
      State.saveCatalog();
      localStorage.removeItem('confeitex_notified');
      localStorage.removeItem('confeitex_notifications_enabled');
      Notifications._disable();
      if (Auth.lockEnabled) {
        Auth.disable();
        localStorage.removeItem('confeitex_lock_hash');
        Auth.lockHash = '';
        if (Auth.renderSecuritySettings) Auth.renderSecuritySettings();
        UI.toast('Dados, catálogo e bloqueio removidos');
      } else {
        UI.toast('Todos os dados foram excluídos');
      }
      this.renderCatalog();
      Dashboard.update();
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
      const sorted = [...State.orders].sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate) || b.deliveryTime.localeCompare(a.deliveryTime));
      const rows = sorted.map(o => [
        `"${o.clientName}"`, `"${o.clientPhone || ''}"`, `"${o.productType}"`, `"${o.flavor}"`,
        o.weight, (+o.unitPrice || 0).toFixed(2), (+o.extraCharges || 0).toFixed(2), (+o.cost || 0).toFixed(2),
        (+o.totalValue || 0).toFixed(2), `"${o.paymentMethod || 'Dinheiro'}"`,
        o.deliveryDate, o.deliveryTime, `"${o.status}"`,
        `"${(o.notes || '').replace(/"/g, '""')}"`
      ].join(','));
      const csv = '\uFEFF' + headers + '\n' + rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `confeitex_relatorio_${new Date().toISOString().split('T')[0]}.csv`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      UI.toast('Relatório CSV exportado');
    });

    // Segurança
    Auth.renderSecuritySettings();

    // Notificações
    this.renderNotificationStatus();
    Notifications.init();

    document.getElementById('btnToggleNotifications').addEventListener('click', async () => {
      if (Notifications.status === 'unsupported') {
        UI.alert('Notificações não são suportadas neste navegador.');
        return;
      }
      if (Notifications.status === 'denied') {
        UI.alert('A permissão de notificações foi negada. Ative nas configurações do navegador.');
        return;
      }
      if (Notifications.enabled) {
        Notifications.disable();
        this.renderNotificationStatus();
        UI.toast('Notificações desativadas.');
      } else {
        const ok = await Notifications.enable();
        this.renderNotificationStatus();
        if (ok) {
          UI.toast('Notificações ativadas! Você receberá lembretes das entregas pendentes.');
        } else {
          UI.alert('Não foi possível ativar as notificações. Verifique a permissão no navegador.');
        }
      }
    });
  },

  renderNotificationStatus() {
    const dot = document.getElementById('notificationStatusDot');
    const text = document.getElementById('notificationStatusText');
    const info = document.getElementById('notificationInfoText');
    const btnText = document.getElementById('btnNotificationsText');
    const btn = document.getElementById('btnToggleNotifications');
    if (!dot || !text || !info || !btnText || !btn) return;

    if (Notifications.status === 'unsupported') {
      dot.style.background = 'var(--color-danger)';
      text.textContent = 'Não suportado';
      text.style.color = 'var(--color-danger)';
      info.textContent = 'Seu navegador não suporta notificações.';
      btnText.textContent = 'Não suportado';
      btn.disabled = true;
      return;
    }

    if (Notifications.status === 'denied') {
      dot.style.background = 'var(--color-danger)';
      text.textContent = 'Permissão negada';
      text.style.color = 'var(--color-danger)';
      info.textContent = 'Ative as notificações nas configurações do navegador.';
      btnText.textContent = 'Permissão Negada';
      btn.disabled = false;
      btn.className = 'btn btn-secondary';
      return;
    }

    if (Notifications.enabled) {
      dot.style.background = 'var(--color-success)';
      text.textContent = 'Notificações ativas';
      text.style.color = 'var(--color-success)';
      info.textContent = 'Você receberá lembretes automáticos de entregas pendentes.';
      btnText.textContent = 'Desativar Notificações';
      btn.className = 'btn btn-secondary';
    } else {
      dot.style.background = 'var(--text-muted)';
      text.textContent = 'Notificações inativas';
      text.style.color = 'var(--text-muted)';
      info.textContent = 'Ative para receber lembretes de entregas pendentes.';
      btnText.textContent = 'Ativar Notificações';
      btn.className = 'btn btn-primary';
    }
  }
};
