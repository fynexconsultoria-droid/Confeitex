(() => {
  let deferredInstall = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  // Quando um novo SW assumir o controle, recarrega para pegar conteúdo fresco
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    if (!localStorage.getItem('fyntex_pwa_dismissed')) showBanner('android');
  });

  window.addEventListener('load', () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isIOS && !standalone && !localStorage.getItem('fyntex_pwa_dismissed')) setTimeout(() => showBanner('ios'), 2000);
  });

  function showBanner(platform) {
    document.querySelector('.pwa-install-banner')?.remove();
    const banner = document.createElement('div');
    banner.className = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-icon"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></div>
      <div class="pwa-text">
        <h4>Instalar Fyntex</h4>
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
      localStorage.setItem('fyntex_pwa_dismissed', 'true');
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
})();
