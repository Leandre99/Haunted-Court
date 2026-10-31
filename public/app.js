import { createScene } from '/scene.js';
import { createAudio } from '/audio.js';
import { tr, lang, applyStatic, switchLang } from '/i18n.js';

const $ = (id) => document.getElementById(id);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, RM ? ms / 5 : ms));
const TINTS = [0x79e0c4, 0xb48cff, 0xffb35c];
const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');
const stage = $('stage');
let sceneApi = null;
const current = { repo: null, list: [], busy: false, verified: 0, rejected: 0, objections: 0, witnessed: 0, recorded: false, emberIv: 0 };

try { sceneApi = createScene($('gl')); } catch (e) { console.warn(e); }
if (!sceneApi) $('nogl').hidden = false;

// --- son et voix (désactivés par défaut : le navigateur exige un clic) ---
applyStatic();
$('bLang').addEventListener('click', switchLang);
const audio = createAudio();
audio.setLang(tr('speak_lang'));
sceneApi?.onThunder(() => audio.play('thunder'));
$('bSound').addEventListener('click', () => {
  const on = audio.setSfx(!audio.sfxOn());
  $('bSound').setAttribute('aria-pressed', String(on));
  $('bSound').textContent = tr(on ? 'sound_on' : 'sound_off');
  if (on) audio.play('door');
});
// Voix par fantôme : grave et lente pour le premier, plus aiguë pour celui qui lui répond.
const VOICES = [{ pitch: 0.5, rate: 0.8 }, { pitch: 0.95, rate: 0.88 }, { pitch: 0.7, rate: 0.84 }];
if (audio.voiceAvailable()) {
  $('bVoice').addEventListener('click', () => {
    const on = audio.setVoice(!audio.voiceOn());
    $('bVoice').setAttribute('aria-pressed', String(on));
    $('bVoice').textContent = tr(on ? 'voice_on' : 'voice_off');
    if (on) audio.speak(tr('voice_sample'), VOICES[0], 4000);
  });
} else {
  $('bVoice').hidden = true;
}

// Mode « procès enregistré » : sur un hébergement statique (pas de serveur Node), on rejoue un vrai procès
// enregistré par scripts/record.js. Les phrases ont été vérifiées contre git au moment de l'enregistrement.
let recorded = null;
async function recordedApi(path, body) {
  if (!recorded) {
    const r = await fetch('/demo-data.json');
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(tr('no_backend'));
    recorded = await r.json();
  }
  current.recorded = true;
  const d = recorded[lang] ?? recorded.en;
  if (path.startsWith('/api/case')) return d.case;
  const variant = body?.perjury ? 'perjury' : 'honest';
  if (path === '/api/testimony') {
    const w = d.testimony[body.author];
    if (!w) throw new Error(tr('no_backend'));
    return w[variant];
  }
  if (path === '/api/duel') return d.duel[variant];
  if (path === '/api/verdict') return d.verdict;
  throw new Error(tr('no_backend'));
}

async function api(path, body) {
  let res;
  try {
    res = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  } catch {
    return recordedApi(path, body);
  }
  // Un hébergement statique répond en HTML/texte : on bascule sur le procès enregistré.
  if (!(res.headers.get('content-type') || '').includes('json')) return recordedApi(path, body);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.status);
  return data;
}

// --- petits effets d'écran ---
function flashHud(color = 'rgba(201,48,58,.35)') { const f = $('flash'); f.style.background = color; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function shakeStage() { stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); }
function phase(txt, live) { const p = $('phase'); p.textContent = txt; p.className = 'phase' + (live ? ' live' : ''); }
function setTally() { $('nv').textContent = current.verified; $('nr').textContent = current.rejected; $('no').textContent = current.objections; }
function setCinema(on) { stage.classList.toggle('cine', on); $('bCine').textContent = tr(on ? 'cinema_off' : 'cinema_on'); }

