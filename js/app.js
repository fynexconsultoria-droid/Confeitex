/**
 * Confeitex — app.js
 * Controlador principal: inicialização, navegação entre abas e orquestração de módulos.
 */

import { Auth } from './auth.js';
import { Chart } from './chart.js';
import { Clients } from './clients.js';
import { Dashboard } from './dashboard.js';
import { Finance } from './finances.js';
import { I18n } from './i18n.js';
import { MercadoPagoCheckout } from './mercadopago.js';
import { Notifications } from './notifications.js';
import { Onboarding } from './onboarding.js';
import { Orders } from './orders.js';
import { Plan } from './plan.js';
import { Settings } from './settings.js';
import { State } from './state.js';
import { Trash } from './trash.js';
import { UI } from './ui.js';
import { Updates } from './updates.js';
import { fmtDate, fmtISO, safeStorage } from './utils.js';
import { PullToRefresh } from './pull-to-refresh.js';

(async () => {

  // ─── Autenticação ───────────────────────────────────────────────────
  Auth.init();
  if (Auth.isLocked()) await Auth.showLogin();

  // ─── Planos e versão ──────────────────────────────────────────────
  Plan.init();
  const verText = `v${Updates.verAtual}`;
  ['sidebarVersion', 'rightSidebarVersion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = verText;
  });

  // ─── Filtro de data inicial (alterado para iniciar vazio) ────────────────────────────
  const orderDateFilter = document.getElementById('orderFilterDate');
  if (orderDateFilter && !orderDateFilter.value) {
    orderDateFilter.type  = 'text';
    orderDateFilter.value = '';
  }

  // ─── Onboarding (apenas na primeira abertura) ────────────────────────────
  if (Onboarding.shouldShow()) Onboarding.show();

  // ─── Carrega dados do estado ─────────────────────────────────────────────
  await State.load();

  window.State = State;

  // ─── Inicializa pull-to-refresh (apenas mobile/touch) ──────────────────────
  PullToRefresh.init();

  // ─── Navegação entre abas ───────────────────────────────────────────────────

  const tabTitles = {
    dashboard:    { title: 'tab.dash.title',     subtitle: 'tab.dash.sub' },
    orders:       { title: 'tab.orders.title',   subtitle: 'tab.orders.sub' },
    clients:      { title: 'tab.clients.title',  subtitle: 'tab.clients.sub' },
    finances:     { title: 'tab.finances.title', subtitle: 'tab.finances.sub' },
    settings:     { title: 'tab.settings.title', subtitle: 'tab.settings.sub' },
    updates:      { title: 'tab.updates.title',  subtitle: 'tab.updates.sub' },
    notificacoes: { title: 'settings.notifTitle', subtitle: 'settings.notifDesc' },
    mercadopago:  { title: 'mp.settingsTitle',    subtitle: 'mp.settingsDesc' },
    plano:        { title: 'plan.settingsTitle',  subtitle: 'plan.settingsDesc' },
  };

  const hashParams = new URLSearchParams(location.hash.slice(1));
  const hashTab    = hashParams.get('tab');
  const hashAction = hashParams.get('action');
  const initialTab = (hashTab && tabTitles[hashTab]) ? hashTab
                   : (hashAction === 'new-order')     ? 'orders'
                   : 'dashboard';

  try { history.replaceState({ tab: initialTab }, ''); } catch (_) {}

  function switchTab(tabId, pushState = true) {
    if (!tabTitles[tabId]) return;

    if (tabId === 'finances' && typeof Plan !== 'undefined' && !Plan.canUse('finances_tab')) {
      Plan.showPaywall('Acesso ao Financeiro (Premium)');
      return;
    }

    // Fecha sidebar lateral mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    // Atualiza links, conteúdos e estado ARIA
    document.querySelectorAll('.nav-link').forEach(l => {
      const isActive = l.dataset.tab === tabId;
      l.classList.toggle('active', isActive);
      l.setAttribute('aria-selected', String(isActive));
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === tabId));

    // Atualiza título do header
    document.getElementById('mainTitle').textContent    = I18n.t(tabTitles[tabId].title);
    document.getElementById('mainSubtitle').textContent = I18n.t(tabTitles[tabId].subtitle);

    // Ajusta o scroll para o topo ao trocar de aba
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;

    if (pushState && history.state?.tab !== tabId) {
      try { history.pushState({ tab: tabId }, ''); } catch (_) {}
    }

    // Renderiza o módulo da aba ativa
    try {
      if      (tabId === 'dashboard') Dashboard.update();
      else if (tabId === 'orders')    Orders.render();
      else if (tabId === 'clients')   Clients.render();
      else if (tabId === 'finances')  Finance.render();
      else if (tabId === 'settings')  { Settings.renderCatalog(); Updates.render(); }
      else if (tabId === 'updates')   Updates.render();
    } catch (e) { console.warn('[Confeitex] Erro na aba', tabId, e); }
  }

  // Expõe para módulos que precisam navegar entre abas
  window.switchTab = switchTab;

  // ─── Clique no logo → Dashboard ────────────────────────────────────────────────
  const brandEl = document.querySelector('.brand.mobile-brand');
  if (brandEl) {
    brandEl.style.cursor = 'pointer';
    brandEl.addEventListener('click', () => switchTab('dashboard'));
  }

  // ─── Botão Voltar (hardware / gestos Android) ─────────────────────────────────
  let lastBackPressTime   = 0;
  let _closingFromHistory = false;

  window.addEventListener('popstate', () => {
    const activeConfirm = document.querySelector('.ui-confirm-overlay.active');
    if (activeConfirm) {
      _closingFromHistory = true;
      activeConfirm.classList.remove('active');
      setTimeout(() => { activeConfirm.remove(); _closingFromHistory = false; }, 250);
      return;
    }

    const activeModals = document.querySelectorAll('.modal-overlay.active');
    if (activeModals.length > 0) {
      _closingFromHistory = true;
      activeModals.forEach(m => m.classList.remove('active'));
      setTimeout(() => { _closingFromHistory = false; }, 0);
      return;
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar?.classList.contains('open')) {
      sidebar.classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
      return;
    }

    const currentTab = document.querySelector('.nav-link.active')?.dataset?.tab;
    if (currentTab && currentTab !== 'dashboard') {
      switchTab('dashboard', false);
      return;
    }

    const now = Date.now();
    if (now - lastBackPressTime < 2000) return;
    lastBackPressTime = now;
    try { history.pushState({ tab: 'dashboard' }, ''); } catch (_) {}
    UI.toast(I18n.t('dash.backPress'));
  });

  // ─── Observer: registra modais no histórico ─────────────────────────────────
  const pushModalState = () => {
    try { history.pushState({ modalOpen: true }, ''); } catch (_) {}
  };

  const modalObserver = new MutationObserver(mutations => {
    mutations.forEach(m => {
      if (m.attributeName !== 'class') return;
      if (m.target.classList.contains('active')) {
        pushModalState();
      } else if (!_closingFromHistory && history.state?.modalOpen) {
        try {
          const tab = document.querySelector('.nav-link.active')?.dataset?.tab || 'dashboard';
          history.replaceState({ tab }, '');
        } catch (_) {}
      }
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modalObserver.observe(modal, { attributes: true });
  });

  // Observa modais criados dinamicamente
  new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1 && node.classList?.contains('modal-overlay')) {
          modalObserver.observe(node, { attributes: true });
        }
      });
    });
  }).observe(document.body, { childList: true });

  // ─── Links de navegação ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // ─── Menu lateral direito (mobile) ──────────────────────────────────────────────
  const rightSidebar = document.getElementById('rightSidebar');
  const rightOverlay = document.getElementById('rightSidebarOverlay');

  const openRight  = () => { rightSidebar?.classList.add('open');    rightOverlay?.classList.add('active'); };
  const closeRight = () => { rightSidebar?.classList.remove('open'); rightOverlay?.classList.remove('active'); };

  document.getElementById('menuToggle').addEventListener('click', openRight);
  document.getElementById('closeRightSidebar')?.addEventListener('click', closeRight);
  const handleOverlayClose = (e) => {
    if (e && e.cancelable) e.preventDefault();
    if (e) e.stopPropagation();
    closeRight();
  };
  rightOverlay?.addEventListener('click', handleOverlayClose);
  rightOverlay?.addEventListener('touchstart', handleOverlayClose, { passive: false });
  document.querySelectorAll('.right-sidebar-link').forEach(l => l.addEventListener('click', closeRight));

  // ─── Status Online/Offline ───────────────────────────────────────────────────────────

  const updateConnectionStatus = () => {
    const isOnline = navigator.onLine;

    const sidebarText = document.getElementById('navConnectionStatus');
    if (sidebarText) {
      sidebarText.textContent = isOnline ? I18n.t('nav.online') : I18n.t('nav.offline');
      sidebarText.style.color = '';
    }

    const navDot = document.getElementById('navConnectionDot');
    if (navDot) {
      navDot.style.background = isOnline ? 'var(--color-success)' : 'var(--color-danger)';
    }

    const updatesStatus = document.getElementById('updatesConnectionStatus');
    if (updatesStatus) {
      updatesStatus.textContent = isOnline ? I18n.t('updates.onlineStatus') : I18n.t('updates.offlineStatus');
    }

    const updatesDot = document.querySelector('.updates-dot');
    if (updatesDot) {
      updatesDot.style.background = isOnline ? 'var(--color-success)' : 'var(--color-danger)';
    }
  };

  updateConnectionStatus();
  window.addEventListener('online',  updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);

  const updateRightSidebarStatus = () => {
    const dot  = document.getElementById('rightSidebarStatusDot');
    const text = document.getElementById('rightSidebarStatusText');
    if (!dot || !text) return;
    dot.className    = navigator.onLine ? 'status-dot online' : 'status-dot offline';
    text.textContent = navigator.onLine ? 'Online' : 'Offline';
  };

  updateRightSidebarStatus();
  window.addEventListener('online',  updateRightSidebarStatus);
  window.addEventListener('offline', updateRightSidebarStatus);

  // ─── Overlay da sidebar esquerda ─────────────────────────────────────────────────
  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');
  });

  // ─── Toast de atualização concluída ───────────────────────────────────────────────
  if (safeStorage.get('confeitex_updated')) {
    UI.toast(I18n.t('updates.toastUpdated', { version: safeStorage.get('confeitex_ver') }));
    safeStorage.remove('confeitex_updated');
  }

  // ─── Service Worker: notificações de nova versão ────────────────────────────────
  if ('serviceWorker' in navigator) {
    const ONE_DAY = 86_400_000;

    const isUpdateDeferred = () => {
      const d = safeStorage.get('confeitex_update_deferred');
      return !!(d && Date.now() - parseInt(d, 10) < ONE_DAY);
    };

    const recordUpdateNotif = (serverVer) => {
      if (!Notifications?._recordNotification) return;
      const notifId = `update_${serverVer}`;
      if (!Notifications.getHistory?.().some(n => n.id === notifId)) {
        Notifications._recordNotification({
          id: notifId, type: 'update',
          title: I18n.t('updates.notifTitle'),
          body: I18n.t('updates.notifBody', { version: serverVer }),
          orderIds: [], read: false,
        });
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      const newVer = safeStorage.get('confeitex_last_updated_to');
      if (newVer) Updates.promptUpdateReady(newVer);
    });

    navigator.serviceWorker.addEventListener('message', ({ data }) => {
      if (data?.type !== 'UPDATE_AVAILABLE' || !data.version) return;
      if (data.version === Updates.verAtual || isUpdateDeferred()) return;
      recordUpdateNotif(data.version);
      Updates.promptUpdateReady(data.version);
    });

    navigator.serviceWorker.ready.then(reg => {
      if (!reg.waiting || isUpdateDeferred()) return;
      const pendingVer = safeStorage.get('confeitex_update_pending')
                      || safeStorage.get('confeitex_last_updated_to') || '';
      if (pendingVer) Updates.promptUpdateReady(pendingVer);
    });
  }

  // ─── Re-render ao trocar idioma ───────────────────────────────────────────────────────
  I18n.onApply = () => {
    updateConnectionStatus();
    const currentTab = document.querySelector('.nav-link.active')?.dataset?.tab;
    try { switchTab(currentTab || 'dashboard', false); } catch (_) {}
    try { Chart.render(); } catch (_) {}
    Orders.refreshFlavorOptions?.();
    Clients.refresh?.();
    Notifications.refreshUI?.();
    Plan.renderPlanBadge?.();
  };

  // ─── Data e calculadora diária ───────────────────────────────────────────────────
  document.getElementById('currentDateDisplay').textContent = fmtDate(new Date());

  const dateInput = document.getElementById('calcDateInput');
  dateInput.value = fmtISO(new Date());
  dateInput.addEventListener('change', () => Dashboard.calcDayTotals(dateInput.value));
  document.getElementById('btnQuickCalcToday').addEventListener('click', () => {
    dateInput.value = fmtISO(new Date());
    Dashboard.calcDayTotals(dateInput.value);
  });

  // ─── Gráfico ────────────────────────────────────────────────────────────────────────────
  document.getElementById('chartPeriodSelect').addEventListener('change', () => Chart.render());

  // ─── Modal de idioma ───────────────────────────────────────────────────────────────
  const btnOpenLangModal   = document.getElementById('btnOpenLangModal');
  const langModal          = document.getElementById('langModal');
  const currentLangDisplay = document.getElementById('currentLangDisplay');
  const langRadios         = document.querySelectorAll('input[name="app_lang_radio"]');

  if (btnOpenLangModal && langModal) {
    if (currentLangDisplay) currentLangDisplay.textContent = I18n.names[I18n.lang] || 'Português';

    btnOpenLangModal.addEventListener('click', () => {
      langRadios.forEach(r => { r.checked = (r.value === I18n.lang); });
      langModal.classList.add('active');
    });

    document.getElementById('btnLangCancel').addEventListener('click', () => langModal.classList.remove('active'));

    document.getElementById('btnLangSave').addEventListener('click', () => {
      const selected = Array.from(langRadios).find(r => r.checked);
      if (selected) {
        I18n.setLang(selected.value);
        // Atualiza atributo lang para leitores de tela usarem pronúncia correta
        document.documentElement.lang = I18n.locales[selected.value] || selected.value;
        if (currentLangDisplay) currentLangDisplay.textContent = I18n.names[selected.value] || selected.value;
        UI.toast(I18n.t('settings.toastLang', { lang: I18n.names[selected.value] }));
      }
      langModal.classList.remove('active');
    });
  }

  // ─── Inicialização dos módulos ──────────────────────────────────────────────────
  const _safe = (name, fn) => {
    try { fn(); } catch (e) { console.error(`[Confeitex] Erro em ${name}:`, e); }
  };

  _safe('Orders.setupForm',       () => Orders.setupForm());
  _safe('Settings.setup',         () => Settings.setup());
  _safe('Finance.setup',          () => Finance.setup());
  _safe('Updates.setup',          () => Updates.setup());
  _safe('Clients.setupEditModal', () => Clients.setupEditModal());
  _safe('Trash.setup',            () => Trash.setup());

  switchTab(initialTab, false);

  // Ação rápida via URL hash (ex.: atalho "Novo Pedido" no Android)
  if (hashAction === 'new-order') {
    setTimeout(() => document.getElementById('btnNewOrder')?.click(), 350);
  }

  // ─── Mercado Pago ─────────────────────────────────────────────────────────────────────────
  if (typeof MercadoPagoCheckout !== 'undefined') {
    MercadoPagoCheckout.init();

    document.getElementById('btnMpCheckoutClose')?.addEventListener('click', () => MercadoPagoCheckout.closeCheckout());
    document.getElementById('btnMpCheckoutDone')?.addEventListener('click', () => {
      MercadoPagoCheckout.closeCheckout();
      Orders.render();
      Dashboard.update();
    });
    document.getElementById('btnMpRetry')?.addEventListener('click', () => {
      if (MercadoPagoCheckout._currentOrder) MercadoPagoCheckout.openCheckout(MercadoPagoCheckout._currentOrder);
      else MercadoPagoCheckout.closeCheckout();
    });
    document.getElementById('btnCopyPixCode')?.addEventListener('click', () => MercadoPagoCheckout.copyPixCode());
    document.getElementById('btnCheckPixStatus')?.addEventListener('click', () => {
      if (MercadoPagoCheckout._currentPaymentId) {
        MercadoPagoCheckout.checkPaymentStatus(MercadoPagoCheckout._currentPaymentId, true);
      }
    });
  }

  // ─── Notificações e verificação automática de atualizações ────────────────────────
  Notifications.init();
  Notifications.initReconnectionListeners();

  (async () => {
    const lastCheck = safeStorage.get('confeitex_last_auto_check');
    if (lastCheck && Date.now() - parseInt(lastCheck, 10) < 3_600_000) return;
    try { await Updates.checkAndUpdate(); } catch (e) {
      console.warn('[Confeitex] Erro na verificação automática:', e);
    }
    safeStorage.set('confeitex_last_auto_check', String(Date.now()));
  })();

  // ─── Retração da barra inferior no mobile ao rolar ─────────────────────────────
  let scrollTimeout;
  const handleScroll = () => {
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.classList.contains('sidebar-retracted')) {
        sidebar.classList.add('sidebar-retracted');
      }
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (sidebar) sidebar.classList.remove('sidebar-retracted');
      }, 500);
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  const mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.addEventListener('scroll', handleScroll, { passive: true });

})();

