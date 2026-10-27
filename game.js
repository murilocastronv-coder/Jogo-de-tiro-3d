/* Zona Hostil — cliente do jogo.
   Renderização, controles (toque e teclado/mouse), arma em 1ª pessoa, HUD, menus,
   conexão com o servidor (online) ou com uma sala local (treino offline). */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
  const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
  if (typeof THREE === 'undefined') { document.body.insertAdjacentHTML('beforeend', '<div id="err">Não foi possível carregar o motor 3D. Verifique a conexão e recarregue a página.</div>'); return; }
  const { V3, lin } = ZHA; const WEAPONS = ZH.WEAPONS, CLASSES = ZH.CLASSES, MODES = ZH.MODES;
  const WNAME = Object.assign({ faca: 'FACA', granada: 'GRANADA' }, Object.fromEntries(Object.values(WEAPONS).map(w => [w.id, w.name])));

  // ============================================================ CONFIGURAÇÃO
  const DEF = { name: '', cls: 'assault', fem: false, primary: 'm7', sensH: 1, sensV: 1, fov: 72, vol: 0.6, btn: 1, qual: isTouch ? 'med' : 'high', inv: false, assist: true };
  const cfg = Object.assign({}, DEF);
  try { Object.assign(cfg, JSON.parse(localStorage.getItem('zh_cfg') || '{}')); } catch (e) { }
  if (!CLASSES[cfg.cls]) cfg.cls = 'assault'; if (!ZH.PRIMARIES.includes(cfg.primary)) cfg.primary = 'm7';
  const saveCfg = () => { try { localStorage.setItem('zh_cfg', JSON.stringify(cfg)); } catch (e) { } };

  // ============================================================ RENDERIZAÇÃO
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !isTouch && cfg.qual !== 'low', powerPreference: 'high-performance' }); }
  catch (e) { document.body.insertAdjacentHTML('beforeend', '<div id="err">Seu navegador não suporta WebGL.</div>'); return; }
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.autoClear = false;
  $('game').appendChild(renderer.domElement);
  ZHA.init(renderer);
  const scene = new THREE.Scene();
  const world = ZHA.buildWorld(scene, { shadowSize: isTouch ? 1024 : 2048 });
  const camera = new THREE.PerspectiveCamera(cfg.fov, innerWidth / innerHeight, 0.05, 700); camera.rotation.order = 'YXZ';
  const worldFlash = new THREE.PointLight(0xffb860, 0, 10, 2); scene.add(worldFlash);
  const boomLight = new THREE.PointLight(0xffa040, 0, 26, 2); scene.add(boomLight);
  function applyQuality() {
    const dpr = devicePixelRatio || 1;
    const pr = cfg.qual === 'low' ? Math.min(dpr, 1) * (isTouch ? 0.8 : 1) : cfg.qual === 'med' ? Math.min(dpr, 1.4) : Math.min(dpr, 2);
    renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight);
    world.sun.castShadow = cfg.qual !== 'low';
  }
  applyQuality();

  // arma em 1ª pessoa numa camada própria (não atravessa paredes)
  const gunScene = new THREE.Scene();
  const gunCam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.01, 10);
  gunScene.add(new THREE.HemisphereLight(0xdfe6ee, 0x3e3428, 0.95));
  const gLight = new THREE.DirectionalLight(0xffe0b0, 1.7); gLight.position.set(1.5, 2, 1); gunScene.add(gLight);
  const gunFlashLight = new THREE.PointLight(0xffb050, 0, 2.5, 2); gunScene.add(gunFlashLight);
  const VM = ZHA.buildViewModels();
  for (const k in VM.models) gunScene.add(VM.models[k].g);
  gunScene.add(VM.knife, VM.nadeHand);
  ZHA.setSleeves(VM, cfg.cls);
  const shells = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(VM.shellGeo, VM.gm.brass); m.visible = false; gunScene.add(m); shells.push({ m, v: V3(0, 0, 0), t: 0 }); }
  let shellI = 0;

  // ============================================================ EFEITOS
  const T = ZHA.T;
  const sparkGeo = new THREE.BoxGeometry(0.035, 0.035, 0.035), sparkMat = new THREE.MeshBasicMaterial({ color: 0xffc062 });
  const sparks = []; for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(sparkGeo, sparkMat); m.visible = false; scene.add(m); sparks.push({ m, v: V3(0, 0, 0), t: 0 }); }
  let sparkI = 0;
  const puffs = []; for (let i = 0; i < 40; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.puff, transparent: true, depthWrite: false, color: 0xb8ad98 })); s.visible = false; scene.add(s); puffs.push({ s, t: 0, life: 0.5, size: 1, rise: 0.3, op: 0.7 }); }
  let puffI = 0;
  const decalGeo = new THREE.CircleGeometry(0.055, 10), decalMat = new THREE.MeshBasicMaterial({ color: 0x151310, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const scorchGeo = new THREE.CircleGeometry(1.6, 20), scorchMat = new THREE.MeshBasicMaterial({ color: 0x0d0b09, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false });
  const decals = []; for (let i = 0; i < 80; i++) { const m = new THREE.Mesh(decalGeo, decalMat); m.visible = false; scene.add(m); decals.push(m); }
  let decalI = 0;
  const tracerGeo = new THREE.BoxGeometry(0.018, 0.018, 1);
  const tracerMatP = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracerMatE = new THREE.MeshBasicMaterial({ color: 0xff7a4a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = []; for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tracerGeo, tracerMatP); m.visible = false; scene.add(m); tracers.push({ m, a: V3(0, 0, 0), b: V3(0, 0, 0), t: 0, len: 0, dur: 0 }); }
  let tracerI = 0;
  const _v = V3(0, 0, 0), _v2 = V3(0, 0, 0), _n = V3(0, 0, 0);
  function tracer(a, b, enemy) { const t = tracers[tracerI++ % tracers.length]; t.a.copy(a); t.b.copy(b); t.len = a.distanceTo(b); t.dur = Math.max(0.04, t.len / 420); t.t = 0; t.m.material = enemy ? tracerMatE : tracerMatP; t.m.visible = true; }
  function sparkAt(p, n, count, speed) { for (let i = 0; i < count; i++) { const s = sparks[sparkI++ % sparks.length]; s.m.position.copy(p); s.v.set(n.x + rnd(-0.8, 0.8), n.y + rnd(-0.2, 1), n.z + rnd(-0.8, 0.8)).multiplyScalar(rnd(2, 5) * (speed || 1)); s.t = rnd(0.15, 0.32) * (speed || 1); s.m.visible = true; } }
  function puffAt(p, col, size, life, rise, op) { const u = puffs[puffI++ % puffs.length]; u.s.position.copy(p); u.s.material.color.set(col); u.op = op || 0.7; u.s.material.opacity = u.op; u.size = size; u.s.scale.setScalar(size * 0.4); u.t = 0; u.life = life; u.rise = rise == null ? 0.3 : rise; u.s.visible = true; }
  function decalAt(p, n) { const d = decals[decalI++ % decals.length]; d.position.copy(p).addScaledVector(n, 0.012); _v2.copy(d.position).add(n); d.lookAt(_v2); d.visible = true; }
  const scorches = []; function scorchAt(x, z) { const m = new THREE.Mesh(scorchGeo, scorchMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m); scorches.push(m); if (scorches.length > 8) scene.remove(scorches.shift()); }
  const nadeGeo = new THREE.SphereGeometry(0.07, 12, 8), nadeMat = new THREE.MeshStandardMaterial({ color: lin('#4b5536'), roughness: 0.6 });
  const nadeMeshes = new Map();
  let boomT = 0;
  function explosionFx(x, y, z) {
    const p = V3(x, y + 0.3, z);
    puffAt(p, 0xffc070, 3.2, 0.25, 0.4, 0.95); puffAt(p, 0xff8a30, 4.2, 0.4, 0.6, 0.8);
    for (let i = 0; i < 6; i++) puffAt(V3(x + rnd(-1, 1), y + rnd(0.3, 1.4), z + rnd(-1, 1)), 0x4a4440, rnd(3, 5), rnd(1.4, 2.4), 0.9, 0.75);
    sparkAt(p, V3(0, 1, 0), 26, 2.2);
    boomLight.position.copy(p); boomLight.intensity = 14; boomT = 0.25;
    if (y < 0.5) scorchAt(x, z);
    const d = Math.hypot(P.x - x, P.z - z); if (P.alive && d < 18) P.shake = Math.max(P.shake, (1 - d / 18) * 0.9);
    sBoom(clamp(1 - d / 60, 0.08, 1));
  }

  // ============================================================ ÁUDIO
  let AC = null, master = null, noiseBuf = null;
  function initAudio() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = cfg.vol; master.connect(AC.destination); const len = AC.sampleRate * 1.2; noiseBuf = AC.createBuffer(1, len, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; } }
  function sGun(vol, cut, dur, thump) { if (!AC) return; const t = AC.currentTime; const n = AC.createBufferSource(); n.buffer = noiseBuf; const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cut, t); f.frequency.exponentialRampToValueAtTime(220, t + dur); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); n.connect(f); f.connect(g); g.connect(master); n.start(t); n.stop(t + dur + 0.02); if (thump) { const o = AC.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); const og = AC.createGain(); og.gain.setValueAtTime(vol * thump, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.17); } }
  function sTone(freq, vol, dur, type, delay) { if (!AC) return; const t = AC.currentTime + (delay || 0); const o = AC.createOscillator(); o.type = type || 'square'; o.frequency.setValueAtTime(freq, t); const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02); }
  function sBoom(vol) { if (!AC) return; sGun(0.9 * vol, 1400, 1.1, 2.4 * vol); }
  const GUNSND = { m7: [0.5, 4200, 0.16, 1], vespa: [0.42, 5200, 0.11, 0.6], k90: [0.7, 3000, 0.45, 1.6], r12: [0.72, 2600, 0.32, 1.8], p9: [0.4, 4800, 0.12, 0.6] };
  function shotSound(w, dist) { const s = GUNSND[w] || GUNSND.m7; const k = dist == null ? 1 : clamp(1 - dist / 90, 0.05, 0.85); sGun(s[0] * k, s[1] - (dist || 0) * 15, s[2] * (dist ? 1.2 : 1), s[3] * k); }

  // ============================================================ ESTADO
  const P = {
    x: 0, y: 0, z: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, hp: 100, onGround: true, alive: false,
    slot: 0, primary: cfg.primary, mag: [30, 12], res: [150, 60], nades: 2, reload: 0, reloadSlot: 0, fireCd: 0, trig: true,
    ads: 0, adsWant: false, bloom: 0, kick: 0, recoil: 0, bob: 0, swayX: 0, swayY: 0, sprint: false, crouch: false, cr: 0, shake: 0,
    switchT: 0, throwT: 0, nadeSent: true, meleeT: 0, boltT: 0, pumpT: 0, inspectT: 0, kills: 0, streak: 0, lastKillT: -9, multi: 0, deadT: 0, killer: 0, respawnAt: 0,
  };
  const sess = { on: false, local: false, mode: 'tdm', room: null, me: 0, team: 'A', players: new Map(), match: null, mAt: 0, board: [], uavUntil: 0, enemyUav: 0, rtt: 0 };
  let ui = 'menu', paused = false, boardOpen = false, net = null, now = 0, firing = false, jumpReq = false, vmCur = null;
  const keys = {};
  const weaponId = slot => slot === 1 ? ZH.SECONDARY : P.primary;
  const curW = () => WEAPONS[weaponId(P.slot)];
  const isFriend = R => sess.mode !== 'ffa' && R.team === sess.team;
  const nameOf = id => id === sess.me ? (cfg.name || 'Você') : (sess.players.get(id) || {}).name || '???';

  // ============================================================ HUD
  const hud = { mag: $('mag'), res: $('res'), hpfill: $('hpfill'), hpnum: $('hpnum'), cross: $('cross'), hitm: $('hitm'), vig: $('vignette'), flash: $('dmgflash'), reload: $('reloadHint'), wname: $('wname'), nades: $('nades'), streak: $('streak'), sbar: $('sbar'), net: $('netinfo'), scope: $('scope') };
  let lastHud = '';
  function updHud() {
    const W = curW();
    const k = `${P.mag[P.slot]}|${P.res[P.slot]}|${Math.ceil(P.hp)}|${W.id}|${P.nades}|${P.streak}`;
    if (k !== lastHud) {
      lastHud = k; hud.mag.textContent = P.mag[P.slot]; hud.mag.classList.toggle('low', P.mag[P.slot] <= Math.ceil(W.mag / 4)); hud.res.textContent = P.res[P.slot];
      const hp = Math.max(0, Math.ceil(P.hp)); hud.hpnum.textContent = hp; hud.hpfill.style.width = hp + '%'; hud.hpfill.style.background = hp < 35 ? 'var(--red)' : hp < 65 ? 'var(--amber)' : 'var(--olive)';
      hud.wname.textContent = `${W.name} · ${W.kind}`; hud.nades.textContent = P.nades ? '● '.repeat(P.nades).trim() + ' GRANADA' : 'SEM GRANADA';
      hud.streak.textContent = P.streak ? `SEQUÊNCIA ${P.streak}` : '';
    }
    hud.vig.style.opacity = P.alive ? clamp((1 - P.hp / 100) * 1.25 - 0.12, 0, 1) : 0.6;
    const gap = (6 + (P.bloom * 380) + Math.hypot(P.vx, P.vz) * 1.6 + (P.onGround ? 0 : 14) + (W.type === 'shotgun' ? 16 : 0) + (W.type === 'sniper' ? 26 : 0)) * (1 - P.ads) * (P.crouch ? 0.8 : 1);
    hud.cross.style.setProperty('--gap', gap.toFixed(1) + 'px'); hud.cross.style.opacity = !P.alive || P.ads > 0.5 || P.sprint || P.reload > 0 || P.switchT > 0 ? 0 : 1;
    hud.reload.classList.toggle('show', P.reload > 0);
    hud.net.textContent = sess.local ? 'TREINO OFFLINE' : `${Math.round(sess.rtt)} MS`;
  }
  let hitT = 0;
  function hitmarker(kill) { hud.hitm.classList.toggle('kill', kill); hud.hitm.style.opacity = 1; hitT = kill ? 0.3 : 0.14; }
  function pop(txt, cls) { const d = document.createElement('div'); d.className = 'pop' + (cls ? ' ' + cls : ''); d.textContent = txt; $('pops').appendChild(d); setTimeout(() => d.remove(), 1100); }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function nameSpan(id) { const cls = id === sess.me ? 'me' : (sess.players.get(id) && isFriend(sess.players.get(id))) ? 'f' : 'e'; return `<b class="${cls}">${esc(nameOf(id))}</b>`; }
  function feed(m) {
    const d = document.createElement('div'); d.className = 'kf';
    d.innerHTML = m.k && m.k !== m.v ? `${nameSpan(m.k)}<small>${WNAME[m.w] || ''}</small>${nameSpan(m.v)}${m.hs ? '<em>NA CABEÇA</em>' : ''}` : `${nameSpan(m.v)}<small>${m.k === m.v ? 'SE ELIMINOU' : 'CAIU'}</small>`;
    const f = $('feed'); f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => d.remove(), 5000);
  }
  let bannerTO;
  function banner(sub, title, ms) { $('bsub').textContent = sub; $('btitle').textContent = title; const b = $('banner'); b.classList.add('show'); clearTimeout(bannerTO); bannerTO = setTimeout(() => b.classList.remove('show'), ms || 2400); }
  function damageDir(sx, sz, cls) { const dx = sx - P.x, dz = sz - P.z; const c = Math.cos(P.yaw), s = Math.sin(P.yaw); const rx = dx * c - dz * s, ry = dx * s + dz * c; const a = Math.atan2(rx, -ry); const d = document.createElement('div'); d.className = 'dir' + (cls ? ' ' + cls : ''); d.style.transform = `rotate(${a}rad)`; $('dirs').appendChild(d); setTimeout(() => d.remove(), 1400); }
  let toastTO; function toast(t, ms) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toastTO); toastTO = setTimeout(() => e.classList.remove('show'), ms || 2600); }

  function fmtTime(s) { s = Math.max(0, Math.ceil(s)); return `${(s / 60) | 0}:${String(s % 60).padStart(2, '0')}`; }
  function matchTl() { const m = sess.match; if (!m) return 0; return Math.max(0, m.tl - (now - sess.mAt)); }
  function updScoreBar() {
    const m = sess.match; if (!m) { hud.sbar.innerHTML = ''; return; }
    let html = '';
    if (sess.mode === 'tdm') {
      const mine = sess.team === 'A' ? m.sA : m.sB, other = sess.team === 'A' ? m.sB : m.sA;
      const myName = ZH.TEAMS[sess.team].name, otName = ZH.TEAMS[sess.team === 'A' ? 'B' : 'A'].name;
      html = `<div class="t f"><small>${myName}</small>${mine}</div><div class="clock">${fmtTime(matchTl())}</div><div class="t e">${other}<small>${otName}</small></div>`;
    } else if (sess.mode === 'ffa') {
      let lead = 0; for (const r of sess.board) if (r[0] !== sess.me) lead = Math.max(lead, r[1]);
      const mine = (sess.board.find(r => r[0] === sess.me) || [0, 0])[1];
      html = `<div class="t f"><small>VOCÊ</small>${mine}</div><div class="clock">${fmtTime(matchTl())}</div><div class="t e">${lead}<small>LÍDER</small></div>`;
    } else {
      let alive = 0; for (const R of sess.players.values()) if (R.bot && R.alive) alive++;
      html = `<div class="t f"><small>ONDA</small>${m.wave || 0}</div><div class="clock">${alive} HOSTIS</div>`;
    }
    hud.sbar.innerHTML = html;
  }

  // minimapa
  const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = 240;
  (() => { const g = mapImg.getContext('2d'); g.fillStyle = '#3a3a33'; g.fillRect(0, 0, 240, 240); g.fillStyle = '#8f8b7c'; for (const c of ZH.MAP.colliders) { if (c.maxY < 0.6) continue; g.fillRect((c.minX + 60) * 2, (c.minZ + 60) * 2, (c.maxX - c.minX) * 2, (c.maxZ - c.minZ) * 2); } })();
  const mini = $('mini'), mctx = mini.getContext('2d');
  function drawMini() {
    const S = mini.width, c = S / 2, k = S / 60; mctx.clearRect(0, 0, S, S); mctx.save(); mctx.beginPath(); mctx.arc(c, c, c, 0, 7); mctx.clip();
    mctx.translate(c, c); mctx.rotate(P.yaw); mctx.scale(k / 2, k / 2); mctx.translate(-(P.x + 60) * 2, -(P.z + 60) * 2); mctx.globalAlpha = 0.85; mctx.drawImage(mapImg, 0, 0); mctx.globalAlpha = 1;
    const uav = now < sess.uavUntil;
    for (const R of sess.players.values()) {
      if (!R.alive || !R.cur) continue; const f = isFriend(R);
      if (!f && !uav && R.revealT <= 0) continue;
      mctx.fillStyle = f ? '#4aa3e8' : '#e04a3b'; mctx.beginPath(); mctx.arc((R.cur.x + 60) * 2, (R.cur.z + 60) * 2, f ? 4 : 5, 0, 7); mctx.fill();
    }
    mctx.restore();
    if (uav) { mctx.strokeStyle = 'rgba(240,173,46,.6)'; mctx.lineWidth = 4; mctx.beginPath(); mctx.arc(c, c, c - 3, 0, 7); mctx.stroke(); }
    mctx.fillStyle = 'rgba(240,173,46,.18)'; mctx.beginPath(); mctx.moveTo(c, c); mctx.arc(c, c, c, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); mctx.fill();
    mctx.fillStyle = '#f0ad2e'; mctx.beginPath(); mctx.moveTo(c, c - 9); mctx.lineTo(c + 6, c + 6); mctx.lineTo(c, c + 2); mctx.lineTo(c - 6, c + 6); mctx.closePath(); mctx.fill();
  }

  // placar
  function boardHTML(rows) {
    const byId = new Map(rows.map(r => [r[0], r]));
    const row = id => { const r = byId.get(id); if (!r) return ''; const R = sess.players.get(id); const bot = R && R.bot; return `<tr class="${id === sess.me ? 'me' : ''} ${r[5] ? '' : 'dead'}"><td>${esc(nameOf(id))}${bot ? '<span class="bot">BOT</span>' : ''}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${bot ? '—' : r[4]}</td></tr>`; };
    const head = '<tr><th>SOLDADO</th><th>BAIXAS</th><th>MORTES</th><th>PONTOS</th><th>PING</th></tr>';
    const sorted = ids => ids.sort((a, b) => (byId.get(b) || [0, 0, 0, 0])[3] - (byId.get(a) || [0, 0, 0, 0])[3]);
    if (sess.mode === 'tdm') {
      const teamIds = t => sorted(rows.map(r => r[0]).filter(id => (id === sess.me ? sess.team : (sess.players.get(id) || {}).team) === t));
      const m = sess.match || { sA: 0, sB: 0 }; const my = sess.team, ot = my === 'A' ? 'B' : 'A';
      return `<table class="bt"><caption class="f">${ZH.TEAMS[my].name} · ${my === 'A' ? m.sA : m.sB}</caption>${head}${teamIds(my).map(row).join('')}</table><table class="bt"><caption class="e">${ZH.TEAMS[ot].name} · ${ot === 'A' ? m.sA : m.sB}</caption>${head}${teamIds(ot).map(row).join('')}</table>`;
    }
    return `<table class="bt"><caption>${MODES[sess.mode].name}${sess.mode === 'surv' && sess.match ? ' · ONDA ' + sess.match.wave : ''}</caption>${head}${sorted(rows.map(r => r[0]).filter(id => !(sess.mode === 'surv' && (sess.players.get(id) || {}).bot))).map(row).join('')}</table>`;
  }
  function renderBoard() { if (boardOpen) $('boardInner').innerHTML = boardHTML(sess.board); }

  // etiquetas de nome
  const tagPool = []; const tagsEl = $('tags');
  function getTag(i) { while (tagPool.length <= i) { const d = document.createElement('div'); d.className = 'tag'; tagsEl.appendChild(d); tagPool.push({ d, txt: '', cls: '' }); } return tagPool[i]; }
  const _pv = V3(0, 0, 0);
  let aimTarget = null;
  function updTags() {
    let n = 0; const w = innerWidth, h = innerHeight;
    if (ui === 'game' && P.alive) for (const R of sess.players.values()) {
      if (!R.alive || !R.cur) continue; const f = isFriend(R);
      if (!f && R !== aimTarget) continue;
      _pv.set(R.cur.x, R.cur.y + (R.cur.f & 1 ? 1.5 : 2.0), R.cur.z);
      const dist = _pv.distanceTo(camera.position); if (dist > 70) continue;
      _pv.project(camera); if (_pv.z > 1 || Math.abs(_pv.x) > 1.1 || Math.abs(_pv.y) > 1.1) continue;
      const t = getTag(n++); const txt = R.name, cls = 'tag ' + (f ? 'f' : 'e');
      if (t.txt !== txt) { t.d.textContent = txt; t.txt = txt; }
      if (t.cls !== cls) { t.d.className = cls; t.cls = cls; }
      t.d.style.transform = `translate(${((_pv.x + 1) / 2 * w).toFixed(1)}px,${((1 - _pv.y) / 2 * h).toFixed(1)}px) translate(-50%,-100%)`; t.d.style.display = '';
    }
    for (let i = n; i < tagPool.length; i++) tagPool[i].d.style.display = 'none';
  }

  // ============================================================ JOGADORES REMOTOS
  const corpses = [];
  function addRemote(p) {
    if (p.id === sess.me) return;
    const R = sess.players.get(p.id) || { buf: [], s: null, cur: null, alive: false, revealT: 0, flT: 0, kick: 0 };
    Object.assign(R, { id: p.id, name: p.name, team: p.team, cls: p.cls, fem: p.fem, bot: p.bot }); sess.players.set(p.id, R);
    if (R.s) ZHA.setSoldierTeam(R.s, isFriend(R) ? 'friend' : 'enemy');
  }
  function removeSoldier(R) { if (R.s) { scene.remove(R.s.root); R.s = null; } }
  function removeRemote(id) { const R = sess.players.get(id); if (!R) return; removeSoldier(R); sess.players.delete(id); }
  function remoteSoldier(R) {
    if (R.s) return R.s;
    const s = ZHA.makeSoldier(R.cls, R.fem, R.id % 5, isFriend(R) ? 'friend' : 'enemy', R.cur ? R.cur.w : 'm7');
    scene.add(s.root); R.s = s; return s;
  }
  function updateRemotes(dt) {
    const rt = now - 0.11;
    for (const R of sess.players.values()) {
      R.revealT -= dt; const b = R.buf; if (!b.length) continue;
      while (b.length > 2 && b[1].t <= rt) b.shift();
      const a = b[0], c = b[1] || b[0];
      let k = c.t > a.t ? clamp((rt - a.t) / (c.t - a.t), 0, 1) : 1;
      if (Math.hypot(c.x - a.x, c.z - a.z) > 6) k = 1;
      let dy = c.yaw - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const cur = R.cur || (R.cur = {});
      cur.x = lerp(a.x, c.x, k); cur.y = lerp(a.y, c.y, k); cur.z = lerp(a.z, c.z, k); cur.yaw = a.yaw + dy * k; cur.pitch = lerp(a.pitch, c.pitch, k);
      cur.f = k < 0.5 ? a.f : c.f; cur.w = c.w; cur.hp = c.hp;
      const vx = c.t > a.t ? (c.x - a.x) / (c.t - a.t) : 0, vz = c.t > a.t ? (c.z - a.z) / (c.t - a.t) : 0;
      const alive = !(cur.f & 8);
      if (!alive) { if (R.s && !R.dying) removeSoldier(R); R.alive = false; continue; }
      if (!R.alive) { R.alive = true; R.dying = false; R.buf = [c]; }
      const s = remoteSoldier(R); ZHA.setSoldierWeapon(s, cur.w);
      s.root.position.set(cur.x, cur.y, cur.z); s.root.rotation.y = cur.yaw + Math.PI;
      const sp = Math.hypot(vx, vz) > 0.25 ? Math.hypot(vx, vz) : 0;
      ZHA.animSoldier(s, dt, { speed: Math.min(sp, 9), moveYaw: Math.atan2(vx, vz), yaw: cur.yaw + Math.PI, aim: !!(cur.f & 4) || R.flT > -0.6, aimPitch: cur.pitch, crouch: !!(cur.f & 1), sprint: !!(cur.f & 2), reload: !!(cur.f & 32) });
      s.root.visible = !(cur.f & 16) || ((now * 8) | 0) % 2 === 0 || isFriend(R);
      if (R.flT > -1) { R.flT -= dt; if (R.flT <= 0) s.fl.visible = false; }
    }
    for (let i = corpses.length - 1; i >= 0; i--) {
      const c = corpses[i]; c.t += dt; ZHA.animSoldier(c.s, dt, null);
      const g = c.drop.g; if (c.drop.v) { c.drop.v.y -= 12 * dt; g.position.addScaledVector(c.drop.v, dt); g.rotation.x += c.drop.r.x * dt; g.rotation.y += c.drop.r.y * dt; g.rotation.z += c.drop.r.z * dt; if (g.position.y < 0.04) { g.position.y = 0.04; c.drop.v = null; g.rotation.x = 0; g.rotation.z = Math.PI / 2; } }
      if (c.t > 6) { scene.remove(c.s.root); scene.remove(g); corpses.splice(i, 1); }
    }
  }

  // ============================================================ REDE
  let ws = null, localAcc = 0, localClock = 0, sendAcc = 0, pingAcc = 0, connTO = 0;
  function clearSession() {
    for (const R of sess.players.values()) removeSoldier(R);
    sess.players.clear(); for (const c of corpses) { scene.remove(c.s.root); scene.remove(c.drop.g); } corpses.length = 0;
    for (const m of nadeMeshes.values()) scene.remove(m); nadeMeshes.clear();
    for (const s of scorches) scene.remove(s); scorches.length = 0; decals.forEach(d => d.visible = false);
    sess.on = false; sess.match = null; sess.board = []; sess.uavUntil = 0; $('feed').innerHTML = '';
  }
  function connect(o) {
    initAudio(); if (AC && AC.state === 'suspended') AC.resume();
    leave(true); clearSession();
    cfg.name = ZH.cleanName(cfg.name || $('cfgName').value); $('cfgName').value = cfg.name; saveCfg();
    const join = { t: 'join', mode: o.mode, create: !!o.create, code: o.code || null, bots: o.bots !== false, name: cfg.name, cls: cfg.cls, fem: cfg.fem, primary: cfg.primary };
    sess.mode = o.mode; sess.local = !o.online;
    showScreen('loading'); $('lText').textContent = o.online ? 'ENTRANDO NA ZONA…' : 'PREPARANDO O TREINO…';
    if (o.online) {
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { failConn('Não foi possível conectar ao servidor.'); return; }
      const my = ws;
      net = { local: false, send: m => { if (my.readyState === 1) my.send(JSON.stringify(m)); }, close: () => { try { my.close(); } catch (e) { } } };
      my.onopen = () => net.send(join);
      my.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (err) { return; } handle(m); };
      my.onclose = () => { if (ws === my && ui !== 'menu') { failConn('A conexão com o servidor caiu.'); } };
      clearTimeout(connTO); connTO = setTimeout(() => { if (ui === 'loading' && ws === my) failConn('O servidor não respondeu. Tente de novo em instantes.'); }, 12000);
    } else {
      localClock = 0; localAcc = 0; const inbox = [];
      const room = new ZHSim.Room({ id: 'TREINO', mode: o.mode, priv: true, bots: true, send: (pid, msg) => inbox.push(msg), now: () => localClock });
      net = { local: true, room, inbox, id: 0, send: m => room.onMessage(net.id, m), close: () => { } };
      net.id = room.addPlayer({ name: cfg.name, cls: cfg.cls, fem: cfg.fem, primary: cfg.primary });
      // libera nomes dos bots para o jogador
    }
  }
  function failConn(msg) { leave(true); toast(msg, 4000); toMenu(); }
  function leave(silent) { if (net) { const n = net; net = null; ws = null; n.close(); } sess.on = false; }

  function handle(m) {
    switch (m.t) {
      case 'welcome': {
        clearTimeout(connTO); sess.on = true; sess.me = m.id; sess.mode = m.room.mode; sess.room = m.room;
        for (const p of m.players) { if (p.id === m.id) sess.team = p.team; else addRemote(p); }
        if (m.match) { sess.match = m.match; sess.mAt = now; }
        P.kills = 0; P.streak = 0; P.alive = false;
        startGameUI();
        const rc = $('roomcode'); if (m.room.priv && !sess.local) { rc.hidden = false; rc.innerHTML = `SALA <b>${esc(m.room.code)}</b>`; } else rc.hidden = true;
        banner(MODES[sess.mode].name, sess.local ? 'TREINO' : (m.room.priv ? 'SALA ' + m.room.code : 'PARTIDA ONLINE'), 2400);
        if (m.room.priv && !sess.local) toast(`Código da sala: ${m.room.code} — passe para os amigos entrarem`, 5000);
        break;
      }
      case 'err': clearTimeout(connTO); failConn(m.msg); break;
      case 'join': addRemote(m.p); if (!m.p.bot && sess.on) toast(`${m.p.name} entrou na partida`); break;
      case 'leave': { const R = sess.players.get(m.id); if (R && !R.bot) toast(`${R.name} saiu`); removeRemote(m.id); break; }
      case 'look': { const R = sess.players.get(m.id); if (R) { R.cls = m.cls; R.fem = m.fem; removeSoldier(R); } break; }
      case 'spawn': onSpawn(m); break;
      case 'snap': {
        const t = now;
        for (const r of m.p) {
          if (r[0] === sess.me) { if (P.alive) P.hp = r[8]; continue; }
          const R = sess.players.get(r[0]); if (!R) continue;
          R.buf.push({ t, x: r[1], y: r[2], z: r[3], yaw: r[4], pitch: r[5], f: r[6], w: r[7], hp: r[8] }); if (R.buf.length > 30) R.buf.shift();
        }
        const seen = new Set();
        for (const g of m.g) { seen.add(g[0]); let mesh = nadeMeshes.get(g[0]); if (!mesh) { mesh = new THREE.Mesh(nadeGeo, nadeMat); mesh.castShadow = true; scene.add(mesh); nadeMeshes.set(g[0], mesh); mesh.position.set(g[1], g[2], g[3]); } mesh.userData.to = [g[1], g[2], g[3]]; }
        for (const [id, mesh] of nadeMeshes) if (!seen.has(id)) { scene.remove(mesh); nadeMeshes.delete(id); }
        break;
      }
      case 'shot': onRemoteShot(m); break;
      case 'melee': { const R = sess.players.get(m.id); if (R && R.s) R.s.a.melee = 1; break; }
      case 'hit': hitmarker(m.kill); sTone(m.hs ? 1900 : 1400, 0.12, 0.05); break;
      case 'dmg': {
        const was = P.hp; P.hp = m.hp; P.lastHit = now; P.shake = Math.max(P.shake, 0.25); damageDir(m.from[0], m.from[1]);
        hud.flash.style.transition = 'none'; hud.flash.style.opacity = 1; requestAnimationFrame(() => { hud.flash.style.transition = ''; hud.flash.style.opacity = 0; });
        if (was > m.hp) sTone(90, 0.3, 0.18, 'sine');
        break;
      }
      case 'kill': onKill(m); break;
      case 'boom': explosionFx(m.x, m.y, m.z); break;
      case 'ammo': P.mag = m.mag.slice(); P.res = m.res.slice(); P.nades = m.nades; if (m.hp) P.hp = m.hp; break;
      case 'pos': P.x = m.x; P.y = m.y; P.z = m.z; P.vx = P.vz = 0; break;
      case 'board': sess.board = m.rows; if (m.m) { sess.match = m.m; sess.mAt = now; } renderBoard(); break;
      case 'match': {
        sess.match = m.m; sess.mAt = now; if (m.board) sess.board = m.board;
        if (m.m.state === 'end') showEnd(); else { $('end').hidden = true; P.kills = 0; P.streak = 0; banner(MODES[sess.mode].name, 'NOVA PARTIDA'); }
        break;
      }
      case 'wave':
        if (m.state === 'start') { banner(m.cls ? `NOVO HOSTIL: ${CLASSES[m.cls].name}` : 'ELIMINE OS HOSTIS', `ONDA ${m.n}`); sTone(440, 0.12, 0.15, 'triangle'); sTone(660, 0.12, 0.2, 'triangle', 0.15); }
        else { banner(`+${m.bonus} PTS · MUNIÇÃO REPOSTA`, 'ONDA LIMPA', 3200); }
        if (sess.match) sess.match.wave = m.n;
        break;
      case 'uav': {
        const mine = sess.mode === 'ffa' ? m.id === sess.me : m.team === sess.team;
        if (mine) { sess.uavUntil = now + m.s; banner(m.id === sess.me ? 'SEQUÊNCIA DE 3 BAIXAS' : 'APOIO DA EQUIPE', 'DRONE DE RECONHECIMENTO', 2200); sTone(880, 0.1, 0.12, 'triangle'); sTone(1320, 0.1, 0.16, 'triangle', 0.12); }
        else toast('Drone inimigo no ar — vocês aparecem no radar deles');
        break;
      }
      case 'msg': toast(m.text); break;
      case 'pong': sess.rtt = lerp(sess.rtt || (performance.now() - m.c), performance.now() - m.c, 0.3); break;
    }
  }
  function onSpawn(m) {
    Object.assign(P, { x: m.x, y: m.y, z: m.z, vx: 0, vz: 0, vy: 0, yaw: m.yaw, pitch: 0, hp: m.hp, alive: true, onGround: true, slot: 0, primary: m.primary, mag: m.mag.slice(), res: m.res.slice(), nades: m.nades, reload: 0, fireCd: 0, ads: 0, adsWant: false, crouch: false, cr: 0, switchT: 0.35, throwT: 0, meleeT: 0, boltT: 0, pumpT: 0, inspectT: 0, recoil: 0, kick: 0, streak: 0, shake: 0, lastHit: -9 });
    if (m.cls && m.cls !== cfg.cls) { /* operador aplicado pelo servidor */ }
    ZHA.setSleeves(VM, m.cls || cfg.cls);
    showVM(weaponId(0)); $('death').hidden = true; $('bAds').classList.remove('act'); $('bCrouch').classList.remove('act');
    camera.rotation.z = 0;
  }
  function onRemoteShot(m) {
    const R = sess.players.get(m.id); const W = WEAPONS[m.w] || WEAPONS.m7;
    let from = V3(m.o[0], m.o[1], m.o[2]);
    if (R && R.s) { R.s.gun.updateWorldMatrix(true, false); from = R.s.muz.clone().applyMatrix4(R.s.gun.matrixWorld); R.s.fl.visible = true; R.s.fl.material.rotation = Math.random() * 6; R.flT = 0.05; R.s.a.kick = 1; }
    if (R) R.revealT = W.type === 'sniper' ? 2.5 : 1.6;
    m.e.forEach((e, i) => {
      const end = V3(e[0], e[1], e[2]);
      if (i < 3 && Math.random() < 0.7) { const dc = end.distanceTo(camera.position); if (dc < 4) { const d = _v2.subVectors(end, from); const L = d.length(); if (L > 5) tracer(from, from.clone().addScaledVector(d.normalize(), L - 4), !R || !isFriend(R)); } else tracer(from, end, !R || !isFriend(R)); }
      if (m.hv[i]) { if (m.hv[i] !== sess.me && Math.random() < 0.6) puffAt(end, 0x7a2a20, 0.35, 0.3); }
      else if (i < 4) { const d = _v.subVectors(end, from); const len = d.length(); d.normalize(); const h = ZH.rayWorld(from.x, from.y, from.z, d.x, d.y, d.z, len + 0.5); if (h && Math.abs(h.t - len) < 1) { _n.set(h.nx, h.ny, h.nz); decalAt(end, _n); sparkAt(end, _n, 3); } }
    });
    shotSound(m.w, Math.hypot(m.o[0] - P.x, m.o[2] - P.z));
  }
  function onKill(m) {
    feed(m);
    const V = sess.players.get(m.v);
    if (m.v === sess.me) die(m);
    else if (V) {
      if (V.s) { const s = V.s; const K = m.k === sess.me ? P : (sess.players.get(m.k) || {}).cur; let front = true; if (K) { const fx = Math.sin(s.root.rotation.y), fz = Math.cos(s.root.rotation.y); front = (K.x - s.root.position.x) * fx + (K.z - s.root.position.z) * fz > 0; } const drop = ZHA.killSoldier(s, front, scene); corpses.push({ s, drop, t: 0 }); V.s = null; }
      V.alive = false; V.buf.length = 0;
    }
    if (m.k === sess.me && m.v !== sess.me) {
      P.kills++; P.streak++; const pts = 100 + (m.hs ? 50 : 0) + (m.w === 'faca' ? 50 : 0); pop(`+${pts}`);
      if (now - P.lastKillT < 4) P.multi++; else P.multi = 1; P.lastKillT = now;
      const medal = P.multi === 2 ? 'BAIXA DUPLA' : P.multi === 3 ? 'BAIXA TRIPLA' : P.multi >= 4 ? 'FÚRIA' : m.w === 'faca' ? 'NO SILÊNCIO' : m.w === 'granada' ? 'ESTILHAÇO' : m.hs ? 'NA CABEÇA' : '';
      if (medal) setTimeout(() => pop(medal, 'medal'), 120);
      sTone(900, 0.16, 0.09); sTone(1500, 0.12, 0.12, 'square', 0.05);
    }
  }
  function die(m) {
    P.alive = false; P.killer = m.k; firing = false; P.adsWant = false; P.reload = 0; P.deadT = 0;
    P.respawnAt = sess.mode === 'surv' ? 0 : now + ZH.PLAYER.respawn / 1000;
    if (vmCur) vmCur.g.visible = false; VM.knife.visible = VM.nadeHand.visible = false; hud.scope.hidden = true;
    $('dKiller').textContent = m.k && m.k !== m.v ? nameOf(m.k) : 'VOCÊ MESMO';
    $('dWeapon').textContent = m.k && m.k !== m.v ? (WNAME[m.w] || '') + (m.hs ? ' · NA CABEÇA' : '') : (WNAME[m.w] || '');
    renderDeathLoadout(); $('death').hidden = !!(sess.match && sess.match.state === 'end');
    if (document.pointerLockElement) { /* mantém o cursor preso para continuar jogando */ }
  }
  function renderDeathLoadout() {
    $('dLoadout').innerHTML = ZH.PRIMARIES.map(k => `<button class="chip${k === cfg.primary ? ' on' : ''}" data-w="${k}">${WEAPONS[k].name}</button>`).join('');
  }
  $('dLoadout').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; cfg.primary = b.dataset.w; saveCfg(); renderDeathLoadout(); if (net) net.send({ t: 'lo', primary: cfg.primary, cls: cfg.cls, fem: cfg.fem }); });
  function showEnd() {
    const m = sess.match; let title = 'EMPATE', sub = 'FIM DE PARTIDA';
    if (sess.mode === 'tdm') { title = m.win === 'draw' ? 'EMPATE' : m.win === sess.team ? 'VITÓRIA' : 'DERROTA'; sub = `${ZH.TEAMS.A.name} ${m.sA} × ${m.sB} ${ZH.TEAMS.B.name}`; }
    else if (sess.mode === 'ffa') { title = m.win === sess.me ? 'VITÓRIA' : 'DERROTA'; sub = m.win && m.win !== 'draw' ? `VENCEDOR: ${nameOf(m.win)}` : 'FIM DE PARTIDA'; }
    else { title = 'FIM DA LINHA'; sub = `VOCÊS RESISTIRAM ATÉ A ONDA ${m.wave}`; }
    $('eTitle').textContent = title; $('eTitle').style.color = title === 'VITÓRIA' ? 'var(--amber)' : title === 'DERROTA' || title === 'FIM DA LINHA' ? 'var(--red)' : 'var(--hud)';
    $('eSub').textContent = sub; $('eBoard').innerHTML = boardHTML(sess.board); $('end').hidden = false; $('death').hidden = true;
    sTone(title === 'VITÓRIA' ? 660 : 220, 0.14, 0.4, 'triangle'); sTone(title === 'VITÓRIA' ? 990 : 165, 0.14, 0.6, 'triangle', 0.3);
  }
  $('eQuit').addEventListener('click', () => toMenu());

  // ============================================================ ARMA EM 1ª PESSOA
  function showVM(id) { for (const k in VM.models) VM.models[k].g.visible = false; vmCur = VM.models[id]; vmCur.g.visible = true; P.trig = true; }
  let flashT = 0;
  function ejectShell() { if (!vmCur) return; const s = shells[shellI++ % shells.length]; s.m.position.copy(vmCur.port).applyMatrix4(vmCur.g.matrix); s.v.set(rnd(1.2, 1.8), rnd(0.8, 1.3), rnd(0.1, 0.5)); s.m.rotation.set(Math.random() * 3, 0, Math.PI / 2); s.t = 0.55; s.m.visible = true; }
  function tryFire() {
    if (!P.alive || P.reload > 0 || P.fireCd > 0 || P.sprint || P.switchT > 0 || P.throwT > 0 || P.meleeT > 0 || (sess.match && sess.match.state === 'end')) return;
    const W = curW(), slot = P.slot;
    if (!W.auto && !P.trig) return;
    if (P.mag[slot] <= 0) { if (P.res[slot] > 0) startReload(); else if (P.trig) { sTone(1200, 0.05, 0.03); P.trig = false; } return; }
    P.trig = false; P.mag[slot]--; P.fireCd = 60 / W.rpm; P.inspectT = 0;
    const moving = Math.hypot(P.vx, P.vz) / 5;
    let spread = lerp(W.spread[0], W.spread[1], P.ads) + P.bloom + moving * lerp(0.018, 0.005, P.ads) + (P.onGround ? 0 : 0.04);
    if (P.crouch) spread *= 0.8; if (W.type === 'sniper' && P.ads < 0.9) spread = Math.max(spread, W.spread[0]);
    P.bloom = Math.min(P.bloom + lerp(W.bloom, W.bloom * 0.35, P.ads), 0.03);
    const eye = camera.position, dirs = [];
    for (let i = 0; i < W.pellets; i++) { const d = V3(rnd(-spread, spread), rnd(-spread, spread), -1).normalize().applyQuaternion(camera.quaternion); dirs.push(d); }
    if (net) net.send({ t: 'f', w: slot, o: [+eye.x.toFixed(3), +eye.y.toFixed(3), +eye.z.toFixed(3)], d: dirs.map(d => [+d.x.toFixed(4), +d.y.toFixed(4), +d.z.toFixed(4)]) });
    vmCur.g.updateMatrix();
    const muzzle = vmCur.muzzle.clone().applyMatrix4(vmCur.g.matrix).applyMatrix4(camera.matrixWorld);
    dirs.forEach((d, i) => {
      const wh = ZH.rayWorld(eye.x, eye.y, eye.z, d.x, d.y, d.z, W.maxRange); let tEnd = wh ? wh.t : W.maxRange, hitP = null;
      for (const R of sess.players.values()) { if (!R.alive || !R.cur || isFriend(R)) continue; const h = ZH.rayPlayer(eye.x, eye.y, eye.z, d.x, d.y, d.z, R.cur.x, R.cur.y, R.cur.z, R.cur.f & 1, tEnd); if (h && h.t < tEnd) { tEnd = h.t; hitP = R; } }
      const end = eye.clone().addScaledVector(d, tEnd);
      if (hitP) { puffAt(end, 0x7a2a20, 0.35, 0.3); if (hitP.s) { hitP.s.a.hit = 1; hitP.s.a.hitSide = Math.random() < 0.5 ? -1 : 1; } }
      else if (wh) { _n.set(wh.nx, wh.ny, wh.nz); decalAt(end, _n); if (i < 3) { sparkAt(end, _n, 4); puffAt(end, 0xb8ad98, 0.6, 0.45); } }
      if (i < 2 && Math.random() < 0.6) tracer(muzzle, end, false);
    });
    P.kick = Math.min(P.kick + (W.type === 'sniper' || W.type === 'shotgun' ? 2 : 1), 2.4);
    P.recoil += lerp(W.recoil, W.recoil * 0.55, P.ads); P.yaw += rnd(-0.004, 0.004) * (W.type === 'smg' ? 1.4 : 1);
    vmCur.flash.visible = true; vmCur.flash.rotation.z = Math.random() * 6; vmCur.flash.scale.setScalar(rnd(0.8, 1.25)); flashT = 0.045;
    worldFlash.position.copy(muzzle);
    if (W.type === 'sniper') P.boltT = 0.9; else if (W.type === 'shotgun') P.pumpT = 0.55; else ejectShell();
    shotSound(W.id);
  }
  function startReload() {
    const W = curW(), s = P.slot; if (!P.alive || P.reload > 0 || P.mag[s] >= W.mag || P.res[s] <= 0 || P.switchT > 0 || P.throwT > 0) return;
    P.reload = W.reload; P.reloadSlot = s; P.inspectT = 0; if (isTouch) { P.adsWant = false; $('bAds').classList.remove('act'); }
    if (net) net.send({ t: 'r', w: s });
    sTone(320, 0.12, 0.05, 'square', 0.1); sTone(240, 0.12, 0.05, 'square', W.reload * 0.45); sTone(520, 0.14, 0.06, 'square', W.reload * 0.85);
  }
  function swapWeapon() { if (!P.alive || P.switchT > 0 || P.throwT > 0 || P.meleeT > 0) return; P.slot = 1 - P.slot; P.switchT = 0.5; P.reload = 0; P.inspectT = 0; sTone(260, 0.08, 0.05, 'square'); }
  function throwNade() { if (!P.alive || P.nades <= 0 || P.throwT > 0 || P.switchT > 0 || P.meleeT > 0) return; P.throwT = 0.6; P.nadeSent = false; P.nades--; P.reload = 0; sTone(700, 0.06, 0.04, 'square'); }
  function melee() { if (!P.alive || P.meleeT > 0 || P.throwT > 0) return; P.meleeT = 0.45; P.reload = 0; if (net) net.send({ t: 'm' }); if (AC) sGun(0.15, 2500, 0.15, 0); }
  function toggleCrouch() { if (!P.alive) return; P.crouch = !P.crouch; $('bCrouch').classList.toggle('act', P.crouch); }

  function updateViewModel(dt) {
    const W = curW();
    if (P.switchT > 0) { P.switchT -= dt; if (P.switchT <= 0.25 && vmCur && vmCur.id !== W.id) showVM(W.id); }
    if (!vmCur || !P.alive) return;
    const m = vmCur; const base = _v.copy(m.hip).lerp(m.ads, P.ads);
    const spd = Math.hypot(P.vx, P.vz), bobAmt = clamp(spd / 5, 0, 1.4) * (1 - P.ads * 0.85);
    const bx = Math.sin(P.bob) * 0.011 * bobAmt, by = -Math.abs(Math.cos(P.bob)) * 0.012 * bobAmt;
    const breathe = Math.sin(now * 1.6) * 0.002 * (1 - P.ads);
    let px = base.x + bx + P.swayX * (1 - P.ads * 0.8), py = base.y + by + breathe + P.swayY * (1 - P.ads * 0.8), pz = base.z + P.kick * (W.type === 'sniper' || W.type === 'shotgun' ? 0.045 : 0.028);
    let rx = P.kick * (W.type === 'pistol' ? 0.12 : 0.05), ry = 0, rz = 0;
    if (P.sprint) { px += 0.04; py -= 0.05; ry = 0.65; rz = 0.25; rx -= 0.15; }
    if (P.crouch && P.ads < 0.5) rz += 0.06;
    let lower = 0;
    if (P.switchT > 0) { const t = 1 - P.switchT / 0.5; lower = t < 0.5 ? t * 2 : (1 - t) * 2; }
    if (P.throwT > 0) { const t = 1 - P.throwT / 0.6; lower = Math.max(lower, Math.sin(Math.min(t, 1) * Math.PI)); }
    if (P.meleeT > 0) { const t = 1 - P.meleeT / 0.45; lower = Math.max(lower, Math.sin(t * Math.PI)); }
    py -= lower * 0.3; rx -= lower * 0.7;
    if (P.reload > 0) {
      const t = 1 - P.reload / W.reload, s = Math.sin(t * Math.PI); rx -= s * 0.45; rz += s * 0.55; py -= s * 0.07;
      if (m.mag) m.mag.position.y = m.magY - (t > 0.2 && t < 0.62 ? Math.sin((t - 0.2) / 0.42 * Math.PI) * 0.22 : 0);
      if (m.pump) m.pump.position.z = m.pumpZ + (t > 0.85 ? Math.sin((t - 0.85) / 0.15 * Math.PI) * 0.08 : 0);
    } else if (m.mag) m.mag.position.y = m.magY;
    if (P.pumpT > 0 && m.pump) { P.pumpT -= dt; const t = 1 - P.pumpT / 0.55; if (t > 0.3) { m.pump.position.z = m.pumpZ + Math.sin((t - 0.3) / 0.7 * Math.PI) * 0.09; if (t > 0.55 && !P.pumpShell) { P.pumpShell = true; ejectShell(); } } rz += Math.sin(t * Math.PI) * 0.08; } else { P.pumpShell = false; if (m.pump && P.reload <= 0) m.pump.position.z = m.pumpZ; }
    if (P.boltT > 0 && m.bolt) { P.boltT -= dt; const t = 1 - P.boltT / 0.9; if (t > 0.35) { const s = Math.sin((t - 0.35) / 0.65 * Math.PI); m.bolt.rotation.x = s * 1.2; m.bolt.position.z = 0.08 + s * 0.05; rz += s * 0.12; py -= s * 0.02; if (t > 0.6 && !P.boltShell) { P.boltShell = true; ejectShell(); } } } else { P.boltShell = false; if (m.bolt) { m.bolt.rotation.x = 0; m.bolt.position.z = 0.08; } }
    if (m.slide) m.slide.position.z = -0.02 + Math.min(P.kick, 1) * 0.03 + (P.mag[P.slot] === 0 ? 0.03 : 0);
    if (P.inspectT > 0) { P.inspectT -= dt; const t = 1 - P.inspectT / 2.2, s = Math.sin(t * Math.PI); ry += s * 0.9; rz += s * 0.5; px -= s * 0.08; py += s * 0.03; }
    m.g.position.set(px, py, pz);
    m.g.rotation.x = lerp(m.g.rotation.x, rx, 1 - Math.exp(-18 * dt)); m.g.rotation.y = lerp(m.g.rotation.y, ry, 1 - Math.exp(-10 * dt)); m.g.rotation.z = lerp(m.g.rotation.z, rz, 1 - Math.exp(-10 * dt));
    m.g.updateMatrix();
    const scoped = W.scope && P.ads > 0.85 && P.reload <= 0;
    m.g.visible = !scoped && P.meleeT <= 0.0001 && !(P.throwT > 0 && P.throwT < 0.45); hud.scope.hidden = !scoped;
    // faca
    if (P.meleeT > 0) {
      P.meleeT -= dt; const t = 1 - P.meleeT / 0.45; VM.knife.visible = true;
      VM.knife.position.set(lerp(0.3, -0.25, clamp((t - 0.15) / 0.5, 0, 1)), -0.12 + Math.sin(t * Math.PI) * 0.05, -0.38); VM.knife.rotation.set(-0.2, lerp(0.9, -0.6, t), lerp(-0.5, 0.4, t));
      if (P.meleeT <= 0) VM.knife.visible = false;
    }
    // granada
    if (P.throwT > 0) {
      P.throwT -= dt; const t = 1 - P.throwT / 0.6; VM.nadeHand.visible = t < 0.5;
      VM.nadeHand.position.set(-0.12 + t * 0.15, -0.28 + Math.sin(t * Math.PI) * 0.2, -0.36 - t * 0.1); VM.nadeHand.rotation.set(-0.3 - t, 0, 0);
      if (t >= 0.45 && !P.nadeSent) {
        P.nadeSent = true; const f = V3(0, 0, -1).applyQuaternion(camera.quaternion); const o = camera.position.clone().addScaledVector(f, 0.4);
        const v = f.clone().multiplyScalar(16).add(V3(P.vx * 0.5, 3.5, P.vz * 0.5));
        if (net) net.send({ t: 'n', o: [o.x, o.y, o.z], v: [v.x, v.y, v.z] }); sGun(0.08, 1800, 0.1, 0);
      }
      if (P.throwT <= 0) VM.nadeHand.visible = false;
    }
    if (flashT > 0) { flashT -= dt; gunFlashLight.intensity = 6; worldFlash.intensity = 3; gunFlashLight.position.set(m.g.position.x, m.g.position.y, m.g.position.z - 0.6); if (flashT <= 0) { m.flash.visible = false; gunFlashLight.intensity = 0; worldFlash.intensity = 0; } }
  }

  // ============================================================ JOGADOR LOCAL
  let aimAcc = 0;
  function updatePlayer(dt) {
    const W = curW();
    if (!P.alive) {
      P.deadT += dt;
      camera.position.y = lerp(camera.position.y, P.y + 0.4, 1 - Math.exp(-4 * dt)); camera.rotation.z = lerp(camera.rotation.z, 0.5, 1 - Math.exp(-3 * dt)); camera.updateMatrixWorld();
      const tl = $('dTimer'); tl.textContent = sess.mode === 'surv' ? 'AGUARDE O FIM DA ONDA PARA VOLTAR' : `RENASCENDO EM ${Math.max(0, Math.ceil(P.respawnAt - now))}`;
      return;
    }
    let ix = 0, iz = 0;
    if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
    ix += joy.x; iz += joy.y; const mm = Math.hypot(ix, iz); if (mm > 1) { ix /= mm; iz /= mm; }
    const joyMag = Math.hypot(joy.x, joy.y);
    P.sprint = ((keys.ShiftLeft || keys.ShiftRight) || (joyMag > 0.93 && joy.y < -0.6)) && iz < -0.3 && P.ads < 0.3 && !firing && P.reload <= 0 && P.throwT <= 0;
    if (P.sprint && P.crouch) { P.crouch = false; $('bCrouch').classList.remove('act'); }
    const speed = (P.sprint ? ZH.PLAYER.sprint : P.crouch ? ZH.PLAYER.crouch : lerp(ZH.PLAYER.walk, ZH.PLAYER.ads, P.ads)) * W.move;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const wx = (ix * cy + iz * sy) * speed, wz = (-ix * sy + iz * cy) * speed;
    const acc = P.onGround ? 12 : 3; P.vx = lerp(P.vx, wx, 1 - Math.exp(-acc * dt)); P.vz = lerp(P.vz, wz, 1 - Math.exp(-acc * dt));
    const o = { x: P.x + P.vx * dt, z: P.z + P.vz * dt, feet: P.y }; ZH.resolve(o, ZH.PLAYER.radius); P.x = o.x; P.z = o.z;
    const gh = ZH.groundAt(P.x, P.z, ZH.PLAYER.radius, P.y);
    if (jumpReq) { if (P.crouch) { P.crouch = false; $('bCrouch').classList.remove('act'); } else if (P.onGround) { P.vy = ZH.PLAYER.jump; P.onGround = false; } } jumpReq = false;
    P.vy -= ZH.PLAYER.gravity * dt; P.y += P.vy * dt;
    if (P.y <= gh) { if (!P.onGround && P.vy < -6) sTone(120, 0.12, 0.08, 'sine'); P.y = gh; P.vy = 0; P.onGround = true; } else if (P.y > gh + 0.05) P.onGround = false;
    P.cr = lerp(P.cr, P.crouch ? 1 : 0, 1 - Math.exp(-12 * dt));
    P.fireCd -= dt; P.bloom = Math.max(0, P.bloom - dt * 0.09);
    if (firing) tryFire(); else P.trig = true;
    if (P.reload > 0) { P.reload -= dt; if (P.reload <= 0) { P.reload = 0; const s = P.reloadSlot, RW = WEAPONS[weaponId(s)], take = Math.min(RW.mag - P.mag[s], P.res[s]); P.mag[s] += take; P.res[s] -= take; } }
    if (P.mag[P.slot] === 0 && P.res[P.slot] > 0 && P.reload <= 0 && P.fireCd <= 0 && P.switchT <= 0 && P.throwT <= 0) startReload();
    const adsT = (P.adsWant && P.reload <= 0 && !P.sprint && P.switchT <= 0 && P.throwT <= 0 && P.meleeT <= 0) ? 1 : 0; P.ads = lerp(P.ads, adsT, 1 - Math.exp(-(W.scope ? 10 : 14) * dt));
    const fov = lerp(cfg.fov, W.adsFov * cfg.fov / 72, P.ads); if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const rc = P.recoil * Math.min(1, dt * 18); P.pitch += rc; P.recoil -= rc;
    P.pitch = clamp(P.pitch, -1.45, 1.45); P.kick = Math.max(0, P.kick - dt * 14);
    // assistência de mira (toque)
    aimTarget = null; let bestA = 0.06;
    for (const R of sess.players.values()) {
      if (!R.alive || !R.cur || isFriend(R)) continue; const dx = R.cur.x - P.x, dz = R.cur.z - P.z, dyy = R.cur.y + (R.cur.f & 1 ? 0.95 : 1.35) - camera.position.y, d = Math.hypot(dx, dz);
      if (d > 80) continue; const yaw = Math.atan2(-dx, -dz), pit = Math.atan2(dyy, d); const da = Math.atan2(Math.sin(yaw - P.yaw), Math.cos(yaw - P.yaw)), dp = pit - P.pitch; const a = Math.hypot(da, dp * 1.4);
      if (a < bestA + 0.04 / Math.max(1, d / 10)) { bestA = a; aimTarget = R; aimTarget._da = da; aimTarget._dp = dp; }
    }
    aimAcc -= dt; if (aimTarget && aimAcc <= 0) { aimAcc = 0.15; aimTarget._los = ZH.los(camera.position.x, camera.position.y, camera.position.z, aimTarget.cur.x, aimTarget.cur.y + 1.3, aimTarget.cur.z); }
    if (aimTarget && aimTarget._los === false) aimTarget = null;
    hud.cross.classList.toggle('enemy', !!aimTarget);
    if (isTouch && cfg.assist && aimTarget && (firing || lookActive || P.ads > 0.5)) { const st = P.ads > 0.5 ? 4 : 2.6; P.yaw += aimTarget._da * Math.min(1, dt * st); P.pitch += aimTarget._dp * Math.min(1, dt * st * 0.7); }
    const spd = Math.hypot(P.vx, P.vz); if (P.onGround) P.bob += dt * spd * 1.55;
    const bobAmt = clamp(spd / 5, 0, 1.4) * (1 - P.ads * 0.8);
    P.shake = Math.max(0, P.shake - dt);
    const eye = lerp(ZH.PLAYER.eye, ZH.PLAYER.eyeCrouch, P.cr);
    camera.position.set(P.x, P.y + eye + Math.abs(Math.sin(P.bob)) * 0.045 * bobAmt, P.z);
    camera.rotation.set(P.pitch + (Math.random() - 0.5) * P.shake * 0.05, P.yaw + (Math.random() - 0.5) * P.shake * 0.05, Math.sin(P.bob) * 0.006 * bobAmt);
    camera.updateMatrixWorld();
    P.swayX = lerp(P.swayX, 0, 1 - Math.exp(-8 * dt)); P.swayY = lerp(P.swayY, 0, 1 - Math.exp(-8 * dt));
    sendAcc += dt; if (sendAcc >= 0.05 && net) { sendAcc = 0; net.send({ t: 's', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(2), cr: P.crouch ? 1 : 0, sp: P.sprint ? 1 : 0, ads: P.ads > 0.5 ? 1 : 0, w: P.slot }); }
  }
  function updateFx(dt) {
    for (const s of sparks) { if (!s.m.visible) continue; s.t -= dt; if (s.t <= 0) { s.m.visible = false; continue; } s.v.y -= 14 * dt; s.m.position.addScaledVector(s.v, dt); }
    for (const s of shells) { if (!s.m.visible) continue; s.t -= dt; if (s.t <= 0) { s.m.visible = false; continue; } s.v.y -= 9 * dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.x += dt * 18; s.m.rotation.y += dt * 9; }
    for (const u of puffs) { if (!u.s.visible) continue; u.t += dt; const k = u.t / u.life; if (k >= 1) { u.s.visible = false; continue; } u.s.scale.setScalar(u.size * (0.4 + k)); u.s.material.opacity = u.op * (1 - k); u.s.position.y += dt * u.rise; }
    for (const t of tracers) {
      if (!t.m.visible) continue; t.t += dt; const k = t.t / t.dur; if (k >= 1) { t.m.visible = false; continue; }
      const Ln = Math.min(5, t.len); const head = Math.min(t.len, k * t.len + Ln); const tail = Math.max(0, head - Ln);
      _v.copy(t.b).sub(t.a).normalize(); const mid = _v2.copy(t.a).addScaledVector(_v, (head + tail) / 2); t.m.position.copy(mid); t.m.scale.set(1, 1, Math.max(0.01, head - tail)); _v.add(mid); t.m.lookAt(_v);
    }
    for (const mesh of nadeMeshes.values()) { const to = mesh.userData.to; if (to) { mesh.position.x = lerp(mesh.position.x, to[0], 1 - Math.exp(-20 * dt)); mesh.position.y = lerp(mesh.position.y, to[1], 1 - Math.exp(-20 * dt)); mesh.position.z = lerp(mesh.position.z, to[2], 1 - Math.exp(-20 * dt)); mesh.rotation.x += dt * 6; } }
    if (boomT > 0) { boomT -= dt; boomLight.intensity = Math.max(0, boomT / 0.25) * 14; }
    if (hitT > 0) { hitT -= dt; if (hitT <= 0) hud.hitm.style.opacity = 0; }
  }

  // ============================================================ ENTRADA
  const joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 }; let lookActive = false;
  function lookDelta(dx, dy, touch) {
    const fovK = camera.fov / cfg.fov; const base = (touch ? 0.0058 : 0.0022) * fovK;
    P.yaw -= dx * base * cfg.sensH; P.pitch = clamp(P.pitch - dy * base * cfg.sensV * (cfg.inv ? -1 : 1), -1.45, 1.45);
    P.swayX = clamp(P.swayX - dx * 0.00012, -0.03, 0.03); P.swayY = clamp(P.swayY + dy * 0.00012, -0.03, 0.03);
  }
  const touchEl = $('touch'), joyBase = $('joyBase'), joyKnob = $('joyKnob'); const looks = new Map();
  touchEl.addEventListener('pointerdown', e => {
    if (ui !== 'game' || paused || e.target !== touchEl) return; e.preventDefault(); try { touchEl.setPointerCapture(e.pointerId); } catch (_) { }
    if (e.clientX < innerWidth * 0.42 && joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joyBase.style.left = e.clientX + 'px'; joyBase.style.top = e.clientY + 'px'; joyBase.classList.add('on'); }
    else { looks.set(e.pointerId, { x: e.clientX, y: e.clientY }); lookActive = true; }
  });
  touchEl.addEventListener('pointermove', e => {
    if (e.pointerId === joy.id) { let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy; const d = Math.hypot(dx, dy), R = 56 * cfg.btn; if (d > R) { dx = dx / d * R; dy = dy / d * R; } joy.x = dx / R; joy.y = dy / R; joyKnob.style.transform = `translate(${dx}px,${dy}px)`; }
    else if (looks.has(e.pointerId)) { const l = looks.get(e.pointerId); lookDelta(e.clientX - l.x, e.clientY - l.y, true); l.x = e.clientX; l.y = e.clientY; }
  });
  function tEnd(e) { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; joyKnob.style.transform = ''; joyBase.classList.remove('on'); joyBase.style.left = ''; joyBase.style.top = ''; } looks.delete(e.pointerId); lookActive = looks.size > 0; }
  touchEl.addEventListener('pointerup', tEnd); touchEl.addEventListener('pointercancel', tEnd);
  function bindBtn(id, down, up, look) {
    const el = $(id); let cur = null;
    el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (_) { } el.classList.add('on'); cur = { x: e.clientX, y: e.clientY, id: e.pointerId }; initAudio(); down && down(); });
    el.addEventListener('pointermove', e => { if (look && cur && e.pointerId === cur.id) { lookDelta(e.clientX - cur.x, e.clientY - cur.y, true); cur.x = e.clientX; cur.y = e.clientY; } });
    const end = e => { if (!cur || e.pointerId !== cur.id) return; cur = null; el.classList.remove('on'); up && up(); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  let fireBtns = 0;
  bindBtn('bFire', () => { fireBtns++; firing = true; }, () => { fireBtns = Math.max(0, fireBtns - 1); firing = fireBtns > 0; }, true);
  bindBtn('bFireL', () => { fireBtns++; firing = true; }, () => { fireBtns = Math.max(0, fireBtns - 1); firing = fireBtns > 0; }, false);
  bindBtn('bAds', () => { P.adsWant = !P.adsWant; $('bAds').classList.toggle('act', P.adsWant); });
  bindBtn('bJump', () => { jumpReq = true; });
  bindBtn('bCrouch', toggleCrouch);
  bindBtn('bRel', startReload);
  bindBtn('bSwap', swapWeapon);
  bindBtn('bNade', throwNade);
  bindBtn('bMelee', melee);
  bindBtn('bBoard', () => setBoard(!boardOpen));
  bindBtn('bPause', () => pause());
  function setBoard(v) { boardOpen = v; $('board').hidden = !v; renderBoard(); $('bBoard').classList.toggle('act', v); }

  let locked = false, wasLocked = false;
  const cvs = renderer.domElement;
  addEventListener('mousedown', e => { if (ui !== 'game' || paused || isTouch) return; if (!locked) reqLock(); if (e.button === 0) firing = true; if (e.button === 2) P.adsWant = true; });
  addEventListener('mouseup', e => { if (isTouch) return; if (e.button === 0) firing = false; if (e.button === 2) P.adsWant = false; });
  addEventListener('mousemove', e => { if (ui !== 'game' || paused || isTouch) return; if (locked || (e.buttons & 1)) lookDelta(e.movementX || 0, e.movementY || 0, false); });
  addEventListener('wheel', e => { if (ui === 'game' && !paused && Math.abs(e.deltaY) > 20) swapWeapon(); }, { passive: true });
  addEventListener('contextmenu', e => { if (ui === 'game') e.preventDefault(); });
  addEventListener('keydown', e => {
    if (ui !== 'game') return; if (e.target && e.target.tagName === 'INPUT') return;
    keys[e.code] = true;
    if (paused) { if (e.code === 'Escape' || e.code === 'KeyP') resume(); return; }
    switch (e.code) {
      case 'Space': jumpReq = true; e.preventDefault(); break;
      case 'KeyR': startReload(); break;
      case 'KeyC': case 'ControlLeft': toggleCrouch(); e.preventDefault(); break;
      case 'KeyG': throwNade(); break;
      case 'KeyV': case 'KeyE': melee(); break;
      case 'KeyQ': swapWeapon(); break;
      case 'Digit1': if (P.slot !== 0) swapWeapon(); break;
      case 'Digit2': if (P.slot !== 1) swapWeapon(); break;
      case 'KeyF': if (P.alive && P.reload <= 0 && !firing) P.inspectT = 2.2; break;
      case 'Tab': setBoard(true); e.preventDefault(); break;
      case 'KeyP': pause(); break;
    }
  });
  addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'Tab') setBoard(false); });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; });
  function reqLock() { try { const r = cvs.requestPointerLock && cvs.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { } }
  document.addEventListener('pointerlockchange', () => { locked = document.pointerLockElement === cvs; if (locked) wasLocked = true; else if (ui === 'game' && wasLocked && !isTouch && !paused) { wasLocked = false; pause(); } });

  // ============================================================ TELAS
  function showScreen(name) {
    ui = name === 'loading' ? 'loading' : name;
    $('menu').hidden = name !== 'menu'; $('loading').hidden = name !== 'loading';
    const inGame = name === 'game'; $('hud').hidden = !inGame; $('touch').hidden = !(inGame && isTouch);
    if (!inGame) { $('pause').hidden = true; $('death').hidden = true; $('end').hidden = true; setBoard(false); }
    lineup.forEach(s => s.root.visible = name === 'menu' || name === 'loading');
  }
  function startGameUI() {
    showScreen('game'); paused = false; lastHud = '';
    if (!isTouch) reqLock();
    else { try { const fs = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (fs && fs.catch) fs.catch(() => { }); } catch (e) { } }
    try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { }
  }
  function pause() {
    if (ui !== 'game' || paused) return; paused = true; firing = false; fireBtns = 0; joy.x = joy.y = 0;
    $('pause').hidden = false; $('touch').hidden = true;
    $('pSub').textContent = sess.local ? 'TREINO PAUSADO' : 'MENU · A PARTIDA CONTINUA';
    $('pInfo').innerHTML = sess.room && sess.room.priv && !sess.local ? `Código da sala: <b>${esc(sess.room.code)}</b> — passe para os amigos entrarem.` : sess.local ? 'Os bots esperam você voltar.' : 'Você continua no mapa enquanto este menu está aberto.';
  }
  function resume() { if (!paused) return; paused = false; $('pause').hidden = true; $('touch').hidden = !isTouch; if (!isTouch) reqLock(); if (AC && AC.state === 'suspended') AC.resume(); }
  function toMenu() {
    leave(); clearSession(); P.alive = false; paused = false;
    camera.fov = cfg.fov; camera.updateProjectionMatrix(); camera.rotation.z = 0; hud.scope.hidden = true;
    for (const k in VM.models) VM.models[k].g.visible = false; VM.knife.visible = VM.nadeHand.visible = false;
    showScreen('menu'); try { document.exitPointerLock && document.exitPointerLock(); } catch (e) { }
    checkServer();
  }
  $('resume').addEventListener('click', resume); $('quit').addEventListener('click', toMenu);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  addEventListener('resize', () => { applyQuality(); camera.aspect = gunCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); gunCam.updateProjectionMatrix(); });

  // ============================================================ MENU
  const lineup = []; const LINE_Z = 24;
  function buildLineup() {
    for (const s of lineup) scene.remove(s.root); lineup.length = 0;
    ZH.CLASS_KEYS.forEach((k, i) => { const s = ZHA.makeSoldier(k, cfg.fem, [0, 3, 1, 2, 4][i], 'neutral', CLASSES[k].bot.w); s.root.position.set((i - 2) * 1.6, 0, LINE_Z); s.root.rotation.y = -(i - 2) * 0.1; s.a.look = 1; s.a.t = i * 1.3; scene.add(s.root); lineup.push(s); });
    const i = ZH.CLASS_KEYS.indexOf(cfg.cls); if (lineup[i]) ZHA.setSoldierWeapon(lineup[i], cfg.primary);
  }
  const camT = V3(0, 1.1, LINE_Z), camP = V3(0, 1.5, LINE_Z + 3.4);
  function updateMenu(dt) {
    const i = ZH.CLASS_KEYS.indexOf(cfg.cls), sx = (i - 2) * 1.6, asp = innerWidth / innerHeight, off = asp > 1.1 ? 1.05 : asp > 0.8 ? 0.5 : 0, k = 1 - Math.exp(-4 * dt);
    camP.lerp(_v.set(sx - off * 0.55, asp > 0.8 ? 1.45 : 1.25, LINE_Z + (asp > 0.8 ? 3.3 : 4.2)), k); camT.lerp(_v2.set(sx - off, asp > 0.8 ? 1.05 : 0.8, LINE_Z), k);
    camera.position.copy(camP); camera.lookAt(camT);
    for (const s of lineup) ZHA.animSoldier(s, dt, { speed: 0, moveYaw: 0, yaw: 0, aim: false, aimPitch: 0, crouch: false, sprint: false });
  }
  function renderOpUI() {
    $('opClass').innerHTML = ZH.CLASS_KEYS.map(k => `<button class="chip${k === cfg.cls ? ' on' : ''}" data-k="${k}">${CLASSES[k].name}</button>`).join('');
    [...$('opSex').children].forEach(b => b.classList.toggle('on', (b.dataset.f === '1') === cfg.fem));
    const C = CLASSES[cfg.cls]; $('opDesc').innerHTML = `<b>${C.name}</b>${C.desc}`;
    $('opWeapon').innerHTML = ZH.PRIMARIES.map(k => `<button class="chip${k === cfg.primary ? ' on' : ''}" data-w="${k}">${WEAPONS[k].name}</button>`).join('');
    const W = WEAPONS[cfg.primary]; const dmg = W.dmg * W.pellets;
    const bars = [['DANO', Math.min(1, dmg / 110)], ['CADÊNCIA', Math.min(1, W.rpm / 950)], ['ALCANCE', Math.min(1, W.range[1] / 120)], ['MOBILIDADE', (W.move - 0.8) / 0.35], ['PENTE', Math.min(1, W.mag / 35)]];
    $('wStats').innerHTML = `<div class="opdesc"><b>${W.name}</b>${W.kind.toLowerCase()} · ${W.mag} tiros · ${W.rpm} disparos/min</div>` + bars.map(([n, v]) => `<div class="stat"><span>${n}</span><i><b style="width:${Math.round(clamp(v, 0.05, 1) * 100)}%"></b></i></div>`).join('');
  }
  $('opClass').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; cfg.cls = b.dataset.k; saveCfg(); ZHA.setSleeves(VM, cfg.cls); buildLineup(); renderOpUI(); });
  $('opSex').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; const f = b.dataset.f === '1'; if (f !== cfg.fem) { cfg.fem = f; buildLineup(); } saveCfg(); renderOpUI(); });
  $('opWeapon').addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (!b) return; cfg.primary = b.dataset.w; saveCfg(); buildLineup(); renderOpUI(); });
  $('cfgName').value = cfg.name; $('cfgName').addEventListener('change', () => { cfg.name = ZH.cleanName($('cfgName').value); $('cfgName').value = cfg.name; saveCfg(); });
  document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => { document.querySelectorAll('.tab-btn').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.tabp').forEach(p => p.hidden = p.dataset.p !== b.dataset.tab); if (b.dataset.tab === 'ranking') loadRanking(); }));
  $('quickModes').innerHTML = Object.entries(MODES).map(([k, m]) => `<button class="mode" data-m="${k}"><em>${m.short}</em><b>${m.name}</b><small>${m.desc}</small></button>`).join('');
  $('quickModes').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b || b.disabled) return; connect({ online: true, mode: b.dataset.m }); });
  $('pvCreate').addEventListener('click', () => connect({ online: true, mode: $('pvMode').value, create: true, bots: $('pvBots').checked }));
  $('pvJoin').addEventListener('click', () => { const c = $('pvCode').value.trim().toUpperCase(); if (c.length !== 4) { toast('O código da sala tem 4 letras ou números.'); return; } connect({ online: true, mode: 'tdm', code: c }); });
  $('pvCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('pvJoin').click(); });
  $('trStart').addEventListener('click', () => connect({ online: false, mode: $('trMode').value }));
  $('keys').innerHTML = isTouch
    ? '<span><b>JOYSTICK</b>mover · até o fim para correr</span><span><b>ARRASTE</b>na direita para mirar</span><span><b>BOTÕES</b>mira, agachar, granada, faca, trocar arma</span><span><b>DICA</b>jogue na horizontal</span>'
    : '<span><b>WASD</b>mover</span><span><b>MOUSE</b>mirar · clique atira</span><span><b>BOTÃO DIR.</b>mira</span><span><b>R</b>recarregar</span><span><b>Q / 1 / 2</b>trocar arma</span><span><b>C</b>agachar</span><span><b>G</b>granada</span><span><b>V</b>faca</span><span><b>SHIFT</b>correr</span><span><b>TAB</b>placar</span><span><b>F</b>inspecionar</span><span><b>ESC</b>menu</span>';
  // ajustes
  const sets = [['sSensH', 'sensH', v => v.toFixed(2)], ['sSensV', 'sensV', v => v.toFixed(2)], ['sFov', 'fov', v => v + '°'], ['sVol', 'vol', v => Math.round(v * 100) + '%'], ['sBtn', 'btn', v => Math.round(v * 100) + '%']];
  for (const [id, key, fmt] of sets) {
    const el = $(id), out = $('o' + id.slice(1)); el.value = cfg[key]; out.textContent = fmt(+cfg[key]);
    el.addEventListener('input', () => { cfg[key] = +el.value; out.textContent = fmt(cfg[key]); saveCfg(); applyCfg(); });
  }
  $('sQual').value = cfg.qual; $('sQual').addEventListener('change', () => { cfg.qual = $('sQual').value; saveCfg(); applyQuality(); });
  $('sInv').checked = cfg.inv; $('sInv').addEventListener('change', () => { cfg.inv = $('sInv').checked; saveCfg(); });
  $('sAssist').checked = cfg.assist; $('sAssist').addEventListener('change', () => { cfg.assist = $('sAssist').checked; saveCfg(); });
  function applyCfg() { document.documentElement.style.setProperty('--bs', cfg.btn); if (master) master.gain.value = cfg.vol; if (ui === 'menu') { camera.fov = cfg.fov; camera.updateProjectionMatrix(); } }
  applyCfg();

  let serverOk = false;
  async function checkServer() {
    const st = $('srvState');
    if (location.protocol === 'file:') { setOnline(false, 'ABRA PELO SERVIDOR PARA JOGAR ONLINE'); return; }
    try { const r = await fetch('api/status', { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json(); setOnline(true, `· ${j.online} ONLINE AGORA`); }
    catch (e) { setOnline(false, '· SERVIDOR INDISPONÍVEL — USE O TREINO'); }
    function setOnline(ok, txt) { serverOk = ok; st.textContent = txt; st.classList.toggle('off', !ok); document.querySelectorAll('#quickModes .mode').forEach(b => b.disabled = !ok); $('pvCreate').disabled = $('pvJoin').disabled = !ok; }
  }
  async function loadRanking() {
    const el = $('rankList'); el.innerHTML = '<p class="opdesc">Carregando…</p>';
    try { const r = await fetch('api/ranking', { cache: 'no-store' }); const j = await r.json(); el.innerHTML = j.top.length ? j.top.map((t, i) => `<div><span>${i + 1}</span><b>${esc(t.name)}</b><span>${t.kills} baixas</span><span>${t.hs} na cabeça</span></div>`).join('') : '<p class="opdesc">Ninguém pontuou ainda. Seja o primeiro.</p>'; }
    catch (e) { el.innerHTML = '<p class="opdesc">O ranking aparece quando o jogo roda no servidor online.</p>'; }
  }
  const qs = new URLSearchParams(location.search);
  if (qs.get('sala')) { $('pvCode').value = qs.get('sala').slice(0, 4).toUpperCase(); toast('Código da sala preenchido. Toque em ENTRAR.'); }
  if (qs.get('modo') && MODES[qs.get('modo')]) $('trMode').value = $('pvMode').value = qs.get('modo');

  // ============================================================ LAÇO PRINCIPAL
  let last = performance.now(), hudT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.max(0, Math.min((t - last) / 1000, 0.05)); last = t; now += dt;
    if (net && net.local && ui === 'game' && !paused) {
      localAcc += dt; let n = 0; while (localAcc >= 1 / 30 && n < 4) { localClock += 1000 / 30; net.room.tick(1 / 30); localAcc -= 1 / 30; n++; }
    }
    if (net && net.local) { const box = net.inbox.splice(0); for (const m of box) handle(m); }
    if (ui === 'game') {
      if (!paused || !sess.local) { updatePlayer(dt); updateRemotes(dt); updateFx(dt); }
      updateViewModel(dt); updTags();
      pingAcc += dt; if (pingAcc > 2 && net && !net.local) { pingAcc = 0; net.send({ t: 'ping', c: performance.now(), rtt: Math.round(sess.rtt) }); }
      hudT -= dt; if (hudT <= 0) { hudT = 0.06; updHud(); drawMini(); updScoreBar(); if (sess.match && sess.match.state === 'end') $('eNext').textContent = `PRÓXIMA PARTIDA EM ${Math.ceil(Math.max(0, sess.match.next - (now - sess.mAt)))} S`; }
    } else if (ui === 'menu' || ui === 'loading') updateMenu(dt);
    world.sky.position.copy(camera.position);
    renderer.clear(); renderer.render(scene, camera);
    if (ui === 'game' && P.alive) { renderer.clearDepth(); renderer.render(gunScene, gunCam); }
  }
  buildLineup(); renderOpUI(); showScreen('menu'); checkServer();
  window.__zh = { P, sess, connect, handle, get ui() { return ui; } };
  requestAnimationFrame(loop);
})();
