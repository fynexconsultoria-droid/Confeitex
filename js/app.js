(async () => {
  Auth.init();

  if (Auth.isLocked()) {
    await Auth.showLogin();
  }

  // Sistema de planos — inicializa badge
  Plan.init();
  const sidebarVersion = document.getElementById('sidebarVersion');
  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;

  State.load();

  // Onboarding — exibe apenas na primeira abertura
  if (Onboarding.shouldShow()) {
    Onboarding.show();
  } else if (typeof SetupWizard !== 'undefined' && SetupWizard.shouldShow()) {
    setTimeout(() => SetupWizard.show(), 300);
  } else if (navigator.onLine) {
    // Se não tem cartão e não tem assinatura, convida a cadastrar no primeiro acesso
    if (!Plan.hasRegisteredCard() && !Plan.isSubscriptionActive() && !safeStorage.get('confeitex_trial_prompted')) {
      setTimeout(() => Plan.showCardRegistrationModal({ forTrial: true }), 1000);
    } else if (!Plan.isTrialActive() && !Plan.isSubscriptionActive()) {
      // Se expirou o período de 7 dias ou mensalidade
      setTimeout(() => Plan.showUpgradeModal(), 1200);
    }
  }

  if (typeof I18n !== 'undefined' && typeof I18n.apply === 'function') {
    I18n.apply();
  }

  if (typeof SetupWizard !== 'undefined' && SetupWizard.updateAppHeaderGreetings) {
    SetupWizard.updateAppHeaderGreetings();
  }

  const tabTitles = {
    dashboard: { title: 'tab.dash.title', subtitle: 'tab.dash.sub' },
    orders: { title: 'tab.orders.title', subtitle: 'tab.orders.sub' },
    quotes: { title: 'tab.quotes.title', subtitle: 'tab.quotes.sub' },
    catalog: { title: 'tab.catalog.title', subtitle: 'tab.catalog.sub' },
    clients: { title: 'tab.clients.title', subtitle: 'tab.clients.sub' },
    finances: { title: 'tab.finances.title', subtitle: 'tab.finances.sub' },
    settings: { title: 'tab.settings.title', subtitle: 'tab.settings.sub' },
    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' }
  };

  let lastBackPressTime = 0;

  // Garante estado inicial no histórico para o botão voltar funcionar como SPA
  const hashTab = new URLSearchParams(location.hash.slice(1)).get('tab');
  const initialTab = hashTab && tabTitles[hashTab] ? hashTab : 'dashboard';
  try {
    history.replaceState({ tab: initialTab }, '');
  } catch (e) {}

  function switchTab(tabId, pushState = true) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    document.getElementById('mainTitle').textContent = I18n.t(tabTitles[tabId].title);
    document.getElementById('mainSubtitle').textContent = I18n.t(tabTitles[tabId].subtitle);

    if (pushState && !(history.state && history.state.tab === tabId)) {
      try { history.pushState({ tab: tabId }, ''); } catch (e) {}
    }

    try {
      if (tabId === 'dashboard') Dashboard.update();
      else if (tabId === 'orders') Orders.render();
      else if (tabId === 'quotes') Quotes.render();
      else if (tabId === 'catalog') Catalog.render();
      else if (tabId === 'clients') Clients.render();
      else if (tabId === 'finances') Finance.render();
      else if (tabId === 'settings') {
        Settings.renderCatalog();
        if (typeof SetupWizard !== 'undefined' && SetupWizard.updateAppHeaderGreetings) {
          SetupWizard.updateAppHeaderGreetings();
        }
      }
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
  let _ignoreNextPopState = false;

  window.addEventListener('popstate', (e) => {
    if (_ignoreNextPopState) {
      _ignoreNextPopState = false;
      return;
    }

    // 1. Fecha diálogos de confirmação se houver algum aberto
    const activeConfirm = document.querySelector('.ui-confirm-overlay.active');
    if (activeConfirm) {
      activeConfirm.classList.remove('active');
      setTimeout(() => activeConfirm.remove(), 250);
      return;
    }

    // 2. Fecha modais padrão ou chat de IA se houver algum aberto
    if (typeof AIChat !== 'undefined' && AIChat.isOpen) {
      AIChat.close();
      return;
    }
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      activeModals.forEach(m => m.classList.remove('active'));
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

  // Controle seguro de histórico de modais sem disparar loops reentrantes nem travar a tela
  let activeModalCount = 0;

  const pushModalHistory = () => {
    if (activeModalCount === 0) {
      try { history.pushState({ modalOpen: true }, ''); } catch (e) {}
    }
    activeModalCount++;
  };

  const popModalHistory = () => {
    if (activeModalCount > 0) activeModalCount--;
    if (activeModalCount === 0 && history.state && history.state.modalOpen) {
      _ignoreNextPopState = true;
      try { history.back(); } catch (e) { _ignoreNextPopState = false; }
    }
  };

  // Observa modais para sincronizar histórico sem sobrecarga
  const modalObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === 'class') {
        const target = m.target;
        const isActive = target.classList.contains('active');
        const wasActive = target.dataset.wasActive === '1';
        if (isActive && !wasActive) {
          target.dataset.wasActive = '1';
          pushModalHistory();
        } else if (!isActive && wasActive) {
          target.dataset.wasActive = '0';
          popModalHistory();
        }
      }
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modalObserver.observe(modal, { attributes: true });
  });

  // Observa apenas adições diretas de modal-overlay sem poluir a thread principal
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

  // Bottom Navigation (Mobile)
  document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(btn.dataset.tab);
    });
  });

  const btnBottomNavMenu = document.getElementById('btnBottomNavMenu');
  if (btnBottomNavMenu) {
    btnBottomNavMenu.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarOverlay').classList.add('active');
      pushModalHistory();
    });
  }

  const btnSidebarClose = document.getElementById('btnSidebarClose');
  if (btnSidebarClose) {
    btnSidebarClose.addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
      popModalHistory();
    });
  }

  // Mobile menu (Header hamburger button)
  document.getElementById('menuToggle').addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const willOpen = !sb.classList.contains('open');
    sb.classList.toggle('open', willOpen);
    overlay.classList.toggle('active', willOpen);
    if (willOpen) {
      pushModalHistory();
    } else {
      popModalHistory();
    }
  });

  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
    popModalHistory();
  });

  // Se veio de uma atualização automática, mostra toast e limpa flag
  if (safeStorage.get('confeitex_updated')) {
    const v = safeStorage.get('confeitex_ver');
    UI.toast(I18n.t('updates.toastUpdated', { version: v }));
    safeStorage.remove('confeitex_updated');
  }

  // Recarrega automaticamente quando um novo Service Worker assumir o controle,
  // mas somente se a atualização foi aceita e não há download em andamento
  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      const progress = document.getElementById('updateProgress');
      const downloading = progress && window.getComputedStyle(progress).display !== 'none';
      const updated = safeStorage.get('confeitex_updated');
      if (downloading || !updated) return;
      reloading = true;
      UI.toast(I18n.t('updates.toastReload'));
      setTimeout(() => window.location.reload(), 1500);
    });

    // Escuta mensagem do SW sobre atualização disponível
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE' && event.data.version) {
        const serverVer = event.data.version;
        if (serverVer !== Updates.verAtual) {
          if (typeof Updates !== 'undefined' && Updates.checkAndUpdate) {
            Updates.checkAndUpdate(true);
          }
        }
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

  // Language selector
  const langSelect = document.getElementById('langSelect');
  if (langSelect) {
    langSelect.value = I18n.lang;
    langSelect.addEventListener('change', () => {
      const code = langSelect.value;
      I18n.setLang(code);
      UI.toast(I18n.t('settings.toastLang', { lang: I18n.names[code] }));
    });
  }

  // Re-render dinâmico após mudar o idioma
  I18n.onApply = () => {
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

  // Notificações programadas
  Notifications.init();
  Notifications.initReconnectionListeners();

  // Assistente Confeitex IA (Help Chat)
  if (typeof AIChat !== 'undefined' && AIChat.init) {
    AIChat.init();
  }

  // Verifica atualização automaticamente ao iniciar
  (async () => {
    // Aguarda carregar elementos críticos da interface
    await new Promise(r => setTimeout(r, 1500));
    try {
      if (typeof Updates !== 'undefined' && Updates.checkAndUpdate) {
        await Updates.checkAndUpdate();
      }
    } catch (e) {
      console.warn('[Confeitex] Erro na verificação automática de atualização:', e);
    }
  })();
})();
