/* Zona Hostil — assets 3D gerados em código: texturas PBR procedurais, cenário,
   soldados com esqueleto (SkinnedMesh) e animação procedural, armas em 1ª e 3ª pessoa. */
(function () {
  'use strict';
  const A = {}; window.ZHA = A;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  A.lin = lin; A.V3 = V3;
  let maxAniso = 4;

  // ================================================================ TEXTURAS
  function makeTex(size, draw, rx, ry, srgb) {
    const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = Math.min(8, maxAniso); if (srgb !== false) t.encoding = THREE.sRGBEncoding; return t;
  }
  function noise(g, s, a, n) { for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
  function blotch(g, s, n, dark, light) { for (let i = 0; i < n; i++) { const x = Math.random() * s, y = Math.random() * s, r = s * (0.04 + Math.random() * 0.16); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Math.random() < 0.55 ? dark : light); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } }
  function normalFromHeight(hc, strength) {
    const s = hc.width, src = hc.getContext('2d').getImageData(0, 0, s, s).data;
    const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); const out = g.createImageData(s, s), o = out.data;
    const H = (x, y) => src[((((y % s) + s) % s) * s + (((x % s) + s) % s)) * 4] / 255;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const dx = (H(x - 1, y) - H(x + 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * s + x) * 4; o[i] = (dx / l * 0.5 + 0.5) * 255; o[i + 1] = (dy / l * 0.5 + 0.5) * 255; o[i + 2] = (1 / l * 0.5 + 0.5) * 255; o[i + 3] = 255; }
    g.putImageData(out, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, maxAniso); return t;
  }
  function heightCanvas(s, fn) { const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); const im = g.createImageData(s, s); for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const v = clamp(fn(x, y), 0, 1) * 255, i = (y * s + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; }
  function canvasHeightFrom(drawFn, s) { const c = document.createElement('canvas'); c.width = c.height = s; drawFn(c.getContext('2d'), s); return c; }

  let T = null, M = null, SM = null;
  A.init = function (renderer) {
    maxAniso = renderer.capabilities.getMaxAnisotropy();
    if (T) return;
    T = {};
    T.ground = makeTex(512, (g, s) => {
      g.fillStyle = '#6e695e'; g.fillRect(0, 0, s, s); blotch(g, s, 40, 'rgba(40,34,26,.28)', 'rgba(170,160,140,.18)'); noise(g, s, 0.13, 11000);
      g.strokeStyle = 'rgba(28,26,22,.5)'; g.lineWidth = 1.3;
      for (let k = 0; k < 5; k++) { let x = Math.random() * s, y = Math.random() * s; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < 14; i++) { x += rnd(-18, 18); y += rnd(-18, 18); g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(36,34,30,.55)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s);
    }, 35, 35);
    T.groundN = normalFromHeight(heightCanvas(256, (x, y) => 0.5 + (Math.random() - 0.5) * 0.25 + ((x % 256 < 2 || y % 256 < 2) ? -0.4 : 0)), 1.6); T.groundN.repeat.set(35, 35);
    T.concrete = makeTex(512, (g, s) => {
      g.fillStyle = '#9b968b'; g.fillRect(0, 0, s, s); blotch(g, s, 30, 'rgba(60,55,45,.22)', 'rgba(200,195,180,.18)'); noise(g, s, 0.1, 9000);
      for (let i = 0; i < 10; i++) { const x = Math.random() * s; const gr = g.createLinearGradient(0, 0, 0, s * 0.6); gr.addColorStop(0, 'rgba(50,44,36,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x, 0, rnd(4, 16), s * 0.6); }
      g.fillStyle = 'rgba(40,38,34,.5)'; for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) { g.beginPath(); g.arc(x * s / 4, y * s / 4, 3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(40,38,34,.6)'; g.lineWidth = 3; g.strokeRect(0, 0, s, s);
    });
    T.concreteN = normalFromHeight(canvasHeightFrom((g, s) => { g.fillStyle = '#888'; g.fillRect(0, 0, s, s); noise(g, s, 0.25, 5000); g.strokeStyle = '#333'; g.lineWidth = 3; g.strokeRect(0, 0, s, s); g.fillStyle = '#333'; for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) { g.beginPath(); g.arc(x * s / 4, y * s / 4, 3, 0, 7); g.fill(); } }, 256), 2.5);
    T.brick = makeTex(512, (g, s) => {
      g.fillStyle = '#8e877b'; g.fillRect(0, 0, s, s); const rows = 16, bh = s / rows, bw = s / 8;
      for (let r = 0; r < rows; r++) { const off = (r % 2) * bw / 2; for (let c = -1; c < 9; c++) { const v = rnd(-22, 22); g.fillStyle = `rgb(${126 + v | 0},${70 + v * 0.7 | 0},${52 + v * 0.5 | 0})`; g.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4); } }
      noise(g, s, 0.1, 8000); blotch(g, s, 14, 'rgba(30,24,20,.25)', 'rgba(200,190,170,.12)');
    });
    T.brickN = normalFromHeight(canvasHeightFrom((g, s) => { g.fillStyle = '#303030'; g.fillRect(0, 0, s, s); const rows = 16, bh = s / rows, bw = s / 8; for (let r = 0; r < rows; r++) { const off = (r % 2) * bw / 2; for (let c = -1; c < 9; c++) { g.fillStyle = '#b0b0b0'; g.fillRect(c * bw + off + 1, r * bh + 1, bw - 2, bh - 2); } } noise(g, s, 0.2, 3000); }, 256), 3);
    const containerTex = hex => makeTex(256, (g, s) => {
      g.fillStyle = hex; g.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(x, 0, 5, s); g.fillStyle = 'rgba(255,255,255,.09)'; g.fillRect(x + 8, 0, 3, s); }
      for (let i = 0; i < 9; i++) { const x = Math.random() * s, y = Math.random() * s * 0.5; const gr = g.createLinearGradient(0, y, 0, y + rnd(40, 140)); gr.addColorStop(0, 'rgba(110,56,24,.55)'); gr.addColorStop(1, 'rgba(110,56,24,0)'); g.fillStyle = gr; g.fillRect(x, y, rnd(3, 9), 140); }
      noise(g, s, 0.12, 3000);
    });
    T.corrN = normalFromHeight(heightCanvas(128, (x) => 0.5 + 0.45 * Math.sin(x / 16 * Math.PI * 2)), 4);
    T.crate = makeTex(256, (g, s) => {
      g.fillStyle = '#86683f'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 5; i++) { const v = rnd(-14, 14); g.fillStyle = `rgb(${134 + v | 0},${104 + v | 0},${62 + v * 0.6 | 0})`; g.fillRect(0, i * s / 5 + 1, s, s / 5 - 2); }
      for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(60,40,20,.25)'; g.fillRect(Math.random() * s, Math.random() * s, rnd(10, 40), 1); }
      g.strokeStyle = '#5d4628'; g.lineWidth = 22; g.strokeRect(11, 11, s - 22, s - 22);
      g.lineWidth = 20; g.beginPath(); g.moveTo(20, 20); g.lineTo(s - 20, s - 20); g.stroke();
      g.fillStyle = '#2b2620'; for (const [x, y] of [[11, 11], [s - 11, 11], [11, s - 11], [s - 11, s - 11]]) { g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(30,26,20,.55)'; g.font = 'bold 26px monospace'; g.fillText('ZH-07', s * 0.56, s * 0.28);
    });
    T.sand = makeTex(256, (g, s) => {
      g.fillStyle = '#7d7056'; g.fillRect(0, 0, s, s);
      for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) { const x = c * s / 2 + (r % 2) * s / 4, y = r * s / 4; const v = rnd(-12, 12); g.fillStyle = `rgb(${150 + v | 0},${136 + v | 0},${102 + v | 0})`; g.beginPath(); g.ellipse(x + s / 4, y + s / 8, s / 4 - 4, s / 8 - 3, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(60,50,35,.5)'; g.lineWidth = 2; g.stroke(); }
      noise(g, s, 0.14, 4000);
    });
    T.barrel = makeTex(128, (g, s) => { g.fillStyle = '#7a3a22'; g.fillRect(0, 0, s, s); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, s * 0.3, s, 5); g.fillRect(0, s * 0.68, s, 5); blotch(g, s, 10, 'rgba(60,30,14,.5)', 'rgba(160,90,50,.3)'); noise(g, s, 0.15, 1500); });
    T.flash = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,.9)'); gr.addColorStop(0.6, 'rgba(255,120,30,.25)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,210,120,.8)'; for (let i = 0; i < 6; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 3 + rnd(-0.2, 0.2)); g.beginPath(); g.moveTo(0, -5); g.lineTo(rnd(46, 62), 0); g.lineTo(0, 5); g.fill(); g.restore(); } return new THREE.CanvasTexture(c); })();
    T.puff = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    T.fabricN = normalFromHeight(heightCanvas(256, (x, y) => 0.5 + 0.18 * Math.sin((x + y) * Math.PI / 2) + 0.12 * Math.sin(x * 0.05 + Math.sin(y * 0.07) * 2) + 0.1 * Math.sin(y * 0.11 + x * 0.02) + (Math.random() - 0.5) * 0.12), 2.2);
    T.grain = makeTex(128, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); noise(g, s, 0.12, 3000); blotch(g, s, 6, 'rgba(0,0,0,.12)', 'rgba(255,255,255,.1)'); });
    T.metal = makeTex(128, (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, rnd(4, 30), 1); } blotch(g, s, 6, 'rgba(0,0,0,.1)', 'rgba(255,255,255,.15)'); });

    M = {
      ground: new THREE.MeshStandardMaterial({ map: T.ground, normalMap: T.groundN, roughness: 0.97 }),
      concrete: new THREE.MeshStandardMaterial({ map: T.concrete, normalMap: T.concreteN, roughness: 0.95 }),
      brick: new THREE.MeshStandardMaterial({ map: T.brick, normalMap: T.brickN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.92 }),
      crate: new THREE.MeshStandardMaterial({ map: T.crate, roughness: 0.9 }),
      sand: new THREE.MeshStandardMaterial({ map: T.sand, normalMap: T.fabricN, roughness: 1 }),
      barrel: new THREE.MeshStandardMaterial({ map: T.barrel, roughness: 0.7, metalness: 0.3 }),
      cRed: new THREE.MeshStandardMaterial({ map: containerTex('#7a2f22'), normalMap: T.corrN, roughness: 0.75, metalness: 0.25 }),
      cBlue: new THREE.MeshStandardMaterial({ map: containerTex('#2d4a68'), normalMap: T.corrN, roughness: 0.75, metalness: 0.25 }),
      cGreen: new THREE.MeshStandardMaterial({ map: containerTex('#45583a'), normalMap: T.corrN, roughness: 0.75, metalness: 0.25 }),
      cOrange: new THREE.MeshStandardMaterial({ map: containerTex('#a8622a'), normalMap: T.corrN, roughness: 0.75, metalness: 0.25 }),
      far: new THREE.MeshStandardMaterial({ color: lin('#8a8c88'), roughness: 1 }),
      carGlass: new THREE.MeshStandardMaterial({ color: lin('#1b2228'), roughness: 0.15, metalness: 0.6 }),
      tire: new THREE.MeshStandardMaterial({ color: lin('#151515'), roughness: 0.9 }),
      paint: new THREE.MeshStandardMaterial({ color: lin('#c9a43a'), roughness: 0.9, transparent: true, opacity: 0.55 }),
    };
    A.T = T; A.M = M;
    initSoldierMats();
  };

  // ================================================================ GEOMETRIA
  function capGeo(rT, rB, len, seg) {
    seg = seg || 14; const pts = [], n = 5;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0005, Math.cos(a) * rB), -len + Math.sin(a) * rB)); }
    for (let i = 1; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0005, Math.cos(a) * rT), Math.sin(a) * rT)); }
    return new THREE.LatheGeometry(pts, seg);
  }
  A.capGeo = capGeo;
  const GS = (r, w, h) => new THREE.SphereGeometry(r || 1, w || 16, h || 12);
  const GB = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const GC = (rt, rb, h, s) => new THREE.CylinderGeometry(rt, rb, h, s || 14);
  function boxGeo(w, h, d, s) { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let i = 0; i < uv.count; i++) { const f = (i / 4) | 0; uv.setXY(i, uv.getX(i) * dims[f][0] / s, uv.getY(i) * dims[f][1] / s); } return g; }

  function mergeParts(parts, skinned) {
    parts.sort((a, b) => a.mi - b.mi);
    let vc = 0, ic = 0; for (const p of parts) { vc += p.geo.attributes.position.count; ic += p.geo.index.count; }
    const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = vc > 65535 ? new Uint32Array(ic) : new Uint16Array(ic);
    const si = skinned ? new Uint16Array(vc * 4) : null, sw = skinned ? new Float32Array(vc * 4) : null;
    const geo = new THREE.BufferGeometry(); let vo = 0, io = 0, gs = 0, cur = -1;
    for (const p of parts) {
      if (p.mi !== cur) { if (cur >= 0) geo.addGroup(gs, io - gs, cur); cur = p.mi; gs = io; }
      const g = p.geo, n = g.attributes.position.count, ia = g.index.array;
      pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
      for (let i = 0; i < ia.length; i++) idx[io + i] = ia[i] + vo;
      if (skinned) {
        for (let i = 0; i < n; i++) {
          let w = 0, ob = 0;
          if (p.blends) for (const bl of p.blends) { const y = p.local[i * 3 + 1]; const ww = clamp((y - bl[1]) / (bl[2] - bl[1]), 0, 1); if (ww > w) { w = ww; ob = bl[0]; } }
          const j = (vo + i) * 4; si[j] = p.bone; si[j + 1] = ob; sw[j] = 1 - w; sw[j + 1] = w;
        }
      }
      vo += n; io += ia.length;
    }
    if (cur >= 0) geo.addGroup(gs, io - gs, cur);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (skinned) { geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); }
    geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere(); geo.computeBoundingBox(); return geo;
  }
  const _m4 = new THREE.Matrix4(), _qq = new THREE.Quaternion(), _eu = new THREE.Euler();
  function pushPart(list, geo, mi, bone, bw, pos, rot, scl, blends) {
    _m4.compose(V3(...(pos || [0, 0, 0])), _qq.setFromEuler(_eu.set(...(rot || [0, 0, 0]))), V3(...(scl || [1, 1, 1])));
    const g = geo.clone(); g.applyMatrix4(_m4); const local = g.attributes.position.array.slice();
    if (bw) g.translate(bw.x, bw.y, bw.z); list.push({ geo: g, mi, bone, local, blends });
  }

  // ================================================================ CENÁRIO
  A.buildWorld = function (scene, opt) {
    opt = opt || {};
    const FOG = 0xc4b59b;
    scene.fog = new THREE.Fog(FOG, 28, 150);
    const sunDir = V3(0.55, 0.42, 0.35).normalize();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x56779c) }, hor: { value: new THREE.Color(FOG) }, sun: { value: sunDir } },
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 hor;uniform vec3 sun;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,top,pow(h,.5));float s=max(dot(vP,sun),0.);c+=vec3(1.,.85,.6)*pow(s,400.)*1.6+vec3(1.,.72,.45)*pow(s,10.)*.22;if(vP.y<0.)c=hor;gl_FragColor=vec4(c,1.);}'
    }));
    scene.add(sky);
    scene.add(new THREE.HemisphereLight(0xd8e0ea, 0x5c4f3c, 0.6));
    const sun = new THREE.DirectionalLight(0xffe0b0, 2.4);
    sun.position.copy(sunDir).multiplyScalar(80); sun.castShadow = opt.shadows !== false;
    const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 220;
    const sm = opt.shadowSize || 2048; sun.shadow.mapSize.set(sm, sm); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    const MAP = ZH.MAP;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), M.ground); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    for (const [x, z, w, d] of MAP.paint) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.paint); p.rotation.x = -Math.PI / 2; p.position.set(x, 0.01, z); p.receiveShadow = true; scene.add(p); }
    // caixas agrupadas por material: poucas chamadas de desenho
    const byMat = {};
    for (const b of MAP.boxes) { (byMat[b.mat] = byMat[b.mat] || []); pushPart(byMat[b.mat], boxGeo(b.w, b.h, b.d, b.uv), 0, 0, null, [b.x, b.y + b.h / 2, b.z]); }
    for (const k in byMat) { const mesh = new THREE.Mesh(mergeParts(byMat[k], false), M[k]); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh); }
    const farParts = []; for (const f of MAP.far) pushPart(farParts, GB(f.w, f.h, f.d), 0, 0, null, [f.x, f.h / 2, f.z]);
    const farMesh = new THREE.Mesh(mergeParts(farParts, false), M.far); scene.add(farMesh);
    const bp = []; for (const b of MAP.barrels) { pushPart(bp, GC(0.42, 0.42, 1.15, 16), 0, 0, null, [b.x, 0.575, b.z]); pushPart(bp, GC(0.43, 0.43, 0.05, 16), 0, 0, null, [b.x, 0.38, b.z]); pushPart(bp, GC(0.43, 0.43, 0.05, 16), 0, 0, null, [b.x, 0.78, b.z]); }
    const barrels = new THREE.Mesh(mergeParts(bp, false), M.barrel); barrels.castShadow = barrels.receiveShadow = true; scene.add(barrels);
    for (const c of MAP.cars) {
      const g = new THREE.Group(); const bodyMat = new THREE.MeshStandardMaterial({ color: lin(c.col), roughness: 0.55, metalness: 0.4, map: T.metal });
      const body = new THREE.Mesh(GB(1.9, 0.8, 4.4), bodyMat); body.position.y = 0.65;
      const cab = new THREE.Mesh(GB(1.7, 0.62, 2.2), M.carGlass); cab.position.set(0, 1.36, -0.2);
      const bump1 = new THREE.Mesh(GB(1.95, 0.18, 0.12), M.tire); bump1.position.set(0, 0.42, 2.22); const bump2 = bump1.clone(); bump2.position.z = -2.22;
      g.add(body, cab, bump1, bump2);
      for (const [wx, wz] of [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]]) { const w = new THREE.Mesh(GC(0.36, 0.36, 0.28, 16), M.tire); w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w); }
      for (const s of [-0.6, 0.6]) { const l = new THREE.Mesh(GB(0.3, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0x4a4030 })); l.position.set(s, 0.78, 2.21); g.add(l); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
      if (!c.alongZ) g.rotation.y = Math.PI / 2; g.position.set(c.x, 0, c.z); scene.add(g);
    }
    // postes de luz e cercas para dar escala
    const poleMat = new THREE.MeshStandardMaterial({ color: lin('#3a3c3d'), roughness: 0.6, metalness: 0.5 });
    const pp = []; for (const [x, z] of [[-30, 30], [30, -30], [-30, -30], [30, 30], [0, 44], [0, -44]]) { pushPart(pp, GC(0.08, 0.12, 8, 8), 0, 0, null, [x, 4, z]); pushPart(pp, GB(1.4, 0.1, 0.1), 0, 0, null, [x + 0.6, 7.9, z]); pushPart(pp, GB(0.5, 0.12, 0.25), 0, 0, null, [x + 1.2, 7.82, z]); }
    const poles = new THREE.Mesh(mergeParts(pp, false), poleMat); poles.castShadow = true; scene.add(poles);
    return { sky, sun, ground };
  };

  // ================================================================ SOLDADOS
  function camoTex(cols, opt) {
    opt = opt || {};
    return makeTex(512, (g, s) => {
      g.fillStyle = cols[0]; g.fillRect(0, 0, s, s); const sc = opt.scale || 1;
      for (let k = 1; k < cols.length; k++) {
        g.fillStyle = cols[k]; g.beginPath();
        for (let i = 0; i < (opt.count || 24); i++) { const x = Math.random() * s, y = Math.random() * s, n = 3 + (Math.random() * 4 | 0); for (let p = 0; p < n; p++) { const px = x + rnd(-30, 30) * sc, py = y + rnd(-20, 20) * sc, rx = rnd(10, 34) * sc, ry = rnd(6, 20) * sc, rot = Math.random() * 3; for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { const cx = px + ox, cy = py + oy; if (cx < -40 || cy < -40 || cx > s + 40 || cy > s + 40) continue; g.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); g.ellipse(cx, cy, rx, ry, rot, 0, 7); } } }
        g.fill();
      }
      if (opt.soft && 'filter' in g) { const c2 = document.createElement('canvas'); c2.width = c2.height = s; const g2 = c2.getContext('2d'); g2.filter = 'blur(2px)'; g2.drawImage(g.canvas, 0, 0); g.drawImage(c2, 0, 0); }
      g.globalAlpha = 0.07; g.strokeStyle = '#000'; g.lineWidth = 1; for (let i = -s; i < s; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke(); } g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,.22)'; g.setLineDash([5, 4]); g.lineWidth = 1.5; for (const y of [s * 0.25, s * 0.75]) { g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } g.setLineDash([]);
      blotch(g, s, 10, 'rgba(60,48,32,.18)', 'rgba(200,190,160,.08)'); noise(g, s, 0.06, 7000);
    }, opt.rep || 2, opt.rep || 2);
  }
  function corduraMats(hex) {
    const s = 256, col = document.createElement('canvas'), hc = document.createElement('canvas'); col.width = col.height = hc.width = hc.height = s;
    const g = col.getContext('2d'), h = hc.getContext('2d');
    g.fillStyle = hex; g.fillRect(0, 0, s, s); h.fillStyle = '#606060'; h.fillRect(0, 0, s, s);
    for (let r = 0; r < 5; r++) { const y = 18 + r * 46; g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, y, s, 20); h.fillStyle = '#b0b0b0'; h.fillRect(0, y, s, 20); for (let x = 16; x < s; x += 40) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, y, 4, 20); h.fillStyle = '#202020'; h.fillRect(x, y, 4, 20); } g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, y, s, 2); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 8; g.strokeRect(0, 0, s, s); h.strokeStyle = '#909090'; h.lineWidth = 8; h.strokeRect(0, 0, s, s);
    noise(g, s, 0.08, 4000); blotch(g, s, 8, 'rgba(40,32,22,.2)', 'rgba(220,210,190,.06)');
    for (let i = 0; i < 5000; i++) { const v = 90 + Math.random() * 30 | 0; h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(Math.random() * s, Math.random() * s, 1, 1); }
    const map = new THREE.CanvasTexture(col); map.encoding = THREE.sRGBEncoding; map.wrapS = map.wrapT = THREE.RepeatWrapping; map.anisotropy = Math.min(8, maxAniso);
    return { map, normal: normalFromHeight(hc, 3) };
  }
  const smat = o => new THREE.MeshStandardMaterial(Object.assign({ skinning: true, roughness: 0.9 }, o));
  let SHARED, SKIN, HAIR, BAND;
  function initSoldierMats() {
    SHARED = { boot: smat({ color: lin('#1f1d1a'), roughness: 0.75, map: T.grain }), dark: smat({ color: lin('#0c0d0e'), roughness: 0.18, metalness: 0.6 }) };
    SKIN = ['#c99a7a', '#a8765a', '#7c5238', '#e0b896', '#5e3c28'].map(c => smat({ color: lin(c), roughness: 0.58, map: T.grain }));
    HAIR = ['#2a2019', '#4a3424', '#15110e', '#6b4a2e'].map(c => smat({ color: lin(c), roughness: 0.85, normalMap: T.fabricN }));
    BAND = { friend: smat({ color: lin('#3e9be0'), emissive: lin('#123a5c'), roughness: 0.6 }), enemy: smat({ color: lin('#d8402f'), emissive: lin('#4a0b08'), roughness: 0.6 }), neutral: smat({ color: lin('#c9a43a'), emissive: lin('#3a2c08'), roughness: 0.6 }) };
  }
  const CM = {};
  function classMats(k) {
    if (CM[k]) return CM[k]; const c = ZH.CLASSES[k]; const camo = camoTex(c.camo, { soft: c.soft }); const cd = corduraMats(c.vest);
    CM[k] = {
      camo,
      cloth: smat({ map: camo, normalMap: T.fabricN, normalScale: new THREE.Vector2(0.7, 0.7) }),
      vest: smat({ map: cd.map, normalMap: cd.normal, roughness: 0.85 }),
      gear: smat({ color: lin(c.gear), map: T.grain, normalMap: T.fabricN, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.82 }),
      helmet: smat(k === 'specops' ? { color: lin('#2b2d30'), map: T.grain, roughness: 0.6, metalness: 0.15 } : { map: camo, roughness: 0.7 }),
    };
    return CM[k];
  }
  A.classMats = classMats;
  const MAT_KEYS = ['cloth', 'vest', 'gear', 'boot', 'skin', 'dark', 'helmet', 'hair', 'band'];
  const MI = Object.fromEntries(MAT_KEYS.map((k, i) => [k, i]));
  const BN = ['root', 'pelvis', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'hL', 'uaR', 'faR', 'hR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'];
  const TPL = {};
  function soldierTemplate(cls, fem) {
    const key = cls + (fem ? 'F' : 'M'); if (TPL[key]) return TPL[key];
    const H = fem ? 0.95 : 1, sw = fem ? 0.165 : 0.19, hw = fem ? 0.1 : 0.093, Tl = 0.43 * H, S = 0.43 * H, UA = 0.29 * H, FA = 0.255 * H, ANK = 0.07;
    const pelvisY = Tl + S + ANK + 0.05;
    const defs = [[-1, [0, 0, 0]], [0, [0, pelvisY, 0]], [1, [0, 0.07, 0]], [2, [0, 0.22 * H, 0]], [3, [0, 0.21 * H, 0]], [4, [0, 0.07, 0]],
      [3, [-sw, 0.15 * H, 0]], [6, [0, -UA, 0]], [7, [0, -FA, 0]], [3, [sw, 0.15 * H, 0]], [9, [0, -UA, 0]], [10, [0, -FA, 0]],
      [1, [-hw, -0.05, 0]], [12, [0, -Tl, 0]], [13, [0, -S, 0]], [1, [hw, -0.05, 0]], [15, [0, -Tl, 0]], [16, [0, -S, 0]]];
    const W = []; defs.forEach((d, i) => { const v = V3(...d[1]); if (d[0] >= 0) v.add(W[d[0]]); W[i] = v; });
    const parts = []; const add = (geo, mat, bone, pos, rot, scl, bl) => pushPart(parts, geo, MI[mat], bone, W[bone], pos, rot, scl, bl);
    const c = cls;
    add(GS(1), 'cloth', 1, [0, -0.03, 0], [0, 0, 0], fem ? [0.175, 0.125, 0.125] : [0.163, 0.12, 0.12], [[2, 0.03, 0.09]]);
    const tp = fem ? [[0.0005, -0.04], [0.13, -0.02], [0.135, 0.07], [0.15, 0.16], [0.165, 0.24], [0.17, 0.3], [0.155, 0.37], [0.1, 0.41], [0.0005, 0.42]]
      : [[0.0005, -0.04], [0.145, -0.02], [0.155, 0.08], [0.175, 0.17], [0.19, 0.25], [0.196, 0.32], [0.175, 0.39], [0.11, 0.43], [0.0005, 0.44]];
    add(new THREE.LatheGeometry(tp.map(p => new THREE.Vector2(p[0], p[1] * H)), 18), 'cloth', 2, [0, 0, 0], [0, 0, 0], [1, 1, 0.62], [[3, 0.12, 0.27], [1, 0.02, -0.06]]);
    for (const s of [-1, 1]) {
      const th = s < 0 ? 12 : 15, sh = th + 1, ft = th + 2, ua = s < 0 ? 6 : 9, fa = ua + 1, hd = ua + 2;
      add(capGeo(fem ? 0.088 : 0.082, 0.058, Tl), 'cloth', th, [0, 0, 0], [0, 0, 0], [1, 1, 1], [[1, -0.07, 0.03]]);
      add(GB(0.05, 0.12, 0.05), 'cloth', th, [s * 0.07, -0.24, 0.01]);
      add(capGeo(0.057, 0.044, S - 0.02), 'cloth', sh, [0, 0, 0], [0, 0, 0], [1, 1, 1], [[th, -0.05, 0.02]]);
      add(GS(1), 'gear', sh, [0, -0.02, 0.05], [0, 0, 0], [0.056, 0.068, 0.035]);
      add(GC(0.054, 0.058, 0.15), 'boot', ft, [0, 0.025, 0]);
      add(GB(0.1, 0.07, 0.23), 'boot', ft, [0, -0.025, 0.05]);
      add(GS(1, 12, 8), 'boot', ft, [0, -0.03, 0.16], [0, 0, 0], [0.05, 0.036, 0.045]);
      add(GB(0.108, 0.02, 0.25), 'boot', ft, [0, -0.06, 0.055]);
      add(GS(1), 'cloth', ua, [0, -0.015, 0], [0, 0, 0], [0.07, 0.075, 0.075], [[3, -0.04, 0.03]]);
      add(capGeo(0.055, 0.047, UA), 'cloth', ua, [0, 0, 0], [0, 0, 0], [1, 1, 1], [[3, -0.04, 0.03]]);
      if (s < 0) add(GC(0.058, 0.056, 0.05, 14), 'band', ua, [0, -0.085, 0]); else add(GB(0.07, 0.06, 0.012), 'gear', ua, [0, -0.07, 0.05]);
      add(capGeo(0.046, 0.037, FA), 'cloth', fa, [0, 0, 0], [0, 0, 0], [1, 1, 1], [[ua, -0.04, 0.02]]);
      add(GS(1), 'gear', fa, [0, -0.005, -0.036], [0, 0, 0], [0.045, 0.05, 0.035]);
      add(GC(0.04, 0.038, 0.05), 'gear', fa, [0, -FA + 0.02, 0]);
      add(GB(0.075, 0.085, 0.032), 'gear', hd, [0, -0.045, 0]);
      add(GB(0.07, 0.055, 0.028), 'gear', hd, [0, -0.11, 0.014], [-0.55, 0, 0]);
      add(GB(0.024, 0.05, 0.024), 'gear', hd, [s * -0.044, -0.04, 0.016], [0, 0, s * 0.3]);
    }
    const mask = c === 'specops';
    add(capGeo(0.052, 0.058, 0.12), mask ? 'gear' : 'skin', 4, [0, 0.08, 0], [0, 0, 0], [1, 1, 1], [[5, 0.03, 0.08]]);
    add(GS(1, 22, 16), mask ? 'gear' : 'skin', 5, [0, 0.11, 0], [0, 0, 0], fem ? [0.092, 0.108, 0.103] : [0.098, 0.115, 0.108]);
    add(GS(1, 18, 12), mask ? 'gear' : 'skin', 5, [0, 0.042, 0.024], [0, 0, 0], fem ? [0.074, 0.054, 0.078] : [0.084, 0.062, 0.086]);
    add(GB(0.022, 0.04, 0.03), 'skin', 5, [0, 0.088, 0.104], [-0.28, 0, 0]);
    if (mask) add(GB(0.15, 0.045, 0.03), 'skin', 5, [0, 0.103, 0.09]);
    for (const s of [-1, 1]) { add(GS(1, 10, 8), mask ? 'gear' : 'skin', 5, [s * 0.097, 0.095, 0], [0, 0, 0], [0.016, 0.03, 0.022]); add(GS(0.012, 10, 8), 'dark', 5, [s * 0.034, 0.103, 0.094]); add(GB(0.034, 0.009, 0.012), 'hair', 5, [s * 0.035, 0.122, 0.098], [0, 0, s * -0.1]); }
    if (!fem && !mask && (c === 'assault' || c === 'support')) add(GS(1, 16, 10), 'hair', 5, [0, 0.036, 0.03], [0, 0, 0], [0.087, 0.058, 0.086]);
    if (fem) add(capGeo(0.032, 0.022, 0.15), 'hair', 5, [0, 0.09, -0.1], [0.45, 0, 0]);
    const helmet = lowCut => { add(new THREE.SphereGeometry(0.135, 22, 12, 0, Math.PI * 2, 0, Math.PI * (lowCut ? 0.56 : 0.47)), 'helmet', 5, [0, 0.112, -0.006], [0, 0, 0], [1, 0.94, 1.08]); add(GB(0.055, 0.035, 0.03), 'dark', 5, [0, 0.205, 0.128], [0.35, 0, 0]); for (const s of [-1, 1]) add(GB(0.012, 0.026, 0.11), 'dark', 5, [s * 0.131, 0.135, -0.005]); add(GB(0.07, 0.03, 0.04), 'gear', 5, [0, 0.17, -0.14]); };
    if (c === 'assault') { helmet(true); add(GB(0.165, 0.03, 0.025), 'dark', 5, [0, 0.106, 0.1]); }
    if (c === 'support') { helmet(true); for (const s of [-1, 1]) add(GC(0.038, 0.038, 0.035), 'dark', 5, [s * 0.112, 0.1, 0], [0, 0, Math.PI / 2]); }
    if (c === 'specops') { helmet(false); add(GB(0.19, 0.048, 0.042), 'dark', 5, [0, 0.112, 0.094]); for (const s of [-1, 1]) add(GC(0.04, 0.04, 0.04), 'dark', 5, [s * 0.112, 0.1, 0], [0, 0, Math.PI / 2]); }
    if (c === 'recon') { add(GC(0.108, 0.115, 0.085, 18), 'cloth', 5, [0, 0.19, -0.005]); add(GC(0.2, 0.2, 0.012, 24), 'cloth', 5, [0, 0.155, -0.005]); add(GB(0.24, 0.06, 0.03), 'cloth', 4, [0, 0.02, 0.06]); }
    if (c === 'engineer') { add(new THREE.SphereGeometry(0.106, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 'gear', 5, [0, 0.135, -0.005], [0, 0, 0], [1, 0.72, 1.06]); add(GB(0.15, 0.012, 0.09), 'gear', 5, [0, 0.137, 0.12]); for (const s of [-1, 1]) add(GC(0.038, 0.038, 0.035), 'dark', 5, [s * 0.112, 0.1, 0], [0, 0, Math.PI / 2]); add(GB(0.012, 0.012, 0.08), 'dark', 5, [0.1, 0.065, 0.06], [0, 0.6, 0]); }
    const vestW = fem ? 0.32 : 0.35;
    if (c === 'recon') {
      add(GB(0.3, 0.17, 0.055), 'vest', 3, [0, -0.02, 0.122]);
      for (let i = 0; i < 4; i++) add(GB(0.062, 0.1, 0.045), 'vest', 3, [-0.105 + i * 0.07, -0.03, 0.16]);
      for (const s of [-1, 1]) add(GB(0.045, 0.02, 0.3), 'vest', 3, [s * 0.1, 0.17, 0]);
      add(GB(0.06, 0.38, 0.02), 'vest', 3, [0, 0.03, -0.122], [0, 0, 0.6]); add(GB(0.06, 0.38, 0.02), 'vest', 3, [0, 0.03, -0.122], [0, 0, -0.6]);
    } else {
      const heavy = c === 'support';
      add(GB(vestW + (heavy ? 0.03 : 0), heavy ? 0.36 : 0.32, 0.065), 'vest', 3, [0, 0.03, 0.118]);
      add(GB(vestW + (heavy ? 0.03 : 0), 0.36, 0.065), 'vest', 3, [0, 0.05, -0.118]);
      add(GC(0.18, 0.18, 0.16, 22), 'vest', 2, [0, 0.13, 0], [0, 0, 0], [1, 1, 0.68], [[3, 0.17, 0.25]]);
      for (const s of [-1, 1]) add(GB(0.075, 0.02, 0.25), 'vest', 3, [s * 0.105, 0.205, 0]);
      for (let i = -1; i <= 1; i++) { add(GB(0.072, 0.115, 0.05), 'vest', 3, [i * 0.08, -0.035, 0.172]); add(GB(0.076, 0.03, 0.056), 'gear', 3, [i * 0.08, 0.025, 0.174]); }
      add(GB(0.17, 0.08, 0.03), 'gear', 3, [0, 0.12, 0.164]);
      add(GB(0.06, 0.13, 0.05), 'vest', 3, [-0.2, 0.0, 0.04], [0, 0.3, 0]);
      if (heavy) for (const s of [-1, 1]) { add(GB(0.04, 0.2, 0.16), 'vest', 3, [s * 0.19, 0.04, 0]); add(GS(1), 'vest', 3, [s * 0.2, 0.16, 0], [0, 0, 0], [0.075, 0.04, 0.085]); }
      if (heavy || c === 'engineer') {
        add(GB(0.31, 0.4, 0.16), 'vest', 3, [0, 0.02, -0.235]); add(GB(0.28, 0.14, 0.05), 'gear', 3, [0, -0.06, -0.32]);
        add(GC(0.06, 0.06, 0.3, 12), 'gear', 3, [0, 0.25, -0.23], [0, 0, Math.PI / 2]);
        if (c === 'engineer') { add(GC(0.006, 0.004, 0.55, 6), 'dark', 3, [0.11, 0.45, -0.25]); add(GB(0.09, 0.13, 0.06), 'dark', 3, [0.11, 0.12, -0.33]); }
      }
    }
    add(GC(0.168, 0.168, 0.05, 22), 'gear', 1, [0, 0.05, 0], [0, 0, 0], [1, 1, 0.74]);
    add(GB(0.05, 0.04, 0.02), 'dark', 1, [0, 0.05, 0.125]);
    add(GB(0.055, 0.15, 0.09), 'gear', 15, [0.085, -0.1, 0]);
    add(GB(0.1, 0.1, 0.06), 'gear', 1, [0, 0.0, -0.13]);
    const geo = mergeParts(parts, true);
    return (TPL[key] = { geo, defs, pelvisY, UA, FA, H });
  }

  // ---------------- armas em 3ª pessoa (cano para +Z)
  let RM = null; const TPG = {};
  function tpWeapons() {
    if (RM) return;
    RM = [new THREE.MeshStandardMaterial({ color: lin('#2b2e30'), metalness: 0.75, roughness: 0.38 }), new THREE.MeshStandardMaterial({ color: lin('#1e201f'), roughness: 0.72 }), new THREE.MeshStandardMaterial({ color: lin('#6f6046'), roughness: 0.82 })];
    const mk = fn => { const p = []; fn((geo, mi, pos, rot, scl) => pushPart(p, geo, mi, 0, null, pos, rot, scl)); return mergeParts(p, false); };
    TPG.rifle = { geo: mk(a => { a(GB(0.05, 0.07, 0.26), 0, [0, 0, 0]); a(GB(0.06, 0.065, 0.2), 2, [0, 0, 0.22]); for (let i = 0; i < 4; i++) a(GB(0.064, 0.01, 0.016), 1, [0, 0.033, 0.16 + i * 0.04]); a(GC(0.011, 0.011, 0.15, 10), 0, [0, 0.01, 0.39], [Math.PI / 2, 0, 0]); a(GC(0.017, 0.017, 0.05, 10), 1, [0, 0.01, 0.48], [Math.PI / 2, 0, 0]); a(GB(0.042, 0.15, 0.07), 1, [0, -0.11, 0.05], [-0.2, 0, 0]); a(GB(0.036, 0.1, 0.045), 1, [0, -0.085, -0.085], [0.32, 0, 0]); a(GB(0.042, 0.07, 0.17), 2, [0, -0.01, -0.2]); a(GB(0.046, 0.085, 0.04), 1, [0, -0.015, -0.29]); a(GB(0.026, 0.012, 0.26), 0, [0, 0.042, 0.02]); a(GB(0.04, 0.04, 0.07), 1, [0, 0.067, -0.01]); a(GB(0.012, 0.035, 0.012), 0, [0, 0.055, 0.3]); }), wl: V3(-0.045, -0.062, 0.2), wr: V3(0.032, -0.05, -0.07), muz: V3(0, 0.01, 0.52), z: 0 };
    TPG.smg = { geo: mk(a => { a(GB(0.05, 0.075, 0.22), 1, [0, 0, 0]); a(GB(0.056, 0.06, 0.12), 0, [0, 0, 0.16]); a(GC(0.011, 0.011, 0.1, 10), 0, [0, 0.01, 0.27], [Math.PI / 2, 0, 0]); a(GB(0.035, 0.16, 0.05), 1, [0, -0.11, 0.06], [-0.1, 0, 0]); a(GB(0.036, 0.1, 0.045), 1, [0, -0.085, -0.07], [0.3, 0, 0]); a(GB(0.012, 0.012, 0.2), 0, [0.018, 0, -0.2]); a(GB(0.012, 0.012, 0.2), 0, [-0.018, 0, -0.2]); a(GB(0.05, 0.07, 0.015), 1, [0, -0.01, -0.3]); a(GB(0.036, 0.03, 0.05), 1, [0, 0.055, 0]); }), wl: V3(-0.045, -0.06, 0.15), wr: V3(0.032, -0.05, -0.06), muz: V3(0, 0.01, 0.34), z: 0 };
    TPG.sniper = { geo: mk(a => { a(GB(0.055, 0.075, 0.32), 0, [0, 0, 0]); a(GB(0.05, 0.11, 0.28), 2, [0, -0.02, -0.3]); a(GC(0.013, 0.013, 0.55, 10), 0, [0, 0.012, 0.44], [Math.PI / 2, 0, 0]); a(GC(0.02, 0.02, 0.06, 10), 1, [0, 0.012, 0.73], [Math.PI / 2, 0, 0]); a(GB(0.05, 0.07, 0.09), 1, [0, -0.07, 0.02]); a(GB(0.04, 0.1, 0.05), 1, [0, -0.085, -0.13], [0.3, 0, 0]); a(GC(0.022, 0.022, 0.3, 12), 0, [0, 0.085, 0.03], [Math.PI / 2, 0, 0]); a(GC(0.03, 0.022, 0.06, 12), 0, [0, 0.085, 0.2], [Math.PI / 2, 0, 0]); a(GB(0.06, 0.04, 0.24), 2, [0, -0.01, 0.24]); }), wl: V3(-0.045, -0.06, 0.26), wr: V3(0.032, -0.05, -0.12), muz: V3(0, 0.012, 0.78), z: 0 };
    TPG.shotgun = { geo: mk(a => { a(GB(0.055, 0.07, 0.24), 0, [0, 0, 0]); a(GC(0.014, 0.014, 0.5, 10), 0, [0, 0.02, 0.36], [Math.PI / 2, 0, 0]); a(GC(0.014, 0.014, 0.42, 10), 1, [0, -0.015, 0.33], [Math.PI / 2, 0, 0]); a(GB(0.06, 0.05, 0.14), 2, [0, -0.015, 0.3]); a(GB(0.048, 0.085, 0.26), 2, [0, -0.02, -0.25]); a(GB(0.04, 0.1, 0.05), 1, [0, -0.08, -0.09], [0.3, 0, 0]); }), wl: V3(-0.045, -0.07, 0.3), wr: V3(0.032, -0.05, -0.08), muz: V3(0, 0.02, 0.62), z: 0 };
    TPG.pistol = { geo: mk(a => { a(GB(0.032, 0.036, 0.19), 0, [0, 0.02, 0.02]); a(GB(0.03, 0.02, 0.17), 1, [0, -0.006, 0.02]); a(GB(0.03, 0.1, 0.05), 1, [0, -0.06, -0.06], [-0.25, 0, 0]); }), wl: V3(-0.03, -0.075, -0.05), wr: V3(0.03, -0.055, -0.08), muz: V3(0, 0.02, 0.13), z: 0.1 };
  }
  A.typeOf = id => (ZH.WEAPONS[id] || ZH.WEAPONS.m7).type;
  const DOWN = V3(0, -1, 0); A.DOWN = DOWN;
  const HAND_R_Q = new THREE.Quaternion(), HAND_L_Q = new THREE.Quaternion();
  (() => { const basis = (fing, palm, q) => { const y = fing.clone().normalize().negate(); const z = palm.clone().sub(y.clone().multiplyScalar(palm.dot(y))).normalize(); const x = new THREE.Vector3().crossVectors(y, z); q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); }; basis(V3(0, -0.95, -0.31), V3(-1, 0, 0), HAND_R_Q); basis(V3(0.5, -0.2, 0.85), V3(0, 1, 0), HAND_L_Q); })();

  /** Cria um soldado. team: 'friend' | 'enemy' | 'neutral'. */
  A.makeSoldier = function (cls, fem, tone, team, weaponId) {
    tpWeapons();
    if (tone == null) tone = (Math.random() * SKIN.length) | 0;
    const t = soldierTemplate(cls, fem); const cm = classMats(cls);
    const bones = t.defs.map(d => { const b = new THREE.Bone(); b.position.fromArray(d[1]); return b; });
    t.defs.forEach((d, i) => { if (d[0] >= 0) bones[d[0]].add(bones[i]); });
    const mats = MAT_KEYS.map(k => k === 'skin' ? SKIN[tone % SKIN.length] : k === 'hair' ? HAIR[(tone + (fem ? 1 : 0)) % HAIR.length] : k === 'band' ? BAND[team || 'neutral'] : cm[k] || SHARED[k]);
    const mesh = new THREE.SkinnedMesh(t.geo, mats); mesh.add(bones[0]); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
    const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.add(mesh);
    const gun = new THREE.Mesh(TPG.rifle.geo, RM); gun.castShadow = true; gun.matrixAutoUpdate = false; bones[3].add(gun);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flash, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.set(0.55, 0.55, 0.55); fl.visible = false; gun.add(fl);
    const b = {}; BN.forEach((n, i) => b[n] = bones[i]);
    const s = { root, mesh, gun, fl, b, t, cls, fem, tone, wt: null, a: { t: Math.random() * 10, phase: 0, speed: 0, legYaw: 0, crouch: 0, aim: 0, sprint: 0, kick: 0, hit: 0, hitSide: 1, hitHead: 0, dead: false, deathT: 0, fall: -1, roll: 0, look: 0, melee: 0 } };
    A.setSoldierWeapon(s, weaponId || 'm7');
    return s;
  };
  A.setSoldierWeapon = function (s, id) {
    const type = A.typeOf(id); if (s.wt === type) return; s.wt = type; const g = TPG[type];
    s.gun.geometry = g.geo; s.wl = g.wl; s.wr = g.wr; s.poseZ = g.z; s.muz = g.muz; s.fl.position.copy(g.muz); s.fl.position.z += 0.04;
  };
  A.setSoldierTeam = function (s, team) { s.mesh.material[MI.band] = BAND[team || 'neutral']; };

  const _a = V3(0, 0, 0), _b = V3(0, 0, 0), _c = V3(0, 0, 0), _d = V3(0, 0, 0), _e = V3(0, 0, 0), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion(), _ey = new THREE.Quaternion();
  const LIMP_L = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, -0.35)), LIMP_R = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, 0, 0.35)), LIMP_F = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0));
  const POSE_AIM = { p: V3(0.075, 0.19, 0.31), r: new THREE.Euler(0, 0, 0) }, POSE_LOW = { p: V3(0.05, 0.05, 0.27), r: new THREE.Euler(0.6, 0, -0.2) }, POSE_RUN = { p: V3(0.0, 0.09, 0.22), r: new THREE.Euler(0.3, 0.85, 0.45) };
  const _gp = V3(0, 0, 0), _gq = new THREE.Quaternion(), _gq2 = new THREE.Quaternion(), _tr = V3(0, 0, 0), _tl = V3(0, 0, 0), YAX = V3(0, 1, 0);
  function solveArm(ua, fa, hd, Tg, pole, a, b, handQ) {
    const S = ua.position; _a.subVectors(Tg, S); let L = _a.length(); const n = _a.multiplyScalar(1 / (L || 1));
    L = clamp(L, Math.abs(a - b) + 0.02, a + b - 0.002);
    const cosA = clamp((a * a + L * L - b * b) / (2 * a * L), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    _b.copy(pole).addScaledVector(n, -pole.dot(n)).normalize();
    _c.copy(S).addScaledVector(n, a * cosA).addScaledVector(_b, a * sinA);
    _d.subVectors(_c, S).normalize(); ua.quaternion.setFromUnitVectors(DOWN, _d);
    _e.copy(S).addScaledVector(n, L).sub(_c).normalize();
    _qa.copy(ua.quaternion).invert(); _e.applyQuaternion(_qa); fa.quaternion.setFromUnitVectors(DOWN, _e);
    _qb.copy(ua.quaternion).multiply(fa.quaternion).invert(); hd.quaternion.copy(_qb).multiply(handQ);
  }
  const POLE_R = V3(0.7, -1, -0.35).normalize(), POLE_L = V3(-0.8, -1, 0.1).normalize();
  /** o: {speed, moveYaw, yaw, aim, aimPitch, crouch, sprint} — yaw e moveYaw na convenção do modelo (frente = +Z). */
  A.animSoldier = function (s, dt, o) {
    const a = s.a, b = s.b, t = s.t, k = x => 1 - Math.exp(-x * dt); a.t += dt;
    if (a.dead) { animDeath(s, dt); return; }
    a.crouch = lerp(a.crouch, o.crouch ? 1 : 0, k(7)); a.aim = lerp(a.aim, o.aim ? 1 : 0, k(9)); a.sprint = lerp(a.sprint, o.sprint ? 1 : 0, k(6));
    a.speed = lerp(a.speed, o.speed, k(10)); a.kick = Math.max(0, a.kick - dt * 12); a.hit = Math.max(0, a.hit - dt * 4); a.hitHead = Math.max(0, a.hitHead - dt * 4); a.melee = Math.max(0, a.melee - dt * 3);
    let rel = 0, dir = 1;
    if (o.speed > 0.15) { rel = Math.atan2(Math.sin(o.moveYaw - o.yaw), Math.cos(o.moveYaw - o.yaw)); if (Math.abs(rel) > 1.85) { rel -= Math.sign(rel) * Math.PI; dir = -1; } }
    a.legYaw = lerp(a.legYaw, clamp(rel, -1.15, 1.15), k(8));
    const run = clamp((a.speed - 3) / 3, 0, 1), amt = clamp(a.speed / 1.1, 0, 1), c = a.crouch;
    const Am = lerp(0.34, 0.6, run) * (1 - c * 0.35), stride = 2 * 0.86 * t.H * Math.sin(Am);
    a.phase += dir * a.speed * dt * Math.PI / stride;
    const sp = Math.abs(Math.sin(a.phase));
    b.pelvis.position.y = t.pelvisY - 0.4 * c - 0.86 * (1 - Math.cos(Am * sp)) * amt * 0.85 - 0.012 * (1 - amt) * (Math.sin(a.t * 1.7) * 0.5 + 0.5);
    b.pelvis.rotation.set(0, a.legYaw, Math.sin(a.phase) * 0.04 * amt);
    for (let side = 0; side < 2; side++) {
      const p = a.phase + side * Math.PI, th = side ? b.thR : b.thL, sh = side ? b.shR : b.shL, ft = side ? b.ftR : b.ftL;
      const tx = -Math.sin(p) * Am * amt - 1.15 * c + (side ? 0.04 : -0.04) * c, kn = 0.07 + Math.max(0, Math.cos(p)) * (0.55 + 0.75 * run) * amt + 2.0 * c;
      th.rotation.set(tx, 0, (side ? -0.04 : 0.04) * (1 - c) + (side ? -0.12 : 0.12) * c); sh.rotation.x = kn;
      ft.rotation.x = -(tx + kn) * 0.9 + Math.max(0, -Math.cos(p)) * 0.2 * amt;
    }
    const breath = Math.sin(a.t * 1.7) * 0.018 * (1 - amt);
    const lean = 0.12 * run + 0.15 * a.sprint + 0.28 * c + 0.06 * a.aim;
    const ap = clamp(o.aimPitch || 0, -0.8, 0.8) * a.aim;
    const twist = 0.38 * (1 - a.sprint * 0.8) * (0.5 + 0.5 * a.aim);
    b.spine.rotation.set(lean * 0.5 + breath - ap * 0.45 - a.hit * 0.4 + a.melee * 0.3, -a.legYaw * 0.6 - a.melee * 0.5, Math.sin(a.phase) * 0.03 * amt + a.hit * a.hitSide * 0.2);
    b.chest.rotation.set(lean * 0.5 - ap * 0.45 + breath * 0.6 - a.hit * 0.15, -a.legYaw * 0.4 + twist, 0);
    b.neck.rotation.set(-lean * 0.4 + ap * 0.1, -twist * 0.6, 0);
    b.head.rotation.set(-lean * 0.3 + 0.08 * a.aim - a.hitHead * 0.6, -twist * 0.3 + Math.sin(a.t * 0.4) * 0.25 * (1 - a.aim) * (1 - amt) * a.look, a.hitHead * 0.3);
    _gp.copy(POSE_LOW.p).lerp(POSE_AIM.p, a.aim); _gq.setFromEuler(POSE_LOW.r); _gq2.setFromEuler(POSE_AIM.r); _gq.slerp(_gq2, a.aim);
    if (a.sprint > 0.01) { _gq2.setFromEuler(POSE_RUN.r); _gq.slerp(_gq2, a.sprint); _gp.lerp(POSE_RUN.p, a.sprint); }
    _gp.z += s.poseZ * a.aim - a.kick * 0.035; _gq2.setFromEuler(_eu.set(-a.kick * 0.07 + (o.reload ? 0.5 : 0), 0, o.reload ? -0.4 : 0)); _gq.multiply(_gq2);
    if (o.reload) _gp.y -= 0.06;
    _ey.setFromAxisAngle(YAX, -twist);
    s.gun.position.copy(_gp).applyQuaternion(_ey); s.gun.quaternion.copy(_ey).multiply(_gq); s.gun.updateMatrix();
    _tr.copy(s.wr).applyMatrix4(s.gun.matrix); _tl.copy(s.wl).applyMatrix4(s.gun.matrix);
    if (o.reload) _tl.y -= 0.12 * Math.abs(Math.sin(a.t * 5));
    _qc.copy(s.gun.quaternion).multiply(HAND_R_Q); solveArm(b.uaR, b.faR, b.hR, _tr, POLE_R, t.UA, t.FA, _qc);
    _qc.copy(s.gun.quaternion).multiply(HAND_L_Q); solveArm(b.uaL, b.faL, b.hL, _tl, POLE_L, t.UA, t.FA, _qc);
  };
  function animDeath(s, dt) {
    const a = s.a, b = s.b, t = s.t; a.deathT += dt; const Td = a.deathT, k = x => 1 - Math.exp(-x * dt);
    const k1 = clamp(Td / 0.22, 0, 1), k2 = clamp((Td - 0.1) / 0.55, 0, 1), e2 = k2 * k2 * (3 - 2 * k2);
    const bend = k1 * (1 - e2 * 0.7);
    for (const side of [0, 1]) { const th = side ? b.thR : b.thL, sh = side ? b.shR : b.shL; th.rotation.x = lerp(th.rotation.x, -0.7 * bend + (side ? 0.15 : -0.1) * e2, k(10)); sh.rotation.x = lerp(sh.rotation.x, 1.3 * bend + 0.25 * e2, k(10)); }
    b.pelvis.position.y = lerp(b.pelvis.position.y, t.pelvisY - 0.25 * bend, k(10));
    b.spine.rotation.x = lerp(b.spine.rotation.x, a.fall * -0.35 * k1, k(8)); b.chest.rotation.x = lerp(b.chest.rotation.x, a.fall * -0.2, k(6));
    b.head.rotation.x = lerp(b.head.rotation.x, a.fall * -0.5, k(5));
    b.uaL.quaternion.slerp(LIMP_L, k(6)); b.uaR.quaternion.slerp(LIMP_R, k(6)); b.faL.quaternion.slerp(LIMP_F, k(6)); b.faR.quaternion.slerp(LIMP_F, k(6));
    s.root.rotation.x = a.fall * Math.PI / 2 * e2; s.root.rotation.z = a.roll * e2;
    s.root.position.y = s.baseY + (a.fall < 0 ? 0.13 : 0.18) * e2;
  }
  /** Inicia a queda. fromFront: tiro veio da frente do soldado. Solta a arma no cenário e retorna o objeto que cai. */
  A.killSoldier = function (s, fromFront, scene) {
    const a = s.a; a.dead = true; a.deathT = 0; a.fall = fromFront ? -1 : 1; a.roll = rnd(-0.25, 0.25); s.baseY = s.root.position.y;
    s.fl.visible = false;
    const g = s.gun; g.updateWorldMatrix(true, false); scene.attach(g); g.matrixAutoUpdate = true;
    return { g, v: V3(rnd(-1, 1), rnd(1, 2), rnd(-1, 1)), r: V3(rnd(-4, 4), rnd(-4, 4), rnd(-4, 4)) };
  };

  // ================================================================ ARMAS EM 1ª PESSOA
  A.buildViewModels = function () {
    const gm = {
      metal: new THREE.MeshStandardMaterial({ color: lin('#3d4245'), metalness: 0.7, roughness: 0.4, map: T.metal }),
      poly: new THREE.MeshStandardMaterial({ color: lin('#2b2d2c'), roughness: 0.7, map: T.grain }),
      tan: new THREE.MeshStandardMaterial({ color: lin('#7a6a4b'), roughness: 0.82, map: T.grain }),
      wood: new THREE.MeshStandardMaterial({ color: lin('#5c3e24'), roughness: 0.6, map: T.grain }),
      glove: new THREE.MeshStandardMaterial({ color: lin('#34352e'), roughness: 0.9, map: T.grain, normalMap: T.fabricN }),
      sleeve: new THREE.MeshStandardMaterial({ roughness: 0.95, normalMap: T.fabricN }),
      brass: new THREE.MeshStandardMaterial({ color: lin('#c9a24a'), metalness: 0.9, roughness: 0.3 }),
      lens: new THREE.MeshStandardMaterial({ color: lin('#18304a'), metalness: 0.9, roughness: 0.05 }),
      blade: new THREE.MeshStandardMaterial({ color: lin('#9aa0a4'), metalness: 0.95, roughness: 0.22 }),
      olive: new THREE.MeshStandardMaterial({ color: lin('#4b5536'), roughness: 0.6 }),
    };
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    const flashMat = () => new THREE.MeshBasicMaterial({ map: T.flash, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const models = {};
    function vm(id, build) {
      const g = new THREE.Group(); g.visible = false; g.matrixAutoUpdate = false;
      const P = (geo, mat, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); g.add(m); return m; };
      const D = (geo, mat, pos, dir) => { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.quaternion.setFromUnitVectors(DOWN, dir.clone().normalize()); g.add(m); return m; };
      const arm = (hand, side, fingersAlong) => {
        const s = side;
        P(GB(0.064, 0.072, 0.09), gm.glove, hand.x, hand.y, hand.z, -0.25, 0, 0);
        for (let i = 0; i < 4; i++) { if (fingersAlong) P(GB(0.05, 0.016, 0.02), gm.glove, hand.x - s * 0.034, hand.y + 0.022 - i * 0.004, hand.z - 0.045 + i * 0.022, 0, 0, s * 0.5); else P(GB(0.022, 0.018, 0.05), gm.glove, hand.x - s * 0.026, hand.y + 0.02 - i * 0.019, hand.z - 0.012, 0, 0, s * 0.2); }
        const wrist = V3(hand.x + s * 0.01, hand.y - 0.03, hand.z + 0.05);
        const dir = s > 0 ? V3(0.2, -0.42, 0.88) : V3(-0.45, -0.33, 0.83);
        D(capGeo(0.044, 0.048, 0.1), gm.glove, wrist, dir);
        D(capGeo(0.055, 0.063, 0.6), gm.sleeve, wrist.clone().addScaledVector(dir.clone().normalize(), 0.08), dir);
      };
      const o = build(P, D, arm);
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(o.flashSize || 0.22, o.flashSize || 0.22), flashMat()); fl.position.copy(o.muzzle); fl.position.z -= 0.02; fl.visible = false; g.add(fl);
      models[id] = Object.assign({ id, g, flash: fl }, o);
    }
    vm('m7', (P, D, arm) => {
      P(GB(0.056, 0.078, 0.30), gm.metal, 0, 0, 0); P(GB(0.066, 0.074, 0.24), gm.tan, 0, 0.002, -0.27);
      for (let i = 0; i < 5; i++) P(GB(0.07, 0.012, 0.02), gm.poly, 0, 0.03, -0.19 - i * 0.04);
      P(GC(0.012, 0.012, 0.2, 10), gm.metal, 0, 0.012, -0.48, Math.PI / 2); P(GC(0.019, 0.019, 0.06, 10), gm.poly, 0, 0.012, -0.6, Math.PI / 2);
      const mag = P(GB(0.045, 0.17, 0.08), gm.poly, 0, -0.12, -0.06, 0.22);
      P(GB(0.04, 0.11, 0.052), gm.poly, 0, -0.09, 0.1, -0.32); P(GB(0.046, 0.075, 0.22), gm.tan, 0, -0.012, 0.25); P(GB(0.05, 0.09, 0.05), gm.poly, 0, -0.03, 0.37);
      P(GB(0.03, 0.014, 0.32), gm.metal, 0, 0.046, -0.06); P(GB(0.042, 0.022, 0.07), gm.metal, 0, 0.063, 0);
      P(GB(0.006, 0.042, 0.006), gm.metal, -0.021, 0.095, -0.01); P(GB(0.006, 0.042, 0.006), gm.metal, 0.021, 0.095, -0.01); P(GB(0.048, 0.006, 0.006), gm.metal, 0, 0.115, -0.01);
      P(GB(0.02, 0.01, 0.04), gm.metal, 0.03, 0.02, -0.04); P(GB(0.012, 0.02, 0.02), gm.metal, 0, 0.05, -0.5);
      P(new THREE.SphereGeometry(0.0018, 8, 6), dotMat, 0, 0.088, -0.012);
      arm(V3(0.014, -0.085, 0.1), 1, false); arm(V3(-0.026, -0.048, -0.29), -1, true);
      return { mag, magY: -0.12, muzzle: V3(0, 0.012, -0.64), port: V3(0.03, 0.02, -0.04), hip: V3(0.15, -0.19, -0.4), ads: V3(0, -0.088, -0.2) };
    });
    vm('vespa', (P, D, arm) => {
      P(GB(0.05, 0.075, 0.22), gm.poly, 0, 0, 0); P(GB(0.058, 0.06, 0.12), gm.metal, 0, 0, -0.16);
      P(GC(0.011, 0.011, 0.08, 10), gm.metal, 0, 0.01, -0.26, Math.PI / 2); P(GC(0.016, 0.016, 0.04, 10), gm.poly, 0, 0.01, -0.3, Math.PI / 2);
      const mag = P(GB(0.035, 0.16, 0.05), gm.poly, 0, -0.11, -0.06, 0.1);
      P(GB(0.04, 0.1, 0.05), gm.poly, 0, -0.085, 0.07, -0.3);
      P(GB(0.012, 0.012, 0.2), gm.metal, 0.018, -0.005, 0.2); P(GB(0.012, 0.012, 0.2), gm.metal, -0.018, -0.005, 0.2); P(GB(0.05, 0.07, 0.015), gm.poly, 0, -0.015, 0.3);
      P(GB(0.026, 0.01, 0.22), gm.metal, 0, 0.042, -0.04);
      P(GB(0.036, 0.022, 0.05), gm.poly, 0, 0.055, 0.0); P(GB(0.004, 0.034, 0.004), gm.poly, -0.017, 0.08, -0.015); P(GB(0.004, 0.034, 0.004), gm.poly, 0.017, 0.08, -0.015); P(GB(0.038, 0.004, 0.004), gm.poly, 0, 0.097, -0.015);
      P(new THREE.SphereGeometry(0.0016, 8, 6), dotMat, 0, 0.07, -0.016);
      arm(V3(0.014, -0.08, 0.07), 1, false); arm(V3(-0.024, -0.045, -0.17), -1, true);
      return { mag, magY: -0.11, muzzle: V3(0, 0.01, -0.33), port: V3(0.028, 0.02, -0.02), hip: V3(0.15, -0.17, -0.36), ads: V3(0, -0.07, -0.18), flashSize: 0.17 };
    });
    vm('k90', (P, D, arm) => {
      P(GB(0.055, 0.075, 0.32), gm.metal, 0, 0, 0); P(GB(0.06, 0.06, 0.26), gm.olive, 0, -0.005, -0.28);
      P(GC(0.013, 0.013, 0.55, 12), gm.metal, 0, 0.012, -0.44, Math.PI / 2); P(GC(0.02, 0.02, 0.07, 12), gm.poly, 0, 0.012, -0.74, Math.PI / 2);
      const mag = P(GB(0.05, 0.07, 0.09), gm.poly, 0, -0.07, -0.02);
      P(GB(0.05, 0.11, 0.3), gm.olive, 0, -0.025, 0.3); P(GB(0.04, 0.1, 0.05), gm.poly, 0, -0.085, 0.14, -0.3);
      const bolt = P(GC(0.008, 0.008, 0.06, 8), gm.metal, 0.045, 0.02, 0.08, 0, 0, Math.PI / 2);
      P(GC(0.022, 0.022, 0.3, 16), gm.poly, 0, 0.085, -0.03, Math.PI / 2); P(GC(0.032, 0.024, 0.07, 16), gm.poly, 0, 0.085, -0.2, Math.PI / 2); P(GC(0.026, 0.022, 0.05, 16), gm.poly, 0, 0.085, 0.13, Math.PI / 2);
      P(new THREE.CircleGeometry(0.029, 16), gm.lens, 0, 0.085, -0.236, Math.PI); P(GB(0.03, 0.03, 0.02), gm.metal, 0, 0.058, -0.09); P(GB(0.03, 0.03, 0.02), gm.metal, 0, 0.058, 0.04);
      arm(V3(0.014, -0.085, 0.14), 1, false); arm(V3(-0.026, -0.05, -0.26), -1, true);
      return { mag, magY: -0.07, bolt, muzzle: V3(0, 0.012, -0.79), port: V3(0.03, 0.02, 0.0), hip: V3(0.15, -0.19, -0.42), ads: V3(0, -0.085, -0.1), scope: true, flashSize: 0.26 };
    });
    vm('r12', (P, D, arm) => {
      P(GB(0.055, 0.07, 0.24), gm.metal, 0, 0, 0);
      P(GC(0.014, 0.014, 0.5, 12), gm.metal, 0, 0.02, -0.37, Math.PI / 2); P(GC(0.014, 0.014, 0.42, 12), gm.poly, 0, -0.015, -0.33, Math.PI / 2);
      const pump = P(GB(0.062, 0.052, 0.15), gm.wood, 0, -0.016, -0.3);
      P(GB(0.048, 0.085, 0.26), gm.wood, 0, -0.03, 0.25); P(GB(0.04, 0.1, 0.05), gm.wood, 0, -0.08, 0.09, -0.3);
      P(new THREE.SphereGeometry(0.004, 8, 6), gm.brass, 0, 0.032, -0.6); P(GB(0.03, 0.01, 0.01), gm.metal, 0, 0.038, 0.1);
      P(GB(0.02, 0.01, 0.05), gm.metal, 0.03, 0.01, -0.02);
      arm(V3(0.014, -0.08, 0.09), 1, false); const lh = V3(-0.026, -0.05, -0.3); arm(lh, -1, true);
      return { pump, pumpZ: -0.3, muzzle: V3(0, 0.02, -0.63), port: V3(0.03, 0.01, -0.02), hip: V3(0.15, -0.18, -0.4), ads: V3(0, -0.042, -0.22), flashSize: 0.32 };
    });
    vm('p9', (P, D, arm) => {
      const slide = P(GB(0.032, 0.036, 0.19), gm.metal, 0, 0.02, -0.02); P(GB(0.03, 0.022, 0.17), gm.poly, 0, -0.006, -0.02);
      P(GB(0.032, 0.1, 0.052), gm.poly, 0, -0.06, 0.05, -0.25); const mag = P(GB(0.026, 0.02, 0.046), gm.poly, 0, -0.112, 0.064, -0.25);
      P(GB(0.006, 0.01, 0.006), gm.metal, 0, 0.042, -0.1); P(GB(0.006, 0.01, 0.006), gm.metal, -0.008, 0.042, 0.065); P(GB(0.006, 0.01, 0.006), gm.metal, 0.008, 0.042, 0.065);
      P(GB(0.004, 0.03, 0.04), gm.poly, 0, -0.03, -0.0);
      arm(V3(0.012, -0.075, 0.07), 1, false); arm(V3(-0.03, -0.085, 0.06), -1, false);
      return { mag, magY: -0.112, slide, muzzle: V3(0, 0.02, -0.12), port: V3(0.02, 0.03, -0.01), hip: V3(0.12, -0.15, -0.36), ads: V3(0, -0.044, -0.26), flashSize: 0.14 };
    });
    // faca (corpo a corpo) e granada na mão
    const knife = new THREE.Group(); knife.visible = false;
    { const b = new THREE.Mesh(GB(0.006, 0.03, 0.16), gm.blade); b.position.z = -0.1; const h = new THREE.Mesh(GB(0.022, 0.03, 0.1), gm.poly); const gd = new THREE.Mesh(GB(0.04, 0.012, 0.01), gm.metal); gd.position.z = -0.02; knife.add(b, h, gd); const gl = new THREE.Mesh(GB(0.07, 0.08, 0.09), gm.glove); gl.position.set(0.01, -0.01, 0.03); knife.add(gl); const sl = new THREE.Mesh(capGeo(0.055, 0.063, 0.5), gm.sleeve); sl.position.set(0.02, -0.03, 0.07); sl.quaternion.setFromUnitVectors(DOWN, V3(0.2, -0.4, 0.9).normalize()); knife.add(sl); }
    const nadeHand = new THREE.Group(); nadeHand.visible = false;
    { const n = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), gm.olive); n.scale.set(1, 1.2, 1); const l = new THREE.Mesh(GB(0.012, 0.05, 0.012), gm.metal); l.position.set(0.02, 0.04, 0); const gl = new THREE.Mesh(GB(0.07, 0.08, 0.09), gm.glove); gl.position.set(0, -0.04, 0.03); const sl = new THREE.Mesh(capGeo(0.055, 0.063, 0.5), gm.sleeve); sl.position.set(0, -0.06, 0.07); sl.quaternion.setFromUnitVectors(DOWN, V3(-0.3, -0.4, 0.9).normalize()); nadeHand.add(n, l, gl, sl); }
    const shellGeo = new THREE.CylinderGeometry(0.0045, 0.0045, 0.024, 8);
    return { models, knife, nadeHand, gm, shellGeo };
  };
  A.setSleeves = function (vms, cls) { vms.gm.sleeve.map = classMats(cls).camo; vms.gm.sleeve.needsUpdate = true; vms.gm.glove.color = lin(ZH.CLASSES[cls].gear); };
})();
