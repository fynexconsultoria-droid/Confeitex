/**
 * Confeitex — logger.js
 * Gerenciador de logs para desativar logs de debug em produção.
 */

export const DEBUG = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

export const log = (...args) => {
  if (DEBUG) console.log(...args);
};

export const warn = (...args) => {
  if (DEBUG) console.warn(...args);
};

// Erros sempre são registrados, mesmo em produção
export const error = (...args) => {
  console.error(...args);
};
