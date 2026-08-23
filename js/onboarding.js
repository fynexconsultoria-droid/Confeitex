/**
 * Onboarding.js — Tela de Apresentação Confeitex
 * Exibida apenas na primeira abertura do app.
 * 5 slides animados mostrando as funcionalidades principais.
 */

const Onboarding = {
  KEY_SEEN: 'confeitex_onboarding_seen',
  _current: 0,
  _total: 5,
  _startX: null,
  _overlay: null,

  // ─────────────────────────────────────────────────────────────────────────
  // Verifica se deve exibir
  // ─────────────────────────────────────────────────────────────────────────
  shouldShow() {
    return safeStorage.get(this.KEY_SEEN) !== 'true';
  },

  markSeen() {
    safeStorage.set(this.KEY_SEEN, 'true');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Slides
  // ─────────────────────────────────────────────────────────────────────────
  slides: [
    {
      id: 'slide-welcome',
      icon: `<div class="ob-cake-anim">
        <svg viewBox="0 0 120 120" class="ob-cake-svg">
          <defs>
            <linearGradient id="cakeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ec4899"/>
              <stop offset="100%" style="stop-color:#8b5cf6"/>
            </linearGradient>
            <linearGradient id="flameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#fbbf24"/>
              <stop offset="100%" style="stop-color:#f59e0b"/>
            </linearGradient>
          </defs>
          <!-- Base do bolo -->
          <rect x="15" y="75" width="90" height="30" rx="8" fill="url(#cakeGrad)" opacity="0.9"/>
          <!-- Cobertura -->
          <ellipse cx="60" cy="75" rx="45" ry="8" fill="#f472b6"/>
          <!-- Topo do bolo -->
          <rect x="25" y="48" width="70" height="28" rx="6" fill="url(#cakeGrad)"/>
          <ellipse cx="60" cy="48" rx="35" ry="6" fill="#c084fc"/>
          <!-- Vela -->
          <rect x="57" y="28" width="6" height="22" rx="3" fill="#fef3c7"/>
          <!-- Chama -->
          <ellipse cx="60" cy="25" rx="5" ry="8" fill="url(#flameGrad)" class="ob-flame"/>
          <!-- Decorações -->
          <circle cx="35" cy="65" r="4" fill="white" opacity="0.6"/>
          <circle cx="60" cy="65" r="4" fill="white" opacity="0.6"/>
          <circle cx="85" cy="65" r="4" fill="white" opacity="0.6"/>
          <circle cx="40" cy="88" r="3" fill="white" opacity="0.5"/>
          <circle cx="60" cy="88" r="3" fill="white" opacity="0.5"/>
          <circle cx="80" cy="88" r="3" fill="white" opacity="0.5"/>
        </svg>
      </div>`,
      title: 'Bem-vindo ao Confeitex!',
      desc: 'Seu assistente completo para gerenciar a confeitaria dos seus sonhos. Mais organização, mais tempo, mais lucro.',
      color: 'pink'
    },
    {
      id: 'slide-orders',
      icon: `<div class="ob-icon-wrap ob-icon-orders">
        <svg viewBox="0 0 80 80" class="ob-feature-svg">
          <defs>
            <linearGradient id="orderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ec4899"/>
              <stop offset="100%" style="stop-color:#8b5cf6"/>
            </linearGradient>
          </defs>
          <!-- Clipboard -->
          <rect x="12" y="14" width="56" height="58" rx="6" fill="url(#orderGrad)" opacity="0.15" stroke="url(#orderGrad)" stroke-width="2"/>
          <rect x="28" y="8" width="24" height="14" rx="4" fill="url(#orderGrad)"/>
          <!-- Linhas do pedido -->
          <rect x="20" y="34" width="40" height="3" rx="1.5" fill="url(#orderGrad)" opacity="0.8"/>
          <rect x="20" y="43" width="30" height="3" rx="1.5" fill="url(#orderGrad)" opacity="0.6"/>
          <rect x="20" y="52" width="35" height="3" rx="1.5" fill="url(#orderGrad)" opacity="0.5"/>
          <!-- Check icon -->
          <circle cx="58" cy="58" r="12" fill="url(#orderGrad)"/>
          <polyline points="53,58 57,62 64,54" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>`,
      title: 'Pedidos Organizados',
      desc: 'Cadastre encomendas com todos os detalhes: cliente, sabor, data de entrega, valor e status. Nunca mais perca um pedido.',
      color: 'purple'
    },
    {
      id: 'slide-clients',
      icon: `<div class="ob-icon-wrap ob-icon-clients">
        <svg viewBox="0 0 80 80" class="ob-feature-svg">
          <defs>
            <linearGradient id="clientGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#06b6d4"/>
              <stop offset="100%" style="stop-color:#8b5cf6"/>
            </linearGradient>
          </defs>
          <!-- Pessoas -->
          <circle cx="30" cy="28" r="10" fill="url(#clientGrad)" opacity="0.9"/>
          <path d="M10 56 Q10 44 30 44 Q50 44 50 56" fill="url(#clientGrad)" opacity="0.7"/>
          <!-- Segunda pessoa -->
          <circle cx="55" cy="30" r="8" fill="url(#clientGrad)" opacity="0.7"/>
          <path d="M38 56 Q38 46 55 46 Q72 46 72 56" fill="url(#clientGrad)" opacity="0.5"/>
          <!-- Badge de estrela -->
          <circle cx="55" cy="18" r="10" fill="#fbbf24"/>
          <text x="55" y="22" text-anchor="middle" fill="white" font-size="12" font-weight="bold">★</text>
        </svg>
      </div>`,
      title: 'Clientes Fiéis',
      desc: 'Gerencie seu relacionamento com clientes. Veja o histórico completo de pedidos, preferências e total gasto por cliente.',
      color: 'cyan'
    },
    {
      id: 'slide-finance',
      icon: `<div class="ob-icon-wrap ob-icon-finance">
        <svg viewBox="0 0 80 80" class="ob-feature-svg">
          <defs>
            <linearGradient id="finGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#10b981"/>
              <stop offset="100%" style="stop-color:#06b6d4"/>
            </linearGradient>
          </defs>
          <!-- Gráfico de barras -->
          <rect x="12" y="50" width="12" height="20" rx="2" fill="url(#finGrad)" opacity="0.5"/>
          <rect x="28" y="35" width="12" height="35" rx="2" fill="url(#finGrad)" opacity="0.7"/>
          <rect x="44" y="22" width="12" height="48" rx="2" fill="url(#finGrad)" opacity="0.85"/>
          <rect x="60" y="12" width="12" height="58" rx="2" fill="url(#finGrad)"/>
          <!-- Linha de tendência -->
          <polyline points="18,52 34,37 50,24 66,14" stroke="#fbbf24" stroke-width="3" fill="none" stroke-linecap="round"/>
          <!-- Círculo de R$ -->
          <circle cx="18" cy="12" r="10" fill="url(#finGrad)"/>
          <text x="18" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">R$</text>
        </svg>
      </div>`,
      title: 'Controle Financeiro',
      desc: 'Acompanhe faturamento, lucro real, despesas e muito mais. Tome decisões baseadas em dados concretos do seu negócio.',
      color: 'green'
    },
    {
      id: 'slide-start',
      icon: `<div class="ob-start-icon">
        <svg viewBox="0 0 100 100" class="ob-rocket-svg">
          <defs>
            <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ec4899"/>
              <stop offset="100%" style="stop-color:#8b5cf6"/>
            </linearGradient>
          </defs>
          <!-- Foguete -->
          <path d="M50 15 C50 15 65 30 70 55 L50 65 L30 55 C35 30 50 15 50 15Z" fill="url(#rocketGrad)"/>
          <!-- Janela -->
          <circle cx="50" cy="40" r="8" fill="white" opacity="0.3"/>
          <circle cx="50" cy="40" r="5" fill="white" opacity="0.5"/>
          <!-- Asas -->
          <path d="M30 55 L18 68 L30 65Z" fill="url(#rocketGrad)" opacity="0.7"/>
          <path d="M70 55 L82 68 L70 65Z" fill="url(#rocketGrad)" opacity="0.7"/>
          <!-- Fogo -->
          <ellipse cx="50" cy="70" rx="8" ry="12" fill="#fbbf24" opacity="0.9" class="ob-flame2"/>
          <ellipse cx="50" cy="72" rx="5" ry="8" fill="#f97316" opacity="0.8" class="ob-flame2"/>
          <!-- Estrelas -->
          <circle cx="25" cy="25" r="2" fill="white" opacity="0.7" class="ob-star"/>
          <circle cx="75" cy="20" r="1.5" fill="white" opacity="0.6" class="ob-star"/>
          <circle cx="20" cy="45" r="1" fill="white" opacity="0.5" class="ob-star"/>
          <circle cx="80" cy="40" r="2" fill="white" opacity="0.7" class="ob-star"/>
        </svg>
      </div>`,
      title: 'Pronto para Decolar!',
      desc: 'Você tem <strong>7 dias grátis</strong> para experimentar tudo. Depois, continue por apenas <strong>R$7,99/mês</strong>.',
      color: 'pink',
      isFinal: true
    }
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Exibe o onboarding
  // ─────────────────────────────────────────────────────────────────────────
  show() {
    if (this._overlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'ob-overlay';
    overlay.id = 'onboardingOverlay';
    this._overlay = overlay;
    this._current = 0;

    overlay.innerHTML = `
      <div class="ob-container">

        <!-- Botão pular -->
        <button class="ob-skip" id="obSkip">Pular</button>

        <!-- Slides wrapper -->
        <div class="ob-slides-wrapper" id="obSlidesWrapper">
          ${this.slides.map((s, i) => this._renderSlide(s, i)).join('')}
        </div>

        <!-- Dots de navegação -->
        <div class="ob-dots" id="obDots">
          ${this.slides.map((_, i) => `<div class="ob-dot${i === 0 ? ' active' : ''}" data-index="${i}"></div>`).join('')}
        </div>

        <!-- Botões de navegação -->
        <div class="ob-nav" id="obNav">
          <button class="ob-btn-back" id="obBack" style="visibility:hidden;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Anterior
          </button>
          <button class="ob-btn-next" id="obNext">
            Próximo
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

      </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Eventos
    document.getElementById('obSkip').onclick  = () => this.finish();
    document.getElementById('obNext').onclick  = () => this.next();
    document.getElementById('obBack').onclick  = () => this.prev();

    // Dots
    overlay.querySelectorAll('.ob-dot').forEach(dot => {
      dot.onclick = () => this.goTo(parseInt(dot.dataset.index));
    });

    // Swipe gestures (mobile)
    overlay.addEventListener('touchstart', e => { this._startX = e.touches[0].clientX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
      if (this._startX === null) return;
      const dx = e.changedTouches[0].clientX - this._startX;
      this._startX = null;
      if (Math.abs(dx) > 50) {
        dx < 0 ? this.next() : this.prev();
      }
    }, { passive: true });

    this._updateNav();
  },

  _renderSlide(slide, index) {
    const finalBtns = slide.isFinal ? `
      <div class="ob-final-actions">
        <button class="ob-btn-start" id="obBtnStart">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Começar 7 Dias Grátis
        </button>
        <div class="ob-final-price">Depois, apenas R$7,99/mês · Cancele quando quiser</div>
      </div>` : '';

    return `
      <div class="ob-slide ob-slide--${slide.color}" data-slide="${index}">
        <div class="ob-slide-content">
          <div class="ob-slide-icon">${slide.icon}</div>
          <h2 class="ob-slide-title">${slide.title}</h2>
          <p class="ob-slide-desc">${slide.desc}</p>
          ${finalBtns}
        </div>
      </div>`;
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Navegação
  // ─────────────────────────────────────────────────────────────────────────
  goTo(index) {
    if (index < 0 || index >= this._total) return;
    this._current = index;

    const wrapper = document.getElementById('obSlidesWrapper');
    if (wrapper) {
      wrapper.style.transform = `translateX(-${index * 100}%)`;
    }

    // Dots
    document.querySelectorAll('.ob-dot').forEach((d, i) => d.classList.toggle('active', i === index));

    this._updateNav();

    // Bind botão start no último slide
    if (index === this._total - 1) {
      const btnStart = document.getElementById('obBtnStart');
      if (btnStart) btnStart.onclick = () => this.finish();
    }
  },

  next() {
    if (this._current < this._total - 1) {
      this.goTo(this._current + 1);
    } else {
      this.finish();
    }
  },

  prev() {
    if (this._current > 0) {
      this.goTo(this._current - 1);
    }
  },

  _updateNav() {
    const back = document.getElementById('obBack');
    const next = document.getElementById('obNext');
    const skip = document.getElementById('obSkip');
    if (!back || !next) return;

    const isLast = this._current === this._total - 1;

    back.style.visibility = this._current === 0 ? 'hidden' : 'visible';

    if (isLast) {
      next.style.display = 'none';
      if (skip) skip.style.display = 'none';
    } else {
      next.style.display = 'flex';
      next.innerHTML = this._current === this._total - 2
        ? 'Finalizar <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
        : 'Próximo <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
      if (skip) skip.style.display = 'block';
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Finaliza o onboarding
  // ─────────────────────────────────────────────────────────────────────────
  finish() {
    this.markSeen();

    if (typeof Plan !== 'undefined') {
      Plan.init(); // garante que o trial começou
    }

    if (this._overlay) {
      this._overlay.classList.add('ob-exit');
      setTimeout(() => {
        if (this._overlay) {
          this._overlay.remove();
          this._overlay = null;
        }
      }, 600);
    }
  }
};
