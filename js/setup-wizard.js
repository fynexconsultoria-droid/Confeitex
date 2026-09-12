/**
 * CONFEITEX - Initial Setup Wizard (js/setup-wizard.js)
 * Interactive questionnaire shown upon app opening to register:
 * 1. Confectioner profile (Name, contact, primary goal)
 * 2. Bakery / Company profile (Brand name, specialty, WhatsApp, Pix key)
 * 3. Work routine & preferences (Weekly order volume, reservation deposit)
 */

const SetupWizard = {
  KEY_COMPLETED: 'confeitex_setup_completed',
  currentStep: 1,
  totalSteps: 3,
  overlay: null,

  data: {
    userName: '',
    userEmail: '',
    userGoal: 'organize',
    userAvatar: '',
    bakeryName: '',
    bakerySpecialty: 'cakes',
    bakeryPhone: '',
    bakeryPix: '',
    bakeryLogo: '',
    weeklyVolume: 'vol1',
    depositPolicy: 'deposit50'
  },

  shouldShow() {
    const completed = safeStorage.get(this.KEY_COMPLETED) === 'true';
    if (completed) return false;

    // Se já existe perfil de usuário ou de padaria preenchido, considera configurado
    if (State.userProfile && State.userProfile.name && State.userProfile.name.trim() !== '') {
      return false;
    }
    if (State.bakeryProfile && State.bakeryProfile.name && State.bakeryProfile.name.trim() !== '') {
      return false;
    }
    return true;
  },

  show() {
    if (document.getElementById('setupWizardOverlay')) return;

    // Preenche com o que já estiver salvo se houver
    if (State.userProfile) {
      this.data.userName = State.userProfile.name || '';
      this.data.userEmail = State.userProfile.email || '';
      this.data.userGoal = State.userProfile.goal || 'organize';
      this.data.weeklyVolume = State.userProfile.weeklyVolume || 'vol1';
      this.data.userAvatar = State.userProfile.avatar || '';
    }
    if (State.bakeryProfile) {
      this.data.bakeryName = State.bakeryProfile.name || '';
      this.data.bakeryPhone = State.bakeryProfile.phone || '';
      this.data.bakeryPix = State.bakeryProfile.pix || '';
      this.data.bakeryLogo = State.bakeryProfile.logo || '';
    }

    this.currentStep = 1;
    this.createDOM();
    this.renderStep();
  },

  createDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'setupWizardOverlay';
    overlay.className = 'wizard-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', I18n.t('wizard.welcomeTitle'));

    overlay.innerHTML = `
      <div class="wizard-container">
        <!-- Header -->
        <div class="wizard-header">
          <div class="wizard-badge">
            <span class="wizard-sparkle">✨</span>
            <span data-i18n="wizard.welcomeBadge">${I18n.t('wizard.welcomeBadge')}</span>
          </div>
          <h2 class="wizard-main-title" data-i18n="wizard.welcomeTitle">${I18n.t('wizard.welcomeTitle')}</h2>
          <p class="wizard-main-sub" data-i18n="wizard.welcomeSub">${I18n.t('wizard.welcomeSub')}</p>

          <!-- Stepper Progress Bar -->
          <div class="wizard-stepper">
            <div class="wizard-step-node" data-step="1">
              <span class="step-num">1</span>
              <span class="step-label" data-i18n="wizard.step1Title">${I18n.t('wizard.step1Title')}</span>
            </div>
            <div class="wizard-step-line" id="wizardLine1"></div>
            <div class="wizard-step-node" data-step="2">
              <span class="step-num">2</span>
              <span class="step-label" data-i18n="wizard.step2Title">${I18n.t('wizard.step2Title')}</span>
            </div>
            <div class="wizard-step-line" id="wizardLine2"></div>
            <div class="wizard-step-node" data-step="3">
              <span class="step-num">3</span>
              <span class="step-label" data-i18n="wizard.step3Title">${I18n.t('wizard.step3Title')}</span>
            </div>
          </div>
        </div>

        <!-- Dynamic Body Step -->
        <div class="wizard-body" id="wizardBody">
          <!-- Step HTML dynamically rendered -->
        </div>

        <!-- Footer Actions -->
        <div class="wizard-footer">
          <button type="button" class="btn btn-secondary wizard-btn-skip" id="btnWizardSkip" onclick="SetupWizard.skip()">
            ${I18n.t('wizard.btnSkip')}
          </button>
          <div class="wizard-footer-right">
            <button type="button" class="btn btn-secondary wizard-btn-back" id="btnWizardBack" onclick="SetupWizard.prevStep()" style="display:none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="15 18 9 12 15 6"/></svg>
              <span>${I18n.t('wizard.btnBack')}</span>
            </button>
            <button type="button" class="btn btn-primary wizard-btn-next" id="btnWizardNext" onclick="SetupWizard.nextStep()">
              <span>${I18n.t('wizard.btnNext')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlay = overlay;
    requestAnimationFrame(() => overlay.classList.add('active'));
  },

  renderStep() {
    const body = document.getElementById('wizardBody');
    if (!body) return;

    // Atualiza stepper
    document.querySelectorAll('.wizard-step-node').forEach(node => {
      const s = parseInt(node.dataset.step, 10);
      node.classList.toggle('active', s === this.currentStep);
      node.classList.toggle('completed', s < this.currentStep);
    });

    const line1 = document.getElementById('wizardLine1');
    const line2 = document.getElementById('wizardLine2');
    if (line1) line1.classList.toggle('active', this.currentStep >= 2);
    if (line2) line2.classList.toggle('active', this.currentStep >= 3);

    // Botoes
    const btnBack = document.getElementById('btnWizardBack');
    const btnNext = document.getElementById('btnWizardNext');
    if (btnBack) btnBack.style.display = this.currentStep > 1 ? 'inline-flex' : 'none';

    if (btnNext) {
      if (this.currentStep === this.totalSteps) {
        btnNext.className = 'btn btn-primary wizard-btn-finish';
        btnNext.innerHTML = `<span>${I18n.t('wizard.btnFinish')}</span>`;
      } else {
        btnNext.className = 'btn btn-primary wizard-btn-next';
        btnNext.innerHTML = `<span>${I18n.t('wizard.btnNext')}</span> <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><polyline points="9 18 15 12 9 6"/></svg>`;
      }
    }

    if (this.currentStep === 1) {
      body.innerHTML = `
        <div class="wizard-step-pane">
          <div class="wizard-pane-header">
            <span class="wizard-pane-step-tag">Passo 1 de 3</span>
            <h3 class="wizard-pane-title">${I18n.t('wizard.step1Title')}</h3>
            <p class="wizard-pane-desc">${I18n.t('wizard.step1Sub')}</p>
          </div>

          <!-- Photo / Avatar Picker -->
          <div class="wizard-photo-upload-wrap mb-3">
            <div class="wizard-avatar-preview" id="wizardAvatarPreview">
              ${this.data.userAvatar
                ? `<img src="${escapeHTML(this.data.userAvatar)}" alt="Foto" class="wizard-avatar-img" />`
                : `<div class="wizard-avatar-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`}
            </div>
            <div class="wizard-photo-actions">
              <label class="btn btn-secondary btn-sm wizard-upload-btn" for="wizardAvatarInput">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                <span>${this.data.userAvatar ? I18n.t('settings.photoChange') : I18n.t('wizard.uploadPhoto')}</span>
              </label>
              <input type="file" id="wizardAvatarInput" accept="image/*" style="display:none;" />
              ${this.data.userAvatar ? `<button type="button" class="btn btn-text btn-sm text-danger" onclick="SetupWizard.removeUserAvatar()">${I18n.t('wizard.removePhoto')}</button>` : ''}
              <span class="wizard-photo-hint">${I18n.t('wizard.photoHint')}</span>
            </div>
          </div>

          <div class="form-group mb-3">
            <label for="wizardInputUserName">${I18n.t('wizard.userName')}</label>
            <input type="text" class="form-control wizard-input" id="wizardInputUserName"
                   value="${escapeHTML(this.data.userName)}"
                   placeholder="${I18n.t('wizard.userNamePh')}" autofocus />
          </div>

          <div class="form-group mb-4">
            <label for="wizardInputUserEmail">${I18n.t('wizard.userEmail')}</label>
            <input type="text" class="form-control wizard-input" id="wizardInputUserEmail"
                   value="${escapeHTML(this.data.userEmail)}"
                   placeholder="${I18n.t('wizard.userEmailPh')}" />
          </div>

          <div class="form-group">
            <label class="wizard-question-label">${I18n.t('wizard.userGoal')}</label>
            <div class="wizard-cards-grid">
              ${this.renderCardOption('userGoal', 'organize', I18n.t('wizard.goalOrganize'))}
              ${this.renderCardOption('userGoal', 'professional', I18n.t('wizard.goalProfessional'))}
              ${this.renderCardOption('userGoal', 'finance', I18n.t('wizard.goalFinance'))}
              ${this.renderCardOption('userGoal', 'time', I18n.t('wizard.goalTime'))}
            </div>
          </div>
        </div>
      `;

      // Listener de upload da foto do usuário
      const avatarInp = document.getElementById('wizardAvatarInput');
      if (avatarInp) {
        avatarInp.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          this.captureCurrentInputs();
          if (typeof Utils !== 'undefined' && Utils.compressImage) {
            Utils.compressImage(file, 360, 360, 0.82).then(dataUrl => {
              this.data.userAvatar = dataUrl;
              this.renderStep();
            }).catch(err => {
              if (typeof UI !== 'undefined' && UI.toast) UI.toast(err.message || 'Erro ao carregar foto', 'error');
            });
          }
        });
      }

      // Foco automático
      setTimeout(() => {
        const inp = document.getElementById('wizardInputUserName');
        if (inp) inp.focus();
      }, 100);

    } else if (this.currentStep === 2) {
      body.innerHTML = `
        <div class="wizard-step-pane">
          <div class="wizard-pane-header">
            <span class="wizard-pane-step-tag">Passo 2 de 3</span>
            <h3 class="wizard-pane-title">${I18n.t('wizard.step2Title')}</h3>
            <p class="wizard-pane-desc">${I18n.t('wizard.step2Sub')}</p>
          </div>

          <!-- Company Logo Picker -->
          <div class="wizard-photo-upload-wrap mb-3">
            <div class="wizard-logo-preview" id="wizardLogoPreview">
              ${this.data.bakeryLogo
                ? `<img src="${escapeHTML(this.data.bakeryLogo)}" alt="Logo" class="wizard-logo-img" />`
                : `<div class="wizard-logo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`}
            </div>
            <div class="wizard-photo-actions">
              <label class="btn btn-secondary btn-sm wizard-upload-btn" for="wizardLogoInput">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>${this.data.bakeryLogo ? I18n.t('settings.logoChange') : I18n.t('wizard.uploadLogo')}</span>
              </label>
              <input type="file" id="wizardLogoInput" accept="image/*" style="display:none;" />
              ${this.data.bakeryLogo ? `<button type="button" class="btn btn-text btn-sm text-danger" onclick="SetupWizard.removeBakeryLogo()">${I18n.t('wizard.removePhoto')}</button>` : ''}
              <span class="wizard-photo-hint">${I18n.t('wizard.photoHint')}</span>
            </div>
          </div>

          <div class="form-group mb-3">
            <label for="wizardInputBakeryName">${I18n.t('wizard.bakeryName')}</label>
            <input type="text" class="form-control wizard-input" id="wizardInputBakeryName"
                   value="${escapeHTML(this.data.bakeryName)}"
                   placeholder="${I18n.t('wizard.bakeryNamePh')}" autofocus />
          </div>

          <div class="form-group mb-4">
            <label class="wizard-question-label">${I18n.t('wizard.bakerySpecialty')}</label>
            <div class="wizard-cards-grid">
              ${this.renderCardOption('bakerySpecialty', 'cakes', I18n.t('wizard.specCakes'))}
              ${this.renderCardOption('bakerySpecialty', 'sweets', I18n.t('wizard.specSweets'))}
              ${this.renderCardOption('bakerySpecialty', 'savory', I18n.t('wizard.specSavory'))}
              ${this.renderCardOption('bakerySpecialty', 'general', I18n.t('wizard.specGeneral'))}
            </div>
          </div>

          <div class="form-row mb-3">
            <div class="form-group flex-1">
              <label for="wizardInputBakeryPhone">${I18n.t('wizard.bakeryPhone')}</label>
              <input type="tel" class="form-control wizard-input" id="wizardInputBakeryPhone"
                     value="${escapeHTML(this.data.bakeryPhone)}"
                     placeholder="${I18n.t('wizard.bakeryPhonePh')}" />
            </div>
            <div class="form-group flex-1">
              <label for="wizardInputBakeryPix">${I18n.t('wizard.bakeryPix')}</label>
              <input type="text" class="form-control wizard-input" id="wizardInputBakeryPix"
                     value="${escapeHTML(this.data.bakeryPix)}"
                     placeholder="${I18n.t('wizard.bakeryPixPh')}" />
            </div>
          </div>
        </div>
      `;

      // Listener de upload do logo da empresa
      const logoInp = document.getElementById('wizardLogoInput');
      if (logoInp) {
        logoInp.addEventListener('change', (e) => {
          const file = e.target.files && e.target.files[0];
          if (!file) return;
          this.captureCurrentInputs();
          if (typeof Utils !== 'undefined' && Utils.compressImage) {
            Utils.compressImage(file, 400, 400, 0.85).then(dataUrl => {
              this.data.bakeryLogo = dataUrl;
              this.renderStep();
            }).catch(err => {
              if (typeof UI !== 'undefined' && UI.toast) UI.toast(err.message || 'Erro ao carregar logo', 'error');
            });
          }
        });
      }

      const phoneInp = document.getElementById('wizardInputBakeryPhone');
      if (phoneInp && typeof maskPhone === 'function') {
        phoneInp.oninput = (e) => maskPhone(e.target);
      }

    } else if (this.currentStep === 3) {
      body.innerHTML = `
        <div class="wizard-step-pane">
          <div class="wizard-pane-header">
            <span class="wizard-pane-step-tag">Passo 3 de 3</span>
            <h3 class="wizard-pane-title">${I18n.t('wizard.step3Title')}</h3>
            <p class="wizard-pane-desc">${I18n.t('wizard.step3Sub')}</p>
          </div>

          <div class="form-group mb-4">
            <label class="wizard-question-label">${I18n.t('wizard.weeklyVolume')}</label>
            <div class="wizard-cards-grid wizard-cards-vertical">
              ${this.renderCardOption('weeklyVolume', 'vol1', I18n.t('wizard.vol1'))}
              ${this.renderCardOption('weeklyVolume', 'vol2', I18n.t('wizard.vol2'))}
              ${this.renderCardOption('weeklyVolume', 'vol3', I18n.t('wizard.vol3'))}
            </div>
          </div>

          <div class="form-group">
            <label class="wizard-question-label">${I18n.t('wizard.noticeDeposit')}</label>
            <div class="wizard-cards-grid">
              ${this.renderCardOption('depositPolicy', 'deposit50', I18n.t('wizard.deposit50'))}
              ${this.renderCardOption('depositPolicy', 'depositNone', I18n.t('wizard.depositNone'))}
            </div>
          </div>
        </div>
      `;
    }
  },

  renderCardOption(field, value, label) {
    const isSelected = this.data[field] === value;
    return `
      <div class="wizard-card-option ${isSelected ? 'selected' : ''}"
           onclick="SetupWizard.selectCardOption('${field}', '${value}', this)">
        <div class="wizard-card-radio">
          <div class="wizard-card-dot"></div>
        </div>
        <span class="wizard-card-text">${escapeHTML(label)}</span>
      </div>
    `;
  },

  selectCardOption(field, value, el) {
    this.data[field] = value;
    const parent = el.closest('.wizard-cards-grid');
    if (parent) {
      parent.querySelectorAll('.wizard-card-option').forEach(c => c.classList.remove('selected'));
    }
    el.classList.add('selected');
  },

  captureCurrentInputs() {
    if (this.currentStep === 1) {
      const name = document.getElementById('wizardInputUserName')?.value?.trim();
      const email = document.getElementById('wizardInputUserEmail')?.value?.trim();
      if (name) this.data.userName = name;
      if (email) this.data.userEmail = email;
    } else if (this.currentStep === 2) {
      const bName = document.getElementById('wizardInputBakeryName')?.value?.trim();
      const phone = document.getElementById('wizardInputBakeryPhone')?.value?.trim();
      const pix = document.getElementById('wizardInputBakeryPix')?.value?.trim();
      if (bName) this.data.bakeryName = bName;
      if (phone) this.data.bakeryPhone = phone;
      if (pix) this.data.bakeryPix = pix;
    }
  },

  nextStep() {
    this.captureCurrentInputs();

    if (this.currentStep === 1 && !this.data.userName) {
      const inp = document.getElementById('wizardInputUserName');
      if (inp) {
        inp.focus();
        inp.classList.add('input-shake');
        setTimeout(() => inp.classList.remove('input-shake'), 600);
      }
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Por favor, informe seu nome ou apelido para personalizarmos o app!', 'warning');
      }
      return;
    }

    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.renderStep();
    } else {
      this.saveAndFinish();
    }
  },

  prevStep() {
    this.captureCurrentInputs();
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderStep();
    }
  },

  removeUserAvatar() {
    this.captureCurrentInputs();
    this.data.userAvatar = '';
    this.renderStep();
  },

  removeBakeryLogo() {
    this.captureCurrentInputs();
    this.data.bakeryLogo = '';
    this.renderStep();
  },

  saveAndFinish() {
    this.captureCurrentInputs();

    const userName = this.data.userName || 'Confeiteiro(a)';
    const bakeryName = this.data.bakeryName || 'Minha Confeitaria';

    // Salva perfil do usuário com foto
    State.userProfile = {
      name: sanitizeText(userName),
      email: sanitizeText(this.data.userEmail || ''),
      phone: sanitizeText(this.data.bakeryPhone || ''),
      role: 'Confeiteiro(a)',
      goal: sanitizeText(this.data.userGoal || 'organize'),
      weeklyVolume: sanitizeText(this.data.weeklyVolume || 'vol1'),
      avatar: this.data.userAvatar || ''
    };
    State.saveUserProfile();

    // Salva ou atualiza perfil da confeitaria com logo
    const orderNotice = this.data.depositPolicy === 'deposit50'
      ? 'Encomendas com antecedência mínima de 48h. Reserva confirmada mediante sinal de 50%.'
      : 'Encomendas sob consulta prévia.';

    State.bakeryProfile = {
      ...State.bakeryProfile,
      name: sanitizeText(bakeryName),
      phone: sanitizeText(this.data.bakeryPhone || ''),
      pix: sanitizeText(this.data.bakeryPix || ''),
      orderNotice: sanitizeText(orderNotice),
      logo: this.data.bakeryLogo || ''
    };
    State.saveBakeryProfile();

    safeStorage.set(this.KEY_COMPLETED, 'true');

    this.close();
    this.updateAppHeaderGreetings();

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(`✨ Bem-vindo(a), ${userName}! Seu Confeitex está pronto!`, 'success');
    }
  },

  skip() {
    safeStorage.set(this.KEY_COMPLETED, 'true');
    this.close();
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast('Você pode personalizar seu perfil a qualquer momento nas Configurações.', 'info');
    }
  },

  close() {
    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }
  },

  updateAppHeaderGreetings() {
    const userName = State.userProfile?.name;
    const bakeryName = State.bakeryProfile?.name;
    const userAvatar = State.userProfile?.avatar;
    const bakeryLogo = State.bakeryProfile?.logo;

    const brandSubtitle = document.querySelector('.brand .badge');
    if (brandSubtitle && bakeryName) {
      brandSubtitle.textContent = bakeryName;
    }

    // Se houver logo da confeitaria, exibe no ícone de marca do header
    const brandIcons = document.querySelectorAll('.brand-icon');
    brandIcons.forEach(iconBox => {
      if (bakeryLogo) {
        iconBox.innerHTML = `<img src="${escapeHTML(bakeryLogo)}" alt="Logo" class="brand-custom-logo-img" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`;
      } else {
        iconBox.innerHTML = `<svg viewBox="0 0 24 24"><path d="M7 16.5h10"/><rect x="7.9" y="13.4" width="8.2" height="3" rx="0.6" fill="none"/><rect x="9.8" y="10.1" width="4.5" height="3.4" rx="0.5" fill="none"/><path d="M12 10.1V8.6"/><path d="M12 6.9c-.66.66-1.03 1.13-1.03 1.69a1.03 1.03 0 0 0 2.06 0c0-.56-.37-1.03-1.03-1.69z" fill="white" stroke="none"/></svg>`;
      }
    });

    const mainSub = document.getElementById('mainSubtitle');
    if (mainSub && userName && (!window.location.hash || window.location.hash.includes('dashboard'))) {
      mainSub.textContent = `Olá, ${userName}! Aqui está o resumo da sua confeitaria hoje.`;
    }

    // Se estiver na aba de catálogo, atualiza o banner
    if (typeof Catalog !== 'undefined' && Catalog.render) {
      Catalog.render();
    }

    const summaryEl = document.getElementById('settingsProfileSummary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="settings-profile-card-content" style="display:flex;gap:1rem;align-items:center;background:rgba(255,255,255,0.03);padding:1rem;border-radius:var(--radius-md);border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;gap:0.6rem;align-items:center;">
            <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;background:rgba(236,72,153,0.15);border:2px solid var(--color-accent-pink);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              ${userAvatar ? `<img src="${escapeHTML(userAvatar)}" alt="Foto" style="width:100%;height:100%;object-fit:cover;" />` : `<span style="font-size:1.4rem;">👤</span>`}
            </div>
            ${bakeryLogo ? `
            <div style="width:48px;height:48px;border-radius:var(--radius-sm);overflow:hidden;background:rgba(168,85,247,0.15);border:2px solid var(--color-accent-purple);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <img src="${escapeHTML(bakeryLogo)}" alt="Logo" style="width:100%;height:100%;object-fit:cover;" />
            </div>` : ''}
          </div>
          <div style="flex:1;font-size:0.85rem;display:flex;flex-direction:column;gap:0.25rem;">
            <div style="font-weight:700;color:white;font-size:0.95rem;">${escapeHTML(userName || 'Confeiteiro(a)')}</div>
            <div style="color:var(--color-accent-pink);font-weight:600;">🎂 ${escapeHTML(bakeryName || 'Minha Confeitaria')}</div>
            ${State.bakeryProfile?.phone ? `<div style="color:var(--text-muted);font-size:0.8rem;">📱 ${escapeHTML(State.bakeryProfile.phone)}</div>` : ''}
            ${State.bakeryProfile?.pix ? `<div style="color:var(--text-muted);font-size:0.8rem;">🔑 Pix: <code>${escapeHTML(State.bakeryProfile.pix)}</code></div>` : ''}
          </div>
        </div>
      `;
    }
  }
};

window.SetupWizard = SetupWizard;
