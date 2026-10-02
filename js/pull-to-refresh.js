/**
 * Confeitex — pull-to-refresh.js
 * Indicador de reload discreto no topo:
 * - Badge flutuante centralizado que aparece apenas quando o usuário puxa a tela (pull-to-refresh)
 * - Rotação fixa, perfeitamente alinhada em torno do próprio centro
 * - Suporta toque em dispositivos móveis e arrasto com mouse para testes no desktop
 */

export const PullToRefresh = {
  _startY:    0,
  _startX:    0,
  _pulling:   false,
  _triggered: false,
  _spinner:   null,
  _icon:      null,
  _THRESHOLD: 70,

  init() {
    this._createSpinner();
    this._bindEvents();
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
        top: 56px;
        left: 50%;
        transform: translateX(-50%) translateY(-50px) scale(0);
        width: 38px;
        height: 38px;
        border-radius: 50%;
        background: rgba(18, 14, 34, 0.96);
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
        transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275);
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

  _resetIndicator() {
    if (!this._spinner) return;
    this._spinner.classList.remove('ptr-dragging', 'ptr-show', 'ptr-spinning');
    this._spinner.style.transform = 'translateX(-50%) translateY(-50px) scale(0)';
    this._spinner.style.opacity = '0';
    if (this._icon) this._icon.style.transform = 'rotate(0deg)';
    this._pulling = false;
  },

  _bindEvents() {
    const getScrollY = () => window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;

    // --- Touch (Mobile) ---
    document.addEventListener('touchstart', (e) => {
      if (getScrollY() > 2 || e.touches[0].clientY > 150) return;
      if (e.target.closest('.right-sidebar-overlay, .sidebar-overlay, .modal-overlay, .ob-overlay')) return;
      this._startY    = e.touches[0].clientY;
      this._startX    = e.touches[0].clientX;
      this._pulling   = false;
      this._triggered = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (this._triggered) return;
      if (getScrollY() > 2) {
        if (this._pulling) this._resetIndicator();
        return;
      }

      const deltaY = e.touches[0].clientY - this._startY;
      const deltaX = Math.abs(e.touches[0].clientX - this._startX);

      // Movimento predominantemente horizontal não ativa o pull
      if (deltaX > deltaY) return;
      if (deltaY <= 0) {
        if (this._pulling) this._resetIndicator();
        return;
      }

      // Previne scroll nativo durante o gesto de puxar para baixo
      if (e.cancelable) e.preventDefault();

      this._pulling = true;
      const progress = Math.min(deltaY / this._THRESHOLD, 1);
      const moveY = Math.min(deltaY * 0.45, 34);
      const scale = Math.min(0.4 + 0.6 * progress, 1);

      this._spinner.classList.add('ptr-show', 'ptr-dragging');
      this._spinner.style.transform = `translateX(-50%) translateY(${moveY}px) scale(${scale})`;
      this._spinner.style.opacity = String(Math.min(progress * 1.5, 1));

      if (this._icon) {
        this._icon.style.transform = `rotate(${progress * 280}deg)`;
      }

      if (deltaY >= this._THRESHOLD) {
        this._triggered = true;
        this._doRefresh();
      }
    }, { passive: false });

    document.addEventListener('touchend', () => {
      if (this._pulling && !this._triggered) {
        this._resetIndicator();
      }
      this._pulling = false;
    });

    // --- Mouse Drag (Desktop) ---
    let isMouseDown = false;
    document.addEventListener('mousedown', (e) => {
      if (getScrollY() > 2 || e.clientY > 120) return;
      if (e.target.closest('button, input, select, a, [role="button"], .right-sidebar-overlay, .sidebar-overlay, .modal-overlay, .ob-overlay')) return;
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
      const progress = Math.min(delta / this._THRESHOLD, 1);
      const moveY = Math.min(delta * 0.45, 34);
      const scale = Math.min(0.4 + 0.6 * progress, 1);

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
        this._resetIndicator();
      }
      isMouseDown = false;
      this._pulling = false;
    });
  },

  async _doRefresh() {
    this._spinner.classList.remove('ptr-dragging');
    this._spinner.classList.add('ptr-show', 'ptr-spinning');
    this._spinner.style.transform = 'translateX(-50%) translateY(30px) scale(1)';
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

      this._resetIndicator();
      this._triggered = false;
    }, 850);
  },
};
