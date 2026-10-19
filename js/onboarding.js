import { Plan } from './plan.js';
import { safeStorage } from './utils.js';

/**
 * Onboarding.js — Tela de Apresentação Confeitex
 * Exibida na inicialização do app no celular.
 * Apresenta as funcionalidades e fornece o menu direto para inserir a chave de acesso.
 */

export const Onboarding = {
  KEY_SEEN: 'confeitex_onboarding_seen',
  _current: 0,
  _total: 5,
  _startX: null,
  _overlay: null,

  // ─────────────────────────────────────────────────────────────────────────
  // Verifica se deve exibir
  // ─────────────────────────────────────────────────────────────────────────
  shouldShow() {
    // Se ainda não ativou a chave vitalícia, sempre exibe a apresentação para orientar e permitir ativação
    if (typeof Plan !== 'undefined' && !Plan.isLifetimeActive()) {
      return true;
    }
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
      title: 'Bem-vinda ao Confeitex!',
      desc: 'O assistente inteligente para confeiteiras de sucesso. Mais organização, menos desperdício e lucro real em cada receita.',
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
      title: 'Pedidos & Encomendas',
      desc: 'Cadastre encomendas completas: cliente, sabor, data de entrega, peso e status. Nunca mais perca um pedido ou anotação de caderno.',
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
      desc: 'Histórico completo de compras, preferências e faturamento por cliente salvo com segurança diretamente no seu aparelho.',
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
      title: 'Precificação & WhatsApp',
      desc: 'Ficha técnica para calcular custos reais e margem garantida. Gere comprovantes e recibos para enviar no WhatsApp com 1 toque.',
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
      title: 'Acesso Vitalício',
      desc: 'App 100% no celular, funciona sem internet e sem mensalidades. Ative sua chave de acesso ou adquira por taxa única de <strong>R$ 89,90</strong> no Mercado Pago.',
      color: 'pink',
      isFinal: true
    }
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Exibe o onboarding
  // ─────────────────────────────────────────────────────────────────────────
  show(force = false) {
    if (this._overlay) {
      if (force) {
        this._overlay.remove();
        this._overlay = null;
      } else {
        return;
      }
    }

    const overlay = document.createElement('div');
    overlay.className = 'ob-overlay';
    overlay.id = 'onboardingOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Apresentação do Confeitex');
    this._overlay = overlay;
    this._current = 0;

    overlay.innerHTML = `
      <div class="ob-container">

        <!-- Barra superior com marca e botão de Ativar Chave -->
        <div class="ob-topbar">
          <div class="ob-brand">
            <div class="ob-brand-icon">
              <svg viewBox="0 0 24 24"><path d="M7 16.5h10"/><rect x="7.9" y="13.4" width="8.2" height="3" rx="0.6"/><rect x="9.8" y="10.1" width="4.5" height="3.4" rx="0.5"/><path d="M12 10.1V8.6"/><path d="M12 6.9c-.66.66-1.03 1.13-1.03 1.69a1.03 1.03 0 0 0 2.06 0c0-.56-.37-1.03-1.03-1.69z" fill="white" stroke="none"/></svg>
            </div>
            <span>Confeitex</span>
          </div>
          <div class="ob-topbar-actions">
            <button class="ob-btn-key-top" id="obHeaderKeyBtn" title="Inserir Chave de Acesso">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Ativar Chave</span>
            </button>
            <button class="ob-skip" id="obSkip">Pular</button>
          </div>
        </div>

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
    const btnSkip = document.getElementById('obSkip');
    if (btnSkip) btnSkip.onclick = () => this.finish();

    const btnNext = document.getElementById('obNext');
    if (btnNext) btnNext.onclick = () => this.next();

    const btnBack = document.getElementById('obBack');
    if (btnBack) btnBack.onclick = () => this.prev();

    const btnHeaderKey = document.getElementById('obHeaderKeyBtn');
    if (btnHeaderKey) {
      btnHeaderKey.onclick = () => {
        if (typeof Plan !== 'undefined' && Plan.showKeyInputModal) {
          Plan.showKeyInputModal();
        }
      };
    }

    // Dots
    overlay.querySelectorAll('.ob-dot').forEach(dot => {
      dot.onclick = () => this.goTo(parseInt(dot.dataset.index, 10));
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
    });

    this._updateNav();
  },

  _renderSlide(slide, index) {
    const checkoutUrl = (typeof Plan !== 'undefined' && Plan.getCheckoutUrl)
      ? Plan.getCheckoutUrl()
      : 'https://link.mercadopago.com.br/';

    const finalBtns = slide.isFinal ? `
      <div class="ob-final-actions">
        <button class="ob-btn-key-slide" id="obBtnKey">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Inserir Chave de Acesso
        </button>
        <a href="${checkoutUrl}" target="_blank" rel="noopener" class="ob-btn-buy-slide" id="obBtnBuy">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
          </svg>
          Comprar no Mercado Pago (R$ 89,90)
        </a>
        <div class="ob-final-price">Taxa única vitalícia · Suporte IA 7 dias · 100% Reembolso</div>
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

    // Bind botão key no último slide
    if (index === this._total - 1) {
      const btnKey = document.getElementById('obBtnKey');
      if (btnKey) {
        btnKey.onclick = () => {
          if (typeof Plan !== 'undefined' && Plan.showKeyInputModal) {
            Plan.showKeyInputModal();
          }
        };
      }
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

    if (this._overlay) {
      this._overlay.classList.add('ob-exit');
      setTimeout(() => {
        if (this._overlay) {
          this._overlay.remove();
          this._overlay = null;
        }

        if (typeof Plan !== 'undefined') {
          if (!Plan.isLifetimeActive()) {
            Plan.showStartupLockIfNeeded();
          }
        }
      }, 500);
    }
  }
};

if (typeof window !== 'undefined') {
  window.Onboarding = Onboarding;
}
