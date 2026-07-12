// ===== PWA: Service Worker Registration & Install Banner =====

// Registra o Service Worker para cache offline e instalação PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        console.log('[PWA] Service Worker registrado com sucesso:', registration.scope);
      })
      .catch((error) => {
        console.log('[PWA] Falha ao registrar Service Worker:', error);
      });
  });
}

// Variável para armazenar o evento de instalação (Chrome/Android)
let deferredInstallPrompt = null;

// Captura o evento beforeinstallprompt (Chrome, Edge, Samsung Internet)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  
  // Mostra o banner de instalação se o usuário ainda não dispensou
  if (!localStorage.getItem('fyntex_pwa_dismissed')) {
    showInstallBanner('android');
  }
});

// Detecta se está no iOS Safari (que não tem beforeinstallprompt)
window.addEventListener('load', () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  
  if (isIOS && !isInStandaloneMode && !localStorage.getItem('fyntex_pwa_dismissed')) {
    // No iOS, mostra instruções manuais após 2s
    setTimeout(() => showInstallBanner('ios'), 2000);
  }
});

// Cria e exibe o banner de instalação PWA
function showInstallBanner(platform) {
  // Remove banner existente se houver
  const existing = document.querySelector('.pwa-install-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'pwa-install-banner';

  const isIOS = platform === 'ios';

  banner.innerHTML = `
    <div class="pwa-icon">
      <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    </div>
    <div class="pwa-text">
      <h4>Instalar Fyntex</h4>
      <p>${isIOS 
        ? 'Toque em <strong>Compartilhar</strong> (ícone ⬆) e depois <strong>"Adicionar à Tela de Início"</strong>' 
        : 'Adicione o app à tela inicial do seu celular para acesso rápido!'
      }</p>
    </div>
    <div class="pwa-actions">
      ${!isIOS ? '<button class="pwa-btn-install">Instalar</button>' : ''}
      <button class="pwa-btn-dismiss">Agora não</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Anima entrada com delay
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      banner.classList.add('visible');
    });
  });

  // Botão Instalar (apenas Android/Chrome)
  const btnInstall = banner.querySelector('.pwa-btn-install');
  if (btnInstall && deferredInstallPrompt) {
    btnInstall.addEventListener('click', async () => {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[PWA] Resultado da instalação:', outcome);
      deferredInstallPrompt = null;
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 500);
    });
  }

  // Botão Dispensar
  const btnDismiss = banner.querySelector('.pwa-btn-dismiss');
  btnDismiss.addEventListener('click', () => {
    localStorage.setItem('fyntex_pwa_dismissed', 'true');
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 500);
  });

  // Auto-dismiss após 15 segundos
  setTimeout(() => {
    if (banner.classList.contains('visible')) {
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 500);
    }
  }, 15000);
}

// Detecta quando o app foi instalado com sucesso
window.addEventListener('appinstalled', () => {
  console.log('[PWA] Fyntex foi instalado com sucesso!');
  deferredInstallPrompt = null;
  const banner = document.querySelector('.pwa-install-banner');
  if (banner) {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 500);
  }
});

// Fyntex Confeitaria - Lógica do Aplicativo (100% Offline)

// Estado Global
let state = {
  orders: [],
  catalog: [
    { id: '1', flavor: 'Bolo Ninho com Morango', pricePerKg: 75.00, type: 'Bolo de Kg' },
    { id: '2', flavor: 'Bolo Chocolate Belga', pricePerKg: 80.00, type: 'Bolo de Kg' },
    { id: '3', flavor: 'Bolo Red Velvet', pricePerKg: 90.00, type: 'Bolo de Kg' },
    { id: '4', flavor: 'Bolo Prestígio', pricePerKg: 70.00, type: 'Bolo de Kg' },
    { id: '5', flavor: 'Cento de Brigadeiros Goumert', pricePerKg: 120.00, type: 'Doces / Brigadeiros' },
    { id: '6', flavor: 'Cento de Salgados Fritos', pricePerKg: 100.00, type: 'Salgados' }
  ]
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupApp();
});

// Carrega dados do LocalStorage ou define padrão
function loadData() {
  const savedOrders = localStorage.getItem('fyntex_orders');
  const savedCatalog = localStorage.getItem('fyntex_catalog');
  
  if (savedOrders) {
    state.orders = JSON.parse(savedOrders);
  } else {
    // Se não houver dados, vamos carregar os dados demo por padrão para não ficar vazio
    loadDemoData(false); // Carrega sem forçar se o usuário já limpou
  }
  
  if (savedCatalog) {
    state.catalog = JSON.parse(savedCatalog);
  } else {
    saveCatalog();
  }
}

function saveOrders() {
  localStorage.setItem('fyntex_orders', JSON.stringify(state.orders));
}

function saveCatalog() {
  localStorage.setItem('fyntex_catalog', JSON.stringify(state.catalog));
}

// Configura Listeners, Dom e navegação
function setupApp() {
  // Navegação de Abas (Tabs)
  const navLinks = document.querySelectorAll('.nav-link');
  const tabContents = document.querySelectorAll('.tab-content');
  const mainTitle = document.getElementById('mainTitle');
  const mainSubtitle = document.getElementById('mainSubtitle');

  const tabTitles = {
    dashboard: { title: 'Painel de Controle', subtitle: 'Estatísticas gerais e entregas de hoje.' },
    orders: { title: 'Encomendas', subtitle: 'Gerencie e busque todos os pedidos registrados.' },
    clients: { title: 'Banco de Clientes', subtitle: 'Histórico de compras e contatos de clientes.' },
    settings: { title: 'Configurações', subtitle: 'Ajustes do catálogo de sabores e utilitários de backup.' }
  };

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = link.getAttribute('data-tab');
      
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === tabId) {
          content.classList.add('active');
        }
      });

      // Atualiza títulos do topo
      mainTitle.textContent = tabTitles[tabId].title;
      mainSubtitle.textContent = tabTitles[tabId].subtitle;

      // Executa lógica específica da aba
      if (tabId === 'dashboard') {
        updateDashboard();
      } else if (tabId === 'orders') {
        renderOrdersTable();
      } else if (tabId === 'clients') {
        renderClientsTable();
      } else if (tabId === 'settings') {
        renderCatalogSettings();
      }

      // Fecha menu mobile se estiver aberto
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarOverlay').classList.remove('active');
    });
  });

  // Mobile Menu Toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });

  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });

  // Exibe data de hoje no topo
  const today = new Date();
  document.getElementById('currentDateDisplay').textContent = formatDate(today);
  
  // Data padrão para o calculador diário é hoje
  const dateInput = document.getElementById('calcDateInput');
  dateInput.value = today.toISOString().split('T')[0];
  dateInput.addEventListener('change', () => {
    calculateDayTotals(dateInput.value);
  });
  
  document.getElementById('btnQuickCalcToday').addEventListener('click', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;
    calculateDayTotals(todayStr);
  });

  // Listener para período do gráfico
  document.getElementById('chartPeriodSelect').addEventListener('change', () => {
    renderCanvasChart();
  });

  // Configuração do formulário de pedidos (Modal)
  setupOrderForm();

  // Configurações e Backup
  document.getElementById('btnExportData').addEventListener('click', exportDataJSON);
  document.getElementById('importFileInput').addEventListener('change', importDataJSON);
  document.getElementById('btnImportData').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('btnLoadDemo').addEventListener('click', () => {
    if(confirm('Isso irá substituir os dados atuais pelos dados de demonstração. Deseja continuar?')) {
      loadDemoData(true);
      updateDashboard();
      alert('Dados de demonstração carregados com sucesso!');
    }
  });
  document.getElementById('btnClearAllData').addEventListener('click', () => {
    if(confirm('ATENÇÃO: Isso apagará TODOS os dados cadastrados permanentemente. Deseja continuar?')) {
      state.orders = [];
      saveOrders();
      updateDashboard();
      alert('Todos os dados foram excluídos.');
    }
  });

  // Configuração do Catálogo de Sabores
  document.getElementById('btnAddCatalogItem').addEventListener('click', addCatalogItem);

  // Inicializa a tela com o Dashboard atualizado
  updateDashboard();
}

// Configuração do Formulário e Modal de Pedidos
function setupOrderForm() {
  const modal = document.getElementById('orderModal');
  const btnNewOrder = document.getElementById('btnNewOrder');
  const btnCloseX = document.getElementById('btnModalOrderClose');
  const btnCancel = document.getElementById('btnModalOrderCancel');
  const form = document.getElementById('orderForm');
  
  const inputWeight = document.getElementById('orderWeight');
  const inputPrice = document.getElementById('orderUnitPrice');
  const inputExtra = document.getElementById('orderExtraCharges');
  const selectFlavor = document.getElementById('orderFlavorSelect');
  const inputFlavor = document.getElementById('orderFlavor');
  const selectType = document.getElementById('orderProductType');

  // Abre Modal
  btnNewOrder.addEventListener('click', () => {
    form.reset();
    document.getElementById('orderIdInput').value = '';
    document.getElementById('modalOrderTitleText').textContent = 'Novo Pedido de Confeitaria';
    
    // Configura valores padrão
    document.getElementById('orderDeliveryDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('orderDeliveryTime').value = '14:00';
    inputWeight.value = '1.00';
    inputPrice.value = '60.00';
    inputExtra.value = '0.00';
    document.getElementById('orderStatus').value = 'Pendente';
    
    // Altera rótulos conforme o tipo de produto padrão (Bolo de Kg)
    updateFormLabels('Bolo de Kg');
    populateFlavorSelect();
    calculateFormTotal();
    
    modal.classList.add('active');
  });

  // Fecha Modal
  const closeModal = () => {
    modal.classList.remove('active');
  };
  btnCloseX.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Calcula valor total ao alterar peso, preço ou adicionais
  [inputWeight, inputPrice, inputExtra].forEach(input => {
    input.addEventListener('input', calculateFormTotal);
  });

  // Adapta rótulos com base no tipo de produto
  selectType.addEventListener('change', () => {
    updateFormLabels(selectType.value);
    populateFlavorSelect();
    calculateFormTotal();
  });

  // Ao selecionar sabor rápido do catálogo
  selectFlavor.addEventListener('change', () => {
    const selectedId = selectFlavor.value;
    if (selectedId) {
      const item = state.catalog.find(c => c.id === selectedId);
      if (item) {
        inputFlavor.value = item.flavor;
        inputPrice.value = item.pricePerKg.toFixed(2);
        calculateFormTotal();
      }
    }
  });

  // Envio do formulário (Salvar Pedido)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const id = document.getElementById('orderIdInput').value;
    const clientName = document.getElementById('orderClientName').value.trim();
    const clientPhone = document.getElementById('orderClientPhone').value.trim();
    const productType = selectType.value;
    const flavor = inputFlavor.value.trim();
    const details = document.getElementById('orderDetails').value.trim();
    const weight = parseFloat(inputWeight.value) || 0;
    const unitPrice = parseFloat(inputPrice.value) || 0;
    const extraCharges = parseFloat(inputExtra.value) || 0;
    const deliveryDate = document.getElementById('orderDeliveryDate').value;
    const deliveryTime = document.getElementById('orderDeliveryTime').value;
    const status = document.getElementById('orderStatus').value;
    const notes = document.getElementById('orderNotes').value.trim();

    const totalValue = (weight * unitPrice) + extraCharges;

    if (id) {
      // Edição
      const idx = state.orders.findIndex(o => o.id === id);
      if (idx !== -1) {
        state.orders[idx] = {
          ...state.orders[idx],
          clientName, clientPhone, productType, flavor, details,
          weight, unitPrice, extraCharges, totalValue,
          deliveryDate, deliveryTime, status, notes
        };
      }
    } else {
      // Novo
      const newOrder = {
        id: 'o_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        clientName, clientPhone, productType, flavor, details,
        weight, unitPrice, extraCharges, totalValue,
        deliveryDate, deliveryTime, status, notes,
        createdAt: new Date().toISOString()
      };
      state.orders.push(newOrder);
    }

    saveOrders();
    closeModal();
    
    // Atualiza a tela correspondente
    const activeTab = document.querySelector('.nav-link.active').getAttribute('data-tab');
    if (activeTab === 'dashboard') updateDashboard();
    else if (activeTab === 'orders') renderOrdersTable();
    else if (activeTab === 'clients') renderClientsTable();
  });
}

function updateFormLabels(type) {
  const labelWeight = document.getElementById('labelWeight');
  const labelUnitPrice = document.getElementById('labelUnitPrice');
  const inputWeight = document.getElementById('orderWeight');
  
  if (type === 'Bolo de Kg') {
    labelWeight.textContent = 'Peso estimado (Kg) *';
    labelUnitPrice.textContent = 'Preço por Quilo (R$) *';
    inputWeight.step = '0.05';
  } else {
    labelWeight.textContent = 'Quantidade (Unidades) *';
    labelUnitPrice.textContent = 'Preço Unitário (R$) *';
    inputWeight.step = '1';
  }
}

function populateFlavorSelect() {
  const selectFlavor = document.getElementById('orderFlavorSelect');
  const productType = document.getElementById('orderProductType').value;
  
  selectFlavor.innerHTML = '<option value="">-- Personalizado / Escolher do Catálogo --</option>';
  
  // Filtra itens do catálogo com base no tipo de produto selecionado
  const filtered = state.catalog.filter(item => {
    if (productType === 'Bolo de Kg') return item.type === 'Bolo de Kg';
    return item.type !== 'Bolo de Kg'; // agrupa doces, salgados e outros
  });
  
  filtered.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = `${item.flavor} (R$ ${item.pricePerKg.toFixed(2)}${item.type === 'Bolo de Kg' ? '/Kg' : '/un'})`;
    selectFlavor.appendChild(opt);
  });
}

function calculateFormTotal() {
  const weight = parseFloat(document.getElementById('orderWeight').value) || 0;
  const price = parseFloat(document.getElementById('orderUnitPrice').value) || 0;
  const extra = parseFloat(document.getElementById('orderExtraCharges').value) || 0;
  
  const total = (weight * price) + extra;
  document.getElementById('orderTotalValDisplay').value = formatCurrency(total);
}

// LÓGICA DE DADOS DO DASHBOARD
function updateDashboard() {
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Filtra pedidos de hoje (não cancelados)
  const todayOrders = state.orders.filter(o => o.deliveryDate === todayStr && o.status !== 'Cancelado');
  
  // Soma faturamento de hoje
  const salesToday = todayOrders.reduce((sum, o) => sum + o.totalValue, 0);
  document.getElementById('kpiSalesToday').textContent = formatCurrency(salesToday);
  
  // Soma peso de hoje (para bolos por kg)
  const weightToday = todayOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
  document.getElementById('kpiWeightToday').textContent = weightToday.toFixed(1).replace('.', ',') + ' Kg';
  
  // Pedidos Pendentes e Em Produção (geral, independente do dia)
  const pendingOrders = state.orders.filter(o => o.status === 'Pendente' || o.status === 'Em Produção').length;
  document.getElementById('kpiPendingOrders').textContent = pendingOrders;

  // Faturamento Total acumulado de todo o período (excluindo cancelados)
  const totalEarnings = state.orders
    .filter(o => o.status !== 'Cancelado')
    .reduce((sum, o) => sum + o.totalValue, 0);
  document.getElementById('kpiTotalEarnings').textContent = formatCurrency(totalEarnings);

  // Calcula valores do dia no painel rápido de cálculo
  const dateInput = document.getElementById('calcDateInput');
  calculateDayTotals(dateInput.value);

  // Renderiza Entregas de Hoje
  renderTodayDeliveries();

  // Renderiza o Gráfico Canvas
  renderCanvasChart();
}

// Cálculo automático de pesos e valores para qualquer data
function calculateDayTotals(dateStr) {
  if (!dateStr) return;
  
  // Filtra todos os pedidos daquela data (exceto cancelados)
  const dayOrders = state.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
  
  const totalValue = dayOrders.reduce((sum, o) => sum + o.totalValue, 0);
  const totalWeight = dayOrders.reduce((sum, o) => sum + (o.weight || 0), 0);
  
  document.getElementById('calcDayValue').value = formatCurrency(totalValue);
  document.getElementById('calcDayWeight').value = totalWeight.toFixed(2).replace('.', ',') + ' Kg';
}

// Renderiza lista rápida de entregas de hoje no painel lateral do Dashboard
function renderTodayDeliveries() {
  const container = document.getElementById('todayDeliveriesList');
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Filtra pedidos de hoje ordenados por hora
  const todayOrders = state.orders
    .filter(o => o.deliveryDate === todayStr)
    .sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));
  
  if (todayOrders.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem 0;">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <h3>Nenhuma entrega para hoje</h3>
        <p style="font-size: 0.8rem;">Aproveite para criar novas encomendas.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  todayOrders.forEach(o => {
    const card = document.createElement('div');
    card.className = 'client-history-item';
    card.style.background = 'rgba(255, 255, 255, 0.02)';
    card.style.border = '1px solid var(--border-color)';
    card.style.padding = '0.75rem';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.gap = '0.5rem';

    let badgeClass = 'badge-pending';
    if (o.status === 'Em Produção') badgeClass = 'badge-progress';
    else if (o.status === 'Entregue') badgeClass = 'badge-success';
    else if (o.status === 'Cancelado') badgeClass = 'badge-danger';

    card.innerHTML = `
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
          <span style="font-weight: 700; font-size: 0.85rem; color: var(--color-accent-pink);">${o.deliveryTime}</span>
          <span class="customer-name" style="font-size: 0.9rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; max-width: 120px;">${o.clientName}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          ${o.flavor} (${o.weight.toFixed(1).replace('.', ',')} Kg)
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.35rem;">
        <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 0.15rem 0.5rem;">${o.status}</span>
        <span style="font-weight: 700; font-size: 0.85rem; color: white;">${formatCurrency(o.totalValue)}</span>
      </div>
    `;
    
    // Adiciona evento de clique para visualizar/editar o pedido ao clicar no card
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      openEditOrderModal(o.id);
    });

    container.appendChild(card);
  });
}

// GERADOR GRÁFICO CANVAS AUTORAL (100% Offline)
function renderCanvasChart() {
  const canvas = document.getElementById('salesChart');
  if (!canvas) return;

  const periodSelect = document.getElementById('chartPeriodSelect');
  const daysLimit = periodSelect.value === '7days' ? 7 : 30;

  // 1. Gera datas retroativas para montar o eixo X
  const dataPoints = [];
  const today = new Date();
  
  for (let i = daysLimit - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    // Filtra vendas deste dia específico
    const dayOrders = state.orders.filter(o => o.deliveryDate === dateStr && o.status !== 'Cancelado');
    const totalSales = dayOrders.reduce((sum, o) => sum + o.totalValue, 0);
    const ordersCount = dayOrders.length;
    
    dataPoints.push({
      dateDisplay: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      sales: totalSales,
      count: ordersCount
    });
  }

  // 2. Setup dimensões e escalonamento para telas retina/HD (evitar borrão)
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  
  // Margens internas
  const paddingLeft = 45;
  const paddingRight = 40;
  const paddingTop = 25;
  const paddingBottom = 30;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;

  // Limpa o canvas
  ctx.clearRect(0, 0, w, h);

  // Calcula valores máximos para escalar
  let maxSales = Math.max(...dataPoints.map(p => p.sales), 100); // Garante escala mínima de 100
  let maxCount = Math.max(...dataPoints.map(p => p.count), 5);  // Garante escala mínima de 5
  
  // Arredonda máximos para divisões bonitas
  maxSales = Math.ceil(maxSales / 50) * 50;
  maxCount = Math.ceil(maxCount / 5) * 5;

  // 3. Desenha Linhas de Grade e Eixo Y (Faturamento e Contagem)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280'; // Cor do texto de legenda de eixo
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const gridDivisions = 4;
  for (let i = 0; i <= gridDivisions; i++) {
    const ratio = i / gridDivisions;
    const y = paddingTop + chartH * (1 - ratio);
    
    // Linha horizontal
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();

    // Rótulo Y Esquerdo (Faturamento R$)
    const salesVal = maxSales * ratio;
    ctx.fillText(`R$ ${Math.round(salesVal)}`, paddingLeft - 8, y);

    // Rótulo Y Direito (Pedidos Un)
    const countVal = maxCount * ratio;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(countVal)} ped`, w - paddingRight + 8, y);
    ctx.textAlign = 'right';
  }

  // 4. Desenha Rótulos do Eixo X (Datas)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  // Para 30 dias, desenha a cada 5 dias para não amontoar
  const stepLabel = daysLimit === 30 ? 5 : 1;
  dataPoints.forEach((pt, idx) => {
    if (idx % stepLabel === 0 || idx === dataPoints.length - 1) {
      const ratio = idx / (dataPoints.length - 1);
      const x = paddingLeft + chartW * ratio;
      ctx.fillText(pt.dateDisplay, x, h - paddingBottom + 8);
    }
  });

  // 5. Desenha o Gráfico de Faturamento (Linha Rosa com Gradiente)
  const getSalesXY = (pt, idx) => {
    const ratioX = idx / (dataPoints.length - 1);
    const ratioY = pt.sales / maxSales;
    return {
      x: paddingLeft + chartW * ratioX,
      y: paddingTop + chartH * (1 - ratioY)
    };
  };

  // Traçado da Linha de Vendas
  ctx.beginPath();
  dataPoints.forEach((pt, idx) => {
    const pos = getSalesXY(pt, idx);
    if (idx === 0) ctx.moveTo(pos.x, pos.y);
    else ctx.lineTo(pos.x, pos.y);
  });
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(236, 72, 153, 0.4)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0; // Desativa sombra para outros desenhos

  // Área preenchida sob a linha de Vendas (Efeito Glow)
  ctx.beginPath();
  dataPoints.forEach((pt, idx) => {
    const pos = getSalesXY(pt, idx);
    if (idx === 0) ctx.moveTo(pos.x, h - paddingBottom);
    ctx.lineTo(pos.x, pos.y);
    if (idx === dataPoints.length - 1) ctx.lineTo(pos.x, h - paddingBottom);
  });
  ctx.closePath();
  
  const grad = ctx.createLinearGradient(0, paddingTop, 0, h - paddingBottom);
  grad.addColorStop(0, 'rgba(236, 72, 153, 0.2)');
  grad.addColorStop(1, 'rgba(236, 72, 153, 0.0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 6. Desenha o Gráfico de Quantidade de Pedidos (Linha Roxa)
  const getCountXY = (pt, idx) => {
    const ratioX = idx / (dataPoints.length - 1);
    const ratioY = pt.count / maxCount;
    return {
      x: paddingLeft + chartW * ratioX,
      y: paddingTop + chartH * (1 - ratioY)
    };
  };

  ctx.beginPath();
  dataPoints.forEach((pt, idx) => {
    const pos = getCountXY(pt, idx);
    if (idx === 0) ctx.moveTo(pos.x, pos.y);
    else ctx.lineTo(pos.x, pos.y);
  });
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 7. Desenha Pontos e Destaques (Marcadores redondos)
  dataPoints.forEach((pt, idx) => {
    const posSales = getSalesXY(pt, idx);
    const posCount = getCountXY(pt, idx);
    
    // Apenas desenha marcadores principais ou se tiver valor para não sobrecarregar
    if (pt.sales > 0 || daysLimit <= 7) {
      ctx.fillStyle = '#ec4899';
      ctx.beginPath();
      ctx.arc(posSales.x, posSales.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(posSales.x, posSales.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (pt.count > 0 || daysLimit <= 7) {
      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      ctx.arc(posCount.x, posCount.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// TABELA DE PEDIDOS
function renderOrdersTable() {
  const tbody = document.getElementById('ordersTableBody');
  const searchInput = document.getElementById('orderSearchInput').value.toLowerCase();
  const filterStatus = document.getElementById('orderFilterStatus').value;
  const filterDate = document.getElementById('orderFilterDate').value;
  const emptyState = document.getElementById('ordersEmptyState');

  // Filtra pedidos conforme critérios da tela
  const filteredOrders = state.orders.filter(o => {
    const matchesSearch = o.clientName.toLowerCase().includes(searchInput) || 
                          o.flavor.toLowerCase().includes(searchInput) ||
                          (o.clientPhone && o.clientPhone.includes(searchInput)) ||
                          (o.productType && o.productType.toLowerCase().includes(searchInput));
                          
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    const matchesDate = !filterDate || o.deliveryDate === filterDate;

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Ordena por data de entrega (mais recente primeiro) e depois por hora
  filteredOrders.sort((a, b) => {
    const dateComp = b.deliveryDate.localeCompare(a.deliveryDate);
    if (dateComp !== 0) return dateComp;
    return b.deliveryTime.localeCompare(a.deliveryTime);
  });

  if (filteredOrders.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'flex';
    document.getElementById('ordersTable').style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  document.getElementById('ordersTable').style.display = 'table';
  
  tbody.innerHTML = '';
  filteredOrders.forEach(o => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-pending';
    if (o.status === 'Em Produção') badgeClass = 'badge-progress';
    else if (o.status === 'Entregue') badgeClass = 'badge-success';
    else if (o.status === 'Cancelado') badgeClass = 'badge-danger';

    const formattedWeight = o.productType === 'Bolo de Kg' ? `${o.weight.toFixed(2).replace('.', ',')} Kg` : `${Math.round(o.weight)} un`;

    tr.innerHTML = `
      <td>
        <div class="customer-info-box">
          <span class="customer-name">${escapeHTML(o.clientName)}</span>
          <span class="customer-phone">${escapeHTML(o.clientPhone || 'Sem telefone')}</span>
        </div>
      </td>
      <td>
        <div style="font-weight: 600; color: white;">
          ${escapeHTML(o.flavor)} 
          <span style="font-weight: normal; font-size: 0.75rem; color: var(--color-accent-pink); background: rgba(236,72,153,0.1); padding: 0.1rem 0.4rem; border-radius: 4px; margin-left: 0.25rem;">
            ${escapeHTML(o.productType)}
          </span>
        </div>
        ${o.details ? `<div class="product-desc">${escapeHTML(o.details)}</div>` : ''}
        ${o.notes ? `<div style="font-size: 0.75rem; color: var(--color-warning); margin-top: 0.2rem;">Obs: ${escapeHTML(o.notes)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 500;">${formatDateString(o.deliveryDate)}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">${o.deliveryTime}</div>
      </td>
      <td class="text-right" style="font-weight: 500;">${formattedWeight}</td>
      <td class="text-right" style="font-weight: 700; color: var(--color-accent-pink);">${formatCurrency(o.totalValue)}</td>
      <td class="text-center">
        <span class="badge ${badgeClass}">${o.status}</span>
      </td>
      <td class="text-center">
        <div style="display: flex; gap: 0.4rem; justify-content: center;">
          <button class="btn btn-secondary btn-icon-only btn-edit" title="Editar Pedido" style="padding: 0.4rem;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          
          <button class="btn btn-secondary btn-icon-only btn-status-next" title="Próximo Status" style="padding: 0.4rem; color: var(--color-success); border-color: rgba(16, 185, 129, 0.2);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </button>

          <button class="btn btn-secondary btn-icon-only btn-delete" title="Excluir" style="padding: 0.4rem; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </td>
    `;

    // Ações dos botões
    tr.querySelector('.btn-edit').addEventListener('click', () => openEditOrderModal(o.id));
    tr.querySelector('.btn-delete').addEventListener('click', () => deleteOrder(o.id));
    tr.querySelector('.btn-status-next').addEventListener('click', () => advanceOrderStatus(o.id));

    tbody.appendChild(tr);
  });

  // Configuração dos Inputs de Filtros
  const searchInputEl = document.getElementById('orderSearchInput');
  const filterStatusEl = document.getElementById('orderFilterStatus');
  const filterDateEl = document.getElementById('orderFilterDate');
  const btnClearFilters = document.getElementById('btnClearFilters');

  // Remove listeners anteriores antes de recriar
  const cleanInput = () => {
    renderOrdersTable();
  };
  
  if(!searchInputEl.dataset.hasListener) {
    searchInputEl.addEventListener('input', cleanInput);
    filterStatusEl.addEventListener('change', cleanInput);
    filterDateEl.addEventListener('change', cleanInput);
    
    btnClearFilters.addEventListener('click', () => {
      searchInputEl.value = '';
      filterStatusEl.value = 'all';
      filterDateEl.value = '';
      renderOrdersTable();
    });
    
    searchInputEl.dataset.hasListener = 'true';
  }
}

function openEditOrderModal(id) {
  const o = state.orders.find(item => item.id === id);
  if (!o) return;

  const modal = document.getElementById('orderModal');
  const form = document.getElementById('orderForm');
  
  document.getElementById('orderIdInput').value = o.id;
  document.getElementById('modalOrderTitleText').textContent = 'Editar Encomenda';

  document.getElementById('orderClientName').value = o.clientName;
  document.getElementById('orderClientPhone').value = o.clientPhone || '';
  document.getElementById('orderProductType').value = o.productType || 'Bolo de Kg';
  
  updateFormLabels(o.productType || 'Bolo de Kg');
  populateFlavorSelect();

  document.getElementById('orderFlavor').value = o.flavor;
  document.getElementById('orderDetails').value = o.details || '';
  document.getElementById('orderWeight').value = o.weight;
  document.getElementById('orderUnitPrice').value = o.unitPrice;
  document.getElementById('orderExtraCharges').value = o.extraCharges || 0;
  document.getElementById('orderDeliveryDate').value = o.deliveryDate;
  document.getElementById('orderDeliveryTime').value = o.deliveryTime;
  document.getElementById('orderStatus').value = o.status;
  document.getElementById('orderNotes').value = o.notes || '';

  calculateFormTotal();

  modal.classList.add('active');
}

function deleteOrder(id) {
  if (confirm('Tem certeza que deseja excluir esta encomenda permanentemente?')) {
    state.orders = state.orders.filter(o => o.id !== id);
    saveOrders();
    renderOrdersTable();
  }
}

function advanceOrderStatus(id) {
  const idx = state.orders.findIndex(o => o.id === id);
  if (idx === -1) return;
  
  const statusCycle = ['Pendente', 'Em Produção', 'Entregue'];
  const currentStatus = state.orders[idx].status;
  const currentIdx = statusCycle.indexOf(currentStatus);
  
  if (currentIdx !== -1 && currentIdx < statusCycle.length - 1) {
    state.orders[idx].status = statusCycle[currentIdx + 1];
    saveOrders();
    renderOrdersTable();
  } else if (currentStatus === 'Entregue') {
    alert('Esta encomenda já foi entregue.');
  } else if (currentStatus === 'Cancelado') {
    state.orders[idx].status = 'Pendente';
    saveOrders();
    renderOrdersTable();
  }
}

// BANCO DE CLIENTES
function renderClientsTable() {
  const tbody = document.getElementById('clientsTableBody');
  const searchInput = document.getElementById('clientSearchInput').value.toLowerCase();
  const emptyState = document.getElementById('clientsEmptyState');

  // 1. Agrupa pedidos por nome/telefone de cliente
  const clientMap = {};
  
  state.orders.forEach(o => {
    // Normaliza chave de busca baseada em telefone se existir, senão no nome
    const key = o.clientPhone ? `${o.clientName.trim()}_${o.clientPhone.trim()}` : o.clientName.trim();
    
    if (!clientMap[key]) {
      clientMap[key] = {
        name: o.clientName,
        phone: o.clientPhone || 'Sem telefone',
        totalOrders: 0,
        totalSpent: 0,
        ordersList: []
      };
    }
    
    clientMap[key].totalOrders++;
    if (o.status !== 'Cancelado') {
      clientMap[key].totalSpent += o.totalValue;
    }
    clientMap[key].ordersList.push(o);
  });

  const clients = Object.values(clientMap);

  // 2. Filtra baseado no input de pesquisa
  const filteredClients = clients.filter(c => {
    return c.name.toLowerCase().includes(searchInput) || c.phone.includes(searchInput);
  });

  // Ordena por maior faturamento primeiro
  filteredClients.sort((a, b) => b.totalSpent - a.totalSpent);

  if (filteredClients.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'flex';
    tbody.closest('table').style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  tbody.closest('table').style.display = 'table';
  tbody.innerHTML = '';

  filteredClients.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span style="font-weight: 700; color: white;">${escapeHTML(c.name)}</span>
      </td>
      <td>${escapeHTML(c.phone)}</td>
      <td class="text-center" style="font-weight: 500;">${c.totalOrders}</td>
      <td class="text-right" style="font-weight: 700; color: var(--color-accent-pink);">${formatCurrency(c.totalSpent)}</td>
      <td class="text-center">
        <button class="btn btn-secondary btn-icon-only btn-view-history" title="Ver Histórico de Pedidos" style="padding: 0.4rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
      </td>
    `;

    tr.querySelector('.btn-view-history').addEventListener('click', () => {
      openClientHistoryModal(c);
    });

    tbody.appendChild(tr);
  });

  // Listener para busca de cliente
  const searchInputEl = document.getElementById('clientSearchInput');
  if(!searchInputEl.dataset.hasListener) {
    searchInputEl.addEventListener('input', () => {
      renderClientsTable();
    });
    searchInputEl.dataset.hasListener = 'true';
  }
}

function openClientHistoryModal(client) {
  const modal = document.getElementById('clientModal');
  document.getElementById('clientDetailName').textContent = client.name;
  document.getElementById('clientDetailPhone').textContent = `Telefone: ${client.phone}`;
  document.getElementById('clientDetailOrdersCount').textContent = client.totalOrders;
  document.getElementById('clientDetailSpent').textContent = formatCurrency(client.totalSpent);

  const historyList = document.getElementById('clientOrdersHistoryList');
  historyList.innerHTML = '';

  // Ordena histórico por data de entrega (mais nova primeiro)
  const sortedHistory = [...client.ordersList].sort((a,b) => b.deliveryDate.localeCompare(a.deliveryDate));

  sortedHistory.forEach(o => {
    const item = document.createElement('div');
    item.className = 'client-history-item';
    
    let badgeClass = 'badge-pending';
    if (o.status === 'Em Produção') badgeClass = 'badge-progress';
    else if (o.status === 'Entregue') badgeClass = 'badge-success';
    else if (o.status === 'Cancelado') badgeClass = 'badge-danger';

    item.innerHTML = `
      <div>
        <div style="font-weight: 700; font-size: 0.9rem; color: white;">
          ${escapeHTML(o.flavor)}
          <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;"> (${o.productType})</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem;">
          Entrega: ${formatDateString(o.deliveryDate)} às ${o.deliveryTime}
        </div>
      </div>
      <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
        <span class="badge ${badgeClass}" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${o.status}</span>
        <strong style="color: var(--color-accent-pink); font-size: 0.9rem;">${formatCurrency(o.totalValue)}</strong>
      </div>
    `;

    historyList.appendChild(item);
  });

  const closeBtn = document.getElementById('btnModalClientClose');
  const footerCloseBtn = document.getElementById('btnModalClientCloseBtn');
  
  const closeClientModal = () => {
    modal.classList.remove('active');
  };
  
  closeBtn.onclick = closeClientModal;
  footerCloseBtn.onclick = closeClientModal;

  modal.classList.add('active');
}

// ABAS DE CONFIGURAÇÃO (CATÁLOGO DE SABORES)
function renderCatalogSettings() {
  const container = document.getElementById('catalogListContainer');
  container.innerHTML = '';

  state.catalog.forEach(item => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '0.5rem';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
    row.style.gap = '0.5rem';

    row.innerHTML = `
      <div style="flex: 1;">
        <span style="font-weight: 600; font-size: 0.9rem; color: white;">${escapeHTML(item.flavor)}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">${item.type}</span>
      </div>
      <div style="font-weight: 700; color: var(--color-accent-pink); font-size: 0.9rem; margin-right: 0.5rem;">
        R$ ${item.pricePerKg.toFixed(2)}${item.type === 'Bolo de Kg' ? '/Kg' : '/un'}
      </div>
      <button class="btn btn-secondary btn-icon-only btn-delete-catalog" title="Excluir" style="padding: 0.3rem; color: var(--color-danger); border-color: rgba(239, 68, 68, 0.2);">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    `;

    row.querySelector('.btn-delete-catalog').addEventListener('click', () => {
      state.catalog = state.catalog.filter(c => c.id !== item.id);
      saveCatalog();
      renderCatalogSettings();
    });

    container.appendChild(row);
  });
}

function addCatalogItem() {
  const inputFlavor = document.getElementById('newCatalogFlavor');
  const inputPrice = document.getElementById('newCatalogPrice');

  const flavor = inputFlavor.value.trim();
  const price = parseFloat(inputPrice.value) || 0;

  if (!flavor || price <= 0) {
    alert('Preencha o sabor e um preço válido maior que zero.');
    return;
  }

  const newItem = {
    id: 'cat_' + Date.now(),
    flavor,
    pricePerKg: price,
    type: 'Bolo de Kg' // assume Bolo de Kg como padrão do catálogo rápido
  };

  state.catalog.push(newItem);
  saveCatalog();
  
  inputFlavor.value = '';
  inputPrice.value = '';
  
  renderCatalogSettings();
}

// BACKUP & EXPORT/IMPORT (100% Offline via JSON)
function exportDataJSON() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  link.download = `backup_fyntex_confeitaria_${dateStr}.json`;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importDataJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      
      if (imported.orders && Array.isArray(imported.orders)) {
        state.orders = imported.orders;
        if (imported.catalog && Array.isArray(imported.catalog)) {
          state.catalog = imported.catalog;
        }
        
        saveOrders();
        saveCatalog();
        alert('Dados importados com sucesso!');
        
        // Recarrega aba ativa
        const activeTab = document.querySelector('.nav-link.active').getAttribute('data-tab');
        if (activeTab === 'dashboard') updateDashboard();
        else if (activeTab === 'orders') renderOrdersTable();
        else if (activeTab === 'clients') renderClientsTable();
        else if (activeTab === 'settings') renderCatalogSettings();
      } else {
        alert('Formato de arquivo inválido. Não foi possível carregar os dados.');
      }
    } catch(err) {
      alert('Erro ao decodificar o arquivo de backup.');
    }
  };
  reader.readAsText(file);
}

// GERADOR DE DADOS DEMONSTRATIVOS (TESTES E APRESENTAÇÃO)
function loadDemoData(force = false) {
  if (!force && state.orders.length > 0) return;

  const baseCatalog = [
    { id: '1', flavor: 'Bolo Ninho com Morango', pricePerKg: 75.00, type: 'Bolo de Kg' },
    { id: '2', flavor: 'Bolo Chocolate Belga', pricePerKg: 80.00, type: 'Bolo de Kg' },
    { id: '3', flavor: 'Bolo Red Velvet', pricePerKg: 90.00, type: 'Bolo de Kg' },
    { id: '4', flavor: 'Bolo Prestígio', pricePerKg: 70.00, type: 'Bolo de Kg' },
    { id: '5', flavor: 'Cento de Brigadeiros Goumert', pricePerKg: 120.00, type: 'Doces / Brigadeiros' },
    { id: '6', flavor: 'Cento de Salgados Fritos', pricePerKg: 100.00, type: 'Salgados' }
  ];
  
  state.catalog = baseCatalog;
  saveCatalog();

  const names = ['Ana Costa', 'Carlos Silva', 'Beatriz Lima', 'Daniel Souza', 'Mariana Santos', 'Juliana Rocha', 'Pedro Albuquerque'];
  const phones = ['(11) 98888-7777', '(11) 97777-6666', '(21) 96666-5555', '(31) 95555-4444', '(11) 94444-3333', '(11) 93333-2222', '(11) 92222-1111'];
  
  const demoOrders = [];
  const today = new Date();

  // Cria 14 pedidos espalhados pelos últimos 10 dias + hoje + amanhã
  const dataOffsets = [0, 0, -1, -1, -2, -3, -4, -5, -6, -7, -8, -9, 1, -3];
  const flavors = [
    { name: 'Bolo Ninho com Morango', price: 75.00, type: 'Bolo de Kg', w: 2.0 },
    { name: 'Bolo Chocolate Belga', price: 80.00, type: 'Bolo de Kg', w: 1.5 },
    { name: 'Bolo Red Velvet', price: 90.00, type: 'Bolo de Kg', w: 1.8 },
    { name: 'Cento de Brigadeiros Goumert', price: 120.00, type: 'Doces / Brigadeiros', w: 1 },
    { name: 'Bolo Prestígio', price: 70.00, type: 'Bolo de Kg', w: 2.5 },
    { name: 'Cento de Salgados Fritos', price: 100.00, type: 'Salgados', w: 2 }
  ];

  dataOffsets.forEach((offset, idx) => {
    const d = new Date();
    d.setDate(today.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    
    const clientIdx = idx % names.length;
    const flavorObj = flavors[idx % flavors.length];
    
    const weight = flavorObj.w;
    const unitPrice = flavorObj.price;
    const extraCharges = (idx % 3 === 0) ? 15.00 : 0.00; // Algumas entregas têm taxa
    const totalValue = (weight * unitPrice) + extraCharges;
    
    let status = 'Entregue';
    if (offset >= 0) {
      status = (idx % 2 === 0) ? 'Pendente' : 'Em Produção';
    }

    demoOrders.push({
      id: 'o_demo_' + idx,
      clientName: names[clientIdx],
      clientPhone: phones[clientIdx],
      productType: flavorObj.type,
      flavor: flavorObj.name,
      details: flavorObj.type === 'Bolo de Kg' ? 'Recheio tradicional, decoração clean' : 'Embalagem para presente',
      weight,
      unitPrice,
      extraCharges,
      totalValue,
      deliveryDate: dateStr,
      deliveryTime: `1${idx % 8}:00`,
      status,
      notes: idx % 4 === 0 ? 'Retirada no local' : 'Entregar em mãos',
      createdAt: new Date(d.getTime() - 86400000).toISOString()
    });
  });

  state.orders = demoOrders;
  saveOrders();
}

// UTILITÁRIOS E AUXILIARES
function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateString(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
