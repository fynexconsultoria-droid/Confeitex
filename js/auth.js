const Auth = {
  lockEnabled: false,
  lockHash: '',

  init() {
    this.lockEnabled = localStorage.getItem('fyntex_lock_enabled') === 'true';
    this.lockHash = localStorage.getItem('fyntex_lock_hash') || '';
  },

  supported() {
    return window.crypto && window.crypto.subtle;
  },

  async _hash(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async setPassword(password) {
    this.lockHash = await this._hash(password);
    localStorage.setItem('fyntex_lock_hash', this.lockHash);
  },

  async verify(password) {
    if (!this.lockHash) return false;
    return (await this._hash(password)) === this.lockHash;
  },

  enable() {
    this.lockEnabled = true;
    localStorage.setItem('fyntex_lock_enabled', 'true');
  },

  disable() {
    this.lockEnabled = false;
    localStorage.setItem('fyntex_lock_enabled', 'false');
  },

  isLocked() {
    return this.lockEnabled && !!this.lockHash;
  },

  showLogin() {
    return new Promise(resolve => {
      const overlay = document.getElementById('loginOverlay');
      const input = document.getElementById('loginPasswordInput');
      const submit = document.getElementById('loginSubmit');
      const error = document.getElementById('loginError');
      const toggle = document.getElementById('loginToggleVisibility');

      overlay.classList.add('active');
      input.value = '';
      error.style.display = 'none';
      setTimeout(() => input.focus(), 300);

      const doLogin = async () => {
        const pw = input.value;
        if (!pw) return;
        submit.disabled = true;
        submit.innerHTML = '<span class="login-spinner"></span>';
        const ok = await this.verify(pw);
        submit.disabled = false;
        submit.textContent = 'Entrar';
        if (ok) {
          overlay.classList.remove('active');
          resolve();
        } else {
          error.style.display = 'block';
          input.value = '';
          input.focus();
        }
      };

      submit.onclick = doLogin;
      input.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
      toggle.onclick = () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        toggle.innerHTML = input.type === 'password'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      };

      // No cancel button — login required to access
    });
  },

  async promptSetPassword(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-container" style="max-width:400px;">
          <div class="modal-header"><h2>${title}</h2></div>
          <div class="modal-body" style="gap:1rem;">
            <p style="color:var(--text-secondary);">${message || 'Escolha uma senha para proteger o aplicativo.'}</p>
            <div class="form-group">
              <label>Nova senha</label>
              <input type="password" class="form-control" id="pwSetNew" placeholder="Digite a senha">
            </div>
            <div class="form-group">
              <label>Confirmar senha</label>
              <input type="password" class="form-control" id="pwSetConfirm" placeholder="Repita a senha">
            </div>
            <div id="pwSetError" style="color:var(--color-danger);font-size:0.85rem;display:none;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="pwSetCancel">Cancelar</button>
            <button class="btn btn-primary" id="pwSetConfirmBtn">Salvar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));
      document.getElementById('pwSetNew').focus();

      const close = result => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        resolve(result);
      };

      document.getElementById('pwSetCancel').onclick = () => close(null);
      document.getElementById('pwSetConfirmBtn').onclick = async () => {
        const newPw = document.getElementById('pwSetNew').value;
        const confirmPw = document.getElementById('pwSetConfirm').value;
        const errorEl = document.getElementById('pwSetError');
        if (!newPw || newPw.length < 3) {
          errorEl.textContent = 'A senha deve ter pelo menos 3 caracteres.';
          errorEl.style.display = 'block';
          return;
        }
        if (newPw !== confirmPw) {
          errorEl.textContent = 'As senhas não conferem.';
          errorEl.style.display = 'block';
          return;
        }
        await this.setPassword(newPw);
        close(newPw);
      };
    });
  },

  async promptCurrentPassword(title) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-container" style="max-width:400px;">
          <div class="modal-header"><h2>${title}</h2></div>
          <div class="modal-body" style="gap:1rem;">
            <p style="color:var(--text-secondary);">Digite a senha atual para continuar.</p>
            <div class="form-group">
              <label>Senha atual</label>
              <input type="password" class="form-control" id="pwCurrentInput" placeholder="Senha atual">
            </div>
            <div id="pwCurrentError" style="color:var(--color-danger);font-size:0.85rem;display:none;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="pwCurrentCancel">Cancelar</button>
            <button class="btn btn-primary" id="pwCurrentConfirm">Confirmar</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));
      document.getElementById('pwCurrentInput').focus();

      const close = result => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
        resolve(result);
      };

      document.getElementById('pwCurrentCancel').onclick = () => close(null);
      document.getElementById('pwCurrentConfirm').onclick = async () => {
        const pw = document.getElementById('pwCurrentInput').value;
        const errorEl = document.getElementById('pwCurrentError');
        if (!pw) return;
        const ok = await this.verify(pw);
        if (ok) {
          close(pw);
        } else {
          errorEl.textContent = 'Senha incorreta.';
          errorEl.style.display = 'block';
          document.getElementById('pwCurrentInput').value = '';
          document.getElementById('pwCurrentInput').focus();
        }
      };
    });
  },

  renderSecuritySettings() {
    const container = document.getElementById('securitySettingsContainer');
    if (!container) return;
    const enabled = this.lockEnabled && !!this.lockHash;
    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
        <div style="width:10px;height:10px;border-radius:50%;background:${enabled ? 'var(--color-success)' : 'var(--text-muted)'};"></div>
        <span style="font-weight:600;color:${enabled ? 'var(--color-success)' : 'var(--text-muted)'};">${enabled ? 'Bloqueio ativado' : 'Bloqueio desativado'}</span>
      </div>
      <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.4;">
        Ao ativar o bloqueio, será solicitada uma senha toda vez que abrir o aplicativo.
      </p>
      <div class="config-btn-group">
        ${enabled ? `
          <button class="btn btn-secondary" id="btnDisableLock" style="border-color:rgba(239,68,68,0.3);color:var(--color-danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Desativar Bloqueio
          </button>
          <button class="btn btn-secondary" id="btnChangePassword">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Alterar Senha
          </button>
        ` : `
          <button class="btn btn-primary" id="btnEnableLock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Ativar Bloqueio
          </button>
        `}
      </div>
    `;

    if (enabled) {
      document.getElementById('btnDisableLock')?.addEventListener('click', async () => {
        const pw = await this.promptCurrentPassword('Desativar Bloqueio');
        if (pw) {
          this.disable();
          this.renderSecuritySettings();
          UI.toast('Bloqueio desativado.');
        }
      });
      document.getElementById('btnChangePassword')?.addEventListener('click', async () => {
        const pw = await this.promptCurrentPassword('Alterar Senha');
        if (pw) {
          const newPw = await this.promptSetPassword('Alterar Senha', 'Digite a nova senha.');
          if (newPw) {
            UI.toast('Senha alterada com sucesso.');
          }
        }
      });
    } else {
      document.getElementById('btnEnableLock')?.addEventListener('click', async () => {
        if (!this.supported()) {
          UI.alert('Seu navegador não suporta criptografia necessária para o bloqueio.');
          return;
        }
        const pw = await this.promptSetPassword('Ativar Bloqueio');
        if (pw) {
          this.enable();
          this.renderSecuritySettings();
          UI.toast('Bloqueio ativado!');
        }
      });
    }
  }
};
