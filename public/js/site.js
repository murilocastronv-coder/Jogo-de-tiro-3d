/* Zona Hostil — página inicial: cena 3D ao vivo, dados reais das armas, status do servidor, edições e ranking. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  $('yr').textContent = new Date().getFullYear();

  // ---------- arsenal com os números do jogo
  const W = ZH.WEAPONS;
  const ids = ['m7', 'vespa', 'k90', 'r12', 'p9'];
  const maxDmg = Math.max(...ids.map(i => W[i].dmg * W[i].pellets)), maxRpm = Math.max(...ids.map(i => W[i].rpm));
  $('arsenalList').innerHTML = ids.map(i => {
    const w = W[i], dmg = w.dmg * w.pellets;
    const bar = (label, val, pct) => `<div class="bar"><span>${label}</span><b>${val}</b><i><s style="width:${Math.max(6, Math.round(pct * 100))}%"></s></i></div>`;
    return `<div class="gun"><div><span class="k">${w.kind}</span><h3>${w.name}</h3><div class="spec">${w.mag} no pente · recarga ${w.reload.toFixed(1).replace('.', ',')} s${w.pellets > 1 ? ` · ${w.pellets} projéteis` : ''}${w.scope ? ' · luneta' : ''}</div></div>
      <div class="bars">${bar('DANO', dmg, dmg / maxDmg)}${bar('DISPAROS/MIN', w.rpm, w.rpm / maxRpm)}${bar('ALCANCE', w.range[0] + ' M', Math.min(1, w.range[0] / 60))}${bar('NA CABEÇA', '×' + String(w.head).replace('.', ','), w.head / 2.5)}</div></div>`;
  }).join('');

  // ---------- operadores
  $('opsList').innerHTML = ZH.CLASS_KEYS.map(k => {
    const c = ZH.CLASSES[k];
    return `<article class="op"><div class="sw" aria-hidden="true">${c.camo.map(col => `<i style="background:${col}"></i>`).join('')}</div><small>ARMA PADRÃO · ${W[c.bot.w].name}</small><h3>${c.name}</h3><p>${c.desc}</p></article>`;
  }).join('');

  // ---------- edições (config.js)
  const S = window.ZH_SITE || { editions: [] };
  $('edList').innerHTML = S.editions.map(e => {
    const live = !!e.checkout;
    const btn = live ? `<a class="btn${e.featured ? '' : ' ghost'}" href="${esc(e.checkout)}"${/^https?:/.test(e.checkout) ? ' target="_blank" rel="noopener"' : ''}><span>${esc(e.cta)}</span></a>` : `<span class="btn" aria-disabled="true"><span>EM BREVE</span></span>`;
    return `<article class="ed${e.featured ? ' feat' : ''}"><h3>${esc(e.name)}</h3><div class="price">${esc(e.price)}<small>${esc(e.note)}</small></div><ul>${e.perks.map(p => `<li>${esc(p)}</li>`).join('')}</ul>${btn}</article>`;
  }).join('');
  $('edNote').textContent = S.footnote || '';

  // ---------- status do servidor e ranking
  async function status() {
    const el = $('live');
    try {
      const r = await fetch('api/status', { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json();
      el.className = 'live on'; el.querySelector('span').textContent = j.online === 1 ? '1 soldado online agora' : `${j.online} soldados online agora`;
    } catch (e) { el.className = 'live off'; el.querySelector('span').textContent = 'Servidor offline · treino disponível'; }
  }
  async function ranking() {
    const el = $('rankList');
    try {
      const r = await fetch('api/ranking', { cache: 'no-store' }); const j = await r.json();
      el.innerHTML = j.top.length ? j.top.slice(0, 8).map(t => `<li><span>${esc(t.name)}</span><b>${t.kills} BAIXAS · ${t.hs} NA CABEÇA</b></li>`).join('') : '<li class="empty">Ninguém pontuou ainda. Entre agora e seja o primeiro da lista.</li>';
    } catch (e) { el.innerHTML = '<li class="empty">O ranking aparece quando a página roda no servidor do jogo.</li>'; }
  }
  status(); ranking(); setInterval(status, 15000);

  // ---------- cena 3D do topo
  const host = $('hero3d');
  if (typeof THREE === 'undefined' || !window.ZHA) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' }); } catch (e) { return; }
  renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !small; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.25 : 1.75));
  host.appendChild(renderer.domElement);
  ZHA.init(renderer);
  const scene = new THREE.Scene();
  const world = ZHA.buildWorld(scene, { shadowSize: 1024, shadows: !small });
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 600);
  const Z = 24, squad = [];
  const poses = [{ aim: true, crouch: false }, { aim: false }, { aim: true, crouch: true }, { aim: false }, { aim: true }];
  ZH.CLASS_KEYS.forEach((k, i) => {
    const s = ZHA.makeSoldier(k, i === 1 || i === 3, [0, 3, 1, 2, 4][i], 'neutral', ZH.CLASSES[k].bot.w);
    const x = (i - 2) * 1.15 + (i % 2 ? 0.15 : -0.1), z = Z - Math.abs(i - 2) * 0.45;
    s.root.position.set(x, 0, z); s.root.rotation.y = -(i - 2) * 0.12 + (i === 0 ? 0.5 : i === 4 ? -0.45 : 0);
    s.a.look = 1; s.a.t = i * 1.7; scene.add(s.root); squad.push({ s, pose: poses[i] });
  });
  function size() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);
  let t0 = performance.now(), visible = true, tm = 0;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(host);
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min((t - t0) / 1000, 0.05)); t0 = t; if (!visible) return;
    tm += reduce ? 0 : dt;
    const wide = camera.aspect > 1.1;
    const ang = Math.sin(tm * 0.08) * 0.22;
    const lx = wide ? -1.5 : 0, dist = wide ? 6.6 : 9;
    camera.position.set(lx * 0.4 + Math.sin(ang) * dist, 1.35 + Math.sin(tm * 0.13) * 0.06, Z + Math.cos(ang) * dist);
    camera.lookAt(lx, wide ? 1.05 : 0.6, Z - 0.4);
    for (const q of squad) ZHA.animSoldier(q.s, dt, { speed: 0, moveYaw: 0, yaw: 0, aim: q.pose.aim, aimPitch: 0, crouch: q.pose.crouch, sprint: false });
    world.sky.position.copy(camera.position);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
