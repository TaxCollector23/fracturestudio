const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(dist, 'index.html');
const notFound = path.join(dist, '404.html');

if (!fs.existsSync(indexHtml)) {
  console.error('copy-spa-fallback: dist/index.html missing. Run vite build first.');
  process.exit(1);
}

fs.copyFileSync(indexHtml, notFound);
console.log('copy-spa-fallback: wrote dist/404.html (GitHub Pages SPA routing).');
