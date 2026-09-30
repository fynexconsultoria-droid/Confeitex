/**
 * Confeitex — pull-to-refresh.js
 * Indicador de reload elegante no topo:
 * - Badge flutuante centralizado com ícone de reload vetorial (gradiente da marca)
 * - Eixo 100% fixo com rotação limpa (sem oscilação ou desvio excêntrico)
 * - Suporta inicialização visual no topo, gesto de puxar (touch e mouse) e botões de reload no cabeçalho
 */

export const PullToRefresh = {
  _startY:    0,
  _pulling:   false,
  _triggered: false,
  _spinner:   null,
  _icon:      null,
  _THRESHOLD: 70,

  init(options = {}) {
    this._createSpinner();
    this._bindEvents();
    this._bindHeaderButtons();

    // Feedback visual suave no carregamento inicial da página
    if (options.showOnStart !== false) {
      this.showInitial();
    }
  },

  _createSpinner() {
    if (document.getElementById('ptrSpinner')) {
      this._spinner = document.getElementById('ptrSpinner');
      this._icon    = this._spinner.querySelector('.ptr-icon');
      return;
    }

    const style = document.createElement('style');
    style.id = 'ptrStyles';
    style.textContent = `
      #ptrSpinner {
        position: fixed;
        top: calc(58px + env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%) translateY(-24px) scale(0);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(18, 14, 34, 0.95);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        border: 1.5px solid rgba(236, 72, 153, 0.38);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5), 0 0 14px rgba(236, 72, 153, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      #ptrSpinner.ptr-dragging {
        transition: none;
      }

      #ptrSpinner.ptr-show {
        opacity: 1;
        transform: translateX(-50%) translateY(16px) scale(1);
      }

      #ptrSpinner .ptr-icon {
        width: 22px;
        height: 22px;
        display: block;
        transform-origin: center center;
        will-change: transform;
      }

      #ptrSpinner.ptr-spinning .ptr-icon {
        animation: ptrSpin 0.75s linear infinite !important;
      }

      @keyframes ptrSpin {
        0% {
          transform: rotate(0deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }

      .btn-reload-spinning svg {
        animation: ptrSpin 0.75s linear infinite !important;
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.id = 'ptrSpinner';
    el.innerHTML = `
      <svg class="ptr-icon" viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <defs>
          <linearGradient id="ptrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ec4899"/>
            <stop offset="100%" stop-color="#a855f7"/>
          </linearGradient>
        </defs>
        <path stroke="url(#ptrGrad)" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
        <polyline stroke="url(#ptrGrad)" points="21 3 21 8 16 8"/>
      </svg>
    `;
    document.body.appendChild(el);
    this._spinner = el;
    this._icon    = el.querySelector('.ptr-icon');
  },

  showInitial() {
    if (!this._spinner) return;
    this._spinner.classList.remove('ptr-dragging');
    this._spinner.classList.add('ptr-show', 'ptr-spinning');
    this._spinner.style.transform = 'translateX(-50%) translateY(16px) scale(1)';
    this._spinner.style.opacity = '1';

    setTimeout(() => {
      this._spinner.classList.remove('ptr-spinning', 'ptr-show');
      this._spinner.style.transform = 'translateX(-50%) translateY(-24px) scale(0)';
      this._spinner.style.opacity = '0';
      if (this._icon) this._icon.style.transform = 'rotate(0deg)';
    }, 700);
  },

  trigger() {
    if (this._triggered) return;
    this._triggered = true;
    this._doRefresh();
  },

  _bindHeaderButtons() {
    const attach = (id) => {
      const btn = document.getElementById(id);
      if (btn && !btn.dataset.hasPtr) {
        btn.dataset.hasPtr = '1';
        btn.addEventListener('click', () => {
          btn.classList.add('btn-reload-spinning');
          this.trigger();
          setTimeout(() => btn.classList.remove('btn-reload-spinning'), 850);
        });
      }
    };
    attach('btnHeaderReload');
    attach('btnMobileReload');
  },

  _bindEvents() {
    const getScrollY = () => window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // --- Touch (Mobile) ---
    document.addEventListener('touchstart', (e) => {
      if (getScrollY() > 5) return;
      this._startY    = e.touches[0].clientY;
      this._pulling   = false;
      this._triggered = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (this._triggered) return;
      const delta = e.touches[0].clientY - this._startY;
      if (getScrollY() > 4 || delta <= 0) return;

      this._pulling = true;
      const progress = Math.min(Math.max(delta / this._THRESHOLD, 0), 1);
      const moveY = Math.min(delta * 0.4, 26);
      const scale = 0.4 + 0.6 * progress;

      this._spinner.classList.add('ptr-show', 'ptr-dragging');
      this._spinner.style.transform = `translateX(-50%) translateY(${moveY}px) scale(${scale})`;
      this._spinner.style.opacity = String(Math.min(progress * 1.5, 1));

      if (this._icon) {
        this._icon.style.transform = `rotate(${progress * 280}deg)`;
      }

      if (delta >= this._THRESHOLD) {
        this._triggered = true;
        this._doRefresh();
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (this._pulling && !this._triggered) {
        this._spinner.classList.remove('ptr-dragging', 'ptr-show');
        this._spinner.style.transform = 'translateX(-50%) translateY(-24px) scale(0)';
        this._spinner.style.opacity = '0';
        if (this._icon) this._icon.style.transform = 'rotate(0deg)';
      }
      this._pulling = false;
    });

    // --- Mouse Drag (Desktop) ---
    let isMouseDown = false;
    document.addEventListener('mousedown', (e) => {
      if (getScrollY() > 5 || e.clientY > 120) return;
      if (e.target.closest('button, input, select, a, [role="button"]')) return;
      isMouseDown = true;
      this._startY = e.clientY;
      this._pulling = false;
      this._triggered = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isMouseDown || this._triggered) return;
      const delta = e.clientY - this._startY;
      if (delta <= 0) return;

      this._pulling = true;
      const progress = Math.min(Math.max(delta / this._THRESHOLD, 0), 1);
      const moveY = Math.min(delta * 0.4, 26);
      const scale = 0.4 + 0.6 * progress;

      this._spinner.classList.add('ptr-show', 'ptr-dragging');
      this._spinner.style.transform = `translateX(-50%) translateY(${moveY}px) scale(${scale})`;
      this._spinner.style.opacity = String(Math.min(progress * 1.5, 1));

      if (this._icon) {
        this._icon.style.transform = `rotate(${progress * 280}deg)`;
      }

      if (delta >= this._THRESHOLD) {
        this._triggered = true;
        isMouseDown = false;
        this._doRefresh();
      }
    });

    document.addEventListener('mouseup', () => {
      if (isMouseDown && this._pulling && !this._triggered) {
        this._spinner.classList.remove('ptr-dragging', 'ptr-show');
        this._spinner.style.transform = 'translateX(-50%) translateY(-24px) scale(0)';
        this._spinner.style.opacity = '0';
        if (this._icon) this._icon.style.transform = 'rotate(0deg)';
      }
      isMouseDown = false;
      this._pulling = false;
    });
  },

  async _doRefresh() {
    this._spinner.classList.remove('ptr-dragging');
    this._spinner.classList.add('ptr-show', 'ptr-spinning');
    this._spinner.style.transform = 'translateX(-50%) translateY(16px) scale(1)';
    this._spinner.style.opacity = '1';
    if (this._icon) this._icon.style.transform = '';

    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch (_) {}

    let shouldHardReload = false;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            shouldHardReload = true;
          } else {
            reg.update().catch(() => {});
          }
        }
      }

      if (typeof window.State !== 'undefined' && window.State.load) {
        await window.State.load();
      }

      const activeTab = document.querySelector('.tab-content.active')?.id || 'dashboard';
      if (typeof window.switchTab === 'function') {
        window.switchTab(activeTab, false);
      }
    } catch (err) {
      console.warn('[PullToRefresh] Erro ao sincronizar:', err);
    }

    setTimeout(() => {
      if (shouldHardReload) {
        window.location.reload();
        return;
      }

      this._spinner.classList.remove('ptr-spinning', 'ptr-show');
      this._spinner.style.transform = 'translateX(-50%) translateY(-24px) scale(0)';
      this._spinner.style.opacity = '0';
      this._triggered = false;
      if (this._icon) this._icon.style.transform = 'rotate(0deg)';
    }, 850);
  },
};
