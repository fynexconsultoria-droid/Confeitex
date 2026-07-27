const Chart = {
  points: [],
  _tooltipCleanup: null,
  _resizeTimer: null,
  _hoverIndex: -1,

  render() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const periodSelect = document.getElementById('chartPeriodSelect');
    const period = periodSelect ? periodSelect.value : '30days';
    const today = new Date();
    const daysMap = { today: 1, '7days': 7, '15days': 15, '30days': 30, '90days': 90 };
    const daysLimit = daysMap[period] || 30;

    this.points = [];
    for (let i = daysLimit - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = State.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
      const salesVal = dayOrders.reduce((s, o) => s + getOrderTotal(o), 0);
      const countVal = dayOrders.length;
      const avgTicket = countVal > 0 ? salesVal / countVal : 0;
      this.points.push({
        date: dateStr,
        label: period === 'today' ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        sales: salesVal,
        count: countVal,
        avgTicket: avgTicket
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
    const pl = 50, pr = 45, pt = 25, pb = 35;
    const cw = w - pl - pr, ch = h - pt - pb;

    ctx.clearRect(0, 0, w, h);

    let maxSales = Math.max(...this.points.map(p => p.sales), 100);
    let maxCount = Math.max(...this.points.map(p => p.count), 5);
    maxSales = Math.ceil(maxSales / 50) * 50;
    maxCount = Math.ceil(maxCount / 5) * 5;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const r = i / 4;
      const y = pt + ch * (1 - r);
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(w - pr, y);
      ctx.stroke();

      ctx.textAlign = 'right';
      ctx.fillText(`R$ ${Math.round(maxSales * r)}`, pl - 8, y);

      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(maxCount * r)} ped`, w - pr + 8, y);
    }

    // X Labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const step = daysLimit >= 90 ? 15 : daysLimit >= 30 ? 5 : daysLimit >= 15 ? 3 : 1;
    const xDivisor = Math.max(this.points.length - 1, 1);
    this.points.forEach((p, i) => {
      if (i % step === 0 || i === this.points.length - 1) {
        const x = pl + cw * (i / xDivisor);
        ctx.fillText(p.label, x, h - pb + 10);
      }
    });

    // Positions for tooltip & drawing
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

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#f43f5e';
    ctx.fillText(`Vendas Hoje: ${fmt(p.sales)}`, cx, cy - 20);

    ctx.font = '600 13px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillStyle = '#a855f7';
    ctx.fillText(`Pedidos: ${p.count} (${p.count > 0 ? fmt(p.avgTicket) + '/ped' : '0'})`, cx, cy + 18);

    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();
    ctx.restore();
  },

  _renderMulti(ctx, w, h, pb) {
    const salesData = this.pointPositions.map(p => ({ x: p.x, y: p.sY }));
    const countData = this.pointPositions.map(p => ({ x: p.x, y: p.cY }));

    // Area Fill
    this._drawSmoothArea(ctx, salesData, '#f43f5e', h - pb);

    // Sales Line (Glowing pink)
    this._drawSmoothLine(ctx, salesData, '#f43f5e', 3.5, true);

    // Count Line (Purple)
    this._drawSmoothLine(ctx, countData, '#a855f7', 2, false);

    // Points
    this.pointPositions.forEach(p => {
      ctx.save();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(p.x, p.sY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.sY, 2, 0, Math.PI * 2);
      ctx.fill();

      if (p.count > 0) {
        ctx.fillStyle = '#a855f7';
        ctx.beginPath();
        ctx.arc(p.x, p.cY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  },

  _drawSmoothLine(ctx, data, color, width, glow) {
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
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
    }
    ctx.stroke();
    ctx.restore();
  },

  _drawSmoothArea(ctx, data, color, bottomY) {
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
    grad.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
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

    const showTooltip = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      let closest = null, minDist = Infinity;
      this.pointPositions.forEach((p, idx) => {
        const d = Math.abs(p.x - mx);
        if (d < minDist) { minDist = d; closest = p; }
      });
      if (closest && minDist < 60) {
        tooltip.innerHTML = `<div style="font-weight:800;color:#fff;border-bottom:1px solid rgba(255,255,255,0.1);padding-bottom:0.3rem;margin-bottom:0.4rem;font-size:0.8rem;">📅 ${closest.label}</div>` +
          `<div style="color:var(--color-accent-pink);font-weight:700;">💰 Vendas: ${fmt(closest.sales)}</div>` +
          `<div style="color:var(--color-accent-purple);font-weight:600;">📦 Pedidos: ${closest.count}</div>` +
          (closest.count > 0 ? `<div style="color:var(--text-secondary);font-size:0.7rem;margin-top:0.2rem;">📊 Ticket Médio: ${fmt(closest.avgTicket)}</div>` : '');
        
        const tipWidth = 140;
        let leftPos = closest.x - tipWidth / 2;
        if (leftPos < 5) leftPos = 5;
        if (leftPos + tipWidth > rect.width - 5) leftPos = rect.width - tipWidth - 5;

        tooltip.style.left = leftPos + 'px';
        tooltip.style.top = '15px';
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

