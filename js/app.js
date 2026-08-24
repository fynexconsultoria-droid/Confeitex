(async () => {
  Auth.init();

  if (Auth.isLocked()) {
    await Auth.showLogin();
  }

  // Sistema de planos — inicia trial se for o primeiro acesso
  Plan.init();
  const sidebarVersion = document.getElementById('sidebarVersion');
  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;

  // Onboarding — exibe apenas na primeira abertura
  if (Onboarding.shouldShow()) {
    Onboarding.show();
  }

  // Se online e sem assinatura ativa, mostra modal de upgrade
  if (navigator.onLine && !Plan.isSubscriptionActive()) {
    setTimeout(() => Plan.showUpgradeModal(), 1500);
  }
  
  State.load();

  const tabTitles = {
    dashboard: { title: 'tab.dash.title', subtitle: 'tab.dash.sub' },
    orders: { title: 'tab.orders.title', subtitle: 'tab.orders.sub' },
    clients: { title: 'tab.clients.title', subtitle: 'tab.clients.sub' },
    finances: { title: 'tab.finances.title', subtitle: 'tab.finances.sub' },
    settings: { title: 'tab.settings.title', subtitle: 'tab.settings.sub' },
    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' }
  };

  let lastBackPressTime = 0;

  // Garante estado inicial no histórico para o botão voltar funcionar como SPA
  try {
    history.replaceState({ tab: 'dashboard' }, '');
  } catch (e) {}

  function switchTab(tabId, pushState = true) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    document.getElementById('mainTitle').textContent = I18n.t(tabTitles[tabId].title);
    document.getElementById('mainSubtitle').textContent = I18n.t(tabTitles[tabId].subtitle);

    if (pushState && history.state?.tab !== tabId) {
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
  window.addEventListener('popstate', (e) => {
    // 1. Fecha diálogos de confirmação se houver algum aberto
    const activeConfirm = document.querySelector('.ui-confirm-overlay.active');
    if (activeConfirm) {
      activeConfirm.classList.remove('active');
      setTimeout(() => activeConfirm.remove(), 250);
      return;
    }

    // 2. Fecha modais padrão se houver algum aberto
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
    const currentTab = document.querySelector('.nav-link.active')?.dataset.tab;
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

  // Observe de abertura de modais para registrar no histórico
  const pushModalState = () => {
    try { history.pushState({ modalOpen: true }, ''); } catch (e) {}
  };

  const modalObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName === 'class') {
        const target = m.target;
        if (target.classList.contains('active')) {
          pushModalState();
        } else if (history.state?.modalOpen) {
          try { history.back(); } catch (e) {}
        }
      }
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modalObserver.observe(modal, { attributes: true });
  });

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

  // Recarrega automaticamente quando um novo Service Worker assumir o controle,
  // mas somente se a atualização foi aceita e não há download em andamento
  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      const progress = document.getElementById('updateProgress');
      const downloading = progress && progress.style.display !== 'none';
      const updated = safeStorage.get('confeitex_updated');
      if (downloading || !updated) return;
      reloading = true;
      UI.toast(I18n.t('updates.toastReload'));
      setTimeout(() => window.location.reload(), 1500);
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
    const currentTab = document.querySelector('.nav-link.active')?.dataset.tab;
    try { switchTab(currentTab || 'dashboard', false); } catch (e) {}
    try { Chart.render(); } catch (e) {}
    if (typeof Orders !== 'undefined' && Orders.refreshFlavorOptions) Orders.refreshFlavorOptions();
    if (typeof Clients !== 'undefined' && Clients.refresh) Clients.refresh();
    if (typeof Notifications !== 'undefined' && Notifications.refreshUI) Notifications.refreshUI();
    if (typeof Plan !== 'undefined') Plan.renderPlanBadge();
  };



  // Init
  Orders.setupForm();
  Settings.setup();
  Finance.setup();
  Updates.setup();
  Clients.setupEditModal();
  Trash.setup();
  Dashboard.update();

  // Mercado Pago — inicialização
  if (typeof MercadoPagoCheckout !== 'undefined') {
    MercadoPagoCheckout.init();
    // Modal event listeners
    const mpClose = document.getElementById('btnMpCheckoutClose');
    const mpDone = document.getElementById('btnMpCheckoutDone');
    const mpRetry = document.getElementById('btnMpRetry');
    if (mpClose) mpClose.addEventListener('click', () => MercadoPagoCheckout.closeCheckout());
    if (mpDone) mpDone.addEventListener('click', () => {
      MercadoPagoCheckout.closeCheckout();
      Orders.render();
      Dashboard.update();
    });
    if (mpRetry) mpRetry.addEventListener('click', () => {
      const modal = document.getElementById('mpCheckoutModal');
      if (modal) modal.classList.remove('active');
    });
  }

  // Notificações programadas
  Notifications.init();

  // Verifica atualização automaticamente (máx 1x por hora)
  (async () => {
    const lastCheck = safeStorage.get('confeitex_last_auto_check');
    const oneHour = 3600000;
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < oneHour) return;

    safeStorage.set('confeitex_last_auto_check', String(Date.now()));
    await Updates.checkSilent();
  })();
})();
