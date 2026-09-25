(async () => {
  Auth.init();

  if (Auth.isLocked()) {
    await Auth.showLogin();
  }

  // Sistema de planos — inicializa badge
  Plan.init();
  const sidebarVersion = document.getElementById('sidebarVersion');
  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;

  // Inicializa filtro de data de encomendas para hoje
  const orderDateFilter = document.getElementById('orderFilterDate');
  if (orderDateFilter && !orderDateFilter.value) {
    orderDateFilter.type = 'date';
    orderDateFilter.value = new Date().toISOString().split('T')[0];
  }

  // Onboarding — exibe apenas na primeira abertura
  if (Onboarding.shouldShow()) {
    Onboarding.show();
  } else if (navigator.onLine) {
    // Removed old paywall logic
  }
  
  await State.load();
  
  const loader = document.getElementById('appLoader');
  if (loader) {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 300);
  }

  const tabTitles = {
    dashboard: { title: 'tab.dash.title', subtitle: 'tab.dash.sub' },
    orders: { title: 'tab.orders.title', subtitle: 'tab.orders.sub' },
    clients: { title: 'tab.clients.title', subtitle: 'tab.clients.sub' },
    finances: { title: 'tab.finances.title', subtitle: 'tab.finances.sub' },
    settings: { title: 'tab.settings.title', subtitle: 'tab.settings.sub' },
    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' }
  };

  let lastBackPressTime = 0;

  // Garante estado inicial no histórico para o botão voltar funcionar como SPA e suporta atalhos do Android
  const hashParams = new URLSearchParams(location.hash.slice(1));
  const hashTab = hashParams.get('tab');
  const hashAction = hashParams.get('action');
  const initialTab = hashTab && tabTitles[hashTab] ? hashTab : (hashAction === 'new-order' ? 'orders' : 'dashboard');
  try {
    history.replaceState({ tab: initialTab }, '');
  } catch (e) {}

  function switchTab(tabId, pushState = true) {
    if (tabId === 'finances' && typeof Plan !== 'undefined' && !Plan.canUse('finances_tab')) {
      Plan.showPaywall('Acesso ao Financeiro (Premium)');
      return;
    }

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    document.getElementById('mainTitle').textContent = I18n.t(tabTitles[tabId].title);
    document.getElementById('mainSubtitle').textContent = I18n.t(tabTitles[tabId].subtitle);

    if (pushState && !(history.state && history.state.tab === tabId)) {
      try { history.pushState({ tab: tabId }, ''); } catch (e) {}
    }

    try {
      if (tabId === 'dashboard') Dashboard.update();
      else if (tabId === 'orders') Orders.render();
      else if (tabId === 'clients') Clients.render();
      else if (tabId === 'finances') Finance.render();
      else if (tabId === 'settings') Settings.renderCatalog();
      else if (tabId === 'updates') Updates.render();
    } catch (e) { console.warn('[Confeitex] Erro na aba', tabId, e); }
  }

  // Expõe switchTab para módulos (ex.: card de pendentes no dashboard)
  window.switchTab = switchTab;

  // Clicar no nome "Confeitex" no header volta para o dashboard
  const brandEl = document.querySelector('.brand.mobile-brand');
  if (brandEl) {
    brandEl.style.cursor = 'pointer';
    brandEl.addEventListener('click', () => switchTab('dashboard'));
  }

  // Intercepta eventos de Voltar (botão de hardware / gestos no Android/celular)
  let _closingFromHistory = false;

  window.addEventListener('popstate', (e) => {
    // 1. Fecha diálogos de confirmação se houver algum aberto
    const activeConfirm = document.querySelector('.ui-confirm-overlay.active');
    if (activeConfirm) {
      _closingFromHistory = true;
      activeConfirm.classList.remove('active');
      setTimeout(() => { activeConfirm.remove(); _closingFromHistory = false; }, 250);
      return;
    }

    // 2. Fecha modais padrão se houver algum aberto
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      _closingFromHistory = true;
      activeModals.forEach(m => m.classList.remove('active'));
      // O MutationObserver disparará; o flag garante que não chame back() novamente
      setTimeout(() => { _closingFromHistory = false; }, 0);
      return;
    }

    // 3. Fecha menu lateral mobile
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
      return;
    }

    // 4. Se não estiver no Painel de Controle (Dashboard), navega de volta para a aba principal
    const currentTab = (function() { var el = document.querySelector('.nav-link.active'); return el ? el.dataset.tab : null; })();
    if (currentTab && currentTab !== 'dashboard') {
      switchTab('dashboard', false);
      return;
    }

    // 5. Se já estiver no Dashboard e sem modais: previne fechamento acidental
    const now = Date.now();
    if (now - lastBackPressTime < 2000) {
      // Pressionou voltar 2x rapidamente: permite fechar
      return;
    }

    // Primeira vez pressionando voltar no Dashboard: exibe toast e empurra estado para manter no app
    lastBackPressTime = now;
    try { history.pushState({ tab: 'dashboard' }, ''); } catch (e) {}
    UI.toast(I18n.t('dash.backPress'));
  });

  // Observa abertura de modais para registrar no histórico
  const pushModalState = () => {
    try { history.pushState({ modalOpen: true }, ''); } catch (e) {}
  };

  const modalObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === 'class') {
        const target = m.target;
        if (target.classList.contains('active')) {
          pushModalState();
        } else if (!_closingFromHistory && history.state && history.state.modalOpen) {
          // Modal fechou programaticamente (ex.: botão X): limpa o estado sem disparar popstate
          try {
            const currentTab = document.querySelector('.nav-link.active')?.dataset?.tab || 'dashboard';
            history.replaceState({ tab: currentTab }, '');
          } catch (e) {}
        }
      }
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modalObserver.observe(modal, { attributes: true });
  });

  // Observa modais criados dinamicamente (ex: Plan modals)
  const bodyObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.classList && node.classList.contains('modal-overlay')) {
          modalObserver.observe(node, { attributes: true });
        }
      });
    });
  });
  bodyObserver.observe(document.body, { childList: true });

  // Tab navigation
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // Mobile menu
  document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
    if (document.getElementById('sidebar').classList.contains('open')) {
      pushModalState();
    }
  });
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });

  // Se veio de uma atualização automática, mostra toast e limpa flag
  if (safeStorage.get('confeitex_updated')) {
    const v = safeStorage.get('confeitex_ver');
    UI.toast(I18n.t('updates.toastUpdated', { version: v }));
    safeStorage.remove('confeitex_updated');
  }

  // Quando o novo Service Worker assume o controle (após SKIP_WAITING),
  // exibe modal pedindo ao usuário para recarregar — NUNCA recarrega automaticamente.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const newVer = safeStorage.get('confeitex_last_updated_to');
      if (!newVer) return;
      Updates.promptUpdateReady(newVer);
    });

    // Escuta mensagem do SW sobre atualização disponível
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE' && event.data.version) {
        const serverVer = event.data.version;
        if (serverVer !== Updates.verAtual) {
          // Se o usuário já adiou, não abre modal novamente (só registra notificação)
          const deferred = safeStorage.get('confeitex_update_deferred');
          const oneDay = 86400000;
          if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) return;

          // Registra no sino de notificações (se ainda não registrou)
          const notifId = 'update_' + serverVer;
          if (typeof Notifications !== 'undefined' && Notifications._recordNotification) {
            const alreadyNotified = Notifications.getHistory
              && Notifications.getHistory().some(n => n.id === notifId);
            if (!alreadyNotified) {
              Notifications._recordNotification({
                id: notifId,
                type: 'update',
                title: I18n.t('updates.notifTitle'),
                body: I18n.t('updates.notifBody', { version: serverVer }),
                orderIds: [],
                read: false
              });
            }
          }
          Updates.promptUpdateReady(serverVer);
        }
      }
    });

    // Se o app foi aberto e já havia um SW aguardando para ser ativado
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        // Se o usuário já adiou recentemente, não mostra o modal
        const deferred = safeStorage.get('confeitex_update_deferred');
        const oneDay = 86400000;
        if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) return;

        const pendingVer = safeStorage.get('confeitex_update_pending') || safeStorage.get('confeitex_last_updated_to') || '';
        if (pendingVer) Updates.promptUpdateReady(pendingVer);
      }
    });
  }

  // Date display
  document.getElementById('currentDateDisplay').textContent = fmtDate(new Date());

  // Daily calculator
  const dateInput = document.getElementById('calcDateInput');
  dateInput.value = fmtISO(new Date());
  dateInput.addEventListener('change', () => Dashboard.calcDayTotals(dateInput.value));
  document.getElementById('btnQuickCalcToday').addEventListener('click', () => {
    const d = fmtISO(new Date());
    dateInput.value = d;
    Dashboard.calcDayTotals(d);
  });

  // Chart period
  document.getElementById('chartPeriodSelect').addEventListener('change', () => Chart.render());

  // Language Custom Modal
  const btnOpenLangModal = document.getElementById('btnOpenLangModal');
  const langModal = document.getElementById('langModal');
  const currentLangDisplay = document.getElementById('currentLangDisplay');
  const langRadios = document.querySelectorAll('input[name="app_lang_radio"]');
  
  if (btnOpenLangModal && langModal) {
    if (currentLangDisplay) currentLangDisplay.textContent = I18n.names[I18n.lang] || 'Português';
    
    btnOpenLangModal.addEventListener('click', () => {
      langRadios.forEach(r => r.checked = (r.value === I18n.lang));
      langModal.classList.add('active');
    });
    
    document.getElementById('btnLangCancel').addEventListener('click', () => langModal.classList.remove('active'));
    
    document.getElementById('btnLangSave').addEventListener('click', () => {
      const selected = Array.from(langRadios).find(r => r.checked);
      if (selected) {
        const code = selected.value;
        I18n.setLang(code);
        if (currentLangDisplay) currentLangDisplay.textContent = I18n.names[code] || code;
        UI.toast(I18n.t('settings.toastLang', { lang: I18n.names[code] }));
      }
      langModal.classList.remove('active');
    });
  }

  // Re-render dinâmico após mudar o idioma
  I18n.onApply = () => {
    updateConnectionStatus();
    const currentTab = (function() { var el = document.querySelector('.nav-link.active'); return el ? el.dataset.tab : null; })();
    try { switchTab(currentTab || 'dashboard', false); } catch (e) {}
    try { Chart.render(); } catch (e) {}
    if (typeof Orders !== 'undefined' && Orders.refreshFlavorOptions) Orders.refreshFlavorOptions();
    if (typeof Clients !== 'undefined' && Clients.refresh) Clients.refresh();
    if (typeof Notifications !== 'undefined' && Notifications.refreshUI) Notifications.refreshUI();
    if (typeof Plan !== 'undefined') Plan.renderPlanBadge();
  };



  // Init — cada módulo em try/catch isolado para que 1 erro não bloquee os demais
  const _safe = (name, fn) => { try { fn(); } catch (e) { console.error('[Confeitex] Erro em ' + name + ':', e); } };
  _safe('Orders.setupForm', () => Orders.setupForm());
  _safe('Settings.setup', () => Settings.setup());
  _safe('Finance.setup', () => Finance.setup());
  _safe('Updates.setup', () => Updates.setup());
  _safe('Clients.setupEditModal', () => Clients.setupEditModal());
  _safe('Trash.setup', () => Trash.setup());
  switchTab(initialTab, false);

  // Se foi aberto via atalho rápido do Android (ex: Novo Pedido), abre o formulário
  if (hashAction === 'new-order') {
    setTimeout(() => {
      const btn = document.getElementById('btnNewOrder');
      if (btn) btn.click();
    }, 350);
  }

  // Mercado Pago — inicialização
  if (typeof MercadoPagoCheckout !== 'undefined') {
    MercadoPagoCheckout.init();
    // Modal event listeners
    const mpClose = document.getElementById('btnMpCheckoutClose');
    const mpDone = document.getElementById('btnMpCheckoutDone');
    const mpRetry = document.getElementById('btnMpRetry');
    const btnCopyPix = document.getElementById('btnCopyPixCode');
    const btnCheckPix = document.getElementById('btnCheckPixStatus');

    if (mpClose) mpClose.addEventListener('click', () => MercadoPagoCheckout.closeCheckout());
    if (mpDone) mpDone.addEventListener('click', () => {
      MercadoPagoCheckout.closeCheckout();
      Orders.render();
      Dashboard.update();
    });
    if (mpRetry) mpRetry.addEventListener('click', () => {
      if (MercadoPagoCheckout._currentOrder) {
        MercadoPagoCheckout.openCheckout(MercadoPagoCheckout._currentOrder);
      } else {
        MercadoPagoCheckout.closeCheckout();
      }
    });
    if (btnCopyPix) btnCopyPix.addEventListener('click', () => MercadoPagoCheckout.copyPixCode());
    if (btnCheckPix) btnCheckPix.addEventListener('click', () => {
      if (MercadoPagoCheckout._currentPaymentId) {
        MercadoPagoCheckout.checkPaymentStatus(MercadoPagoCheckout._currentPaymentId, true);
      }
    });
  }

  // Monitor de Conexão Online/Offline
  const updateConnectionStatus = () => {
    const isOnline = navigator.onLine;
    
    // Atualiza texto no sidebar
    const sidebarText = document.getElementById('navConnectionStatus');
    if (sidebarText) {
      sidebarText.textContent = isOnline ? I18n.t('nav.online') : I18n.t('nav.offline');
      sidebarText.style.color = isOnline ? 'var(--color-success)' : '';
    }

    // Atualiza o badge na aba de Atualizações
    const updatesStatus = document.getElementById('updatesConnectionStatus');
    if (updatesStatus) {
      updatesStatus.textContent = isOnline ? I18n.t('updates.onlineStatus') : I18n.t('updates.offlineStatus');
    }
    const updatesDot = document.querySelector('.updates-dot');
    if (updatesDot) {
      updatesDot.style.background = isOnline ? 'var(--color-success)' : 'var(--color-danger)';
    }
  };

  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
  updateConnectionStatus(); // chamada inicial

  // Notificações programadas
  Notifications.init();
  Notifications.initReconnectionListeners();

  // Verifica atualização automaticamente (máx 1x por hora) + registra no sino
  (async () => {
    const lastCheck = safeStorage.get('confeitex_last_auto_check');
    const oneHour = 3600000;
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < oneHour) return;

    try {
      await Updates.checkAndUpdate();
    } catch (e) {
      console.warn('[Confeitex] Erro na verificação automática:', e);
    }
    safeStorage.set('confeitex_last_auto_check', String(Date.now()));
  })();
})();
