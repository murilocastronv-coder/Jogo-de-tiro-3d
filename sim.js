/* Zona Hostil — simulação autoritativa de uma sala.
   Roda no servidor (multiplayer online) e no navegador (treino offline).
   Valida movimento, tiros, munição, recarga, granadas e corpo a corpo; controla bots, placar e partidas. */
(function (root) {
  'use strict';
  const ZH = (typeof module !== 'undefined' && module.exports) ? require('./shared.js') : root.ZH;
  const { WEAPONS, CLASSES, CLASS_KEYS, PLAYER, MODES, SPAWNS, clamp } = ZH;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const BOT_NAMES = ['Rocha', 'Falcão', 'Vulto', 'Brasa', 'Trovão', 'Kobra', 'Sombra', 'Lince', 'Pardal', 'Tatu', 'Jaguar', 'Ferro', 'Gavião', 'Neblina', 'Coruja', 'Piranha', 'Bigorna', 'Faísca', 'Cacto', 'Tufão', 'Granito', 'Mangue'];
  const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
  const isNum = v => typeof v === 'number' && Number.isFinite(v);
  const vec3 = a => Array.isArray(a) && a.length === 3 && a.every(isNum);

  class Room {
    constructor(o) {
      this.id = o.id || 'local'; this.code = o.code || null; this.mode = MODES[o.mode] ? o.mode : 'tdm'; this.priv = !!o.priv;
      this.useBots = o.bots !== false; this.max = o.max || 12; this.out = o.send; this.now = o.now || (() => Date.now());
      this.onKill = o.onKill || null; this.players = new Map(); this.nades = []; this.nid = 1; this.pid = 1;
      this.snapAcc = 0; this.boardAcc = 0; this.botNames = BOT_NAMES.slice().sort(() => Math.random() - 0.5);
      this.startMatch(true);
    }
    // ------------------------------------------------ envio
    send(p, msg) { if (!p.bot) this.out(p.id, msg); }
    broadcast(msg, except) { let s = null; for (const p of this.players.values()) { if (p.bot || p.id === except) continue; if (s === null) s = JSON.stringify(msg); this.out(p.id, msg, s); } }
    humans() { let n = 0; for (const p of this.players.values()) if (!p.bot) n++; return n; }
    info(p) { return { id: p.id, name: p.name, team: p.team, cls: p.cls, fem: p.fem, bot: p.bot }; }
    enemies(a, b) { return a !== b && (this.mode === 'ffa' || a.team !== b.team); }
    weaponOf(p, slot) { return WEAPONS[slot === 1 ? ZH.SECONDARY : p.primary] || WEAPONS.m7; }

    // ------------------------------------------------ entrada e saída
    addPlayer(d) {
      const id = this.pid++;
      const p = this.makePlayer(id, ZH.cleanName(d.name), false, d);
      if (this.mode === 'tdm') { let a = 0, b = 0; for (const q of this.players.values()) if (!q.bot) q.team === 'A' ? a++ : b++; p.team = a <= b ? 'A' : 'B'; }
      else if (this.mode === 'surv') p.team = 'A'; else p.team = 'P' + id;
      this.players.set(id, p);
      this.send(p, { t: 'welcome', id, room: { id: this.id, code: this.code, mode: this.mode, priv: this.priv }, players: [...this.players.values()].map(q => this.info(q)), match: this.matchInfo() });
      this.broadcast({ t: 'join', p: this.info(p) }, id);
      this.balanceBots();
      if (this.match.state === 'live' && !(this.mode === 'surv' && this.match.wave > 0 && this.anyHumanAlive())) this.spawn(p);
      else if (this.mode === 'surv') { p.respawnAt = Infinity; this.send(p, { t: 'msg', text: 'Você entra na próxima onda' }); }
      return id;
    }
    makePlayer(id, name, bot, d) {
      d = d || {};
      const cls = CLASSES[d.cls] ? d.cls : 'assault';
      return {
        id, name, bot, team: 'A', cls, fem: !!d.fem, primary: ZH.PRIMARIES.includes(d.primary) ? d.primary : 'm7', nextPrimary: null, nextCls: null,
        x: 0, y: 0, z: 0, yaw: 0, pitch: 0, cr: 0, sp: 0, ads: 0, w: 0, hp: PLAYER.hp, maxHp: PLAYER.hp, alive: false, respawnAt: 0,
        kills: 0, deaths: 0, score: 0, streak: 0, nades: PLAYER.nades, mag: [0, 0], res: [0, 0], reloadUntil: 0, reloadW: -1,
        lastFire: [0, 0], prot: 0, hist: [], rtt: 80, lastState: 0, lastHit: -1e9, lastMelee: 0, uav: 0, killer: 0,
      };
    }
    removePlayer(id) {
      const p = this.players.get(id); if (!p) return;
      this.players.delete(id); this.broadcast({ t: 'leave', id });
      if (!p.bot) this.balanceBots();
    }
    balanceBots() {
      if (!this.useBots || this.mode === 'surv') return;
      const target = MODES[this.mode].bots;
      if (this.mode === 'tdm') {
        for (const team of ['A', 'B']) {
          let hum = 0; const bots = []; for (const p of this.players.values()) if (p.team === team) p.bot ? bots.push(p) : hum++;
          const want = Math.max(0, target / 2 - hum);
          while (bots.length > want) this.removePlayer(bots.pop().id);
          for (let i = bots.length; i < want; i++) this.addBot(team);
        }
      } else {
        const bots = [...this.players.values()].filter(p => p.bot); const want = Math.max(0, target - this.humans());
        while (bots.length > want) this.removePlayer(bots.pop().id);
        for (let i = bots.length; i < want; i++) this.addBot(null);
      }
    }
    addBot(team, cls) {
      const id = this.pid++;
      cls = cls || CLASS_KEYS[(Math.random() * CLASS_KEYS.length) | 0];
      const name = this.botNames[id % this.botNames.length];
      const p = this.makePlayer(id, name, true, { cls, fem: Math.random() < 0.35, primary: CLASSES[cls].bot.w });
      p.team = team || 'P' + id;
      p.ai = { tgt: null, tgtT: 0, losT: 0, los: false, aimT: 0, burst: 0, fireCd: rnd(0.6, 1.4), strafe: 1, strafeT: 0, crouch: false, field: null, fieldT: 0, mv: [0, 0], wander: null };
      this.players.set(id, p); this.broadcast({ t: 'join', p: this.info(p) });
      if (this.match.state === 'live') this.spawn(p);
      return p;
    }

    // ------------------------------------------------ partida
    matchInfo() { const m = this.match; return { state: m.state, mode: this.mode, tl: m.endsAt ? Math.max(0, (m.endsAt - this.now()) / 1000) : 0, sA: m.sA, sB: m.sB, wave: m.wave, limit: m.limit, win: m.win, next: m.nextAt ? Math.max(0, (m.nextAt - this.now()) / 1000) : 0 }; }
    startMatch(first) {
      const M = MODES[this.mode], t = this.now();
      this.match = { state: 'live', endsAt: M.time ? t + M.time : 0, sA: 0, sB: 0, wave: 0, waveState: 'inter', waveAt: t + 4000, toSpawn: 0, maxAlive: 0, limit: M.limit, win: null, nextAt: 0 };
      this.nades.length = 0;
      if (this.mode === 'surv') for (const p of [...this.players.values()]) if (p.bot) this.removePlayer(p.id);
      for (const p of this.players.values()) { p.kills = p.deaths = p.score = p.streak = 0; p.uav = 0; this.spawn(p); }
      if (!first) this.broadcast({ t: 'match', m: this.matchInfo() });
    }
    endMatch(win) {
      const m = this.match; if (m.state !== 'live') return;
      m.state = 'end'; m.win = win; m.nextAt = this.now() + 12000;
      for (const p of this.players.values()) p.reloadUntil = 0;
      this.broadcast({ t: 'match', m: this.matchInfo(), board: this.board() });
    }
    board() { const rows = []; for (const p of this.players.values()) rows.push([p.id, p.kills, p.deaths, p.score, p.bot ? 0 : Math.round(p.rtt), p.alive ? 1 : 0]); return rows; }
    anyHumanAlive() { for (const p of this.players.values()) if (!p.bot && p.alive) return true; return false; }

    // ------------------------------------------------ nascimento
    spawn(p, pt) {
      if (p.nextPrimary) { p.primary = p.nextPrimary; p.nextPrimary = null; }
      if (p.nextCls) { p.cls = p.nextCls.cls; p.fem = p.nextCls.fem; p.nextCls = null; this.broadcast({ t: 'look', id: p.id, cls: p.cls, fem: p.fem }); }
      if (!pt) pt = this.pickSpawn(p);
      p.x = pt[0]; p.z = pt[1]; p.y = 0; p.yaw = Math.atan2(pt[0], pt[1]); p.pitch = 0; p.cr = 0; p.w = 0;
      p.maxHp = p.bot ? CLASSES[p.cls].bot.hp + (this.mode === 'surv' ? this.match.wave * 6 : 0) : PLAYER.hp;
      p.hp = p.maxHp; p.alive = true; p.respawnAt = 0; p.nades = PLAYER.nades; p.reloadUntil = 0; p.streak = 0;
      const A = this.weaponOf(p, 0), B = this.weaponOf(p, 1);
      p.mag = [A.mag, B.mag]; p.res = [A.res, B.res];
      p.prot = this.now() + PLAYER.protect; p.hist.length = 0; p.lastState = this.now();
      if (p.ai) { p.ai.tgt = null; p.ai.aimT = 0; p.ai.field = null; }
      this.send(p, { t: 'spawn', x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp, mag: p.mag, res: p.res, nades: p.nades, primary: p.primary, cls: p.cls, fem: p.fem });
    }
    pickSpawn(p) {
      let pts;
      if (this.mode === 'tdm') pts = SPAWNS[p.team] || SPAWNS.A;
      else if (this.mode === 'surv') pts = p.bot ? SPAWNS.ffa.filter(s => s[1] < 20) : SPAWNS.A;
      else pts = SPAWNS.ffa;
      let best = pts[0], bd = -1;
      for (const s of pts) {
        let md = 1e9; for (const q of this.players.values()) if (q.alive && q !== p && this.enemies(p, q)) md = Math.min(md, Math.hypot(q.x - s[0], q.z - s[1]));
        for (const q of this.players.values()) if (q.alive && q !== p && Math.hypot(q.x - s[0], q.z - s[1]) < 1.2) md = Math.min(md, 0.5);
        const score = md + Math.random() * 6; if (score > bd) { bd = score; best = s; }
      }
      return best;
    }

    // ------------------------------------------------ mensagens
    onMessage(id, m) {
      const p = this.players.get(id); if (!p || !m || typeof m.t !== 'string') return;
      switch (m.t) {
        case 's': this.onState(p, m); break;
        case 'f': this.onFire(p, m); break;
        case 'r': this.onReload(p, m.w === 1 ? 1 : 0); break;
        case 'n': this.onNade(p, m); break;
        case 'm': this.onMelee(p); break;
        case 'lo': {
          if (ZH.PRIMARIES.includes(m.primary)) p.nextPrimary = m.primary;
          if (CLASSES[m.cls]) p.nextCls = { cls: m.cls, fem: !!m.fem };
          this.send(p, { t: 'msg', text: 'Equipamento aplicado no próximo nascimento' });
          break;
        }
        case 'ping': if (isNum(m.rtt)) p.rtt = clamp(m.rtt, 0, 600); this.send(p, { t: 'pong', c: m.c }); break;
      }
    }
    onState(p, m) {
      if (!p.alive || this.match.state !== 'live') return;
      if (![m.x, m.y, m.z, m.yaw, m.pitch].every(isNum)) return;
      const t = this.now(), dt = Math.max(0.016, Math.min(1, (t - p.lastState) / 1000)); p.lastState = t;
      let x = m.x, z = m.z, y = clamp(m.y, 0, 12);
      const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), maxD = PLAYER.sprint * 1.15 * 1.4 * dt + 0.6;
      let corrected = false;
      if (d > maxD) { x = p.x + dx / d * maxD; z = p.z + dz / d * maxD; corrected = true; }
      const o = ZH.resolve({ x, z, feet: y }, 0.3);
      if (Math.hypot(o.x - x, o.z - z) > 0.12) corrected = true;
      const gh = ZH.groundAt(o.x, o.z, 0.4, y); if (y > gh + 2.2) { y = gh + 2.2; corrected = true; }
      p.x = o.x; p.z = o.z; p.y = y;
      p.yaw = m.yaw; p.pitch = clamp(m.pitch, -1.5, 1.5); p.cr = m.cr ? 1 : 0; p.sp = m.sp ? 1 : 0; p.ads = m.ads ? 1 : 0;
      const w = m.w === 1 ? 1 : 0; if (w !== p.w) { p.w = w; p.reloadUntil = 0; }
      if (corrected) this.send(p, { t: 'pos', x: r2(p.x), y: r2(p.y), z: r2(p.z) });
    }
    eye(p) { return [p.x, p.y + (p.cr ? PLAYER.eyeCrouch : PLAYER.eye), p.z]; }
    rewind(q, t) {
      const h = q.hist; if (!h.length) return [q.x, q.y, q.z, q.cr];
      if (t >= h[h.length - 1][0]) { const e = h[h.length - 1]; return [e[1], e[2], e[3], e[4]]; }
      for (let i = h.length - 1; i > 0; i--) { const b = h[i], a = h[i - 1]; if (a[0] <= t) { const k = (t - a[0]) / ((b[0] - a[0]) || 1); return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, k < 0.5 ? a[4] : b[4]]; } }
      const e = h[0]; return [e[1], e[2], e[3], e[4]];
    }
    onFire(p, m) {
      if (!p.alive || this.match.state !== 'live') return;
      const slot = m.w === 1 ? 1 : 0; const W = this.weaponOf(p, slot); const t = this.now();
      if (slot !== p.w) { p.w = slot; p.reloadUntil = 0; }
      if (p.reloadUntil && p.reloadW === slot) return;
      if (t - p.lastFire[slot] < 60000 / W.rpm * 0.78) return;
      if (p.mag[slot] <= 0) return;
      if (!Array.isArray(m.d) || !m.d.length) return;
      p.mag[slot]--; p.lastFire[slot] = t; p.prot = 0;
      const eye = this.eye(p); let o = vec3(m.o) ? m.o : eye;
      if (Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]) > 1.3) o = eye;
      const rt = t - clamp(p.rtt / 2 + 100, 0, 320);
      const ends = [], hv = [];
      for (const d0 of m.d.slice(0, W.pellets)) {
        if (!vec3(d0)) continue; const l = Math.hypot(d0[0], d0[1], d0[2]); if (l < 1e-6) continue;
        const d = [d0[0] / l, d0[1] / l, d0[2] / l];
        const res = this.trace(p, o, d, W, rt);
        ends.push([r2(res.e[0]), r2(res.e[1]), r2(res.e[2])]); hv.push(res.v ? res.v.id : 0);
      }
      this.broadcast({ t: 'shot', id: p.id, w: W.id, o: [r2(o[0]), r2(o[1]), r2(o[2])], e: ends, hv }, p.id);
    }
    trace(p, o, d, W, rt) {
      const wh = ZH.rayWorld(o[0], o[1], o[2], d[0], d[1], d[2], W.maxRange); const tw = wh ? wh.t : W.maxRange;
      let best = null, bq = null;
      for (const q of this.players.values()) {
        if (!q.alive || !this.enemies(p, q)) continue;
        const pos = q.bot ? [q.x, q.y, q.z, q.cr] : this.rewind(q, rt);
        const h = ZH.rayPlayer(o[0], o[1], o[2], d[0], d[1], d[2], pos[0], pos[1], pos[2], pos[3], tw);
        if (h && (!best || h.t < best.t)) { best = h; bq = q; }
      }
      if (best) {
        const dmg = W.dmg * ZH.falloff(W, best.t) * (best.head ? W.head : 1);
        this.damage(bq, p, dmg, { w: W.id, hs: best.head });
        return { e: [o[0] + d[0] * best.t, o[1] + d[1] * best.t, o[2] + d[2] * best.t], v: bq };
      }
      return { e: [o[0] + d[0] * tw, o[1] + d[1] * tw, o[2] + d[2] * tw], v: null };
    }
    onReload(p, slot) {
      if (!p.alive) return; const W = this.weaponOf(p, slot);
      if (p.mag[slot] >= W.mag || p.res[slot] <= 0 || p.reloadUntil) return;
      p.reloadW = slot; p.reloadUntil = this.now() + W.reload * 1000 * 0.85;
    }
    onNade(p, m) {
      if (!p.alive || p.nades <= 0 || this.match.state !== 'live' || !vec3(m.o) || !vec3(m.v)) return;
      p.nades--; const eye = this.eye(p); let o = m.o; if (Math.hypot(o[0] - eye[0], o[1] - eye[1], o[2] - eye[2]) > 1.3) o = eye;
      let v = m.v; const s = Math.hypot(v[0], v[1], v[2]); if (s > ZH.NADE.maxSpeed) v = v.map(c => c / s * ZH.NADE.maxSpeed);
      this.nades.push({ id: this.nid++, x: o[0], y: o[1], z: o[2], vx: v[0], vy: v[1], vz: v[2], owner: p.id, team: p.team, at: this.now() + ZH.NADE.fuse });
      p.prot = 0;
    }
    onMelee(p) {
      const t = this.now(); if (!p.alive || t - p.lastMelee < ZH.MELEE.cooldown || this.match.state !== 'live') return; p.lastMelee = t; p.prot = 0;
      let best = null, bd = ZH.MELEE.range;
      for (const q of this.players.values()) {
        if (!q.alive || !this.enemies(p, q)) continue;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > bd || Math.abs(q.y - p.y) > 1.3) continue;
        let a = Math.atan2(-dx, -dz) - p.yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > ZH.MELEE.cone) continue;
        best = q; bd = d;
      }
      this.broadcast({ t: 'melee', id: p.id }, p.id);
      if (best) this.damage(best, p, ZH.MELEE.dmg, { w: 'faca', hs: false });
    }

    // ------------------------------------------------ dano
    damage(v, a, amount, info) {
      if (!v.alive || this.now() < v.prot) return;
      v.hp -= amount; v.lastHit = this.now();
      if (a && !a.bot && a !== v) this.send(a, { t: 'hit', kill: v.hp <= 0, hs: !!info.hs });
      this.send(v, { t: 'dmg', hp: Math.max(0, Math.round(v.hp)), from: a ? [r2(a.x), r2(a.z)] : [v.x, v.z] });
      if (v.hp <= 0) this.kill(v, a, info);
    }
    kill(v, k, info) {
      v.alive = false; v.hp = 0; v.deaths++; v.streak = 0; v.reloadUntil = 0; v.killer = k ? k.id : 0;
      v.respawnAt = this.mode === 'surv' ? Infinity : this.now() + PLAYER.respawn;
      const m = this.match;
      if (k && k !== v) {
        k.kills++; k.streak++; k.score += 100 + (info.hs ? 50 : 0) + (info.w === 'faca' ? 50 : 0);
        if (this.mode === 'tdm') { if (k.team === 'A') m.sA++; else m.sB++; }
        if (k.streak === 3 || k.streak === 7) { k.uav = this.now() + 15000; this.broadcast({ t: 'uav', id: k.id, team: k.team, s: 15 }); }
        if (this.mode === 'surv' && !k.bot) { const slot = 0, W = this.weaponOf(k, slot); k.res[slot] = Math.min(k.res[slot] + Math.ceil(W.mag / 3), W.res * 2); this.send(k, { t: 'ammo', mag: k.mag, res: k.res, nades: k.nades }); }
        if (this.onKill && !k.bot) this.onKill(k, v, info);
      } else if (k === v) { v.score = Math.max(0, v.score - 50); }
      this.broadcast({ t: 'kill', k: k ? k.id : 0, v: v.id, w: info.w, hs: !!info.hs, x: r2(v.x), z: r2(v.z) });
      if (v.bot && this.mode === 'surv') v.removeAt = this.now() + 4000;
      if (this.mode === 'tdm' && (m.sA >= m.limit || m.sB >= m.limit)) this.endMatch(m.sA >= m.limit ? 'A' : 'B');
      if (this.mode === 'ffa' && k && k.kills >= m.limit) this.endMatch(k.id);
      if (this.mode === 'surv' && !v.bot && !this.anyHumanAlive()) this.endMatch('B');
    }
    explode(g) {
      this.broadcast({ t: 'boom', x: r2(g.x), y: r2(g.y), z: r2(g.z) });
      const owner = this.players.get(g.owner) || null;
      for (const q of [...this.players.values()]) {
        if (!q.alive) continue;
        if (owner && q !== owner && !this.enemies(owner, q)) continue;
        if (!owner && this.mode !== 'ffa' && q.team === g.team) continue;
        const d = Math.hypot(q.x - g.x, q.y + 0.9 - g.y, q.z - g.z); if (d > ZH.NADE.radius) continue;
        if (!ZH.los(g.x, g.y + 0.3, g.z, q.x, q.y + 1, q.z) && !ZH.los(g.x, g.y + 0.3, g.z, q.x, q.y + 1.6, q.z)) continue;
        const dmg = ZH.NADE.dmg * Math.pow(1 - d / ZH.NADE.radius, 1.2) * (q === owner ? 0.6 : 1);
        if (dmg > 2) this.damage(q, owner, dmg, { w: 'granada', hs: false });
      }
    }

    // ------------------------------------------------ bots
    botThink(p, dt) {
      const ai = p.ai, t = this.now(), C = CLASSES[p.cls].bot, W = this.weaponOf(p, 0);
      ai.tgtT -= dt; ai.losT -= dt; ai.fieldT -= dt;
      if (ai.tgtT <= 0 || (ai.tgt && !ai.tgt.alive)) {
        ai.tgtT = 0.5; let best = null, bd = 1e9;
        for (const q of this.players.values()) { if (!q.alive || !this.enemies(p, q)) continue; let d = Math.hypot(q.x - p.x, q.z - p.z); if (q === ai.tgt && ai.los) d *= 0.6; if (d < bd) { bd = d; best = q; } }
        if (best !== ai.tgt) { ai.tgt = best; ai.aimT = 0; ai.field = null; }
      }
      const q = ai.tgt; const mv = ai.mv; mv[0] = mv[1] = 0; let engaged = false, tYaw = p.yaw, dist = 0;
      if (q) {
        const dx = q.x - p.x, dz = q.z - p.z; dist = Math.hypot(dx, dz) || 0.01;
        if (ai.losT <= 0) { ai.losT = rnd(0.18, 0.3); const e = this.eye(p), f = this.eye(q); ai.los = ZH.los(e[0], e[1], e[2], f[0], f[1] - 0.25, f[2]); }
        if (ai.fieldT <= 0 || !ai.field) { ai.fieldT = 0.6; ai.field = ZH.flowField(q.x, q.z, ai.field); }
        if (ai.los && dist < 46) {
          engaged = true; tYaw = Math.atan2(-dx, -dz); ai.aimT += dt;
          ai.strafeT -= dt; if (ai.strafeT <= 0) { ai.strafeT = rnd(1.2, 3); ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.crouch = p.cls !== 'specops' && dist > 11 && Math.random() < 0.4; }
          if (ai.crouch) { /* parado agachado */ }
          else if (dist > C.range) { ZH.flowDir(ai.field, p.x, p.z, q.x, q.z, mv); mv[0] *= 0.75; mv[1] *= 0.75; }
          else { mv[0] = dz / dist * ai.strafe * 0.5; mv[1] = -dx / dist * ai.strafe * 0.5; if (dist < 5) { mv[0] -= dx / dist * 0.6; mv[1] -= dz / dist * 0.6; } }
          ai.fireCd -= dt;
          if (ai.fireCd <= 0 && ai.aimT > 0.6 && t >= p.prot - 1000) this.botShoot(p, q, dist, W, C);
          if (dist < 2 && t - p.lastMelee > 1500 && Math.random() < 0.02) this.onMelee(p);
        } else {
          ai.aimT = Math.max(0, ai.aimT - dt * 2); ai.crouch = false;
          ZH.flowDir(ai.field, p.x, p.z, q.x, q.z, mv); tYaw = Math.atan2(-mv[0], -mv[1]);
        }
      }
      const speed = (engaged ? 3.2 : 4.6) * C.spd * (this.mode === 'surv' ? Math.min(1 + this.match.wave * 0.03, 1.35) : 1);
      const o = { x: p.x + mv[0] * speed * dt, z: p.z + mv[1] * speed * dt, feet: 0 };
      for (const f of this.players.values()) { if (f === p || !f.alive) continue; const ax = o.x - f.x, az = o.z - f.z, d = Math.hypot(ax, az); if (d < 0.85 && d > 0) { o.x += ax / d * (0.85 - d) * 0.5; o.z += az / d * (0.85 - d) * 0.5; } }
      ZH.resolve(o, 0.35); p.x = o.x; p.z = o.z; p.y = 0;
      let dy = tYaw - p.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); p.yaw += dy * Math.min(1, dt * 9);
      p.pitch = engaged && q ? Math.atan2((q.y + 1.3) - (p.y + 1.5), dist) : 0;
      p.cr = ai.crouch ? 1 : 0; p.ads = engaged ? 1 : 0; p.sp = !engaged && Math.hypot(mv[0], mv[1]) > 0.5 ? 1 : 0;
    }
    botShoot(p, q, dist, W, C) {
      const ai = p.ai; const t = this.now();
      const qs = q.hist.length > 2 ? Math.hypot(q.x - q.hist[q.hist.length - 3][1], q.z - q.hist[q.hist.length - 3][3]) * 15 : 0;
      const waveBoost = this.mode === 'surv' ? this.match.wave * 0.025 : 0;
      let acc = clamp(0.5 + C.acc - dist * 0.009 + waveBoost - qs * 0.03 + (ai.crouch ? 0.05 : 0) - (q.cr ? 0.06 : 0), 0.1, 0.78);
      if (W.type === 'shotgun') acc = dist < 12 ? 0.75 : 0.15;
      const hit = Math.random() < acc, hs = hit && Math.random() < 0.12;
      const e = this.eye(p), f = this.eye(q);
      const end = hit ? [f[0], f[1] - (hs ? 0 : 0.5), f[2]] : [f[0] + rnd(-1.4, 1.4), f[1] + rnd(-0.6, 1.1), f[2] + rnd(-1.4, 1.4)];
      this.broadcast({ t: 'shot', id: p.id, w: W.id, o: [r2(e[0]), r2(e[1] - 0.15), r2(e[2])], e: [[r2(end[0]), r2(end[1]), r2(end[2])]], hv: [hit ? q.id : 0] });
      if (hit) { let dmg = W.dmg * ZH.falloff(W, dist) * (hs ? W.head : 1); if (W.pellets > 1) dmg *= W.pellets * 0.6; if (W.type === 'sniper') dmg = hs ? 200 : 75; this.damage(q, p, dmg * (this.mode === 'surv' ? 0.55 + this.match.wave * 0.03 : 0.75), { w: W.id, hs }); }
      ai.burst++;
      if (ai.burst >= C.burst) { ai.burst = 0; ai.fireCd = (W.type === 'sniper' ? rnd(1.8, 2.6) : W.type === 'shotgun' ? rnd(0.9, 1.3) : rnd(0.8, 1.6)) - (this.mode === 'surv' ? Math.min(this.match.wave * 0.05, 0.4) : 0); }
      else ai.fireCd = 60 / W.rpm * 1.2;
    }

    // ------------------------------------------------ ondas (sobrevivência)
    survTick() {
      const m = this.match, t = this.now(); let hum = 0; for (const p of this.players.values()) if (!p.bot) hum++;
      if (m.waveState === 'inter') {
        if (t >= m.waveAt) {
          m.wave++; m.waveState = 'fight'; m.toSpawn = Math.round((3 + 2 * m.wave) * (1 + 0.5 * (hum - 1))); m.maxAlive = Math.min(3 + m.wave + 2 * (hum - 1), 12); m.spawnAt = t + 1000;
          const ncls = CLASS_KEYS[Math.min(m.wave, CLASS_KEYS.length) - 1];
          this.broadcast({ t: 'wave', n: m.wave, state: 'start', cls: m.wave > 1 && m.wave <= CLASS_KEYS.length ? ncls : null });
        }
        return;
      }
      let alive = 0; for (const p of this.players.values()) if (p.bot && p.alive) alive++;
      if (m.toSpawn > 0 && alive < m.maxAlive && t >= m.spawnAt) {
        const pool = CLASS_KEYS.slice(0, Math.min(CLASS_KEYS.length, m.wave)); this.addBot('B', pool[(Math.random() * pool.length) | 0]); m.toSpawn--; m.spawnAt = t + rnd(800, 1800);
      }
      if (m.toSpawn === 0 && alive === 0) {
        m.waveState = 'inter'; m.waveAt = t + 6000; const bonus = 150 * m.wave;
        for (const p of this.players.values()) {
          if (p.bot) continue; p.score += bonus;
          if (!p.alive) this.spawn(p);
          else { const A = this.weaponOf(p, 0), B = this.weaponOf(p, 1); p.res = [A.res, B.res]; p.nades = PLAYER.nades; p.hp = p.maxHp; this.send(p, { t: 'ammo', mag: p.mag, res: p.res, nades: p.nades, hp: p.hp }); }
        }
        this.broadcast({ t: 'wave', n: m.wave, state: 'clear', bonus });
      }
    }

    // ------------------------------------------------ tique
    tick(dt) {
      const t = this.now(), m = this.match;
      if (m.state === 'end') { if (t >= m.nextAt) this.startMatch(false); }
      else {
        if (m.endsAt && t >= m.endsAt) {
          if (this.mode === 'tdm') this.endMatch(m.sA === m.sB ? 'draw' : m.sA > m.sB ? 'A' : 'B');
          else { let best = null; for (const p of this.players.values()) if (!best || p.kills > best.kills) best = p; this.endMatch(best ? best.id : 'draw'); }
        }
        if (this.mode === 'surv') this.survTick();
      }
      for (const p of [...this.players.values()]) {
        if (p.removeAt && t >= p.removeAt) { this.removePlayer(p.id); continue; }
        if (!p.alive) { if (m.state === 'live' && t >= p.respawnAt) this.spawn(p); continue; }
        if (p.reloadUntil && t >= p.reloadUntil) {
          const W = this.weaponOf(p, p.reloadW), s = p.reloadW, take = Math.min(W.mag - p.mag[s], p.res[s]);
          p.mag[s] += take; p.res[s] -= take; p.reloadUntil = 0;
          if (p.bot) { /* munição infinita para bots */ p.res[s] = W.res; }
        }
        if (t - p.lastHit > ZH.PLAYER.regenDelay && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + ZH.PLAYER.regenRate * dt);
        if (p.bot && m.state === 'live') this.botThink(p, dt);
        p.hist.push([t, p.x, p.y, p.z, p.cr]); if (p.hist.length > 16) p.hist.shift();
      }
      for (let i = this.nades.length - 1; i >= 0; i--) { const g = this.nades[i]; ZH.stepNade(g, dt); if (t >= g.at) { this.nades.splice(i, 1); this.explode(g); } }
      this.snapAcc += dt; this.boardAcc += dt;
      if (this.snapAcc >= 0.05) {
        this.snapAcc = 0; const rows = [];
        for (const p of this.players.values()) {
          const f = (p.cr ? 1 : 0) | (p.sp ? 2 : 0) | (p.ads ? 4 : 0) | (p.alive ? 0 : 8) | (t < p.prot ? 16 : 0) | (p.reloadUntil ? 32 : 0);
          rows.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r2(p.pitch), f, this.weaponOf(p, p.w).id, Math.round(p.hp)]);
        }
        this.broadcast({ t: 'snap', p: rows, g: this.nades.map(g => [g.id, r2(g.x), r2(g.y), r2(g.z)]) });
      }
      if (this.boardAcc >= 1) { this.boardAcc = 0; this.broadcast({ t: 'board', rows: this.board(), m: this.matchInfo() }); }
    }
  }

  const SIM = { Room };
  if (typeof module !== 'undefined' && module.exports) module.exports = SIM; else root.ZHSim = SIM;
})(typeof self !== 'undefined' ? self : this);
