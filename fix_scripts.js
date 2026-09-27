const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Update right sidebar links
html = html.replace('class="right-sidebar-link" data-target="card-config-geral"', 'class="right-sidebar-link nav-link" data-tab="settings"');
html = html.replace('class="right-sidebar-link" data-target="card-updates"', 'class="right-sidebar-link nav-link" data-tab="updates"');
html = html.replace('class="right-sidebar-link" data-target="card-notificacoes"', 'class="right-sidebar-link nav-link" data-tab="notificacoes"');
html = html.replace('class="right-sidebar-link" data-target="card-mercadopago"', 'class="right-sidebar-link nav-link" data-tab="mercadopago"');
html = html.replace('class="right-sidebar-link" data-target="card-plano"', 'class="right-sidebar-link nav-link" data-tab="plano"');

// The original settings section has all cards. We want to separate them.
// Order of cards in index.html inside <section id="settings" class="tab-content"><div class="config-grid">:
// 1. Language
// 2. Catalog
// 3. Data
// 4. Notifications (starts with <!-- Notifications Card -->)
// 5. Plan (starts with <!-- Plan & Subscription Card -->)
// 6. MP (starts with <!-- Mercado Pago Config Card -->)
// 7. Security (starts with <!-- Security Card -->)
// 8. Updates (starts with <!-- Updates & System Info Card -->)
// 9. Advanced (starts with <!-- Advanced / Danger Zone -->)

// Let's reorganize so "settings" keeps Language, Catalog, Data, Security, Advanced.
// Wait, Security and Advanced are at the end, after MP and Updates.
// To do this, we can wrap each group in its own section.

// We can do this cleanly by replacing the comment delimiters.
html = html.replace('<!-- Notifications Card -->', '</section>\n\n<section id="notificacoes" class="tab-content">\n<div class="config-grid">\n<!-- Notifications Card -->');

html = html.replace('<!-- Plan & Subscription Card -->', '</div>\n</section>\n\n<section id="plano" class="tab-content">\n<div class="config-grid">\n<!-- Plan & Subscription Card -->');

html = html.replace('<!-- Mercado Pago Config Card -->', '</div>\n</section>\n\n<section id="mercadopago" class="tab-content">\n<div class="config-grid">\n<!-- Mercado Pago Config Card -->');

html = html.replace('<!-- Security Card -->', '</div>\n</section>\n\n<!-- Back to Settings Tab -->\n<section id="settings-security" class="tab-content">\n<div class="config-grid">\n<!-- Security Card -->');

html = html.replace('<!-- Updates & System Info Card -->', '</div>\n</section>\n\n<section id="updates" class="tab-content">\n<div class="config-grid">\n<!-- Updates & System Info Card -->');

html = html.replace('<!-- Advanced / Danger Zone -->', '</div>\n</section>\n\n<section id="settings-advanced" class="tab-content">\n<div class="config-grid">\n<!-- Advanced / Danger Zone -->');

// Note that Security and Advanced would now be their own tabs "settings-security" and "settings-advanced", which is not what we want.
// We want them to remain in the "settings" tab. But since they are interspersed, it's easier to just move them.
// Let's instead write a script to move the cards.
