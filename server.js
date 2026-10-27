/* Zona Hostil — servidor do jogo.
   Serve a página inicial e o jogo (pasta public/) e hospeda o multiplayer por WebSocket em /ws.
   Não usa dependências externas: o protocolo WebSocket (RFC 6455) está implementado aqui. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ZH = require('./public/js/shared.js');
const { Room } = require('./public/js/sim.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MAX_HUMANS = 10;
const TICK = 1000 / 30;

// ------------------------------------------------------------------ arquivos estáticos
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p === '/jogar') p = '/jogar.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Página não encontrada'); }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
  });
}

// ------------------------------------------------------------------ ranking (em memória)
const ranking = new Map();
function recordKill(k, v, info) {
  const key = k.name.toLowerCase(); const r = ranking.get(key) || { name: k.name, kills: 0, hs: 0, best: 0 };
  r.kills++; if (info.hs) r.hs++; r.best = Math.max(r.best, k.streak); r.name = k.name; ranking.set(key, r);
}
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify(obj)); }

// ------------------------------------------------------------------ salas
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode() { let c; do { c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]; } while (rooms.has(c)); return c; }
let roomSeq = 1;
function createRoom(mode, priv, bots) {
  const id = priv ? newCode() : 'R' + (roomSeq++);
  const conns = new Map();
  const room = new Room({ id, code: priv ? id : null, mode, priv, bots, send: (pid, msg, str) => { const c = conns.get(pid); if (c) c.send(str || JSON.stringify(msg), msg.t === 'snap'); }, onKill: recordKill });
  room.conns = conns; rooms.set(id, room); return room;
}
function findPublic(mode) {
  for (const r of rooms.values()) if (!r.priv && r.mode === mode && r.humans() < MAX_HUMANS) return r;
  return createRoom(mode, false, true);
}

// ------------------------------------------------------------------ WebSocket (RFC 6455)
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(op, payload) {
  const len = payload.length; let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | op; return Buffer.concat([head, payload]);
}
function acceptWS(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key || (req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return null; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = {
    open: true, buf: Buffer.alloc(0), frag: [], last: Date.now(), onmessage: null, onclose: null,
    send(str, droppable) { if (!c.open) return; if (droppable && socket.writableLength > 512 * 1024) return; socket.write(frame(1, Buffer.from(str))); },
    close(code) { if (!c.open) return; const b = Buffer.alloc(2); b.writeUInt16BE(code || 1000); try { socket.write(frame(8, b)); } catch (e) { } socket.end(); finish(); },
  };
  function finish() { if (!c.open) return; c.open = false; if (c.onclose) c.onclose(); }
  socket.on('data', d => {
    c.last = Date.now(); c.buf = c.buf.length ? Buffer.concat([c.buf, d]) : d;
    while (c.buf.length >= 2) {
      const b0 = c.buf[0], b1 = c.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80; let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (c.buf.length < 4) return; len = c.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (c.buf.length < 10) return; len = Number(c.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024) return c.close(1009);
      if (!masked) return c.close(1002);
      if (c.buf.length < off + 4 + len) return;
      const mask = c.buf.slice(off, off + 4), data = Buffer.from(c.buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      c.buf = c.buf.slice(off + 4 + len);
      if (op === 8) return c.close(1000);
      if (op === 9) { socket.write(frame(10, data)); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) { c.frag.push(data); if (fin) { const msg = Buffer.concat(c.frag).toString('utf8'); c.frag = []; if (c.onmessage) c.onmessage(msg); } }
    }
  });
  socket.on('close', finish); socket.on('error', finish); socket.on('end', finish);
  return c;
}

// ------------------------------------------------------------------ conexões de jogadores
function onConnection(c) {
  let room = null, pid = 0, count = 0, window0 = Date.now();
  c.onmessage = raw => {
    const t = Date.now(); if (t - window0 > 1000) { window0 = t; count = 0; }
    if (++count > 90) return; // limite de mensagens por segundo
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (!room) {
      if (m.t !== 'join') return;
      const mode = ZH.MODES[m.mode] ? m.mode : 'tdm';
      if (m.create) room = createRoom(mode, true, m.bots !== false);
      else if (m.code) {
        room = rooms.get(String(m.code).toUpperCase().trim());
        if (!room || !room.priv) { c.send(JSON.stringify({ t: 'err', msg: 'Sala não encontrada. Confira o código.' })); room = null; return; }
        if (room.humans() >= MAX_HUMANS) { c.send(JSON.stringify({ t: 'err', msg: 'Sala cheia.' })); room = null; return; }
      } else room = findPublic(mode);
      pid = room.pid; room.conns.set(pid, c);
      const real = room.addPlayer({ name: m.name, cls: m.cls, fem: m.fem, primary: m.primary });
      if (real !== pid) { room.conns.delete(pid); room.conns.set(real, c); pid = real; }
      return;
    }
    room.onMessage(pid, m);
  };
  c.onclose = () => {
    if (!room) return; room.conns.delete(pid); room.removePlayer(pid);
    if (room.humans() === 0) rooms.delete(room.id);
  };
}

// ------------------------------------------------------------------ HTTP
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/api/status') {
    let online = 0, list = []; for (const r of rooms.values()) { const h = r.humans(); online += h; if (!r.priv) list.push({ mode: r.mode, humans: h, players: r.players.size }); }
    return json(res, 200, { ok: true, online, rooms: rooms.size, public: list, uptime: Math.round(process.uptime()) });
  }
  if (url === '/api/ranking') {
    const top = [...ranking.values()].sort((a, b) => b.kills - a.kills).slice(0, 20);
    return json(res, 200, { top });
  }
  if (url === '/healthz') return json(res, 200, { ok: true });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res);
});
server.on('upgrade', (req, socket) => {
  if ((req.url || '').split('?')[0] !== '/ws') return socket.destroy();
  const c = acceptWS(req, socket); if (c) { conns.add(c); const oc = () => conns.delete(c); onConnection(c); const prev = c.onclose; c.onclose = () => { oc(); prev && prev(); }; }
});
const conns = new Set();

let last = Date.now();
setInterval(() => {
  const t = Date.now(), dt = Math.min(0.1, (t - last) / 1000); last = t;
  for (const r of rooms.values()) { try { r.tick(dt); } catch (e) { console.error('Erro na sala', r.id, e); } }
}, TICK);
setInterval(() => { const t = Date.now(); for (const c of conns) if (t - c.last > 30000) c.close(1001); }, 10000);

server.listen(PORT, () => console.log(`Zona Hostil rodando em http://localhost:${PORT}`));
module.exports = server;
