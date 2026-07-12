const Notifications = {
  _checked: false,

  init() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') this.schedule();
    else if (Notification.permission === 'default') {
      // Só pede permissão se o usuário já interagiu
      document.addEventListener('click', () => {
        if (Notification.permission === 'default') Notification.requestPermission();
      }, { once: true });
    }
  },

  schedule() {
    this.check();
    setInterval(() => this.check(), 3600000); // a cada 1h
    // Também verifica quando a aba ganhar foco
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.check();
    });
  },

  check() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const pendingToday = State.orders.filter(o => o.deliveryDate === today && (o.status === 'Pendente' || o.status === 'Em Produção'));
    const pendingTomorrow = State.orders.filter(o => o.deliveryDate === tomorrow && (o.status === 'Pendente' || o.status === 'Em Produção'));

    const sent = JSON.parse(localStorage.getItem('fyntex_notified') || '{}');

    if (pendingToday.length > 0 && !sent[today]) {
      new Notification('Fyntex - Entregas de Hoje ' + today.replace(/-/g, '/'), {
        body: `Você tem ${pendingToday.length} entrega(s) pendente(s) para hoje!\n${pendingToday.map(o => `${o.deliveryTime} - ${o.clientName}: ${o.flavor}`).join('\n')}`,
        icon: 'icons/icon-192x192.png',
        tag: 'fyntex-today'
      });
      sent[today] = true;
      localStorage.setItem('fyntex_notified', JSON.stringify(sent));
    }

    if (pendingTomorrow.length > 0 && !sent[`prev_${tomorrow}`]) {
      new Notification('Fyntex - Lembrete: Entregas de Amanhã ' + tomorrow.replace(/-/g, '/'), {
        body: `Você tem ${pendingTomorrow.length} entrega(s) agendada(s) para amanhã!\n${pendingTomorrow.map(o => `${o.deliveryTime} - ${o.clientName}: ${o.flavor}`).join('\n')}`,
        icon: 'icons/icon-192x192.png',
        tag: 'fyntex-tomorrow'
      });
      sent[`prev_${tomorrow}`] = true;
      localStorage.setItem('fyntex_notified', JSON.stringify(sent));
    }
  }
};
