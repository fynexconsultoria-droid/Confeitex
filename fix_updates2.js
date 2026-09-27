const fs = require('fs');
let js = fs.readFileSync('js/updates.js', 'utf8');

const startStr = '  async promptUpdate(serverVer) {';
const endStr = '  render() {';

const startIndex = js.indexOf(startStr);
const endIndex = js.indexOf(endStr);

const newLogic = `  async promptUpdate(serverVer) {
    if (this._promptShowing) return;
    this._promptShowing = true;
    try {
      const ok = await UI.confirm({
        title: I18n.t('updates.promptTitle') || 'Atualização Disponível',
        message: I18n.t('updates.promptMsg', { version: serverVer }) || \`Uma nova versão (\${serverVer}) foi encontrada. Deseja aplicar a atualização agora?\`,
        confirmText: I18n.t('updates.updateNow') || 'Atualizar Agora',
        cancelText: I18n.t('updates.later') || 'Mais Tarde',
        variant: 'primary'
      });

      if (ok) {
        safeStorage.remove('confeitex_update_deferred');
        await this.applyUpdateDirectly(serverVer);
      } else {
        safeStorage.set('confeitex_update_deferred', String(Date.now()));
        UI.toast(I18n.t('updates.toastLater') || 'Atualização adiada.');
      }
    } finally {
      this._promptShowing = false;
    }
  },

  async applyUpdateDirectly(ver) {
    this._showProgress(ver);
    this._updateProgress(30, 'Limpando cache antigo...');

    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let reg of regs) {
          await reg.unregister();
        }
      } catch(e){}
    }
    
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        for (let key of keys) {
          if (key.includes('confeitex-cache')) {
            await caches.delete(key);
          }
        }
      }
    } catch(e){}

    this._updateProgress(80, 'Aplicando nova versão...');
    safeStorage.set('confeitex_ver', ver);
    safeStorage.set('confeitex_updated', 'true');
    safeStorage.set('confeitex_last_updated_to', ver);
    safeStorage.set('confeitex_last_updated_ts', String(Date.now()));

    this._updateProgress(100, 'Reiniciando...');
    setTimeout(() => {
      window.location.href = window.location.origin + window.location.pathname + '?v=' + encodeURIComponent(ver) + '&ts=' + Date.now();
    }, 1000);
  },

  async downloadUpdate() {
    // Wrapper para compatibilidade caso outro lugar chame
    const ver = safeStorage.get('confeitex_ver') || this.verAtual;
    await this.applyUpdateDirectly(ver);
  },

  async promptUpdateReady(ver) {
    // Compatibilidade
    this.applyUpdateDirectly(ver);
  },

  applyUpdateAndReload(ver) {
    this.applyUpdateDirectly(ver);
  },

`;

js = js.substring(0, startIndex) + newLogic + js.substring(endIndex);

fs.writeFileSync('js/updates.js', js, 'utf8');
console.log("Replaced cleanly.");
