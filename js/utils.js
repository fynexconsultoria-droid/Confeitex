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
    const validImage = sanitizeImageData(value);
    if (validImage) return validImage;
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

function sanitizeImageData(val) {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (trimmed.length > 1000000) return '';
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^https?:\/\/[^\s"'<>\\]+$/i.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function compressImage(file, maxWidth = 360, maxHeight = 360, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return reject(new Error('Arquivo inválido. Selecione uma imagem.'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo de imagem.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Erro ao processar dados da imagem.'));
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target.result);
          ctx.drawImage(img, 0, 0, width, height);
          const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(outType, quality);
          resolve(compressed);
        } catch (err) {
          // Fallback para o dataURL original se canvas falhar (ex: restrição do ambiente)
          resolve(e.target.result);
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function validateStateDump(data) {
  const candidate = data && typeof data === 'object' ? sanitizeForStorage(data) : {};
  const safe = { orders: [], catalog: [], expenses: [], trash: [], quotes: [], bakeryProfile: {}, userProfile: {} };
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
    const nameStr = sanitizeText(entry.flavor || entry.name || '');
    entry.flavor = nameStr;
    entry.name = nameStr;
    const typeStr = sanitizeText(entry.type || entry.category || 'Bolo de Kg');
    entry.type = typeStr;
    entry.category = typeStr;
    const priceVal = parseNumericValue(entry.pricePerKg != null ? entry.pricePerKg : (entry.salePrice != null ? entry.salePrice : entry.price), 0);
    entry.pricePerKg = priceVal;
    entry.salePrice = priceVal;
    entry.price = priceVal;
    entry.cost = parseNumericValue(entry.cost, 0);
    entry.description = sanitizeText(entry.description || '');
    entry.servingSize = sanitizeText(entry.servingSize || '');
    entry.minOrder = sanitizeText(entry.minOrder || '');
    entry.badge = sanitizeText(entry.badge || '');
    entry.recipeId = sanitizeText(entry.recipeId || '');
    entry.active = entry.active !== false;
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
    entry.count = Number(parseInt(String(entry.count != null ? entry.count : entry.orders.length), 10) || 0);
    return entry;
  });

  safe.quotes = normalizeList(candidate.quotes, (item) => {
    if (!item || typeof item !== 'object') return null;
    const q = { ...item };
    q.id = sanitizeText(q.id || `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    q.clientName = sanitizeText(q.clientName || 'Cliente');
    q.clientPhone = sanitizeText(q.clientPhone || '');
    q.productType = sanitizeText(q.productType || 'Bolo de Kg');
    q.flavor = sanitizeText(q.flavor || '');
    q.weight = parseNumericValue(q.weight, 1);
    q.unitPrice = parseNumericValue(q.unitPrice, 0);
    q.extraCharges = parseNumericValue(q.extraCharges, 0);
    q.discount = parseNumericValue(q.discount, 0);
    q.totalValue = parseNumericValue(q.totalValue, 0);
    q.eventDate = sanitizeText(q.eventDate || fmtISO(new Date()));
    q.eventTime = sanitizeText(q.eventTime || '14:00');
    q.validUntil = sanitizeText(q.validUntil || '');
    q.details = sanitizeText(q.details || '');
    q.notes = sanitizeText(q.notes || '');
    q.status = sanitizeText(q.status || 'Pendente');
    q.createdAt = sanitizeText(q.createdAt || new Date().toISOString());
    return q;
  });

  if (candidate.bakeryProfile && typeof candidate.bakeryProfile === 'object') {
    safe.bakeryProfile = {
      name: sanitizeText(candidate.bakeryProfile.name || ''),
      phone: sanitizeText(candidate.bakeryProfile.phone || ''),
      instagram: sanitizeText(candidate.bakeryProfile.instagram || ''),
      bio: sanitizeText(candidate.bakeryProfile.bio || ''),
      pix: sanitizeText(candidate.bakeryProfile.pix || ''),
      orderNotice: sanitizeText(candidate.bakeryProfile.orderNotice || ''),
      logo: sanitizeImageData(candidate.bakeryProfile.logo || ''),
    };
  } else {
    safe.bakeryProfile = { name: '', phone: '', instagram: '', bio: '', pix: '', orderNotice: '', logo: '' };
  }

  if (candidate.userProfile && typeof candidate.userProfile === 'object') {
    safe.userProfile = {
      name: sanitizeText(candidate.userProfile.name || ''),
      email: sanitizeText(candidate.userProfile.email || ''),
      phone: sanitizeText(candidate.userProfile.phone || ''),
      role: sanitizeText(candidate.userProfile.role || ''),
      goal: sanitizeText(candidate.userProfile.goal || ''),
      weeklyVolume: sanitizeText(candidate.userProfile.weeklyVolume || ''),
      avatar: sanitizeImageData(candidate.userProfile.avatar || ''),
    };
  } else {
    safe.userProfile = { name: '', email: '', phone: '', role: '', goal: '', weeklyVolume: '', avatar: '' };
  }

  return safe;
}

function getOrderTotal(o) {
  if (!o) return 0;
  const compute = () => {
    const w = parseNumericValue(typeof o.weight === 'number' ? o.weight : (o.weight || 0), 0);
    const p = parseNumericValue(typeof o.unitPrice === 'number' ? o.unitPrice : (o.unitPrice || 0), 0);
    const e = parseNumericValue(typeof o.extraCharges === 'number' ? o.extraCharges : (o.extraCharges || 0), 0);
    return Math.round((w * p + e) * 100) / 100;
  };
  const val = o.totalValue;
  if (val === undefined || val === null || val === '' || val === 0) return compute();
  if (typeof val === 'string') {
    const parsed = parseNumericValue(val.replace(/[^\d.,-]/g, ''), 0);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : compute();
  }
  return Number.isFinite(+val) ? Math.round(+val * 100) / 100 : compute();
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

const Utils = {
  fmt,
  fmtDate,
  fmtDateStr,
  fmtISO,
  formatCurrency: fmt,
  escapeHTML,
  sanitizeText,
  sanitizeForStorage,
  parseNumericValue,
  debounce,
  maskPhone,
  getOrderTotal,
  validateStateDump,
  formatWeight,
  badgeClass,
  compressImage,
  sanitizeImageData,
  showToast(msg, type = 'info') {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(msg, type);
    }
  }
};

if (typeof window !== 'undefined') {
  window.Utils = Utils;
}
