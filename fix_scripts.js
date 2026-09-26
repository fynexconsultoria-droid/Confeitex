const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script defer src="js\/.*?\.js\?v=.*?"><\/script>\r?\n\s*/g, '');
fs.writeFileSync('index.html', html);
console.log('Fixed scripts in index.html');
