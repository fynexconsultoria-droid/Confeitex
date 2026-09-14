const Updates = {
  _CODE_VERSION: '5.1.0',

  // Versão em execução obtida dinamicamente da tag meta ou fallback seguro
  get verAtual() {
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="version"]');
      if (meta && meta.content && this._parseSemver(meta.content)) {
        return meta.content.trim();
      }
    }
    const stored = safeStorage.get('confeitex_ver');
    if (stored && this._parseSemver(stored)) return stored.trim();
    return this._CODE_VERSION;
  },

  _checking: false,
  _checkPromise: null,

  changelog: [
    { ver: '5.1.0', date: '14/09/2026', keys: ['changelog.5100'] },
    { ver: '5.0.0', date: '10/09/2026', keys: ['changelog.5000'] },
    { ver: '4.1.0', date: '10/09/2026', keys: ['changelog.4100'] },
    { ver: '4.0.1', date: '10/09/2026', keys: ['changelog.4001'] },
    { ver: '4.0.0', date: '09/09/2026', keys: ['changelog.4000'] },
    { ver: '3.2.0', date: '09/09/2026', keys: ['changelog.3200'] },
    { ver: '3.1.1', date: '08/09/2026', keys: ['changelog.3110'] },
    { ver: '3.1.0', date: '08/09/2026', keys: ['changelog.3100'] },
    { ver: '3.0.1', date: '06/09/2026', keys: ['changelog.3010'] },
    { ver: '3.0.0', date: '29/08/2026', keys: ['changelog.3000'] },
    { ver: '2.6.0', date: '24/08/2026', keys: ['changelog.2600'] },
    { ver: '2.5.6', date: '23/08/2026', keys: ['changelog.2560'] },
    { ver: '2.5.5', date: '23/08/2026', keys: ['changelog.2550'] },
  ],

  setup() {
    const btn = document.getElementById('btnCheckUpdates');
    if (btn) btn.onclick = () => this.checkManual();
    const btnForce = document.getElementById('btnForceUpdate');
    if (btnForce) btnForce.onclick = () => this.forceUpdate();
    this._registerUpdateSync();
    this._checkUpdateCompletionOnStartup();
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // ─── Validação Semântica de Versão (SemVer) ──────────────────────────────
  _parseSemver(v) {
    if (!v || typeof v !== 'string') return null;
    const clean = v.trim().replace(/^v/i, '');
    const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  },

  // Retorna true SOMENTE se remote for estritamente mais recente que local
  _isNewer(remote, local) {
    const r = this._parseSemver(remote);
    const l = this._parseSemver(local);
    if (!r || !l) return false;
    if (r[0] !== l[0]) return r[0] > l[0];
    if (r[1] !== l[1]) return r[1] > l[1];
    return r[2] > l[2];
  },

  // ─── Verificação no Servidor com Validação e Timeout ─────────────────────
  async _fetchVersion() {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
      
      const r = await fetch('./version.txt?t=' + Date.now(), {
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!r.ok) return null;

      const raw = await r.text();
      const text = raw.trim();

      // Blindagem: descarta se o servidor retornar HTML (ex: 404/500 mascarado) ou string inválida
      if (text.includes('<') || text.includes('<!') || !this._parseSemver(text)) {
        console.warn('[Updates] version.txt inválido ou corrompido retornado pelo servidor:', text.slice(0, 50));
        return null;
      }
      return text;
    } catch (e) {
      return null;
    }
  },

  // ─── Prevenção de Loop: Verificação Pós-Recarregamento ───────────────────
  _checkUpdateCompletionOnStartup() {
    const updatedTo = safeStorage.get('confeitex_last_updated_to');
    const updatedTs = parseInt(safeStorage.get('confeitex_last_updated_ts') || '0', 10);
    if (!updatedTo) return;

    const current = this.verAtual;
    const elapsed = Date.now() - updatedTs;

    if (current === updatedTo) {
      // Sucesso confirmado: o app abriu com a nova versão ativa
      safeStorage.remove('confeitex_last_updated_to');
      safeStorage.remove('confeitex_last_updated_ts');
      safeStorage.remove('confeitex_update_deferred');
      safeStorage.remove('confeitex_update_retries');
      safeStorage.set('confeitex_ver', current);
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast(I18n.t('updates.toastUpdated', { version: current }) || `✅ App atualizado para v${current}`, 'success');
      }
    } else if (elapsed < 60000) {
      // Recarregou há menos de 1 minuto mas a versão ainda não bateu (cache resistente)
      const retries = parseInt(safeStorage.get('confeitex_update_retries') || '0', 10) + 1;
      safeStorage.set('confeitex_update_retries', String(retries));
      if (retries >= 2) {
        // Bloqueia loop contínuo de atualizações por 1 hora
        console.warn('[Updates] Anti-loop ativado: navegador retendo cache antigo. Pausando prompts automáticos.');
        safeStorage.set('confeitex_update_deferred', String(Date.now()));
        safeStorage.remove('confeitex_last_updated_to');
      }
    } else {
      // Timeout expirado (>1min), limpa flags pendentes
      safeStorage.remove('confeitex_last_updated_to');
      safeStorage.remove('confeitex_last_updated_ts');
    }
  },

  _isUpdateCooldownActive() {
    const updatedTs = parseInt(safeStorage.get('confeitex_last_updated_ts') || '0', 10);
    // Se houve atualização nos últimos 60 segundos, não abre prompt automático
    return (Date.now() - updatedTs) < 60000;
  },

  // ─── Verificação Silenciosa ao Abrir ─────────────────────────────────────
  async checkSilent() {
    if (this._checking) return this._checkPromise;
    if (this._isUpdateCooldownActive()) return null;

    this._checking = true;
    this._checkPromise = (async () => {
      try {
        const serverVer = await this._fetchVersion();
        const currentVer = this.verAtual;

        // Compara semver estrito: apenas se o servidor tiver versão MAIOR
        if (serverVer && this._isNewer(serverVer, currentVer)) {
          const deferred = safeStorage.get('confeitex_update_deferred');
          const oneDay = 86400000;
          if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) {
            return serverVer;
          }
          await this.promptUpdate(serverVer);
          return serverVer;
        }
        return null;
      } finally {
        this._checking = false;
        this._checkPromise = null;
      }
    })();

    return this._checkPromise;
  },

  // ─── Verifica Atualização e Registra no Sino + Banner ────────────────────
  async checkAndUpdate() {
    if (this._checking) return this._checkPromise;
    if (this._isUpdateCooldownActive()) return null;

    this._checking = true;
    this._checkPromise = (async () => {
      try {
        const serverVer = await this._fetchVersion();
        const currentVer = this.verAtual;

        // Compara semver estrito: apenas se o servidor tiver versão MAIOR
        if (serverVer && this._isNewer(serverVer, currentVer)) {
          const deferred = safeStorage.get('confeitex_update_deferred');
          const oneDay = 86400000;
          if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) {
            return serverVer;
          }

          // Evita notificações duplicadas no histórico do sino
          const notifId = 'update_' + serverVer;
          const alreadyNotified = typeof Notifications !== 'undefined'
            && Notifications.getHistory
            && Notifications.getHistory().some(n => n.id === notifId);

          if (!alreadyNotified && typeof Notifications !== 'undefined' && Notifications._recordNotification) {
            Notifications._recordNotification({
              id: notifId,
              type: 'update',
              title: I18n.t('updates.notifTitle'),
              body: I18n.t('updates.notifBody', { version: serverVer }),
              orderIds: [],
              read: false
            });
          }

          // Exibe banner se não estiver visível
          const banner = document.getElementById('updateNotification');
          if (banner && !banner.classList.contains('visible')) {
            this._showUpdateBanner(serverVer, false);
          }
          return serverVer;
        }
        return null;
      } finally {
        this._checking = false;
        this._checkPromise = null;
      }
    })();

    return this._checkPromise;
  },

  // ─── Diálogo de Confirmação ──────────────────────────────────────────────
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

  // ─── Verificação Manual pelo Usuário ─────────────────────────────────────
  async checkManual() {
    const btn = document.getElementById('btnCheckUpdates');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="login-spinner"></span> ' + I18n.t('updates.checking');
    }
    this.updateStatus(I18n.t('updates.checking'));

    // Verificação manual limpa bloqueios de adiamento
    safeStorage.remove('confeitex_update_deferred');

    const serverVer = await this._fetchVersion();
    const currentVer = this.verAtual;
    const lastCheckStr = new Date().toLocaleString((I18n.locales && I18n.locales[I18n.lang]) || 'pt-BR');
    safeStorage.set('confeitex_last_check', lastCheckStr);
    const lastCheckEl = document.getElementById('updatesLastCheck');
    if (lastCheckEl) lastCheckEl.textContent = lastCheckStr;

    if (serverVer && this._isNewer(serverVer, currentVer)) {
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
    } else if (serverVer) {
      // Versão é igual ou menor que a atual: app está 100% atualizado!
      this.updateStatus(I18n.t('updates.upToDate'));
    } else {
      this.updateStatus(I18n.t('updates.noConnection'), true);
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  // ─── Download e Ativação Precisa da Atualização ──────────────────────────
  async downloadUpdate() {
    const newVer = safeStorage.get('confeitex_ver') || this._CODE_VERSION;
    const oldVer = this.verAtual;
    const startedAt = Date.now();

    this._showProgress(newVer);
    safeStorage.remove('confeitex_notified');
    safeStorage.remove('confeitex_update_prompt');
    safeStorage.remove('confeitex_pwa_dismissed');

    // Avisa o Service Worker ativo para pular espera
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      } catch (e) {}
    }

    // Prepara ativação sem deletar cache ativo prematuramente (evita quebrar offline)
    this._updateProgress(20, I18n.t('updates.progressPreparing'));

    const swOk = 'serviceWorker' in navigator;
    if (!swOk) {
      await this._settleProgress(startedAt, I18n.t('updates.progressRegistering'));
      safeStorage.set('confeitex_updated', 'true');
      safeStorage.set('confeitex_last_updated_to', newVer);
      safeStorage.set('confeitex_last_updated_ts', String(Date.now()));
      safeStorage.set('confeitex_ver', newVer);
      this._updateProgress(100, I18n.t('updates.progressDone'));
      await this._delay(600);
      this._showUpdateBanner(newVer, true);
      return;
    }

    // Registra novo Service Worker com a versão explícita
    this._updateProgress(45, I18n.t('updates.progressRegisteringSw'));
    let reg;
    try {
      safeStorage.set('confeitex_updated', 'true');
      safeStorage.set('confeitex_last_updated_to', newVer);
      safeStorage.set('confeitex_last_updated_ts', String(Date.now()));
      reg = await navigator.serviceWorker.register('./sw.js?v=' + encodeURIComponent(newVer));
      if (reg.update) {
        await reg.update().catch(() => {});
      }
    } catch (e) {
      safeStorage.remove('confeitex_updated');
      safeStorage.remove('confeitex_last_updated_to');
      safeStorage.remove('confeitex_last_updated_ts');
      safeStorage.set('confeitex_ver', oldVer);
      this._hideProgress();
      UI.alert(I18n.t('updates.noConnection') + ' ' + I18n.t('updates.retryMsg'));
      return;
    }

    this._updateProgress(70, I18n.t('updates.progressActivating'));
    const ativado = await Promise.race([
      new Promise(resolve => {
        const w = reg.installing || reg.waiting;
        if (w) {
          w.addEventListener('statechange', () => {
            const st = w.state;
            if (st === 'installed' || st === 'activated') resolve(true);
            else if (st === 'redundant') {
              setTimeout(() => resolve(!!(reg.active && reg.active.state === 'activated')), 800);
            }
          });
        } else if (reg.active) {
          resolve(reg.active.state === 'activated');
        } else {
          setTimeout(() => resolve(false), 1200);
        }
      }),
      this._delay(10000).then(() => false)
    ]);

    safeStorage.set('confeitex_updated', 'true');
    safeStorage.set('confeitex_last_updated_to', newVer);
    safeStorage.set('confeitex_last_updated_ts', String(Date.now()));
    safeStorage.set('confeitex_ver', newVer);

    await this._settleProgress(startedAt, I18n.t('updates.progressApplying'));
    this._updateProgress(100, ativado ? I18n.t('updates.progressDone') : I18n.t('updates.progressDoneDeferred'));
    await this._delay(600);
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
    const minMs = 3000;
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
        safeStorage.set('confeitex_last_updated_to', ver);
        safeStorage.set('confeitex_last_updated_ts', String(Date.now()));
        hide();
        // Recarregamento seguro com bypass de cache HTTP de disco
        setTimeout(() => {
          window.location.replace(window.location.origin + window.location.pathname + '?v=' + encodeURIComponent(ver) + '&ts=' + Date.now());
        }, 200);
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
    const current = this.verAtual;
    container.innerHTML = this.changelog.map(v => {
      const isCurrent = v.ver === current;
      const items = v.keys.map(k => I18n.t(k));
      return `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:0.85rem;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.4rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <span style="background:var(--gradient-primary);color:#fff;font-size:0.7rem;font-weight:700;padding:0.15rem 0.55rem;border-radius:50px;letter-spacing:0.3px;">v${v.ver}</span>
            ${isCurrent ? '<span style="background:rgba(16,185,129,0.15);color:var(--color-success);font-size:0.68rem;font-weight:700;padding:0.1rem 0.5rem;border-radius:50px;border:1px solid rgba(16,185,129,0.3);">Instalada</span>' : ''}
          </div>
          <span style="font-size:0.75rem;color:var(--text-muted);">${v.date}</span>
        </div>
        <ul style="margin:0;padding-left:1.25rem;font-size:0.82rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.3rem;line-height:1.45;">
          ${items.map(i => {
            const formatted = i.replace(/^(Novo|New|Melhoria|Improvement|Correção|Fix|Segurança|Security|Acessibilidade|Accessibility|Compatibilidade|Compatibility):/i,
              '<strong style="color:var(--text-primary);">$1:</strong>');
            return `<li>${formatted}</li>`;
          }).join('')}
        </ul>
      </div>
    `;
    }).join('');
  },

  // ─── Forçar Atualização & Limpar Cache ─────────────────────────────────────
  async forceUpdate() {
    const ok = await UI.confirm({
      title: I18n.t('updates.forceConfirmTitle') || 'Forçar Atualização',
      message: I18n.t('updates.forceConfirm') || 'Deseja limpar os arquivos temporários e buscar a versão mais recente do servidor? Seus pedidos e dados salvos NÃO serão afetados.',
      confirmText: I18n.t('updates.forceBtn') || 'Limpar e Atualizar',
      variant: 'primary'
    });

    if (!ok) return;

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(I18n.t('updates.forceSuccess') || 'Limpando cache e recarregando...');
    }

    // Remove travas e cooldowns de atualização
    safeStorage.remove('confeitex_update_deferred');
    safeStorage.remove('confeitex_update_retries');
    safeStorage.remove('confeitex_last_updated_to');
    safeStorage.remove('confeitex_last_updated_ts');
    safeStorage.remove('confeitex_updated');

    // Desregistra Service Workers ativos para forçar novo ciclo limpo
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      } catch (e) {
        console.warn('[Updates] Erro ao desregistrar SW:', e);
      }
    }

    // Limpa todos os caches de assets estáticos da Cache API
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch (e) {
        console.warn('[Updates] Erro ao limpar caches:', e);
      }
    }

    // Recarrega com bypass de cache HTTP
    setTimeout(() => {
      window.location.replace(window.location.origin + window.location.pathname + '?force=1&t=' + Date.now());
    }, 350);
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
