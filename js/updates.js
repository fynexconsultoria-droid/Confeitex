const Updates = {
  verAtual: '3',

  setup() {
    document.getElementById('btnCheckUpdates').addEventListener('click', () => this.check());
    document.getElementById('btnForceUpdate').addEventListener('click', () => {
      UI.confirm({
        title: 'Recarregar App',
        message: 'Isso vai recarregar o aplicativo para buscar a versão mais recente. Continuar?',
        confirmText: 'Recarregar',
        cancelText: 'Cancelar',
        variant: 'primary'
      }).then(res => { if (res) window.location.reload(); });
    });
  },

  changelog: [
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
          window.location.reload();
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
