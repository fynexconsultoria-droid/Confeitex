const Updates = {
  verAtual: '5.1.0',
  _checking: false,

  changelog: [
    { ver: '5.1.0', date: '11/09/2026', keys: ['changelog.5100'] },
    { ver: '5.0.0', date: '10/09/2026', keys: ['changelog.5000'] },
    { ver: '4.1.0', date: '10/09/2026', keys: ['changelog.4100'] },
  ],

  setup() {
    const btn = document.getElementById('btnCheckUpdates');
    if (btn) btn.onclick = () => this.checkManual();
    // Registra sincronização periódica para verificações de atualização
    this._registerUpdateSync();
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // Busca a versão no servidor (version.txt)
  async _fetchVersion() {
    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.text()).trim();
    } catch { return null; }
  },

  // Envia notificação real do sistema (push/OS) sobre a atualização
  async _sendSystemNotification(serverVer) {
    if (typeof Notification === 'undefined') return;
    const title = I18n.t('updates.notifTitle');
    const body = I18n.t('updates.notifBody', { version: serverVer });

    // Solicita permissão se ainda não foi solicitada
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }

    if (Notification.permission !== 'granted') return;

    // 1. Tenta via Service Worker ativo (funciona em PWA / celular / background)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            body,
            icon: 'icons/icon-192x192.png',
            badge: 'icons/icon-192x192.png',
            tag: 'confeitex-update-' + serverVer,
            data: { tab: 'updates', type: 'update', version: serverVer }
          });
          return;
        }
      } catch (e) {}
    }

    // 2. Fallback: API Notification padrão do navegador
    try {
      const notif = new Notification(title, {
        body,
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-update-' + serverVer
      });
      notif.onclick = () => {
        window.focus();
        this.promptUpdate(serverVer);
      };
    } catch (e) {}
  },

  // Verificação silenciosa
  async checkSilent() {
    return this.checkAndUpdate(false);
  },

  // Verifica atualização e registra no sino + notifica sistema + pergunta se quer atualizar
  async checkAndUpdate(forcePrompt = false) {
    if (this._checking) return null;
    this._checking = true;
    try {
      const serverVer = await this._fetchVersion();
      if (serverVer && serverVer !== this.verAtual) {
        const deferred = safeStorage.get('confeitex_update_deferred');
        const twoHours = 7200000;
        const isDeferred = deferred && (Date.now() - parseInt(deferred, 10) < twoHours);

        // Registra no sino de notificações
        const notifId = 'update_' + serverVer;
        if (typeof Notifications !== 'undefined' && Notifications._recordNotification) {
          Notifications._recordNotification({
            id: notifId,
            type: 'update',
            title: I18n.t('updates.notifTitle'),
            body: I18n.t('updates.notifBody', { version: serverVer }),
            orderIds: [],
            read: false
          });
        }

        // Dispara notificação nativa para o sistema operacional / navegador
        await this._sendSystemNotification(serverVer);

        // Mostra o banner persistente
        this._showUpdateBanner(serverVer, false);

        // Pergunta diretamente ao usuário com diálogo/modal se deseja atualizar agora
        if (!isDeferred || forcePrompt) {
          await this.promptUpdate(serverVer);
        }

        return serverVer;
      }
      return null;
    } finally {
      this._checking = false;
    }
  },

  // Diálogo de confirmação de atualização
  async promptUpdate(serverVer) {
    const ok = await UI.confirm({
      title: I18n.t('updates.promptTitle'),
      message: I18n.t('updates.promptMsg', { version: serverVer }),
      confirmText: I18n.t('updates.updateNow'),
      cancelText: I18n.t('updates.later'),
      variant: 'primary'
    });

    if (ok) {
      safeStorage.remove('confeitex_update_deferred');
      safeStorage.set('confeitex_ver', serverVer);
      await this.downloadUpdate();
    } else {
      safeStorage.set('confeitex_update_deferred', String(Date.now()));
      UI.toast(I18n.t('updates.toastLater'));
    }
  },

  // Verificação manual pela aba de Atualizações
  async checkManual() {
    const btn = document.getElementById('btnCheckUpdates');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="login-spinner"></span> ' + I18n.t('updates.checking');
    }
    this.updateStatus(I18n.t('updates.checking'));

    const serverVer = await this._fetchVersion();
    const lastCheckStr = new Date().toLocaleString((I18n.locales && I18n.locales[I18n.lang]) || 'pt-BR');
    safeStorage.set('confeitex_last_check', lastCheckStr);
    const lastCheckEl = document.getElementById('updatesLastCheck');
    if (lastCheckEl) lastCheckEl.textContent = lastCheckStr;

    if (serverVer && serverVer !== this.verAtual) {
      const ok = await UI.confirm({
        title: I18n.t('updates.promptTitle'),
        message: I18n.t('updates.promptFound', { version: serverVer }),
        confirmText: I18n.t('updates.reloadNow'),
        variant: 'primary'
      });
      if (ok) {
        this.updateStatus(I18n.t('updates.newFound', { version: serverVer }));
        safeStorage.set('confeitex_ver', serverVer);
        await this.downloadUpdate();
      } else {
        this.updateStatus(I18n.t('updates.cancelled'));
      }
    } else if (serverVer === this.verAtual) {
      this.updateStatus(I18n.t('updates.upToDate'));
    } else {
      this.updateStatus(I18n.t('updates.noConnection'), true);
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async downloadUpdate() {
    const newVer = safeStorage.get('confeitex_ver') || this.verAtual;
    const oldVer = this.verAtual;
    const startedAt = Date.now();

    this._showProgress(newVer);
    safeStorage.remove('confeitex_notified');
    safeStorage.remove('confeitex_update_prompt');
    safeStorage.remove('confeitex_pwa_dismissed');

    // Remove Service Worker antigo
    this._updateProgress(15, I18n.t('updates.progressClearCache'));
    let swOk = 'serviceWorker' in navigator;
    if (swOk) {
      try {
        const r = await navigator.serviceWorker.getRegistration();
        if (r) await r.unregister();
      } catch (e) { console.warn('[Confeitex] SW unregister error:', e); }
    }

    if (!swOk) {
      await this._settleProgress(startedAt, I18n.t('updates.progressRegistering'));
      safeStorage.set('confeitex_updated', 'true');
      safeStorage.set('confeitex_ver', newVer);
      this._updateProgress(100, I18n.t('updates.progressDone'));
      await this._delay(600);
      this._showUpdateBanner(newVer, true);
      return;
    }

    // Registra novo Service Worker
    this._updateProgress(40, I18n.t('updates.progressRegisteringSw'));
    let reg;
    try {
      safeStorage.set('confeitex_updated', 'true');
      reg = await navigator.serviceWorker.register('./sw.js?v=' + newVer);
    } catch {
      safeStorage.remove('confeitex_updated');
      safeStorage.set('confeitex_ver', oldVer);
      this._hideProgress();
      UI.alert(I18n.t('updates.noConnection') + ' ' + I18n.t('updates.retryMsg'));
      return;
    }

    this._updateProgress(60, I18n.t('updates.progressActivating'));
    const ativado = await Promise.race([
      new Promise(resolve => {
        const w = reg.installing;
        if (w) {
          w.addEventListener('statechange', () => {
            const st = w.state;
            if (st === 'installed' || st === 'activated') resolve(true);
            else if (st === 'redundant') {
              setTimeout(() => resolve(!!(reg.active && reg.active.state === 'activated')), 1000);
            }
          });
        } else if (reg.active) {
          resolve(reg.active.state === 'activated');
        } else {
          setTimeout(() => resolve(false), 1500);
        }
      }),
      this._delay(25000).then(() => false)
    ]);

    safeStorage.set('confeitex_updated', 'true');
    safeStorage.set('confeitex_ver', newVer);

    await this._settleProgress(startedAt, I18n.t('updates.progressApplying'));
    this._updateProgress(100, ativado ? I18n.t('updates.progressDone') : I18n.t('updates.progressDoneDeferred'));
    await this._delay(800);
    this._showUpdateBanner(newVer, true);
  },

  _showProgress(ver) {
    const banner = document.getElementById('updateNotification');
    const text = document.getElementById('updateNotifText');
    const progress = document.getElementById('updateProgress');
    const actions = document.getElementById('updateActions');
    const fill = document.getElementById('updateProgressFill');
    const label = document.getElementById('updateProgressLabel');
    if (!banner || !text || !progress || !actions || !fill || !label) return;

    text.textContent = I18n.t('updates.downloadMsg', { version: ver });
    progress.style.display = 'flex';
    actions.style.display = 'none';
    fill.style.width = '0%';
    label.textContent = I18n.t('updates.progressPreparing');

    banner.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
  },

  _updateProgress(pct, msg) {
    const fill = document.getElementById('updateProgressFill');
    const label = document.getElementById('updateProgressLabel');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
    if (label) label.textContent = msg;
  },

  _animateProgress(targetPct, duration, msg) {
    return new Promise(resolve => {
      const fill = document.getElementById('updateProgressFill');
      const label = document.getElementById('updateProgressLabel');
      if (label && msg) label.textContent = msg;
      if (!fill || duration <= 0) { resolve(); return; }
      const startPct = parseFloat(fill.style.width) || 0;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        fill.style.width = (startPct + (targetPct - startPct) * eased) + '%';
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  },

  _settleProgress(startedAt, msg) {
    const minMs = 5000;
    const remaining = Math.max(0, minMs - (Date.now() - startedAt));
    return this._animateProgress(99, remaining, msg);
  },

  _hideProgress() {
    const banner = document.getElementById('updateNotification');
    if (banner) {
      banner.classList.remove('visible');
      banner.addEventListener('transitionend', () => {
        banner.style.display = 'none';
      }, { once: true });
    }
  },

  _showUpdateBanner(ver, installed = false) {
    const banner = document.getElementById('updateNotification');
    const text = document.getElementById('updateNotifText');
    const progress = document.getElementById('updateProgress');
    const actions = document.getElementById('updateActions');
    const btnNow = document.getElementById('btnUpdateNow');
    const btnLater = document.getElementById('btnUpdateLater');
    const btnClose = document.getElementById('btnUpdateCloseApp');
    if (!banner || !text || !progress || !actions || !btnNow || !btnLater || !btnClose) return;

    progress.style.display = 'none';
    actions.style.display = 'flex';
    text.textContent = installed
      ? I18n.t('updates.installedTitle', { version: ver })
      : I18n.t('updates.promptMsg', { version: ver });

    if (!banner.classList.contains('visible')) {
      banner.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
    }

    const hide = () => {
      banner.classList.remove('visible');
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    };

    if (installed) {
      btnNow.onclick = () => {
        safeStorage.remove('confeitex_updated');
        hide();
        setTimeout(() => window.location.reload(), 300);
      };
    } else {
      btnNow.onclick = () => {
        safeStorage.set('confeitex_ver', ver);
        hide();
        this.downloadUpdate();
      };
    }

    btnLater.onclick = () => {
      safeStorage.set('confeitex_update_deferred', Date.now().toString());
      hide();
    };

    btnClose.onclick = () => {
      hide();
      UI.toast(I18n.t('updates.toastApplyLater'));
    };
  },

  render() {
    const displayVer = this.verAtual;
    safeStorage.set('confeitex_ver', displayVer);
    const curVerEl = document.getElementById('updatesCurrentVer');
    if (curVerEl) curVerEl.textContent = `v${displayVer}`;
    const sidebarVersion = document.getElementById('sidebarVersion');
    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;
    const lastCheck = safeStorage.get('confeitex_last_check');
    const lastCheckEl = document.getElementById('updatesLastCheck');
    if (lastCheckEl) lastCheckEl.textContent = lastCheck || I18n.t('updates.neverChecked');
    this.renderChangelog();
    this.updateStatus('');
  },

  renderChangelog() {
    const container = document.getElementById('updatesChangelog');
    if (!container) return;
    container.innerHTML = this.changelog.map(v => {
      const items = v.keys.map(k => I18n.t(k));
      return `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:0.75rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
          <span style="background:var(--gradient-primary);color:#fff;font-size:0.65rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:50px;">v${v.ver}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">${v.date}</span>
        </div>
        <ul style="margin:0;padding-left:1.25rem;font-size:0.8rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.2rem;">
          ${items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `;
    }).join('');
  },

  updateStatus(msg, isError = false) {
    const el = document.getElementById('updatesStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
  },

  // Registra sincronização periódica para verificações de atualização
  async _registerUpdateSync() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg || !('periodicSync' in reg)) return;
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;
      await reg.periodicSync.register('confeitex-update-sync', { minInterval: 6 * 60 * 60 * 1000 });
    } catch (e) {}
  }
};
