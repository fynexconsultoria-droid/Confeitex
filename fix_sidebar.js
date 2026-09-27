const fs = require('fs');

let updates = fs.readFileSync('js/updates.js', 'utf8');
updates = updates.replace(
  "    const sidebarVersion = document.getElementById('sidebarVersion');\n    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;",
  "    const sidebarVersion = document.getElementById('sidebarVersion');\n    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;\n    const rightSidebarVersion = document.getElementById('rightSidebarVersion');\n    if (rightSidebarVersion) rightSidebarVersion.textContent = `v${displayVer}`;"
);
updates = updates.replace(
  "    const sidebarVersion = document.getElementById('sidebarVersion');\r\n    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;",
  "    const sidebarVersion = document.getElementById('sidebarVersion');\r\n    if (sidebarVersion) sidebarVersion.textContent = `v${displayVer}`;\r\n    const rightSidebarVersion = document.getElementById('rightSidebarVersion');\r\n    if (rightSidebarVersion) rightSidebarVersion.textContent = `v${displayVer}`;"
);
fs.writeFileSync('js/updates.js', updates, 'utf8');

let app = fs.readFileSync('js/app.js', 'utf8');
app = app.replace(
  "  const sidebarVersion = document.getElementById('sidebarVersion');\n  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;",
  "  const sidebarVersion = document.getElementById('sidebarVersion');\n  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;\n  const rightSidebarVersion = document.getElementById('rightSidebarVersion');\n  if (rightSidebarVersion && typeof Updates !== 'undefined') rightSidebarVersion.textContent = `v${Updates.verAtual}`;"
);
app = app.replace(
  "  const sidebarVersion = document.getElementById('sidebarVersion');\r\n  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;",
  "  const sidebarVersion = document.getElementById('sidebarVersion');\r\n  if (sidebarVersion && typeof Updates !== 'undefined') sidebarVersion.textContent = `v${Updates.verAtual}`;\r\n  const rightSidebarVersion = document.getElementById('rightSidebarVersion');\r\n  if (rightSidebarVersion && typeof Updates !== 'undefined') rightSidebarVersion.textContent = `v${Updates.verAtual}`;"
);
fs.writeFileSync('js/app.js', app, 'utf8');

console.log("Updated both files.");
