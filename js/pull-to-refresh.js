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
  _THRESHOLD: 70,  // px para acionar o refresh

  init() {
    if (!('ontouchstart' in window)) return;
    this._createSpinner();
    this._bindEvents();
  },

  _createSpinner() {
    // Injeta estilo
    const style = document.createElement('style');
    style.textContent = `
      #ptrSpinner {
        position: fixed;
        /* logo abaixo do cabeçalho mobile (~56px de altura) */
        top: 60px;
        left: 50%;
        transform: translateX(-50%) scale(0);
        width: 28px;
        height: 28px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }

      #ptrSpinner.ptr-show {
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }

      #ptrSpinner circle {
        stroke-dasharray: 60;
        stroke-dashoffset: 60;
        transition: stroke-dashoffset 0.08s linear;
      }

      #ptrSpinner.ptr-spinning circle {
        stroke-dashoffset: 0;
        animation: ptrRotate 0.75s linear infinite;
      }

      @keyframes ptrRotate {
        to { transform: rotate(360deg); transform-origin: 14px 14px; }
      }
    `;
    document.head.appendChild(style);

    // Cria o elemento SVG (só o círculo)
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.id = 'ptrSpinner';
    el.setAttribute('viewBox', '0 0 28 28');
    el.innerHTML = `
      <defs>
        <linearGradient id="ptrG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#ec4899"/>
          <stop offset="100%" stop-color="#a855f7"/>
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="11"
        fill="none" stroke="url(#ptrG)"
        stroke-width="2.5" stroke-linecap="round"/>
    `;
    document.body.appendChild(el);
    this._spinner = el;
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
      const progress = Math.min(delta / this._THRESHOLD, 1);

      // Mostra o spinner e preenche o traço proporcionalmente ao arrasto
      this._spinner.classList.add('ptr-show');
      const circle = this._spinner.querySelector('circle');
      if (circle) circle.style.strokeDashoffset = 60 - 60 * progress;

      if (delta >= this._THRESHOLD) {
        this._triggered = true;
        this._doRefresh();
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (this._pulling && !this._triggered) {
        // Puxou mas não o suficiente — esconde suavemente
        this._spinner.classList.remove('ptr-show');
        const circle = this._spinner.querySelector('circle');
        if (circle) circle.style.strokeDashoffset = '60';
      }
      this._pulling = false;
    });
  },

  _doRefresh() {
    // Spinner gira livremente até o reload
    this._spinner.classList.add('ptr-show', 'ptr-spinning');

    setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload(true);
    }, 900);
  },
};
