/**
 * Confeitex — landing.js
 * Lógica da Página de Demonstração, Instalação PWA e Simulação Interativa
 */

import { License } from './license.js';

(() => {
  'use strict';

  // ─── 0. Verificação de Retorno do Mercado Pago (Claim via ref) ─────────────
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('external_reference');
    if (ref) {
      window.location.href = `./app.html?ref=${encodeURIComponent(ref)}`;
      return;
    }
  } catch (_) {}

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
  const defaultCheckoutUrl = 'https://mpago.la/1e6EgRS';

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
    btnConfirmKey.addEventListener('click', async () => {
      const raw = inputKey.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      if (!raw) {
        if (keyError) {
          keyError.textContent = 'Por favor, digite o código de ativação.';
          keyError.style.display = 'block';
        }
        return;
      }

      btnConfirmKey.disabled = true;
      const originalText = btnConfirmKey.innerHTML;
      btnConfirmKey.innerHTML = '<span>Verificando licença...</span>';

      try {
        const result = await License.activateKey(raw);
        if (result && result.success) {
          alert('🎉 Plano Anual Confeitex (1 Ano) ativado com sucesso! Redirecionando para o seu app...');
          window.location.href = './app.html';
          return;
        }
        throw new Error((result && result.message) || 'Falha ao ativar chave de acesso.');
      } catch (err) {
        btnConfirmKey.disabled = false;
        btnConfirmKey.innerHTML = originalText;
        if (keyError) {
          keyError.textContent = err.message || 'Chave inválida ou limite de 2 dispositivos atingido.';
          keyError.style.display = 'block';
        }
      }
    });
  }

  // ─── 6. Ações de Checkout Mercado Pago ───────────────────────────────────
  document.querySelectorAll('.btn-checkout-link').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await License.startPurchase();
      } catch (err) {
        console.warn('[Landing Checkout]:', err);
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
