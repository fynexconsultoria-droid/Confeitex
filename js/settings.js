const Settings = {
  renderCatalog() {
    const container = document.getElementById('catalogListContainer');
    if (!container) return;
    container.innerHTML = State.catalog.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.03);gap:0.5rem;">
        <div style="flex:1;">
          <span style="font-weight:600;font-size:0.9rem;color:white;">${escapeHTML(item.flavor)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);display:block;">${escapeHTML(I18n.value('product', item.type))}</span>
        </div>
        <div style="font-weight:700;color:var(--color-accent-pink);font-size:0.9rem;margin-right:0.5rem;">${I18n.currencySymbol()} ${item.pricePerKg.toFixed(2)}${item.type === 'Bolo de Kg' ? '/Kg' : '/un'}</div>
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
      btnPdf.addEventListener('click', () => {
        if (typeof Plan !== 'undefined' && !Plan.canUse('export')) {
          Plan.showPaywall('Exportação de dados (PDF)');
          return;
        }
        this.exportBackupPDF();
      });
    }

    // 2. Exportar JSON Backup
    const btnJson = document.getElementById('btnExportJSON');
    if (btnJson) {
      btnJson.addEventListener('click', () => {
        if (typeof Plan !== 'undefined' && !Plan.canUse('export')) {
          Plan.showPaywall('Exportação de backup (JSON)');
          return;
        }
        this.exportJSON();
      });
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
        const ok = await UI.confirm({ title: I18n.t('settings.confirmDemoTitle'), message: I18n.t('settings.confirmDemo'), confirmText: I18n.t('settings.demoBtn'), variant: 'danger' });
        if (!ok) return;
        State.loadDemo(true);
        State.emptyTrash();
        if (Trash.updateBadge) Trash.updateBadge();
        const tab = document.querySelector('.nav-link.active')?.dataset.tab;
        if (tab === 'dashboard') Dashboard.update();
        else if (tab === 'orders') Orders.render();
        else if (tab === 'clients') Clients.render();
        UI.toast(I18n.t('settings.toastDemo'));
      });
    }

    const btnClear = document.getElementById('btnClearAllData');
    if (btnClear) {
      btnClear.addEventListener('click', async () => {
        const ok = await UI.confirm({ title: I18n.t('settings.confirmClearTitle'), message: I18n.t('settings.confirmClear'), confirmText: I18n.t('settings.clearBtn'), variant: 'danger' });
        if (!ok) return;
        State.orders = [];
        State.catalog = [...DEFAULT_CATALOG];
        State.expenses = [];
        State.saveOrders();
        State.saveCatalog();
        State.saveExpenses();
        State.emptyTrash();
        if (Trash.updateBadge) Trash.updateBadge();
        safeStorage.remove('confeitex_notified');
        safeStorage.remove('confeitex_notifications_enabled');
        Notifications._disable();
        if (Auth.lockEnabled) {
          Auth.disable();
          safeStorage.remove('confeitex_lock_hash');
          Auth.lockHash = '';
          if (Auth.renderSecuritySettings) Auth.renderSecuritySettings();
          UI.toast(I18n.t('settings.toastDataCleared2'));
        } else {
          UI.toast(I18n.t('settings.toastDataCleared'));
        }
        this.renderCatalog();
        Dashboard.update();
      });
    }

    // 5. Adicionar Sabor ao Catálogo
    const btnAddCat = document.getElementById('btnAddCatalogItem');
    if (btnAddCat) {
      const priceInput = document.getElementById('newCatalogPrice');
      if (priceInput) {
        priceInput.placeholder = I18n.currencySymbol();
        priceInput.addEventListener('input', () => {
          const pos = priceInput.selectionStart;
          const old = priceInput.value;
          priceInput.value = old.replace(',', '.');
          if (priceInput.value !== old) priceInput.setSelectionRange(pos, pos);
        });
      }
      btnAddCat.addEventListener('click', () => {
        const flavor = document.getElementById('newCatalogFlavor').value.trim();
        const price = parseFloat(document.getElementById('newCatalogPrice').value.replace(',', '.')) || 0;
        const type = document.getElementById('newCatalogType').value;

        if (!flavor || price <= 0) {
          UI.alert(I18n.t('settings.alertCat'));
          return;
        }

        State.catalog.push({ id: 'cat_' + Date.now(), flavor, pricePerKg: price, type });
        State.saveCatalog();
        document.getElementById('newCatalogFlavor').value = '';
        document.getElementById('newCatalogPrice').value = '';
        this.renderCatalog();
        UI.toast(I18n.t('settings.toastCatAdded'));
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
        link.download = `confeitex_relatorio_${fmtISO(new Date())}.csv`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        UI.toast(I18n.t('settings.toastCsv'));
      });
    }

    // Segurança
    if (Auth.renderSecuritySettings) Auth.renderSecuritySettings();

    // Notificações
    Notifications.init();
    this.renderNotificationStatus();

    // Mercado Pago — Configuração do Worker URL
    this.setupMercadoPagoConfig();

    const btnToggleNotif = document.getElementById('btnToggleNotifications');
    if (btnToggleNotif) {
      btnToggleNotif.addEventListener('click', async () => {
        if (Notifications.status === 'unsupported') {
          UI.alert(I18n.t('notif.settings.alertUnsupported'));
          return;
        }
        if (Notifications.status === 'denied') {
          UI.alert(I18n.t('notif.settings.alertDenied'));
          return;
        }
        if (Notifications.enabled) {
          Notifications.disable();
          this.renderNotificationStatus();
          UI.toast(I18n.t('notif.settings.toastDisabled'));
        } else {
          const ok = await Notifications.enable();
          this.renderNotificationStatus();
          if (ok) {
            UI.toast(I18n.t('notif.settings.toastEnabled'));
          } else {
            UI.alert(I18n.t('notif.settings.alertEnableFail'));
          }
        }
      });
    }

    // Configurações avançadas de notificações
    this.setupNotificationCustomControls();
  },

  exportBackupPDF() {
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
        <td>${escapeHTML(o.flavor)}<br><small>${escapeHTML(I18n.value('product', o.productType))}</small></td>
        <td>${fmtDateStr(o.deliveryDate)} ${o.deliveryTime || ''}</td>
        <td style="text-align:right">${o.weight}${o.productType === 'Bolo de Kg' ? ' Kg' : ' un'}</td>
        <td style="text-align:right;font-weight:bold;">${fmt(o.totalValue)}</td>
        <td style="text-align:center">${escapeHTML(I18n.value('status', o.status))}</td>
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
<h1>${I18n.t('settings.pdfTitle')}</h1>
<p>${I18n.t('finance.pdfGenerated', { date: hoje })} — ${I18n.t('settings.pdfCount', { count: State.orders.length })}</p>
<table><thead><tr>
<th>${I18n.t('finance.pdfClient')}</th><th>${I18n.t('finance.pdfProduct')}</th><th>${I18n.t('finance.pdfDelivery')}</th><th>${I18n.t('settings.pdfWeight')}</th><th>${I18n.t('finance.pdfValue')}</th><th>${I18n.t('finance.pdfStatus')}</th>
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
        UI.toast(I18n.t('finance.toastPdf'));
      } catch (e) {
        console.warn('[PDF Print Error]:', e);
        UI.alert(I18n.t('settings.alertNoPdf'));
      }
    }, 400);
  },

  exportJSON() {
    const backupData = {
      app: 'Confeitex',
      version: Updates.verAtual,
      exportDate: new Date().toISOString(),
      orders: State.orders,
      catalog: State.catalog,
      expenses: State.expenses
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `confeitex_backup_${fmtISO(new Date())}.json`;
    link.click();
    URL.revokeObjectURL(url);
    UI.toast(I18n.t('settings.toastJson'));
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
      UI.alert(I18n.t('settings.alertImport'));
    }
    e.target.value = '';
  },

  async importJSONFile(file) {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const validated = validateStateDump(parsed);

    let newOrders = [];
    let newCatalog = [];
    let newExpenses = [];

    if (Array.isArray(parsed)) {
      newOrders = validated.orders;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.orders)) newOrders = validated.orders;
      if (Array.isArray(parsed.catalog)) newCatalog = validated.catalog;
      if (Array.isArray(parsed.expenses)) newExpenses = validated.expenses;
    }

    if (newOrders.length === 0 && newCatalog.length === 0 && newExpenses.length === 0) {
      throw new Error('Nenhum dado encontrado no arquivo JSON');
    }

    const confirmMsg = I18n.t('settings.confirmImportJson', { orders: newOrders.length, catalog: newCatalog.length, expenses: newExpenses.length });
    const ok = await UI.confirm({
      title: I18n.t('settings.importJsonTitle'),
      message: confirmMsg,
      confirmText: I18n.t('settings.importBtn'),
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
    if (newExpenses.length > 0) {
      State.expenses = newExpenses;
      State.saveExpenses();
    }

    UI.toast(I18n.t('settings.toastImported'));
    const tab = document.querySelector('.nav-link.active')?.dataset.tab;
    if (tab === 'dashboard') Dashboard.update();
    else if (tab === 'orders') Orders.render();
    else if (tab === 'clients') Clients.render();
    else if (tab === 'settings') this.renderCatalog();
  },

  // Carrega pdf.js sob demanda (embutido localmente para funcionar 100% offline)
  _ensurePdfJs() {
    if (window.pdfjsLib) return Promise.resolve(true);
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = () => {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
          resolve(true);
        } catch (e) {
          resolve(false);
        }
      };
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  },

  async importPDFFile(file) {
    const loaded = await this._ensurePdfJs();
    if (!window.pdfjsLib || !loaded) {
      UI.alert(I18n.t('settings.alertNoPdf'));
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
      title: I18n.t('settings.importPdfTitle'),
      message: I18n.t('settings.confirmImportPdf', { count: orders.length }),
      confirmText: I18n.t('settings.importBtn'),
      variant: 'danger'
    });
    if (!ok) return;

    State.orders = orders.map(migrateOrder);
    State.saveOrders();
    UI.toast(I18n.t('settings.toastPdfImported', { count: orders.length }));
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

    // Hora do lembrete agendado (segundo plano)
    const inpReminderTime = document.getElementById('notifReminderTime');
    if (inpReminderTime) {
      inpReminderTime.value = settings.reminderTime || '08:00';
      inpReminderTime.addEventListener('change', () => this.saveNotificationCustomControls());
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

    // Pedidos atrasados
    const cbOverdue = document.getElementById('notifOverdueCb');
    if (cbOverdue) {
      cbOverdue.checked = settings.overdueAlerts !== false;
      cbOverdue.addEventListener('change', () => this.saveNotificationCustomControls());
    }

    // Horário de silêncio
    const cbQuiet = document.getElementById('notifQuietCb');
    const quietFields = document.getElementById('notifQuietFields');
    if (cbQuiet) {
      cbQuiet.checked = !!settings.quietHoursEnabled;
      const syncQuietFields = () => {
        if (quietFields) quietFields.style.display = cbQuiet.checked ? 'flex' : 'none';
      };
      syncQuietFields();
      cbQuiet.addEventListener('change', () => {
        syncQuietFields();
        this.saveNotificationCustomControls();
      });
    }
    const inpQuietStart = document.getElementById('notifQuietStart');
    if (inpQuietStart) {
      inpQuietStart.value = settings.quietHoursStart || '22:00';
      inpQuietStart.addEventListener('change', () => this.saveNotificationCustomControls());
    }
    const inpQuietEnd = document.getElementById('notifQuietEnd');
    if (inpQuietEnd) {
      inpQuietEnd.value = settings.quietHoursEnd || '07:00';
      inpQuietEnd.addEventListener('change', () => this.saveNotificationCustomControls());
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

    const reminderTime = document.getElementById('notifReminderTime')?.value || '08:00';

    const overdueAlerts = !!document.getElementById('notifOverdueCb')?.checked;

    const quietHoursEnabled = !!document.getElementById('notifQuietCb')?.checked;
    const quietHoursStart = document.getElementById('notifQuietStart')?.value || '22:00';
    const quietHoursEnd = document.getElementById('notifQuietEnd')?.value || '07:00';

    Notifications.saveSettings({
      daysBefore: daysBefore.length > 0 ? daysBefore : [0],
      intervalHours,
      statuses: statuses.length > 0 ? statuses : ['Pendente'],
      alertPendingPayment,
      reminderTime,
      overdueAlerts,
      quietHoursEnabled,
      quietHoursStart,
      quietHoursEnd
    });

    UI.toast(I18n.t('notif.settings.toastSaved'));
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
      text.textContent = I18n.t('notif.settings.unsupported');
      text.style.color = 'var(--color-danger)';
      info.textContent = I18n.t('notif.settings.unsupportedInfo');
      btnText.textContent = I18n.t('notif.settings.unsupportedBtn');
      btn.disabled = true;
      return;
    }

    if (Notifications.status === 'denied') {
      dot.style.background = 'var(--color-danger)';
      text.textContent = I18n.t('notif.settings.denied');
      text.style.color = 'var(--color-danger)';
      info.textContent = I18n.t('notif.settings.deniedInfo');
      btnText.textContent = I18n.t('notif.settings.deniedBtn');
      btn.disabled = false;
      btn.className = 'btn btn-secondary';
      return;
    }

    if (Notifications.enabled) {
      dot.style.background = 'var(--color-success)';
      text.textContent = I18n.t('notif.settings.active');
      text.style.color = 'var(--color-success)';
      const mode = Notifications.backgroundMode;
      if (mode === 'triggers') {
        info.textContent = I18n.t('notif.settings.activeTriggers');
      } else if (mode === 'periodic') {
        info.textContent = I18n.t('notif.settings.activePeriodic');
      } else {
        info.textContent = I18n.t('notif.settings.activeOpen');
      }
      btnText.textContent = I18n.t('notif.settings.disableBtn');
      btn.className = 'btn btn-secondary';
    } else {
      dot.style.background = 'var(--text-muted)';
      text.textContent = I18n.t('notif.settings.inactive');
      text.style.color = 'var(--text-muted)';
      info.textContent = I18n.t('notif.settings.inactiveInfo');
      btnText.textContent = I18n.t('notif.settings.enableBtn');
      btn.className = 'btn btn-primary';
    }
  },

  // ─── Mercado Pago: Configuração do Worker URL ──────────────────────
  setupMercadoPagoConfig() {
    const input = document.getElementById('mpWorkerUrl');
    const btn = document.getElementById('btnSaveMpWorker');
    const display = document.getElementById('mpWorkerUrlDisplay');
    if (!input || !btn || !display) return;

    // Carrega URL salva
    const saved = localStorage.getItem('confeitex_mp_worker_url') || '';
    if (saved) {
      input.value = saved;
      display.textContent = saved;
      display.style.display = 'block';
    } else {
      display.style.display = 'none';
    }

    btn.addEventListener('click', () => {
      const url = input.value.trim().replace(/\/+$/, '');
      if (!url) {
        UI.alert(I18n.t('mp.alertNoWorker'));
        return;
      }
      localStorage.setItem('confeitex_mp_worker_url', url);
      if (typeof MercadoPagoCheckout !== 'undefined') {
        MercadoPagoCheckout.setWorkerUrl(url);
      }
      display.textContent = url;
      display.style.display = 'block';
      UI.toast(I18n.t('mp.toastConfigured'));
    });
  }
};

