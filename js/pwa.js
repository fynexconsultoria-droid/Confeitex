/**
 * Confeitex — pwa.js
 * Gerencia instalação do PWA e trava de orientação de tela.
 */
import { safeStorage } from './utils.js';

(() => {
  let deferredInstall = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Registra SW com URL fixa — o browser detecta mudanças por diff do conteúdo
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (!safeStorage.get('confeitex_pwa_dismissed')) showBanner('android');
  });

  window.addEventListener('load', () => {
    const ua = navigator.userAgent || '';
    const isInstagram = /Instagram|FBAN|FBAV/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (standalone) return;

    if (isInstagram && !safeStorage.get('confeitex_pwa_dismissed')) {
      setTimeout(() => showBanner('inapp'), 2500);
    } else if (isIOS && !safeStorage.get('confeitex_pwa_dismissed')) {
      setTimeout(() => showBanner('ios'), 2000);
    }
  });

  function showBanner(platform) {
    const existing = document.querySelector('.pwa-install-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';

    let desc = 'Adicione o app à tela inicial para acesso rápido!';
    if (platform === 'inapp') {
      desc = 'Para instalar: toque nos 3 pontinhos (<strong>⋮</strong> ou <strong>⋯</strong>) no topo e escolha <strong>"Abrir no navegador"</strong>.';
    } else if (platform === 'ios') {
      desc = 'Toque em <strong>Compartilhar</strong> ⬆ e depois <strong>"Adicionar à Tela de Início"</strong>';
    }

    banner.innerHTML = `
      <div class="pwa-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
      <div class="pwa-text">
        <h4>Instalar Confeitex</h4>
        <p>${desc}</p>
      </div>
      <div class="pwa-actions">
        ${platform === 'android' ? '<button class="pwa-btn-install">Instalar</button>' : ''}
        <button class="pwa-btn-dismiss">${platform === 'inapp' ? 'Entendi' : 'Agora não'}</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));

    const installBtn = banner.querySelector('.pwa-btn-install');
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (deferredInstall) deferredInstall.prompt();
        const result = deferredInstall ? deferredInstall.userChoice : Promise.resolve({ outcome: 'dismissed' });
        const choice = await result;
        deferredInstall = null;
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 500);
      });
    }

    const dismissBtn = banner.querySelector('.pwa-btn-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        safeStorage.set('confeitex_pwa_dismissed', 'true');
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 500);
      });
    }

    setTimeout(() => {
      if (banner.classList.contains('visible')) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 500);
      }
    }, 15000);
  }

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    const existing = document.querySelector('.pwa-install-banner');
    if (existing) existing.remove();
  });

  // ===== Trava a tela em retrato nos dispositivos =====
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    try {
      const so = screen.orientation || screen.mozOrientation || screen.msOrientation;
      if (so && typeof so.lock === 'function') {
        so.lock('portrait').catch(() => {});
      }
    } catch (e) {}
  }
})();
