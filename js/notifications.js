const Notifications = {
  _started: false,
  _intervalId: null,
  _enabled: false,

  defaultSettings: {
    daysBefore: [0, 1], // 0 = Hoje, 1 = 1 dia antes, ..., 7 = 7 dias antes
    intervalHours: 1,  // Intervalo em horas (1, 2, 4, 12, 24)
    statuses: ['Pendente', 'Em Produção'],
    alertPendingPayment: true,
    deliveryTimes: [8, 17], // Horários dos lembretes de entrega
    alertProduction: false,  // Resumo diário da produção
    productionHour: 8       // Horário do resumo da produção
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

  _isTimeToNotify(hoursList) {
    if (!hoursList || hoursList.length === 0) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    return hoursList.some(h => h === currentHour && currentMin < 5);
  },

  _markNotified(key) {
    const sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}');
    sent[key] = true;
    localStorage.setItem('confeitex_notified', JSON.stringify(sent));
  },

  _wasNotified(key) {
    const sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}');
    return !!sent[key];
  },

  check() {
    if (!this._enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    const settings = this.getSettings();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // --- LEMBRETE DE ENTREGAS ---
    if (settings.deliveryTimes && settings.deliveryTimes.length > 0) {
      if (this._isTimeToNotify(settings.deliveryTimes)) {
        this._checkDeliveries(settings, now, todayStr);
      }
    }

    // --- RESUMO DA PRODUÇÃO ---
    if (settings.alertProduction) {
      const prodHour = settings.productionHour != null ? settings.productionHour : 8;
      if (this._isTimeToNotify([prodHour])) {
        this._checkProduction(now, todayStr);
      }
    }
  },

  _checkDeliveries(settings, now, todayStr) {
    const daysBeforeList = settings.daysBefore || [0, 1];
    const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];
    const currentHour = now.getHours();

    const dayLabels = {
      0: 'Hoje', 1: 'Amanhã', 2: 'em 2 Dias', 3: 'em 3 Dias',
      4: 'em 4 Dias', 5: 'em 5 Dias', 6: 'em 6 Dias', 7: 'em 7 Dias'
    };

    daysBeforeList.forEach(dayOffset => {
      const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
      const targetDateStr = targetDateObj.toISOString().split('T')[0];

      const matchingOrders = State.orders.filter(o => {
        if (o.deliveryDate !== targetDateStr) return false;
        return allowedStatuses.includes(o.status);
      });

      if (matchingOrders.length === 0) return;

      const cacheKey = `notif_d${dayOffset}_${targetDateStr}_h${currentHour}`;
      if (this._wasNotified(cacheKey)) return;

      let bodyMsg = `${matchingOrders.length} entrega(s) agendada(s) para ${dayLabels[dayOffset] || `dia ${targetDateStr}`}:\n`;
      bodyMsg += matchingOrders.slice(0, 5).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
      if (matchingOrders.length > 5) {
        bodyMsg += `\ne mais ${matchingOrders.length - 5} pedido(s)...`;
      }

      if (settings.alertPendingPayment) {
        const withPendingVal = matchingOrders.filter(o => (o.totalValue || 0) > 0);
        if (withPendingVal.length > 0) {
          const totalVal = withPendingVal.reduce((s, o) => s + (o.totalValue || 0), 0);
          bodyMsg += `\n💰 Valor total: R$ ${totalVal.toFixed(2).replace('.', ',')}`;
        }
      }

      const title = dayOffset === 0
        ? 'Confeitex - Entregas de Hoje! 🎂'
        : `Confeitex - Lembrete: Entregas ${dayLabels[dayOffset] || 'em breve'} 🎂`;

      new Notification(title, {
        body: bodyMsg,
        icon: 'icons/icon-192x192.png',
        tag: `confeitex-delivery-${dayOffset}-${targetDateStr}`
      });

      this._markNotified(cacheKey);
    });
  },

  _checkProduction(now, todayStr) {
    const cacheKey = `notif_prod_${todayStr}`;
    if (this._wasNotified(cacheKey)) return;

    const inProduction = State.orders.filter(o =>
      o.status === 'Em Produção' && o.deliveryDate === todayStr
    );

    if (inProduction.length === 0) return;

    let bodyMsg = `Bolos em produção hoje (${inProduction.length}):\n`;
    bodyMsg += inProduction.slice(0, 5).map(o =>
      `• ${o.flavor} - ${o.clientName}${o.deliveryTime ? ' às ' + o.deliveryTime : ''}`
    ).join('\n');
    if (inProduction.length > 5) {
      bodyMsg += `\ne mais ${inProduction.length - 5} pedido(s)...`;
    }

    const totalKg = inProduction
      .filter(o => o.productType === 'Bolo de Kg')
      .reduce((s, o) => s + (o.weight || 0), 0);
    if (totalKg > 0) {
      bodyMsg += `\n⚖️ Total: ${totalKg.toFixed(2).replace('.', ',')} Kg`;
    }

    new Notification('Confeitex - Produção de Hoje 👩‍🍳', {
      body: bodyMsg,
      icon: 'icons/icon-192x192.png',
      tag: `confeitex-production-${todayStr}`
    });

    this._markNotified(cacheKey);
  }
};