function setBusy(b) {
  document.querySelectorAll('#witnesses .tab').forEach((x) => (x.disabled = b));
  ['bDuel', 'bObj', 'bTrial2'].forEach((id) => { if ($(id)) $(id).disabled = b; });
  $('bVerd').disabled = b || current.witnessed === 0;
}

async function objectionBanner(sideGhost) {
  const o = $('obj'); o.hidden = false; o.style.animation = 'none'; void o.offsetWidth; o.style.animation = '';
  shakeStage(); flashHud(); audio.play('gavel'); audio.play('bad');
  sceneApi?.glitch(sideGhost); sceneApi?.shake(0.35); sceneApi?.flash(0xc9303a, 0.7); sceneApi?.roll(0.06);
  await sleep(1100); o.hidden = true; sceneApi?.roll(0);
}

// --- dossier ---
function renderFacts(facts) {
  const box = $('facts'); box.textContent = '';
  for (const f of facts) {
    const d = document.createElement('div'); d.className = 'paper ' + (f.side === 'defense' ? 'def' : 'pro');
    const l = document.createElement('div'); l.className = 'lab'; l.textContent = tr(f.side === 'defense' ? 'defense' : 'prosecution');
    const p = document.createElement('p'); p.textContent = f.text;
    const id = document.createElement('span'); id.className = 'fid'; id.textContent = tr('fact') + ' ' + f.id;
    d.append(l, p, id); box.append(d);
  }
}

function renderWitnesses(list) {
  const box = $('witnesses'); box.textContent = '';
  list.forEach((w, i) => {
    const b = document.createElement('button'); b.className = 'tab'; b.dataset.name = w.name;
    b.append(document.createTextNode(w.name.toUpperCase()));
    const s = document.createElement('small'); s.textContent = `${w.count} commits · ${w.years}`; b.append(s);
    b.addEventListener('click', () => summonWitness(i));
    box.append(b);
  });
}

// --- déclarations ---
async function typeText(el, text) {
  const full = '« ' + text + ' »';
  if (RM) { el.textContent = full; return; }
  for (let i = 0; i < text.length; i += 2) { el.textContent = '« ' + text.slice(0, i + 2); await sleep(22); }
  el.textContent = full;
}

/** Une déclaration : le fantôme parle, git est interrogé (pièce à conviction qui vole), puis tampon. */
async function statement(s, ghostIdx, speaker) {
  const li = document.createElement('li'); li.className = 's';
  if (speaker) { const who = document.createElement('div'); who.className = 'lab'; who.textContent = speaker; li.append(who); }
  const txt = document.createElement('div'); txt.className = 't';
  const row = document.createElement('div'); row.className = 'row';
  li.append(txt, row); $('say').append(li); li.scrollIntoView({ block: 'nearest' });
  sceneApi?.speak(ghostIdx);
  const voice = VOICES[(s.side ?? ghostIdx) % VOICES.length];
  const spoken = audio.speak(s.text, voice);
  await typeText(txt, s.text);
  const hash = document.createElement('span'); hash.className = 'hash'; hash.textContent = 'git ' + s.hash;
  const spin = document.createElement('span'); spin.className = 'spin';
  const wait = document.createElement('span'); wait.className = 'why'; wait.textContent = tr('verifying');
  row.append(hash, spin, wait);
  sceneApi?.proof({ hash: s.hash, ok: s.ok, cmd: s.proof?.cmd ?? 'git show ' + s.hash, lines: s.proof?.lines ?? [s.reason], x: current.duelling ? 0 : undefined });
  audio.play('beat');
  await Promise.all([sleep(1500), spoken]);
  spin.remove(); wait.remove();
  const st = document.createElement('span'); st.className = 'st'; st.textContent = tr(s.ok ? 'stamp_ok' : 'stamp_bad');
  const why = document.createElement('span'); why.className = 'why'; why.textContent = s.reason;
  row.append(st, why); li.classList.add(s.ok ? 'ok' : 'bad');
  if (s.ok) { current.verified++; audio.play('ok'); sceneApi?.pulse(true, ghostIdx); sceneApi?.flash(0x79e0c4, 0.25); }
  else { current.rejected++; current.objections++; sceneApi?.pulse(false, ghostIdx); setTally(); await objectionBanner(ghostIdx); }
  setTally(); await sleep(700);
}

