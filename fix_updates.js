const fs = require('fs');
let js = fs.readFileSync('js/updates.js', 'utf8');

// We will replace everything from `async promptUpdate` to the end of `applyUpdateAndReload`.
// First, find the start of `async promptUpdate(serverVer) {`
const startStr = '  async promptUpdate(serverVer) {';
const startIndex = js.indexOf(startStr);

// Find the end of `applyUpdateAndReload(ver) { ... }`
// The next method is `render() {`
const endStr = '  render() {';
const endIndex = js.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find blocks.");
  process.exit(1);
}

const newLogic = `  async promptUpdate(serverVer) {
    if (this._promptShowing) return;
    this._promptShowing = true;
    try {
      const ok = await UI.confirm({
        title: I18n.t('updates.promptTitle') || 'Atualização Disponível',
        message: \`Uma nova correção/versão (\${serverVer}) está disponível. Deseja atualizar agora?\`,
        confirmText: 'Atualizar Agora',
        cancelText: 'Mais Tarde',
        variant: 'primary'
      });

      if (ok) {
        safeStorage.remove('confeitex_update_deferred');
        await this.applyUpdateDirectly(serverVer);
      } else {
        safeStorage.set('confeitex_update_deferred', String(Date.now()));
        UI.toast('Atualização adiada para depois.');
      }
    } finally {
      this._promptShowing = false;
    }
  },

  async applyUpdateDirectly(ver) {
    this._showProgress(ver);
    this._updateProgress(30, 'Limpando cache antigo...');

    // Desregistra SW e limpa caches para garantir zero loop
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

  // Preserved for compatibility if called elsewhere
  async downloadUpdate() {
     // fallback
  },
  async promptUpdateReady(ver) {
     // fallback
  },
  applyUpdateAndReload(ver) {
     this.applyUpdateDirectly(ver);
  },

`;

js = js.substring(0, startIndex) + newLogic + js.substring(endIndex);

fs.writeFileSync('js/updates.js', js, 'utf8');
console.log("Updated js/updates.js successfully.");
