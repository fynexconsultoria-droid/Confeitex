const Updates = {
  verAtual: '16',

  assets: [
    './', './index.html', './style.css', './manifest.json',
    './js/state.js', './js/auth.js', './js/utils.js', './js/ui.js',
    './js/pwa.js', './js/chart.js', './js/notifications.js',
    './js/dashboard.js', './js/orders.js', './js/clients.js',
    './js/settings.js', './js/updates.js', './js/app.js',
    './icons/icon-192x192.png', './icons/icon-512x512.png'
  ],

  setup() {
    document.getElementById('btnCheckUpdates').addEventListener('click', () => this.check());
  },

  async checkSilent() {
    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const serverVer = (await r.text()).trim();
      if (serverVer && serverVer !== this.verAtual) return serverVer;
    } catch {}
    return null;
  },

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  },

  async downloadUpdate() {
    const overlay = document.getElementById('updateOverlay');
    const bar = document.getElementById('updateProgressBar');
    const percentEl = document.getElementById('updateProgressPercent');
    const bytesEl = document.getElementById('updateProgressBytes');
    const statusEl = document.getElementById('updateStatusText');

    overlay.classList.add('active');

    // 1. Limpa todos os caches do app
    bar.style.width = '15%';
    percentEl.textContent = '15%';
    statusEl.textContent = 'Limpando caches antigos...';
    try {
      await caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    } catch {}
    bar.style.width = '35%';
    percentEl.textContent = '35%';

    // 2. Desregistra o Service Worker atual para evitar conflito
    statusEl.textContent = 'Removendo Service Worker antigo...';
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      } catch {}
    }
    bar.style.width = '55%';
    percentEl.textContent = '55%';

    // 3. Marca no localStorage que foi atualizado (para feedback pós-reload)
    statusEl.textContent = 'Preparando nova versão...';
    localStorage.setItem('fyntex_updated', 'true');
    bar.style.width = '75%';
    percentEl.textContent = '75%';

    // 4. Contagem regressiva e recarrega
    let segundos = 3;
    statusEl.textContent = `Atualização concluída! Recarregando em ${segundos}s...`;
    const intervalo = setInterval(() => {
      segundos--;
      if (segundos > 0) {
        statusEl.textContent = `Atualização concluída! Recarregando em ${segundos}s...`;
      } else {
        clearInterval(intervalo);
        bar.style.width = '100%';
        percentEl.textContent = '100%';
        bytesEl.textContent = 'Concluído';
        statusEl.textContent = 'Recarregando...';
        window.location.href = window.location.href.split('?')[0].split('#')[0] + '?v=' + Date.now();
      }
    }, 1000);
  },

  changelog: [
    { ver: '16', date: '13/07/2026', items: ['Notificações modernas: toast com ícone e glass-morphism, modal com gradiente e animação', 'Verificação automática de nova versão ao abrir o app (máx 1x/hora)', 'Sistema de atualização refatorado: limpa caches, desregistra SW antigo e recarrega do zero', 'Confirmação visual "App atualizado" após reload', 'Gradiente vermelho/rosa do canto inferior direito e do login removido', 'Filtro de pedidos não começa mais com data de hoje — mostra todos', 'SVG dos botões preservado após loading/erro no login e atualizações', 'deliveredAt limpo ao mudar status de "Entregue" para outro'] },
    { ver: '15', date: '13/07/2026', items: ['Sistema de atualização refatorado: limpa caches, desregistra SW antigo e recarrega do zero', 'Confirmação visual "App atualizado" após reload', 'Gradiente vermelho/rosa do canto inferior direito e do login removido', 'Filtro de pedidos não começa mais com data de hoje — mostra todos', 'SVG dos botões preservado após loading/erro no login e atualizações', 'deliveredAt limpo ao mudar status de "Entregue" para outro', 'Contagem regressiva de 3s antes de recarregar após atualização', 'substr() substituído por slice(), segurança em closest()'] },
    { ver: '14', date: '13/07/2026', items: ['Design: sombras brancas e outlines removidos ao clicar em elementos', 'Tabelas de Pedidos e Clientes agora cabem na tela sem scroll horizontal', 'Atualização não trava mais em tela preta — usa ciclo do Service Worker', 'Configurações: espaçamento e alinhamento de textos e botões ajustados', 'Cache do SW dinâmico por versão para evitar conflitos'] },
    { ver: '13', date: '13/07/2026', items: ['version.txt não é mais cacheado pelo SW — toda verificação vai à rede', 'Auto-reload quando novo Service Worker assumir o controle', 'Sistema de atualização mais robusto e confiável', 'Nunca atualiza sem perguntar: confirmação obrigatória'] },
    { ver: '12', date: '13/07/2026', items: ['Força atualização do Service Worker com novo cache v1.6.0'] },
    { ver: '11', date: '12/07/2026', items: ['App fecha completamente após atualizar', 'Funciona em PWA standalone (mobile)', 'Fallback para reload se não conseguir fechar'] },
    { ver: '9', date: '12/07/2026', items: ['Novo layout das Configurações: cards reorganizados e mais visíveis', 'Atualização automática ao detectar nova versão (sem confirmação)', 'Verificação periódica a cada 6h ou ao retornar ao app', 'Status com nome do arquivo sendo baixado na atualização', 'Botão "Forçar Recarregar" removido', 'Indicador "Mais usado" no Catálogo de Sabores'] },
    { ver: '8', date: '12/07/2026', items: ['Auditoria geral: correções e melhorias', 'Dados demonstrativos reais no botão de testes', 'Botão Fechar na tela de login fecha a aba', 'Prefetch de offline.html removido (arquivo inexistente)', 'Apagar dados agora também remove bloqueio de segurança'] },
    { ver: '7', date: '12/07/2026', items: ['Bloqueio por senha (login offline) com SHA-256', 'Tela de login com proteção do app', 'Gerenciamento de senha nas Configurações'] },
    { ver: '6', date: '12/07/2026', items: ['Barra de progresso com KB/MB ao baixar atualizações', 'Download de arquivos monitorado em tempo real', 'Overlay animado durante a atualização'] },
    { ver: '5', date: '12/07/2026', items: ['Correções de bugs e melhorias gerais de performance'] },
    { ver: '4', date: '12/07/2026', items: ['Correções de bugs e melhorias de performance'] },
    { ver: '3', date: '12/07/2026', items: ['Aba "Atualizações" adicionada no menu', 'Backup agora gera PDF (impressão)', 'Notificação customizada ao detectar nova versão', 'Service Worker com stale-while-revalidate', 'Tabelas mais compactas no mobile', 'Forçar verificação de atualização ao carregar'] },
    { ver: '2', date: '11/07/2026', items: ['Remoção de dados demo na inicialização', 'Textos otimizados para mobile', 'Sombras removidas no toque'] },
    { ver: '1', date: '10/07/2026', items: ['Versão inicial do Fyntex Confeitaria'] }
  ],

  render() {
    document.getElementById('updatesCurrentVer').textContent = `v${this.verAtual}`;
    const lastCheck = localStorage.getItem('fyntex_last_check');
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

    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('Sem conexão');
      const serverVer = (await r.text()).trim();
      localStorage.setItem('fyntex_last_check', new Date().toLocaleString('pt-BR'));
      document.getElementById('updatesLastCheck').textContent = localStorage.getItem('fyntex_last_check');

      if (serverVer && serverVer !== this.verAtual) {
        const confirmado = await UI.confirm({
          title: 'Nova versão disponível',
          message: `Atualização v${serverVer} encontrada! Deseja baixar e instalar agora?`,
          confirmText: 'Atualizar',
          variant: 'primary'
        });
        if (!confirmado) {
          this.updateStatus('Atualização cancelada.');
          btn.disabled = false;
          btn.innerHTML = btnHtml;
          return;
        }
        this.updateStatus(`Nova versão v${serverVer} encontrada! Baixando...`);
        btn.disabled = false;
        btn.innerHTML = btnHtml;
        localStorage.setItem('fyntex_ver', serverVer);
        this.downloadUpdate();
        return;
      } else if (serverVer === this.verAtual) {
        this.updateStatus('App atualizado! Você está na versão mais recente.');
      } else {
        this.updateStatus('Não foi possível verificar a versão.', true);
      }
    } catch {
      this.updateStatus('Sem conexão com a internet.', true);
    }

    btn.disabled = false;
    btn.innerHTML = btnHtml;
  }
};
