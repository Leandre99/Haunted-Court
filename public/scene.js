// Salle d'audience 3D : tribunal gothique sous l'orage. La caméra bouge comme un film,
// le fantôme est un shader, et chaque pièce à conviction vole depuis un nœud de l'arbre git.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export function createScene(canvas) {
  const T = THREE;
  // Rendu « linéaire » et lumières classiques : les intensités ci-dessous sont celles d'une scène de cinéma maison.
  T.ColorManagement.enabled = false;
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.useLegacyLights = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(0x07050b, 1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x0a0710, 0.036);
  const camera = new T.PerspectiveCamera(58, 1, 0.1, 80);

  // ---------- tweens ----------
  const tweens = [];
  const SPEED = Number(new URLSearchParams(location.search).get('speed')) || 1;
  // ?q=low : rendu allégé (tournage vidéo, machines modestes) — textures de reflet et d'ombre plus petites.
  const LOWQ = new URLSearchParams(location.search).get('q') === 'low';
  const K = (RM ? 0.2 : 1) / SPEED;
  const easeIO = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  function anim(ms, fn, ease = easeIO) {
    ms = Math.max(ms * K, 1);
    return new Promise((res) => {
      const tw = { t0: performance.now(), ms, fn, ease, res, done: false };
      tweens.push(tw);
      // Filet de sécurité : si le rendu est à l'arrêt (onglet caché), on termine quand même l'animation à l'heure dite.
      setTimeout(() => { if (!tw.done) { tw.done = true; const i = tweens.indexOf(tw); if (i >= 0) tweens.splice(i, 1); try { fn(ease(1), 1); } catch { /* ignoré */ } res(); } }, ms + 80);
    });
  }
  function stepTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], u = Math.min(1, (now - tw.t0) / tw.ms);
      tw.fn(tw.ease(u), u);
      if (u >= 1 && !tw.done) { tw.done = true; tweens.splice(i, 1); tw.res(); }
    }
  }

  // ---------- textures ----------
  const canvasTex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; return t;
  };
  const soft = canvasTex(64, 64, (c, w, h) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });

  // Textures PBR photographiques (Poly Haven, licence CC0) : couleur, relief, rugosité, occlusion ambiante.
  const texLoader = new T.TextureLoader();
  const texSet = (name) => Object.fromEntries(['diff', 'nor', 'rough', 'ao'].map((k) => [k, texLoader.load(`/assets/tex/${name}_${k}.jpg`)]));
  const SETS = { wall: texSet('wall'), floor: texSet('floor'), wood: texSet('wood') };
  function pbr(set, rx, ry, { color = 0xffffff, normal = 1, metal = 0 } = {}) {
    const cl = (t) => { const c = t.clone(); c.wrapS = c.wrapT = T.RepeatWrapping; c.repeat.set(rx, ry); c.anisotropy = 8; c.needsUpdate = true; return c; };
    return new T.MeshStandardMaterial({ color, map: cl(set.diff), normalMap: cl(set.nor), normalScale: new T.Vector2(normal, normal), roughnessMap: cl(set.rough), roughness: 1, aoMap: cl(set.ao), metalness: metal });
  }
  const W = (c) => pbr(SETS.wood, 1.2, 1.2, { color: c, normal: 1.1 });
  const L = (c, e) => new T.MeshStandardMaterial({ color: c, emissive: e || 0x000000, roughness: 0.78, metalness: 0.08 });

  // ---------- salle ----------
  const floor = new T.Mesh(new T.PlaneGeometry(20, 46), Object.assign(pbr(SETS.floor, 2.2, 5.1, { color: 0x88888f, normal: 1, metal: 0.1 }), { transparent: true, opacity: 0.8 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 5); floor.renderOrder = -10; scene.add(floor);
  let reflector = null;
  try {
    reflector = new Reflector(new T.PlaneGeometry(20, 46), { clipBias: 0.003, textureWidth: LOWQ ? 512 : 1024, textureHeight: LOWQ ? 512 : 1024, color: 0x9a96b8 });
    reflector.rotation.x = -Math.PI / 2; reflector.position.set(0, -0.02, 5); scene.add(reflector);
  } catch { floor.material.opacity = 1; }
  const wallMat = pbr(SETS.wall, 12.2, 3.2, { color: 0x8c8c96, normal: 1.4 });
  const wallMatBack = pbr(SETS.wall, 5.3, 3.2, { color: 0x8c8c96, normal: 1.4 });
  for (const [x, z, w, ry] of [[-10, 5, 46, Math.PI / 2], [10, 5, 46, -Math.PI / 2], [0, -16.5, 20, 0]]) {
    const m = new T.Mesh(new T.PlaneGeometry(w, 12), w === 20 ? wallMatBack : wallMat); m.position.set(x, 6, z); m.rotation.y = ry; scene.add(m);
  }
  const ceil = new T.Mesh(new T.PlaneGeometry(20, 46), L(0x0c0812)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 12, 5); scene.add(ceil);

  const colMat = pbr(SETS.wall, 1.6, 3.2, { color: 0x6c6c78, normal: 1.2 }), archMat = pbr(SETS.wall, 7, 0.8, { color: 0x64646e, normal: 1.2 });
  for (const z of [8, 3.4, -1.2, -5.8, -10.4, -15]) {
    for (const x of [-8.4, 8.4]) {
      const col = new T.Mesh(new T.CylinderGeometry(0.55, 0.65, 12, 10), colMat); col.position.set(x, 6, z); scene.add(col);
      const base = new T.Mesh(new T.BoxGeometry(1.5, 0.5, 1.5), colMat); base.position.set(x, 0.25, z); scene.add(base);
    }
    const arch = new T.Mesh(new T.TorusGeometry(8.4, 0.25, 6, 28, Math.PI), archMat); arch.position.set(0, 5.6, z); arch.scale.y = 0.62; scene.add(arch);
  }

  // Gargouilles aux yeux rouges
  const garEyes = [], garMat = L(0x0e0b14, 0x050308);
  for (const gz of [8, 3.4, -1.2, -5.8, -10.4]) for (const sd of [-1, 1]) {
    const g = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), garMat); head.scale.set(1, 0.9, 1.2); g.add(head);
    const snout = new T.Mesh(new T.ConeGeometry(0.2, 0.5, 8), garMat); snout.rotation.x = Math.PI / 2; snout.position.z = 0.5; g.add(snout);
    for (const hs of [-1, 1]) { const horn = new T.Mesh(new T.ConeGeometry(0.09, 0.5, 6), garMat); horn.position.set(hs * 0.28, 0.45, -0.05); horn.rotation.z = -hs * 0.5; g.add(horn); }
    const body = new T.Mesh(new T.CylinderGeometry(0.3, 0.5, 1.0, 8), garMat); body.position.set(0, -0.7, -0.3); g.add(body);
    for (const dx of [-0.16, 0.16]) {
      const e = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xff3040, blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
      e.scale.set(0.32, 0.32, 1); e.position.set(dx, 0.06, 0.44); e.userData = { ph: Math.random() * 6 }; g.add(e); garEyes.push(e);
    }
    g.position.set(sd * 7.55, 7.6, gz); g.rotation.y = sd === -1 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
  }

  // Vitrail + pluie + éclairs
  const winTex = canvasTex(512, 768, (c, w, h) => {
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    c.save(); c.beginPath(); c.moveTo(20, h); c.lineTo(20, 300); c.quadraticCurveTo(20, 40, w / 2, 10); c.quadraticCurveTo(w - 20, 40, w - 20, 300); c.lineTo(w - 20, h); c.closePath(); c.clip();
    const cols = ['#5a1e8c', '#1e2f8c', '#8c1e3a', '#c97a18', '#12606e', '#3a1470'];
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) { c.fillStyle = cols[(Math.random() * cols.length) | 0]; c.fillRect(x, y, 64, 64); }
    const g = c.createRadialGradient(w / 2, 200, 10, w / 2, 200, 230); g.addColorStop(0, 'rgba(255,255,230,.95)'); g.addColorStop(0.35, 'rgba(200,210,255,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#050308'; c.lineWidth = 7;
    for (let x = 0; x <= w; x += 64) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.restore();
  });
  const winMat = new T.MeshBasicMaterial({ map: winTex, fog: false });
  const win = new T.Mesh(new T.PlaneGeometry(5.6, 8.4), winMat); win.position.set(0, 7.2, -16.3); scene.add(win);
  const rainCv = document.createElement('canvas'); rainCv.width = 256; rainCv.height = 384;
  const rctx = rainCv.getContext('2d'), rainTex = new T.CanvasTexture(rainCv);
  const drops = Array.from({ length: 80 }, () => ({ x: Math.random() * 256, y: Math.random() * 384, v: 260 + Math.random() * 340, l: 14 + Math.random() * 34 }));
  const beads = Array.from({ length: 46 }, () => ({ x: Math.random() * 256, y: Math.random() * 384, r: 1.2 + Math.random() * 2.2 }));
  function drawRain(dt) {
    rctx.clearRect(0, 0, 256, 384); rctx.lineWidth = 1.4;
    for (const d of drops) {
      d.y += d.v * dt; if (d.y - d.l > 384) { d.y = -4; d.x = Math.random() * 256; }
      const g = rctx.createLinearGradient(d.x, d.y - d.l, d.x, d.y); g.addColorStop(0, 'rgba(190,210,255,0)'); g.addColorStop(1, 'rgba(220,235,255,.75)');
      rctx.strokeStyle = g; rctx.beginPath(); rctx.moveTo(d.x, d.y - d.l); rctx.lineTo(d.x + 1.5, d.y); rctx.stroke();
    }
    for (const b of beads) { rctx.fillStyle = 'rgba(210,225,255,.35)'; rctx.beginPath(); rctx.arc(b.x, b.y, b.r, 0, 6.283); rctx.fill(); rctx.fillStyle = 'rgba(255,255,255,.7)'; rctx.beginPath(); rctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, 6.283); rctx.fill(); }
    rainTex.needsUpdate = true;
  }
  const rainMesh = new T.Mesh(new T.PlaneGeometry(5.6, 8.4), new T.MeshBasicMaterial({ map: rainTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  rainMesh.position.set(0, 7.2, -16.2); scene.add(rainMesh);

  const shaftTex = canvasTex(16, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(190,200,255,.55)'); g.addColorStop(1, 'rgba(190,200,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const shafts = [];
  for (let i = 0; i < 6; i++) {
    const sh = new T.Mesh(new T.PlaneGeometry(1.1 + Math.random() * 0.8, 15), new T.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
    sh.position.set(-2.4 + i * 0.95, 6.5, -12 + i * 0.3); sh.rotation.x = -0.5; sh.rotation.z = (i - 2.5) * 0.06; sh.userData.seed = i * 1.7; scene.add(sh); shafts.push(sh);
  }

  // ---------- lumières ----------
  scene.add(new T.AmbientLight(0x4a3c78, 0.42));
  scene.add(new T.HemisphereLight(0x6577c8, 0x1a0f24, 0.6));
  const moon = new T.PointLight(0x7f90e8, 1.4, 32, 1.2); moon.position.set(0, 8, -13.5); scene.add(moon);
  const moonDir = new T.DirectionalLight(0x8a9cf0, 0.45); moonDir.position.set(0, 16, -15); moonDir.target.position.set(0, 0, 4); scene.add(moonDir); scene.add(moonDir.target);
  moonDir.castShadow = true; moonDir.shadow.mapSize.set(LOWQ ? 1024 : 2048, LOWQ ? 1024 : 2048); moonDir.shadow.bias = -0.0006; moonDir.shadow.radius = 3;
  Object.assign(moonDir.shadow.camera, { left: -14, right: 14, top: 16, bottom: -16, near: 1, far: 45 });

  // ---------- juge, marteau, tables ----------
  const bench = new T.Mesh(new T.BoxGeometry(9, 2.4, 2.2), W(0x8a6a4a)); bench.position.set(0, 1.2, -12); scene.add(bench);
  for (let i = 0; i < 5; i++) { const pn = new T.Mesh(new T.BoxGeometry(1.4, 1.6, 0.1), W(0x4a3322)); pn.position.set(-3.4 + i * 1.7, 1.2, -10.87); scene.add(pn); }
  const desk = new T.Mesh(new T.BoxGeometry(9.4, 0.2, 2.5), W(0xa07a52)); desk.position.set(0, 2.5, -12); scene.add(desk);
  const judge = new T.Group();
  const robe = new T.Mesh(new T.ConeGeometry(0.95, 3.3, 12), L(0x0b0910, 0x050308)); robe.position.y = 1.65; judge.add(robe);
  const sho = new T.Mesh(new T.SphereGeometry(0.8, 12, 8), L(0x0b0910)); sho.scale.set(1.2, 0.55, 0.8); sho.position.y = 3.1; judge.add(sho);
  const jh = new T.Mesh(new T.SphereGeometry(0.44, 14, 10), L(0x0b0910)); jh.position.y = 3.65; judge.add(jh);
  const skull = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), L(0xd9d2bd, 0x2a2820)); skull.scale.set(0.95, 1.05, 0.8); skull.position.set(0, 3.62, 0.26); judge.add(skull);
  const jaw = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 0.18), L(0xd9d2bd, 0x2a2820)); jaw.position.set(0, 3.36, 0.3); judge.add(jaw);
  for (const dx of [-0.11, 0.11]) { const so = new T.Mesh(new T.SphereGeometry(0.075, 8, 6), L(0x000000)); so.position.set(dx, 3.68, 0.5); judge.add(so); }
  const jeyeMat = new T.SpriteMaterial({ map: soft, color: 0xff3a3a, blending: T.AdditiveBlending, depthWrite: false });
  for (const dx of [-0.14, 0.14]) { const s = new T.Sprite(jeyeMat); s.scale.set(0.34, 0.34, 1); s.position.set(dx * 0.8, 3.68, 0.56); judge.add(s); }
  judge.position.set(0, 2.6, -12.9); scene.add(judge);

  const gavel = new T.Group();
  const gh = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.9), L(0x4a3020)); gh.position.z = 0.45; gavel.add(gh);
  const gd = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.42, 12), L(0x4a3020)); gd.rotation.z = Math.PI / 2; gd.position.z = 0.9; gavel.add(gd);
  gavel.position.set(1.9, 2.95, -11.7); gavel.rotation.x = -0.5; scene.add(gavel);
  const gblock = new T.Mesh(new T.CylinderGeometry(0.34, 0.34, 0.14, 14), L(0x2a1a10)); gblock.position.set(1.9, 2.6, -10.8); scene.add(gblock);

  function table(x, z, w) {
    const t = new T.Mesh(new T.BoxGeometry(w, 0.9, 1.5), W(0x7a5a3c)); t.position.set(x, 0.45, z); scene.add(t);
    for (let k = 0; k < 4; k++) { const p = new T.Mesh(new T.BoxGeometry(0.5, 0.02, 0.7), L(0xcdbf9a)); p.position.set(x - w / 2 + 0.5 + k * 0.55, 0.92, z + (Math.random() - 0.5) * 0.3); p.rotation.y = (Math.random() - 0.5) * 0.8; scene.add(p); }
  }
  table(-5.6, -1, 3.4); table(5.6, -1, 3.4);
  const lawyer = (x, emi) => {
    const g = new T.Group();
    const r = new T.Mesh(new T.ConeGeometry(0.7, 2.4, 10), L(0x0d0b14, emi)); r.position.y = 1.2; g.add(r);
    const h = new T.Mesh(new T.SphereGeometry(0.3, 10, 8), L(0x0d0b14, emi)); h.position.y = 2.6; g.add(h);
    g.position.set(x, 0, -2.3); scene.add(g);
  };
  lawyer(-5.6, 0x072a2a); lawyer(5.6, 0x2e0a0e);
  const stand = new T.Mesh(new T.BoxGeometry(2.2, 1.3, 1.5), W(0x7a5a3c)); stand.position.set(0, 0.65, -3.6 - 0.4); scene.add(stand);

  // ---------- détails d'architecture et accessoires ----------
  // Poutre faîtière et nervures diagonales de la voûte
  const ridge = new T.Mesh(new T.BoxGeometry(0.35, 0.35, 27), archMat); ridge.position.set(0, 10.75, -3); scene.add(ridge);
  for (const z of [8, 3.4, -1.2, -5.8, -10.4, -15]) for (const sd of [-1, 1]) {
    const rib = new T.Mesh(new T.BoxGeometry(0.16, 0.16, 5.2), archMat); rib.position.set(sd * 0.9, 10.2, z + 2.3); rib.rotation.x = 0; rib.rotation.y = sd * 0.0; scene.add(rib);
  }
  // Pierres d'angle autour du vitrail (meneaux)
  for (const x of [-2.9, 2.9]) { const jamb = new T.Mesh(new T.BoxGeometry(0.4, 9.2, 0.5), L(0x2a2034)); jamb.position.set(x, 7.2, -16.15); scene.add(jamb); }
  const sill = new T.Mesh(new T.BoxGeometry(6.2, 0.4, 0.7), L(0x2a2034)); sill.position.set(0, 2.9, -16.05); scene.add(sill);
  // Balance de la justice suspendue derrière le juge
  const scales = new T.Group(); scales.position.set(0, 6.6, -13.2); scene.add(scales);
  const brass = new T.MeshStandardMaterial({ color: 0xb08a3a, roughness: 0.35, metalness: 0.9 });
  const sBeam = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.2, 8), brass); sBeam.rotation.z = Math.PI / 2; scales.add(sBeam);
  const sPost = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 2.4, 8), brass); sPost.position.y = 1.2; scales.add(sPost);
  const pans = [];
  for (const sx of [-1.6, 1.6]) {
    const pan = new T.Group(); pan.position.set(sx, -1.1, 0);
    const bowl = new T.Mesh(new T.SphereGeometry(0.62, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass); pan.add(bowl);
    for (const a of [0, 2.1, 4.2]) { const ch = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 1.15, 4), brass); ch.position.set(Math.cos(a) * 0.4, 0.55, Math.sin(a) * 0.4); ch.rotation.z = -Math.cos(a) * 0.4; ch.rotation.x = Math.sin(a) * 0.4; pan.add(ch); }
    scales.add(pan); pans.push(pan);
  }
  // Livres, encrier et plume sur le bureau du juge et les tables des avocats
  const bookCols = [0x4a1218, 0x14283a, 0x2a3a14, 0x3a2a14];
  function books(x, y, z, n) { for (let i = 0; i < n; i++) { const b = new T.Mesh(new T.BoxGeometry(0.55 + Math.random() * 0.15, 0.1 + Math.random() * 0.06, 0.4), L(bookCols[i % 4])); b.position.set(x + (Math.random() - 0.5) * 0.08, y + 0.06 + i * 0.13, z); b.rotation.y = (Math.random() - 0.5) * 0.25; scene.add(b); } }
  books(-3.2, 2.6, -12.1, 4); books(3.9, 2.6, -12.0, 3); books(-5.9, 0.9, -1.0, 3); books(5.3, 0.9, -0.9, 2);
  const ink = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.16, 12), L(0x0a0a10)); ink.position.set(-0.9, 2.68, -11.3); scene.add(ink);
  const quill = new T.Mesh(new T.CylinderGeometry(0.008, 0.02, 0.8, 5), L(0xe8e2d0)); quill.position.set(-0.85, 2.95, -11.3); quill.rotation.z = -0.5; scene.add(quill);
  // Drapeaux déchirés le long des murs
  const flagTex = canvasTex(64, 256, (c, w, h) => { c.fillStyle = '#3a0c14'; c.fillRect(0, 0, w, h); c.fillStyle = '#c9a24a'; c.fillRect(w / 2 - 3, 20, 6, h - 60); c.beginPath(); c.arc(w / 2, 60, 14, 0, 6.283); c.stroke(); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 8 + Math.random() * 20); } });
  const flags = [];
  for (const z of [6, 0.6, -4, -8.6, -13]) for (const sd of [-1, 1]) {
    const f = new T.Mesh(new T.PlaneGeometry(1.2, 4.2, 4, 10), new T.MeshStandardMaterial({ map: flagTex, roughness: 0.95, side: T.DoubleSide }));
    f.position.set(sd * 9.85, 7.5, z); f.rotation.y = sd === -1 ? Math.PI / 2 : -Math.PI / 2; f.userData = { ph: Math.random() * 6, pos: f.geometry.attributes.position.array.slice() }; scene.add(f); flags.push(f);
  }

  // ---------- plateau de spiritisme + planchette ----------
  const otable = new T.Mesh(new T.BoxGeometry(5.2, 0.9, 3.4), W(0x6a4c32)); otable.position.set(0, 0.45, 3.2); scene.add(otable);
  const BW = 4, BH = 2.5, BC = [0, 0.92, 3.2], LP = {};
  const boardCv = document.createElement('canvas'); boardCv.width = 1024; boardCv.height = 640;
  const boardTex = new T.CanvasTexture(boardCv); boardTex.anisotropy = 4;
  function drawBoard() {
    const c = boardCv.getContext('2d'), w = 1024, h = 640;
    c.fillStyle = '#4a2c14'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { c.fillStyle = 'rgba(20,10,3,.08)'; c.fillRect(Math.random() * w, Math.random() * h, 60 + Math.random() * 90, 1.5); }
    c.strokeStyle = '#e5c88f'; c.lineWidth = 6; c.strokeRect(28, 28, w - 56, h - 56); c.lineWidth = 2; c.strokeRect(46, 46, w - 92, h - 92);
    c.fillStyle = '#e5c88f'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = 'bold 66px "Pirata One", serif'; c.fillText('YES', 160, 120); c.fillText('NO', w - 160, 120);
    c.beginPath(); c.arc(w / 2 - 120, 115, 34, 0, 6.283); c.fill(); c.fillStyle = '#4a2c14'; c.beginPath(); c.arc(w / 2 - 105, 108, 30, 0, 6.283); c.fill();
    c.fillStyle = '#e5c88f'; c.beginPath(); c.arc(w / 2 + 120, 115, 32, 0, 6.283); c.fill();
    c.font = 'bold 58px "Pirata One", serif';
    const A = 'ABCDEFGHIJKLM', B = 'NOPQRSTUVWXYZ';
    for (let i = 0; i < 13; i++) {
      const x = 120 + i * (w - 240) / 12, ya = 300 - Math.sin(i / 12 * Math.PI) * 58, yb = 450 - Math.sin(i / 12 * Math.PI) * 58;
      c.fillText(A[i], x, ya); c.fillText(B[i], x, yb); LP[A[i]] = { x, y: ya }; LP[B[i]] = { x, y: yb };
    }
    c.font = '28px "Courier Prime", monospace'; c.fillText('F A R E W E L L', w / 2, 575);
    boardTex.needsUpdate = true;
  }
  drawBoard(); document.fonts?.ready.then(drawBoard);
  const board = new T.Mesh(new T.PlaneGeometry(BW, BH), new T.MeshLambertMaterial({ map: boardTex, color: 0x5c5c5c })); board.rotation.x = -Math.PI / 2; board.position.set(BC[0], BC[1], BC[2]); scene.add(board);
  const psh = new T.Shape(); psh.moveTo(0, 0.55); psh.bezierCurveTo(0.25, 0.3, 0.42, -0.1, 0.3, -0.35); psh.bezierCurveTo(0.15, -0.5, -0.15, -0.5, -0.3, -0.35); psh.bezierCurveTo(-0.42, -0.1, -0.25, 0.3, 0, 0.55);
  const hole = new T.Path(); hole.absarc(0, 0.02, 0.12, 0, Math.PI * 2, true); psh.holes.push(hole);
  const plan = new T.Group();
  const pm = new T.Mesh(new T.ExtrudeGeometry(psh, { depth: 0.07, bevelEnabled: false }), L(0x3a2312, 0x0a0502)); pm.rotation.x = -Math.PI / 2; pm.scale.set(0.55, 0.55, 0.55); plan.add(pm);
  const pr = new T.Mesh(new T.RingGeometry(0.062, 0.085, 28), new T.MeshBasicMaterial({ color: 0x79e0c4, blending: T.AdditiveBlending, transparent: true, depthWrite: false, side: T.DoubleSide })); pr.rotation.x = -Math.PI / 2; pr.position.y = 0.06; plan.add(pr);
  const pg = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0x79e0c4, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); pg.scale.set(0.5, 0.5, 1); pg.position.y = 0.12; plan.add(pg);
  plan.position.set(BC[0], BC[1] + 0.05, BC[2]); scene.add(plan);
  const planPos = { x: 0, z: BC[2] };
  const letterWorld = (ch) => { const p = LP[ch]; return p ? { x: (p.x / 1024 - 0.5) * BW, z: BC[2] + (p.y / 640 - 0.5) * BH } : null; };

  // ---------- flammes ----------
  const flames = [];
  function makeFlame() {
    const mat = new T.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSeed: { value: Math.random() * 20 }, uFlare: { value: 0 } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime;uniform float uSeed;uniform float uFlare;varying vec2 vUv;'
        + 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}'
        + 'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y);}'
        + 'void main(){float t=uTime*2.4+uSeed;float y=vUv.y;float sway=(n(vec2(y*3.0,t))-0.5)*0.4*y;float x=(vUv.x-0.5+sway)*2.0;'
        + 'float w=(1.0-pow(y,1.3))*0.62*(0.85+0.3*n(vec2(t*1.3,y*4.0)));float d=abs(x)/max(w,0.001);'
        + 'float body=smoothstep(1.0,0.2,d)*smoothstep(1.0,0.78,y)*smoothstep(0.0,0.06,y);float core=smoothstep(0.5,0.0,d)*smoothstep(0.65,0.0,y);'
        + 'vec3 col=mix(vec3(1.0,0.32,0.04),vec3(1.0,0.78,0.28),smoothstep(0.7,0.05,y+d*0.35));col=mix(col,vec3(1.0,0.97,0.85),core);col=mix(col,vec3(0.3,0.45,1.0),smoothstep(0.14,0.0,y)*0.55);'
        + 'float a=body*(1.0+uFlare*0.6);gl_FragColor=vec4(col*a*1.5,a);}',
    });
    const g = new T.PlaneGeometry(0.34, 0.62); g.translate(0, 0.31, 0);
    const m = new T.Mesh(g, mat); flames.push(m); return m;
  }
  const candles = [];
  function candle(x, y, z, lit, h = 0.5, parent = scene) {
    const wax = new T.Mesh(new T.CylinderGeometry(0.07, 0.08, h, 8), L(0xd9ceb0, 0x302820)); wax.position.set(x, y + h / 2, z); parent.add(wax);
    const sp = makeFlame(); sp.position.set(x, y + h, z); parent.add(sp);
    const gs = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xff9a3a, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.28, fog: false })); gs.scale.set(1.1, 1.1, 1); gs.position.set(x, y + h + 0.25, z); parent.add(gs);
    let li = null; if (lit) { li = new T.PointLight(0xffa24a, 1.3, 11, 1.4); li.position.set(x, y + h + 0.4, z); parent.add(li); }
    candles.push({ sp, gs, li, seed: Math.random() * 10, base: 0.75 });
  }
  candle(-2.1, 0.9, 2.3, true); candle(2.1, 0.9, 2.3, true); candle(-1.2, 0.9, 4.3, false); candle(1.2, 0.9, 4.3, false);
  candle(-5.6, 0.9, -1.3, true); candle(5.6, 0.9, -1.3, true); candle(-3.4, 2.6, -11.2, true, 0.6); candle(3.4, 2.6, -11.2, false, 0.6);
  candle(-7.2, 0, -4, false, 1.2); candle(7.2, 0, -4, false, 1.2); candle(-7.2, 0, -9, false, 1.2); candle(7.2, 0, -9, false, 1.2);

  // ---------- poussière, brume, chauves-souris, lustre ----------
  const DUST = 520, dpos = new Float32Array(DUST * 3), dvel = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) { dpos[i * 3] = (Math.random() - 0.5) * 18; dpos[i * 3 + 1] = Math.random() * 11; dpos[i * 3 + 2] = -14 + Math.random() * 28; dvel[i] = 0.05 + Math.random() * 0.18; }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dpos, 3));
  scene.add(new T.Points(dg, new T.PointsMaterial({ size: 0.09, map: soft, color: 0xb8a8e8, transparent: true, opacity: 0.55, blending: T.AdditiveBlending, depthWrite: false })));

  const hazes = [];
  for (let i = 0; i < 26; i++) {
    const hz = new T.Sprite(new T.SpriteMaterial({ map: soft, color: i % 2 ? 0x6a5aa8 : 0x4a7a88, transparent: true, opacity: 0.12, depthWrite: false, fog: false }));
    hz.scale.set(6 + Math.random() * 5, 2.2 + Math.random() * 1.4, 1); hz.position.set((Math.random() - 0.5) * 18, 0.7 + Math.random() * 0.5, -12 + Math.random() * 24);
    hz.userData = { v: 0.1 + Math.random() * 0.25, ph: Math.random() * 6 }; scene.add(hz); hazes.push(hz);
  }
  const bats = [], batMat = new T.MeshBasicMaterial({ color: 0x050308, side: T.DoubleSide, fog: false });
  const wsh = new T.Shape(); wsh.moveTo(0, 0); wsh.lineTo(0.9, 0.28); wsh.lineTo(0.55, -0.05); wsh.lineTo(0.7, -0.32); wsh.lineTo(0, -0.12); wsh.lineTo(0, 0);
  const wingGeo = new T.ShapeGeometry(wsh);
  for (let i = 0; i < 20; i++) {
    const bat = new T.Group(), w1 = new T.Mesh(wingGeo, batMat), w2 = new T.Mesh(wingGeo, batMat); w2.scale.x = -1; bat.add(w1); bat.add(w2);
    bat.userData = { w1, w2, r: 4 + Math.random() * 7, h: 6 + Math.random() * 4.5, sp: 0.22 + Math.random() * 0.35, ph: Math.random() * 6.28, fl: 9 + Math.random() * 7, zc: -4 + Math.random() * 5 };
    bat.scale.setScalar(0.5 + Math.random() * 0.45); scene.add(bat); bats.push(bat);
  }
  const chand = new T.Group(); chand.position.set(0, 9, -2); scene.add(chand);
  const ring = new T.Mesh(new T.TorusGeometry(1.5, 0.07, 8, 32), L(0x3a2a1a, 0x120a04)); ring.rotation.x = Math.PI / 2; chand.add(ring);
  const chain = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 3.4, 6), L(0x2a2018)); chain.position.y = 1.7; chand.add(chain);
  for (let i = 0; i < 8; i++) { const ca = i / 8 * 6.283; candle(Math.cos(ca) * 1.5, 0, Math.sin(ca) * 1.5, false, 0.35, chand); }
  const cl = new T.PointLight(0xffa24a, 1.7, 18, 1.3); cl.position.set(0, -0.5, 0); chand.add(cl);

  // Bougies flottantes du rituel
  const floaters = [];
  for (let i = 0; i < 12; i++) {
    const fg = new T.Group(); fg.add(new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.5, 8), L(0xd9ceb0, 0x302820)));
    const fs = makeFlame(); fs.position.y = 0.25; fg.add(fs);
    fg.userData = { a: i / 12 * 6.283, r: 4.2 + (i % 3) * 0.8, h: 2.4 + (i % 4) * 0.9, sp: 0.25 + (i % 3) * 0.08, fs }; fg.visible = false; scene.add(fg); floaters.push(fg);
  }

  // Cercle magique, pilier de lumière, vortex
  const circTex = canvasTex(512, 512, (c) => {
    c.translate(256, 256); c.strokeStyle = '#79e0c4'; c.shadowColor = '#79e0c4'; c.shadowBlur = 12; c.lineWidth = 3;
    [240, 222, 160].forEach((r) => { c.beginPath(); c.arc(0, 0, r, 0, 6.283); c.stroke(); });
    c.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * (4 * Math.PI / 5), px = Math.cos(a) * 222, py = Math.sin(a) * 222; if (k === 0) c.moveTo(px, py); else c.lineTo(px, py); } c.closePath(); c.stroke();
    c.lineWidth = 2; for (let k = 0; k < 48; k++) { const b = k / 48 * 6.283; c.beginPath(); c.moveTo(Math.cos(b) * 226, Math.sin(b) * 226); c.lineTo(Math.cos(b) * 238, Math.sin(b) * 238); c.stroke(); }
    for (let k = 0; k < 12; k++) { const d = k / 12 * 6.283; c.beginPath(); c.arc(Math.cos(d) * 191, Math.sin(d) * 191, 9, 0, 6.283); c.stroke(); }
  });
  const circleMat = new T.MeshBasicMaterial({ map: circTex, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
  const circle = new T.Mesh(new T.PlaneGeometry(8, 8), circleMat); circle.rotation.x = -Math.PI / 2; circle.position.set(0, 0.04, -3.4); scene.add(circle);
  const pillarTex = canvasTex(8, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(121,224,196,0)'); g.addColorStop(1, 'rgba(160,255,235,.9)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const pillar = new T.Mesh(new T.CylinderGeometry(1.0, 1.5, 11, 28, 1, true), new T.MeshBasicMaterial({ map: pillarTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  pillar.position.set(0, 5.5, -3.4); scene.add(pillar);
  const VN = 1400, vpos = new Float32Array(VN * 3), vs = [];
  for (let i = 0; i < VN; i++) vs.push({ a: Math.random() * 6.283, r0: 2 + Math.random() * 5, u: Math.random(), v: 0.5 + Math.random() * 0.9 });
  const vgeo = new T.BufferGeometry(); vgeo.setAttribute('position', new T.BufferAttribute(vpos, 3));
  const vmat = new T.PointsMaterial({ size: 0.08, map: soft, color: 0x9ffff0, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const vortex = new T.Points(vgeo, vmat); vortex.frustumCulled = false; vortex.visible = false; scene.add(vortex);

  // ---------- fantômes (1 ou 2 en duel) ----------
  const uTime = { value: 0 };
  const prof = [[0.85, 0], [0.92, 0.18], [0.78, 0.5], [0.62, 0.9], [0.56, 1.2], [0.5, 1.45], [0.36, 1.66], [0, 1.78]].map(([x, y]) => new T.Vector2(x, y));
  const ghostVert = 'uniform float uTime;uniform float uGlitch;varying vec3 vN;varying vec3 vV;varying vec3 vP;'
    + 'void main(){vec3 p=position;float a=atan(p.x,p.z);float low=1.0-smoothstep(0.0,0.7,p.y);'
    + 'p.y-=(sin(a*7.0+uTime*2.2)*0.5+0.5)*0.4*low*step(0.001,length(p.xz));'
    + 'float fold=sin(a*9.0+p.y*2.5+uTime*0.8)*0.05+sin(a*17.0-p.y*4.0+uTime*1.3)*0.022;'
    + 'p.xz*=1.0+fold*(0.5+low);'
    + 'p.x+=sin(p.y*4.0+uTime*2.0)*0.06*(1.0-p.y/1.8);p.z+=cos(p.y*3.0+uTime*1.6)*0.05;'
    + 'p.x+=uGlitch*(step(0.5,fract(sin(floor(p.y*12.0+uTime*30.0))*437.5))-0.5)*0.6;'
    + 'vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}';
  const ghostFrag = 'uniform float uTime;uniform float uAppear;uniform float uMul;uniform vec3 uTint;varying vec3 vN;varying vec3 vV;varying vec3 vP;'
    + 'float h(vec2 s){return fract(sin(dot(s,vec2(12.9898,78.233)))*43758.5453);}'
    + 'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1.0,0.0)),f.x),mix(h(i+vec2(0.0,1.0)),h(i+vec2(1.0,1.0)),f.x),f.y);}'
    + 'float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<4;i++){v+=a*vn(p);p*=2.03;a*=0.5;}return v;}'
    + 'void main(){vec3 N=normalize(vN);vec3 V=normalize(vV);float f=pow(1.0-abs(dot(N,V)),1.5);'
    + 'float n=h(floor(vP.xy*22.0+vec2(0.0,-uTime*1.5)));float edge=uAppear*1.25-(1.0-vP.y/1.8)*0.25;if(n>edge)discard;'
    + 'float flow=fbm(vec2(vP.x*2.6+sin(vP.y*3.0+uTime*0.6)*0.5,vP.y*2.2-uTime*0.55));'
    + 'float body=0.32+0.5*f;float wisps=0.55+0.95*flow;'
    + 'float a=clamp(body*wisps,0.0,1.0);'
    + 'vec2 e1=vP.xy-vec2(0.17,1.32);vec2 e2=vP.xy-vec2(-0.17,1.32);'
    + 'float eye=smoothstep(0.15,0.06,min(length(e1),length(e2)))*step(0.0,vP.z);'
    + 'float mouth=smoothstep(0.13,0.04,length((vP.xy-vec2(0.0,0.98))*vec2(1.0,0.55)))*step(0.0,vP.z);'
    + 'float hood=smoothstep(1.55,1.35,vP.y)*smoothstep(1.05,1.3,vP.y);'
    + 'a*=(1.0-0.97*eye)*(1.0-0.85*mouth)*(1.0-0.25*hood);'
    + 'vec3 col=mix(uTint*1.1,vec3(1.0),f*0.4)*(0.7+0.6*flow);'
    + 'gl_FragColor=vec4(col*uMul*0.85,a*uMul);}';
  function makeGhost(hex) {
    const group = new T.Group(); group.position.set(0, 1.9, -3.4); group.scale.setScalar(2.1); group.visible = false; scene.add(group);
    const gu = { uTime, uAppear: { value: 0 }, uGlitch: { value: 0 }, uMul: { value: 1 }, uTint: { value: new T.Color(hex) } };
    const gmat = new T.ShaderMaterial({ uniforms: gu, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, vertexShader: ghostVert, fragmentShader: ghostFrag });
    group.add(new T.Mesh(new T.LatheGeometry(prof, 48), gmat));
    for (const [sx, sy, sz, hx, hy, hz] of [[0.5, 1.15, 0.1, 1.0, 0.78, 0.85], [-0.5, 1.15, 0.1, -1.0, 0.78, 0.85]]) {
      const s = new T.Vector3(sx, sy, sz), hnd = new T.Vector3(hx, hy, hz), d = hnd.clone().sub(s), len = d.length();
      const ag = new T.ConeGeometry(0.15, len, 10, 10, true);
      ag.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize())));
      ag.translate((s.x + hnd.x) / 2, (s.y + hnd.y) / 2, (s.z + hnd.z) / 2);
      group.add(new T.Mesh(ag, gmat));
      const hg = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xbfffee, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); hg.scale.set(0.45, 0.45, 1); hg.position.copy(hnd); group.add(hg);
    }
    const eyes = [];
    for (const dx of [-0.17, 0.17]) { const s = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xeaffff, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.set(0.34, 0.34, 1); s.position.set(dx, 1.32, 0.47); group.add(s); eyes.push(s); }
    const light = new T.PointLight(hex, 1.6, 9, 1.4); light.position.set(0, 2.2, -2.4); scene.add(light);
    const aura = new T.Sprite(new T.SpriteMaterial({ map: soft, color: hex, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3, fog: false })); aura.scale.set(7, 8, 1); scene.add(aura);
    const GP = 380, gp = new Float32Array(GP * 3), gs = [];
    for (let i = 0; i < GP; i++) gs.push({ a: Math.random() * 6.283, h: Math.random() * 2.4 - 0.2, r: 0.7 + Math.random() * 0.8, v: 0.4 + Math.random() * 1.1 });
    const pgm = new T.BufferGeometry(); pgm.setAttribute('position', new T.BufferAttribute(gp, 3));
    const pmat = new T.PointsMaterial({ size: 0.11, map: soft, color: hex, transparent: true, opacity: 0.7, blending: T.AdditiveBlending, depthWrite: false });
    const parts = new T.Points(pgm, pmat); parts.frustumCulled = false; scene.add(parts);
    return { group, gu, eyes, light, aura, GP, gp, gs, pgm, pmat, parts, appear: 0, x: 0, tx: 0, speak: 1, tspeak: 1 };
  }
  const ghosts = [makeGhost(0x79e0c4), makeGhost(0xb48cff)];
  ghosts[1].light.visible = false; ghosts[1].aura.visible = false;

  // Public fantôme dans les bancs (un brouillard de spectateurs)
  const audMat = new T.ShaderMaterial({ uniforms: { uTime, uAppear: { value: 1 }, uGlitch: { value: 0 }, uMul: { value: 0.3 }, uTint: { value: new T.Color(0x9a8cff) } }, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, vertexShader: ghostVert, fragmentShader: ghostFrag });
  const audGeo = new T.LatheGeometry(prof, 24), pewMat = W(0x5a4030), audience = [];
  for (const sd of [-1, 1]) for (const px of [5.6, 6.9]) {
    const xx = sd * px;
    const pew = new T.Mesh(new T.BoxGeometry(0.9, 0.5, 7), pewMat); pew.position.set(xx, 0.25, 4.6); scene.add(pew);
    const back = new T.Mesh(new T.BoxGeometry(0.12, 1.1, 7), pewMat); back.position.set(xx + sd * 0.5, 0.9, 4.6); scene.add(back);
    for (let k = 0; k < 4; k++) {
      const ag = new T.Mesh(audGeo, audMat); ag.scale.setScalar(0.7 + Math.random() * 0.15); ag.position.set(xx, 0.35, 2.2 + k * 1.6); ag.rotation.y = sd === -1 ? Math.PI / 2 : -Math.PI / 2;
      ag.userData = { ph: Math.random() * 6.28, bx: xx }; scene.add(ag); audience.push(ag);
    }
  }

  // ---------- l'arbre git ----------
  const treeG = new T.Group(); treeG.position.set(0, 0, -9.5); scene.add(treeG);
  const npos = [], segs = [], trunk = [];
  let tp0 = new T.Vector3(0, 4.2, 0);
  for (let tk = 0; tk < 46; tk++) { tp0 = tp0.clone().add(new T.Vector3(Math.sin(tk * 0.35) * 0.28, 0.17 + Math.random() * 0.05, Math.cos(tk * 0.28) * 0.2)); trunk.push(tp0); npos.push(tp0); if (tk > 0) segs.push([trunk[tk - 1], tp0]); }
  for (let tb = 0; tb < 7; tb++) {
    let tq = trunk[6 + tb * 6];
    const tdir = new T.Vector3((tb % 2 ? 1 : -1) * (0.35 + Math.random() * 0.25), 0.08 + Math.random() * 0.12, (Math.random() - 0.5) * 0.4);
    for (let tm = 0; tm < 17; tm++) { const tn = tq.clone().add(tdir).add(new T.Vector3((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.18)); npos.push(tn); segs.push([tq, tn]); tq = tn; }
  }
  const tgeo = new T.BufferGeometry(), tpa = new Float32Array(npos.length * 3);
  npos.forEach((v, n) => { tpa[n * 3] = v.x; tpa[n * 3 + 1] = v.y; tpa[n * 3 + 2] = v.z; });
  tgeo.setAttribute('position', new T.BufferAttribute(tpa, 3));
  const tree = new T.Points(tgeo, new T.PointsMaterial({ size: 0.26, map: soft, color: 0x79e0c4, transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, fog: false })); treeG.add(tree);
  const lpa = new Float32Array(segs.length * 6);
  segs.forEach((sg, n) => { lpa.set([sg[0].x, sg[0].y, sg[0].z, sg[1].x, sg[1].y, sg[1].z], n * 6); });
  const lgeo = new T.BufferGeometry(); lgeo.setAttribute('position', new T.BufferAttribute(lpa, 3));
  const treeLineMat = new T.LineBasicMaterial({ color: 0x79e0c4, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  treeG.add(new T.LineSegments(lgeo, treeLineMat));
  const nodeGlow = new T.Sprite(new T.SpriteMaterial({ map: soft, color: 0xbfffee, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); nodeGlow.scale.set(1.3, 1.3, 1); nodeGlow.visible = false; scene.add(nodeGlow);
  const beamGeo = new T.BufferGeometry(); beamGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3));
  const beamMat = new T.LineBasicMaterial({ color: 0x79e0c4, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, fog: false });
  const beam = new T.Line(beamGeo, beamMat); beam.frustumCulled = false; beam.visible = false; scene.add(beam);

  // Pièce à conviction : le vrai retour de git, affiché sur un panneau qui vole depuis un nœud de l'arbre.
  function drawProof(lines, ok, head) {
    const c = document.createElement('canvas'); c.width = 640; c.height = 380; const x = c.getContext('2d');
    x.fillStyle = 'rgba(6,22,20,.88)'; x.fillRect(0, 0, 640, 380);
    x.strokeStyle = ok ? '#79e0c4' : '#c9303a'; x.lineWidth = 4; x.strokeRect(4, 4, 632, 372);
    x.fillStyle = ok ? '#79e0c4' : '#ff5a64'; x.font = 'bold 28px "Courier Prime", monospace'; x.fillText('$ ' + head, 18, 44);
    x.font = '22px "Courier Prime", monospace';
    lines.slice(0, 8).forEach((l, n) => { const ch = l.charAt(0); x.fillStyle = ch === '+' ? '#7dffb0' : ch === '-' ? '#ff7a85' : ch === '@' ? '#f0c060' : /fatal|mismatch|not found|exit code|claimed/.test(l) ? '#ff7a85' : '#cfe9e4'; x.fillText(l, 18, 90 + n * 34); });
    x.fillStyle = ok ? 'rgba(121,224,196,.14)' : 'rgba(201,48,58,.14)'; for (let y = 0; y < 380; y += 4) x.fillRect(0, y, 640, 1);
    return new T.CanvasTexture(c);
  }
  let proof = null; const sparksList = [];
  function sparks(pos, color, n, speed) {
    const g = new T.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let q = 0; q < n; q++) { p[q * 3] = pos.x; p[q * 3 + 1] = pos.y; p[q * 3 + 2] = pos.z; const a = Math.random() * 6.283, b = Math.random() * 2.2 - 0.6, sp = speed * (0.3 + Math.random()); v.push(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + speed * 0.3, Math.sin(a) * Math.cos(b) * sp); }
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    const o = new T.Points(g, new T.PointsMaterial({ size: 0.17, map: soft, color, transparent: true, opacity: 1, blending: T.AdditiveBlending, depthWrite: false }));
    scene.add(o); sparksList.push({ o, p, v, n, t0: performance.now() });
  }
  const rings = [], shocks = [];

  // ---------- post-traitement ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new T.Vector2(512, 512), 0.7, 0.6, 0.8); composer.addPass(bloom);
  const finalPass = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAber: { value: 0.0012 }, uFlash: { value: 0 }, uExp: { value: 0.78 }, uFC: { value: new T.Color(0xc9303a) } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform sampler2D tDiffuse;uniform float uTime;uniform float uAber;uniform float uFlash;uniform vec3 uFC;uniform float uExp;varying vec2 vUv;'
      + 'float h(vec2 s){return fract(sin(dot(s,vec2(12.9898,78.233)))*43758.5453);}'
      + 'vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}'
      + 'void main(){vec2 d=vUv-0.5;float r=length(d);vec2 o=d*uAber*(1.0+r*3.0);'
      + 'vec3 c=vec3(texture2D(tDiffuse,vUv+o).r,texture2D(tDiffuse,vUv).g,texture2D(tDiffuse,vUv-o).b);'
      + 'c=aces(c*uExp);c*=smoothstep(0.95,0.25,r);c+=(h(vUv*vec2(1731.0,917.0)+uTime)-0.5)*0.05;c+=uFC*uFlash;gl_FragColor=vec4(c,1.0);}',
  });
  composer.addPass(finalPass);

  function fit() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 74 : 58; camera.updateProjectionMatrix();
  }
  fit(); addEventListener('resize', fit);

  // ---------- caméra ----------
  const SHOTS = {
    wide: { p: [0, 2.7, 12.6], l: [0, 2.9, -6] }, ouija: { p: [0, 5.2, 8.6], l: [0, 1.4, 2.2] },
    ghost: { p: [1.4, 3.4, 5.2], l: [0, 3.7, -3.4], sw: 5 }, duel: { p: [0, 3.5, 6.4], l: [0, 3.6, -3.4], sw: 3 },
    defense: { p: [-1.2, 2.4, 3.4], l: [-5.6, 1.9, -1.2] }, judge: { p: [0, 3.5, -5], l: [0, 3.2, -12] },
  };
  const camPos = new T.Vector3(0, 5.5, 19), camLook = new T.Vector3(0, 3, -6), tgtPos = new T.Vector3(), tgtLook = new T.Vector3();
  let rigK = 1.1, roll = 0, rollT = 0, shakeA = 0, flareV = 0, glitchV = 0, aberV = 0, flashV = 0, burstV = 0, ritualV = 0.25, pillarV = 0, boltV = 0, nextBolt = 5, thunderAt = 0, swayK = 1, vortexV = 0, audVis = true, gavelHit = 0;
  const baseFog = new T.Color(0x0a0710), mouse = { x: 0, y: 0 };
  function shot(n, k) { const s = SHOTS[n]; tgtPos.set(...s.p); tgtLook.set(...s.l); rigK = k || 1.8; swayK = s.sw || 1; audVis = n !== 'ouija'; }
  shot('wide', 0.9);
  canvas.parentElement.addEventListener('pointermove', (e) => { const r = canvas.getBoundingClientRect(); mouse.x = ((e.clientX - r.left) / r.width - 0.5) * 2; mouse.y = ((e.clientY - r.top) / r.height - 0.5) * 2; });

  scene.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial && o !== floor && o.geometry.type !== 'PlaneGeometry') { o.castShadow = true; o.receiveShadow = true; } });
  floor.receiveShadow = true;
  scene.traverse((o) => { if (o.isMesh && o.geometry.type === 'PlaneGeometry' && (o.material === wallMat || o.material === wallMatBack)) o.receiveShadow = true; });

  new RGBELoader().load('/assets/hdri/env_1k.hdr', (hdr) => {
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromEquirectangular(hdr).texture; hdr.dispose(); pm.dispose();
    scene.traverse((o) => { if (o.material?.isMeshStandardMaterial) o.material.envMapIntensity = 0.3; });
  });

  // ---------- boucle ----------
  const clock = new T.Clock(); let frames = 0, acc = 0, lowQ = false, running = true, onThunder = null;
  function drawFrame() {
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime, now = performance.now();
    stepTweens(now);
    uTime.value = t; finalPass.uniforms.uTime.value = t % 100;
    const a = 1 - Math.exp(-dt * rigK); camPos.lerp(tgtPos, a); camLook.lerp(tgtLook, a);
    const sw = RM ? 0 : 1;
    camera.position.set(camPos.x + (Math.sin(t * 0.35) * 0.16 * swayK + mouse.x * 0.5) * sw + (Math.random() - 0.5) * shakeA, camPos.y + (Math.sin(t * 0.5) * 0.07 - mouse.y * 0.25) * sw + (Math.random() - 0.5) * shakeA, camPos.z + Math.cos(t * 0.3) * 0.35 * (swayK - 1) * sw + (Math.random() - 0.5) * shakeA * 0.5);
    camera.lookAt(camLook);
    roll += (rollT - roll) * (1 - Math.exp(-dt * 6)); camera.rotateZ(roll);
    shakeA *= Math.exp(-dt * 5); glitchV *= Math.exp(-dt * 3.5); aberV *= Math.exp(-dt * 3); flashV *= Math.exp(-dt * 4.5); burstV *= Math.exp(-dt * 1.4);
    finalPass.uniforms.uAber.value = 0.0012 + aberV; finalPass.uniforms.uFlash.value = flashV;
    bloom.strength = 0.6 + flareV * 0.15 + flashV * 0.2 + boltV * 0.2;
    flames.forEach((m) => { m.lookAt(camera.position); m.material.uniforms.uTime.value = t; });
    candles.forEach((c) => {
      const f = 0.78 + 0.22 * Math.sin(t * 9 + c.seed) * Math.sin(t * 5.3 + c.seed * 2) + 0.1 * Math.sin(t * 23 + c.seed), fl = 1 + flareV * 0.6;
      c.sp.scale.set(fl * (0.9 + 0.15 * f), fl * (0.85 + 0.3 * f), 1); c.sp.material.uniforms.uFlare.value = flareV; c.gs.material.opacity = 0.12 + 0.1 * f + flareV * 0.06;
      if (c.li) c.li.intensity = c.base * f * (1 + flareV * 0.3);
    });
    shafts.forEach((s) => { s.material.opacity = (0.14 + 0.07 * Math.sin(t * 0.5 + s.userData.seed)) * (1 + flareV * 0.4); });
    if (!RM && t > nextBolt) { boltV = 1; nextBolt = t + 7 + Math.random() * 9; thunderAt = t + 0.3 + Math.random() * 0.5; }
    boltV *= Math.exp(-dt * 6);
    const bv = boltV * (0.55 + 0.45 * Math.sin(t * 95));
    winMat.color.setScalar(1 + Math.max(0, bv) * 2.2); moon.intensity = 1.3 + 0.2 * Math.sin(t * 0.8) + Math.max(0, bv) * 2;
    scene.fog.color.copy(baseFog).addScalar(Math.max(0, bv) * 0.12);
    if ((frames & 1) === 0) drawRain(dt * 2);
    rainMesh.material.opacity = 0.55 + Math.max(0, bv) * 0.45;
    if (thunderAt && t > thunderAt) { thunderAt = 0; onThunder?.(); shakeA = Math.max(shakeA, 0.12); }
    for (let i = 0; i < DUST; i++) { dpos[i * 3 + 1] += dvel[i] * dt; dpos[i * 3] += Math.sin(t * 0.4 + i) * 0.002; if (dpos[i * 3 + 1] > 11.5) dpos[i * 3 + 1] = 0; }
    dg.attributes.position.needsUpdate = true;

    ghosts.forEach((g, gi) => {
      g.x += (g.tx - g.x) * Math.min(1, dt * 2.5); g.speak += (g.tspeak - g.speak) * Math.min(1, dt * 5);
      const vis = g.gu.uAppear.value;
      g.gu.uMul.value = g.speak; g.gu.uGlitch.value = glitchV * (g.glitchOnly ?? 1);
      g.group.visible = vis > 0.01;
      g.group.position.set(g.x, 1.9 + Math.sin(t * 1.3 + gi) * 0.16, -3.4);
      g.group.rotation.y = Math.atan2(camera.position.x - g.x, camera.position.z + 3.4);
      g.eyes.forEach((e, k) => { e.material.opacity = vis * (0.7 + 0.3 * Math.sin(t * 3 + k)); });
      g.light.position.set(g.x, g.group.position.y + 0.4, -2.4); g.light.intensity = ((0.9 + 0.3 * Math.sin(t * 2)) * vis + flashV) * g.speak;
      g.aura.position.set(g.x, g.group.position.y + 1.6, -3.9); g.aura.material.opacity = (0.14 * vis * (0.8 + 0.2 * Math.sin(t * 2)) + flashV * 0.08) * g.speak;
      g.pmat.opacity = (0.15 + 0.65 * vis) * g.speak * (vis > 0.01 ? 1 : 0); g.pmat.size = 0.1 + burstV * 0.08;
      for (let i = 0; i < g.GP; i++) { const s = g.gs[i], ang = s.a + t * s.v * (0.6 + burstV), rr = 1.5 * s.r * (1 + burstV * 2.2); g.gp[i * 3] = g.x + Math.cos(ang) * rr; g.gp[i * 3 + 1] = g.group.position.y - 0.8 + 1.5 * ((s.h + t * 0.25 * s.v) % 2.6); g.gp[i * 3 + 2] = -3.4 + Math.sin(ang) * rr; }
      g.pgm.attributes.position.needsUpdate = true;
    });

    for (let i = rings.length - 1; i >= 0; i--) { const rg = rings[i], u = (now - rg.t0) / 1100; if (u >= 1) { scene.remove(rg.m); rg.m.geometry.dispose(); rg.m.material.dispose(); rings.splice(i, 1); continue; } rg.m.scale.setScalar(1 + u * 3.2); rg.m.material.opacity = 1 - u; rg.m.lookAt(camera.position); }
    plan.position.x = planPos.x; plan.position.z = planPos.z; plan.position.y = BC[1] + 0.05 + Math.sin(t * 3) * 0.012; pg.material.opacity = 0.5 + 0.35 * Math.sin(t * 4);
    bats.forEach((b) => { const u = b.userData, an = t * u.sp + u.ph; b.position.set(Math.cos(an) * u.r, u.h + Math.sin(an * 2.3) * 0.7, u.zc + Math.sin(an) * u.r * 0.8); b.lookAt(camera.position); const fl = Math.sin(t * u.fl + u.ph) * 0.7; u.w1.rotation.z = fl; u.w2.rotation.z = -fl; });
    chand.rotation.z = Math.sin(t * 0.6) * 0.035; chand.rotation.x = Math.sin(t * 0.45) * 0.035;
    circle.rotation.z = t * 0.14; circleMat.opacity = ritualV * (0.75 + 0.25 * Math.sin(t * 2.2));
    pillar.visible = pillarV > 0.01; pillar.material.opacity = pillarV * (0.55 + 0.2 * Math.sin(t * 9));
    if (vortexV > 0.01) {
      vortex.visible = true; vmat.opacity = vortexV * 0.5;
      for (let vi = 0; vi < VN; vi++) { const vp = vs[vi]; vp.u = (vp.u + dt * vp.v * 0.11) % 1; vp.a += dt * (1.4 + vp.v); const vr = (1 - vp.u) * vp.r0 + 0.3; vpos[vi * 3] = Math.cos(vp.a) * vr; vpos[vi * 3 + 1] = 0.2 + vp.u * 7.5; vpos[vi * 3 + 2] = -3.4 + Math.sin(vp.a) * vr; }
      vgeo.attributes.position.needsUpdate = true;
    } else vortex.visible = false;
    for (let i = shocks.length - 1; i >= 0; i--) { const s = shocks[i], su = (now - s.t0) / 1500; if (su >= 1) { scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); shocks.splice(i, 1); continue; } s.m.scale.setScalar(1 + su * 30); s.m.material.opacity = (1 - su) * (1 - su) * 0.28; }
    garEyes.forEach((e) => { e.material.opacity = Math.min(1, 0.5 + 0.3 * Math.sin(t * 3 + e.userData.ph) + glitchV * 0.7 + flareV * 0.2); });
    audience.forEach((g) => { const u = g.userData; g.visible = audVis; g.position.y = 0.35 + Math.sin(t * 1.1 + u.ph) * 0.06; g.position.x = u.bx + Math.sin(t * 0.6 + u.ph) * 0.05; });
    treeG.rotation.y = t * 0.06; tree.material.opacity = 0.7 + 0.2 * Math.sin(t * 1.7);
    gavel.rotation.x = -0.5 - gavelHit;

    const P = proof;
    if (P) {
      const el = (now - P.t0) / 1000 * SPEED, pmesh = P.m, fk = 0.8 + 0.2 * Math.sin(t * 40); let alive = true;
      if (el < 1.1) { const pu = el / 1.1, pe = easeIO(pu); pmesh.position.lerpVectors(P.from, P.to, pe); pmesh.scale.setScalar(0.25 + 0.75 * pe); pmesh.material.opacity = Math.min(1, pu * 1.6) * fk; }
      else if (P.ok && el < 2.7) { pmesh.position.copy(P.to); pmesh.position.y += Math.sin(t * 2) * 0.08; pmesh.scale.setScalar(1); pmesh.material.opacity = fk; }
      else if (P.ok && el < 3.3) { const p2 = (el - 2.7) / 0.6; pmesh.position.y = P.to.y + p2 * 1.2; pmesh.material.opacity = (1 - p2) * fk; }
      else if (!P.ok && el < 1.8) { pmesh.position.copy(P.to); pmesh.position.x += (Math.random() - 0.5) * 0.14 * (el - 1.1) * 4; pmesh.material.opacity = fk; }
      else { alive = false; if (!P.ok) { sparks(pmesh.position, 0xc9303a, 160, 6.5); sparks(pmesh.position, 0xffffff, 40, 4.5); } scene.remove(pmesh); pmesh.geometry.dispose(); pmesh.material.map.dispose(); pmesh.material.dispose(); proof = null; }
      if (alive) {
        pmesh.lookAt(camera.position);
        const bp = beamGeo.attributes.position; bp.setXYZ(0, P.from.x, P.from.y, P.from.z); bp.setXYZ(1, pmesh.position.x, pmesh.position.y, pmesh.position.z); bp.needsUpdate = true;
        beam.visible = true; beamMat.opacity = 0.5 + 0.4 * Math.sin(t * 30);
        nodeGlow.visible = P.ok; nodeGlow.position.copy(P.from); nodeGlow.scale.setScalar(1.1 + 0.4 * Math.sin(t * 8));
      }
    }
    if (!proof) { beam.visible = false; nodeGlow.visible = false; }
    for (let i = sparksList.length - 1; i >= 0; i--) {
      const sk = sparksList[i], sa = (now - sk.t0) / 1800;
      if (sa >= 1) { scene.remove(sk.o); sk.o.geometry.dispose(); sk.o.material.dispose(); sparksList.splice(i, 1); continue; }
      for (let q = 0; q < sk.n; q++) { sk.v[q * 3 + 1] -= 5 * dt; sk.p[q * 3] += sk.v[q * 3] * dt; sk.p[q * 3 + 1] += sk.v[q * 3 + 1] * dt; sk.p[q * 3 + 2] += sk.v[q * 3 + 2] * dt; }
      sk.o.geometry.attributes.position.needsUpdate = true; sk.o.material.opacity = 1 - sa;
    }
    const rk = Math.max(0, Math.min(1, (ritualV - 0.25) / 0.65));
    floaters.forEach((g) => { const u = g.userData, an = u.a + t * u.sp; g.visible = rk > 0.02; g.scale.setScalar(0.2 + 0.8 * rk); g.position.set(Math.cos(an) * u.r, u.h + Math.sin(t * 1.2 + u.a * 3) * 0.25 + rk * 1.2, -3.4 + Math.sin(an) * u.r * 0.7); u.fs.material.uniforms.uFlare.value = 0.3 * Math.sin(t * 10 + u.a * 5); });
    hazes.forEach((s) => { s.position.x += s.userData.v * dt; if (s.position.x > 11) s.position.x = -11; s.material.opacity = 0.035 + 0.02 * Math.sin(t * 0.4 + s.userData.ph) + boltV * 0.08; });

    scales.rotation.z = Math.sin(t * 0.6) * 0.03; pans.forEach((p, k) => { p.position.y = -1.1 + Math.sin(t * 0.6 + k * 3.1) * 0.05; });
    flags.forEach((f) => { const a = f.geometry.attributes.position, o = f.userData.pos; for (let i = 0; i < a.count; i++) { const y = o[i * 3 + 1]; a.setZ(i, Math.sin(t * 1.4 + f.userData.ph + y * 1.2) * 0.07 * (2.1 - y) * 0.5); } a.needsUpdate = true; });
    composer.render();
    frames++; acc += dt;
    if (frames === 90 && acc / 90 > 0.045 && !lowQ) { lowQ = true; bloom.enabled = false; renderer.setPixelRatio(1); if (reflector) { reflector.visible = false; floor.material.opacity = 1; } fit(); }
  }
  // Une erreur de rendu ne doit jamais arrêter la boucle (ni donc figer le procès).
  function frame() {
    if (!running) return;
    try { drawFrame(); } catch (e) { console.error(e); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { const was = running; running = !document.hidden; if (running && !was) { clock.getDelta(); requestAnimationFrame(frame); } });

  // ---------- API ----------
  const ghostOf = (i) => ghosts[i] ?? ghosts[0];
  return {
    shot,
    fly() { camPos.set(0, 1.2, 22); camLook.set(0, 3.2, -8); shot('wide', 0.5); },
    onThunder(fn) { onThunder = fn; },
    bolt() { nextBolt = 0; },
    flare(to, ms) { const f = flareV; return anim(ms, (u) => { flareV = f + (to - f) * u; }); },
    ritual(to, ms) { const f = ritualV; return anim(ms, (u) => { ritualV = f + (to - f) * u; }); },
    pillar(to, ms) { const f = pillarV; return anim(ms, (u) => { pillarV = f + (to - f) * u; }); },
    vortex(to, ms) { const f = vortexV; return anim(ms, (u) => { vortexV = f + (to - f) * u; }); },
    appear(i, to, ms) { const g = ghostOf(i), f = g.gu.uAppear.value; if (to > f) burstV = 1; return anim(ms, (u) => { g.gu.uAppear.value = f + (to - f) * u; }); },
    tint(i, hex) { const g = ghostOf(i); g.gu.uTint.value.setHex(hex); g.pmat.color.setHex(hex); g.aura.material.color.setHex(hex); g.light.color.setHex(hex); if (i === 0) { pg.material.color.setHex(hex); } },
    place(i, x) { const g = ghostOf(i); g.tx = x; if (i === 1) { g.light.visible = x !== 0; g.aura.visible = x !== 0; } },
    speak(i) { ghosts.forEach((g, gi) => { g.tspeak = i == null || gi === i ? 1 : 0.4; }); },
    burst() { burstV = 1; },
    glitch() { glitchV = 1; aberV = 0.02; },
    shake(v) { shakeA = Math.max(shakeA, v); },
    flash(color, v) { finalPass.uniforms.uFC.value.set(color); flashV = v; },
    roll(v) { rollT = v; },
    vertigo(ms) { const z0 = tgtPos.z, f0 = camera.fov; return anim(ms, (u) => { camera.fov = f0 - (f0 - 26) * u; camera.updateProjectionMatrix(); tgtPos.z = z0 + u * 7; }); },
    fovReset(ms) { const f0 = camera.fov, f1 = camera.aspect < 0.8 ? 74 : 58; return anim(ms, (u) => { camera.fov = f0 + (f1 - f0) * u; camera.updateProjectionMatrix(); }); },
    pulse(ok, i = 0) {
      const g = ghostOf(i);
      const m = new T.Mesh(new T.RingGeometry(0.6, 0.7, 64), new T.MeshBasicMaterial({ color: ok ? 0x79e0c4 : 0xc9303a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
      m.position.copy(g.group.position).add(new T.Vector3(0, 0.9, 0)); scene.add(m); rings.push({ m, t0: performance.now() });
    },
    shock(x, z, color) {
      const m = new T.Mesh(new T.RingGeometry(0.8, 1.1, 72), new T.MeshBasicMaterial({ color, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); scene.add(m); shocks.push({ m, t0: performance.now() });
    },
    sparks(x, y, z, color, n, speed) { sparks(new T.Vector3(x, y, z), color, n, speed); },
    treeBurn(hex) {
      const c0 = tree.material.color.clone(), c1 = new T.Color(hex);
      treeG.updateMatrixWorld(true);
      for (let k = 0; k < 8; k++) { const pv = npos[(Math.random() * npos.length) | 0].clone(); treeG.localToWorld(pv); sparks(pv, hex, 30, 3); }
      return anim(1200, (u) => { tree.material.color.lerpColors(c0, c1, u); treeLineMat.color.lerpColors(c0, c1, u); });
    },
    /** Pièce à conviction : { hash, ok, cmd, lines } — les lignes viennent du vrai git. */
    proof(s) {
      if (proof) { scene.remove(proof.m); proof = null; }
      const mat = new T.MeshBasicMaterial({ map: drawProof(s.lines, s.ok, s.cmd), transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: T.DoubleSide, fog: false });
      const m = new T.Mesh(new T.PlaneGeometry(4.4, 2.6), mat); m.renderOrder = 20; scene.add(m);
      const from = new T.Vector3();
      if (s.ok) { const idx = parseInt(String(s.hash).slice(0, 4), 16) || 0; treeG.updateMatrixWorld(true); from.copy(npos[idx % npos.length]); treeG.localToWorld(from); } else from.set(-3.5, 9, -9);
      beamMat.color.set(s.ok ? 0x79e0c4 : 0xc9303a);
      const to = new T.Vector3(s.x ?? 2.9, 4.3, -0.8);
      proof = { m, from, to, ok: s.ok, t0: performance.now() };
    },
    planchette(ch, ms) { const p = letterWorld(ch.toUpperCase()); if (!p) return Promise.resolve(); const x0 = planPos.x, z0 = planPos.z; return anim(ms, (u) => { planPos.x = x0 + (p.x - x0) * u; planPos.z = z0 + (p.z - z0) * u; }); },
    home(ms) { const x0 = planPos.x, z0 = planPos.z; return anim(ms, (u) => { planPos.x = x0 * (1 - u); planPos.z = z0 + (BC[2] - z0) * u; }); },
    /** Coup de marteau ; `onHit` est appelé à l'impact. */
    gavel(onHit) {
      return anim(380, (u) => { gavelHit = 0.55 * u; })
        .then(() => anim(130, (u) => { gavelHit = 0.55 - 1.45 * u; }, (u) => u * u))
        .then(() => { onHit?.(); return anim(360, (u) => { gavelHit = -0.9 + 0.9 * u; }); });
    },
  };
}
