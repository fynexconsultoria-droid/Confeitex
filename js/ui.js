const UI = {
  toast(message, variant = 'success') {
    const existing = document.querySelector('.toast.visible');
    if (existing) { existing.classList.remove('visible'); setTimeout(() => existing.remove(), 300); }
    const el = document.createElement('div');
    el.className = `toast toast-${variant}`;
    el.textContent = message;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('visible'));
    setTimeout(() => { el.classList.remove('visible'); setTimeout(() => el.remove(), 300); }, 3000);
  },

  confirm({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', variant = 'primary' }) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-container" style="max-width: 420px;">
          <div class="modal-header"><h2>${title}</h2></div>
          <div class="modal-body"><p style="color: var(--text-secondary);">${message}</p></div>
          <div class="modal-footer">
            ${cancelText ? `<button class="btn btn-secondary" data-action="cancel">${cancelText}</button>` : ''}
            <button class="btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${confirmText}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));
      overlay.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        resolve(btn.dataset.action === 'confirm');
      }));
    });
  },

  alert(message) {
    return this.confirm({ title: 'Aviso', message, confirmText: 'OK', cancelText: '', variant: 'primary' });
  }
};
