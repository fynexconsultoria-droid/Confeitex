(() => {
  let deferredInstall = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swVer = localStorage.getItem('confeitex_ver') || (typeof Updates !== 'undefined' ? Updates.verAtual : '1.10.2');
      navigator.serviceWorker.register('./sw.js?v=' + swVer).catch(() => {});
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (!localStorage.getItem('confeitex_pwa_dismissed')) showBanner('android');
  });

  window.addEventListener('load', () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !standalone && !localStorage.getItem('confeitex_pwa_dismissed')) setTimeout(() => showBanner('ios'), 2000);
  });

  function showBanner(platform) {
    document.querySelector('.pwa-install-banner')?.remove();
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
      <div class="pwa-text">
        <h4>Instalar Confeitex</h4>
        <p>${platform === 'ios' ? 'Toque em <strong>Compartilhar</strong> ⬆ e depois <strong>"Adicionar à Tela de Início"</strong>' : 'Adicione o app à tela inicial para acesso rápido!'}</p>
      </div>
      <div class="pwa-actions">
        ${platform !== 'ios' ? '<button class="pwa-btn-install">Instalar</button>' : ''}
        <button class="pwa-btn-dismiss">Agora não</button>
      </div>`;
    document.body.appendChild(banner);
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));

    banner.querySelector('.pwa-btn-install')?.addEventListener('click', async () => {
      deferredInstall?.prompt();
      const { outcome } = await (deferredInstall?.userChoice || Promise.resolve({ outcome: 'dismissed' }));
      deferredInstall = null;
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 500);
    });

    banner.querySelector('.pwa-btn-dismiss')?.addEventListener('click', () => {
      localStorage.setItem('confeitex_pwa_dismissed', 'true');
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 500);
    });

    setTimeout(() => {
      if (banner.classList.contains('visible')) {
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 500);
      }
    }, 15000);
  }

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    document.querySelector('.pwa-install-banner')?.remove();
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

    // Overlay "gire o celular": exibe em todos os navegadores quando a tela
    // ficar na horizontal (mesmo quando o lock acima falha silenciosamente,
    // ex: iOS Safari ou quando o app roda fora do modo instalado/fullscreen).
    const overlay = document.createElement('div');
    overlay.className = 'rotate-overlay';
    overlay.innerHTML = `
      <div class="rotate-overlay-box">
        <div class="rotate-phone">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18"/></svg>
        </div>
        <h3>Gire o celular</h3>
        <p>Use o Confeitex na vertical para uma melhor experiência.</p>
      </div>`;
    document.body.appendChild(overlay);

    const checkOrientation = () => {
      overlay.classList.toggle('visible', window.innerHeight < window.innerWidth);
    };
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    checkOrientation();
  }
})();
