const Updates = {
  verAtual: '1.20.1',

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

  // Verificação silenciosa (chamada pelo app.js) — Pergunta antes de atualizar
  async checkSilent() {
    const serverVer = await this._fetchVersion();
    if (serverVer && serverVer !== this.verAtual) {
      const deferred = localStorage.getItem('confeitex_update_deferred');
      const oneDay = 86400000;
      if (deferred && Date.now() - parseInt(deferred, 10) < oneDay) {
        return serverVer;
      }
      await this.promptUpdate(serverVer);
      return serverVer;
    }
    return null;
  },

  // Diálogo de confirmação de atualização: "Atualizar Agora" ou "Mais Tarde"
  async promptUpdate(serverVer) {
    const ok = await UI.confirm({
      title: '📦 Nova Atualização Disponível',
      message: `Uma nova versão do Confeitex (v${serverVer}) está pronta!\n\nDeseja atualizar agora para aplicar as melhorias ou deixar para mais tarde?`,
      confirmText: '🔄 Atualizar Agora',
      cancelText: '⏱️ Mais Tarde',
      variant: 'primary'
    });

    if (ok) {
      localStorage.removeItem('confeitex_update_deferred');
      localStorage.setItem('confeitex_ver', serverVer);
      await this.downloadUpdate();
    } else {
      localStorage.setItem('confeitex_update_deferred', String(Date.now()));
      UI.toast('Atualização mantida para mais tarde.');
    }
  },

  async downloadUpdate() {
    const newVer = localStorage.getItem('confeitex_ver') || this.verAtual;
    const startedAt = Date.now();

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
      } catch (e) { console.warn('[Confeitex] Auto-update SW registration error:', e); }
    }

    // Se não suportar SW, marca como atualizado e mostra banner
    if (!swOk) {
      await this._settleProgress(startedAt, 'Registrando atualização...');
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
      // Marca antes de registrar para o auto-reload saber que o update foi aceito
      localStorage.setItem('confeitex_updated', 'true');
      reg = await navigator.serviceWorker.register('./sw.js?v=' + newVer);
    } catch {
      localStorage.removeItem('confeitex_updated');
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

    // Mantém a barra visível por pelo menos 10s para aplicar as mudanças com calma
    await this._settleProgress(startedAt, 'Aplicando mudanças com segurança...');

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

  _animateProgress(targetPct, duration, msg) {
    return new Promise(resolve => {
      const fill = document.getElementById('updateProgressFill');
      const label = document.getElementById('updateProgressLabel');
      if (label && msg) label.textContent = msg;
      if (!fill || duration <= 0) { resolve(); return; }
      const startPct = parseFloat(fill.style.width) || 0;
      const startTime = performance.now();
      const step = (now) => {
        const t = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        fill.style.width = (startPct + (targetPct - startPct) * eased) + '%';
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  },

  _settleProgress(startedAt, msg) {
    const minMs = 10000;
    const remaining = Math.max(0, minMs - (Date.now() - startedAt));
    return this._animateProgress(99, remaining, msg);
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
      setTimeout(() => window.location.reload(), 300);
    };

    btnLater.onclick = () => {
      hide();
    };

    btnClose.onclick = () => {
      hide();
      UI.toast('🔄 A atualização será aplicada na próxima vez que você abrir o app.');
    };
  },

  changelog: [
    { ver: '1.20.1', date: '01/08/2026', items: [
      'Melhoria: Novo sistema de seleção de período no Financeiro — atalhos rápidos (Hoje, Ontem, Esta Semana, Este Mês, Mês Passado, Últimos 30 Dias, Todos) e intervalo personalizado "De/Até", substituindo a seleção confusa de mês e dia'
    ] },
    { ver: '1.20.0', date: '01/08/2026', items: [
      'Novo: Relatório Financeiro em PDF — gera o relatório do período selecionado (mês ou dia) com os gráficos, pedidos completos e resultado final (bruto e líquido)'
    ] },
    { ver: '1.19.0', date: '31/07/2026', items: [
      'Novo: Notificações com o app fechado — lembretes agendados no sistema (Notification Triggers) em Chrome/Edge/Android com o app instalado',
      'Novo: Sincronização periódica em segundo plano como alternativa (Periodic Background Sync) em outros navegadores Chromium',
      'Novo: Controles avançados de notificações — antecedência, frequência, status, valor total e hora do lembrete',
      'Melhoria: verificação dentro do app continua funcionando como plano de segurança em todos os navegadores'
    ] },
    { ver: '1.18.1', date: '31/07/2026', items: [
      'Melhoria: Histórico de versões limpo — apenas versões a partir da 1.17 são exibidas'
    ] },
    { ver: '1.18.0', date: '31/07/2026', items: [
      'Correção: "Mais Tarde" agora realmente adia a atualização — o cache não é mais substituído em segundo plano antes de você confirmar',
      'Correção: recarga automática ao trocar Service Worker agora só ocorre quando a atualização foi aceita (sem recarregar à toa)',
      'Melhoria: Barra de progresso da atualização mais visível e estável durante a instalação',
      'Melhoria: Instalação aguarda cerca de 10 segundos com a barra em andamento para aplicar todas as mudanças com segurança'
    ] },
    { ver: '1.17.0', date: '31/07/2026', items: [
      'Novo: Lixeira com restauração em até 7 dias — pedidos excluídos não são mais perdidos permanentemente',
      'Novo: Botão "Excluir" na tela de Clientes — move todos os pedidos do cliente para a lixeira',
      'Segurança: Senha de bloqueio reforçada com PBKDF2 + salt (hash único por instalação)',
      'Melhoria: Cálculo de valores de pedidos mais robusto e moeda formatada sem quebras de linha',
      'Melhoria: Notificações re-checadas ao focar a janela e status sincronizado com as configurações',
      'Design & Marca: Nova logo minimalista "Bolo em Traço" — traços finos em fundo escuro com chama em gradiente, para ícone do app, favicon e header'
    ] },
  ],

  render() {
    const displayVer = this.verAtual;
    localStorage.setItem('confeitex_ver', displayVer);
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
