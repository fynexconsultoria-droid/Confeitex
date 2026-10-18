const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outDir = 'dist';

async function build() {
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir);

  console.log('Bundling CSS...');
  await esbuild.build({
    entryPoints: ['style.css'],
    bundle: true,
    minify: true,
    outfile: path.join(outDir, 'style.css'),
  });

  console.log('Bundling JS...');
  await esbuild.build({
    entryPoints: ['js/app.js'],
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    outfile: path.join(outDir, 'js/app.js'),
  });

  console.log('Copying index.html, app.html and assets...');
  let html = fs.readFileSync('index.html', 'utf8');
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  if (fs.existsSync('app.html')) {
    let appHtml = fs.readFileSync('app.html', 'utf8');
    fs.writeFileSync(path.join(outDir, 'app.html'), appHtml);
  }

  const assets = [
    'manifest.json',
    'version.txt',
    'sw.js',
    'icons',
    'privacidade.html',
    'termos.html'
  ];

  for (const asset of assets) {
    if (fs.existsSync(asset)) {
      if (fs.lstatSync(asset).isDirectory()) {
        fs.cpSync(asset, path.join(outDir, asset), { recursive: true });
      } else {
        fs.copyFileSync(asset, path.join(outDir, asset));
      }
    }
  }

  // Copia css/landing.css
  if (fs.existsSync('css/landing.css')) {
    fs.mkdirSync(path.join(outDir, 'css'), { recursive: true });
    fs.copyFileSync('css/landing.css', path.join(outDir, 'css/landing.css'));
  }

  // Copia js/landing.js
  if (fs.existsSync('js/landing.js')) {
    fs.mkdirSync(path.join(outDir, 'js'), { recursive: true });
    fs.copyFileSync('js/landing.js', path.join(outDir, 'js/landing.js'));
  }

  console.log('Build completed successfully!');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
