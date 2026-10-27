/* Teste de fumaça: sobe o servidor, conecta jogadores simulados e verifica partida, tiros e mortes. */
'use strict';
process.env.PORT = process.env.PORT || '3917';
const server = require('../server.js');
const ZH = require('../public/js/shared.js');
const URL = 'ws://localhost:' + process.env.PORT + '/ws';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails++; };

function client(join) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(URL); const st = { ws, msgs: [], players: new Map(), me: null, welcome: null, spawn: null, hits: 0, kills: [], dmg: 0, snaps: 0 };
    ws.onopen = () => ws.send(JSON.stringify(Object.assign({ t: 'join' }, join)));
    ws.onmessage = e => {
      const m = JSON.parse(e.data); st.msgs.push(m.t);
      if (m.t === 'welcome') { st.welcome = m; st.me = m.id; res(st); }
      if (m.t === 'err') { st.err = m.msg; res(st); }
      if (m.t === 'spawn') st.spawn = m;
      if (m.t === 'snap') { st.snaps++; for (const r of m.p) st.players.set(r[0], r); }
      if (m.t === 'hit') st.hits++;
      if (m.t === 'kill') st.kills.push(m);
      if (m.t === 'dmg') st.dmg++;
      if (m.t === 'join') st.joins = (st.joins || 0) + (m.p.bot ? 1 : 0);
    };
    ws.onerror = rej;
  });
}
(async () => {
  try {
    await sleep(200);
    const st = await (await fetch('http://localhost:' + process.env.PORT + '/api/status')).json(); ok(st.ok === true, 'status responde');
    const page = await fetch('http://localhost:' + process.env.PORT + '/'); ok(page.status === 200, 'página inicial servida');
    const shared = await fetch('http://localhost:' + process.env.PORT + '/js/shared.js'); ok(shared.status === 200, 'scripts servidos');
    const trav = await fetch('http://localhost:' + process.env.PORT + '/../server.js'); ok(trav.status !== 200 || !(await trav.text()).includes('createServer'), 'bloqueia acesso fora de public/');

    // Sala privada sem bots: dois jogadores, A atira em B
    const a = await client({ mode: 'ffa', create: true, bots: false, name: 'Alfa<script>', cls: 'recon', primary: 'k90' });
    ok(a.welcome && a.welcome.room.code && a.welcome.room.code.length === 4, 'sala privada criada com código ' + (a.welcome && a.welcome.room.code));
    ok(a.welcome.players[0].name === 'Alfascript', 'nome higienizado');
    const b = await client({ mode: 'ffa', code: a.welcome.room.code.toLowerCase(), name: 'Bravo' });
    ok(b.welcome && b.welcome.room.code === a.welcome.room.code, 'segundo jogador entrou pelo código');
    const bad = await client({ code: 'ZZZZ', name: 'X' }); ok(!!bad.err, 'código inválido recusado');
    await sleep(300);
    ok(a.spawn && b.spawn, 'ambos nasceram');
    // B se posiciona na frente de A em passos pequenos (validação de velocidade)
    const ax = a.spawn.x, az = a.spawn.z;
    let bx = b.spawn.x, bz = b.spawn.z; const tx = ax, tz = az - 6;
    // colocar A num ponto livre e B logo à frente: mover em passos até lá
    async function walk(c, from, to, steps) { let [x, z] = from; for (let i = 1; i <= steps; i++) { x = from[0] + (to[0] - from[0]) * i / steps; z = from[1] + (to[1] - from[1]) * i / steps; c.ws.send(JSON.stringify({ t: 's', x, y: 0, z, yaw: 0, pitch: 0, cr: 0, w: 0 })); await sleep(110); } return [x, z]; }
    // teleporte deve ser corrigido
    const before = b.msgs.length; b.ws.send(JSON.stringify({ t: 's', x: bx + 40, y: 0, z: bz, yaw: 0, pitch: 0, w: 0 })); await sleep(150);
    ok(b.msgs.slice(before).includes('pos'), 'teletransporte corrigido pelo servidor');
    // levar os dois para uma área aberta: A em (0,46) olhando -Z, B em (0,40)
    const pa = await walk(a, [ax, az], [0, 46], 60); const pb = await walk(b, [b.players.get(b.me) ? b.players.get(b.me)[1] : bx, b.players.get(b.me) ? b.players.get(b.me)[3] : bz], [3, 41], 70);
    await sleep(1700); // fim da proteção de nascimento
    const ra = a.players.get(a.me), rb = a.players.get(b.me);
    ok(Math.hypot(ra[1] - 0, ra[3] - 46) < 1.5 && Math.hypot(rb[1] - 3, rb[3] - 41) < 1.5, 'movimento aceito em passos normais');
    const eye = [ra[1], 1.62, ra[3]], tgt = [rb[1], 1.66, rb[3]]; const d = [tgt[0] - eye[0], tgt[1] - eye[1], tgt[2] - eye[2]];
    a.ws.send(JSON.stringify({ t: 'f', w: 0, o: eye, d: [d] })); await sleep(250);
    ok(a.kills.length === 1 && a.kills[0].hs && a.kills[0].v === b.me, 'tiro na cabeça de sniper matou e foi validado');
    ok(a.hits === 1 && b.dmg >= 1, 'confirmação de acerto e dano entregues');
    a.ws.send(JSON.stringify({ t: 'f', w: 0, o: eye, d: [d] })); await sleep(100);
    ok(a.kills.length === 1, 'cadência do K-90 bloqueia tiro rápido demais');
    await sleep(3300);
    ok(b.spawn && b.players.get(b.me) && (b.players.get(b.me)[6] & 8) === 0, 'renascimento após 3 s');
    a.ws.close(); b.ws.close(); await sleep(200);
    const st2 = await (await fetch('http://localhost:' + process.env.PORT + '/api/status')).json(); ok(st2.online === 0, 'sala removida quando todos saem');
    const rk = await (await fetch('http://localhost:' + process.env.PORT + '/api/ranking')).json(); ok(rk.top.length === 1 && rk.top[0].kills === 1, 'ranking registrou a baixa');

    // Partida rápida em equipe com bots: os bots devem lutar entre si e contra o jogador
    const c = await client({ mode: 'tdm', name: 'Charlie', primary: 'm7' });
    await sleep(300);
    ok((c.joins || 0) === 7, 'partida rápida em equipe completada com 7 bots (' + (c.joins || 0) + ')');
    await sleep(22000);
    const botKills = c.kills.filter(k => k.k !== c.me).length;
    ok(c.snaps > 100, 'snapshots contínuos (' + c.snaps + ')');
    ok(botKills > 0 || c.dmg > 0, 'bots se enfrentam (' + botKills + ' baixas, ' + c.dmg + ' danos em você)');
    c.ws.close();

    // Sobrevivência
    const s = await client({ mode: 'surv', create: true, name: 'Delta' });
    await sleep(6500);
    ok(s.msgs.includes('wave'), 'onda de sobrevivência começou');
    ok([...s.players.values()].some(r => r[0] !== s.me), 'hostis surgiram');
    s.ws.close();
  } catch (e) { console.error(e); fails++; }
  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  server.close(); process.exit(fails ? 1 : 0);
})();
