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
    settings: { title: 'Configurações', subtitle: 'Ajustes do catálogo de sabores e utilitários.' },
    updates: { title: 'Atualizações', subtitle: 'Verifique por novas versões do aplicativo.' }
  };

  function switchTab(tabId) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    document.getElementById('mainTitle').textContent = tabTitles[tabId].title;
    document.getElementById('mainSubtitle').textContent = tabTitles[tabId].subtitle;

    try {
      if (tabId === 'dashboard') Dashboard.update();
      else if (tabId === 'orders') Orders.render();
      else if (tabId === 'clients') Clients.render();
      else if (tabId === 'settings') Settings.renderCatalog();
      else if (tabId === 'updates') Updates.render();
    } catch (e) { console.warn('[Confeitex] Erro na aba', tabId, e); }
  }

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
