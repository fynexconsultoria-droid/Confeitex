/**
 * Confeitex — landing.js
 * Lógica da Página de Demonstração, Instalação PWA e Simulação Interativa
 */

(() => {
  'use strict';

  // ─── 1. PWA Install Handler ──────────────────────────────────────────────
  let deferredInstallPrompt = null;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isInstagram = /Instagram|FBAN|FBAV/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  // Modal de Download
  const downloadModal = document.getElementById('downloadModal');
  const btnCloseDownloadModal = document.getElementById('closeDownloadModal');
  const modalDeviceTips = document.getElementById('modalDeviceTips');

  function openDownloadModal() {
    if (!downloadModal) return;

    // Se estiver no Android com o evento de PWA pronto, podemos acionar direto!
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          console.log('[PWA] Usuário aceitou instalar.');
          deferredInstallPrompt = null;
          return;
        }
      }).catch(() => {});
    }

    // Configura as instruções visuais adequadas ao dispositivo
    if (modalDeviceTips) {
      if (isInstagram) {
        modalDeviceTips.innerHTML = `
          <div class="d-step">
            <div class="d-step-num">1</div>
            <div class="d-step-text">Toque nos <strong>3 pontinhos (⋮ ou ⋯)</strong> no canto superior direito do Instagram.</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">2</div>
            <div class="d-step-text">Escolha <strong>"Abrir no navegador"</strong> (Chrome ou Safari).</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">3</div>
            <div class="d-step-text">No navegador, toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela de início"</strong>.</div>
          </div>
        `;
      } else if (isIOS) {
        modalDeviceTips.innerHTML = `
          <div class="d-step">
            <div class="d-step-num">1</div>
            <div class="d-step-text">No Safari, toque no ícone de <strong>Compartilhar (⬆)</strong> na barra inferior.</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">2</div>
            <div class="d-step-text">Role para baixo e selecione <strong>"Adicionar à Tela de Início" (➕)</strong>.</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">3</div>
            <div class="d-step-text">Toque em <strong>Adicionar</strong>. O Confeitex aparecerá como um app normal no seu iPhone!</div>
          </div>
        `;
      } else {
        modalDeviceTips.innerHTML = `
          <div class="d-step">
            <div class="d-step-num">1</div>
            <div class="d-step-text">No Chrome do seu Android, toque nos <strong>3 pontinhos (⋮)</strong> no topo.</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">2</div>
            <div class="d-step-text">Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.</div>
          </div>
          <div class="d-step">
            <div class="d-step-num">3</div>
            <div class="d-step-text">Pronto! O app instala em segundos sem precisar de loja ou Play Store.</div>
          </div>
        `;
      }
    }

    downloadModal.classList.add('active');
  }

  function closeDownloadModal() {
    if (downloadModal) downloadModal.classList.remove('active');
  }

  if (btnCloseDownloadModal) {
    btnCloseDownloadModal.addEventListener('click', closeDownloadModal);
  }

  if (downloadModal) {
    downloadModal.addEventListener('click', (e) => {
      if (e.target === downloadModal) closeDownloadModal();
    });
  }

  // Todos os botões de Download na página
  document.querySelectorAll('.btn-trigger-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openDownloadModal();
    });
  });

  // ─── 2. Simulação Interativa do Smartphone ────────────────────────────────
  const demoTabs = document.querySelectorAll('.demo-tab-btn');
  const demoViews = document.querySelectorAll('.phone-view');
  const phoneBottomNav = document.querySelectorAll('.pbn-item');

  function switchDemoTab(tabName) {
    demoTabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.demo === tabName);
    });

    demoViews.forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabName}`);
    });

    phoneBottomNav.forEach(pbn => {
      pbn.classList.toggle('active', pbn.dataset.pbn === tabName);
    });
  }

  demoTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.demo;
      if (tab) switchDemoTab(tab);
    });
  });

  // ─── 3. FAQ Accordion ───────────────────────────────────────────────────
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const q = item.querySelector('.faq-question');
    if (q) {
      q.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        // Fecha outros itens
        faqItems.forEach(other => other.classList.remove('active'));
        if (!isActive) item.classList.add('active');
      });
    }
  });

  // ─── 5. Modal de Checkout Mercado Pago ───────────────────────────────────
  const mpModal = document.getElementById('mpModal');
  const btnCloseMpModal = document.getElementById('closeMpModal');
  const btnGoToMp = document.getElementById('btnGoToMp');
  const defaultCheckoutUrl = 'https://link.mercadopago.com.br/';

  function getMercadoPagoUrl() {
    return localStorage.getItem('confeitex_mp_checkout_link') || 
           localStorage.getItem('confeitex_checkout_url') || 
           defaultCheckoutUrl;
  }

  function openMpModal() {
    if (mpModal) {
      if (btnGoToMp) {
        btnGoToMp.href = getMercadoPagoUrl();
      }
      mpModal.classList.add('active');
    }
  }

  function closeMpModal() {
    if (mpModal) mpModal.classList.remove('active');
  }

  if (btnCloseMpModal) {
    btnCloseMpModal.addEventListener('click', closeMpModal);
  }

  if (mpModal) {
    mpModal.addEventListener('click', (e) => {
      if (e.target === mpModal) closeMpModal();
    });
  }

  // ─── 4. Modal de Chave de Ativação / Desbloqueio ──────────────────────────
  const unlockModal = document.getElementById('unlockModal');
  const btnCloseUnlock = document.getElementById('closeUnlockModal');
  const btnOpenUnlock = document.querySelectorAll('.btn-trigger-unlock');
  const btnConfirmKey = document.getElementById('btnConfirmKey');
  const inputKey = document.getElementById('inputActivationKey');
  const keyError = document.getElementById('keyErrorMsg');

  function openUnlockModal() {
    closeMpModal();
    if (unlockModal) {
      if (keyError) keyError.style.display = 'none';
      if (inputKey) inputKey.value = '';
      unlockModal.classList.add('active');
    }
  }

  function closeUnlockModal() {
    if (unlockModal) unlockModal.classList.remove('active');
  }

  btnOpenUnlock.forEach(b => {
    b.addEventListener('click', (e) => {
      e.preventDefault();
      openUnlockModal();
    });
  });

  if (btnCloseUnlock) {
    btnCloseUnlock.addEventListener('click', closeUnlockModal);
  }

  if (unlockModal) {
    unlockModal.addEventListener('click', (e) => {
      if (e.target === unlockModal) closeUnlockModal();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDownloadModal();
      closeUnlockModal();
      closeMpModal();
    }
  });

  if (btnConfirmKey && inputKey) {
    btnConfirmKey.addEventListener('click', () => {
      const raw = inputKey.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!raw) {
        if (keyError) {
          keyError.textContent = 'Por favor, digite o código de ativação.';
          keyError.style.display = 'block';
        }
        return;
      }

      // Validação de Chave: Códigos mestres ou formato padrão
      const masterKeys = ['CONFEITEXVIP', 'CFTX8990', 'VITALICIO2026', 'CONFEITEX2026', 'DOCELUCRO', 'MERCADOPAGO', 'MP8990'];
      const isValid = masterKeys.includes(raw) || raw.startsWith('CFTX') || raw.startsWith('MP') || raw.startsWith('KWF') || raw.startsWith('HOT') || raw.length >= 10;

      if (isValid) {
        try {
          localStorage.setItem('confeitex_lifetime_active', 'true');
          localStorage.setItem('confeitex_activation_key', inputKey.value.trim().toUpperCase());
          localStorage.setItem('confeitex_sub_status', 'active');
        } catch (_) {}

        alert('🎉 Acesso Vitalício Confeitex ativado com sucesso! Redirecionando para o seu app...');
        window.location.href = './app.html';
      } else {
        if (keyError) {
          keyError.textContent = 'Chave inválida. Verifique o código recebido ou adquira seu acesso vitalício.';
          keyError.style.display = 'block';
        }
      }
    });
  }

  // ─── 6. Ações de Checkout Mercado Pago ───────────────────────────────────
  document.querySelectorAll('.btn-checkout-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const customUrl = localStorage.getItem('confeitex_mp_checkout_link') || localStorage.getItem('confeitex_checkout_url');
      if (customUrl && customUrl.startsWith('http')) {
        window.open(customUrl, '_blank');
      } else {
        openMpModal();
      }
    });
  });

  // Atualiza horário no mockup do smartphone
  const phoneTimeEl = document.querySelector('.phone-time');
  if (phoneTimeEl) {
    const d = new Date();
    phoneTimeEl.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

})();
