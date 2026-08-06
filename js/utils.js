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
const debounce = (fn, ms = 250) => {
  let t;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
};
const escapeHTML = (s) => s ? String(s).replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t])) : '';

function getOrderTotal(o) {
  if (!o) return 0;
  const compute = () => {
    const w = typeof o.weight === 'number' ? o.weight : parseFloat(String(o.weight || 0).replace(',', '.'));
    const p = typeof o.unitPrice === 'number' ? o.unitPrice : parseFloat(String(o.unitPrice || 0).replace(',', '.'));
    const e = typeof o.extraCharges === 'number' ? o.extraCharges : parseFloat(String(o.extraCharges || 0).replace(',', '.'));
    const v = ((isNaN(w) ? 0 : w) * (isNaN(p) ? 0 : p)) + (isNaN(e) ? 0 : e);
    return isNaN(v) ? 0 : +v;
  };
  const val = o.totalValue;
  if (val === undefined || val === null || val === '' || val === 0) return compute();
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return isNaN(parsed) ? compute() : +parsed;
  }
  return isNaN(+val) ? compute() : +val;
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
