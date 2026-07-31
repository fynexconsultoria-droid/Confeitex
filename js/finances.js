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
  }
};
