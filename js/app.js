(async () => {
  State.load();
  Auth.init();

  if (Auth.isLocked()) {
    await Auth.showLogin();
  }

  const tabTitles = {
    dashboard: { title: 'Painel de Controle', subtitle: 'Estatísticas gerais e entregas de hoje.' },
    orders: { title: 'Encomendas', subtitle: 'Gerencie e busque todos os pedidos registrados.' },
    clients: { title: 'Clientes', subtitle: 'Histórico de compras e contatos de clientes.' },
    finances: { title: 'Financeiro', subtitle: 'Resumo financeiro, formas de pagamento e gráficos.' },
    settings: { title: 'Configurações', subtitle: 'Ajustes do catálogo de sabores e utilitários.' },
    updates: { title: 'Atualizações', subtitle: 'Verifique por novas versões do aplicativo.' }
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
    document.getElementById('mainTitle').textContent = tabTitles[tabId].title;
    document.getElementById('mainSubtitle').textContent = tabTitles[tabId].subtitle;

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
    UI.toast('Pressione voltar novamente para sair do app');
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
  if (localStorage.getItem('confeitex_updated')) {
    const v = localStorage.getItem('confeitex_ver');
    UI.toast(`✅ App atualizado para v${v}`);
    localStorage.removeItem('confeitex_updated');
  }

  // Recarrega automaticamente quando um novo Service Worker assumir o controle
  if ('serviceWorker' in navigator) {
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      UI.toast('🔄 Nova versão instalada. Recarregando...');
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  // Date display
  document.getElementById('currentDateDisplay').textContent = fmtDate(new Date());

  // Daily calculator
  const dateInput = document.getElementById('calcDateInput');
  dateInput.value = new Date().toISOString().split('T')[0];
  dateInput.addEventListener('change', () => Dashboard.calcDayTotals(dateInput.value));
  document.getElementById('btnQuickCalcToday').addEventListener('click', () => {
    const d = new Date().toISOString().split('T')[0];
    dateInput.value = d;
    Dashboard.calcDayTotals(d);
  });

  // Chart period
  document.getElementById('chartPeriodSelect').addEventListener('change', () => Chart.render());



  // Init
  Orders.setupForm();
  Settings.setup();
  Finance.setup();
  Updates.setup();
  Clients.setupEditModal();
  Dashboard.update();

  // Notificações programadas
  Notifications.init();

  // Verifica atualização automaticamente (máx 1x por hora)
  (async () => {
    const lastCheck = localStorage.getItem('confeitex_last_auto_check');
    const oneHour = 3600000;
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < oneHour) return;

    localStorage.setItem('confeitex_last_auto_check', String(Date.now()));
    await Updates.checkSilent();
  })();
})();
