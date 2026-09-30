/**
 * Confeitex — pull-to-refresh.js
 * Pull-to-refresh discreto: só um círculo spinner aparece abaixo do header,
 * sem textos, sem painéis, sem efeito de tela piscando.
 */

export const PullToRefresh = {
  _startY:    0,
  _pulling:   false,
  _triggered: false,
  _spinner:   null,
  _icon:      null,
  _THRESHOLD: 70,  // px para acionar o refresh

  init() {
    if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;
    this._createSpinner();
    this._bindEvents();
  },

  _createSpinner() {
    // Injeta estilo do indicador de reload
    const style = document.createElement('style');
    style.textContent = `
      #ptrSpinner {
        position: fixed;
        top: calc(56px + env(safe-area-inset-top, 0px));
        left: 50%;
        transform: translateX(-50%) translateY(0) scale(0);
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(18, 14, 34, 0.94);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1.5px solid rgba(236, 72, 153, 0.35);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45), 0 0 12px rgba(236, 72, 153, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      #ptrSpinner.ptr-dragging {
        transition: none;
      }

      #ptrSpinner.ptr-show {
        opacity: 1;
      }

      #ptrSpinner .ptr-icon {
        width: 20px;
        height: 20px;
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
    `;
    document.head.appendChild(style);

    // Cria o badge container com ícone de reload vetorial
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

  _bindEvents() {
    const root = document.documentElement;

    document.addEventListener('touchstart', (e) => {
      if (root.scrollTop > 8) return;
      this._startY    = e.touches[0].clientY;
      this._pulling   = false;
      this._triggered = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (this._triggered) return;
      const delta = e.touches[0].clientY - this._startY;
      if (root.scrollTop > 4 || delta <= 0) return;

      this._pulling = true;
      const progress = Math.min(Math.max(delta / this._THRESHOLD, 0), 1);
      const moveY = Math.min(delta * 0.4, 26);
      const scale = 0.4 + 0.6 * progress;

      // Mostra o badge e acompanha o gesto
      this._spinner.classList.add('ptr-show', 'ptr-dragging');
      this._spinner.style.transform = `translateX(-50%) translateY(${moveY}px) scale(${scale})`;
      this._spinner.style.opacity = String(Math.min(progress * 1.5, 1));

      // Gira o ícone de reload suavemente conforme o usuário puxa
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
        // Puxou mas não o suficiente — recolhe suavemente
        this._spinner.classList.remove('ptr-dragging', 'ptr-show');
        this._spinner.style.transform = 'translateX(-50%) translateY(0) scale(0.3)';
        this._spinner.style.opacity = '0';
        if (this._icon) this._icon.style.transform = 'rotate(0deg)';
      }
      this._pulling = false;
    });
  },

  _doRefresh() {
    // Fixo na posição ativa com rotação limpa em torno do próprio centro
    this._spinner.classList.remove('ptr-dragging');
    this._spinner.classList.add('ptr-show', 'ptr-spinning');
    this._spinner.style.transform = 'translateX(-50%) translateY(22px) scale(1)';
    this._spinner.style.opacity = '1';
    if (this._icon) this._icon.style.transform = '';

    try {
      if ('vibrate' in navigator) navigator.vibrate(15);
    } catch (_) {}

    setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload(true);
    }, 850);
  },
};
