// Serves dist/ under /nexascan-web/ (the GitHub Pages project path) so relative links are tested as deployed.
// Usage: npm run serve  →  http://localhost:4173/nexascan-web/
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const base = '/nexascan-web/';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.xml': 'application/xml',
  '.txt': 'text/plain', '.json': 'application/json', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!url.startsWith(base)) { res.writeHead(302, { Location: base }); return res.end(); }
  let file = path.join(dist, url.slice(base.length));
  try {
    const s = await stat(file);
    if (s.isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(301, { Location: url + '/' }); return res.end(); }
      file = path.join(file, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await readFile(path.join(dist, '404.html')).catch(() => 'Not found'));
  }
}).listen(4173, () => console.log('http://localhost:4173' + base));
