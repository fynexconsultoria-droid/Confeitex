const Settings = {
  renderCatalog() {
    const container = document.getElementById('catalogListContainer');
    if (!container) return;
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
    // 1. Exportar PDF (Seguro via iframe — sem window.open, sem fechar PWA)
    const btnPdf = document.getElementById('btnExportData');
    if (btnPdf) {
      btnPdf.addEventListener('click', () => this.exportPDF());
    }

    // 2. Exportar JSON Backup
    const btnJson = document.getElementById('btnExportJSON');
    if (btnJson) {
      btnJson.addEventListener('click', () => this.exportJSON());
    }

    // 3. Importar Dados (PDF ou JSON)
    const btnImport = document.getElementById('btnImportData');
    const inputImport = document.getElementById('importFileInput');
    if (btnImport && inputImport) {
      btnImport.addEventListener('click', () => inputImport.click());
      inputImport.addEventListener('change', (e) => this.handleImportFile(e));
    }

    // 4. Exemplo e Apagar Dados
    const btnDemo = document.getElementById('btnLoadDemo');
    if (btnDemo) {
      btnDemo.addEventListener('click', async () => {
        const ok = await UI.confirm({ title: 'Carregar Dados Demo', message: 'Isso substituirá TODOS os dados atuais pelos dados de demonstração. Deseja continuar?', confirmText: 'Carregar', variant: 'danger' });
        if (!ok) return;
        State.loadDemo(true);
        const tab = document.querySelector('.nav-link.active')?.dataset.tab;
        if (tab === 'dashboard') Dashboard.update();
        else if (tab === 'orders') Orders.render();
        else if (tab === 'clients') Clients.render();
        UI.toast('Dados de demonstração carregados');
      });
    }

    const btnClear = document.getElementById('btnClearAllData');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
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
    }

    // 5. Adicionar Sabor ao Catálogo
    const btnAddCat = document.getElementById('btnAddCatalogItem');
    if (btnAddCat) {
      btnAddCat.addEventListener('click', () => {
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
    }

    // 6. CSV export
    const btnCsv = document.getElementById('btnExportCSV');
    if (btnCsv) {
      btnCsv.addEventListener('click', () => {
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
    }

    // Segurança
    if (Auth.renderSecuritySettings) Auth.renderSecuritySettings();

    // Notificações
    this.renderNotificationStatus();
    Notifications.init();

    const btnToggleNotif = document.getElementById('btnToggleNotifications');
    if (btnToggleNotif) {
      btnToggleNotif.addEventListener('click', async () => {
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
            UI.toast('Notificações ativadas com sucesso!');
          } else {
            UI.alert('Não foi possível ativar as notificações. Verifique a permissão no navegador.');
          }
        }
      });
    }

    // Configurações avançadas de notificações
    this.setupNotificationCustomControls();
  },

  exportPDF() {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const dataJson = JSON.stringify(State.orders.map(o => ({
      clientName: o.clientName, clientPhone: o.clientPhone, productType: o.productType,
      flavor: o.flavor, weight: o.weight, unitPrice: o.unitPrice, extraCharges: o.extraCharges || 0,
      cost: o.cost || 0, deliveryDate: o.deliveryDate, deliveryTime: o.deliveryTime,
      status: o.status, totalValue: o.totalValue, paymentMethod: o.paymentMethod || 'Dinheiro',
      notes: o.notes || '', details: o.details || ''
    })));

    const linhas = State.orders.map(o =>
      `<tr>
        <td><strong>${escapeHTML(o.clientName)}</strong><br><small>${escapeHTML(o.clientPhone || '')}</small></td>
        <td>${escapeHTML(o.flavor)}<br><small>${escapeHTML(o.productType)}</small></td>
        <td>${fmtDateStr(o.deliveryDate)} ${o.deliveryTime || ''}</td>
        <td style="text-align:right">${o.weight}${o.productType === 'Bolo de Kg' ? ' Kg' : ' un'}</td>
        <td style="text-align:right;font-weight:bold;">${fmt(o.totalValue)}</td>
        <td style="text-align:center">${o.status}</td>
      </tr>`
    ).join('');

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatorio Confeitex - ${hoje}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#222;padding:1.5rem;background:#fff;margin:0}
  h1{font-size:1.4rem;margin-bottom:0.25rem;color:#111}
  p{color:#666;font-size:0.85rem;margin-bottom:1.2rem}
  table{width:100%;border-collapse:collapse;font-size:0.8rem;margin-top:0.5rem}
  th,td{padding:0.5rem;border:1px solid #ddd;text-align:left}
  th{background:#f5f5f5;font-weight:700}
  small{color:#666;font-size:0.7rem}
  .data-footnote{font-size:6px;color:#eee;margin-top:2rem;word-break:break-all}
  @media print{body{padding:0}th{background:#eee!important}}
</style></head><body>
<h1>🎂 Confeitex — Relatório de Encomendas</h1>
<p>Gerado em ${hoje} — Total de ${State.orders.length} pedido(s) cadastrado(s)</p>
<table><thead><tr>
<th>Cliente</th><th>Produto / Sabor</th><th>Data Entrega</th><th>Peso/Qtd</th><th>Valor Total</th><th>Status</th>
</tr></thead><tbody>${linhas}</tbody></table>
<div class="data-footnote">CONFEITEX:DATA:${dataJson}:DATA:CONFEITEX</div>
</body></html>`;

    let iframe = document.getElementById('confeitexPrintIframe');
    if (iframe) iframe.remove();
    iframe = document.createElement('iframe');
    iframe.id = 'confeitexPrintIframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        UI.toast('Relatório pronto para salvar como PDF');
      } catch (e) {
        console.warn('[PDF Print Error]:', e);
        UI.alert('Não foi possível iniciar a impressão. Verifique se o navegador bloqueou a ação.');
      }
    }, 400);
  },

  exportJSON() {
    const backupData = {
      app: 'Confeitex',
      version: '1.15.0',
      exportDate: new Date().toISOString(),
      orders: State.orders,
      catalog: State.catalog
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `confeitex_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    UI.toast('Backup JSON exportado com sucesso!');
  },

  async handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        await this.importJSONFile(file);
      } else {
        await this.importPDFFile(file);
      }
    } catch (err) {
      console.error('[Import Error]:', err);
      UI.alert('Não foi possível importar o arquivo. Verifique se é um backup JSON ou PDF válido do Confeitex.');
    }
    e.target.value = '';
  },

  async importJSONFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);

    let newOrders = [];
    let newCatalog = [];

    if (Array.isArray(parsed)) {
      newOrders = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.orders)) newOrders = parsed.orders;
      if (Array.isArray(parsed.catalog)) newCatalog = parsed.catalog;
    }

    if (newOrders.length === 0 && newCatalog.length === 0) {
      throw new Error('Nenhum dado encontrado no arquivo JSON');
    }

    const confirmMsg = `Foram encontrados:\n• ${newOrders.length} pedido(s)\n• ${newCatalog.length} sabor(es) no catálogo.\n\nDeseja importar e atualizar seus dados atuais?`;
    const ok = await UI.confirm({
      title: 'Importar Backup JSON',
      message: confirmMsg,
      confirmText: 'Importar',
      variant: 'primary'
    });
    if (!ok) return;

    if (newOrders.length > 0) {
      State.orders = newOrders.map(migrateOrder);
      State.saveOrders();
    }
    if (newCatalog.length > 0) {
      State.catalog = newCatalog;
      State.saveCatalog();
    }

    UI.toast('Dados importados do arquivo JSON com sucesso!');
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'dashboard') Dashboard.update();
    else if (tab === 'orders') Orders.render();
    else if (tab === 'clients') Clients.render();
    else if (tab === 'settings') this.renderCatalog();
  },

  async importPDFFile(file) {
    if (!window.pdfjsLib) {
      UI.alert('O leitor de PDF não pôde ser carregado. Recomendamos usar o backup em formato .json!');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const allItems = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.map(item => item.str);
      fullText += items.join(' ') + '\n';
      allItems.push(...items);
    }

    let orders = [];

    let dataJson = null;
    for (let idx = 0; idx < allItems.length; idx++) {
      const item = allItems[idx];
      const marker = 'CONFEITEX:DATA:';
      const startPos = item.indexOf(marker);
      if (startPos === -1) continue;

      const parts = [item.substring(startPos + marker.length)];
      for (let k = idx + 1; k < allItems.length; k++) {
        const endMarker = ':DATA:CONFEITEX';
        const endPos = allItems[k].indexOf(endMarker);
        if (endPos !== -1) {
          parts.push(allItems[k].substring(0, endPos));
          break;
        }
        parts.push(allItems[k]);
      }
      dataJson = parts.join('');
      break;
    }
    if (dataJson) {
      try {
        const parsed = JSON.parse(dataJson);
        orders = parsed.map(o => ({
          ...o,
          id: 'o_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          createdAt: new Date().toISOString(),
          deliveredAt: o.status === 'Entregue' ? new Date().toISOString() : null
        }));
      } catch (e) { console.warn('[Confeitex] JSON data block parse error:', e); }
    }

    if (orders.length === 0) throw new Error('Nenhum pedido encontrado no PDF');

    const ok = await UI.confirm({
      title: 'Importar Dados do PDF',
      message: `Foram encontrados ${orders.length} pedido(s) no PDF. Deseja importá-los? (Os dados atuais serão substituídos.)`,
      confirmText: 'Importar',
      variant: 'danger'
    });
    if (!ok) return;

    State.orders = orders.map(migrateOrder);
    State.saveOrders();
    UI.toast(`${orders.length} pedido(s) importados do PDF com sucesso!`);
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'dashboard') Dashboard.update();
    else if (tab === 'orders') Orders.render();
    else if (tab === 'clients') Clients.render();
    else if (tab === 'settings') this.renderCatalog();
  },

  setupNotificationCustomControls() {
    const btnTest = document.getElementById('btnTestNotification');
    if (btnTest) {
      btnTest.addEventListener('click', () => Notifications.sendTestNotification());
    }

    // Carrega valores atuais nas opções
    const settings = Notifications.getSettings();

    // Checkboxes de Antecedência
    document.querySelectorAll('.notif-day-cb').forEach(cb => {
      const val = parseInt(cb.dataset.day, 10);
      cb.checked = (settings.daysBefore || [0, 1]).includes(val);
      cb.addEventListener('change', () => this.saveNotificationCustomControls());
    });

    // Frequência
    const selInterval = document.getElementById('notifIntervalSelect');
    if (selInterval) {
      selInterval.value = String(settings.intervalHours || 1);
      selInterval.addEventListener('change', () => this.saveNotificationCustomControls());
    }

    // Statuses
    document.querySelectorAll('.notif-status-cb').forEach(cb => {
      const st = cb.dataset.status;
      cb.checked = (settings.statuses || ['Pendente', 'Em Produção']).includes(st);
      cb.addEventListener('change', () => this.saveNotificationCustomControls());
    });

    // Saldo pendente
    const cbPendingPay = document.getElementById('notifPendingPayCb');
    if (cbPendingPay) {
      cbPendingPay.checked = settings.alertPendingPayment !== false;
      cbPendingPay.addEventListener('change', () => this.saveNotificationCustomControls());
    }
  },

  saveNotificationCustomControls() {
    const daysBefore = [];
    document.querySelectorAll('.notif-day-cb:checked').forEach(cb => {
      daysBefore.push(parseInt(cb.dataset.day, 10));
    });

    const intervalHours = parseInt(document.getElementById('notifIntervalSelect')?.value || '1', 10);

    const statuses = [];
    document.querySelectorAll('.notif-status-cb:checked').forEach(cb => {
      statuses.push(cb.dataset.status);
    });

    const alertPendingPayment = !!document.getElementById('notifPendingPayCb')?.checked;

    Notifications.saveSettings({
      daysBefore: daysBefore.length > 0 ? daysBefore : [0],
      intervalHours,
      statuses: statuses.length > 0 ? statuses : ['Pendente'],
      alertPendingPayment
    });

    UI.toast('Preferências de notificação salvas!');
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
      info.textContent = 'Você receberá lembretes conforme suas preferências configuradas abaixo.';
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

