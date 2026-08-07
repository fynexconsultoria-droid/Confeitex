const Finance = {
  _range: { from: null, to: null },

  render() {
    this._updateAll();
  },

  _setRange(range) {
    this._range = { from: range.from || null, to: range.to || null };
  },

  _syncChips(preset) {
    document.querySelectorAll('.finance-chip').forEach(c => c.classList.toggle('active', c.dataset.preset === preset));
    const customWrap = document.getElementById('financePeriodCustom');
    if (customWrap) customWrap.style.display = preset === 'custom' ? 'flex' : 'none';
  },

  _applyPreset(preset) {
    this._setRange(_presetRange(preset));
    this._syncChips(preset);
  },

  _updateAll() {
    const orders = this._getFilteredOrders();
    const active = orders.filter(o => o.status !== 'Cancelado');
    const canceled = orders.filter(o => o.status === 'Cancelado');

    const expenses = this._getFilteredExpenses();
    const expensesTotal = expenses.reduce((s, e) => s + (+e.amount || 0), 0);

    const sales = active.reduce((s, o) => s + getOrderTotal(o), 0);
    const cost = orders.reduce((s, o) => s + (o.cost || 0), 0) + expensesTotal;
    const profit = sales - cost;

    document.getElementById('finKpiSalesMonth').textContent = fmt(sales);
    document.getElementById('finKpiCostMonth').textContent = fmt(cost);
    document.getElementById('finKpiProfitMonth').textContent = fmt(profit);
    document.getElementById('finKpiOrdersMonth').textContent = orders.length;

    const { from, to } = this._range;
    const singleDay = !!from && from === to;
    const setMetricFooter = (n, text) => {
      const el = document.querySelector(`#finances .metric-card:nth-child(${n}) .metric-footer`);
      if (el) el.textContent = text;
    };
    setMetricFooter(1, singleDay ? I18n.t('finance.footerRevenueDay') : I18n.t('finance.footerRevenue'));
    setMetricFooter(2, singleDay ? I18n.t('finance.footerCostDay') : I18n.t('finance.footerCost'));
    setMetricFooter(4, singleDay ? I18n.t('finance.footerOrdersDay') : I18n.t('finance.footerOrders'));

    const allActive = State.orders.filter(o => o.status !== 'Cancelado');
    const allCanceled = State.orders.filter(o => o.status === 'Cancelado');
    const totalRev = allActive.reduce((s, o) => s + getOrderTotal(o), 0);
    const totalCost = State.orders.reduce((s, o) => s + (o.cost || 0), 0) + State.expenses.reduce((s, e) => s + (+e.amount || 0), 0);
    const totalProfit = totalRev - totalCost;

    this._renderExpenses(expenses, expensesTotal);
    const avgTicket = allActive.length > 0 ? totalRev / allActive.length : 0;

    document.getElementById('finGenOrders').textContent = allActive.length;
    document.getElementById('finGenRevenue').textContent = fmt(totalRev);
    document.getElementById('finGenCost').textContent = fmt(totalCost);
    document.getElementById('finGenProfit').textContent = fmt(totalProfit);
    document.getElementById('finGenAvgTicket').textContent = fmt(avgTicket);
    document.getElementById('finGenCanceled').textContent = allCanceled.length;

    this._drawPieChart('finPieProductChart', 'finPieProductLegend', orders, 'productType', [
      'Bolo de Kg', 'Bolo Unitário', 'Doces / Brigadeiros', 'Salgados', 'Outros'
    ], ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']);

    this._drawPieChart('finPiePaymentChart', 'finPiePaymentLegend', orders, 'paymentMethod', [], null);

    this._drawPieChart('finPieStatusChart', 'finPieStatusLegend', orders, 'status', [
      'Pendente', 'Em Produção', 'Entregue', 'Cancelado'
    ], ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']);
  },

  _drawPieChart(canvasId, legendId, orders, field, orderedLabels, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const groups = {};
    orders.forEach(o => {
      const key = o[field] || I18n.value('product', 'Outros');
      groups[key] = (groups[key] || 0) + 1;
    });

    const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (entries.length === 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '13px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(I18n.t('finance.noData'), w / 2, h / 2);
      const legendEl = document.getElementById(legendId);
      if (legendEl) legendEl.innerHTML = '';
      return;
    }

    const total = entries.reduce((s, e) => s + e[1], 0);
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(cx, cy) - 10;
    const innerRadius = radius * 0.55;

    const defaultColors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#84cc16'];
    let colorIdx = 0;
    const colorMap = {};

    const getColor = (key) => {
      if (colors && orderedLabels) {
        const idx = orderedLabels.indexOf(key);
        if (idx !== -1 && colors[idx]) return colors[idx];
      }
      if (!colorMap[key]) {
        colorMap[key] = defaultColors[colorIdx % defaultColors.length];
        colorIdx++;
      }
      return colorMap[key];
    };

    let startAngle = -Math.PI / 2;
    entries.forEach(([key, val]) => {
      const sliceAngle = (val / total) * Math.PI * 2;
      const color = getColor(key);

      ctx.beginPath();
      ctx.moveTo(cx + innerRadius * Math.cos(startAngle), cy + innerRadius * Math.sin(startAngle));
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.lineTo(cx + innerRadius * Math.cos(startAngle + sliceAngle), cy + innerRadius * Math.sin(startAngle + sliceAngle));
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();

      if (val / total > 0.05) {
        const midAngle = startAngle + sliceAngle / 2;
        const labelR = (radius + innerRadius) / 2;
        const lx = cx + labelR * Math.cos(midAngle);
        const ly = cy + labelR * Math.sin(midAngle);

        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(val / total * 100) + '%', lx, ly);
        ctx.restore();
      }

      startAngle += sliceAngle;
    });

    const legendEl = document.getElementById(legendId);
    if (legendEl) {
      const labelFor = (key) => {
        if (field === 'productType') return I18n.value('product', key);
        if (field === 'status') return I18n.value('status', key);
        if (field === 'paymentMethod') return I18n.value('payment', key);
        return key;
      };
      legendEl.innerHTML = entries.map(([key, val]) => {
        const pct = Math.round(val / total * 100);
        return `<div class="finance-legend-item">
          <span class="finance-legend-dot" style="background:${getColor(key)}"></span>
          <span class="finance-legend-label">${escapeHTML(labelFor(key))}</span>
          <span class="finance-legend-value">${val} (${pct}%)</span>
        </div>`;
      }).join('');
    }
  },

  _getFilteredOrders() {
    const { from, to } = this._range;
    return State.orders.filter(o => {
      if (!o.deliveryDate) return false;
      if (from && o.deliveryDate < from) return false;
      if (to && o.deliveryDate > to) return false;
      return true;
    });
  },

  _getFilteredExpenses() {
    const { from, to } = this._range;
    return State.expenses
      .filter(e => {
        if (!e.date) return false;
        if (from && e.date < from) return false;
        if (to && e.date > to) return false;
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  },

  _renderExpenses(expenses, total) {
    const listEl = document.getElementById('expenseList');
    const badgeEl = document.getElementById('expenseTotalBadge');
    if (!listEl) return;

    if (badgeEl) badgeEl.textContent = fmt(total);

    if (expenses.length === 0) {
      listEl.innerHTML = `<div class="empty-state" style="padding:1.2rem 0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        <h3>${I18n.t('finance.expListEmpty')}</h3>
        <p style="font-size:0.8rem;">${I18n.t('finance.expEmptySub')}</p>
      </div>`;
      return;
    }

    listEl.innerHTML = expenses.map(e => `
      <div class="expense-item">
        <div style="flex:1;min-width:0;">
          <span class="expense-item-desc">${escapeHTML(e.description || I18n.t('finance.expFallback'))}</span>
          <span class="expense-item-date">📅 ${fmtDateStr(e.date)}</span>
        </div>
        <span class="expense-item-value">${fmt(e.amount)}</span>
        <button class="btn btn-secondary btn-icon-only btn-del-expense" data-id="${escapeHTML(e.id)}" title="${I18n.t('common.delete')}" style="padding:0.3rem;color:var(--color-danger);border-color:rgba(239,68,68,0.2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
        </button>
      </div>
    `).join('');
  },

  _addExpense(description, amount, date) {
    const parsedAmount = parseFloat(String(amount).replace(',', '.'));
    if (!description.trim() || !parsedAmount || parsedAmount <= 0 || !date) {
      UI.alert(I18n.t('finance.alertExpense'));
      return false;
    }
    State.expenses.push({
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      description: description.trim(),
      amount: +parsedAmount.toFixed(2),
      date
    });
    State.saveExpenses();
    UI.toast(I18n.t('finance.toastExpAdded'));
    return true;
  },

  _deleteExpense(id) {
    State.expenses = State.expenses.filter(e => e.id !== id);
    State.saveExpenses();
    UI.toast(I18n.t('finance.toastExpDeleted'));
    this._updateAll();
  },

  _periodLabel() {
    const { from, to } = this._range;
    if (from && to) {
      if (from === to) return I18n.t('finance.periodDay', { date: fmtDateStr(from) });
      return I18n.t('finance.periodRange', { from: fmtDateStr(from), to: fmtDateStr(to) });
    }
    return I18n.t('finance.periodAll');
  },

  _captureChart(canvasId, legendId, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return '';
    let img = '';
    try {
      img = `<img src="${canvas.toDataURL('image/png')}" alt="${title}" style="width:100%;max-width:360px;display:block;margin:0 auto;" />`;
    } catch (e) {
      console.warn('[PDF Chart Capture]:', e);
      return '';
    }
    const legendEl = document.getElementById(legendId);
    const legend = legendEl ? legendEl.innerHTML : '';
    return `<div class="chart-block">
      <h3>${escapeHTML(title)}</h3>
      ${img}
      <div class="legend-wrap">${legend}</div>
    </div>`;
  },

  exportPDF() {
    this._updateAll();

    const orders = this._getFilteredOrders();
    const active = orders.filter(o => o.status !== 'Cancelado');
    const canceled = orders.filter(o => o.status === 'Cancelado');

    const sales = active.reduce((s, o) => s + getOrderTotal(o), 0);
    const expenses = this._getFilteredExpenses();
    const expensesTotal = expenses.reduce((s, e) => s + (+e.amount || 0), 0);
    const orderCost = orders.reduce((s, o) => s + (o.cost || 0), 0);
    const cost = orderCost + expensesTotal;
    const profit = sales - cost;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    const avgTicket = active.length > 0 ? sales / active.length : 0;

    const hoje = new Date().toLocaleDateString(I18n.locales[I18n.lang] || 'pt-BR');

    const linhas = orders.length > 0 ? orders.map(o =>
      `<tr>
        <td><strong>${escapeHTML(o.clientName)}</strong>${o.clientPhone ? `<br><small>${escapeHTML(o.clientPhone)}</small>` : ''}</td>
        <td>${escapeHTML(o.flavor || '')}${o.productType ? `<br><small>${escapeHTML(I18n.value('product', o.productType))}</small>` : ''}</td>
        <td>${fmtDateStr(o.deliveryDate)}${o.deliveryTime ? ' ' + escapeHTML(o.deliveryTime) : ''}</td>
        <td style="text-align:center">${escapeHTML(I18n.value('payment', o.paymentMethod))}</td>
        <td style="text-align:center">${escapeHTML(I18n.value('status', o.status))}</td>
        <td style="text-align:right;font-weight:bold;">${fmt(getOrderTotal(o))}</td>
      </tr>`
    ).join('') : `<tr><td colspan="6" style="text-align:center;color:#999;">${I18n.t('finance.pdfNoOrders')}</td></tr>`;

    const charts =
      this._captureChart('finPieProductChart', 'finPieProductLegend', I18n.t('finance.pdfTypeProduct')) +
      this._captureChart('finPiePaymentChart', 'finPiePaymentLegend', I18n.t('finance.pdfTypePayment')) +
      this._captureChart('finPieStatusChart', 'finPieStatusLegend', I18n.t('finance.pdfTypeStatus'));

    const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatório Financeiro Confeitex - ${hoje}</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;color:#222;padding:1.5rem;background:#fff;margin:0}
  h1{font-size:1.5rem;margin:0 0 0.2rem;color:#111}
  .subtitle{color:#666;font-size:0.85rem;margin-bottom:1.4rem}
  .period-tag{display:inline-block;background:#f3e8ff;color:#6d28d9;font-weight:700;font-size:0.8rem;padding:0.25rem 0.6rem;border-radius:999px;margin-left:0.4rem}
  .kpi-grid{display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.4rem}
  .kpi{flex:1;min-width:140px;border:1px solid #e5e7eb;border-radius:10px;padding:0.7rem 1rem}
  .kpi-label{font-size:0.7rem;color:#888;text-transform:uppercase;letter-spacing:0.04em;font-weight:600}
  .kpi-value{font-size:1.3rem;font-weight:800;margin-top:0.15rem}
  .kpi-value.pink{color:#ec4899}.kpi-value.blue{color:#3b82f6}.kpi-value.green{color:#10b981}.kpi-value.purple{color:#8b5cf6}
  .section-title{font-size:1rem;font-weight:800;color:#111;margin:1.6rem 0 0.6rem;border-bottom:2px solid #f3f4f6;padding-bottom:0.4rem}
  .charts-grid{display:flex;flex-wrap:wrap;gap:1rem;margin-bottom:1rem}
  .chart-block{flex:1;min-width:240px;border:1px solid #e5e7eb;border-radius:10px;padding:0.9rem;text-align:center}
  .chart-block h3{font-size:0.85rem;font-weight:700;color:#333;margin:0 0 0.6rem;text-align:center}
  .legend-wrap{margin-top:0.6rem;text-align:left;display:inline-block}
  .finance-legend-item{display:flex;align-items:center;gap:0.5rem;font-size:0.72rem;color:#666;margin-bottom:0.25rem}
  .finance-legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
  .finance-legend-label{flex:1;font-weight:600;color:#222}
  .finance-legend-value{font-weight:600;color:#999;font-size:0.68rem}
  table{width:100%;border-collapse:collapse;font-size:0.75rem;margin-top:0.5rem}
  th,td{padding:0.45rem;border:1px solid #ddd;text-align:left}
  th{background:#f5f5f5;font-weight:700}
  small{color:#666;font-size:0.68rem}
  .result-table{width:auto;min-width:320px;margin-top:0.5rem}
  .result-table td{padding:0.5rem 0.9rem}
  .result-total td{font-weight:800;font-size:0.85rem}
  .result-bruto td{font-weight:700;color:#ec4899}
  .result-liquido td{font-weight:800;color:#10b981}
  .muted{color:#999}
  @media print{body{padding:0}th{background:#eee!important}}
</style></head><body>
<h1>🎂 ${I18n.t('finance.pdfTitleReport')}</h1>
<p class="subtitle">${I18n.t('finance.pdfGenerated', { date: hoje })} <span class="period-tag">📅 ${escapeHTML(this._periodLabel())}</span></p>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">${I18n.t('finance.pdfRevenue')}</div><div class="kpi-value pink">${fmt(sales)}</div></div>
  <div class="kpi"><div class="kpi-label">${I18n.t('finance.pdfCost')}</div><div class="kpi-value blue">${fmt(cost)}</div></div>
  <div class="kpi"><div class="kpi-label">${I18n.t('finance.pdfProfit')}</div><div class="kpi-value green">${fmt(profit)}</div></div>
  <div class="kpi"><div class="kpi-label">${I18n.t('finance.pdfOrders')}</div><div class="kpi-value purple">${orders.length}</div></div>
</div>

<div class="section-title">📊 ${I18n.t('finance.pdfCharts')}</div>
<div class="charts-grid">
  ${charts || `<p class="muted">${I18n.t('finance.pdfNoCharts')}</p>`}
</div>

<div class="section-title">📋 ${I18n.t('finance.pdfOrdersList', { count: orders.length })}</div>
<table><thead><tr>
<th>${I18n.t('finance.pdfClient')}</th><th>${I18n.t('finance.pdfProduct')}</th><th>${I18n.t('finance.pdfDelivery')}</th><th>${I18n.t('finance.pdfPayment')}</th><th>${I18n.t('finance.pdfStatus')}</th><th style="text-align:right">${I18n.t('finance.pdfValue')}</th>
</tr></thead><tbody>${linhas}</tbody></table>

${expenses.length > 0 ? `
<div class="section-title">🧾 ${I18n.t('finance.pdfExpList', { count: expenses.length })}</div>
<table><thead><tr>
<th>${I18n.t('finance.pdfDesc')}</th><th>${I18n.t('finance.expDate')}</th><th style="text-align:right">${I18n.t('finance.pdfValue')}</th>
</tr></thead><tbody>${expenses.map(e => `
  <tr>
    <td>${escapeHTML(e.description || I18n.t('finance.expFallback'))}</td>
    <td>${fmtDateStr(e.date)}</td>
    <td style="text-align:right;font-weight:bold;">${fmt(e.amount)}</td>
  </tr>`).join('')}
</tbody></table>` : ''}

<div class="section-title">💰 ${I18n.t('finance.pdfResult')}</div>
<table class="result-table">
  <tr class="result-bruto"><td>${I18n.t('finance.pdfGross')}</td><td style="text-align:right">${fmt(sales)}</td></tr>
  <tr><td>${I18n.t('finance.pdfOrderCost')}</td><td style="text-align:right">${fmt(orderCost)}</td></tr>
  <tr><td>${I18n.t('finance.pdfExpCost')}</td><td style="text-align:right">${fmt(expensesTotal)}</td></tr>
  <tr><td>${I18n.t('finance.pdfTotalCost')}</td><td style="text-align:right">${fmt(cost)}</td></tr>
  <tr class="result-liquido"><td>${I18n.t('finance.pdfNet')}</td><td style="text-align:right">${fmt(profit)}</td></tr>
  <tr><td>${I18n.t('finance.pdfMargin')}</td><td style="text-align:right">${margin.toFixed(1).replace('.', ',')}%</td></tr>
  <tr><td>${I18n.t('finance.pdfAvgTicket')}</td><td style="text-align:right">${fmt(avgTicket)}</td></tr>
  <tr class="result-total"><td>${I18n.t('finance.pdfActiveCanceled')}</td><td style="text-align:right">${active.length} / ${canceled.length}</td></tr>
</table>
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

  setup() {
    const chipsWrap = document.getElementById('financePeriodChips');
    const customWrap = document.getElementById('financePeriodCustom');
    const fromInput = document.getElementById('financeDateFrom');
    const toInput = document.getElementById('financeDateTo');

    const activateCustom = () => {
      this._syncChips('custom');
      if (customWrap) customWrap.style.display = 'flex';
    };

    chipsWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.finance-chip');
      if (!chip) return;
      const preset = chip.dataset.preset;

      if (preset === 'custom') {
        activateCustom();
        const now = new Date();
        if (!fromInput.value) fromInput.value = _fmtISO(now);
        if (!toInput.value) toInput.value = _fmtISO(now);
        this._setRange({ from: fromInput.value, to: toInput.value });
      } else {
        this._applyPreset(preset);
      }
      this._updateAll();
    });

    const onRangeChange = () => {
      if (!fromInput.value || !toInput.value) return;
      activateCustom();
      this._setRange({ from: fromInput.value, to: toInput.value });
      this._updateAll();
    };
    fromInput.addEventListener('change', onRangeChange);
    toInput.addEventListener('change', onRangeChange);

    const pdfBtn = document.getElementById('btnFinancePdf');
    if (pdfBtn) pdfBtn.addEventListener('click', () => this.exportPDF());

    // Custos de Matéria-Prima
    const btnAdd = document.getElementById('btnAddExpense');
    const dateInput = document.getElementById('expenseDate');
    if (dateInput && !dateInput.value) dateInput.value = _fmtISO(new Date());

    const expenseAmountEl = document.getElementById('expenseAmount');
    if (expenseAmountEl) {
      expenseAmountEl.addEventListener('input', () => {
        const pos = expenseAmountEl.selectionStart;
        const old = expenseAmountEl.value;
        expenseAmountEl.value = old.replace(',', '.');
        if (expenseAmountEl.value !== old) expenseAmountEl.setSelectionRange(pos, pos);
      });
    }

    const onAddExpense = () => {
      const desc = document.getElementById('expenseDescription').value;
      const amount = document.getElementById('expenseAmount').value.replace(',', '.');
      const date = document.getElementById('expenseDate').value;
      if (this._addExpense(desc, amount, date)) {
        document.getElementById('expenseDescription').value = '';
        document.getElementById('expenseAmount').value = '';
        this._updateAll();
      }
    };
    if (btnAdd) btnAdd.addEventListener('click', onAddExpense);

    const expenseList = document.getElementById('expenseList');
    if (expenseList) {
      expenseList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-del-expense');
        if (btn) this._deleteExpense(btn.dataset.id);
      });
    }

    this._applyPreset('month');
    this._updateAll();
  }
};

// ============================================================
// Utilitários de período
// ============================================================

const _fmtISO = fmtISO;

function _presetRange(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  switch (preset) {
    case 'today':
      return { from: _fmtISO(today), to: _fmtISO(today) };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { from: _fmtISO(y), to: _fmtISO(y) };
    }
    case 'week': {
      const day = today.getDay();
      const monday = addDays(today, day === 0 ? -6 : 1 - day);
      return { from: _fmtISO(monday), to: _fmtISO(today) };
    }
    case 'month': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: _fmtISO(first), to: _fmtISO(last) };
    }
    case 'lastMonth': {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: _fmtISO(first), to: _fmtISO(last) };
    }
    case '30days':
      return { from: _fmtISO(addDays(today, -29)), to: _fmtISO(today) };
    case 'all':
    default:
      return { from: null, to: null };
  }
}