// --- invocation : plateau de spiritisme, planchette, apparition ---
async function ritual(names, tints) {
  audio.play('whisper'); audio.play('choir');
  names.forEach((_, i) => { sceneApi?.tint(i, tints[i]); });
  sceneApi?.vortex(1, 1500); sceneApi?.appear(0, 0, 900); sceneApi?.appear(1, 0, 900);
  sceneApi?.shot('ouija', 1.6); sceneApi?.flare(1, 1200); sceneApi?.ritual(0.9, 1500);
  await sleep(1500);
  const name = names[0].normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 7);
  for (const ch of name) {
    await sceneApi?.planchette(ch, 800); audio.play('tick'); sceneApi?.burst();
    $('spelled').textContent += ch.toUpperCase(); await sleep(340);
  }
  await sleep(250); sceneApi?.home(600);
}

async function apparition(duel) {
  sceneApi?.shot(duel ? 'duel' : 'ghost', 1.5); sceneApi?.shake(0.05); audio.play('gavel'); sceneApi?.flash(0x79e0c4, 0.5);
  await sleep(900);
  sceneApi?.appear(0, 1, 2200); if (duel) sceneApi?.appear(1, 1, 2200);
  sceneApi?.flare(0, 2200); audio.play('whisper'); sceneApi?.vortex(0, 3200); sceneApi?.bolt();
  sceneApi?.pillar(1, 500).then(() => sceneApi?.pillar(0, 2600));
  await sleep(1800); $('spelled').textContent = '';
}

function endScene() {
  sceneApi?.shot('wide', 1.2); sceneApi?.ritual(0.25, 1500); sceneApi?.appear(0, 0, 1600); sceneApi?.appear(1, 0, 1600); sceneApi?.speak(null);
  sceneApi?.place(0, 0); sceneApi?.place(1, 0);
  phase(tr('ph_cross'), false);
}

async function guarded(fn) {
  if (current.busy) return;
  current.busy = true; setBusy(true);
  try { await fn(); } finally { current.busy = false; setBusy(false); setTally(); }
}

async function summonWitness(i, perjury = $('perjury').checked) {
  await guarded(async () => {
    const w = current.list[i]; current.duelling = false;
    document.querySelectorAll('#witnesses .tab').forEach((b, k) => b.setAttribute('aria-pressed', String(k === i)));
    $('say').textContent = ''; $('note').textContent = ''; $('spelled').textContent = '';
    $('gname').textContent = w.name; $('gname').style.color = hexCss(TINTS[i % 3]); $('gmeta').textContent = tr('summoning');
    phase(tr('ph_summon'), true);
    const req = api('/api/testimony', { repo: current.repo, lang, author: w.name, perjury }).catch((e) => e);
    sceneApi?.place(0, 0); sceneApi?.place(1, 0);
    await ritual([w.name], [TINTS[i % 3]]);
    await apparition(false);
    const tm = await req;
    if (tm instanceof Error) { $('gmeta').textContent = tr('witness_err', { msg: tm.message }); endScene(); return; }
    $('gmeta').textContent = `${tm.years} · ${tm.commits} commits · ${tr(tm.mode === 'llm' ? 'mode_llm' : 'mode_offline')}`;
    phase(tr('ph_testimony'), true);
    for (const s of tm.statements) await statement(s, 0);
    current.witnessed++;
    $('note').textContent = tr('note_witness');
    endScene();
  });
}

