const fmt = (val) => {
  const loc = (typeof I18n !== 'undefined' && I18n.locale) ? I18n.locale() : 'pt-BR';
  const cur = (typeof I18n !== 'undefined' && I18n.currency) ? I18n.currency() : 'BRL';
  return new Intl.NumberFormat(loc, { style: 'currency', currency: cur }).format(isNaN(val) || val === null || val === undefined ? 0 : +val).replace(/\u00A0/g, ' ');
};
const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const fmtDateStr = (s) => s ? s.split('-').reverse().join('/') : '';
// Data local em formato ISO (YYYY-MM-DD) — evita o bug de toISOString() que usa UTC
// e retorna o dia errado à noite em fusos negativos (ex.: Brasil, UTC-3).
const fmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
var safeStorage = {
  get(key) {
    try {
      const target = typeof localStorage !== 'undefined' ? localStorage : null;
      return target ? target.getItem(key) : null;
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      const target = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!target) return false;
      target.setItem(key, String(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  remove(key) {
    try {
      const target = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!target) return false;
      target.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  },
  sessionGet(key) {
    try {
      const target = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      return target ? target.getItem(key) : null;
    } catch (e) {
      return null;
    }
  },
  sessionSet(key, value) {
    try {
      const target = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      if (!target) return false;
      target.setItem(key, String(value));
      return true;
    } catch (e) {
      return false;
    }
  },
  sessionRemove(key) {
    try {
      const target = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
      if (!target) return false;
      target.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  }
};
const debounce = (fn, ms = 250) => {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
};
const escapeHTML = (s) => s ? String(s).replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t])) : '';

function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  const str = String(value)
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\b(?:on\w+|src|href|action)\s*=\s*(?:['\"])?[^\s>]+/gi, ' ')
    .replace(/javascript\s*:/gi, ' ')
    .replace(/data\s*:\s*(?:image|text|application)/gi, ' ')
    .replace(/alert\s*\(/gi, ' ')
    .replace(/[<>]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return str;
}

function sanitizeForStorage(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(item => sanitizeForStorage(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== '__proto__' && key !== 'constructor').map(([key, item]) => [key, sanitizeForStorage(item)])
    );
  }
  if (typeof value === 'string') {
    const cleaned = sanitizeText(value);
    const numeric = cleaned.trim();
    // Preserva IDs, telefones (>=10 dígitos) e códigos com zero à esquerda como string
    const preserveString = /^[a-zA-Z_]/.test(numeric) || /^\d{10,}$/.test(numeric) || /^0\d+$/.test(numeric);
    if (preserveString) return cleaned;
    if (/^-?\d+(?:[.,]\d+)?$/.test(numeric) || /^-?\d*\.\d+$/.test(numeric) || /^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(numeric)) {
      let normalized = numeric;
      if (numeric.includes(',') && numeric.includes('.')) {
        normalized = numeric.replace(/\./g, '').replace(',', '.');
      } else if (numeric.includes(',')) {
        normalized = numeric.replace(',', '.');
      }
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : cleaned;
    }
    return cleaned;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  return String(value);
}

function parseNumericValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validateStateDump(data) {
  const candidate = data && typeof data === 'object' ? sanitizeForStorage(data) : {};
  const safe = { orders: [], catalog: [], expenses: [], trash: [] };
  const normalizeList = (list, mapper) => Array.isArray(list) ? list.map(item => mapper(item)).filter(Boolean) : [];

  safe.orders = normalizeList(candidate.orders, (item) => {
    if (!item || typeof item !== 'object') return null;
    const order = { ...item };
    order.id = sanitizeText(order.id || `o_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    order.clientName = sanitizeText(order.clientName || 'Cliente');
    order.flavor = sanitizeText(order.flavor || '');
    order.productType = sanitizeText(order.productType || 'Bolo de Kg');
    order.status = sanitizeText(order.status || 'Pendente');
    order.deliveryDate = sanitizeText(order.deliveryDate || fmtISO(new Date()));
    order.deliveryTime = sanitizeText(order.deliveryTime || '08:00');
    order.paymentMethod = sanitizeText(order.paymentMethod || 'Dinheiro');
    order.deliveryType = sanitizeText(order.deliveryType || 'Retirada no Local');
    order.notes = sanitizeText(order.notes || '');
    order.details = sanitizeText(order.details || '');
    order.clientPhone = sanitizeText(order.clientPhone || '');
    order.weight = parseNumericValue(order.weight, 0);
    order.unitPrice = parseNumericValue(order.unitPrice, 0);
    order.extraCharges = parseNumericValue(order.extraCharges, 0);
    order.cost = parseNumericValue(order.cost, 0);
    order.totalValue = parseNumericValue(order.totalValue, 0);
    return order;
  });

  safe.catalog = normalizeList(candidate.catalog, (item) => {
    if (!item || typeof item !== 'object') return null;
    const entry = { ...item };
    entry.id = sanitizeText(entry.id || `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    entry.flavor = sanitizeText(entry.flavor || '');
    entry.type = sanitizeText(entry.type || 'Bolo de Kg');
    entry.pricePerKg = parseNumericValue(entry.pricePerKg, 0);
    return entry;
  });

  safe.expenses = normalizeList(candidate.expenses, (item) => {
    if (!item || typeof item !== 'object') return null;
    const entry = { ...item };
    entry.id = sanitizeText(entry.id || `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    entry.description = sanitizeText(entry.description || '');
    entry.date = sanitizeText(entry.date || fmtISO(new Date()));
    entry.amount = parseNumericValue(entry.amount, 0);
    return entry;
  });

  safe.trash = normalizeList(candidate.trash, (item) => {
    if (!item || typeof item !== 'object') return null;
    const entry = { ...item };
    entry.id = sanitizeText(entry.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    entry.type = sanitizeText(entry.type || 'order');
    entry.label = sanitizeText(entry.label || '');
    entry.orders = normalizeList(entry.orders, order => sanitizeForStorage(order));
    entry.count = Number(parseInt(String(entry.count ?? entry.orders.length), 10) || 0);
    return entry;
  });

  return safe;
}

function getOrderTotal(o) {
  if (!o) return 0;
  const compute = () => {
    const w = parseNumericValue(typeof o.weight === 'number' ? o.weight : (o.weight || 0), 0);
    const p = parseNumericValue(typeof o.unitPrice === 'number' ? o.unitPrice : (o.unitPrice || 0), 0);
    const e = parseNumericValue(typeof o.extraCharges === 'number' ? o.extraCharges : (o.extraCharges || 0), 0);
    return +(w * p + e);
  };
  const val = o.totalValue;
  if (val === undefined || val === null || val === '' || val === 0) return compute();
  if (typeof val === 'string') {
    const parsed = parseNumericValue(val.replace(/[^\d.,-]/g, ''), 0);
    return Number.isFinite(parsed) ? +parsed : compute();
  }
  return Number.isFinite(+val) ? +val : compute();
}

function maskPhone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
  else if (v.length > 0) v = `(${v}`;
  input.value = v;
}

function badgeClass(status) {
  return { 'Pendente': 'badge-pending', 'Em Produção': 'badge-progress', 'Entregue': 'badge-success', 'Cancelado': 'badge-danger' }[status] || 'badge-pending';
}

function formatWeight(o) {
  const w = o.weight || 0;
  if (o.productType === 'Bolo de Kg') return `${w.toFixed(2).replace('.', ',')} Kg`;
  const isInt = Number.isInteger(w) || w === Math.floor(w);
  return isInt ? `${Math.round(w)} un` : `${w.toFixed(2).replace('.', ',')} un`;
}
