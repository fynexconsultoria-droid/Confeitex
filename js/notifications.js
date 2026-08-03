const Notifications = {
  _started: false,
  _intervalId: null,
  _enabled: false,
  _swReg: null,
  _syncTimer: null,
  _db: null,

  defaultSettings: {
    daysBefore: [0, 1], // 0 = Hoje, 1 = 1 dia antes, 2 = 2 dias antes, 3 = 3 dias antes
    intervalHours: 1,  // Intervalo em horas (1, 2, 4, 12, 24)
    statuses: ['Pendente', 'Em Produção'],
    alertPendingPayment: true,
    reminderTime: '08:00', // Hora do lembrete agendado (notificações em segundo plano)
    overdueAlerts: true, // Avisa sobre pedidos com data de entrega vencida e ainda não entregues
    quietHoursEnabled: false, // Horário de silêncio: suprime notificações dentro do intervalo
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00'
  },

  getSettings() {
    try {
      const stored = localStorage.getItem('confeitex_notification_settings');
      if (stored) return { ...this.defaultSettings, ...JSON.parse(stored) };
    } catch (e) { console.warn('[Notifications] Erro ao carregar configurações:', e); }
    return { ...this.defaultSettings };
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem('confeitex_notification_settings', JSON.stringify(updated));
      if (this._enabled) {
        this._restartInterval();
        this.syncData();
      }
      return updated;
    } catch (e) {
      console.warn('[Notifications] Erro ao salvar configurações:', e);
      return this.getSettings();
    }
  },

  get enabled() {
    return this._enabled;
  },

  get status() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  },

  // ==== Capacidades em segundo plano ====

  // Modo 1: Notificações agendadas no sistema operacional (Notification Triggers API)
  // Dispara na hora marcada mesmo com o app e o navegador fechados.
  supportsTriggers() {
    return typeof TimestampTrigger !== 'undefined'
      && 'showNotification' in ServiceWorkerRegistration.prototype;
  },

  // Modo 2: Sincronização periódica — o navegador acorda o service worker
  // (Chrome/Edge; a frequência é controlada pelo navegador, ~12h+).
  supportsPeriodicSync() {
    return 'periodicSync' in ServiceWorkerRegistration.prototype;
  },

  // Modo ativo de notificações em segundo plano: 'triggers' | 'periodic' | null
  get backgroundMode() {
    if (!('serviceWorker' in navigator)) return null;
    if (this.supportsTriggers()) return 'triggers';
    if (this.supportsPeriodicSync()) return 'periodic';
    return null;
  },

  async _ensureSW() {
    if (!('serviceWorker' in navigator)) return null;
    if (this._swReg) return this._swReg;
    const timeout = new Promise(resolve => setTimeout(() => resolve(null), 3000));
    try {
      this._swReg = await Promise.race([navigator.serviceWorker.ready, timeout]);
    } catch (e) {
      this._swReg = null;
    }
    return this._swReg;
  },

  // ==== IndexedDB (compartilhado com o Service Worker) ====

  _idb() {
    if (this._db) return Promise.resolve(this._db);
    if (!('indexedDB' in window)) return Promise.resolve(null);
    return new Promise((resolve) => {
      const req = indexedDB.open('confeitex-sw-db', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => { this._db = req.result; resolve(this._db); };
      req.onerror = () => resolve(null);
    });
  },

  async _idbSet(key, value) {
    const db = await this._idb();
    if (!db) return;
    return new Promise((resolve) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  async _idbGet(key) {
    const db = await this._idb();
    if (!db) return undefined;
    return new Promise((resolve) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(undefined);
    });
  },

  // ==== Horário de silêncio ====

  // Verifica se uma data/hora específica cai dentro do horário de silêncio
  _inQuietHoursAt(date, settings) {
    if (!settings.quietHoursEnabled) return false;
    const cur = date.getHours() * 60 + date.getMinutes();
    const [sh, sm] = (settings.quietHoursStart || '22:00').split(':').map(Number);
    const [eh, em] = (settings.quietHoursEnd || '07:00').split(':').map(Number);
    const start = (sh || 0) * 60 + (sm || 0);
    const end = (eh || 0) * 60 + (em || 0);
    if (start === end) return false; // intervalo vazio
    if (start < end) return cur >= start && cur < end;
    return cur >= start || cur < end; // intervalo vira a meia-noite
  },

  // Verifica se AGORA está dentro do horário de silêncio
  _inQuietHours(settings) {
    return this._inQuietHoursAt(new Date(), settings);
  },

  // ==== Central de notificações (sino no topo) ====

  getHistory() {
    try {
      const raw = localStorage.getItem('confeitex_notif_history');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (e) { console.warn('[Notifications] Erro ao carregar histórico:', e); }
    return [];
  },

  unreadCount() {
    return this.getHistory().filter(n => !n.read).length;
  },

  _recordNotification(entry) {
    let history = this.getHistory();
    const idx = history.findIndex(h => h.id === entry.id);
    if (idx !== -1) {
      history[idx] = { ...history[idx], ...entry, time: Date.now() };
    } else {
      history.unshift(entry);
    }
    history = history.slice(0, 50);
    try {
      localStorage.setItem('confeitex_notif_history', JSON.stringify(history));
    } catch (e) { console.warn('[Notifications] Erro ao salvar histórico:', e); }
    this._updateBadge();
    const dd = document.getElementById('notifDropdown');
    if (dd && dd.classList.contains('open')) this._renderBellList();
  },

  _updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const n = this.unreadCount();
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = n > 0 ? 'flex' : 'none';
  },

  markRead(id) {
    let history = this.getHistory();
    let changed = false;
    history = history.map(h => {
      if (h.id === id && !h.read) { h.read = true; changed = true; }
      return h;
    });
    if (changed) {
      try { localStorage.setItem('confeitex_notif_history', JSON.stringify(history)); } catch (e) {}
      this._updateBadge();
      this._renderBellList();
    }
  },

  markAllRead() {
    let history = this.getHistory();
    let changed = false;
    history.forEach(h => { if (!h.read) { h.read = true; changed = true; } });
    if (changed) {
      try { localStorage.setItem('confeitex_notif_history', JSON.stringify(history)); } catch (e) {}
      this._updateBadge();
      this._renderBellList();
    }
  },

  clearHistory() {
    try { localStorage.removeItem('confeitex_notif_history'); } catch (e) {}
    this._updateBadge();
    this._renderBellList();
  },

  _timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    return `${d}d`;
  },

  // Abre a aba de pedidos e, se o pedido ainda existir, abre o modal de edição
  openOrder(orderId) {
    const link = document.querySelector('.nav-link[data-tab="orders"]');
    if (link) link.click();
    const order = (State.orders || []).find(o => o.id === orderId);
    if (order && typeof Orders !== 'undefined' && Orders.openEdit) {
      setTimeout(() => Orders.openEdit(orderId), 80);
    }
  },

  _renderBellList() {
    const list = document.getElementById('notifList');
    const empty = document.getElementById('notifEmpty');
    if (!list || !empty) return;
    const history = this.getHistory();
    empty.style.display = history.length === 0 ? 'block' : 'none';
    list.innerHTML = history.length === 0 ? '' : history.map(n => {
      const icon = n.type === 'overdue' ? '⚠️' : (n.type === 'test' ? '🔔' : '🎂');
      return `
        <button type="button" class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
          <span class="notif-item-icon">${icon}</span>
          <span class="notif-item-content">
            <span class="notif-item-title">${escapeHTML(n.title)}</span>
            <span class="notif-item-body">${escapeHTML(n.body)}</span>
            <span class="notif-item-time">${this._timeAgo(n.time)}</span>
          </span>
        </button>`;
    }).join('');

    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const entry = this.getHistory().find(h => h.id === id);
        this.markRead(id);
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.classList.remove('open');
        if (entry && entry.orderIds && entry.orderIds.length > 0) {
          this.openOrder(entry.orderIds[0]);
        }
      });
    });
  },

  setupBell() {
    const btn = document.getElementById('btnNotifBell');
    const dd = document.getElementById('notifDropdown');
    if (!btn || !dd) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !dd.classList.contains('open');
      dd.classList.toggle('open', willOpen);
      if (willOpen) this._renderBellList();
    });

    const btnReadAll = document.getElementById('btnNotifReadAll');
    if (btnReadAll) btnReadAll.addEventListener('click', () => this.markAllRead());

    const btnClear = document.getElementById('btnNotifClear');
    if (btnClear) btnClear.addEventListener('click', () => {
      this.clearHistory();
      UI.toast(I18n.t('notif.settings.toastCleared'));
    });

    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('notifBellWrap');
      if (wrap && !wrap.contains(e.target)) dd.classList.remove('open');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dd.classList.remove('open');
    });

    this._updateBadge();
  },

  // Atualiza a interface quando o idioma muda
  refreshUI() {
    this._updateBadge();
    const dd = document.getElementById('notifDropdown');
    if (dd && dd.classList.contains('open')) this._renderBellList();
    if (typeof Settings !== 'undefined' && Settings.renderNotificationStatus) {
      Settings.renderNotificationStatus();
    }
  },

  init() {
    if (this._started) return;
    this._started = true;
    this.setupBell();

    if (!('Notification' in window)) {
      if (typeof Settings !== 'undefined' && Settings.renderNotificationStatus) {
        Settings.renderNotificationStatus();
      }
      return;
    }

    const stored = localStorage.getItem('confeitex_notifications_enabled');
    if (stored === 'true' && Notification.permission === 'granted') {
      this._enable();
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this._enabled) this.check();
    });
    window.addEventListener('focus', () => {
      if (this._enabled) this.check();
    });

    // Garante que a interface reflita o estado real após a inicialização
    if (typeof Settings !== 'undefined' && Settings.renderNotificationStatus) {
      Settings.renderNotificationStatus();
    }
  },

  _enable() {
    if (this._enabled) return;
    this._enabled = true;
    localStorage.setItem('confeitex_notifications_enabled', 'true');
    this.check();
    this._restartInterval();
    this.syncData();
  },

  _restartInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    const settings = this.getSettings();
    const ms = (settings.intervalHours || 1) * 3600000;
    this._intervalId = setInterval(() => {
      if (this._enabled) this.check();
    }, ms);
  },

  _disable() {
    this._enabled = false;
    localStorage.setItem('confeitex_notifications_enabled', 'false');
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    this._idbSet('confeitex_snapshot', { enabled: false });
    this._unregisterBackground();
  },

  async enable() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }
    this._enable();
    this.check();
    return true;
  },

  disable() {
    this._disable();
  },

  toggle() {
    if (this._enabled) {
      this.disable();
      return false;
    } else {
      return this.enable();
    }
  },

  async sendTestNotification() {
    if (!('Notification' in window)) {
      UI.alert(I18n.t('notif.settings.alertUnsupported'));
      return false;
    }
    if (Notification.permission !== 'granted') {
      const ok = await this.enable();
      if (!ok) {
        UI.alert(I18n.t('notif.settings.alertDenied'));
        return false;
      }
    }
    try {
      const title = I18n.t('notif.testTitle');
      const body = I18n.t('notif.testBody');
      new Notification(title, {
        body,
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-test-' + Date.now()
      });
      this._recordNotification({
        id: 'test_' + Date.now(),
        type: 'test',
        title,
        body,
        orderIds: [],
        read: false
      });
      return true;
    } catch (e) {
      console.warn('[Notifications] Erro ao enviar notificação de teste:', e);
      return false;
    }
  },

  _buildContent(matchingOrders, dayOffset, targetDateStr, settings) {
    const dayLabels = {
      0: I18n.t('notif.day0'),
      1: I18n.t('notif.day1'),
      2: I18n.t('notif.day2'),
      3: I18n.t('notif.day3')
    };
    const dayLabel = dayLabels[dayOffset] || targetDateStr;
    let bodyMsg = I18n.t('notif.deliveriesScheduled', { count: matchingOrders.length, day: dayLabel }) + '\n';
    bodyMsg += matchingOrders.slice(0, 3).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
    if (matchingOrders.length > 3) {
      bodyMsg += I18n.t('notif.andMore', { count: matchingOrders.length - 3 });
    }
    if (settings.alertPendingPayment) {
      const withPendingVal = matchingOrders.filter(o => (o.totalValue || 0) > 0);
      if (withPendingVal.length > 0) {
        const totalVal = withPendingVal.reduce((s, o) => s + (o.totalValue || 0), 0);
        bodyMsg += I18n.t('notif.totalValue', { value: fmt(totalVal) });
      }
    }
    const title = dayOffset === 0
      ? I18n.t('notif.todayTitle')
      : I18n.t('notif.reminderTitle', { day: dayLabel });
    return { title, body: bodyMsg, orderIds: matchingOrders.map(o => o.id) };
  },

  // Modo 1: agenda no sistema operacional um lembrete por (data, antecedência)
  async _scheduleTriggers() {
    const reg = await this._ensureSW();
    if (!reg || !this.supportsTriggers()) return;

    // Cancela agendamentos anteriores — os dados podem ter mudado
    try {
      const all = await reg.getNotifications();
      for (const n of all) {
        if ((n.tag || '').startsWith('confeitex-sched')) n.close();
      }
    } catch (e) {}

    const settings = this.getSettings();
    const daysBeforeList = settings.daysBefore || [0, 1];
    const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}'); } catch (e) {}
    const now = new Date();
    const [rh, rm] = (settings.reminderTime || '08:00').split(':').map(Number);
    const todayStr = fmtISO(now);

    const combos = new Set();
    (State.orders || []).forEach(o => {
      if (!allowedStatuses.includes(o.status)) return;
      if (!o.deliveryDate || o.deliveryDate < todayStr) return;
      daysBeforeList.forEach(offset => {
        combos.add(`${offset}|${o.deliveryDate}`);
      });
    });

    for (const combo of combos) {
      const sep = combo.indexOf('|');
      const offset = Number(combo.slice(0, sep));
      const date = combo.slice(sep + 1);
      const cacheKey = `notif_d${offset}_${date}`;
      if (sent[cacheKey]) continue; // já notificado com o app aberto

      const when = new Date(date + 'T00:00:00');
      when.setDate(when.getDate() - offset);
      when.setHours(rh, rm, 0, 0);
      if (when.getTime() <= now.getTime()) continue;
      // Não agenda lembretes que cairiam dentro do horário de silêncio
      if (this._inQuietHoursAt(when, settings)) continue;

      const matchingOrders = State.orders.filter(o =>
        o.deliveryDate === date && allowedStatuses.includes(o.status));
      if (matchingOrders.length === 0) continue;

      const { title, body } = this._buildContent(matchingOrders, offset, date, settings);
      try {
        await reg.showNotification(title, {
          body,
          icon: 'icons/icon-192x192.png',
          tag: `confeitex-sched-d${offset}-${date}`,
          showTrigger: new TimestampTrigger(when.getTime())
        });
      } catch (e) {}
    }
  },

  // Modo 2: registra sincronização periódica no service worker
  async _registerPeriodicSync() {
    const reg = await this._ensureSW();
    if (!reg || !('periodicSync' in reg)) return;
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;
    } catch (e) {}
    try {
      await reg.periodicSync.register('confeitex-notif-sync', { minInterval: 12 * 60 * 60 * 1000 });
    } catch (e) {}
  },

  // Cancela agendamentos e a sincronização periódica
  async _unregisterBackground() {
    const reg = await this._ensureSW();
    if (!reg) return;
    if (reg.periodicSync) {
      try { await reg.periodicSync.unregister('confeitex-notif-sync'); } catch (e) {}
    }
    try {
      const all = await reg.getNotifications();
      for (const n of all) {
        if ((n.tag || '').startsWith('confeitex-sched')) n.close();
      }
    } catch (e) {}
  },

  // Registra todos os modos em segundo plano suportados
  async registerAll() {
    if (!this._enabled) return;
    await this._scheduleTriggers();
    await this._registerPeriodicSync();
  },

  // Envia um retrato dos dados ao service worker e re-agenda (debounced)
  syncData() {
    if (!this._enabled) return;
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(async () => {
      const settings = this.getSettings();
      const snapshot = {
        enabled: true,
        updatedAt: Date.now(),
        lang: (typeof I18n !== 'undefined' && I18n.lang) || 'pt-BR',
        currency: (typeof I18n !== 'undefined' && I18n.currency) ? I18n.currency() : 'BRL',
        settings: {
          daysBefore: settings.daysBefore,
          statuses: settings.statuses,
          alertPendingPayment: settings.alertPendingPayment,
          overdueAlerts: settings.overdueAlerts,
          quietHoursEnabled: settings.quietHoursEnabled,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd
        },
        orders: (State.orders || []).map(o => ({
          deliveryDate: o.deliveryDate,
          deliveryTime: o.deliveryTime,
          clientName: o.clientName,
          flavor: o.flavor,
          status: o.status,
          totalValue: o.totalValue
        }))
      };
      await this._idbSet('confeitex_snapshot', snapshot);

      // Unifica o dedupe: notificações enviadas pelo service worker também
      // contam como "já notificado" para a verificação dentro do app.
      const swSent = await this._idbGet('confeitex_sent') || {};
      let sent = {};
      try { sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}'); } catch (e) {}
      let changed = false;
      for (const k in swSent) {
        if (!sent[k]) { sent[k] = true; changed = true; }
      }
      if (changed) localStorage.setItem('confeitex_notified', JSON.stringify(sent));

      await this.registerAll();
    }, 800);
  },

  async check() {
    if (!this._enabled || !('Notification' in window) || Notification.permission !== 'granted') return;

    const settings = this.getSettings();
    // Horário de silêncio: não notifica dentro do intervalo configurado
    if (this._inQuietHours(settings)) return;

    const daysBeforeList = settings.daysBefore || [0, 1];
    const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}'); } catch (e) { sent = {}; }
    const now = new Date();
    const todayStr = fmtISO(now);

    // Limpa chaves de datas passadas (evita acúmulo)
    let dirty = false;
    for (const k in sent) {
      const m = k.match(/^notif_d(\d+)_(\d{4}-\d{2}-\d{2})$/);
      if (m && m[2] < todayStr) { delete sent[k]; dirty = true; }
      const o = k.match(/^overdue_(\d{4}-\d{2}-\d{2})$/);
      if (o && o[1] < todayStr) { delete sent[k]; dirty = true; }
    }

    // Se houver lembrete agendado no sistema para o combo, deixa o SO entregar
    const reg = this.supportsTriggers() ? await this._ensureSW() : null;

    for (const dayOffset of daysBeforeList) {
      const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
      const targetDateStr = fmtISO(targetDateObj);

      const matchingOrders = State.orders.filter(o => {
        if (o.deliveryDate !== targetDateStr) return false;
        return allowedStatuses.includes(o.status);
      });

      if (matchingOrders.length === 0) continue;

      const cacheKey = `notif_d${dayOffset}_${targetDateStr}`;
      if (sent[cacheKey]) continue;

      if (reg) {
        try {
          const pending = await reg.getNotifications({ tag: `confeitex-sched-d${dayOffset}-${targetDateStr}` });
          if (pending.length > 0) continue;
        } catch (e) {}
      }

      const { title, body, orderIds } = this._buildContent(matchingOrders, dayOffset, targetDateStr, settings);
      new Notification(title, {
        body,
        icon: 'icons/icon-192x192.png',
        tag: `confeitex-day-${dayOffset}-${targetDateStr}`
      });
      this._recordNotification({
        id: cacheKey,
        type: dayOffset === 0 ? 'today' : 'reminder',
        title,
        body,
        orderIds,
        deliveryDate: targetDateStr,
        read: false
      });

      sent[cacheKey] = true;
      dirty = true;
    }

    // Alertas de pedidos atrasados (data de entrega vencida e ainda pendente)
    if (settings.overdueAlerts !== false) {
      const overdueOrders = State.orders.filter(o =>
        allowedStatuses.includes(o.status) && o.deliveryDate && o.deliveryDate < todayStr);
      if (overdueOrders.length > 0) {
        const cacheKey = `overdue_${todayStr}`;
        if (!sent[cacheKey]) {
          let bodyMsg = I18n.t('notif.overdueBody', { count: overdueOrders.length }) + '\n';
          bodyMsg += overdueOrders.slice(0, 3).map(o =>
            `• ${o.clientName}: ${o.flavor} (${fmtDateStr(o.deliveryDate)})`).join('\n');
          if (overdueOrders.length > 3) {
            bodyMsg += I18n.t('notif.andMore', { count: overdueOrders.length - 3 });
          }
          const title = I18n.t('notif.overdueTitle');
          new Notification(title, {
            body: bodyMsg,
            icon: 'icons/icon-192x192.png',
            tag: `confeitex-overdue-${todayStr}`
          });
          this._recordNotification({
            id: cacheKey,
            type: 'overdue',
            title,
            body: bodyMsg,
            orderIds: overdueOrders.map(o => o.id),
            deliveryDate: todayStr,
            read: false
          });
          sent[cacheKey] = true;
          dirty = true;
        }
      }
    }

    if (dirty) {
      localStorage.setItem('confeitex_notified', JSON.stringify(sent));
      this._idbSet('confeitex_sent', sent);
    }
  }
};
