/**
 * Confeitex — updates.js
 * Gerenciamento de atualizações do app via Service Worker e version.txt.
 * Expõe: verAtual, checkAndUpdate, promptUpdateReady, render, setup.
 */

import { I18n } from './i18n.js';
import { UI } from './ui.js';
import { safeStorage } from './utils.js';

// Lê a versão do meta tag do HTML (definida em index.html)
const _getVerAtual = () => {
  const el = document.querySelector('meta[name="version"]');
  return el ? el.getAttribute('content') : '1.0 beta';
};

export const Updates = {
  // ─── Versão atual do app (lida do meta tag ou localStorage) ─────────────
  get verAtual() {
    return safeStorage.get('confeitex_ver') || _getVerAtual();
  },

  // ─── Estado interno ──────────────────────────────────────────────────────
  _checking: false,
  _lastCheckEl: null,

  // ─────────────────────────────────────────────────────────────────────────
  // setup — inicializa botões da aba de atualizações
  // ─────────────────────────────────────────────────────────────────────────
  setup() {
    if ('serviceWorker' in navigator && !navigator.serviceWorker._hasControllerListener) {
      navigator.serviceWorker._hasControllerListener = true;
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    // Botão "Verificar Agora"
    const btnCheck = document.getElementById('btnCheckUpdate');
    if (btnCheck && !btnCheck.dataset.hasListener) {
      btnCheck.dataset.hasListener = '1';
      btnCheck.addEventListener('click', () => this.checkAndUpdate());
    }

    // Botão "Atualizar Agora" (na barra de notificação)
    const btnNow = document.getElementById('btnUpdateNow');
    if (btnNow && !btnNow.dataset.hasListener) {
      btnNow.dataset.hasListener = '1';
      btnNow.addEventListener('click', () => this._applyUpdate());
    }

    // Botão "Mais Tarde"
    const btnLater = document.getElementById('btnUpdateLater');
    if (btnLater && !btnLater.dataset.hasListener) {
      btnLater.dataset.hasListener = '1';
      btnLater.addEventListener('click', () => {
        safeStorage.set('confeitex_update_deferred', String(Date.now()));
        this._hideUpdateBar();
        UI.toast(I18n.t('updates.toastApplyLater'));
      });
    }

    // Botão "Fechar App"
    const btnClose = document.getElementById('btnUpdateCloseApp');
    if (btnClose && !btnClose.dataset.hasListener) {
      btnClose.dataset.hasListener = '1';
      btnClose.addEventListener('click', () => window.close());
    }

    // Botão "Forçar Atualização"
    const btnForce = document.getElementById('btnForceUpdate');
    if (btnForce && !btnForce.dataset.hasListener) {
      btnForce.dataset.hasListener = '1';
      btnForce.addEventListener('click', () => this._forceUpdate());
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // render — renderiza a aba "Atualizações" nas configurações
  // ─────────────────────────────────────────────────────────────────────────
  render() {
    // Atualiza versão atual
    const verEls = document.querySelectorAll('[data-updates-ver]');
    verEls.forEach(el => { el.textContent = 'v' + this.verAtual; });

    // Atualiza última verificação
    const lastCheck = safeStorage.get('confeitex_last_auto_check');
    const lastCheckEl = document.getElementById('updatesLastCheck');
    if (lastCheckEl) {
      if (lastCheck) {
        const d = new Date(parseInt(lastCheck, 10));
        lastCheckEl.textContent = d.toLocaleString();
      } else {
        lastCheckEl.textContent = I18n.t('updates.neverChecked');
      }
    }

    // Atualiza status de conexão
    const statusEl = document.getElementById('updatesConnectionStatus');
    if (statusEl) {
      statusEl.textContent = navigator.onLine
        ? I18n.t('updates.onlineStatus')
        : I18n.t('updates.offlineStatus');
    }

    // Atualiza info do sistema
    this._renderSystemInfo();
  },

  _renderSystemInfo() {
    const swEl = document.getElementById('updatesSWStatus');
    if (swEl) {
      swEl.textContent = 'serviceWorker' in navigator ? 'Ativo' : 'Não suportado';
    }
    const pwaEl = document.getElementById('updatesPWAStatus');
    if (pwaEl) {
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone;
      pwaEl.textContent = standalone ? 'Sim' : 'Não';
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // checkAndUpdate — verifica version.txt na rede e compara com a versão local
  // ─────────────────────────────────────────────────────────────────────────
  async checkAndUpdate() {
    if (this._checking) return;
    if (!navigator.onLine) {
      UI.toast(I18n.t('updates.noConnection'));
      return;
    }

    this._checking = true;
    const btnCheck = document.getElementById('btnCheckUpdate');
    const originalText = btnCheck ? btnCheck.textContent : '';
    if (btnCheck) btnCheck.textContent = I18n.t('updates.checking');

    try {
      const res = await fetch('./version.txt', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const serverVer = (await res.text()).trim();
      safeStorage.set('confeitex_last_auto_check', String(Date.now()));
      this.render();

      if (serverVer && serverVer !== this.verAtual) {
        safeStorage.set('confeitex_update_pending', serverVer);
        this._triggerSWUpdate(serverVer);
      } else {
        UI.toast(I18n.t('updates.upToDate'));
      }
    } catch (e) {
      console.warn('[Updates] Erro ao verificar versão:', e.message);
      UI.toast(I18n.t('updates.noConnection'));
    } finally {
      this._checking = false;
      if (btnCheck) btnCheck.textContent = originalText;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // checkSilent — verifica atualizações silenciosamente (ideal para pull-to-refresh)
  // ─────────────────────────────────────────────────────────────────────────
  async checkSilent() {
    if (this._checking || !navigator.onLine) return;
    this._checking = true;
    try {
      const res = await fetch('./version.txt', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const serverVer = (await res.text()).trim();
      safeStorage.set('confeitex_last_auto_check', String(Date.now()));
      this.render();
      if (serverVer && serverVer !== this.verAtual) {
        safeStorage.set('confeitex_update_pending', serverVer);
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('🚀 Nova atualização do app encontrada!', 'primary');
        }
        this._triggerSWUpdate(serverVer);
      }
    } catch (e) {
      console.warn('[Updates] Erro ao checar versão silenciosa:', e.message);
    } finally {
      this._checking = false;
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _triggerSWUpdate — instrui o SW a buscar e instalar a nova versão
  // ─────────────────────────────────────────────────────────────────────────
  async _triggerSWUpdate(newVer) {
    if (!('serviceWorker' in navigator)) {
      UI.toast(I18n.t('updates.newFound', { version: newVer }));
      return;
    }

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        // Se já tem um update esperando
        if (reg.waiting) {
          safeStorage.set('confeitex_last_updated_to', newVer);
          this.promptUpdateReady(newVer);
        }

        // Aguarda a instalação da nova versão
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                safeStorage.set('confeitex_last_updated_to', newVer);
                this.promptUpdateReady(newVer);
              }
            });
          }
        });

        await reg.update();
      }
    } catch (e) {
      console.warn('[Updates] Erro ao acionar SW update:', e.message);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // promptUpdateReady — exibe a barra de notificação de atualização disponível
  // ─────────────────────────────────────────────────────────────────────────
  promptUpdateReady(newVer) {
    const bar = document.getElementById('updateNotification');
    const textEl = document.getElementById('updateNotifText');
    const progress = document.getElementById('updateProgress');
    const actions = document.getElementById('updateActions');

    if (!bar) return;

    if (textEl) textEl.textContent = I18n.t('updates.installedTitle', { version: newVer || '' });
    if (progress) progress.style.display = 'none';
    if (actions) actions.style.display = 'flex';

    bar.classList.add('active');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _applyUpdate — instrui o SW a assumir e recarrega a página
  // ─────────────────────────────────────────────────────────────────────────
  async _applyUpdate() {
    UI.toast(I18n.t('updates.toastReload'));
    safeStorage.set('confeitex_updated', 'true');
    safeStorage.set('confeitex_ver', safeStorage.get('confeitex_last_updated_to') || this.verAtual);

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        setTimeout(() => location.reload(), 800);
      }
    } catch (_) {
      setTimeout(() => location.reload(), 800);
    }
  },

  _hideUpdateBar() {
    const bar = document.getElementById('updateNotification');
    if (bar) bar.classList.remove('active');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // _forceUpdate — limpa o cache e força recarregamento total
  // ─────────────────────────────────────────────────────────────────────────
  async _forceUpdate() {
    const confirmed = await UI.confirm({
      title: I18n.t('updates.forceConfirmTitle'),
      message: I18n.t('updates.forceConfirm'),
      confirmText: I18n.t('common.confirm') || 'Confirmar',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      UI.toast(I18n.t('updates.forceSuccess'));
    } catch (_) {}

    setTimeout(() => location.reload(true), 1000);
  }
};
