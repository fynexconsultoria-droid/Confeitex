const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const Auth = {
  lockEnabled: false,
  lockHash: '',

  init() {
    this.lockEnabled = localStorage.getItem('confeitex_lock_enabled') === 'true';
    this.lockHash = localStorage.getItem('confeitex_lock_hash') || '';
  },

  supported() {
    return window.crypto && window.crypto.subtle;
  },

  async _deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const keyBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const keyArray = Array.from(new Uint8Array(keyBuffer));
    return keyArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async setPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await this._deriveKey(password, salt);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    this.lockHash = saltHex + ':' + hash;
    localStorage.setItem('confeitex_lock_hash', this.lockHash);
  },

  async verify(password) {
    if (!this.supported() || !this.lockHash) return false;
    try {
      const parts = this.lockHash.split(':');
      if (parts.length !== 2) return false;
      const saltHex = parts[0];
      const storedHash = parts[1];
      const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
      const hash = await this._deriveKey(password, salt);
      return hash === storedHash;
    } catch { return false; }
  },

  enable() {
    this.lockEnabled = true;
    localStorage.setItem('confeitex_lock_enabled', 'true');
  },

  disable() {
    this.lockEnabled = false;
    localStorage.setItem('confeitex_lock_enabled', 'false');
  },

  isLocked() {
    return this.lockEnabled && !!this.lockHash && !sessionStorage.getItem('confeitex_auth');
  },

  _loginShown: false,

  showLogin() {
    if (this._loginShown) return Promise.resolve();
    this._loginShown = true;
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'login-overlay';
      overlay.innerHTML = `
        <div class="login-modal">
          <div class="login-brand">
            <div class="login-brand-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2v2h-4V4a2 2 0 0 1 2-2zM5 20h14a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2zM3 10h18v2H3zM9 14h6v2H9z"/></svg>
            </div>
            <h2>Confeitex</h2>
            <span class="login-tagline">${I18n.t('auth.loginTagline')}</span>
          </div>
          <div class="login-divider"></div>
          <div class="login-input-group">
            <div class="login-password-wrapper">
              <input type="password" class="form-control login-input" id="loginPasswordInput" placeholder="${I18n.t('auth.passwordPh')}" autocomplete="off">
              <button class="login-toggle-visibility" id="loginToggleVisibility" type="button" aria-label="${I18n.t('auth.showPw')}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
            </div>
            <div class="login-error" id="loginError">${I18n.t('auth.loginError')}</div>
          </div>
          <button class="btn btn-primary login-submit" id="loginSubmit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3"/></svg>
            ${I18n.t('auth.loginBtn')}
          </button>
        </div>`;
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('active'));

      const input = document.getElementById('loginPasswordInput');
      const submit = document.getElementById('loginSubmit');
      const error = document.getElementById('loginError');
      const toggle = document.getElementById('loginToggleVisibility');

      input.value = '';
      error.style.display = 'none';
      setTimeout(() => input.focus(), 300);

      const cleanup = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 400);
      };

      const doLogin = async () => {
        const pw = input.value;
        if (!pw) return;
        submit.disabled = true;
        submit.innerHTML = '<span class="login-spinner"></span>';
        try {
          const ok = await this.verify(pw);
          if (ok) {
            sessionStorage.setItem('confeitex_auth', 'true');
            cleanup();
            resolve();
            return;
          }
          error.style.display = 'block';
          input.value = '';
          input.focus();
        } catch (e) { console.warn('[Confeitex] Login verify error:', e); }
        submit.disabled = false;
        submit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3"/></svg>\n            ' + I18n.t('auth.loginBtn');
      };

      submit.onclick = doLogin;
      input.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
      toggle.onclick = () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        toggle.innerHTML = input.type === 'password'
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      };
    });
  },

  async promptSetPassword(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-container" style="max-width:400px;">
          <div class="modal-header"><h2>${esc(title)}</h2></div>
          <div class="modal-body" style="gap:1rem;">
            <p style="color:var(--text-secondary);">${esc(message || I18n.t('auth.pwSetMsg'))}</p>
            <div class="form-group">
              <label>${I18n.t('auth.pwNew')}</label>
              <input type="password" class="form-control" id="pwSetNew" placeholder="${I18n.t('auth.pwPhNew')}">
            </div>
            <div class="form-group">
              <label>${I18n.t('auth.pwConfirm')}</label>
              <input type="password" class="form-control" id="pwSetConfirm" placeholder="${I18n.t('auth.pwPhConfirm')}">
            </div>
            <div id="pwSetError" style="color:var(--color-danger);font-size:0.85rem;display:none;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="pwSetCancel">${I18n.t('common.cancel')}</button>
            <button class="btn btn-primary" id="pwSetConfirmBtn">${I18n.t('common.save')}</button>
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
          errorEl.textContent = I18n.t('auth.pwErrorShort');
          errorEl.style.display = 'block';
          return;
        }
        if (newPw !== confirmPw) {
          errorEl.textContent = I18n.t('auth.pwErrorMismatch');
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
          <div class="modal-header"><h2>${esc(title)}</h2></div>
          <div class="modal-body" style="gap:1rem;">
            <p style="color:var(--text-secondary);">${I18n.t('auth.currentPwMsg')}</p>
            <div class="form-group">
              <label>${I18n.t('auth.currentPwLabel')}</label>
              <input type="password" class="form-control" id="pwCurrentInput" placeholder="${I18n.t('auth.currentPwPh')}">
            </div>
            <div id="pwCurrentError" style="color:var(--color-danger);font-size:0.85rem;display:none;"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" id="pwCurrentCancel">${I18n.t('common.cancel')}</button>
            <button class="btn btn-primary" id="pwCurrentConfirm">${I18n.t('auth.currentPwBtn')}</button>
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
          errorEl.textContent = I18n.t('auth.currentPwError');
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
        <span style="font-weight:600;color:${enabled ? 'var(--color-success)' : 'var(--text-muted)'};">${enabled ? I18n.t('auth.lockEnabled') : I18n.t('auth.lockDisabled')}</span>
      </div>
      <p class="config-desc" style="font-size:0.85rem;">
        ${I18n.t('auth.lockDesc')}
      </p>
      <div class="config-btn-group">
        ${enabled ? `
          <button class="btn btn-secondary" id="btnDisableLock" style="border-color:rgba(239,68,68,0.3);color:var(--color-danger);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${I18n.t('auth.disableBtn')}
          </button>
          <button class="btn btn-secondary" id="btnChangePassword">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            ${I18n.t('auth.changePwBtn')}
          </button>
        ` : `
          <button class="btn btn-primary" id="btnEnableLock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            ${I18n.t('auth.enableBtn')}
          </button>
        `}
      </div>
    `;

    if (enabled) {
      document.getElementById('btnDisableLock')?.addEventListener('click', async () => {
        const pw = await this.promptCurrentPassword(I18n.t('auth.disableBtn'));
        if (pw) {
          this.disable();
          this.renderSecuritySettings();
          UI.toast(I18n.t('auth.toastLockDisabled'));
        }
      });
      document.getElementById('btnChangePassword')?.addEventListener('click', async () => {
        const pw = await this.promptCurrentPassword(I18n.t('auth.changePwBtn'));
        if (pw) {
          const newPw = await this.promptSetPassword(I18n.t('auth.changePwBtn'), I18n.t('auth.pwChangeMsg'));
          if (newPw) {
            UI.toast(I18n.t('auth.toastPwChanged'));
          }
        }
      });
    } else {
      document.getElementById('btnEnableLock')?.addEventListener('click', async () => {
        if (!this.supported()) {
          UI.alert(I18n.t('auth.alertNoCrypto'));
          return;
        }
        const pw = await this.promptSetPassword(I18n.t('auth.enableBtn'));
        if (pw) {
          this.enable();
          this.renderSecuritySettings();
          UI.toast(I18n.t('auth.toastLockEnabled'));
        }
      });
    }
  }
};
