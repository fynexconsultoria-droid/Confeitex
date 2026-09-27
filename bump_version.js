const fs = require('fs');

let updates = fs.readFileSync('js/updates.js', 'utf8');
updates = updates.replace(
  "  changelog: [\r\n    { ver: '0.1.2-beta', date: '26/09/2026', keys: ['changelog.012beta'] },\r\n    { ver: '0.1.0-beta', date: '26/09/2026', keys: ['changelog.010beta'] }\r\n  ],",
  "  changelog: [\r\n    { ver: '0.1.3-beta', date: '27/09/2026', keys: ['changelog.013beta'] },\r\n    { ver: '0.1.2-beta', date: '26/09/2026', keys: ['changelog.012beta'] },\r\n    { ver: '0.1.0-beta', date: '26/09/2026', keys: ['changelog.010beta'] }\r\n  ],"
);
// Also fallback for LF instead of CRLF
updates = updates.replace(
  "  changelog: [\n    { ver: '0.1.2-beta', date: '26/09/2026', keys: ['changelog.012beta'] },\n    { ver: '0.1.0-beta', date: '26/09/2026', keys: ['changelog.010beta'] }\n  ],",
  "  changelog: [\n    { ver: '0.1.3-beta', date: '27/09/2026', keys: ['changelog.013beta'] },\n    { ver: '0.1.2-beta', date: '26/09/2026', keys: ['changelog.012beta'] },\n    { ver: '0.1.0-beta', date: '26/09/2026', keys: ['changelog.010beta'] }\n  ],"
);

// and update _CODE_VERSION
updates = updates.replace("_CODE_VERSION: '0.1.2-beta'", "_CODE_VERSION: '0.1.3-beta'");
fs.writeFileSync('js/updates.js', updates, 'utf8');

fs.writeFileSync('version.txt', '0.1.3-beta', 'utf8');

let i18n = fs.readFileSync('js/i18n.js', 'utf8');
i18n = i18n.replace(
  "'changelog.012beta': 'Layout mais rápido e correções em botões.',",
  "'changelog.013beta': 'Sistema de atualizações refatorado. Módulos de configurações separados.',\n      'changelog.012beta': 'Layout mais rápido e correções em botões.',"
);
fs.writeFileSync('js/i18n.js', i18n, 'utf8');
