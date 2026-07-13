const UI = {
  _toastTimer: null,

  toast(message, variant = 'success') {
    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      primary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    };
    const bgGradients = {
      success: 'linear-gradient(135deg, #059669, #10b981)',
      danger: 'linear-gradient(135deg, #dc2626, #ef4444)',
      warning: 'linear-gradient(135deg, #d97706, #f59e0b)',
      primary: 'linear-gradient(135deg, #ec4899, #8b5cf6)'
    };

    const el = document.createElement('div');
    el.className = 'ui-toast';
    el.innerHTML = `<div class="ui-toast-icon">${icons[variant] || icons.primary}</div><div class="ui-toast-text">${message}</div>`;
    el.style.background = bgGradients[variant] || bgGradients.primary;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
    setTimeout(() => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  confirm({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'primary' }) {
    return new Promise(resolve => {
      const icons = {
        primary: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        danger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      };
      const gradient = variant === 'danger'
        ? 'linear-gradient(135deg, #dc2626, #ef4444)'
        : variant === 'warning'
        ? 'linear-gradient(135deg, #d97706, #f59e0b)'
        : 'linear-gradient(135deg, #ec4899, #8b5cf6)';

      const overlay = document.createElement('div');
      overlay.className = 'ui-confirm-overlay';
      overlay.innerHTML = `
        <div class="ui-confirm-modal">
          <div class="ui-confirm-icon" style="background:${gradient}">${icons[variant] || icons.primary}</div>
          <div class="ui-confirm-title">${title}</div>
          <div class="ui-confirm-message">${message}</div>
          <div class="ui-confirm-actions">
            ${cancelText ? `<button class="ui-confirm-btn ui-confirm-btn-cancel" data-action="cancel">${cancelText}</button>` : ''}
            <button class="ui-confirm-btn ui-confirm-btn-confirm" data-action="confirm" style="background:${gradient}">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      overlay.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        resolve(btn.dataset.action === 'confirm');
      });
    });
  },

  alert(message) {
    return this.confirm({ title: 'Aviso', message, confirmText: 'OK', cancelText: '', variant: 'primary' });
  }
};