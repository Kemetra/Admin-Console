// RT-781 lab harness (owner-chosen 2026-10-23): serve the built Admin-Console SPA over plain http://localhost:4782
// for the agent's browser pane, which refuses the self-signed https cert.
// The lab api runs with a Secure cookie, so it takes its own origin to be https://<Host>. This proxy keeps the Host
// header and rewrites ONLY an Origin that is exactly http://localhost:4782 to https://localhost:4782 before forwarding.
// Any other Origin is passed unchanged, so the api's origin check still refuses it. Recorded in the RT-781 evidence.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const DIST = process.argv[2]; const PORT = 4782; const SELF = `http://localhost:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    const headers = { ...req.headers };
    if (headers.origin === SELF) headers.origin = `https://localhost:${PORT}`;
    const up = http.request({ host: '127.0.0.1', port: 13000, path: req.url, method: req.method, headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
    up.on('error', (e) => { res.writeHead(502); res.end(String(e)); }); req.pipe(up); return;
  }
  let f = path.join(DIST, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`console-proxy-http on ${SELF}`));
