const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update right sidebar links
html = html.replace('class="right-sidebar-link" data-target="card-config-geral"', 'class="right-sidebar-link nav-link" data-tab="settings"');
html = html.replace('class="right-sidebar-link" data-target="card-updates"', 'class="right-sidebar-link nav-link" data-tab="updates"');
html = html.replace('class="right-sidebar-link" data-target="card-notificacoes"', 'class="right-sidebar-link nav-link" data-tab="notificacoes"');
html = html.replace('class="right-sidebar-link" data-target="card-mercadopago"', 'class="right-sidebar-link nav-link" data-tab="mercadopago"');
html = html.replace('class="right-sidebar-link" data-target="card-plano"', 'class="right-sidebar-link nav-link" data-tab="plano"');

function extractCard(startMarker, endMarker) {
    let start = html.indexOf(startMarker);
    if (start === -1) return '';
    let end = html.indexOf(endMarker, start);
    if (end === -1) end = html.indexOf('<!--', start + 10);
    if (end === -1) return '';
    let card = html.substring(start, end);
    html = html.substring(0, start) + html.substring(end);
    return card;
}

const notifCard = extractCard('<!-- Notifications Card -->', '<!-- Plan & Subscription Card -->');
const planCard = extractCard('<!-- Plan & Subscription Card -->', '<!-- Mercado Pago Config Card -->');
const mpCard = extractCard('<!-- Mercado Pago Config Card -->', '<!-- Security Card -->');
const updatesCard = extractCard('<!-- Updates & System Info Card -->', '<!-- Advanced / Danger Zone -->');

const newTabs = `
      <!-- TAB: NOTIFICAÇÕES -->
      <section id="notificacoes" class="tab-content">
        <div class="config-grid">
          ${notifCard}
        </div>
      </section>

      <!-- TAB: PLANO -->
      <section id="plano" class="tab-content">
        <div class="config-grid">
          ${planCard}
        </div>
      </section>

      <!-- TAB: MERCADO PAGO -->
      <section id="mercadopago" class="tab-content">
        <div class="config-grid">
          ${mpCard}
        </div>
      </section>

      <!-- TAB: UPDATES -->
      <section id="updates" class="tab-content">
        <div class="config-grid">
          ${updatesCard}
        </div>
      </section>
`;

html = html.replace('</main>', newTabs + '\n    </main>');

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html updated successfully');
