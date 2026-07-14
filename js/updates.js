const Updates = {
  verAtual: '1.12.0',

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
    return (serverVer && serverVer !== this.verAtual) ? serverVer : null;
  },

  async _fail(overlay, msg) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
    await this._delay(400);
    UI.alert(msg || 'Erro ao atualizar. Tente novamente.');
  },

  async downloadUpdate() {
    const overlay = document.getElementById('updateOverlay');
    const bar = document.getElementById('updateProgressBar');
    const percentEl = document.getElementById('updateProgressPercent');
    const statusEl = document.getElementById('updateStatusText');
    const stageEl = document.getElementById('updateStageText');
    const bytesEl = document.getElementById('updateProgressBytes');
    const actionsEl = document.getElementById('updateActions');
    const btnReload = document.getElementById('btnReloadNow');
    const btnClose = document.getElementById('btnCloseApp');

    overlay.classList.add('active');
    actionsEl.style.display = 'none';
    bytesEl.textContent = '';

    const newVer = localStorage.getItem('confeitex_ver') || this.verAtual;
    const startedAt = Date.now();

    const setProgress = (pct, status, detail) => {
      bar.style.width = pct + '%';
      percentEl.textContent = pct + '%';
      statusEl.textContent = status;
      if (stageEl) stageEl.textContent = detail || '';
    };

    const timeStr = () => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      return s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;
    };

    let timerInterval = setInterval(() => { bytesEl.textContent = '⏱ ' + timeStr(); }, 500);
    const stopTimer = () => { clearInterval(timerInterval); timerInterval = null; };

    // --- Step 1: Preparação ---
    setProgress(5, 'Preparando...', '');
    localStorage.removeItem('confeitex_notified');
    localStorage.removeItem('confeitex_update_prompt');
    localStorage.removeItem('confeitex_pwa_dismissed');

    // --- Step 2: Remove Service Worker antigo ---
    setProgress(20, 'Removendo versão anterior...', '');
    let swOk = 'serviceWorker' in navigator;
    if (swOk) {
      try { const r = await navigator.serviceWorker.getRegistration(); if (r) await r.unregister(); } catch {}
    }

    // --- Step 3: Registra novo SW ---
    setProgress(40, 'Registrando nova versão...', '');

    if (!swOk) {
      stopTimer();
      localStorage.setItem('confeitex_updated', 'true');
      setProgress(100, 'Concluído!', '');
      await this._delay(400);
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      UI.toast(`Versão v${newVer} registrada. Feche e abra o app novamente.`);
      return;
    }

    let reg;
    try { reg = await navigator.serviceWorker.register('./sw.js?v=' + newVer); }
    catch { stopTimer(); return this._fail(overlay, 'Erro de conexão. Verifique sua internet e tente novamente.'); }

    // --- Step 4: Aguarda instalação/ativação (máx 25s) ---
    setProgress(60, 'Baixando novos arquivos...', 'Isso leva alguns segundos...');

    const ativado = await Promise.race([
      new Promise(resolve => {
        if (reg.installing) {
          reg.installing.addEventListener('statechange', () => {
            const st = reg.installing.state;
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

    stopTimer();

    if (!ativado) {
      localStorage.setItem('confeitex_updated', 'true');
      setProgress(100, 'Concluído (2º plano)', 'Será aplicado ao reabrir');
      bytesEl.textContent = '⏱ ' + timeStr();
      await this._delay(600);
      overlay.classList.remove('active');
      overlay.style.display = 'none';
      UI.toast(`📦 v${newVer} em segundo plano — será aplicado na próxima abertura.`);
      return;
    }

    // --- Concluído com sucesso ---
    setProgress(100, '✅ Atualização concluída!', `Versão v${newVer} instalada`);
    bytesEl.textContent = '⏱ ' + timeStr();

    localStorage.setItem('confeitex_updated', 'true');
    localStorage.setItem('confeitex_ver', newVer);

    // Esconde progresso, mostra botões
    document.querySelector('.update-progress-track')?.style?.display = 'none';
    document.querySelector('.update-progress-info')?.style?.display = 'none';
    document.getElementById('updateStageText').style.display = 'none';
    statusEl.textContent = '✅ Atualização concluída!';
    stageEl.textContent = '';

    actionsEl.style.display = 'flex';

    return new Promise(resolve => {
      const cleanup = () => {
        btnReload.removeEventListener('click', onReload);
        btnClose.removeEventListener('click', onClose);
        resolve();
      };

      const onReload = () => {
        cleanup();
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        window.location.href = window.location.href.split('?')[0].split('#')[0] + '?v=' + Date.now();
      };

      const onClose = () => {
        cleanup();
        overlay.classList.remove('active');
        overlay.style.display = 'none';
        // Tenta fechar a janela (funciona em PWA standalone)
        try { window.open('', '_self'); window.close(); } catch {}
        // Fallback: redireciona para página vazia (fecha o app visualmente)
        setTimeout(() => { window.location.replace('about:blank'); }, 500);
      };

      btnReload.addEventListener('click', onReload);
      btnClose.addEventListener('click', onClose);
    });
  },

  changelog: [
    { ver: '1.12.0', date: '14/07/2026', items: ['Correção: Faturamento Total agora calcula totalValue para pedidos antigos (weight * unitPrice)', 'Correção: Versão atual exibida imediatamente nas Atualizações após o update (via localStorage)', 'Correção: Div `.config-card` de Notificações sem fechamento — Security settings aninhado erroneamente', 'Correção: deliveredAt agora é salvo ao criar/editar pedido com status "Entregue"', 'Correção: Gráfico não renderizava no período "Hoje" (divisão por zero no eixo X)', 'Correção: Login não trava mais se crypto.subtle falhar (try-catch + finally no botão)', 'Correção: Flag confeitex_updated removida só após confirmação do usuário', 'Correção: Acesso seguro aos elementos do overlay de update (optional chaining)', 'Otimização: Botões com min-height:44px para toque preciso em celulares', 'Otimização: Inputs com font-size:16px evitam zoom automático no iOS', 'Otimização: touch-action:manipulation elimina delay de 300ms em toques', 'Otimização: overscroll-behavior:contain e -webkit-overflow-scrolling:touch para scroll suave'] },
    { ver: '1.11.0', date: '14/07/2026', items: ['NOVO: Botão "Recarregar Agora" e "Fechar App" no final da atualização — sem precisar fechar manualmente', 'NOVO: Transição suave na barra de progresso (cubic-bezier) para feedback visual mais agradável', 'Melhoria: Atualização mais rápida — delays artificiais de 300ms/400ms removidos', 'Melhoria: Timeout reduzido de 30s para 25s — não trava mais que o necessário', 'Melhoria: Mensagem clara se window.close() não funcionar (navegador não permite)', 'Refatoração: check() e checkSilent() agora compartilham _fetchVersion() — menos duplicação', 'Refatoração: Código de downloadUpdate() simplificado e mais legível'] },
    { ver: '1.10.2', date: '14/07/2026', items: ['Correção: Atualização não trava mais em "Baixando arquivos" — adicionado timeout de 30s e fallback', 'NOVO: Timer com tempo decorrido em tempo real durante a instalação', 'Otimização: Service Worker agora usa Promise.allSettled — se um arquivo falhar, os outros continuam', 'Otimização: Google Fonts removido (nunca era usado — app já usa fontes do sistema)', 'Otimização: ResizeObserver do gráfico criado apenas uma vez, não a cada render'] },
    { ver: '1.10.1', date: '14/07/2026', items: ['Correção: Configurações de Segurança (bloqueio por senha) estavam ocultas — agora aparecem novamente', 'Correção: Ícones PWA (atalho da tela inicial e favicon) regenerados com o bolo centralizado', 'Correção: Adicionado favicon SVG inline para garantir ícone correto na aba do navegador', 'Melhoria: Ícones PWA agora usam gradiente rosa/roxo com bolo branco — visual moderno e consistente'] },
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
        message: `Atualização v${serverVer} encontrada!\n\nClique em "Atualizar" para baixar e instalar. Após a conclusão, você poderá recarregar ou fechar o app.`,
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
      this.updateStatus('Sem conexão com a internet.', true);
    }

    btn.disabled = false;
    btn.innerHTML = btnHtml;
  }
};
