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
    } catch { this.catalog = [...DEFAULT_CATALOG]; }
  },

  saveOrders() { localStorage.setItem('fyntex_orders', JSON.stringify(this.orders)); },
  saveCatalog() { localStorage.setItem('fyntex_catalog', JSON.stringify(this.catalog)); },

  loadDemo(force = false) {
    if (!force && this.orders.length > 0) return;
    const names = ['Ana Costa', 'Carlos Silva', 'Beatriz Lima', 'Daniel Souza', 'Mariana Santos'];
    const phones = ['(11) 98888-7777', '(11) 97777-6666', '(21) 96666-5555', '(31) 95555-4444', '(11) 94444-3333'];
    const flavors = [
      { name: 'Bolo Ninho com Morango', price: 75.00, type: 'Bolo de Kg', w: 2.0 },
      { name: 'Bolo Chocolate Belga', price: 80.00, type: 'Bolo de Kg', w: 1.5 },
      { name: 'Bolo Red Velvet', price: 90.00, type: 'Bolo de Kg', w: 1.8 },
      { name: 'Cento de Brigadeiros Gourmet', price: 120.00, type: 'Doces / Brigadeiros', w: 1 },
      { name: 'Bolo Prestígio', price: 70.00, type: 'Bolo de Kg', w: 2.5 }
    ];
    const today = new Date();
    this.catalog = [...DEFAULT_CATALOG];
    this.saveCatalog();
    this.orders = [];
    [0, 0, -1, -2, -3, -4, -5, -7, 1, -3].forEach((offset, idx) => {
      const d = new Date(today); d.setDate(today.getDate() + offset);
      const f = flavors[idx % flavors.length];
      const extra = idx % 3 === 0 ? 15 : 0;
      this.orders.push({
        id: 'o_demo_' + idx, clientName: names[idx % names.length],
        clientPhone: phones[idx % phones.length], productType: f.type, flavor: f.name,
        details: 'Decoração simples', weight: f.w, unitPrice: f.price, extraCharges: extra,
        totalValue: f.w * f.price + extra, deliveryDate: d.toISOString().split('T')[0],
        deliveryTime: `${10 + (idx % 8)}:00`, status: offset >= 0 ? (idx % 2 ? 'Em Produção' : 'Pendente') : 'Entregue',
        notes: idx % 3 === 0 ? 'Retirada no local' : '', createdAt: d.toISOString(),
        paymentMethod: 'Dinheiro', cost: 0, deliveredAt: null
      });
    });
    this.saveOrders();
  }
};
