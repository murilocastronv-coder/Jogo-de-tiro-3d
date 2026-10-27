/* Zona Hostil — dados e regras compartilhados entre o navegador e o servidor.
   Mapa, armas, classes, colisão, raios e navegação. Sem dependências. */
(function (root) {
  'use strict';
  const ZH = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  ZH.clamp = clamp;

  // ------------------------------------------------------------------ RNG
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  ZH.rng = mulberry32;

  // ------------------------------------------------------------------ JOGADOR
  ZH.PLAYER = {
    hp: 100, radius: 0.4, eye: 1.62, eyeCrouch: 1.12,
    walk: 5, ads: 2.7, crouch: 2.4, sprint: 7.6, jump: 7.6, gravity: 24,
    regenDelay: 4000, regenRate: 32, respawn: 3000, protect: 1500, nades: 2,
  };

  // ------------------------------------------------------------------ ARMAS
  ZH.WEAPONS = {
    m7:    { id: 'm7',    name: 'FUZIL M7',     kind: 'FUZIL DE ASSALTO',   type: 'rifle',   dmg: 28,  head: 2.2, rpm: 650, mag: 30, res: 150, reload: 1.9, pellets: 1, spread: [0.024, 0.002], bloom: 0.006, recoil: 0.016, range: [28, 70],  minMul: 0.7,  auto: true,  move: 1,    adsFov: 52, maxRange: 220 },
    vespa: { id: 'vespa', name: 'VESPA 9',      kind: 'SUBMETRALHADORA',    type: 'smg',     dmg: 21,  head: 1.6, rpm: 920, mag: 32, res: 192, reload: 1.6, pellets: 1, spread: [0.022, 0.006], bloom: 0.004, recoil: 0.010, range: [12, 36],  minMul: 0.55, auto: true,  move: 1.1,  adsFov: 58, maxRange: 160 },
    k90:   { id: 'k90',   name: 'K-90',         kind: 'FUZIL DE PRECISÃO',  type: 'sniper',  dmg: 100, head: 2,   rpm: 46,  mag: 5,  res: 25,  reload: 2.6, pellets: 1, spread: [0.09, 0],      bloom: 0,     recoil: 0.075, range: [220, 240], minMul: 1,    auto: false, move: 0.9,  adsFov: 18, maxRange: 240, scope: true },
    r12:   { id: 'r12',   name: 'R12 TÁTICA',   kind: 'ESCOPETA',           type: 'shotgun', dmg: 16,  head: 1.3, rpm: 72,  mag: 6,  res: 36,  reload: 2.4, pellets: 8, spread: [0.065, 0.05],  bloom: 0,     recoil: 0.05,  range: [7, 18],    minMul: 0.25, auto: false, move: 1,    adsFov: 62, maxRange: 60 },
    p9:    { id: 'p9',    name: 'P9',           kind: 'PISTOLA',            type: 'pistol',  dmg: 30,  head: 2,   rpm: 420, mag: 12, res: 60,  reload: 1.3, pellets: 1, spread: [0.02, 0.004],  bloom: 0.004, recoil: 0.02,  range: [14, 32],  minMul: 0.6,  auto: false, move: 1.08, adsFov: 60, maxRange: 120 },
  };
  ZH.PRIMARIES = ['m7', 'vespa', 'k90', 'r12'];
  ZH.SECONDARY = 'p9';
  ZH.MELEE = { dmg: 135, range: 2.2, cone: 0.9, cooldown: 700 };
  ZH.NADE = { fuse: 2200, radius: 7, dmg: 160, maxSpeed: 22 };
  ZH.falloff = function (W, d) { if (d <= W.range[0]) return 1; if (d >= W.range[1]) return W.minMul; return 1 + (W.minMul - 1) * (d - W.range[0]) / (W.range[1] - W.range[0]); };

  // ------------------------------------------------------------------ CLASSES
  ZH.CLASSES = {
    assault:  { name: 'ASSALTO',             desc: 'Equilibrado. Rajadas de três tiros a média distância.', camo: ['#6e6a52', '#8b8062', '#4f4b38', '#a5977a', '#3b3829'], soft: true, vest: '#6b624b', gear: '#4a4535', bot: { w: 'm7', burst: 3, acc: 0, spd: 1, hp: 100, range: 17 } },
    recon:    { name: 'RECONHECIMENTO',      desc: 'Atirador de elite. Mantém distância e faz disparos únicos fortes.', camo: ['#56603e', '#2e3524', '#6e6a45', '#1d1f18'], vest: '#4a5236', gear: '#343a28', bot: { w: 'k90', burst: 1, acc: 0.1, spd: 1.05, hp: 85, range: 26 } },
    support:  { name: 'SUPORTE',             desc: 'Blindagem pesada e rajadas longas de supressão.', camo: ['#b39d76', '#9a845f', '#cbb894', '#7f6c4d'], soft: true, vest: '#8f7c5c', gear: '#6a5b42', bot: { w: 'm7', burst: 6, acc: -0.06, spd: 0.85, hp: 150, range: 20 } },
    engineer: { name: 'ENGENHEIRO',          desc: 'Rádio de longo alcance e escopeta para curta distância.', camo: ['#6d7072', '#4b4e50', '#8d9091', '#2f3133'], vest: '#3f4244', gear: '#2c2e30', bot: { w: 'r12', burst: 1, acc: 0, spd: 0.95, hp: 105, range: 9 } },
    specops:  { name: 'OPERAÇÕES ESPECIAIS', desc: 'Rápido e agressivo. Fecha a distância e flanqueia.', camo: ['#2a2c30', '#1c1d20', '#34373c', '#3f4247'], vest: '#1f2023', gear: '#151618', bot: { w: 'vespa', burst: 4, acc: 0.05, spd: 1.15, hp: 110, range: 10 } },
  };
  ZH.CLASS_KEYS = Object.keys(ZH.CLASSES);

  ZH.MODES = {
    tdm:  { name: 'MATA-MATA EM EQUIPE', short: 'EQUIPES', desc: 'Duas equipes. A primeira a 40 baixas vence.', limit: 40, time: 8 * 60e3, bots: 8 },
    ffa:  { name: 'TODOS CONTRA TODOS',  short: 'FFA',     desc: 'Cada um por si. O primeiro a 25 baixas vence.', limit: 25, time: 8 * 60e3, bots: 6 },
    surv: { name: 'SOBREVIVÊNCIA',       short: 'CO-OP',   desc: 'Cooperativo contra ondas de hostis. Até onde vocês aguentam?', limit: 0, time: 0, bots: 0 },
  };
  ZH.TEAMS = { A: { name: 'ÁGUIA' }, B: { name: 'COBRA' } };

  // ------------------------------------------------------------------ MAPA
  const L = 60;
  const boxes = [], barrels = [], cars = [], paint = [];
  function box(x, z, w, d, h, mat, o) { o = o || {}; boxes.push({ x, z, w, d, h, y: o.y || 0, mat, uv: o.uv || 2, collide: o.collide !== false, shadow: o.shadow !== false }); }
  box(0, -L, 2 * L + 2, 2, 5, 'concrete', { uv: 4 }); box(0, L, 2 * L + 2, 2, 5, 'concrete', { uv: 4 });
  box(-L, 0, 2, 2 * L, 5, 'concrete', { uv: 4 }); box(L, 0, 2, 2 * L, 5, 'concrete', { uv: 4 });
  box(-36, -36, 18, 14, 8, 'concrete', { uv: 4 }); box(36, 34, 16, 18, 9, 'concrete', { uv: 4 });
  box(38, -38, 14, 12, 7, 'brick'); box(-38, 36, 14, 16, 7, 'brick');
  box(-44, 0, 10, 8, 6, 'brick'); box(45, 2, 8, 10, 6, 'concrete', { uv: 4 });
  box(0, 0, 8, 8, 4, 'brick'); box(0, 0, 8.6, 8.6, 0.4, 'concrete', { y: 4, uv: 4, collide: false });
  function cont(x, z, rot, mat, y) { if (rot) box(x, z, 6, 2.5, 2.6, mat, { y: y || 0, uv: 4 }); else box(x, z, 2.5, 6, 2.6, mat, { y: y || 0, uv: 4 }); }
  cont(-14, 22, 0, 'cRed'); cont(-11.4, 22, 0, 'cBlue'); cont(-14, 22, 0, 'cGreen', 2.6);
  cont(14, -20, 1, 'cGreen'); cont(14, -17.4, 1, 'cRed');
  cont(22, 14, 0, 'cBlue'); cont(-24, -12, 1, 'cOrange'); cont(-4, -28, 1, 'cBlue');
  cont(6, 30, 1, 'cGreen'); cont(28, -6, 0, 'cRed'); cont(-30, 22, 0, 'cOrange'); cont(30, 48, 1, 'cBlue'); cont(-46, -20, 1, 'cGreen');
  function crate(x, z, y, s) { s = s || 1.4; box(x, z, s, s, s, 'crate', { y: y || 0, uv: s }); }
  crate(8, 10); crate(9.4, 10); crate(8, 10, 1.4); crate(-8, -10); crate(-8, -11.4); crate(-20, 34); crate(-21.4, 34); crate(-20, 34, 1.4);
  crate(20, 40); crate(-30, 10); crate(30, 22); crate(31.4, 22); crate(-6, 40); crate(18, -34); crate(-16, -40); crate(-16, -40, 1.4); crate(44, -14); crate(-48, 44);
  function sand(x, z, w, d) { box(x, z, w, d, 1, 'sand', { uv: 1 }); }
  sand(0, 36, 4, 0.9); sand(-10, 8, 0.9, 4); sand(12, 0, 0.9, 4); sand(0, -14, 4, 0.9); sand(-28, -26, 4, 0.9); sand(26, -26, 4, 0.9); sand(40, 12, 0.9, 4); sand(-14, 46, 4, 0.9);
  sand(0, -36, 4, 0.9); sand(-14, -46, 4, 0.9);
  box(-20, 0, 0.6, 10, 2.2, 'brick'); box(20, -2, 0.6, 10, 2.2, 'brick'); box(0, 18, 10, 0.6, 2.2, 'brick'); box(0, -18, 10, 0.6, 2.2, 'brick'); box(0, -42, 12, 0.6, 2.2, 'brick');
  [[-6, 12], [-5.1, 12.4], [16, 6], [-26, -6], [24, -30], [-34, 18], [10, 44], [10.9, 44.3], [6, -44], [-10, -30]].forEach(p => barrels.push({ x: p[0], z: p[1] }));
  cars.push({ x: -8, z: 30, alongZ: true, col: '#6b2b24' }, { x: 24, z: -12, alongZ: false, col: '#3e4f5c' }, { x: -32, z: -46, alongZ: false, col: '#6d6a5a' }, { x: 8, z: -30, alongZ: true, col: '#59613f' });
  paint.push([0, 30, 0.25, 24], [0, -30, 0.25, 20], [30, 0, 22, 0.25], [-30, 0, 18, 0.25]);
  const far = []; { const r = mulberry32(7); for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + (r() - 0.5) * 0.08, d = 85 + r() * 50; far.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, w: 8 + r() * 14, d: 8 + r() * 12, h: 10 + r() * 32 }); } }

  const colliders = [];
  for (const b of boxes) if (b.collide) colliders.push({ minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2, minY: b.y, maxY: b.y + b.h });
  for (const b of barrels) colliders.push({ minX: b.x - 0.42, maxX: b.x + 0.42, minZ: b.z - 0.42, maxZ: b.z + 0.42, minY: 0, maxY: 1.15 });
  for (const c of cars) { const hw = c.alongZ ? 1 : 2.25, hd = c.alongZ ? 2.25 : 1; colliders.push({ minX: c.x - hw, maxX: c.x + hw, minZ: c.z - hd, maxZ: c.z + hd, minY: 0, maxY: 1.67 }); }

  ZH.MAP = { name: 'PÁTIO 07', size: L, boxes, barrels, cars, paint, far, colliders };
  ZH.SPAWNS = {
    A: [[0, 52, Math.PI], [-8, 52, Math.PI], [8, 52, Math.PI], [16, 53, Math.PI], [-16, 53, Math.PI], [-24, 54, Math.PI], [22, 54, Math.PI], [-4, 55, Math.PI]],
    B: [[0, -52, 0], [-8, -52, 0], [8, -52, 0], [16, -53, 0], [-16, -53, 0], [24, -52, 0], [-24, -52, 0], [4, -55, 0]],
    ffa: [[-50, -50, 0.8], [50, -50, -0.8], [-52, -20, 1.5], [52, -22, -1.5], [0, -52, 0], [-24, -52, 0], [24, -52, 0], [-52, 18, 1.5], [52, 16, -1.5], [50, 52, -2.4], [-52, 52, 2.4], [22, 44, 3], [-26, 46, 3], [52, -4, -1.5], [-52, -6, 1.5], [0, 52, Math.PI], [-12, 0, 1.5], [12, 10, -1.5]],
  };

  // ------------------------------------------------------------------ COLISÃO
  ZH.resolve = function (o, r) {
    for (const c of colliders) {
      if (c.maxY <= o.feet + 0.35 || c.minY > o.feet + 1.7) continue;
      const cx = clamp(o.x, c.minX, c.maxX), cz = clamp(o.z, c.minZ, c.maxZ); const dx = o.x - cx, dz = o.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); o.x = cx + dx / d * r; o.z = cz + dz / d * r; }
        else { const l = o.x - c.minX, rr = c.maxX - o.x, t = o.z - c.minZ, b = c.maxZ - o.z, m = Math.min(l, rr, t, b); if (m === l) o.x = c.minX - r; else if (m === rr) o.x = c.maxX + r; else if (m === t) o.z = c.minZ - r; else o.z = c.maxZ + r; }
        o.hit = true;
      }
    }
    const lim = L - 1 - r; o.x = clamp(o.x, -lim, lim); o.z = clamp(o.z, -lim, lim);
    return o;
  };
  ZH.groundAt = function (x, z, r, feet) { let g = 0; for (const c of colliders) { if (c.maxY > feet + 0.35) continue; if (x > c.minX - r * 0.6 && x < c.maxX + r * 0.6 && z > c.minZ - r * 0.6 && z < c.maxZ + r * 0.6 && c.maxY > g) g = c.maxY; } return g; };
  ZH.insideSolid = function (x, y, z, r) { for (const c of colliders) if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r && y > c.minY - 0.01 && y < c.maxY - 0.36) return true; return false; };

  // ------------------------------------------------------------------ RAIOS
  function rayAABB(ox, oy, oz, dx, dy, dz, c, maxT) {
    let tmin = 0, tmax = maxT, axis = -1, sign = 0;
    const lo = [c.minX, c.minY, c.minZ], hi = [c.maxX, c.maxY, c.maxZ], o = [ox, oy, oz], d = [dx, dy, dz];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < lo[i] || o[i] > hi[i]) return null; continue; }
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i], s = -1;
      if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
      if (t1 > tmin) { tmin = t1; axis = i; sign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
    if (axis < 0) return { t: 0, axis: 1, sign: 1 };
    return { t: tmin, axis, sign };
  }
  ZH.rayAABB = rayAABB;
  /** Raio contra o cenário. Retorna {t, nx, ny, nz} ou null. */
  ZH.rayWorld = function (ox, oy, oz, dx, dy, dz, maxT) {
    let best = null, bt = maxT;
    for (const c of colliders) { const h = rayAABB(ox, oy, oz, dx, dy, dz, c, bt); if (h && h.t < bt) { bt = h.t; best = h; } }
    if (dy < -1e-6) { const t = -oy / dy; if (t >= 0 && t < bt) { const x = ox + dx * t, z = oz + dz * t; if (Math.abs(x) < 70 && Math.abs(z) < 70) return { t, nx: 0, ny: 1, nz: 0 }; } }
    if (!best) return null;
    const n = [0, 0, 0]; n[best.axis] = best.sign;
    return { t: bt, nx: n[0], ny: n[1], nz: n[2] };
  };
  ZH.los = function (ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const h = ZH.rayWorld(ax, ay, az, dx / len, dy / len, dz / len, len);
    return !h || h.t >= len - 0.08;
  };
  function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
    const lx = cx - ox, ly = cy - oy, lz = cz - oz; const tc = lx * dx + ly * dy + lz * dz; if (tc < 0) return -1;
    const d2 = lx * lx + ly * ly + lz * lz - tc * tc; if (d2 > r * r) return -1; return tc - Math.sqrt(r * r - d2);
  }
  /** Volumes de acerto de um soldado com os pés em (px,py,pz). */
  ZH.rayPlayer = function (ox, oy, oz, dx, dy, dz, px, py, pz, cr, maxT) {
    const hy = py + (cr ? 1.18 : 1.66), top = py + (cr ? 1.05 : 1.5);
    let best = null;
    const th = raySphere(ox, oy, oz, dx, dy, dz, px, hy, pz, 0.15); if (th >= 0 && th < maxT) best = { t: th, head: true };
    const b = rayAABB(ox, oy, oz, dx, dy, dz, { minX: px - 0.3, maxX: px + 0.3, minY: py, maxY: top, minZ: pz - 0.3, maxZ: pz + 0.3 }, maxT);
    if (b && b.t < maxT && (!best || b.t < best.t)) best = { t: b.t, head: false };
    return best;
  };

  // ------------------------------------------------------------------ NAVEGAÇÃO
  const GN = 60; ZH.GN = GN;
  const blocked = new Uint8Array(GN * GN);
  for (let cz = 0; cz < GN; cz++) for (let cx = 0; cx < GN; cx++) { const x = -60 + cx * 2 + 1, z = -60 + cz * 2 + 1; for (const c of colliders) { if (c.maxY > 0.6 && c.minY < 1.5 && x > c.minX - 0.7 && x < c.maxX + 0.7 && z > c.minZ - 0.7 && z < c.maxZ + 0.7) { blocked[cz * GN + cx] = 1; break; } } }
  ZH.blocked = blocked;
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const cellOf = (x, z) => [clamp(((x + 60) / 2) | 0, 0, GN - 1), clamp(((z + 60) / 2) | 0, 0, GN - 1)];
  ZH.cellOf = cellOf;
  const bq = new Int32Array(GN * GN);
  ZH.flowField = function (tx, tz, out) {
    out = out || new Float32Array(GN * GN); out.fill(1e9);
    let [sx, sz] = cellOf(tx, tz); let s = sz * GN + sx;
    if (blocked[s]) { for (const [ox, oz] of NB) { const nx = sx + ox, nz = sz + oz; if (nx >= 0 && nz >= 0 && nx < GN && nz < GN && !blocked[nz * GN + nx]) { s = nz * GN + nx; break; } } }
    out[s] = 0; let h = 0, t = 0; bq[t++] = s;
    while (h < t) {
      const i = bq[h++], cx = i % GN, cz = (i / GN) | 0, d = out[i] + 1;
      for (const [ox, oz] of NB) { const nx = cx + ox, nz = cz + oz; if (nx < 0 || nz < 0 || nx >= GN || nz >= GN) continue; const ni = nz * GN + nx; if (blocked[ni] || out[ni] <= d) continue; if (ox && oz && (blocked[cz * GN + nx] || blocked[nz * GN + cx])) continue; out[ni] = d; bq[t++] = ni; }
    }
    return out;
  };
  ZH.flowDir = function (field, x, z, tx, tz, out) {
    const [cx, cz] = cellOf(x, z); let best = field[cz * GN + cx], bx = -1, bz = -1;
    for (const [ox, oz] of NB) { const nx = cx + ox, nz = cz + oz; if (nx < 0 || nz < 0 || nx >= GN || nz >= GN) continue; const ni = nz * GN + nx; if (blocked[ni]) continue; if (ox && oz && (blocked[cz * GN + nx] || blocked[nz * GN + cx])) continue; if (field[ni] < best) { best = field[ni]; bx = nx; bz = nz; } }
    let gx, gz; if (bx < 0 || best < 1) { gx = tx; gz = tz; } else { gx = -60 + bx * 2 + 1; gz = -60 + bz * 2 + 1; }
    const dx = gx - x, dz = gz - z, d = Math.hypot(dx, dz) || 1; out[0] = dx / d; out[1] = dz / d; return out;
  };

  // ------------------------------------------------------------------ GRANADA
  ZH.stepNade = function (g, dt) {
    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      g.vy -= 14 * h; g.x += g.vx * h; g.y += g.vy * h; g.z += g.vz * h;
      if (g.y < 0.08) { g.y = 0.08; if (g.vy < 0) g.vy = -g.vy * 0.35; g.vx *= 0.62; g.vz *= 0.62; }
      for (const c of colliders) {
        const r = 0.08;
        if (g.x > c.minX - r && g.x < c.maxX + r && g.z > c.minZ - r && g.z < c.maxZ + r && g.y > c.minY - r && g.y < c.maxY + r) {
          const pens = [g.x - (c.minX - r), (c.maxX + r) - g.x, g.y - (c.minY - r), (c.maxY + r) - g.y, g.z - (c.minZ - r), (c.maxZ + r) - g.z];
          let m = 0; for (let i = 1; i < 6; i++) if (pens[i] < pens[m]) m = i;
          if (m === 0) { g.x = c.minX - r; g.vx = -Math.abs(g.vx) * 0.4; } else if (m === 1) { g.x = c.maxX + r; g.vx = Math.abs(g.vx) * 0.4; }
          else if (m === 2) { g.y = c.minY - r; g.vy = -Math.abs(g.vy) * 0.4; } else if (m === 3) { g.y = c.maxY + r; g.vy = Math.abs(g.vy) * 0.35; g.vx *= 0.62; g.vz *= 0.62; }
          else if (m === 4) { g.z = c.minZ - r; g.vz = -Math.abs(g.vz) * 0.4; } else { g.z = c.maxZ + r; g.vz = Math.abs(g.vz) * 0.4; }
        }
      }
    }
  };

  ZH.cleanName = function (s) { s = String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16); return s || 'Soldado' + ((Math.random() * 900 + 100) | 0); };

  if (typeof module !== 'undefined' && module.exports) module.exports = ZH; else root.ZH = ZH;
})(typeof self !== 'undefined' ? self : this);
