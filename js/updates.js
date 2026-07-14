const Updates = {
  verAtual: '1.10.0',

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

  _delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  async downloadUpdate() {
    const overlay = document.getElementById('updateOverlay');
    const bar = document.getElementById('updateProgressBar');
    const percentEl = document.getElementById('updateProgressPercent');
    const bytesEl = document.getElementById('updateProgressBytes');
    const statusEl = document.getElementById('updateStatusText');
    const stageEl = document.getElementById('updateStageText');

    overlay.classList.add('active');
    bytesEl.textContent = '';

    const newVer = localStorage.getItem('confeitex_ver') || this.verAtual;
    const startedAt = Date.now();

    const setProgress = (pct, status, detail) => {
      bar.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      statusEl.textContent = status;
      if (stageEl) stageEl.textContent = detail || '';
    };

    // Step 1: Preparação
    setProgress(5, 'Preparando atualização...', 'Limpando configurações da versão anterior');
    localStorage.removeItem('confeitex_notified');
    localStorage.removeItem('confeitex_update_prompt');
    localStorage.removeItem('confeitex_pwa_dismissed');
    await this._delay(400);

    // Step 2: Remove Service Worker antigo
    setProgress(30, 'Removendo Service Worker antigo...', 'Garantindo que não haja conflitos');
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) await reg.unregister();
      } catch {}
    }
    await this._delay(300);

    // Step 3: Registra novo Service Worker com a versão atualizada
    setProgress(45, 'Registrando novo Service Worker...', 'Preparando ambiente da nova versão');
    const swUrl = './sw.js?v=' + newVer;
    let newReg;
    try {
      newReg = await navigator.serviceWorker.register(swUrl);
    } catch (e) {
      setProgress(0, 'Erro ao registrar Service Worker.', 'Verifique sua conexão e tente novamente');
      await this._delay(1500);
      overlay.classList.remove('active');
      UI.alert('Erro ao atualizar: não foi possível registrar o Service Worker.\n\nTente novamente mais tarde.');
      return;
    }

    // Step 4: Aguarda instalação (download dos novos arquivos)
    setProgress(60, 'Baixando novos arquivos...', 'Isso pode levar alguns segundos dependendo da sua conexão');
    try {
      await new Promise((resolve, reject) => {
        if (newReg.installing) {
          newReg.installing.addEventListener('statechange', () => {
            if (newReg.installing.state === 'installed' || newReg.installing.state === 'activated') {
              resolve();
            } else if (newReg.installing.state === 'redundant') {
              reject(new Error('SW became redundant'));
            }
          });
        } else {
          resolve();
        }
      });
    } catch (e) {
      setProgress(0, 'Erro durante o download.', 'Tente novamente mais tarde');
      await this._delay(1500);
      overlay.classList.remove('active');
      UI.alert('Erro ao baixar a atualização. Verifique sua conexão e tente novamente.');
      return;
    }
    await this._delay(300);

    // Step 5: Aguarda ativação
    setProgress(80, 'Ativando nova versão...', 'Aplicando as alterações nos arquivos');
    if (newReg.active) {
      await new Promise(resolve => {
        const sw = newReg.active;
        if (sw.state === 'activated') {
          resolve();
        } else {
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated') resolve();
          });
        }
      });
    }
    await this._delay(300);

    // Step 6: Concluído
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    setProgress(100, 'Atualização concluída com sucesso!', `Versão v${newVer} instalada em ${elapsed}s`);
    bytesEl.textContent = '✅ Pronto!';

    localStorage.setItem('confeitex_updated', 'true');

    // Mostra modal de conclusão após breve pausa
    await this._delay(1200);
    overlay.classList.remove('active');
    overlay.style.display = 'none';

    await UI.confirm({
      title: '✅ Atualização concluída!',
      message: `Versão v${newVer} instalada com sucesso (${elapsed}s).\n\nPara que as alterações entrem em vigor, feche completamente o aplicativo (feche a aba do navegador) e abra novamente.\n\n📌 Os dados dos seus pedidos e clientes estão preservados.`,
      confirmText: 'Fechar e Abrir Depois',
      cancelText: '',
      variant: 'primary'
    });
  },

  changelog: [
    { ver: '1.10.0', date: '14/07/2026', items: ['NOVO: Sistema de atualização redesenhado — agora baixa, instala e ativa a nova versão via Service Worker', 'NOVO: Tela de progresso com estágios detalhados e tempo estimado de instalação', 'NOVO: Após atualizar, exibe instruções claras para fechar e reabrir o app', 'Correção: Faturamento Total no Dashboard agora funciona corretamente com pedidos antigos', 'Correção: Ícone do bolo centralizado no cabeçalho e tela de login', 'Melhoria: Clientes — clique no nome expande detalhes com botões Editar e Ver Histórico', 'Melhoria: Pedidos — detalhes expandidos em grid de 3 colunas com mais informações', 'Melhoria: Botões de ação (Editar, Avançar Status, Reabrir) agora aparecem apenas quando relevantes', 'Melhoria: Cache do navegador e Service Worker antigo são limpos automaticamente na atualização'] },
    { ver: '19', date: '13/07/2026', items: ['Correção: dados demo não são mais removidos automaticamente ao recarregar o app', 'Correção: "Apagar Todos os Dados" agora também limpa catálogo, notificações e estado de lembretes', 'Correção: pedidos com status "Entregue" sem deliveredAt agora recebem data automaticamente', 'Correção: validação de campos obrigatórios no formulário de pedidos (nome, sabor, data, horário)', 'Otimização: gráfico redimensiona automaticamente ao mudar orientação do celular', 'Otimização: exportação CSV ordenada por data de entrega (decrescente)', 'Otimização: Service Worker registrado com parâmetro de versão para evitar cache conflitante'] },
    { ver: '18', date: '13/07/2026', items: ['Importação de dados via PDF (relatório exportado do Confeitex)', 'Notificações: agora podem ser ativadas/desativadas com status visual', 'Editar cliente diretamente do banco de clientes', 'Card "Pendentes/Produção" no Dashboard agora leva aos pedidos filtrados', 'Ícone do bolo centralizado no cabeçalho e tela de login'] },
    { ver: '17', date: '13/07/2026', items: ['Rebranding: app renomeado para Confeitex', 'Novo logotipo e ícones modernos do app', 'Todas as referências atualizadas para Confeitex', 'Migração automática de dados antigos (fyntex_) para o novo padrão (confeitex_)'] },
    { ver: '16', date: '13/07/2026', items: ['Notificações modernas: toast com ícone e glass-morphism, modal com gradiente e animação', 'Verificação automática de nova versão ao abrir o app (máx 1x/hora)', 'Sistema de atualização refatorado: limpa caches, desregistra SW antigo e recarrega do zero', 'Confirmação visual "App atualizado" após reload', 'Gradiente vermelho/rosa do canto inferior direito e do login removido', 'Filtro de pedidos não começa mais com data de hoje — mostra todos', 'SVG dos botões preservado após loading/erro no login e atualizações', 'deliveredAt limpo ao mudar status de "Entregue" para outro'] },
    { ver: '15', date: '13/07/2026', items: ['Sistema de atualização refatorado: limpa caches, desregistra SW antigo e recarrega do zero', 'Confirmação visual "App atualizado" após reload', 'Gradiente vermelho/rosa do canto inferior direito e do login removido', 'Filtro de pedidos não começa mais com data de hoje — mostra todos'] },
    { ver: '14', date: '13/07/2026', items: ['Design: sombras e outlines removidos ao clicar', 'Tabelas ajustadas para tela sem scroll horizontal', 'Atualização usa ciclo do SW sem tela preta', 'Cache do SW dinâmico por versão'] },
    { ver: '13', date: '13/07/2026', items: ['version.txt sem cache — sempre vai à rede', 'Auto-reload quando novo SW assumir', 'Confirmação obrigatória antes de atualizar'] },
    { ver: '12', date: '13/07/2026', items: ['Força atualização do SW com novo cache'] },
    { ver: '11', date: '12/07/2026', items: ['App fecha após atualizar', 'Suporte PWA standalone mobile'] },
    { ver: '9', date: '12/07/2026', items: ['Novo layout das Configurações', 'Verificação automática de atualização'] },
    { ver: '8', date: '12/07/2026', items: ['Auditoria geral e correções', 'Dados demonstrativos'] },
    { ver: '7', date: '12/07/2026', items: ['Bloqueio por senha com SHA-256'] },
    { ver: '6', date: '12/07/2026', items: ['Barra de progresso com KB/MB'] },
    { ver: '5', date: '12/07/2026', items: ['Correções e melhorias'] },
    { ver: '4', date: '12/07/2026', items: ['Correções e melhorias'] },
    { ver: '3', date: '12/07/2026', items: ['Aba Atualizações, Backup PDF, Notificação de nova versão, Service Worker'] },
    { ver: '2', date: '11/07/2026', items: ['Otimizações mobile'] },
    { ver: '1', date: '10/07/2026', items: ['Versão inicial do Confeitex'] }
  ],

  render() {
    document.getElementById('updatesCurrentVer').textContent = `v${this.verAtual}`;
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

    try {
      const r = await fetch('./version.txt?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) throw new Error('Sem conexão');
      const serverVer = (await r.text()).trim();
      localStorage.setItem('confeitex_last_check', new Date().toLocaleString('pt-BR'));
      document.getElementById('updatesLastCheck').textContent = localStorage.getItem('confeitex_last_check');

      if (serverVer && serverVer !== this.verAtual) {
        const confirmado = await UI.confirm({
          title: 'Nova versão disponível',
          message: `Atualização v${serverVer} encontrada!\n\nClique em "Atualizar" para baixar e instalar a nova versão. Após a instalação, feche e abra o app novamente.`,
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
