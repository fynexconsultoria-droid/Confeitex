const DEFAULT_CATALOG = [
  { id: '1', flavor: 'Bolo Ninho com Morango', pricePerKg: 75.00, type: 'Bolo de Kg' },
  { id: '2', flavor: 'Bolo Chocolate Belga', pricePerKg: 80.00, type: 'Bolo de Kg' },
  { id: '3', flavor: 'Bolo Red Velvet', pricePerKg: 90.00, type: 'Bolo de Kg' },
  { id: '4', flavor: 'Bolo Prestígio', pricePerKg: 70.00, type: 'Bolo de Kg' },
  { id: '5', flavor: 'Cento de Brigadeiros Gourmet', pricePerKg: 120.00, type: 'Doces / Brigadeiros' },
  { id: '6', flavor: 'Cento de Salgados Fritos', pricePerKg: 100.00, type: 'Salgados' }
];

function migrateOrder(o) {
  const order = { paymentMethod: 'Dinheiro', cost: 0, deliveredAt: null, totalValue: 0, deliveryType: 'Retirada no Local', ...o };
  order.totalValue = getOrderTotal(order);
  if (order.status === 'Entregue' && !order.deliveredAt) {
    order.deliveredAt = new Date().toISOString();
  }
  return order;
}

const State = {
  orders: [],
  catalog: [],
  trash: [],
  TRASH_RETENTION_DAYS: 7,

  load() {
    try {
      const savedOrders = localStorage.getItem('confeitex_orders');
      const savedCatalog = localStorage.getItem('confeitex_catalog');
      this.orders = savedOrders ? JSON.parse(savedOrders).map(migrateOrder) : [];
      this.catalog = savedCatalog ? JSON.parse(savedCatalog) : [...DEFAULT_CATALOG];
      if (!savedCatalog) this.saveCatalog();
    } catch (e) {
      this.orders = [];
      this.catalog = [...DEFAULT_CATALOG];
      const _warn = console.warn.bind(console); _warn('[Confeitex] Erro ao carregar dados:', e);
    }
    try {
      const savedTrash = localStorage.getItem('confeitex_trash');
      this.trash = savedTrash ? JSON.parse(savedTrash) : [];
    } catch (e) {
      this.trash = [];
    }
    this.purgeTrash();
  },

  saveOrders() {
    localStorage.setItem('confeitex_orders', JSON.stringify(this.orders));
    if (typeof Notifications !== 'undefined' && Notifications.syncData) Notifications.syncData();
  },
  saveCatalog() { localStorage.setItem('confeitex_catalog', JSON.stringify(this.catalog)); },
  saveTrash() { localStorage.setItem('confeitex_trash', JSON.stringify(this.trash)); },

  addToTrash(orders, type, label) {
    const now = new Date();
    const expires = new Date(now.getTime() + this.TRASH_RETENTION_DAYS * 86400000);
    this.trash.push({
      id: 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type,
      label,
      orders,
      count: orders.length,
      deletedAt: now.toISOString(),
      expiresAt: expires.toISOString()
    });
    this.saveTrash();
  },

  purgeTrash() {
    const now = Date.now();
    const before = this.trash.length;
    this.trash = this.trash.filter(t => !t.expiresAt || new Date(t.expiresAt).getTime() > now);
    if (this.trash.length !== before) this.saveTrash();
  },

  restoreFromTrash(id) {
    const entry = this.trash.find(t => t.id === id);
    if (!entry) return false;
    entry.orders.forEach(o => this.orders.push(o));
    this.trash = this.trash.filter(t => t.id !== id);
    this.saveOrders();
    this.saveTrash();
    return true;
  },

  emptyTrash() {
    this.trash = [];
    this.saveTrash();
  },

  loadDemo(force = false) {
    if (!force && this.orders.length > 0) return;
    this.catalog = [...DEFAULT_CATALOG];
    this.saveCatalog();
    const nomes = ['Maria Oliveira', 'João Silva', 'Ana Costa', 'Carlos Santos', 'Fernanda Lima'];
    const sabores = ['Bolo Ninho com Morango', 'Bolo Chocolate Belga', 'Bolo Red Velvet', 'Bolo Prestígio'];
    const hoje = new Date();
    this.orders = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() - Math.floor(Math.random() * 15));
      const peso = +(1 + Math.random() * 4).toFixed(2);
      const precoKg = 60 + Math.floor(Math.random() * 30);
      const statusList = ['Pendente', 'Em Produção', 'Entregue'];
      const cliente = nomes[Math.floor(Math.random() * nomes.length)];
      this.orders.push({
        id: 'o_demo_' + Date.now() + '_' + i,
        clientName: cliente,
        clientPhone: `(11) 9${String(Math.floor(7000 + Math.random() * 3000)).padStart(4, '0')}-${String(Math.floor(1000 + Math.random() * 9000)).padStart(4, '0')}`,
        productType: 'Bolo de Kg',
        flavor: sabores[Math.floor(Math.random() * sabores.length)],
        details: '',
        weight: peso,
        unitPrice: precoKg,
        extraCharges: 0,
        cost: +(precoKg * peso * 0.4).toFixed(2),
        deliveryDate: d.toISOString().split('T')[0],
        deliveryTime: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, '0')}:00`,
        status: statusList[Math.floor(Math.random() * statusList.length)],
        notes: '',
        paymentMethod: ['Dinheiro', 'Pix', 'Cartão de Crédito'][Math.floor(Math.random() * 3)],
        deliveryType: Math.random() > 0.5 ? 'Retirada no Local' : 'Entrega',
        totalValue: +(peso * precoKg).toFixed(2),
        createdAt: d.toISOString(),
        deliveredAt: null
      });
    }
    this.saveOrders();
  }
};