async function runDuel(perjury = $('perjury').checked) {
  if (current.list.length < 2) return;
  await guarded(async () => {
    current.duelling = true;
    document.querySelectorAll('#witnesses .tab').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    $('say').textContent = ''; $('note').textContent = ''; $('spelled').textContent = '';
    $('gname').textContent = tr('duel_title'); $('gname').style.color = ''; $('gmeta').textContent = tr('duel_search');
    phase(tr('ph_summon'), true);
    const req = api('/api/duel', { repo: current.repo, lang, perjury }).catch((e) => e);
    const d = await req;
    if (d instanceof Error) { $('gmeta').textContent = tr('duel_err', { msg: d.message }); phase(tr('ph_cross'), false); return; }
    const idx = (n) => Math.max(0, current.list.findIndex((w) => w.name === n)) % 3;
    const first = (n) => n.split(' ')[0];
    $('gname').textContent = tr('versus', { a: first(d.witnesses[0]), b: first(d.witnesses[1]) });
    sceneApi?.place(0, -2.4); sceneApi?.place(1, 2.4);
    await ritual(d.witnesses, [TINTS[idx(d.witnesses[0])], TINTS[idx(d.witnesses[1])]]);
    await apparition(true);
    $('gmeta').textContent = tr('duel_file', { file: d.file });
    phase(tr('ph_testimony'), true);
    for (const s of d.statements) await statement(s, s.side, s.witness.toUpperCase());
    current.witnessed++;
    $('note').textContent = tr('note_duel');
    current.duelling = false;
    endScene();
  });
}

async function manualObjection() {
  await guarded(async () => {
    current.objections++; setTally(); phase(tr('ph_objection'), true);
    sceneApi?.shot('defense', 5); sceneApi?.roll(-0.08); sceneApi?.shake(0.5); sceneApi?.flash(0xc9303a, 0.9);
    await objectionBanner(undefined); sceneApi?.shot('wide', 1.4); phase(tr('ph_cross'), false);
  });
}

// --- verdict ---
async function verdict() {
  await guarded(async () => {
    phase(tr('ph_verdict'), true); sceneApi?.shot('judge', 1.3); sceneApi?.flare(0.6, 900); audio.play('organ');
    const req = api('/api/verdict', { repo: current.repo, lang }).catch((e) => e);
    await sleep(1700);
    await sceneApi?.gavel(() => { audio.play('gavel'); sceneApi.shake(0.8); sceneApi.flash(0xff6a3a, 0.22); shakeStage(); flashHud('rgba(255,255,255,.5)'); sceneApi.sparks(1.9, 2.7, -10.8, 0xf08a24, 170, 7); sceneApi.shock(0, -10.3, 0xc9303a); sceneApi.vertigo(1700); });
    await sleep(150);
    await sceneApi?.gavel(() => { audio.play('gavel'); sceneApi.shake(1.1); sceneApi.flash(0xc9303a, 0.3); shakeStage(); sceneApi.sparks(1.9, 2.7, -10.8, 0xc9303a, 220, 9); sceneApi.sparks(0, 3.4, -12, 0xf08a24, 160, 8); sceneApi.shock(0, -10.3, 0xf08a24); sceneApi.treeBurn(0xf08a24); });
    const v = await req;
    await sleep(500); sceneApi?.fovReset(1000);
    if (v instanceof Error) { $('gmeta').textContent = tr('verdict_err', { msg: v.message }); phase(tr('ph_cross'), false); return; }
    const big = $('vbig'); big.textContent = tr(v.verdict); big.className = 'big' + (v.verdict === 'EXECUTER' ? ' live' : '');
    big.style.animation = 'none'; void big.offsetWidth; big.style.animation = '';
    $('vscore').textContent = tr('score', { d: v.defense, p: v.prosecution });
    $('term').textContent = v.lines.map((l) => '> ' + l).join('\n');
    $('verdict').hidden = false;
    audio.play(v.verdict === 'EXECUTER' ? 'choir' : 'organ');
    audio.speak(tr('verdict_say', { v: tr(v.verdict).toLowerCase() }), { pitch: 0.4, rate: 0.75 });
    clearInterval(current.emberIv);
    current.emberIv = setInterval(() => sceneApi?.sparks((Math.random() - 0.5) * 9, 2.8 + Math.random() * 2, -11.5 + Math.random() * 2.5, Math.random() < 0.5 ? 0xf08a24 : 0xc9303a, 16, 2.6), 650);
  });
}
$('vClose').addEventListener('click', () => {
  $('verdict').hidden = true; clearInterval(current.emberIv); setCinema(false);
  sceneApi?.flare(0, 800); sceneApi?.shot('wide', 1.2); sceneApi?.treeBurn(0x79e0c4); phase(tr('ph_open'), false);
});

