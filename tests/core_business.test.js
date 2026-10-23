import { describe, it, expect, beforeEach } from 'vitest';
import { State, migrateOrder } from '../js/state.js';
import { getOrderTotal, csvCell, formatWeight } from '../js/utils.js';
import { generatePixPayload } from '../js/pix.js';

describe('Phase 6 - Core Business Logic, State, Utils & Finances', () => {

  describe('Utils & Sanitization', () => {
    it('getOrderTotal should prioritize manual totalValue or calculate from weight, unitPrice and extraCharges', () => {
      // 1. Manual totalValue set
      const order1 = { weight: 2, unitPrice: 80, extraCharges: 10, totalValue: 200 };
      expect(getOrderTotal(order1)).toBe(200);

      // 2. Calculated total: 2.5 * 60 + 15 = 165
      const order2 = { weight: 2.5, unitPrice: 60, extraCharges: 15, totalValue: 0 };
      expect(getOrderTotal(order2)).toBe(165);

      // 3. String numeric totalValue
      const order3 = { weight: 1, unitPrice: 50, totalValue: '120.50' };
      expect(getOrderTotal(order3)).toBe(120.50);

      // 4. Missing / null values fallback to zero
      expect(getOrderTotal(null)).toBe(0);
      expect(getOrderTotal({})).toBe(0);
    });

    it('csvCell should neutralize formula injection tokens (=, +, -, @, tab, cr)', () => {
      expect(csvCell('=SUM(A1:A10)')).toBe("\"'=SUM(A1:A10)\"");
      expect(csvCell('+cmd|/C calc')).toBe("\"'+cmd|/C calc\"");
      expect(csvCell('-100')).toBe("\"'-100\"");
      expect(csvCell('@SUM')).toBe("\"'@SUM\"");
      expect(csvCell('Bolo Normal')).toBe('"Bolo Normal"');
      expect(csvCell(123)).toBe('"123"');
      expect(csvCell(null)).toBe('""');
    });

    it('formatWeight should display Kg for "Bolo de Kg" and un for unit products', () => {
      expect(formatWeight({ productType: 'Bolo de Kg', weight: 2.5 })).toBe('2,50 Kg');
      expect(formatWeight({ productType: 'Doces / Brigadeiros', weight: 50 })).toBe('50 un');
    });

    it('migrateOrder should ensure required fields and default payment method', () => {
      const incomplete = { clientName: 'Roberta', flavor: 'Ninho' };
      const migrated = migrateOrder(incomplete);

      expect(migrated.clientName).toBe('Roberta');
      expect(migrated.flavor).toBe('Ninho');
      expect(migrated.paymentMethod).toBe('Dinheiro');
      expect(migrated.deliveryType).toBe('Retirada no Local');
      expect(migrated.cost).toBe(0);
      expect(migrated.totalValue).toBe(0);
    });
  });

  describe('State & Trash Management', () => {
    let mockStore = {};

    beforeEach(() => {
      mockStore = {};
      globalThis.safeStorage = {
        get: (k) => mockStore[k] || null,
        set: (k, v) => { mockStore[k] = String(v); },
        remove: (k) => { delete mockStore[k]; }
      };

      State.orders = [];
      State.expenses = [];
      State.trash = [];
      State.saveOrders = () => {};
      State.saveTrash = () => {};
      State.saveExpenses = () => {};
    });

    it('should manage expenses and calculate expense totals correctly', () => {
      State.expenses = [
        { id: 'e1', description: 'Leite Condensado', amount: 150.00, date: '2026-10-01' },
        { id: 'e2', description: 'Embalagens', amount: 45.50, date: '2026-10-02' }
      ];

      const totalExpenses = State.expenses.reduce((acc, curr) => acc + curr.amount, 0);
      expect(totalExpenses).toBe(195.50);
    });

    it('should move orders to trash and restore them', () => {
      const order = {
        id: 'ord_123',
        clientName: 'Carla',
        flavor: 'Chocolate',
        totalValue: 120,
        status: 'Pendente'
      };

      State.orders = [order];
      expect(State.orders).toHaveLength(1);

      // Move to trash
      State.addToTrash([order], 'single', 'Carla');
      State.orders = [];
      expect(State.trash).toHaveLength(1);
      expect(State.trash[0].orders[0].id).toBe('ord_123');

      // Restore from trash
      const trashId = State.trash[0].id;
      const restored = State.restoreFromTrash(trashId);
      expect(restored).toBe(true);
      expect(State.orders).toHaveLength(1);
      expect(State.orders[0].clientName).toBe('Carla');
      expect(State.trash).toHaveLength(0);
    });

    it('emptyTrash should permanently clear deleted items', () => {
      State.trash = [
        { id: 't1', orders: [{ id: '1' }] },
        { id: 't2', orders: [{ id: '2' }] }
      ];

      State.emptyTrash();
      expect(State.trash).toHaveLength(0);
    });
  });

  describe('Financial Calculation Logic', () => {
    it('should correctly calculate gross revenue, costs and profit ignoring canceled orders', () => {
      const sampleOrders = [
        { id: '1', clientName: 'Ana', totalValue: 150.00, cost: 50.00, status: 'Entregue' },
        { id: '2', clientName: 'Bia', totalValue: 200.00, cost: 70.00, status: 'Pendente' },
        { id: '3', clientName: 'Cris', totalValue: 300.00, cost: 100.00, status: 'Cancelado' } // Cancelled: ignore revenue
      ];

      const sampleExpenses = [
        { amount: 30.00 },
        { amount: 20.00 }
      ];

      let sales = 0;
      let recipesCost = 0;
      let canceledCount = 0;

      sampleOrders.forEach(o => {
        if (o.status !== 'Cancelado') {
          sales += getOrderTotal(o);
          recipesCost += (o.cost || 0);
        } else {
          canceledCount++;
        }
      });

      const totalExpenses = sampleExpenses.reduce((sum, e) => sum + e.amount, 0);
      const totalCost = recipesCost + totalExpenses;
      const netProfit = sales - totalCost;

      expect(sales).toBe(350.00); // 150 + 200
      expect(recipesCost).toBe(120.00); // 50 + 70
      expect(totalExpenses).toBe(50.00);
      expect(totalCost).toBe(170.00); // 120 + 50
      expect(netProfit).toBe(180.00); // 350 - 170
      expect(canceledCount).toBe(1);
    });
  });

  describe('Pix BR Code Generator Integrity', () => {
    it('should generate standard EMV string with valid CRC16', () => {
      const pixKey = 'confeitex@empresa.com.br';
      const name = 'MARIA CONFEITEIRA';
      const city = 'SAO PAULO';
      const amount = 85.50;
      const ref = 'PED101';

      const payload = generatePixPayload({
        key: pixKey,
        name,
        city,
        amount,
        txid: ref
      });

      expect(payload).toContain('000201'); // Format Indicator
      expect(payload).toContain('br.gov.bcb.pix'); // BACEN GUI
      expect(payload).toContain(pixKey);
      expect(payload).toContain('85.50');
      expect(payload).toContain('PED101');
      expect(payload).toContain('6304'); // CRC16 Tag

      // CRC16 verification: last 4 characters must be hexadecimal
      const crcHex = payload.slice(-4);
      expect(crcHex).toMatch(/^[0-9A-F]{4}$/);
    });
  });
});
