const Updates = {
  verAtual: '2.5.0',

  setup() {
    document.getElementById('btnCheckUpdates').addEventListener('click', () => this.check());
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // Verifica nova versão (retorna versão ou null)
  async _fetchVersion() {
    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.text()).trim();
    } catch { return null; }
  },

  // Verificação silenciosa (chamada pelo app.js) — Pergunta antes de atualizar
  async checkSilent() {
    const serverVer = await this._fetchVersion();
    if (serverVer && serverVer !== this.verAtual) {
      const deferred = safeStorage.get('confeitex_update_deferred');
      const oneDay = 86400000;
      if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) {
        return serverVer;
      }
      await this.promptUpdate(serverVer);
      return serverVer;
    }
    return null;
  },

  // Diálogo de confirmação de atualização: "Atualizar Agora" ou "Mais Tarde"
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

  async downloadUpdate() {
    const newVer = safeStorage.get('confeitex_ver') || this.verAtual;
    const startedAt = Date.now();

    this._showProgress(newVer);

    // Limpa flags de cache/notificações antigas
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
      } catch (e) { console.warn('[Confeitex] Auto-update SW registration error:', e); }
    }

    // Se não suportar SW, marca como atualizado e mostra banner
    if (!swOk) {
      await this._settleProgress(startedAt, I18n.t('updates.progressRegistering'));
      safeStorage.set('confeitex_updated', 'true');
      safeStorage.set('confeitex_ver', newVer);
      this._updateProgress(100, I18n.t('updates.progressDone'));
      await this._delay(600);
      this._showUpdateBanner(newVer);
      return;
    }

    // Registra novo Service Worker
    this._updateProgress(40, I18n.t('updates.progressRegisteringSw'));
    let reg;
    try {
      // Marca antes de registrar para o auto-reload saber que o update foi aceito
      safeStorage.set('confeitex_updated', 'true');
      reg = await navigator.serviceWorker.register('./sw.js?v=' + newVer);
    } catch {
      safeStorage.remove('confeitex_updated');
      this._hideProgress();
      UI.alert(I18n.t('updates.noConnection') + ' ' + I18n.t('updates.retryMsg'));
      return;
    }

    // Aguarda instalação/ativação (máx 25s)
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

    // Marca como atualizado
    safeStorage.set('confeitex_updated', 'true');
    safeStorage.set('confeitex_ver', newVer);

    // Mantém a barra visível por pelo menos 10s para aplicar as mudanças com calma
    await this._settleProgress(startedAt, I18n.t('updates.progressApplying'));

    this._updateProgress(100, ativado ? I18n.t('updates.progressDone') : I18n.t('updates.progressDoneDeferred'));
    await this._delay(800);

    // Mostra banner de notificação para o usuário decidir
    this._showUpdateBanner(newVer);
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
    const minMs = 10000;
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

  _showUpdateBanner(ver) {
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
    text.textContent = I18n.t('updates.installedTitle', { version: ver });

    // Se o banner ainda não estiver visível (ex: sem SW), exibe
    if (!banner.classList.contains('visible')) {
      banner.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
    }

    const hide = () => {
      banner.classList.remove('visible');
      banner.addEventListener('transitionend', () => {
        banner.style.display = 'none';
      }, { once: true });
    };

    btnNow.onclick = () => {
      safeStorage.remove('confeitex_updated');
      hide();
      setTimeout(() => window.location.reload(), 300);
    };

    btnLater.onclick = () => {
      hide();
    };

    btnClose.onclick = () => {
      hide();
      UI.toast(I18n.t('updates.toastApplyLater'));
    };
  },

  changelog: [
    { ver: '2.5.0', date: '23/08/2026', keys: ['changelog.2500'] },
    { ver: '2.4.0', date: '08/08/2026', keys: ['changelog.2400'] },
    { ver: '2.1.4', date: '08/08/2026', keys: ['changelog.2140'] },
    { ver: '2.1.3', date: '07/08/2026', keys: ['changelog.2130'] },
    { ver: '2.1.2', date: '06/08/2026', keys: ['changelog.2120'] },
    { ver: '2.1.1', date: '06/08/2026', keys: ['changelog.2110'] },
    { ver: '2.1.0', date: '04/08/2026', keys: ['changelog.2100', 'changelog.2101'] },
    { ver: '2.0.1', date: '04/08/2026', keys: ['changelog.2010', 'changelog.2011', 'changelog.2012'] },
    { ver: '2.0.0', date: '03/08/2026', keys: ['changelog.2000', 'changelog.2001', 'changelog.2002', 'changelog.2003', 'changelog.2004'] },
    { ver: '1.24.0', date: '02/08/2026', keys: ['changelog.1240'] },
    { ver: '1.23.0', date: '01/08/2026', keys: ['changelog.1230', 'changelog.1231', 'changelog.1232'] },
    { ver: '1.22.0', date: '01/08/2026', keys: ['changelog.1220', 'changelog.1221', 'changelog.1222'] },
    { ver: '1.21.0', date: '01/08/2026', keys: ['changelog.1210', 'changelog.1211', 'changelog.1212'] },
    { ver: '1.20.1', date: '01/08/2026', keys: ['changelog.1201'] },
    { ver: '1.20.0', date: '01/08/2026', keys: ['changelog.1200'] },
    { ver: '1.19.0', date: '31/07/2026', keys: ['changelog.1190', 'changelog.1191', 'changelog.1192', 'changelog.1193'] },
    { ver: '1.18.1', date: '31/07/2026', keys: ['changelog.1811'] },
    { ver: '1.18.0', date: '31/07/2026', keys: ['changelog.1800', 'changelog.1801', 'changelog.1802', 'changelog.1803'] },
    { ver: '1.17.0', date: '31/07/2026', keys: ['changelog.1170', 'changelog.1171', 'changelog.1172', 'changelog.1173', 'changelog.1174', 'changelog.1175'] },
  ],

  render() {
    const displayVer = this.verAtual;
    safeStorage.set('confeitex_ver', displayVer);
    document.getElementById('updatesCurrentVer').textContent = `v${displayVer}`;
    const lastCheck = safeStorage.get('confeitex_last_check');
    document.getElementById('updatesLastCheck').textContent = lastCheck || I18n.t('updates.neverChecked');
    this.renderChangelog();
    this.updateStatus('');
  },

  renderChangelog() {
    const container = document.getElementById('updatesChangelog');
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

  updateStatus(msg, isError) {
    const el = document.getElementById('updatesStatus');
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
  },

  async check() {
    const btn = document.getElementById('btnCheckUpdates');
    const btnHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> ' + I18n.t('updates.checkNow');
    btn.disabled = true;
    btn.innerHTML = '<span class="login-spinner"></span> ' + I18n.t('updates.checking');
    this.updateStatus(I18n.t('updates.checking'));

    const serverVer = await this._fetchVersion();
    safeStorage.set('confeitex_last_check', new Date().toLocaleString(I18n.locales[I18n.lang] || 'pt-BR'));
    document.getElementById('updatesLastCheck').textContent = safeStorage.get('confeitex_last_check');

    if (serverVer && serverVer !== this.verAtual) {
      const confirmado = await UI.confirm({
        title: I18n.t('updates.promptTitle'),
        message: I18n.t('updates.promptFound', { version: serverVer }),
        confirmText: I18n.t('updates.reloadNow'),
        variant: 'primary'
      });
      if (!confirmado) {
        this.updateStatus(I18n.t('updates.cancelled'));
        btn.disabled = false;
        btn.innerHTML = btnHtml;
        return;
      }
      this.updateStatus(I18n.t('updates.newFound', { version: serverVer }));
      btn.disabled = false;
      btn.innerHTML = btnHtml;
      safeStorage.set('confeitex_ver', serverVer);
      await this.downloadUpdate();
      return;
    } else if (serverVer === this.verAtual) {
      this.updateStatus(I18n.t('updates.upToDate'));
    } else {
      this.updateStatus(I18n.t('updates.noConnection'), true);
    }

    btn.disabled = false;
    btn.innerHTML = btnHtml;
  }
};
