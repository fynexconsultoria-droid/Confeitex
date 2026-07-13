const Notifications = {
  _started: false,
  _intervalId: null,
  _enabled: false,

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
    this._intervalId = setInterval(() => {
      if (this._enabled) this.check();
    }, 3600000);
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

  check() {
    if (!this._enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const pendingToday = State.orders.filter(o => o.deliveryDate === today && (o.status === 'Pendente' || o.status === 'Em Produção'));
    const pendingTomorrow = State.orders.filter(o => o.deliveryDate === tomorrow && (o.status === 'Pendente' || o.status === 'Em Produção'));

    const sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}');

    if (pendingToday.length > 0 && !sent[today]) {
      new Notification('Confeitex - Entregas de Hoje', {
        body: `${pendingToday.length} entrega(s) pendente(s) hoje!\n${pendingToday.map(o => `${o.deliveryTime} ${o.clientName}: ${o.flavor}`).join('\n')}`,
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-today'
      });
      sent[today] = true;
      localStorage.setItem('confeitex_notified', JSON.stringify(sent));
    }

    if (pendingTomorrow.length > 0 && !sent[`prev_${tomorrow}`]) {
      new Notification('Confeitex - Lembrete: Amanhã', {
        body: `${pendingTomorrow.length} entrega(s) amanhã!\n${pendingTomorrow.map(o => `${o.deliveryTime} ${o.clientName}: ${o.flavor}`).join('\n')}`,
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-tomorrow'
      });
      sent[`prev_${tomorrow}`] = true;
      localStorage.setItem('confeitex_notified', JSON.stringify(sent));
    }
  }
};
