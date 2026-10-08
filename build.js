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

  console.log('Copying index.html and assets...');
  let html = fs.readFileSync('index.html', 'utf8');
  
  // HTML could be updated if needed, but since we keep the same paths 'css/style.css' (after bundling into dist/style.css) 
  // Wait, in index.html, CSS is loaded via <link rel="stylesheet" href="css/style.css"> which matches dist/style.css
  // JS is loaded via <script type="module" src="js/app.js"></script> which matches dist/js/app.js
  // So no HTML changes are strictly needed if we copy index.html directly!
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  const assets = [
    'manifest.json',
    'version.txt',
    'sw.js',
    'icons'
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

  console.log('Build completed successfully!');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
