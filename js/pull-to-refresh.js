/**
 * Confeitex — pull-to-refresh.js
 * Gesto de puxar para recarregar (nativo mobile).
 * Ao puxar a tela para baixo a partir do topo, exibe um spinner e recarrega a página.
 */

export const PullToRefresh = {
  _startY: 0,
  _currentY: 0,
  _isDragging: false,
  _indicator: null,
  _THRESHOLD: 80,   // px necessários para acionar o refresh
  _MAX_PULL: 120,   // px máximos de arrasto visual

  init() {
    // Só ativa em mobile/touch
    if (!('ontouchstart' in window)) return;

    this._createIndicator();
    this._bindEvents();
  },

  _createIndicator() {
    const el = document.createElement('div');
    el.id = 'pullRefreshIndicator';
    el.innerHTML = `
      <div class="ptr-inner">
        <svg class="ptr-spinner" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
          <circle cx="25" cy="25" r="20" fill="none" stroke-width="4"
                  stroke="url(#ptrGrad)" stroke-linecap="round"/>
          <defs>
            <linearGradient id="ptrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stop-color="#ec4899"/>
              <stop offset="100%" stop-color="#a855f7"/>
            </linearGradient>
          </defs>
        </svg>
        <span class="ptr-label">Solte para atualizar</span>
      </div>`;
    el.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0;
      display: flex;
      justify-content: center;
      align-items: flex-end;
      pointer-events: none;
      z-index: 9999;
      height: 0;
      overflow: visible;
      transition: none;
    `;
    document.body.appendChild(el);
    this._indicator = el;

    // Injetar CSS inline para o indicador
    const style = document.createElement('style');
    style.textContent = `
      #pullRefreshIndicator .ptr-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 20px;
        background: rgba(17, 14, 32, 0.92);
        border: 1px solid rgba(236, 72, 153, 0.3);
        border-radius: 0 0 20px 20px;
        backdrop-filter: blur(12px);
        transform: translateY(-100%);
        transition: transform 0.15s ease;
        will-change: transform;
      }

      #pullRefreshIndicator.ptr-visible .ptr-inner {
        transform: translateY(0);
      }

      .ptr-spinner {
        width: 32px;
        height: 32px;
        stroke-dasharray: 80;
        stroke-dashoffset: 80;
        transition: stroke-dashoffset 0.1s linear;
      }

      #pullRefreshIndicator.ptr-spinning .ptr-spinner {
        stroke-dashoffset: 0;
        animation: ptrSpin 0.8s linear infinite;
      }

      @keyframes ptrSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      .ptr-label {
        font-size: 0.7rem;
        font-weight: 600;
        color: rgba(236, 72, 153, 0.9);
        letter-spacing: 0.03em;
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  },

  _bindEvents() {
    const scrollEl = document.documentElement;

    document.addEventListener('touchstart', (e) => {
      // Só inicia se estiver no topo da página
      if (scrollEl.scrollTop > 10) return;
      this._startY = e.touches[0].clientY;
      this._isDragging = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      const y = e.touches[0].clientY;
      const deltaY = y - this._startY;

      // Só ativa se estiver puxando para baixo a partir do topo
      if (scrollEl.scrollTop > 5 || deltaY <= 0) return;

      this._isDragging = true;
      this._currentY = Math.min(deltaY, this._MAX_PULL);

      const progress = Math.min(this._currentY / this._THRESHOLD, 1);
      const spinner  = this._indicator?.querySelector('.ptr-spinner');
      const label    = this._indicator?.querySelector('.ptr-label');

      this._indicator?.classList.add('ptr-visible');

      // Progresso visual do spinner
      if (spinner) {
        const dashOffset = 80 - (80 * progress);
        spinner.style.strokeDashoffset = dashOffset;
      }

      // Muda o texto quando atingir o limiar
      if (label) {
        label.textContent = progress >= 1 ? 'Solte para atualizar' : 'Puxe para atualizar';
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!this._isDragging) return;
      this._isDragging = false;

      if (this._currentY >= this._THRESHOLD) {
        this._triggerRefresh();
      } else {
        this._hide();
      }

      this._currentY = 0;
    });
  },

  _triggerRefresh() {
    const spinner = this._indicator?.querySelector('.ptr-spinner');
    const label   = this._indicator?.querySelector('.ptr-label');

    this._indicator?.classList.add('ptr-spinning');
    if (spinner) spinner.style.strokeDashoffset = '';
    if (label)   label.textContent = 'Atualizando…';

    // Aguarda o SW buscar atualizações antes de recarregar
    setTimeout(() => {
      // Pede ao Service Worker para verificar nova versão
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      // Força o reload ignorando o cache do SW
      window.location.reload(true);
    }, 800);
  },

  _hide() {
    this._indicator?.classList.remove('ptr-visible', 'ptr-spinning');
    const spinner = this._indicator?.querySelector('.ptr-spinner');
    if (spinner) spinner.style.strokeDashoffset = '80';
  },
};
