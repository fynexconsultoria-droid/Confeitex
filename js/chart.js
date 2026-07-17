const Chart = {
  points: [],
  _tooltipCleanup: null,
  _resizeTimer: null,

  render() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const period = document.getElementById('chartPeriodSelect').value;
    const today = new Date();
    const daysMap = { today: 1, '7days': 7, '15days': 15, '30days': 30 };
    const daysLimit = daysMap[period] || 30;

    this.points = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = State.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
      this.points.push({
        date: dateStr, label: period === 'today' ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        sales: dayOrders.reduce((s, o) => s + (+o.totalValue || 0), 0),
        count: dayOrders.length
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
    const pl = 45, pr = 40, pt = 25, pb = 30;
    const cw = w - pl - pr, ch = h - pt - pb;

    ctx.clearRect(0, 0, w, h);

    let maxSales = Math.max(...this.points.map(p => p.sales), 100);
    let maxCount = Math.max(...this.points.map(p => p.count), 5);
    maxSales = Math.ceil(maxSales / 50) * 50;
    maxCount = Math.ceil(maxCount / 5) * 5;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const r = i / 4, y = pt + ch * (1 - r);
      ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(`R$ ${Math.round(maxSales * r)}`, pl - 8, y);
      ctx.textAlign = 'left'; ctx.fillText(`${Math.round(maxCount * r)} ped`, w - pr + 8, y);
    }

    // X labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const step = daysLimit >= 30 ? 5 : daysLimit >= 15 ? 3 : 1;
    const xDivisor = Math.max(this.points.length - 1, 1);
    this.points.forEach((p, i) => {
      if (i % step === 0 || i === this.points.length - 1) {
        const x = pl + cw * (i / xDivisor);
        ctx.fillText(p.label, x, h - pb + 8);
      }
    });

    // Store positions for tooltip
    this.pointPositions = this.points.map((p, i) => ({
      ...p,
      x: pl + cw * (i / xDivisor),
      sY: pt + ch * (1 - (p.sales / maxSales)),
      cY: pt + ch * (1 - (p.count / maxCount))
    }));

    this._initResizeHandler(canvas);

    if (this.points.length === 1) {
      this._renderToday(ctx, w, h);
    } else {
      this._renderMulti(ctx, w, h, pb);
    }

    this._setupTooltip(canvas);
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

  _renderToday(ctx, w, h) {
    const p = this.pointPositions[0];
    const cx = w / 2, cy = h / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.fillText(`Vendas: ${fmt(p.sales)}`, cx, cy - 20);
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = '#8b5cf6';
    ctx.fillText(`Pedidos: ${p.count}`, cx, cy + 20);
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(236, 72, 153, 0.08)';
    ctx.fill();
    ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ec4899';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fill();
  },

  _renderMulti(ctx, w, h, pb) {
    const salesData = this.pointPositions.map(p => ({ x: p.x, y: p.sY }));
    const countData = this.pointPositions.map(p => ({ x: p.x, y: p.cY }));

    this._drawSmoothArea(ctx, salesData, '#ec4899', h - pb);
    this._drawSmoothLine(ctx, salesData, '#ec4899', 3);
    this._drawSmoothLine(ctx, countData, '#8b5cf6', 2);

    this.pointPositions.forEach(p => {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.arc(p.x, p.sY, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.sY, 2, 0, Math.PI * 2); ctx.fill();
      if (p.count > 0) {
        ctx.fillStyle = '#8b5cf6';
        ctx.beginPath(); ctx.arc(p.x, p.cY, 3, 0, Math.PI * 2); ctx.fill();
      }
    });
  },

  _drawSmoothLine(ctx, data, color, width) {
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
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = color + '66';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  },

  _drawSmoothArea(ctx, data, color, bottomY) {
    if (data.length < 2) return;
    // find topmost y for gradient start
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
    grad.addColorStop(0, color + '33');
    grad.addColorStop(1, color + '00');
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

    const showTooltip = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      let closest = null, minDist = Infinity;
      this.pointPositions.forEach(p => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (closest && minDist < 50) {
        tooltip.innerHTML = `<strong>${closest.label}</strong><br>Vendas: ${fmt(closest.sales)}<br>Pedidos: ${closest.count}`;
        tooltip.style.left = Math.min(Math.max(closest.x - 60, 0), rect.width - 130) + 'px';
        tooltip.style.top = '30px';
        tooltip.classList.add('visible');
      } else {
        tooltip.classList.remove('visible');
      }
    };

    const hideTooltip = () => tooltip.classList.remove('visible');

    const onMove = (e) => showTooltip(e.touches ? e.touches[0].clientX : e.clientX);
    const onLeave = () => hideTooltip();

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
