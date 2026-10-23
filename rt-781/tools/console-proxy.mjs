// RT-781 lab: serve the built Admin-Console SPA and proxy /api to rt9-api on ONE origin.
// HTTPS (self-signed localhost cert, 2 days): the lab api runs with a Secure cookie, so its own origin is https://<Host>.
// The browser's Host header is kept, so the API's origin check sees Origin == own origin.
import http from 'node:http'; import https from 'node:https'; import fs from 'node:fs'; import path from 'node:path';
const DIST = process.argv[2]; const PORT = 4781;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const TLS = { key: fs.readFileSync(new URL('./localhost-key.pem', import.meta.url)), cert: fs.readFileSync(new URL('./localhost-cert.pem', import.meta.url)) };
https.createServer(TLS, (req, res) => {
  if (req.url.startsWith('/api/')) {
    const up = http.request({ host: '127.0.0.1', port: 13000, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', (e) => { res.writeHead(502); res.end(String(e)); }); req.pipe(up); return;
  }
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`console-proxy on https://localhost:${PORT}`));
