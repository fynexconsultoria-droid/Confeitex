const Chart = {
  points: [],
  _observerInit: false,

  render() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    if (!this._observerInit) {
      this._observerInit = true;
      this._resizeObserver = new ResizeObserver(() => {
        if (document.getElementById('dashboard').classList.contains('active')) {
          this.render();
        }
      });
      this._resizeObserver.observe(canvas.parentElement);
    }

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
        sales: dayOrders.reduce((s, o) => s + o.totalValue, 0),
        count: dayOrders.length
      });
    }

    const rect = canvas.getBoundingClientRect();
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
    this.points.forEach((p, i) => {
      if (i % step === 0 || i === this.points.length - 1) {
        const x = pl + cw * (i / xDivisor);
        ctx.fillText(p.label, x, h - pb + 8);
      }
    });

    // Store positions for tooltips
    const xDivisor = Math.max(this.points.length - 1, 1);
    this.pointPositions = this.points.map((p, i) => ({
      ...p,
      x: pl + cw * (i / xDivisor),
      sY: pt + ch * (1 - (p.sales / maxSales)),
      cY: pt + ch * (1 - (p.count / maxCount))
    }));

    // Smooth line helper
    const smoothLine = (data, getY, color, width, fill = false) => {
      ctx.beginPath();
      data.forEach((p, i) => {
        const x = p.x, y = getY(p);
        if (i === 0) ctx.moveTo(x, y);
        else {
          const prev = data[i - 1];
          const cpx = (prev.x + x) / 2;
          ctx.bezierCurveTo(cpx, getY(prev), cpx, y, x, y);
        }
      });
      ctx.strokeStyle = color; ctx.lineWidth = width;
      ctx.shadowColor = color + '66'; ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (fill) {
        ctx.lineTo(data[data.length - 1].x, h - pb);
        ctx.lineTo(data[0].x, h - pb);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, pt, 0, h - pb);
        grad.addColorStop(0, color + '33');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.fill();
      }
    };

    if (this.points.length === 1) {
      // Modo Hoje: exibe indicadores grandes em destaque
      const p = this.pointPositions[0];
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillStyle = '#ec4899';
      ctx.fillText(`Vendas: ${fmt(p.sales)}`, p.x, p.sY - 30);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillText(`Pedidos: ${p.count}`, p.x, p.sY + 30);
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.arc(p.x, p.sY, 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(236, 72, 153, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#ec4899'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.sY, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ec4899';
      ctx.beginPath(); ctx.arc(p.x, p.sY, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      // Sales line (filled)
      const salesData = this.pointPositions.map(p => ({ x: p.x, y: p.sY, v: p.sales }));
      smoothLine(salesData, p => p.y, '#ec4899', 3, true);

      // Count line
      const countData = this.pointPositions.map(p => ({ x: p.x, y: p.cY, v: p.count }));
      smoothLine(countData, p => p.y, '#8b5cf6', 2);

      // Dots
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
    }

    this.setupTooltip(canvas);
  },

  setupTooltip(canvas) {
    let tooltip = document.getElementById('chartTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltip';
      document.querySelector('.chart-container')?.appendChild(tooltip);
    }

    if (this._tooltipCleanup) this._tooltipCleanup();

    const showTooltip = (x) => {
      const rect = canvas.getBoundingClientRect();
      const mx = x - rect.left;
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
      this._tooltipCleanup = null;
    };
  }
};
