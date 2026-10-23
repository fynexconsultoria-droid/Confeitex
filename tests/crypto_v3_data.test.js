import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CryptoUtils, AppDB, sanitizeForStorage, validateStateDump } from '../js/utils.js';
import { Auth } from '../js/auth.js';
import { State } from '../js/state.js';
import { Notifications } from '../js/notifications.js';

describe('Phase 4 - Data Security, Cryptography & PBKDF2 v3', () => {

  describe('4.1 & 4.8 Data Sanitization & Type Preservation', () => {
    it('should NOT convert numeric strings like phone numbers, formatted currencies or codes into numbers', () => {
      const input = {
        clientName: 'Maria Silva',
        clientPhone: '(11) 98765-4321',
        postalCode: '01310-100',
        leadingZeroCode: '007',
        formattedThousands: '1.000',
        commaDecimal: '10,5',
        realNumber: 125.50,
        integerNumber: 42,
        booleanValue: true,
        items: [
          { code: '00123', priceStr: '15,00', priceNum: 15.00 }
        ]
      };

      const sanitized = sanitizeForStorage(input);

      expect(typeof sanitized.clientPhone).toBe('string');
      expect(sanitized.clientPhone).toBe('(11) 98765-4321');

      expect(typeof sanitized.postalCode).toBe('string');
      expect(sanitized.postalCode).toBe('01310-100');

      expect(typeof sanitized.leadingZeroCode).toBe('string');
      expect(sanitized.leadingZeroCode).toBe('007');

      expect(typeof sanitized.formattedThousands).toBe('string');
      expect(sanitized.formattedThousands).toBe('1.000');

      expect(typeof sanitized.commaDecimal).toBe('string');
      expect(sanitized.commaDecimal).toBe('10,5');

      expect(typeof sanitized.realNumber).toBe('number');
      expect(sanitized.realNumber).toBe(125.50);

      expect(typeof sanitized.integerNumber).toBe('number');
      expect(sanitized.integerNumber).toBe(42);

      expect(typeof sanitized.items[0].code).toBe('string');
      expect(sanitized.items[0].code).toBe('00123');
    });

    it('validateStateDump should preserve paymentsConfig and validate dump integrity', () => {
      const dump = {
        orders: [
          { clientName: 'Ana', flavor: 'Chocolate', totalValue: 120 }
        ],
        catalog: [
          { name: 'Bolo Cenoura', basePrice: 80 }
        ],
        expenses: [],
        paymentsConfig: {
          pixKey: 'confeiteira@pix.com',
          pixName: 'Ana Bolos',
          pixCity: 'Sao Paulo',
          bankInfo: 'Banco Inter Ag 0001 CC 12345-6',
          paymentLink: 'https://pag.me/exemplo',
          instructions: 'Envie comprovante'
        }
      };

      const validated = validateStateDump(dump);
      expect(validated.orders).toHaveLength(1);
      expect(validated.catalog).toHaveLength(1);
      expect(validated.paymentsConfig).toBeDefined();
      expect(validated.paymentsConfig.pixKey).toBe('confeiteira@pix.com');
      expect(validated.paymentsConfig.bankInfo).toBe('Banco Inter Ag 0001 CC 12345-6');
    });
  });

  describe('4.3 Large Payload Chunked Encryption (No Stack Overflow)', () => {
    it('should encrypt and decrypt payloads > 100 KB without Maximum call stack size exceeded', async () => {
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );

      // Create a payload larger than 120 KB
      const largeString = 'A'.repeat(128 * 1024);
      const data = JSON.stringify({ payload: largeString });

      // Encrypting this previously failed when spreading Uint8Array into String.fromCharCode
      const encrypted = await CryptoUtils.encrypt(data, key);
      expect(encrypted).toBeDefined();
      expect(encrypted.ciphertext.length).toBeGreaterThan(100000);

      const decrypted = await CryptoUtils.decrypt(encrypted, key);
      expect(decrypted).toBe(data);
      expect(JSON.parse(decrypted).payload.length).toBe(128 * 1024);
    });
  });

  describe('4.7 PBKDF2 v3 (OWASP 600,000 iterations) & Automatic Migration', () => {
    let mockStore = {};

    beforeEach(() => {
      mockStore = {};
      globalThis.localStorage = {
        getItem: (k) => (k in mockStore ? mockStore[k] : null),
        setItem: (k, v) => { mockStore[k] = String(v); },
        removeItem: (k) => { delete mockStore[k]; },
        clear: () => { mockStore = {}; }
      };
      Auth.encryptionKey = null;
      Auth.lockEnabled = false;
      Auth.lockHash = '';
    });

    it('should reject passwords shorter than 8 characters', async () => {
      await expect(Auth.setPassword('1234567')).rejects.toThrow('A senha deve ter no mínimo 8 caracteres');
    });

    it('should generate v3 format with 600,000 iterations', async () => {
      await Auth.setPassword('senhaForte123');
      expect(Auth.lockHash.startsWith('v3:')).toBe(true);

      const parts = Auth.lockHash.split(':');
      expect(parts).toHaveLength(3); // 'v3', saltHex, hashHex
      expect(parts[0]).toBe('v3');
      expect(parts[1].length).toBe(32); // 16 bytes salt em hex
      expect(parts[2].length).toBe(64); // 32 bytes hash SHA-256 em hex
      expect(Auth.encryptionKey).toBeDefined();
    });

    it('should verify and auto-upgrade legacy v2 hash to v3', async () => {
      // Simulate an existing v2 hash (100k iterations)
      const saltHex = '0123456789abcdef0123456789abcdef';
      const v2Keys = await CryptoUtils.deriveKeys('senhaLegada123', saltHex, 100000);
      const legacyV2Hash = `v2:${saltHex}:${v2Keys.hashHex}`;

      Auth.lockHash = legacyV2Hash;
      Auth.lockEnabled = true;

      // Verification should succeed
      const isValid = await Auth.verify('senhaLegada123');
      expect(isValid).toBe(true);

      // Aguarda migração em background terminar (600k iterações levam ~800ms)
      for (let i = 0; i < 35; i++) {
        if (Auth.lockHash.startsWith('v3:')) break;
        await new Promise(r => setTimeout(r, 100));
      }

      // Verify that the hash has been migrated to v3
      expect(Auth.lockHash.startsWith('v3:')).toBe(true);
      expect(mockStore['confeitex_lock_hash'].startsWith('v3:')).toBe(true);
      expect(Auth.encryptionKey).toBeDefined();
    });
  });

  describe('4.4 & 4.5 Atomic State Storage & Snapshot', () => {
    let memoryDB = {};
    let origGet, origSet, origRemove;

    beforeEach(() => {
      memoryDB = {};
      origGet = AppDB.get;
      origSet = AppDB.set;
      origRemove = AppDB.remove;

      AppDB.get = vi.fn(async (key) => memoryDB[key] || null);
      AppDB.set = vi.fn(async (key, val) => { memoryDB[key] = val; return true; });
      AppDB.remove = vi.fn(async () => true);

      Auth.encryptionKey = null;
    });

    afterEach(() => {
      AppDB.get = origGet;
      AppDB.set = origSet;
      AppDB.remove = origRemove;
    });

    it('should save atomic envelope {_enc, payload} in _flushDB', async () => {
      Auth.encryptionKey = null; // Unencrypted mode
      const testData = [{ id: '1', clientName: 'Bolo' }];

      State._scheduleSave('orders', testData);
      await State._flushDB();

      expect(AppDB.set).toHaveBeenCalled();
      const savedRecord = memoryDB['orders'];
      expect(savedRecord).toBeDefined();
      expect(savedRecord._enc).toBe(false);
      expect(JSON.parse(savedRecord.payload)).toEqual(testData);
    });

    it('should handle both enveloped and legacy raw arrays in _loadItem', async () => {
      Auth.encryptionKey = null;

      // Case 1: Atomic envelope
      memoryDB['orders'] = { _enc: false, payload: [{ id: '10', clientName: 'Envelope' }] };
      const loaded1 = await State._loadItem('orders', []);
      expect(loaded1).toHaveLength(1);
      expect(loaded1[0].clientName).toBe('Envelope');

      // Case 2: Legacy raw array
      memoryDB['catalog'] = [{ id: '20', name: 'Legacy' }];
      const loaded2 = await State._loadItem('catalog', []);
      expect(loaded2).toHaveLength(1);
      expect(loaded2[0].name).toBe('Legacy');
    });
  });

  describe('4.2 Sensitive Data Privacy in Background Notifications', () => {
    let originalIdbSet;

    beforeEach(() => {
      originalIdbSet = Notifications._idbSet;
      Notifications._ensureSW = async () => null;
      Notifications.registerAll = async () => {};
    });

    afterEach(() => {
      Notifications._idbSet = originalIdbSet;
      vi.useRealTimers();
    });

    it('should mask client names and order details when Auth lock is enabled', async () => {
      vi.useFakeTimers();

      Auth.lockEnabled = true;
      Auth.lockHash = 'v3:salt:hash';
      expect(Auth.hasPassword()).toBe(true);

      State.orders = [
        {
          id: 'ord_1',
          clientName: 'Juliana Paes',
          productType: 'Bolo de Casamento 3 Andares',
          flavor: 'Ninho com Nutella',
          deliveryDate: '2026-10-30',
          deliveryTime: '15:00',
          status: 'Pendente',
          totalValue: 550.00
        }
      ];

      let savedSnapshot = null;
      Notifications._idbSet = vi.fn(async (key, val) => {
        if (key === 'confeitex_snapshot') savedSnapshot = val;
      });

      Notifications._enabled = true;
      Notifications.syncData();
      vi.advanceTimersByTime(1000);

      expect(Notifications._idbSet).toHaveBeenCalled();
      expect(savedSnapshot).toBeDefined();
      expect(savedSnapshot.orders).toHaveLength(1);

      const snapshotItem = savedSnapshot.orders[0];
      // Sensitive details must be generic to prevent leakage on lockscreen/SW inspect
      expect(snapshotItem.clientName).toBe('Cliente');
      expect(snapshotItem.flavor).toBe('Encomenda');
      expect(snapshotItem.totalValue).toBe(550.00);
      expect(snapshotItem.deliveryDate).toBe('2026-10-30');
    });

    it('should preserve original client names in snapshot when Auth lock is NOT enabled', async () => {
      vi.useFakeTimers();

      Auth.lockEnabled = false;
      Auth.lockHash = '';
      expect(Auth.hasPassword()).toBe(false);

      State.orders = [
        {
          id: 'ord_2',
          clientName: 'Carla Silva',
          productType: 'Cupcake',
          flavor: 'Baunilha',
          deliveryDate: '2026-10-30',
          status: 'Pendente'
        }
      ];

      let savedSnapshot = null;
      Notifications._idbSet = vi.fn(async (key, val) => {
        if (key === 'confeitex_snapshot') savedSnapshot = val;
      });

      Notifications._enabled = true;
      Notifications.syncData();
      vi.advanceTimersByTime(1000);

      expect(savedSnapshot).toBeDefined();
      expect(savedSnapshot.orders).toHaveLength(1);
      expect(savedSnapshot.orders[0].clientName).toBe('Carla Silva');
      expect(savedSnapshot.orders[0].flavor).toBe('Baunilha');
    });
  });
});
