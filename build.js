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
    'termos.html',
    'CNAME'
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

  // Copia assets adicionais de CSS e JS
  const extraAssets = [
    { src: 'css/landing.css', dest: 'css/landing.css' },
    { src: 'css/checkout.css', dest: 'css/checkout.css' },
    { src: 'js/landing.js', dest: 'js/landing.js' },
    { src: 'js/checkout.js', dest: 'js/checkout.js' },
    { src: 'js/mpErrors.js', dest: 'js/mpErrors.js' },
  ];

  for (const item of extraAssets) {
    if (fs.existsSync(item.src)) {
      const dir = path.dirname(path.join(outDir, item.dest));
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(item.src, path.join(outDir, item.dest));
    }
  }

  console.log('Build completed successfully!');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
