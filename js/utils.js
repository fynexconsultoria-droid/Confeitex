const fmt = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const fmtDateStr = (s) => s ? s.split('-').reverse().join('/') : '';
const escapeHTML = (s) => s ? s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t])) : '';

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
  return o.productType === 'Bolo de Kg' ? `${w.toFixed(2).replace('.', ',')} Kg` : `${Math.round(w)} un`;
}