// --- entrée, cinéma, procès complet ---
function enter() {
  if (document.body.classList.contains('in')) return;
  $('title').classList.add('off'); document.body.classList.add('in');
  sceneApi?.fly(); sceneApi?.bolt(); sceneApi?.flare(1, 500).then(() => sceneApi?.flare(0, 2600)); audio.play('thunder');
  phase(tr('ph_open'), false);
}
$('bEnter').addEventListener('click', enter);
$('bCine').addEventListener('click', () => setCinema(!stage.classList.contains('cine')));
addEventListener('keydown', (e) => { if (e.key === 'Escape') setCinema(false); });
$('bObj').addEventListener('click', manualObjection);
$('bDuel').addEventListener('click', () => runDuel());
$('bVerd').addEventListener('click', verdict);

/** Procès complet en un clic : un témoin qui ment, un duel, le verdict. Idéal pour la vidéo. */
async function fullTrial() {
  enter(); setCinema(true); await sleep(3200);
  await summonWitness(0, true); await sleep(700);
  await runDuel(true); await sleep(700);
  await verdict();
}
$('bTrial').addEventListener('click', fullTrial);

(async () => {
  try {
    const c = await api('/api/case?lang=' + lang + (new URLSearchParams(location.search).get('repo') ? '&repo=' + encodeURIComponent(new URLSearchParams(location.search).get('repo')) : ''));
    current.repo = c.repo; current.list = c.witnesses; $('bDuel').disabled = c.witnesses.length < 2;
    $('caseLine').textContent = tr('case_line', { name: c.name, commits: c.commits, span: c.span }) + (current.recorded ? ' · ' + tr('recorded') : '');
    renderFacts(c.facts); renderWitnesses(c.witnesses);
    $('bEnter').disabled = false; $('bTrial').disabled = false;
  } catch (err) {
    $('caseLine').textContent = tr('case_err', { msg: err.message });
  }
})();

// Aide à la démo et aux captures : #enter, #demo (un témoin), #duel / #duelmenteur, #trial (procès complet).
addEventListener('load', () => {
  const h = location.hash;
  if (!h) return;
  const wait = setInterval(() => {
    if ($('bEnter').disabled) return;
    clearInterval(wait);
    if (h === '#trial') { fullTrial(); return; }
    enter();
    if (h === '#duel' || h === '#duelmenteur') { if (h === '#duelmenteur') $('perjury').checked = true; setTimeout(() => runDuel(), 2500); }
    if (h === '#demo') setTimeout(() => summonWitness(0), 2500);
    // Raccourcis pour les captures : un ou deux fantômes déjà apparus, sans rituel.
    if (h === '#ghost' || h === '#ghosts') {
      const two = h === '#ghosts';
      sceneApi?.tint(0, TINTS[0]); sceneApi?.tint(1, TINTS[1]); sceneApi?.place(0, two ? -2.4 : 0); if (two) sceneApi?.place(1, 2.4);
      sceneApi?.appear(0, 1, 50); if (two) sceneApi?.appear(1, 1, 50); sceneApi?.shot(two ? 'duel' : 'ghost', 4);
    }
  }, 200);
});
