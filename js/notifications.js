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
    reminderTime: '08:00' // Hora do lembrete agendado (notificações em segundo plano)
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

  init() {
    if (this._started || !('Notification' in window)) return;
    this._started = true;

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
      UI.alert('Seu navegador não suporta notificações.');
      return false;
    }
    if (Notification.permission !== 'granted') {
      const ok = await this.enable();
      if (!ok) {
        UI.alert('Permissão de notificações negada pelo navegador.');
        return false;
      }
    }
    try {
      new Notification('Confeitex - Teste de Notificação 🎂', {
        body: 'As notificações do Confeitex estão ativas e funcionando perfeitamente!',
        icon: 'icons/icon-192x192.png',
        tag: 'confeitex-test-' + Date.now()
      });
      return true;
    } catch (e) {
      console.warn('[Notifications] Erro ao enviar notificação de teste:', e);
      return false;
    }
  },

  _buildContent(matchingOrders, dayOffset, targetDateStr, settings) {
    const dayLabels = {
      0: 'Hoje',
      1: 'Amanhã',
      2: 'em 2 Dias',
      3: 'em 3 Dias'
    };
    let bodyMsg = `${matchingOrders.length} entrega(s) agendada(s) para ${dayLabels[dayOffset] || `dia ${targetDateStr}`}:\n`;
    bodyMsg += matchingOrders.slice(0, 3).map(o => `• ${o.deliveryTime || ''} ${o.clientName}: ${o.flavor}`).join('\n');
    if (matchingOrders.length > 3) {
      bodyMsg += `\ne mais ${matchingOrders.length - 3} pedido(s)...`;
    }
    if (settings.alertPendingPayment) {
      const withPendingVal = matchingOrders.filter(o => (o.totalValue || 0) > 0);
      if (withPendingVal.length > 0) {
        const totalVal = withPendingVal.reduce((s, o) => s + (o.totalValue || 0), 0);
        bodyMsg += `\n💰 Valor total: R$ ${totalVal.toFixed(2).replace('.', ',')}`;
      }
    }
    const title = dayOffset === 0
      ? 'Confeitex - Entregas de Hoje! 🎂'
      : `Confeitex - Lembrete: Entregas ${dayLabels[dayOffset] || 'em breve'} 🎂`;
    return { title, body: bodyMsg };
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
    const todayStr = now.toISOString().split('T')[0];

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
        settings: {
          daysBefore: settings.daysBefore,
          statuses: settings.statuses,
          alertPendingPayment: settings.alertPendingPayment
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
    const daysBeforeList = settings.daysBefore || [0, 1];
    const allowedStatuses = settings.statuses || ['Pendente', 'Em Produção'];
    let sent = {};
    try { sent = JSON.parse(localStorage.getItem('confeitex_notified') || '{}'); } catch (e) { sent = {}; }
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Limpa chaves de datas passadas (evita acúmulo)
    let dirty = false;
    for (const k in sent) {
      const m = k.match(/^notif_d(\d+)_(\d{4}-\d{2}-\d{2})$/);
      if (m && m[2] < todayStr) { delete sent[k]; dirty = true; }
    }

    // Se houver lembrete agendado no sistema para o combo, deixa o SO entregar
    const reg = this.supportsTriggers() ? await this._ensureSW() : null;

    for (const dayOffset of daysBeforeList) {
      const targetDateObj = new Date(now.getTime() + dayOffset * 86400000);
      const targetDateStr = targetDateObj.toISOString().split('T')[0];

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

      const { title, body } = this._buildContent(matchingOrders, dayOffset, targetDateStr, settings);
      new Notification(title, {
        body,
        icon: 'icons/icon-192x192.png',
        tag: `confeitex-day-${dayOffset}-${targetDateStr}`
      });

      sent[cacheKey] = true;
      dirty = true;
    }

    if (dirty) {
      localStorage.setItem('confeitex_notified', JSON.stringify(sent));
      this._idbSet('confeitex_sent', sent);
    }
  }
};
