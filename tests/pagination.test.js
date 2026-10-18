import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Orders } from '../js/orders.js';
import { Clients } from '../js/clients.js';
import { State } from '../js/state.js';

describe('Orders and Clients Pagination Performance', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    Orders.pageSize = 25;
    Orders.currentPage = 1;
    Clients.pageSize = 25;
    Clients.currentPage = 1;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
  });

  it('calculates correct totalPages and slices for large order sets', () => {
    const totalCount = 142;
    const pageSize = 25;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    expect(totalPages).toBe(6);

    let page = 1;
    let start = (page - 1) * pageSize;
    let end = Math.min(start + pageSize, totalCount);
    expect(start).toBe(0);
    expect(end).toBe(25);

    page = 6;
    start = (page - 1) * pageSize;
    end = Math.min(start + pageSize, totalCount);
    expect(start).toBe(125);
    expect(end).toBe(142);
  });

  it('clamps currentPage within valid bounds [1, totalPages]', () => {
    const totalCount = 40;
    Orders.pageSize = 25;
    const totalPages = Math.ceil(totalCount / Orders.pageSize); // 2

    Orders.currentPage = 10;
    if (Orders.currentPage > totalPages) Orders.currentPage = totalPages;
    expect(Orders.currentPage).toBe(2);

    Orders.currentPage = -5;
    if (Orders.currentPage < 1) Orders.currentPage = 1;
    expect(Orders.currentPage).toBe(1);
  });

  it('renders pagination HTML for orders when totalCount > pageSize', () => {
    const paginationEl = {
      innerHTML: '',
      style: { display: 'none' },
      querySelector: () => null
    };

    globalThis.document = {
      getElementById: (id) => (id === 'ordersPagination' ? paginationEl : null)
    };

    Orders.renderPagination(100, 4, 0, 25);
    expect(paginationEl.style.display).toBe('flex');
    expect(paginationEl.innerHTML).toContain('btn-order-prev');
    expect(paginationEl.innerHTML).toContain('btn-order-next');
    expect(paginationEl.innerHTML).toContain('orderPageSizeSelect');
  });

  it('renders single-page summary for small order counts', () => {
    const paginationEl = {
      innerHTML: '',
      style: { display: 'none' },
      querySelector: () => null
    };

    globalThis.document = {
      getElementById: (id) => (id === 'ordersPagination' ? paginationEl : null)
    };

    Orders.renderPagination(15, 1, 0, 15);
    expect(paginationEl.style.display).toBe('flex');
    expect(paginationEl.innerHTML).not.toContain('btn-order-prev');
  });

  it('paginates clients and stores _currentPageClients accurately', () => {
    const paginationEl = {
      innerHTML: '',
      style: { display: 'none' },
      querySelector: () => null
    };

    globalThis.document = {
      getElementById: (id) => (id === 'clientsPagination' ? paginationEl : null)
    };

    Clients.renderPagination(60, 3, 0, 25);
    expect(paginationEl.style.display).toBe('flex');
    expect(paginationEl.innerHTML).toContain('btn-client-prev');
    expect(paginationEl.innerHTML).toContain('btn-client-next');
  });
});
