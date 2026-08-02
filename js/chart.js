const Chart = {
  points: [],
  pointPositions: [],
  _tooltipCleanup: null,
  _resizeTimer: null,
  _hoverRaf: null,
  _hoverIndex: -1,
  _ctx: null,
  _w: 0,
  _h: 0,
  _pb: 0,

  render() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const periodSelect = document.getElementById('chartPeriodSelect');
    const period = periodSelect ? periodSelect.value : '30days';
    const today = new Date();
    const locale = I18n.locales[I18n.lang] || 'pt-BR';
    const daysMap = { today: 1, '7days': 7, '15days': 15, '30days': 30, '90days': 90 };
    const daysLimit = daysMap[period] || 30;

    this.points = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = fmtISO(d);
      const dayOrders = State.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
      const salesVal = dayOrders.reduce((s, o) => s + getOrderTotal(o), 0);
      const countVal = dayOrders.length;
      const avgTicket = countVal > 0 ? salesVal / countVal : 0;
      const prev = this.points[i === 0 ? 0 : i - 1];
      this.points.push({
        date: dateStr,
        label: period === 'today' ? I18n.t('common.today') : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
        weekday: d.toLocaleDateString(locale, { weekday: 'long' }),
        fullLabel: period === 'today' ? I18n.t('common.today') : d.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' }),
        sales: salesVal,
        count: countVal,
        avgTicket: avgTicket,
        salesDelta: prev ? salesVal - prev.sales : null,
        countDelta: prev ? countVal - prev.count : null
      });
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const w = rect.width, h = rect.height;
    const pl = 52, pr = 46, pt = 25, pb = 38;
    const cw = w - pl - pr, ch = h - pt - pb;

    this._ctx = ctx;
    this._w = w;
    this._h = h;
    this._pb = pb;
    this._cw = cw;
    this._ch = ch;
    this._pt = pt;
    this._pl = pl;
    this._pr = pr;

    let maxSales = Math.max(...this.points.map(p => p.sales), 100);
    let maxCount = Math.max(...this.points.map(p => p.count), 5);
    maxSales = this._niceMax(maxSales);
    maxCount = Math.ceil(maxCount / 5) * 5;

    this._maxSales = maxSales;
    this._maxCount = maxCount;

    this.pointPositions = this.points.map((p, i) => ({
      ...p,
      x: pl + cw * (i / Math.max(this.points.length - 1, 1)),
      sY: pt + ch * (1 - (p.sales / maxSales)),
      cY: pt + ch * (1 - (p.count / maxCount))
    }));

    if (this._hoverRaf) { cancelAnimationFrame(this._hoverRaf); this._hoverRaf = null; }
    this._hoverIndex = -1;

    this._drawChart();

    this._initResizeHandler(canvas);
    this._setupTooltip(canvas);
  },

  _niceMax(v) {
    const step = Math.pow(10, Math.floor(Math.log10(v)));
    let base = v / step;
    if (base <= 1) base = 1;
    else if (base <= 2) base = 2;
    else if (base <= 2.5) base = 2.5;
    else if (base <= 5) base = 5;
    else base = 10;
    return base * step;
  },

  _axisFmt(v) {
    if (v >= 1000000) return 'R$ ' + (v / 1000000).toFixed(1).replace('.', ',') + 'M';
    if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',') + 'k';
    return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  },

  _drawChart() {
    const { ctx, w, h, pt, pb, pl, pr, cw, ch } = this;
    const { _maxSales: maxSales, _maxCount: maxCount } = this;

    ctx.clearRect(0, 0, w, h);

    // Subtle top-to-bottom background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(244, 63, 94, 0.05)');
    bg.addColorStop(0.6, 'rgba(10, 8, 19, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(pl, pt, cw, ch);

    // Grid lines + axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.fillStyle = '#8b93a7';
    ctx.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= 4; i++) {
      const r = i / 4;
      const y = pt + ch * (1 - r);
      ctx.save();
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(w - pr, y);
      ctx.stroke();
      ctx.restore();

      ctx.textAlign = 'right';
      ctx.fillText(this._axisFmt(maxSales * r), pl - 8, y);

      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(maxCount * r)} ${I18n.t('chart.ordersAxis')}`, w - pr + 8, y);
    }

    // Baseline slightly brighter
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pl, pt + ch);
    ctx.lineTo(w - pr, pt + ch);
    ctx.stroke();

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#8b93a7';
    const daysLimit = this.points.length;
    const step = daysLimit >= 90 ? 15 : daysLimit >= 30 ? 5 : daysLimit >= 15 ? 3 : 1;
    this.points.forEach((p, i) => {
      if (i % step === 0 || i === daysLimit - 1) {
        ctx.fillText(p.label, p.x, h - pb + 10);
      }
    });

    // Draw data
    if (this.points.length === 1) {
      this._drawSingle(this.pointPositions[0]);
      return;
    }

    const salesData = this.pointPositions.map(p => ({ x: p.x, y: p.sY }));
    const countData = this.pointPositions.map(p => ({ x: p.x, y: p.cY }));

    this._drawSmoothArea(ctx, salesData, h - pb);
    this._drawSmoothLine(ctx, salesData, '#f43f5e', 3, true);
    this._drawSmoothLine(ctx, countData, '#a855f7', 2, false, true);

    this.pointPositions.forEach((p, i) => {
      this._drawDataPoint(p, i === this._hoverIndex);
    });

    // Hover highlight ring
    if (this._hoverIndex >= 0 && this.pointPositions[this._hoverIndex]) {
      const p = this.pointPositions[this._hoverIndex];
      ctx.save();
      ctx.strokeStyle = '#f43f5e';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.sY, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(p.x, p.cY, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  _drawSingle(p) {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2;
    const radius = Math.min(64, h / 3.2);

    ctx.save();

    // Outer glow halo
    const halo = ctx.createRadialGradient(cx, cy, radius - 6, cx, cy, radius + 20);
    halo.addColorStop(0, 'rgba(244, 63, 94, 0.22)');
    halo.addColorStop(1, 'rgba(244, 63, 94, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2);
    ctx.fill();

    // Donut background
    ctx.fillStyle = 'rgba(244, 63, 94, 0.06)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Donut ring (gradient)
    const ring = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    ring.addColorStop(0, '#f43f5e');
    ring.addColorStop(1, '#a855f7');
    ctx.strokeStyle = ring;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center dot
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Center text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f43f5e';
    ctx.font = '700 15px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(fmt(p.sales), cx, cy - radius - 24);

    ctx.fillStyle = '#c084fc';
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(I18n.t('chart.ordersCount', { count: p.count }), cx, cy + radius + 22);

    if (p.count > 0) {
      ctx.fillStyle = '#8b93a7';
      ctx.font = '600 10px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(`${I18n.t('chart.avgTicket')}: ${fmt(p.avgTicket)}`, cx, cy + radius + 40);
    }

    ctx.restore();
  },

  _drawDataPoint(p, isHover) {
    const { ctx } = this;
    ctx.save();

    // Sales point
    const grad = ctx.createRadialGradient(p.x - 1.5, p.sY - 1.5, 0, p.x, p.sY, isHover ? 9 : 6.5);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f43f5e');
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = isHover ? 14 : 8;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.sY, isHover ? 5.5 : 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Sales glow halo
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.sY, isHover ? 9 : 7, 0, Math.PI * 2);
    ctx.stroke();

    // Count point (hollow)
    if (p.count > 0) {
      ctx.fillStyle = 'rgba(168, 85, 247, 0.16)';
      ctx.beginPath();
      ctx.arc(p.x, p.cY, isHover ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.cY, isHover ? 5 : 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(p.x, p.cY, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  _initResizeHandler(canvas) {
    if (this._resizeHandlerInit) return;
    this._resizeHandlerInit = true;

    const handler = () => {
      if (this._resizeTimer) cancelAnimationFrame(this._resizeTimer);
      this._resizeTimer = requestAnimationFrame(() => {
        if (document.getElementById('dashboard')?.classList.contains('active')) {
          this.render();
        }
      });
    };

    window.addEventListener('resize', handler);
    this._resizeCleanup = () => window.removeEventListener('resize', handler);
  },

  _drawSmoothLine(ctx, data, color, width, glow, dashed) {
    if (data.length < 2) return;
    ctx.save();
    ctx.beginPath();
    data.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = data[i - 1];
        const cpx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
      }
    });
    if (dashed) ctx.setLineDash([6, 5]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    ctx.restore();
  },

  _drawSmoothArea(ctx, data, bottomY) {
    if (data.length < 2) return;
    let topY = bottomY;
    data.forEach(p => { if (p.y < topY) topY = p.y; });
    ctx.save();
    ctx.beginPath();
    data.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const prev = data[i - 1];
        const cpx = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
      }
    });
    ctx.lineTo(data[data.length - 1].x, bottomY);
    ctx.lineTo(data[0].x, bottomY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, topY, 0, bottomY);
    grad.addColorStop(0, 'rgba(244, 63, 94, 0.28)');
    grad.addColorStop(0.5, 'rgba(244, 63, 94, 0.08)');
    grad.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  },

  _setupTooltip(canvas) {
    let tooltip = document.getElementById('chartTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltip';
      document.querySelector('.chart-container')?.appendChild(tooltip);
    }

    if (this._tooltipCleanup) {
      this._tooltipCleanup();
      this._tooltipCleanup = null;
    }

    const clampTip = (val, min, max, size) => {
      if (val < min) return min;
      if (val + size > max) return max - size;
      return val;
    };

    const deltaHtml = (cur, prev, isSales) => {
      if (prev === null || prev === undefined) return '';
      if (prev <= 0) return cur > 0 ? `<span class="ct-delta ct-delta-new">${I18n.t('chart.new')}</span>` : '';
      const pct = ((cur - prev) / prev) * 100;
      const up = pct >= 0;
      return `<span class="ct-delta ${up ? 'ct-delta-up' : 'ct-delta-down'}">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%</span>`;
    };

    const showTooltip = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      let closest = null, minDist = Infinity;
      this.pointPositions.forEach((p) => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (closest && minDist < 60) {
        tooltip.innerHTML = `<div class="ct-header">
            <span class="ct-weekday">${escapeHTML(closest.weekday)}</span>
            <span class="ct-date">${escapeHTML(closest.label)}</span>
          </div>` +
          `          <div class="ct-row"><span class="ct-dot pink"></span><span class="ct-label">${I18n.t('chart.sales')}</span><span class="ct-value">${fmt(closest.sales)}</span>${deltaHtml(closest.sales, closest.salesDelta, true)}</div>` +
          `<div class="ct-row"><span class="ct-dot purple"></span><span class="ct-label">${I18n.t('chart.orders')}</span><span class="ct-value">${closest.count}</span>${deltaHtml(closest.count, closest.countDelta, false)}</div>` +
          (closest.count > 0 ? `<div class="ct-row"><span class="ct-dot teal"></span><span class="ct-label">${I18n.t('chart.avgTicket')}</span><span class="ct-value">${fmt(closest.avgTicket)}</span></div>` : '');

        tooltip.style.visibility = 'hidden';
        tooltip.classList.add('visible');
        const tipWidth = tooltip.offsetWidth || 150;
        const tipHeight = tooltip.offsetHeight || 90;
        tooltip.style.visibility = '';

        let leftPos = closest.x - tipWidth / 2;
        leftPos = clampTip(leftPos, 4, rect.width - 4, tipWidth);

        let topPos = closest.sY - tipHeight - 12;
        if (topPos < 4) topPos = closest.sY + 16;
        topPos = clampTip(topPos, 4, rect.height - 4, tipHeight);

        tooltip.style.left = leftPos + 'px';
        tooltip.style.top = topPos + 'px';
      } else {
        tooltip.classList.remove('visible');
      }
    };

    const hideTooltip = () => tooltip.classList.remove('visible');

    const onMove = (e) => {
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const rect = canvas.getBoundingClientRect();
      const mx = cx - rect.left;
      let idx = -1, minDist = Infinity;
      this.pointPositions.forEach((p, i) => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; idx = i; }
      });
      if (minDist >= 60) idx = -1;
      if (idx !== this._hoverIndex) {
        this._hoverIndex = idx;
        if (this._hoverRaf) cancelAnimationFrame(this._hoverRaf);
        this._hoverRaf = requestAnimationFrame(() => this._drawChart());
      }
      showTooltip(cx, cy);
    };

    const onLeave = () => {
      if (this._hoverIndex !== -1) {
        this._hoverIndex = -1;
        if (this._hoverRaf) cancelAnimationFrame(this._hoverRaf);
        this._hoverRaf = requestAnimationFrame(() => this._drawChart());
      }
      hideTooltip();
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('touchend', onLeave);

    this._tooltipCleanup = () => {
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('touchend', onLeave);
    };
  }
};
