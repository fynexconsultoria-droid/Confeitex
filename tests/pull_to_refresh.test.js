import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PullToRefresh } from '../js/pull-to-refresh.js';

describe('PullToRefresh allowed tabs', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('should include dashboard, orders, clients, and finances in _ALLOWED_TABS', () => {
    expect(PullToRefresh._ALLOWED_TABS).toContain('dashboard');
    expect(PullToRefresh._ALLOWED_TABS).toContain('orders');
    expect(PullToRefresh._ALLOWED_TABS).toContain('clients');
    expect(PullToRefresh._ALLOWED_TABS).toContain('finances');
  });

  it('should allow reload when active tab is orders, clients, finances, or dashboard', () => {
    const tabs = ['orders', 'clients', 'finances', 'dashboard'];
    tabs.forEach(tabId => {
      globalThis.document = {
        querySelector: (selector) => {
          if (selector === '.tab-content.active') {
            return { id: tabId };
          }
          return null;
        }
      };
      expect(PullToRefresh._isTabAllowed()).toBe(true);
    });
  });

  it('should not allow reload when active tab is settings or updates', () => {
    const disallowedTabs = ['settings', 'updates', 'notificacoes', 'mercadopago', 'plano'];
    disallowedTabs.forEach(tabId => {
      globalThis.document = {
        querySelector: (selector) => {
          if (selector === '.tab-content.active') {
            return { id: tabId };
          }
          return null;
        }
      };
      expect(PullToRefresh._isTabAllowed()).toBe(false);
    });
  });

  it('should return false when no active tab exists', () => {
    globalThis.document = {
      querySelector: () => null
    };
    expect(PullToRefresh._isTabAllowed()).toBe(false);
  });
});
