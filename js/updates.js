const Updates = {
  verAtual: '1.12.9',

  setup() {
    document.getElementById('btnCheckUpdates').addEventListener('click', () => this.check());
  },

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  // Verifica nova versão (retorna versão ou null)
  async _fetchVersion() {
    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      return (await r.text()).trim();
    } catch { return null; }
  },

  // Auto-verificação silenciosa (chamada pelo app.js)
  async checkSilent() {
    const serverVer = await this._fetchVersion();
    if (serverVer && serverVer !== this.verAtual) {
      await this.autoUpdate(serverVer);
      return serverVer;
    }
    return null;
  },

  // Auto-update silencioso (sem prompt, sem banner)
  async autoUpdate(ver) {
    const oldVer = this.verAtual;
    localStorage.setItem('confeitex_ver', ver);
    this.verAtual = ver;

    if (!('serviceWorker' in navigator)) {
      localStorage.setItem('confeitex_updated', 'true');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register('./sw.js?v=' + ver);
      // Aguarda instalacao (max 10s)
      await Promise.race([
        new Promise(resolve => {
          const w = reg.installing || reg.waiting;
          if (w) {
            w.addEventListener('statechange', () => {
              if (w.state === 'activated' || w.state === 'installed') resolve();
            });
          } else resolve();
        }),
        this._delay(10000)
      ]);
    } catch {}
  },

  async downloadUpdate() {
    const newVer = localStorage.getItem('confeitex_ver') || this.verAtual;

    this._showProgress(newVer);

    // Limpa flags de cache/notificações antigas
    localStorage.removeItem('confeitex_notified');
    localStorage.removeItem('confeitex_update_prompt');
    localStorage.removeItem('confeitex_pwa_dismissed');

    // Remove Service Worker antigo
    this._updateProgress(15, 'Limpando cache anterior...');
    let swOk = 'serviceWorker' in navigator;
    if (swOk) {
      try {
        const r = await navigator.serviceWorker.getRegistration();
        if (r) await r.unregister();
      } catch {}
    }

    // Se não suportar SW, marca como atualizado e mostra banner
    if (!swOk) {
      localStorage.setItem('confeitex_updated', 'true');
      localStorage.setItem('confeitex_ver', newVer);
      this._updateProgress(100, '✅ Atualização registrada!');
      await this._delay(600);
      this._showUpdateBanner(newVer);
      return;
    }

    // Registra novo Service Worker
    this._updateProgress(40, 'Registrando novo Service Worker...');
    let reg;
    try {
      reg = await navigator.serviceWorker.register('./sw.js?v=' + newVer);
    } catch {
      this._hideProgress();
      UI.alert('Erro de conexão. Verifique sua internet e tente novamente.');
      return;
    }

    // Aguarda instalação/ativação (máx 25s)
    this._updateProgress(60, 'Ativando nova versão...');
    const ativado = await Promise.race([
      new Promise(resolve => {
        const w = reg.installing;
        if (w) {
          w.addEventListener('statechange', () => {
            const st = w.state;
            if (st === 'installed' || st === 'activated') resolve(true);
            else if (st === 'redundant') {
              setTimeout(() => resolve(!!(reg.active && reg.active.state === 'activated')), 1000);
            }
          });
        } else if (reg.active) {
          resolve(reg.active.state === 'activated');
        } else {
          setTimeout(() => resolve(false), 1500);
        }
      }),
      this._delay(25000).then(() => false)
    ]);

    // Marca como atualizado
    localStorage.setItem('confeitex_updated', 'true');
    localStorage.setItem('confeitex_ver', newVer);

    this._updateProgress(100, ativado ? '✅ Instalação concluída!' : '📦 Instalação concluída (ativará ao reabrir)');
    await this._delay(800);

    // Mostra banner de notificação para o usuário decidir
    this._showUpdateBanner(newVer);
  },

  _showProgress(ver) {
    const banner = document.getElementById('updateNotification');
    const text = document.getElementById('updateNotifText');
    const progress = document.getElementById('updateProgress');
    const actions = document.getElementById('updateActions');
    const fill = document.getElementById('updateProgressFill');
    const label = document.getElementById('updateProgressLabel');
    if (!banner || !text || !progress || !actions || !fill || !label) return;

    text.textContent = `Baixando Confeitex v${ver}...`;
    progress.style.display = 'flex';
    actions.style.display = 'none';
    fill.style.width = '0%';
    label.textContent = 'Preparando...';

    banner.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
  },

  _updateProgress(pct, msg) {
    const fill = document.getElementById('updateProgressFill');
    const label = document.getElementById('updateProgressLabel');
    if (fill) fill.style.width = Math.min(pct, 100) + '%';
    if (label) label.textContent = msg;
  },

  _hideProgress() {
    const banner = document.getElementById('updateNotification');
    if (banner) {
      banner.classList.remove('visible');
      banner.addEventListener('transitionend', () => {
        banner.style.display = 'none';
      }, { once: true });
    }
  },

  _showUpdateBanner(ver) {
    const banner = document.getElementById('updateNotification');
    const text = document.getElementById('updateNotifText');
    const progress = document.getElementById('updateProgress');
    const actions = document.getElementById('updateActions');
    const btnNow = document.getElementById('btnUpdateNow');
    const btnLater = document.getElementById('btnUpdateLater');
    const btnClose = document.getElementById('btnUpdateCloseApp');
    if (!banner || !text || !progress || !actions || !btnNow || !btnLater || !btnClose) return;

    progress.style.display = 'none';
    actions.style.display = 'flex';
    text.textContent = `✅ Atualização Confeitex v${ver} instalada! Deseja recarregar agora para aplicar as mudanças?`;

    // Se o banner ainda não estiver visível (ex: sem SW), exibe
    if (!banner.classList.contains('visible')) {
      banner.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('visible')));
    }

    const hide = () => {
      banner.classList.remove('visible');
      banner.addEventListener('transitionend', () => {
        banner.style.display = 'none';
      }, { once: true });
    };

    btnNow.onclick = () => {
      localStorage.removeItem('confeitex_updated');
      hide();
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0].split('#')[0] + '?v=' + Date.now();
      }, 300);
    };

    btnLater.onclick = () => {
      hide();
    };

    btnClose.onclick = () => {
      localStorage.removeItem('confeitex_updated');
      hide();
      setTimeout(() => {
        try { window.open('', '_self'); window.close(); } catch {}
        setTimeout(() => { window.location.replace('about:blank'); }, 500);
      }, 400);
    };
  },

  changelog: [
    { ver: '1.12.9', date: '17/07/2026', items: [
      'Auto-update: atualizações detectadas são baixadas e instaladas em segundo plano automaticamente, sem confirmação do usuário',
      'Auto-update: após instalação, o app recarrega sozinho com um toast "App atualizado para vX"',
      'O botão "Verificar Agora" ainda permite checagem manual com controle do usuário'
    ] },
    { ver: '1.12.8', date: '17/07/2026', items: [
      'Correção: Faturamento Total não aparecia no celular — migrateOrder() quebrava com TypeError ao calcular totalValue de pedidos antigos com vírgula decimal',
      'Correção: Gráfico não renderizava no modo "Hoje" (ReferenceError: pt/pb undefined)',
      'Correção: Gradiente do gráfico usava topo fixo em vez do valor mais alto dos dados',
      'Correção: Stroke e fill do gráfico na ordem errada causavam artefatos visuais',
      'Correção: export CSV quebrava se unitPrice/extraCharges/totalValue fossem NaN',
      'Correção: Soma de totais no Dashboard, Clientes e Gráfico agora segura contra NaN',
      'Melhoria: Gráfico agora redimensiona suavemente com a janela (requestAnimationFrame)',
      'Melhoria: Input de peso do bolo aceita qualquer valor (step="any")',
      'Melhoria: Ícone do app centralizado — vela agora visível na área segura do launcher'
    ] },
    { ver: '1.12.1', date: '14/07/2026', items: ['Correção: reg.installing vira null durante statechange — agora captura referencia do worker', 'Correção: downloadUpdate() sem await causava UI reset prematuro e promessas nao tratadas', 'Correção: Null-checks no banner de notificacao para evitar crash se elementos nao existirem', 'Correção: Faturamento Total agora calcula totalValue para pedidos antigos (weight * unitPrice)', 'Correção: Versão atual exibida imediatamente nas Atualizações após o update (via localStorage)', 'Correção: Div `.config-card` de Notificações sem fechamento — Security settings aninhado erroneamente', 'Correção: deliveredAt agora é salvo ao criar/editar pedido com status "Entregue"', 'Correção: Gráfico não renderizava no período "Hoje" (divisão por zero no eixo X)', 'Correção: Login não trava mais se crypto.subtle falhar (try-catch + finally no botão)', 'Correção: Flag confeitex_updated removida só após confirmação do usuário', 'Otimização: Botões com min-height:44px para toque preciso em celulares', 'Otimização: Inputs com font-size:16px evitam zoom automático no iOS', 'Otimização: touch-action:manipulation elimina delay de 300ms em toques', 'Otimização: overscroll-behavior:contain e -webkit-overflow-scrolling:touch para scroll suave'] }
  ],

  render() {
    const stored = localStorage.getItem('confeitex_ver');
    const displayVer = stored || this.verAtual;
    document.getElementById('updatesCurrentVer').textContent = `v${displayVer}`;
    const lastCheck = localStorage.getItem('confeitex_last_check');
    document.getElementById('updatesLastCheck').textContent = lastCheck || 'Nunca verificada';
    this.renderChangelog();
    this.updateStatus('');
  },

  renderChangelog() {
    const container = document.getElementById('updatesChangelog');
    container.innerHTML = this.changelog.map(v => `
      <div style="border-bottom:1px solid var(--border-color);padding-bottom:0.75rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;">
          <span style="background:var(--gradient-primary);color:#fff;font-size:0.65rem;font-weight:700;padding:0.15rem 0.5rem;border-radius:50px;">v${v.ver}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);">${v.date}</span>
        </div>
        <ul style="margin:0;padding-left:1.25rem;font-size:0.8rem;color:var(--text-secondary);display:flex;flex-direction:column;gap:0.2rem;">
          ${v.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  },

  updateStatus(msg, isError) {
    const el = document.getElementById('updatesStatus');
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-danger)' : 'var(--color-success)';
  },

  async check() {
    const btn = document.getElementById('btnCheckUpdates');
    const btnHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Verificar Agora';
    btn.disabled = true;
    btn.innerHTML = '<span class="login-spinner"></span> Verificando...';
    this.updateStatus('Verificando...');

    const serverVer = await this._fetchVersion();
    localStorage.setItem('confeitex_last_check', new Date().toLocaleString('pt-BR'));
    document.getElementById('updatesLastCheck').textContent = localStorage.getItem('confeitex_last_check');

    if (serverVer && serverVer !== this.verAtual) {
      const confirmado = await UI.confirm({
        title: 'Nova versão disponível',
        message: `Atualização v${serverVer} encontrada!\n\nClique em "Atualizar" para instalar em segundo plano. Você poderá continuar usando o app durante a instalação.`,
        confirmText: 'Atualizar',
        variant: 'primary'
      });
      if (!confirmado) {
        this.updateStatus('Atualização cancelada.');
        btn.disabled = false;
        btn.innerHTML = btnHtml;
        return;
      }
      this.updateStatus(`Nova versão v${serverVer} encontrada! Instalando...`);
      btn.disabled = false;
      btn.innerHTML = btnHtml;
      localStorage.setItem('confeitex_ver', serverVer);
      await this.downloadUpdate();
      return;
    } else if (serverVer === this.verAtual) {
      this.updateStatus('App atualizado! Você está na versão mais recente.');
    } else {
      this.updateStatus('Sem conexão com a internet.', true);
    }

    btn.disabled = false;
    btn.innerHTML = btnHtml;
  }
};
