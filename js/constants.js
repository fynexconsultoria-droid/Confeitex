/**
 * Confeitex — constants.js
 * Constantes globais da aplicação.
 */

export const ORDER_STATUS = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em Produção',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelado',
};

export const PAYMENT_METHODS = [
  'Dinheiro', 
  'Pix', 
  'Cartão de Crédito', 
  'Cartão de Débito', 
  'Transferência'
];

export const DELIVERY_TYPES = [
  'Retirada no Local', 
  'Entrega'
];

export const PRODUCT_TYPES = [
  'Bolo de Kg', 
  'Bolo Unitário', 
  'Doces / Brigadeiros', 
  'Salgados', 
  'Outros'
];
