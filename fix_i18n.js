const fs = require('fs');
let js = fs.readFileSync('js/app.js', 'utf8');

const oldTabTitles = `    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' },
    notificacoes: { title: 'notif.settingsTitle', subtitle: 'notif.settingsDesc' },
    mercadopago: { title: 'mp.settingsTitle', subtitle: 'mp.settingsDesc' },
    plano: { title: 'plan.settingsTitle', subtitle: 'plan.settingsDesc' }
  };`;

const newTabTitles = `    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' },
    notificacoes: { title: 'settings.notifTitle', subtitle: 'settings.notifDesc' },
    mercadopago: { title: 'mp.settingsTitle', subtitle: 'mp.settingsDesc' },
    plano: { title: 'plan.settingsTitle', subtitle: 'plan.settingsDesc' }
  };`;

js = js.replace(oldTabTitles, newTabTitles);
fs.writeFileSync('js/app.js', js, 'utf8');
console.log('js/app.js tab titles updated');
