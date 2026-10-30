import { createScene } from '/scene.js';
import { createAudio } from '/audio.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? ms / 5 : ms));
const TINTS = [0x79e0c4, 0xb48cff, 0xffb35c];
const stage = $('stage');
let sceneApi = null;
let current = { repo: null, list: [], voiceIdx: 0, busy: false, verified: 0, rejected: 0, witnessed: 0 };

try { sceneApi = createScene($('gl')); } catch (e) { console.warn(e); }
if (!sceneApi) $('nogl').hidden = false;

// --- son et voix (désactivés par défaut : le navigateur exige un clic) ---
const audio = createAudio();
$('bSound').addEventListener('click', () => {
  const on = audio.setSfx(!audio.sfxOn());
  $('bSound').setAttribute('aria-pressed', String(on));
  $('bSound').textContent = on ? 'Son : actif' : 'Son : activer';
  if (on) audio.play('door');
});
if (audio.voiceAvailable()) {
  $('bVoice').addEventListener('click', () => {
    const on = audio.setVoice(!audio.voiceOn());
    $('bVoice').setAttribute('aria-pressed', String(on));
    $('bVoice').textContent = on ? 'Voix : actives' : 'Voix : activer';
    if (on) audio.speak('Je suis le fantôme de ce dépôt.', VOICES[0], 4000);
  });
} else {
  $('bVoice').hidden = true;
}
// Voix par fantôme : grave et lente pour le premier, plus aiguë pour celui qui lui répond.
const VOICES = [{ pitch: 0.5, rate: 0.8 }, { pitch: 0.95, rate: 0.88 }, { pitch: 0.7, rate: 0.84 }];

async function api(path, body) {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}

