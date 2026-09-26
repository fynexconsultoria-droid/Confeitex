const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// Limpa o diretório dist se existir
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);
fs.mkdirSync(path.join(distDir, 'js'));

async function build() {
  console.log('Iniciando o build...');

  // 1. Minificar o CSS
  console.log('Minificando style.css...');
  await esbuild.build({
    entryPoints: ['style.css'],
    bundle: true,
    minify: true,
    outfile: path.join(distDir, 'style.css'),
  });

  // 2. Minificar todos os JS
  console.log('Minificando arquivos JS...');
  const jsFiles = fs.readdirSync(path.join(srcDir, 'js')).filter(file => file.endsWith('.js'));
  await esbuild.build({
    entryPoints: [path.join(srcDir, 'js', 'app.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    outfile: path.join(distDir, 'js', 'app.js'),
  });

  // 3. Copiar os outros arquivos essenciais
  console.log('Copiando arquivos estáticos...');
  const filesToCopy = [
    'index.html',
    'manifest.json',
    'sw.js',
    'version.txt',
    'termos.html',
    'privacidade.html'
  ];
  
  for (const file of filesToCopy) {
    if (fs.existsSync(path.join(srcDir, file))) {
      fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
    }
  }

  // Copiar diretórios inteiros recursivamente
  const dirsToCopy = ['icons', 'vendor', 'api'];
  for (const dir of dirsToCopy) {
    const src = path.join(srcDir, dir);
    const dest = path.join(distDir, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true });
    }
  }

  console.log('Build concluído com sucesso! Os arquivos prontos estão na pasta "dist/"');
}

build().catch(() => process.exit(1));
