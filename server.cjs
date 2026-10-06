const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, 'dist');
function handler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent((req.url || '/').split('?')[0]);
    if (pathname.includes('\0')) throw new URIError('Invalid path');
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Bad request');
  }
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (file === root || file.endsWith(path.sep)) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}
if (require.main === module) {
  http.createServer(handler).listen(4173, '127.0.0.1', () => console.log('JoDJuM: http://127.0.0.1:4173'));
}
module.exports = { handler };