function flash() { const f = $('flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function shake() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
async function objection(side) {
  const o = $('obj'); o.hidden = false; o.style.animation = 'none'; void o.offsetWidth; o.style.animation = '';
  shake(); flash(); audio.play('gavel'); audio.play('bad'); sceneApi?.glitch(side); sceneApi?.gavel();
  await sleep(1100); o.hidden = true;
}

async function spell(name) {
  const el = $('spelled'); el.textContent = '';
  for (const ch of name.toUpperCase()) { el.textContent += ch; audio.play('tick'); await sleep(110); }
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

// Affiche une déclaration, la fait vérifier à l'écran, puis la tamponne (vérifié / rejeté + objection).
async function stamp(s, speaker) {
  const li = document.createElement('li'); li.className = 's';
  if (speaker) { const who = document.createElement('div'); who.className = 'lab'; who.textContent = speaker; li.append(who); }
  const txt = document.createElement('div'); txt.className = 't'; txt.textContent = '« ' + s.text + ' »';
  const row = document.createElement('div'); row.className = 'row';
  const hash = document.createElement('span'); hash.className = 'hash'; hash.textContent = 'git ' + s.hash;
  const spin = document.createElement('span'); spin.className = 'spin';
  row.append(hash, spin); li.append(txt, row); $('say').append(li); li.scrollIntoView({ block: 'nearest' });
  // Le fantôme dit sa phrase pendant qu'elle est vérifiée ; sans voix, simple temps de suspense.
  const voice = VOICES[(s.side ?? current.voiceIdx) % VOICES.length];
  await Promise.all([sleep(900), audio.speak(s.text, voice)]);
  spin.remove();
  const st = document.createElement('span'); st.className = 'st'; st.textContent = s.ok ? 'vérifié' : 'rejeté';
  const why = document.createElement('span'); why.className = 'why'; why.textContent = s.reason;
  row.append(st, why); li.classList.add(s.ok ? 'ok' : 'bad');
  if (s.ok) { current.verified++; audio.play('ok'); } else { current.rejected++; setTally(); await objection(s.side); }
  setTally(); await sleep(350);
}

async function runDuel() {
  if (current.busy || current.list.length < 2) return;
  current.busy = true;
  document.querySelectorAll('#witnesses .tab').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  setBusy(true); $('say').textContent = ''; $('note').textContent = '';
  $('gname').textContent = 'Duel des fantômes'; $('gmeta').textContent = 'Recherche du fichier qu’ils se disputent…';
  sceneApi?.shot('duel');
  try {
    const d = await api('/api/duel', { repo: current.repo, perjury: $('perjury').checked });
    const idx = (n) => Math.max(0, current.list.findIndex((w) => w.name === n));
    sceneApi?.summonDuel(TINTS[idx(d.witnesses[0]) % 3], TINTS[idx(d.witnesses[1]) % 3]); audio.play('whisper');
    const first = (n) => n.split(' ')[0];
    $('gname').textContent = `${first(d.witnesses[0])} contre ${first(d.witnesses[1])}`;
    await sleep(1800);
    $('gmeta').textContent = `Fichier contesté : ${d.file}`;
    for (const s of d.statements) { sceneApi?.speak(s.side); await stamp(s, s.witness.toUpperCase()); }
    current.witnessed++;
    $('note').textContent = 'Deux témoins, un même fichier : chacun ne peut citer que ses propres commits.';
  } catch (err) {
    $('gmeta').textContent = 'Le duel n’a pas eu lieu : ' + err.message;
  } finally {
    current.busy = false; setBusy(false);
    $('bVerd').disabled = current.witnessed === 0;
    sceneApi?.banish(); sceneApi?.shot('wide'); $('spelled').textContent = '';
  }
}
$('bDuel').addEventListener('click', runDuel);

function setBusy(b) {
  document.querySelectorAll('#witnesses .tab').forEach((x) => (x.disabled = b));
  $('bDuel').disabled = b; $('bVerd').disabled = true;
}

async function callWitness(w, tint, btn) {
  if (current.busy) return;
  current.busy = true;
  setBusy(true);
  document.querySelectorAll('#witnesses .tab').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  $('say').textContent = ''; $('note').textContent = '';
  $('gname').textContent = w.name; $('gmeta').textContent = 'Invocation en cours…';
  current.voiceIdx = Math.max(0, current.list.findIndex((x) => x.name === w.name));
  sceneApi?.shot('witness'); sceneApi?.summon(tint); audio.play('whisper');
  try {
    const [t] = await Promise.all([api('/api/testimony', { repo: current.repo, author: w.name, perjury: $('perjury').checked }), spell(w.name.split(' ')[0])]);
    $('gmeta').textContent = `${t.years} · ${t.commits} commits · ${t.mode === 'llm' ? 'parole générée par IA' : 'parole reconstituée hors-ligne'}`;
    for (const s of t.statements) await stamp(s);
    current.witnessed++;
    $('note').textContent = 'Chaque phrase est contrôlée contre le vrai historique git avant d’être acceptée.';
  } catch (err) {
    $('gmeta').textContent = 'Le témoin ne répond pas : ' + err.message;
  } finally {
    current.busy = false; setBusy(false);
    $('bVerd').disabled = current.witnessed === 0;
    sceneApi?.banish(); $('spelled').textContent = '';
  }
}

$('bVerd').addEventListener('click', async () => {
  if (current.busy) return; current.busy = true; $('bVerd').disabled = true;
  sceneApi?.shot('judge'); await sleep(900); sceneApi?.gavel(); audio.play('gavel'); flash();
  try {
    const v = await api('/api/verdict', { repo: current.repo });
    const big = $('vbig'); big.textContent = v.verdict === 'EXECUTER' ? 'EXÉCUTER' : 'DÉBRANCHER';
    big.className = 'big' + (v.verdict === 'EXECUTER' ? ' live' : '');
    $('vscore').textContent = `Défense ${v.defense} points · Accusation ${v.prosecution} points`;
    $('term').textContent = v.lines.map((l) => '> ' + l).join('\n');
    $('verdict').hidden = false;
    audio.play(v.verdict === 'EXECUTER' ? 'choir' : 'organ');
    audio.speak(`Verdict : ${v.verdict === 'EXECUTER' ? 'exécuter' : 'débrancher'}.`, { pitch: 0.4, rate: 0.75 });
  } catch (err) {
    $('gmeta').textContent = 'Verdict impossible : ' + err.message;
  } finally { current.busy = false; $('bVerd').disabled = false; }
});
$('vClose').addEventListener('click', () => { $('verdict').hidden = true; sceneApi?.shot('wide'); });

$('bEnter').addEventListener('click', () => {
  $('title').classList.add('off'); document.body.classList.add('in');
  sceneApi?.shot('intro'); setTimeout(() => sceneApi?.shot('wide'), 2600);
  audio.play('thunder');
});

(async () => {
  try {
    const c = await api('/api/case' + location.search);
    current.repo = c.repo;
    $('caseLine').textContent = `AFFAIRE N° 1 · ${c.name} · ${c.commits} commits · ${c.span}`;
    current.list = c.witnesses; $('bDuel').disabled = c.witnesses.length < 2;
    renderFacts(c.facts); renderWitnesses(c.witnesses); $('bEnter').disabled = false;
  } catch (err) {
    $('caseLine').textContent = 'Dossier illisible : ' + err.message;
  }
})();

// Aide à la démo et aux captures : #enter entre dans la salle, #demo convoque aussi le premier témoin.
addEventListener('load', () => {
  const h = location.hash;
  if (!h) return;
  const wait = setInterval(() => {
    if ($('bEnter').disabled) return;
    clearInterval(wait);
    $('bEnter').click();
    if (h === '#duel' || h === '#duelmenteur') {
      if (h === '#duelmenteur') $('perjury').checked = true;
      setTimeout(() => $('bDuel').click(), 800);
    }
    if (h === '#demo') setTimeout(() => document.querySelector('#witnesses .tab')?.click(), 800);
  }, 200);
});
