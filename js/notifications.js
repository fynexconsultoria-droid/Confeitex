const Notifications = {
  _started: false,

  init() {
    if (this._started || !('Notification' in window)) return;
    this._started = true;

    if (Notification.permission === 'granted') {
      this.check();
    } else if (Notification.permission === 'default') {
      document.addEventListener('click', () => {
        if (Notification.permission === 'default') Notification.requestPermission();
      }, { once: true });
    }

    setInterval(() => {
      if (Notification.permission === 'granted') this.check();
    }, 3600000);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Notification.permission === 'granted') this.check();
    });
  },

  check() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
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
