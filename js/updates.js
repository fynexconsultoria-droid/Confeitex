const Updates = {
  _CODE_VERSION: '6.1.0',

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
  _promptShowing: false,

  changelog: [
    { ver: '6.1.0', date: '19/09/2026', keys: ['changelog.6100'] },
    { ver: '6.0.0', date: '18/09/2026', keys: ['changelog.6000'] },
    { ver: '5.2.8', date: '17/09/2026', keys: ['changelog.5280'] },
    { ver: '5.2.7', date: '17/09/2026', keys: ['changelog.5270'] },
    { ver: '5.2.6', date: '17/09/2026', keys: ['changelog.5260'] },
    { ver: '5.2.5', date: '17/09/2026', keys: ['changelog.5250'] },
    { ver: '5.2.4', date: '17/09/2026', keys: ['changelog.5240'] },
    { ver: '5.2.3', date: '17/09/2026', keys: ['changelog.5230'] },
    { ver: '5.2.2', date: '17/09/2026', keys: ['changelog.5220'] },
    { ver: '5.2.1', date: '16/09/2026', keys: ['changelog.5210'] },
    { ver: '5.1.0', date: '14/09/2026', keys: ['changelog.5100'] },
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

          // Exibe modal de update se não foi notificado
          this.promptUpdate(serverVer);
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
    if (this._promptShowing) return;
    this._promptShowing = true;
    try {
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
        
        if (typeof Notifications !== 'undefined' && Notifications._recordNotification) {
          Notifications._recordNotification({
            id: 'update_deferred_' + serverVer,
            type: 'update',
            title: I18n.t('updates.notifTitle') || 'Atualização Disponível',
            body: I18n.t('updates.notifBody', { version: serverVer }) || `A versão ${serverVer} está disponível para download.`,
            orderIds: [],
            read: false
          });
        }
      }
    } finally {
      this._promptShowing = false;
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
      this.promptUpdateReady(newVer);
      return;
    }

    // Registra/atualiza Service Worker com URL fixa
    this._updateProgress(45, I18n.t('updates.progressRegisteringSw'));
    let reg;
    try {
      safeStorage.set('confeitex_updated', 'true');
      safeStorage.set('confeitex_last_updated_to', newVer);
      safeStorage.set('confeitex_last_updated_ts', String(Date.now()));
      
      if (typeof Notifications !== 'undefined' && Notifications._idbSet) {
        await Notifications._idbSet('confeitex_allow_update_once', 'true');
      }
      
      reg = await navigator.serviceWorker.register('./sw.js');
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
    const instalado = await Promise.race([
      new Promise(resolve => {
        const w = reg.installing || reg.waiting;
        if (w) {
          w.addEventListener('statechange', () => {
            if (w.state === 'installed') resolve(true);
            else if (w.state === 'redundant') resolve(false);
          });
        } else if (reg.active) {
          resolve(true);
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
    this._updateProgress(100, instalado ? I18n.t('updates.progressDone') : I18n.t('updates.progressDoneDeferred'));
    this.promptUpdateReady(newVer);
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

  async promptUpdateReady(ver) {
    if (this._promptShowing) return;
    this._promptShowing = true;
    try {
      const ok = await UI.confirm({
        title: I18n.t('updates.promptTitle') || '📦 Nova Atualização Disponível',
        message: I18n.t('updates.installedTitle', { version: ver }) || `✅ Atualização Confeitex v${ver} instalada! Deseja recarregar agora para aplicar as mudanças?`,
        confirmText: I18n.t('updates.reloadNow') || 'Recarregar',
        cancelText: I18n.t('updates.laterNextOpen') || 'Na próxima abertura',
        variant: 'primary'
      });

      if (ok) {
        this.applyUpdateAndReload(ver);
      } else {
        safeStorage.set('confeitex_update_pending', ver);
        safeStorage.set('confeitex_updated', 'true');
        safeStorage.set('confeitex_update_deferred', String(Date.now()));
        
        const heroReloadBtn = document.getElementById('btnHeroReload');
        const upToDateBadge = document.getElementById('updatesUpToDateBadge');
        if (heroReloadBtn) heroReloadBtn.style.display = 'inline-flex';
        if (upToDateBadge) upToDateBadge.style.display = 'none';
        UI.toast(I18n.t('updates.toastApplyLater') || '✅ App atualizado na próxima abertura.');
        
        if (typeof Notifications !== 'undefined' && Notifications._recordNotification) {
          Notifications._recordNotification({
            id: 'update_ready_' + ver,
            type: 'update',
            title: I18n.t('updates.installedTitle', { version: ver }).split('!')[0] + '!' || 'Atualização Pronta!',
            body: I18n.t('updates.toastApplyLater') || 'Recarregue o app para aplicar.',
            orderIds: [],
            read: false
          });
        }
      }
    } finally {
      this._promptShowing = false;
    }
  },
  applyUpdateAndReload(ver) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    
    // Pequeno atraso para garantir que o SW receba a mensagem e comece a ativar
    setTimeout(() => {
      window.location.replace(
        window.location.origin + window.location.pathname +
        '?v=' + encodeURIComponent(ver) + '&ts=' + Date.now()
      );
    }, 400);
  },

  render() {
    const displayVer = this.verAtual;
    safeStorage.set('confeitex_ver', displayVer);

    // Hero: versão
    const curVerEl = document.getElementById('updatesCurrentVer');
    if (curVerEl) curVerEl.textContent = `v${displayVer}`;

    // Sidebar version
    const sidebarVersion = document.getElementById('sidebarVersion');
    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;

    // Última verificação
    const lastCheck = safeStorage.get('confeitex_last_check');
    const lastCheckEl = document.getElementById('updatesLastCheck');
    if (lastCheckEl) lastCheckEl.textContent = lastCheck || I18n.t('updates.neverChecked');

    // Badge "Atualizado" e botão de Recarregar no hero
    const upToDateBadge = document.getElementById('updatesUpToDateBadge');
    const heroReloadBtn = document.getElementById('btnHeroReload');
    const pendingVer = safeStorage.get('confeitex_update_pending');
    if (upToDateBadge) upToDateBadge.style.display = pendingVer ? 'none' : 'inline-flex';
    if (heroReloadBtn) {
      if (pendingVer) {
        heroReloadBtn.style.display = 'inline-flex';
        heroReloadBtn.onclick = () => {
          heroReloadBtn.disabled = true;
          heroReloadBtn.innerHTML = '<span class="login-spinner"></span>';
          this.applyUpdateAndReload(pendingVer);
        };
      } else {
        heroReloadBtn.style.display = 'none';
      }
    }

    // Info do Sistema
    this._renderSysInfo();

    this.renderChangelog();
    this.updateStatus('');
  },

  _renderSysInfo() {
    // Plataforma
    const siPlatform = document.getElementById('siPlatform');
    if (siPlatform) {
      const ua = navigator.userAgent;
      let plat = 'Desktop';
      
      if (/Android/i.test(ua)) {
        const version = (ua.match(/Android ([\d.]+)/) || ['',''])[1];
        let device = '';
        const uaInfo = ua.match(/\(([^)]+)\)/);
        if (uaInfo && uaInfo[1]) {
          const tokens = uaInfo[1].split(';');
          for (let token of tokens) {
            token = token.trim();
            if (token === 'Linux' || token === 'U' || token.startsWith('Android') || 
                /^[a-z]{2}-[a-z]{2}$/i.test(token) || /^[a-z]{2}_[a-z]{2}$/i.test(token) || token === 'wv') {
              continue;
            }
            device = token.split(' Build/')[0].trim();
            break;
          }
        }
        plat = `Android ${version}${device ? ' - ' + device : ''}`;
      }
      else if (/iPhone/i.test(ua)) {
        const match = ua.match(/OS ([\d_]+) like Mac OS X/);
        const version = match ? match[1].replace(/_/g, '.') : '';
        plat = `iPhone (iOS ${version})`.trim();
      }
      else if (/iPad/i.test(ua)) {
        const match = ua.match(/OS ([\d_]+) like Mac OS X/);
        const version = match ? match[1].replace(/_/g, '.') : '';
        plat = `iPad (iOS ${version})`.trim();
      }
      else if (/Windows/i.test(ua)) {
        const match = ua.match(/Windows NT ([\d.]+)/);
        let version = match ? match[1] : '';
        if (version === '10.0') version = '10/11';
        else if (version === '6.3') version = '8.1';
        else if (version === '6.2') version = '8';
        else if (version === '6.1') version = '7';
        plat = `Windows ${version}`.trim();
      }
      else if (/Mac/i.test(ua)) {
        const match = ua.match(/Mac OS X ([\d_]+)/);
        const version = match ? match[1].replace(/_/g, '.') : '';
        plat = `macOS ${version}`.trim();
      }

      siPlatform.textContent = plat;

      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        navigator.userAgentData.getHighEntropyValues(['model']).then(data => {
          if (data.model) {
            if (plat.startsWith('Android')) {
              const version = (ua.match(/Android ([\d.]+)/) || ['',''])[1];
              siPlatform.textContent = `Android ${version} - ${data.model}`;
            } else if (plat !== 'Desktop') {
              siPlatform.textContent = `${plat.split(' ')[0]} - ${data.model}`;
            }
          }
        }).catch(() => {});
      }
    }

    // Service Worker
    const siSw = document.getElementById('siSwStatus');
    if (siSw) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
          if (reg && reg.active) {
            siSw.innerHTML = '<span style="color:var(--color-success)">✓ Ativo</span>';
          } else if (reg) {
            siSw.innerHTML = '<span style="color:var(--color-warning,#f59e0b)">⏳ Instalando</span>';
          } else {
            siSw.innerHTML = '<span style="color:var(--color-danger)">✗ Não registrado</span>';
          }
        }).catch(() => { siSw.textContent = 'Erro'; });
      } else {
        siSw.innerHTML = '<span style="color:var(--color-danger)">✗ Não suportado</span>';
      }
    }

    // Cache
    const siCache = document.getElementById('siCacheStatus');
    if (siCache) {
      if ('caches' in window) {
        caches.keys().then(keys => {
          const confeitexCaches = keys.filter(k => k.startsWith('confeitex-'));
          siCache.innerHTML = `<span style="color:var(--color-success)">✓ ${confeitexCaches.length} cache(s)</span>`;
        }).catch(() => { siCache.textContent = '—'; });
      } else {
        siCache.innerHTML = '<span style="color:var(--color-danger)">✗ Não suportado</span>';
      }
    }

    // Conexão
    const siConn = document.getElementById('siConnectionStatus');
    if (siConn) {
      const online = navigator.onLine;
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (!online) {
        siConn.textContent = '🔴 Offline';
      } else if (conn) {
        // Detecta tipo de conexão: WiFi vs Dados Móveis
        let connType = '';
        if (conn.type === 'wifi') {
          connType = 'WiFi';
        } else if (conn.type === 'cellular') {
          connType = 'Dados Móveis';
          if (conn.effectiveType) connType += ` (${conn.effectiveType.toUpperCase()})`;
        } else if (conn.type === 'ethernet') {
          connType = 'Ethernet';
        } else if (conn.effectiveType) {
          // Fallback: tenta adivinhar pelo effectiveType e downlink
          const speed = conn.downlink || 0;
          if (speed >= 10) {
            connType = `WiFi (${conn.effectiveType.toUpperCase()})`;
          } else {
            connType = `Online (${conn.effectiveType.toUpperCase()})`;
          }
        } else {
          connType = 'Online';
        }
        siConn.textContent = '🟢 ' + connType;
      } else {
        siConn.textContent = '🟢 Online';
      }
    }

    // PWA instalada
    const siPwa = document.getElementById('siPwaStatus');
    if (siPwa) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
      siPwa.innerHTML = isStandalone
        ? '<span style="color:var(--color-success)">✓ Sim</span>'
        : '<span style="color:var(--text-muted)">Não (navegador)</span>';
    }
  },

  renderChangelog() {
    const container = document.getElementById('updatesChangelog');
    if (!container) return;
    const current = this.verAtual;

    container.innerHTML = this.changelog.map(v => {
      const isCurrent = v.ver === current;
      const items = v.keys.map(k => I18n.t(k));

      // Separa itens por ponto-e-vírgula para listar bullet points
      const bullets = items.flatMap(i => i.split(';').map(s => s.trim()).filter(Boolean));

      const bulletsHtml = bullets.map(b => {
        // Destaca prefixos conhecidos
        const formatted = b.replace(
          /^(Novo|New|Melhoria|Improvement|Corre[çc][aã]o|Fix|Seguran[çc]a|Security|Acessibilidade|Accessibility|Compatibilidade|Compatibility|patch|Confeitex\s[\d.]+\s*[\(\[]?patch[\)\]]?)[:—]?/i,
          (m) => `<strong style="color:var(--text-primary);">${m}</strong>`
        );
        return `<span style="display:block;padding:0.15rem 0;">· ${formatted}</span>`;
      }).join('');

      return `
        <div class="cl-item${isCurrent ? ' cl-current' : ''}">
          <div class="cl-dot">${isCurrent ? '★' : '✓'}</div>
          <div class="cl-body">
            <div class="cl-head">
              <span class="cl-ver">v${v.ver}</span>
              ${isCurrent ? `<span class="cl-badge-current" data-i18n="updates.installed">Instalada</span>` : ''}
              <span class="cl-date">${v.date}</span>
            </div>
            <div class="cl-text">${bulletsHtml}</div>
          </div>
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

window.addEventListener('online', () => { if (typeof Updates !== 'undefined' && document.getElementById('siConnectionStatus')) Updates.renderInfo(); });
window.addEventListener('offline', () => { if (typeof Updates !== 'undefined' && document.getElementById('siConnectionStatus')) Updates.renderInfo(); });
