const Notifications = {
  check() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const todayStr = new Date().toISOString().split('T')[0];
    const deliveries = State.orders.filter(o => o.deliveryDate === todayStr && (o.status === 'Pendente' || o.status === 'Em Produção'));
    if (deliveries.length > 0) {
      new Notification('Fyntex - Entregas de Hoje', {
        body: `Você tem ${deliveries.length} entrega(s) programada(s) para hoje.`,
        icon: 'icons/icon-192x192.png'
      });
    }
  }
};
