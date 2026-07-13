const Updates = {
  verAtual: '8',

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
    document.getElementById('btnForceUpdate').addEventListener('click', () => {
      UI.confirm({
        title: 'Recarregar App',
        message: 'Isso vai recarregar o aplicativo para buscar a versão mais recente. Continuar?',
        confirmText: 'Recarregar',
        cancelText: 'Cancelar',
        variant: 'primary'
      }).then(res => { if (res) this.downloadUpdate(); });
    });
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

    let totalBytes = 0;
    const sizes = {};

    statusEl.textContent = 'Verificando tamanho dos arquivos...';

    for (const url of this.assets) {
      try {
        const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
        const size = parseInt(r.headers.get('content-length') || '0', 10);
        sizes[url] = size;
        totalBytes += size;
      } catch {
        sizes[url] = 0;
      }
    }

    statusEl.textContent = 'Baixando atualização...';
    let loadedBytes = 0;

    for (const url of this.assets) {
      try {
        const r = await fetch(url);
        const total = parseInt(r.headers.get('content-length') || '0', 10);
        const reader = r.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loadedBytes += value.length;

          const pct = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
          bar.style.width = `${pct}%`;
          percentEl.textContent = `${pct}%`;
          bytesEl.textContent = `${this.formatBytes(loadedBytes)} / ${this.formatBytes(totalBytes)}`;
        }
      } catch {
        // skip failed assets
      }
    }

    statusEl.textContent = 'Aplicando atualização...';
    bar.style.width = '100%';
    percentEl.textContent = '100%';
    bytesEl.textContent = `${this.formatBytes(totalBytes)} / ${this.formatBytes(totalBytes)}`;

    await new Promise(r => setTimeout(r, 600));
    window.location.reload();
  },

  changelog: [
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
    btn.disabled = true;
    btn.textContent = 'Verificando...';
    this.updateStatus('Verificando...');

    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('Sem conexão');
      const serverVer = (await r.text()).trim();
      localStorage.setItem('fyntex_last_check', new Date().toLocaleString('pt-BR'));
      document.getElementById('updatesLastCheck').textContent = localStorage.getItem('fyntex_last_check');

      if (serverVer && serverVer !== this.verAtual) {
        const atualizar = await UI.confirm({
          title: 'Nova versão disponível!',
          message: `Versão v${serverVer} disponível (você está na v${this.verAtual}). Deseja recarregar o aplicativo para atualizar?`,
          confirmText: 'Atualizar Agora',
          cancelText: 'Depois',
          variant: 'primary'
        });
        if (atualizar) {
          localStorage.setItem('fyntex_ver', serverVer);
          this.downloadUpdate();
        } else {
          this.updateStatus('Nova versão disponível. Recarregue quando quiser.');
        }
      } else if (serverVer === this.verAtual) {
        this.updateStatus('App atualizado! Você já está na versão mais recente.');
      } else {
        this.updateStatus('Não foi possível verificar a versão.', true);
      }
    } catch {
      this.updateStatus('Sem conexão com a internet. Verifique mais tarde.', true);
    }

    btn.disabled = false;
    btn.textContent = 'Verificar Agora';
  }
};
