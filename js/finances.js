const Finance = {
  _month: null,
  _date: null,

  render() {
    const monthInput = document.getElementById('financeMonthSelect');
    if (!monthInput.value) {
      const now = new Date();
      monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    }
    this._month = monthInput.value;
    this._date = document.getElementById('financeDateSelect').value;
    this._updateAll();
  },

  _updateAll() {
    const dateFilter = this._date;
    const monthFilter = this._month;

    let filteredOrders;
    if (dateFilter) {
      filteredOrders = State.orders.filter(o => o.deliveryDate === dateFilter);
    } else if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number);
      filteredOrders = State.orders.filter(o => {
        if (!o.deliveryDate) return false;
        const d = new Date(o.deliveryDate + 'T00:00:00');
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
    } else {
      filteredOrders = [];
    }

    const monthOrders = filteredOrders;
    const activeMonth = monthOrders.filter(o => o.status !== 'Cancelado');
    const canceledMonth = monthOrders.filter(o => o.status === 'Cancelado');

    const monthSales = activeMonth.reduce((s, o) => s + getOrderTotal(o), 0);
    const monthCost = monthOrders.reduce((s, o) => s + (o.cost || 0), 0);
    const monthProfit = monthSales - monthCost;

    document.getElementById('finKpiSalesMonth').textContent = fmt(monthSales);
    document.getElementById('finKpiCostMonth').textContent = fmt(monthCost);
    document.getElementById('finKpiProfitMonth').textContent = fmt(monthProfit);
    document.getElementById('finKpiOrdersMonth').textContent = monthOrders.length;
    const setMetricFooter = (n, text) => {
      const el = document.querySelector(`#finances .metric-card:nth-child(${n}) .metric-footer`);
      if (el) el.textContent = text;
    };
    setMetricFooter(1, dateFilter ? 'Total de vendas do dia' : 'Total de vendas do período');
    setMetricFooter(2, dateFilter ? 'Total de custos do dia' : 'Total de custos do período');
    setMetricFooter(4, dateFilter ? 'Total de pedidos do dia' : 'Total de pedidos no período');

    const allActive = State.orders.filter(o => o.status !== 'Cancelado');
    const allCanceled = State.orders.filter(o => o.status === 'Cancelado');
    const totalRev = allActive.reduce((s, o) => s + getOrderTotal(o), 0);
    const totalCost = State.orders.reduce((s, o) => s + (o.cost || 0), 0);
    const totalProfit = totalRev - totalCost;
    const avgTicket = allActive.length > 0 ? totalRev / allActive.length : 0;

    document.getElementById('finGenOrders').textContent = allActive.length;
    document.getElementById('finGenRevenue').textContent = fmt(totalRev);
    document.getElementById('finGenCost').textContent = fmt(totalCost);
    document.getElementById('finGenProfit').textContent = fmt(totalProfit);
    document.getElementById('finGenAvgTicket').textContent = fmt(avgTicket);
    document.getElementById('finGenCanceled').textContent = allCanceled.length;

    this._drawPieChart('finPieProductChart', 'finPieProductLegend', monthOrders, 'productType', [
      'Bolo de Kg', 'Bolo Unitário', 'Doces / Brigadeiros', 'Salgados', 'Outros'
    ], ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b']);

    this._drawPieChart('finPiePaymentChart', 'finPiePaymentLegend', monthOrders, 'paymentMethod', [], null);

    this._drawPieChart('finPieStatusChart', 'finPieStatusLegend', monthOrders, 'status', [
      'Pendente', 'Em Produção', 'Entregue', 'Cancelado'
    ], ['#f59e0b', '#3b82f6', '#10b981', '#ef4444']);
  },

  _drawPieChart(canvasId, legendId, orders, field, orderedLabels, colors) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const groups = {};
    orders.forEach(o => {
      const key = o[field] || 'Outros';
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
      ctx.fillText('Sem dados no período', w / 2, h / 2);
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
      legendEl.innerHTML = entries.map(([key, val]) => {
        const pct = Math.round(val / total * 100);
        return `<div class="finance-legend-item">
          <span class="finance-legend-dot" style="background:${getColor(key)}"></span>
          <span class="finance-legend-label">${escapeHTML(key)}</span>
          <span class="finance-legend-value">${val} (${pct}%)</span>
        </div>`;
      }).join('');
    }
  },

  _getFilteredOrders() {
    const dateFilter = this._date;
    const monthFilter = this._month;
    if (dateFilter) return State.orders.filter(o => o.deliveryDate === dateFilter);
    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number);
      return State.orders.filter(o => {
        if (!o.deliveryDate) return false;
        const d = new Date(o.deliveryDate + 'T00:00:00');
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
    }
    return [];
  },

  _periodLabel() {
    const dateFilter = this._date;
    const monthFilter = this._month;
    if (dateFilter) return `Dia ${fmtDateStr(dateFilter)}`;
    if (monthFilter) {
      const [year, month] = monthFilter.split('-').map(Number);
      const name = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Período (todos)';
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
    const cost = orders.reduce((s, o) => s + (o.cost || 0), 0);
    const profit = sales - cost;
    const margin = sales > 0 ? (profit / sales) * 100 : 0;
    const avgTicket = active.length > 0 ? sales / active.length : 0;

    const hoje = new Date().toLocaleDateString('pt-BR');

    const linhas = orders.length > 0 ? orders.map(o =>
      `<tr>
        <td><strong>${escapeHTML(o.clientName)}</strong>${o.clientPhone ? `<br><small>${escapeHTML(o.clientPhone)}</small>` : ''}</td>
        <td>${escapeHTML(o.flavor || '')}${o.productType ? `<br><small>${escapeHTML(o.productType)}</small>` : ''}</td>
        <td>${fmtDateStr(o.deliveryDate)}${o.deliveryTime ? ' ' + escapeHTML(o.deliveryTime) : ''}</td>
        <td style="text-align:center">${escapeHTML(o.paymentMethod || '—')}</td>
        <td style="text-align:center">${escapeHTML(o.status)}</td>
        <td style="text-align:right;font-weight:bold;">${fmt(getOrderTotal(o))}</td>
      </tr>`
    ).join('') : `<tr><td colspan="6" style="text-align:center;color:#999;">Sem pedidos no período selecionado.</td></tr>`;

    const charts =
      this._captureChart('finPieProductChart', 'finPieProductLegend', 'Pedidos por Tipo de Produto') +
      this._captureChart('finPiePaymentChart', 'finPiePaymentLegend', 'Formas de Pagamento') +
      this._captureChart('finPieStatusChart', 'finPieStatusLegend', 'Pedidos por Status');

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
<h1>🎂 Confeitex — Relatório Financeiro</h1>
<p class="subtitle">Gerado em ${hoje} <span class="period-tag">📅 ${escapeHTML(this._periodLabel())}</span></p>

<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Faturamento (Bruto)</div><div class="kpi-value pink">${fmt(sales)}</div></div>
  <div class="kpi"><div class="kpi-label">Custos</div><div class="kpi-value blue">${fmt(cost)}</div></div>
  <div class="kpi"><div class="kpi-label">Lucro (Líquido)</div><div class="kpi-value green">${fmt(profit)}</div></div>
  <div class="kpi"><div class="kpi-label">Pedidos</div><div class="kpi-value purple">${orders.length}</div></div>
</div>

<div class="section-title">📊 Gráficos do Período</div>
<div class="charts-grid">
  ${charts || '<p class="muted">Nenhum gráfico disponível.</p>'}
</div>

<div class="section-title">📋 Pedidos do Período (${orders.length})</div>
<table><thead><tr>
<th>Cliente</th><th>Produto / Sabor</th><th>Entrega</th><th>Pagamento</th><th>Status</th><th style="text-align:right">Valor</th>
</tr></thead><tbody>${linhas}</tbody></table>

<div class="section-title">💰 Resultado Final</div>
<table class="result-table">
  <tr class="result-bruto"><td>Faturamento Bruto</td><td style="text-align:right">${fmt(sales)}</td></tr>
  <tr><td>Total de Custos</td><td style="text-align:right">${fmt(cost)}</td></tr>
  <tr class="result-liquido"><td>Lucro Líquido</td><td style="text-align:right">${fmt(profit)}</td></tr>
  <tr><td>Margem de Lucro</td><td style="text-align:right">${margin.toFixed(1).replace('.', ',')}%</td></tr>
  <tr><td>Ticket Médio</td><td style="text-align:right">${fmt(avgTicket)}</td></tr>
  <tr class="result-total"><td>Pedidos Ativos / Cancelados</td><td style="text-align:right">${active.length} / ${canceled.length}</td></tr>
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
        UI.toast('Relatório financeiro pronto para salvar como PDF');
      } catch (e) {
        console.warn('[PDF Print Error]:', e);
        UI.alert('Não foi possível iniciar a impressão. Verifique se o navegador bloqueou a ação.');
      }
    }, 400);
  },

  setup() {
    const monthInput = document.getElementById('financeMonthSelect');
    const dateInput = document.getElementById('financeDateSelect');
    const now = new Date();
    monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const refresh = () => {
      this._month = monthInput.value;
      this._date = dateInput.value;
      this._updateAll();
    };

    monthInput.addEventListener('change', () => {
      dateInput.value = '';
      refresh();
    });

    dateInput.addEventListener('change', refresh);

    document.getElementById('btnFinanceDateClear').addEventListener('click', () => {
      dateInput.value = '';
      refresh();
    });

    document.getElementById('btnFinancePeriodReset').addEventListener('click', () => {
      dateInput.value = '';
      const now = new Date();
      monthInput.value = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      refresh();
    });

    document.getElementById('btnFinancePdf').addEventListener('click', () => this.exportPDF());
  }
};
