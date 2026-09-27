const fs = require('fs');
let js = fs.readFileSync('js/app.js', 'utf8');

// Update tabTitles
const oldTabTitles = `    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' }
  };`;
const newTabTitles = `    updates: { title: 'tab.updates.title', subtitle: 'tab.updates.sub' },
    notificacoes: { title: 'notif.settingsTitle', subtitle: 'notif.settingsDesc' },
    mercadopago: { title: 'mp.settingsTitle', subtitle: 'mp.settingsDesc' },
    plano: { title: 'plan.settingsTitle', subtitle: 'plan.settingsDesc' }
  };`;
js = js.replace(oldTabTitles, newTabTitles);

// Update switchTab function logic for the new tabs (if any specific init is needed, but mostly they don't need init or it's handled by settings/updates rendering).
// Let's replace the .right-sidebar-link listener logic, since we added the nav-link class, it will be automatically handled by the nav-link listener at line 201:
/*
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });
*/

// So we can remove the entire .right-sidebar-link block!
const oldRightSidebarBlockStart = `document.querySelectorAll('.right-sidebar-link').forEach(link => {`;
const oldRightSidebarBlockEnd = `      }
    });
  });`;

let startIdx = js.indexOf(oldRightSidebarBlockStart);
if (startIdx !== -1) {
    let endIdx = js.indexOf(oldRightSidebarBlockEnd, startIdx) + oldRightSidebarBlockEnd.length;
    
    // Instead of completely removing, let's just make it call closeRight() since switchTab is handled by nav-link
    // Wait! In index.html, we added the class 'nav-link' to the right sidebar links, so they WILL trigger the switchTab automatically!
    // But we need to make sure closeRight() is called. The easiest way is to add a click listener to all right-sidebar-links that just closes it.
    
    const newBlock = `document.querySelectorAll('.right-sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      closeRight();
    });
  });`;
  
    js = js.substring(0, startIdx) + newBlock + js.substring(endIdx);
}

fs.writeFileSync('js/app.js', js, 'utf8');
console.log('js/app.js updated successfully');
