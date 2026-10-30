import { createScene } from '/scene.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? ms / 5 : ms));
const TINTS = [0x79e0c4, 0xb48cff, 0xffb35c];
const stage = $('stage');
let sceneApi = null;
let current = { repo: null, busy: false, verified: 0, rejected: 0, witnessed: 0 };

try { sceneApi = createScene($('gl')); } catch (e) { console.warn(e); }
if (!sceneApi) $('nogl').hidden = false;

// --- son (désactivé par défaut) ---
let AC = null, muted = true;
function tone(f, d, type = 'sine', v = 0.1, slide) {
  if (muted || !AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d + 0.05);
}
const SND = { ok: () => tone(784, 0.7, 'sine', 0.07), bad: () => tone(110, 0.5, 'sine', 0.12, 60), slam: () => tone(80, 0.7, 'sine', 0.3, 35) };
$('bSound').addEventListener('click', () => {
  muted = !muted;
  if (!muted && !AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  $('bSound').setAttribute('aria-pressed', String(!muted));
  $('bSound').textContent = muted ? 'Son : activer' : 'Son : actif';
});

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}

function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
async function objection() {
  const o = $('obj'); o.hidden = false; o.style.animation = 'none'; void o.offsetWidth; o.style.animation = '';
  shake(); flash(); SND.slam(); sceneApi?.glitch(); sceneApi?.gavel();
  await sleep(1100); o.hidden = true;
}

async function spell(name) {
  const el = $('spelled'); el.textContent = '';
  for (const ch of name.toUpperCase()) { el.textContent += ch; tone(660, 0.25, 'sine', 0.05); await sleep(110); }
}

function renderFacts(facts) {
  const box = $('facts'); box.textContent = '';
  for (const f of facts) {
    const d = document.createElement('div'); d.className = 'paper ' + (f.side === 'defense' ? 'def' : 'pro');
    const l = document.createElement('div'); l.className = 'lab'; l.textContent = f.side === 'defense' ? 'Défense' : 'Accusation';
    const p = document.createElement('p'); p.textContent = f.text;
    const id = document.createElement('span'); id.className = 'fid'; id.textContent = 'FAIT ' + f.id;
    d.append(l, p, id); box.append(d);
  }
}

function renderWitnesses(list) {
  const box = $('witnesses'); box.textContent = '';
  list.forEach((w, i) => {
    const b = document.createElement('button'); b.className = 'tab'; b.dataset.name = w.name;
    b.append(document.createTextNode(w.name.toUpperCase()));
    const s = document.createElement('small'); s.textContent = `${w.count} commits · ${w.years}`; b.append(s);
    b.addEventListener('click', () => callWitness(w, TINTS[i % TINTS.length], b));
    box.append(b);
  });
}

function setTally() { $('nv').textContent = current.verified; $('nr').textContent = current.rejected; }

async function callWitness(w, tint, btn) {
  if (current.busy) return;
  current.busy = true;
  document.querySelectorAll('#witnesses .tab').forEach((b) => { b.disabled = true; b.setAttribute('aria-pressed', String(b === btn)); });
  $('bVerd').disabled = true; $('say').textContent = ''; $('note').textContent = '';
  $('gname').textContent = w.name; $('gmeta').textContent = 'Invocation en cours…';
  sceneApi?.shot('witness'); sceneApi?.summon(tint);
  try {
    const [t] = await Promise.all([api('/api/testimony', { repo: current.repo, author: w.name, perjury: $('perjury').checked }), spell(w.name.split(' ')[0])]);
    $('gmeta').textContent = `${t.years} · ${t.commits} commits · ${t.mode === 'llm' ? 'parole générée par IA' : 'parole reconstituée hors-ligne'}`;
    for (const s of t.statements) {
      const li = document.createElement('li'); li.className = 's';
      const txt = document.createElement('div'); txt.className = 't'; txt.textContent = '« ' + s.text + ' »';
      const row = document.createElement('div'); row.className = 'row';
      const hash = document.createElement('span'); hash.className = 'hash'; hash.textContent = 'git ' + s.hash;
      const spin = document.createElement('span'); spin.className = 'spin';
      row.append(hash, spin); li.append(txt, row); $('say').append(li); li.scrollIntoView({ block: 'nearest' });
      await sleep(900);
      spin.remove();
      const st = document.createElement('span'); st.className = 'st'; st.textContent = s.ok ? 'vérifié' : 'rejeté';
      const why = document.createElement('span'); why.className = 'why'; why.textContent = s.reason;
      row.append(st, why); li.classList.add(s.ok ? 'ok' : 'bad');
      if (s.ok) { current.verified++; SND.ok(); } else { current.rejected++; SND.bad(); setTally(); await objection(); }
      setTally(); await sleep(350);
    }
    current.witnessed++;
    $('note').textContent = 'Chaque phrase est contrôlée contre le vrai historique git avant d’être acceptée.';
  } catch (err) {
    $('gmeta').textContent = 'Le témoin ne répond pas : ' + err.message;
  } finally {
    current.busy = false;
    document.querySelectorAll('#witnesses .tab').forEach((b) => (b.disabled = false));
    $('bVerd').disabled = current.witnessed === 0;
    sceneApi?.banish(); $('spelled').textContent = '';
  }
}

$('bVerd').addEventListener('click', async () => {
  if (current.busy) return; current.busy = true; $('bVerd').disabled = true;
  sceneApi?.shot('judge'); await sleep(900); sceneApi?.gavel(); SND.slam(); flash();
  try {
    const v = await api('/api/verdict', { repo: current.repo });
    const big = $('vbig'); big.textContent = v.verdict === 'EXECUTER' ? 'EXÉCUTER' : 'DÉBRANCHER';
    big.className = 'big' + (v.verdict === 'EXECUTER' ? ' live' : '');
    $('vscore').textContent = `Défense ${v.defense} points · Accusation ${v.prosecution} points`;
    $('term').textContent = v.lines.map((l) => '> ' + l).join('\n');
    $('verdict').hidden = false;
  } catch (err) {
    $('gmeta').textContent = 'Verdict impossible : ' + err.message;
  } finally { current.busy = false; $('bVerd').disabled = false; }
});
$('vClose').addEventListener('click', () => { $('verdict').hidden = true; sceneApi?.shot('wide'); });

$('bEnter').addEventListener('click', () => {
  $('title').classList.add('off'); document.body.classList.add('in');
  sceneApi?.shot('intro'); setTimeout(() => sceneApi?.shot('wide'), 2600);
  if (!muted && AC?.state === 'suspended') AC.resume();
});

(async () => {
  try {
    const c = await api('/api/case' + location.search);
    current.repo = c.repo;
    $('caseLine').textContent = `AFFAIRE N° 1 · ${c.name} · ${c.commits} commits · ${c.span}`;
    renderFacts(c.facts); renderWitnesses(c.witnesses); $('bEnter').disabled = false;
  } catch (err) {
    $('caseLine').textContent = 'Dossier illisible : ' + err.message;
  }
})();
