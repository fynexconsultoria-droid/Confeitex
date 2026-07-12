const DEFAULT_CATALOG = [
  { id: '1', flavor: 'Bolo Ninho com Morango', pricePerKg: 75.00, type: 'Bolo de Kg' },
  { id: '2', flavor: 'Bolo Chocolate Belga', pricePerKg: 80.00, type: 'Bolo de Kg' },
  { id: '3', flavor: 'Bolo Red Velvet', pricePerKg: 90.00, type: 'Bolo de Kg' },
  { id: '4', flavor: 'Bolo Prestígio', pricePerKg: 70.00, type: 'Bolo de Kg' },
  { id: '5', flavor: 'Cento de Brigadeiros Gourmet', pricePerKg: 120.00, type: 'Doces / Brigadeiros' },
  { id: '6', flavor: 'Cento de Salgados Fritos', pricePerKg: 100.00, type: 'Salgados' }
];

function migrateOrder(o) {
  return { paymentMethod: 'Dinheiro', cost: 0, deliveredAt: null, ...o };
}

const State = {
  orders: [],
  catalog: [],

  load() {
    try {
      const savedOrders = localStorage.getItem('fyntex_orders');
      const savedCatalog = localStorage.getItem('fyntex_catalog');
      this.orders = savedOrders ? JSON.parse(savedOrders).map(migrateOrder) : [];
      this.catalog = savedCatalog ? JSON.parse(savedCatalog) : [...DEFAULT_CATALOG];
      if (!savedCatalog) this.saveCatalog();
      const temDemo = this.orders.some(o => o.id && o.id.startsWith('o_demo_'));
      if (temDemo) {
        this.orders = this.orders.filter(o => !o.id.startsWith('o_demo_'));
        this.saveOrders();
      }
    } catch { this.catalog = [...DEFAULT_CATALOG]; }
  },

  saveOrders() { localStorage.setItem('fyntex_orders', JSON.stringify(this.orders)); },
  saveCatalog() { localStorage.setItem('fyntex_catalog', JSON.stringify(this.catalog)); },

  loadDemo(force = false) {
    if (!force && this.orders.length > 0) return;
    this.catalog = [...DEFAULT_CATALOG];
    this.saveCatalog();
    this.orders = [];
    this.saveOrders();
  }
};
