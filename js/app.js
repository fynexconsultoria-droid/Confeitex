(async () => {
  State.load();
  Auth.init();

  if (Auth.isLocked()) {
    await Auth.showLogin();
  }

  const tabTitles = {
    dashboard: { title: 'Painel de Controle', subtitle: 'Estatísticas gerais e entregas de hoje.' },
    orders: { title: 'Encomendas', subtitle: 'Gerencie e busque todos os pedidos registrados.' },
    clients: { title: 'Banco de Clientes', subtitle: 'Histórico de compras e contatos de clientes.' },
    settings: { title: 'Configurações', subtitle: 'Ajustes do catálogo de sabores e utilitários.' },
    updates: { title: 'Atualizações', subtitle: 'Verifique por novas versões do aplicativo.' }
  };

  function switchTab(tabId) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tabId));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));
    document.getElementById('mainTitle').textContent = tabTitles[tabId].title;
    document.getElementById('mainSubtitle').textContent = tabTitles[tabId].subtitle;

    if (tabId === 'dashboard') Dashboard.update();
    else if (tabId === 'orders') Orders.render();
    else if (tabId === 'clients') Clients.render();
    else if (tabId === 'settings') Settings.renderCatalog();
    else if (tabId === 'updates') Updates.render();

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
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

  // Se veio de uma atualização, mostra confirmação
  if (localStorage.getItem('fyntex_updated')) {
    localStorage.removeItem('fyntex_updated');
    UI.toast('App atualizado para a nova versão!');
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
  Dashboard.update();

  // Notificações programadas
  Notifications.init();

  // Verifica atualização ao abrir o app (máx 1x por hora)
  (async () => {
    const lastPrompt = localStorage.getItem('fyntex_update_prompt');
    const oneHour = 3600000;
    if (lastPrompt && Date.now() - parseInt(lastPrompt) < oneHour) return;

    const newVer = await Updates.checkSilent();
    if (newVer) {
      localStorage.setItem('fyntex_update_prompt', String(Date.now()));
      const ok = await UI.confirm({
        title: 'Nova versão disponível',
        message: `Atualização v${newVer} encontrada! Deseja baixar e instalar agora?`,
        confirmText: 'Atualizar',
        variant: 'primary'
      });
      if (ok) {
        localStorage.setItem('fyntex_ver', newVer);
        Updates.verAtual = newVer;
        Updates.downloadUpdate();
      }
    }
  })();
})();
