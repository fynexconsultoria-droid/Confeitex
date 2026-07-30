const Notifications = {
  _started: false,
  _intervalId: null,
  _enabled: false,

  defaultSettings: {
    daysBefore: [0, 1],
    intervalHours: 1,
    statuses: ['Pendente', 'Em Produção'],
    alertPendingPayment: true,
    categories: { deliveries: true, production: true, financial: false, late: true }
  },

  getSettings() {
    try {
      const stored = localStorage.getItem('confeitex_notification_settings');
      if (stored) return { ...this.defaultSettings, ...JSON.parse(stored) };
    } catch (e) { console.warn('[Notifications] Erro ao carregar configurações:', e); }
    return { ...this.defaultSettings };
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      if (settings.categories) updated.categories = { ...current.categories, ...settings.categories };
      localStorage.setItem('confeitex_notification_settings', JSON.stringify(updated));
      if (this._enabled) {
        this._restartInterval();
      }
      return updated;
    } catch (e) {
      console.warn('[Notifications] Erro ao salvar configurações:', e);
      return this.getSettings();
    }
  },

  get enabled() {
    return this._enabled;
  },

  get status() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  init() {
    if (this._started || !('Notification' in window)) return;
    this._started = true;

    const stored = localStorage.getItem('confeitex_notifications_enabled');
    if (stored === 'true' && Notification.permission === 'granted') {
      this._enable();
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this._enabled) this.check();
    });
  },

  _enable() {
    if (this._enabled) return;
    this._enabled = true;
    localStorage.setItem('confeitex_notifications_enabled', 'true');
    this.check();
    this._restartInterval();
  },

  _restartInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    const settings = this.getSettings();
    const ms = (settings.intervalHours || 1) * 3600000;
    this._intervalId = setInterval(() => {
      if (this._enabled) this.check();
    }, ms);
  },

  _disable() {
    this._enabled = false;
    localStorage.setItem('confeitex_notifications_enabled', 'false');
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  async enable() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }
    this._enable();
    this.check();
    return true;
  },

  disable() {
    this._disable();
  },

  toggle() {
    if (this._enabled) {
      this.disable();
      return false;
    } else {
      return this.enable();
    }
  },

  async sendTestNotification() {
    if (!('Notification' in window)) {
      UI.alert('Seu navegador não suporta notificações.');
      return false;
    }
    if (Notification.permission !== 'granted') {
      const ok = await this.enable();
      if (!ok) {
        UI.alert('Permissão de notificações negada pelo navegador.');
        return false;
      }
    }
    try {
      new Notification('Confeitex - Teste de Notificação 🎂', {
        body: 'As notificações do Confeitex estão ativas e funcionando perfeitamente!',
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-test-' + Date.now()
      });
      return true;
    } catch (e) {
      console.warn('[Notifications] Erro ao enviar notificação de teste:', e);
      return false;
    }
  },

  check() {
    if (!this._enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    const settings = this.getSettings();
    const cats = settings.categories || {};
    const sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const dayLabels = { 0: 'Hoje', 1: 'Amanhã', 2: 'em 2 Dias', 3: 'em 3 Dias', 7: 'em 7 Dias' };

    // ── 1. ENTREGAS ──
    if (cats.deliveries !== false) {
      const daysBeforeList = settings.daysBefore || [0, 1];
      const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];

      daysBeforeList.forEach(dayOffset => {
        const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
        const targetDateStr = targetDateObj.toISOString().split('T')[0];
        const cacheKey = `notif_d${dayOffset}_${targetDateStr}`;
        if (sent[cacheKey]) return;

        const matchingOrders = State.orders.filter(o =>
          o.deliveryDate === targetDateStr && allowedStatuses.includes(o.status)
        );
        if (matchingOrders.length === 0) return;

        let bodyMsg = `${matchingOrders.length} entrega(s) ${dayLabels[dayOffset] || `dia ${targetDateStr}`}:\n`;
        bodyMsg += matchingOrders.slice(0, 3).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
        if (matchingOrders.length > 3) bodyMsg += `\ne mais ${matchingOrders.length - 3} pedido(s)...`;

        if (settings.alertPendingPayment) {
          const totalVal = matchingOrders.reduce((s, o) => s + (o.totalValue || 0), 0);
          if (totalVal > 0) bodyMsg += `\n💰 Valor total: R$ ${totalVal.toFixed(2).replace('.', ',')}`;
        }

        new Notification(`Confeitex - Entregas ${dayLabels[dayOffset] || targetDateStr} 🎂`, {
          body: bodyMsg, icon: 'icons/icon-192x192.png',
          tag: `confeitex-day-${dayOffset}-${targetDateStr}`
        });
        sent[cacheKey] = true;
      });
    }

    // ── 2. PRODUÇÃO ──
    if (cats.production !== false) {
      const cacheKey = 'notif_production_' + todayStr;
      if (!sent[cacheKey]) {
        const prodOrders = State.orders.filter(o => o.status === 'Em Produção');
        if (prodOrders.length > 0) {
          let bodyMsg = `${prodOrders.length} pedido(s) em produção:\n`;
          bodyMsg += prodOrders.slice(0, 4).map(o => `• ${o.clientName}: ${o.flavor}${o.deliveryDate ? ' — Entrega ' + o.deliveryDate : ''}`).join('\n');
          if (prodOrders.length > 4) bodyMsg += `\ne mais ${prodOrders.length - 4} pedido(s)`;

          new Notification('Confeitex - Pedidos em Produção 👨‍🍳', {
            body: bodyMsg, icon: 'icons/icon-192x192.png',
            tag: 'confeitex-production-' + todayStr
          });
          sent[cacheKey] = true;
        }
      }
    }

    // ── 3. FINANCEIRO ──
    if (cats.financial) {
      const cacheKey = 'notif_financial_' + todayStr;
      if (!sent[cacheKey]) {
        const todayOrders = State.orders.filter(o => o.deliveryDate === todayStr && o.status !== 'Cancelado');
        if (todayOrders.length > 0) {
          const sales = todayOrders.reduce((s, o) => s + getOrderTotal(o), 0);
          const costs = todayOrders.reduce((s, o) => s + (o.cost || 0), 0);
          let bodyMsg = `📊 Resumo Financeiro de Hoje:\n`;
          bodyMsg += `💰 Vendas: R$ ${sales.toFixed(2).replace('.', ',')}\n`;
          bodyMsg += `📦 Pedidos: ${todayOrders.length}\n`;
          bodyMsg += `💵 Lucro Estimado: R$ ${(sales - costs).toFixed(2).replace('.', ',')}`;

          new Notification('Confeitex - Resumo do Dia 💰', {
            body: bodyMsg, icon: 'icons/icon-192x192.png',
            tag: 'confeitex-financial-' + todayStr
          });
          sent[cacheKey] = true;
        }
      }
    }

    // ── 4. ATRASADOS ──
    if (cats.late !== false) {
      const cacheKey = 'notif_late_' + todayStr;
      if (!sent[cacheKey]) {
        const lateOrders = State.orders.filter(o =>
          o.deliveryDate && o.deliveryDate < todayStr &&
          (o.status === 'Pendente' || o.status === 'Em Produção')
        );
        if (lateOrders.length > 0) {
          let bodyMsg = `${lateOrders.length} pedido(s) atrasado(s):\n`;
          bodyMsg += lateOrders.slice(0, 4).map(o =>
            `• ${o.clientName}: ${o.flavor} (vencido ${o.deliveryDate.split('-').reverse().join('/')})`
          ).join('\n');
          if (lateOrders.length > 4) bodyMsg += `\ne mais ${lateOrders.length - 4} pedido(s)`;

          new Notification('Confeitex - Pedidos Atrasados ⏰', {
            body: bodyMsg, icon: 'icons/icon-192x192.png',
            tag: 'confeitex-late-' + todayStr
          });
          sent[cacheKey] = true;
        }
      }
    }

    localStorage.setItem('confeitex_notified', JSON.stringify(sent));
  }
};

