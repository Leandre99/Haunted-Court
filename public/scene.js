// Salle d'audience 3D. Retourne une petite API pilotée par app.js.
import * as THREE from 'three';

export function createScene(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x07050b, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0710, 0.04);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 80);

  const tex = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const soft = tex(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  const floorTex = tex(256, 256, (c, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#1a1224' : '#0f0a17'; c.fillRect(x * 64, y * 64, 64, 64); }
    c.strokeStyle = 'rgba(150,130,190,.10)';
    for (let i = 0; i < 16; i++) { c.beginPath(); const x = Math.random() * w, y = Math.random() * h; c.moveTo(x, y); c.lineTo(x + (Math.random() - 0.5) * 60, y + (Math.random() - 0.5) * 60); c.stroke(); }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(8, 14);
  const stoneTex = tex(256, 256, (c, w, h) => {
    c.fillStyle = '#1b1424'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) { c.fillStyle = `rgba(${20 + Math.random() * 30 | 0},${15 + Math.random() * 20 | 0},${30 + Math.random() * 30 | 0},.35)`; c.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 5); }
    c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 3;
    for (let y = 0; y <= h; y += 64) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = ((y / 64) % 2) * 64; x < w; x += 128) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 64); c.stroke(); } }
  });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; stoneTex.repeat.set(4, 3);

  const mat = (color, emissive = 0x000000) => new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.8, metalness: 0.05 });

  // Salle
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 34), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -1); scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });
  const walls = [[-10, 6, -1, 34, 12, Math.PI / 2], [10, 6, -1, 34, 12, -Math.PI / 2], [0, 6, -16.5, 20, 12, 0]];
  for (const [x, y, z, w, h, ry] of walls) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 34), mat(0x0c0812)); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 12, -1); scene.add(ceil);

  const colMat = mat(0x241a30);
  for (const z of [8, 3.4, -1.2, -5.8, -10.4, -15]) for (const x of [-8.4, 8.4]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 12, 12), colMat); col.position.set(x, 6, z); scene.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), colMat); base.position.set(x, 0.25, z); scene.add(base);
  }

  // Vitrail + pluie
  const glass = tex(512, 768, (c, w, h) => {
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
  const win = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 8.4), new THREE.MeshBasicMaterial({ map: glass, fog: false })); win.position.set(0, 7.2, -16.3); scene.add(win);
  const rainCv = document.createElement('canvas'); rainCv.width = 256; rainCv.height = 384;
  const rctx = rainCv.getContext('2d'); const rainTex = new THREE.CanvasTexture(rainCv);
  const drops = Array.from({ length: 80 }, () => ({ x: Math.random() * 256, y: Math.random() * 384, v: 260 + Math.random() * 340, l: 14 + Math.random() * 34 }));
  const rain = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 8.4), new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  rain.position.set(0, 7.2, -16.2); scene.add(rain);

  // Lumières
  scene.add(new THREE.AmbientLight(0x5a4a88, 0.9));
  scene.add(new THREE.HemisphereLight(0x7587d8, 0x22142e, 1.1));
  const moon = new THREE.PointLight(0x7f90e8, 90, 40, 1.6); moon.position.set(0, 8, -13.5); scene.add(moon);

  // Banc du juge + juge squelette
  const bench = new THREE.Mesh(new THREE.BoxGeometry(9, 2.4, 2.2), mat(0x2b1b12)); bench.position.set(0, 1.2, -12); scene.add(bench);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.2, 2.5), mat(0x3a2519)); desk.position.set(0, 2.5, -12); scene.add(desk);
  const judge = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.3, 14), mat(0x0b0910, 0x050308)); robe.position.y = 1.65; judge.add(robe);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 12), mat(0x0b0910)); hood.position.y = 3.65; judge.add(hood);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xd9d2bd, 0x2a2820)); skull.scale.set(0.95, 1.05, 0.8); skull.position.set(0, 3.62, 0.26); judge.add(skull);
  for (const dx of [-0.11, 0.11]) {
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xff3a3a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    eye.scale.set(0.36, 0.36, 1); eye.position.set(dx, 3.68, 0.52); judge.add(eye);
  }
  judge.position.set(0, 2.6, -12.9); scene.add(judge);
  const gavel = new THREE.Group();
  const gh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), mat(0x4a3020)); gh.position.z = 0.45; gavel.add(gh);
  const gd = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 12), mat(0x4a3020)); gd.rotation.z = Math.PI / 2; gd.position.z = 0.9; gavel.add(gd);
  gavel.position.set(1.9, 2.95, -11.7); gavel.rotation.x = -0.5; scene.add(gavel);

  // Tables, barre des témoins
  for (const x of [-5.6, 5.6]) { const t = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.5), mat(0x2a1a12)); t.position.set(x, 0.45, -1); scene.add(t); }
  const lawyer = (x, emi) => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.4, 10), mat(0x0d0b14, emi)); r.position.y = 1.2; g.add(r); const h = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat(0x0d0b14, emi)); h.position.y = 2.6; g.add(h); g.position.set(x, 0, -2.3); scene.add(g); };
  lawyer(-5.6, 0x072a2a); lawyer(5.6, 0x2e0a0e);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.5), mat(0x2a1a12)); stand.position.set(0, 0.65, -3.6); scene.add(stand);

  // Bougies
  const flames = [];
  for (const [x, y, z, lit] of [[-5.6, 0.9, -1.3, 1], [5.6, 0.9, -1.3, 1], [-3.4, 2.6, -11.2, 1], [3.4, 2.6, -11.2, 1], [-7.2, 0, -4, 1], [7.2, 0, -4, 1], [-7.2, 0, -9, 1], [7.2, 0, -9, 1]]) {
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.6, 8), mat(0xd9ceb0, 0x302820)); wax.position.set(x, y + 0.3, z); scene.add(wax);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffa24a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    flame.scale.set(0.8, 0.8, 1); flame.position.set(x, y + 0.75, z); scene.add(flame);
    const light = new THREE.PointLight(0xffa24a, 7, 12, 1.6); light.position.set(x, y + 0.9, z); scene.add(light);
    flames.push({ flame, light, seed: Math.random() * 10 });
  }

  // Poussière
  const DUST = 420; const dp = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) { dp[i * 3] = (Math.random() - 0.5) * 18; dp[i * 3 + 1] = Math.random() * 11; dp[i * 3 + 2] = -14 + Math.random() * 26; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: 0.09, map: soft, color: 0xb8a8e8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(dust);

  // Fantôme (shader : fresnel + dissolution + glitch)
  const uTime = { value: 0 };
  const prof = [[0.85, 0], [0.92, 0.18], [0.78, 0.5], [0.62, 0.9], [0.56, 1.2], [0.5, 1.45], [0.36, 1.66], [0, 1.78]].map(([x, y]) => new THREE.Vector2(x, y));
  function makeGhost(hex) {
  const ghost = new THREE.Group(); ghost.position.set(0, 1.9, -3.4); ghost.scale.setScalar(2.1); ghost.visible = false; scene.add(ghost);
  const gu = { uTime, uAppear: { value: 0 }, uGlitch: { value: 0 }, uMul: { value: 1 }, uTint: { value: new THREE.Color(hex) } };
  const gmat = new THREE.ShaderMaterial({
    uniforms: gu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `uniform float uTime;uniform float uGlitch;varying vec3 vN;varying vec3 vV;varying vec3 vP;
      void main(){vec3 p=position;float a=atan(p.x,p.z);float low=1.0-smoothstep(0.0,0.5,p.y);
      p.y-=(sin(a*7.0+uTime*2.2)*0.5+0.5)*0.35*low*step(0.001,length(p.xz));
      p.x+=sin(p.y*4.0+uTime*2.0)*0.06*(1.0-p.y/1.8);p.z+=cos(p.y*3.0+uTime*1.6)*0.05;
      p.x+=uGlitch*(step(0.5,fract(sin(floor(p.y*12.0+uTime*30.0))*437.5))-0.5)*0.6;
      vP=p;vec4 mv=modelViewMatrix*vec4(p,1.0);vN=normalize(normalMatrix*normal);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uTime;uniform float uAppear;uniform float uMul;uniform vec3 uTint;varying vec3 vN;varying vec3 vV;varying vec3 vP;
      float h(vec2 s){return fract(sin(dot(s,vec2(12.9898,78.233)))*43758.5453);}
      void main(){float f=pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0);
      float n=h(floor(vP.xy*22.0+vec2(0.0,-uTime*1.5)));float edge=uAppear*1.25-(1.0-vP.y/1.8)*0.25;if(n>edge)discard;
      float a=0.13+f*0.5;
      vec2 e1=vP.xy-vec2(0.17,1.32);vec2 e2=vP.xy-vec2(-0.17,1.32);
      float eye=smoothstep(0.13,0.05,min(length(e1),length(e2)))*step(0.0,vP.z);
      float mouth=smoothstep(0.12,0.04,length((vP.xy-vec2(0.0,1.0))*vec2(1.0,0.6)))*step(0.0,vP.z);
      a*=(1.0-0.95*eye)*(1.0-0.8*mouth);vec3 col=mix(uTint,vec3(1.0),f*0.6);gl_FragColor=vec4(col*0.85*uMul,a*uMul);}`,
  });
  ghost.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), gmat));
  const gLight = new THREE.PointLight(hex, 30, 10, 1.5); gLight.position.set(0, 2.2, -2.4); scene.add(gLight);
  const GP = 260; const gpos = new Float32Array(GP * 3); const gpart = [];
  for (let i = 0; i < GP; i++) gpart.push({ a: Math.random() * 6.283, h: Math.random() * 2.4 - 0.2, r: 0.7 + Math.random() * 0.8, v: 0.4 + Math.random() * 1.1 });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  const pmat = new THREE.PointsMaterial({ size: 0.11, map: soft, color: hex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(pg, pmat));
  return { ghost, gu, gLight, gpos, gpart, pg, pmat, GP, appear: 0, target: 0, glitch: 0, x: 0, tx: 0, speak: 1, tspeak: 1 };
  }
  const ghosts = [makeGhost(0x79e0c4), makeGhost(0xb48cff)];

  // Caméra pilotée
  const cam = { pos: new THREE.Vector3(0, 3.4, 11), look: new THREE.Vector3(0, 3.4, -8), tp: new THREE.Vector3(0, 3.4, 11), tl: new THREE.Vector3(0, 3.4, -8) };
  const shots = {
    wide: [[0, 3.4, 11], [0, 3.4, -8]],
    intro: [[0, 3.0, 6.5], [0, 3.0, -8]],
    witness: [[0, 2.8, 2.6], [0, 2.8, -6]],
    duel: [[0, 3.0, 3.4], [0, 2.7, -6]],
    judge: [[0, 3.2, -4.8], [0, 3.5, -12.5]],
  };
  const shot = (n) => { cam.tp.set(...shots[n][0]); cam.tl.set(...shots[n][1]); };

  let gavelHit = 0, t0 = performance.now(), last = t0, flashMs = 0, running = true;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 74 : 58; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - t0) / 1000;
    uTime.value = t;
    ghosts.forEach((g, gi) => {
      g.appear += (g.target - g.appear) * Math.min(1, dt * 1.6); g.gu.uAppear.value = g.appear;
      g.x += (g.tx - g.x) * Math.min(1, dt * 2.5); g.speak += (g.tspeak - g.speak) * Math.min(1, dt * 5); g.gu.uMul.value = g.speak;
      g.ghost.visible = g.appear > 0.01; g.pmat.opacity = g.appear * 0.7 * g.speak;
      g.glitch = Math.max(0, g.glitch - dt * 2.2); g.gu.uGlitch.value = g.glitch;
      g.ghost.position.set(g.x, 1.9 + Math.sin(t * 1.3 + gi) * 0.12, -3.4); g.ghost.rotation.y = Math.sin(t * 0.4 + gi) * 0.12 + (g.tx === 0 ? 0 : -Math.sign(g.tx) * 0.35);
      g.gLight.position.x = g.x; g.gLight.intensity = 30 * g.appear * g.speak * (0.85 + 0.15 * Math.sin(t * 7));
      for (let i = 0; i < g.GP; i++) { const p = g.gpart[i]; p.a += dt * p.v; g.gpos[i * 3] = g.x + Math.cos(p.a) * p.r; g.gpos[i * 3 + 1] = 1.9 + p.h + Math.sin(t + i) * 0.1; g.gpos[i * 3 + 2] = -3.4 + Math.sin(p.a) * p.r; }
      g.pg.attributes.position.needsUpdate = true;
    });
    for (const f of flames) { const k = 0.8 + 0.2 * Math.sin(t * 9 + f.seed) * Math.sin(t * 5.3 + f.seed * 2); f.light.intensity = 7 * k; f.flame.scale.set(0.75 * k, 0.95 * k, 1); }
    gavelHit = Math.max(0, gavelHit - dt * 3); gavel.rotation.x = -0.5 + gavelHit * 0.9;
    const pa = dust.geometry.attributes.position; for (let i = 0; i < DUST; i++) { pa.array[i * 3 + 1] += dt * 0.12; if (pa.array[i * 3 + 1] > 11) pa.array[i * 3 + 1] = 0; } pa.needsUpdate = true;
    rctx.clearRect(0, 0, 256, 384); rctx.lineWidth = 1.4;
    for (const d of drops) { d.y += d.v * dt; if (d.y - d.l > 384) { d.y = -4; d.x = Math.random() * 256; } const g = rctx.createLinearGradient(d.x, d.y - d.l, d.x, d.y); g.addColorStop(0, 'rgba(190,210,255,0)'); g.addColorStop(1, 'rgba(220,235,255,.75)'); rctx.strokeStyle = g; rctx.beginPath(); rctx.moveTo(d.x, d.y - d.l); rctx.lineTo(d.x + 1.5, d.y); rctx.stroke(); }
    rainTex.needsUpdate = true;
    const k = 1 - Math.pow(0.35, dt); cam.pos.lerp(cam.tp, k); cam.look.lerp(cam.tl, k);
    camera.position.set(cam.pos.x + Math.sin(t * 0.25) * 0.25, cam.pos.y + Math.sin(t * 0.33) * 0.08, cam.pos.z);
    camera.lookAt(cam.look);
    if (flashMs > 0) { flashMs -= dt * 1000; }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { const was = running; running = !document.hidden; if (running && !was) { last = performance.now(); requestAnimationFrame(frame); } });

  return {
    shot,
    summon(hex) {
      const g = ghosts[0]; g.gu.uTint.value.setHex(hex); g.pmat.color.setHex(hex); g.gLight.color.setHex(hex);
      g.appear = 0; g.target = 1; g.tx = 0; g.x = 0; g.tspeak = g.speak = 1; ghosts[1].target = 0;
    },
    // Deux fantômes face à face ; speak(i) éclaire celui qui parle et assombrit l'autre.
    summonDuel(hexA, hexB) {
      [hexA, hexB].forEach((hex, i) => { const g = ghosts[i]; g.gu.uTint.value.setHex(hex); g.pmat.color.setHex(hex); g.gLight.color.setHex(hex); g.appear = 0; g.target = 1; g.x = 0; g.tx = i ? 2.4 : -2.4; g.tspeak = 1; });
    },
    speak(i) { ghosts.forEach((g, gi) => { g.tspeak = gi === i ? 1 : 0.4; }); },
    banish() { ghosts.forEach((g) => { g.target = 0; g.tspeak = 1; }); },
    glitch(i) { (i === undefined ? ghosts : [ghosts[i]]).forEach((g) => { g.glitch = 1; }); },
    gavel() { gavelHit = 1; },
  };
}
