// Textes de l'interface. Anglais par défaut ; ?lang=fr ou le bouton EN/FR pour passer en français.
const STR = {
  en: {
    kicker: 'The trial of dead code', opening: 'Opening the case file…', enter: 'Enter the courtroom',
    case_line: 'CASE No. 1 · {name} · {commits} commits · {span}', case_err: 'Cannot read the case file: {msg}',
    summon: 'Summon a witness', duel: 'Ghost duel', duel_sub: 'the file they fight over',
    perjury: 'Lying witness', demo: '(demo)',
    sound_off: 'Sound: off', sound_on: 'Sound: on', voice_off: 'Voice: off', voice_on: 'Voice: on',
    dossier: 'Case file', defense: 'Defense', prosecution: 'Prosecution', fact: 'FACT',
    court_open: 'Court is in session', summon_hint: 'Summon a witness on the left.',
    verified: 'Verified', rejected: 'Rejected', verdict_btn: 'Deliver the verdict',
    objection: 'OBJECTION!', back: 'Back to the courtroom', lang_btn: 'FR', lang_title: 'Passer en français',
    summoning: 'Summoning…', mode_llm: 'speech written by AI', mode_offline: 'speech rebuilt offline from real commits',
    stamp_ok: 'verified', stamp_bad: 'rejected',
    note_witness: 'Every sentence is checked against the real git history before it is accepted.',
    note_duel: 'Two witnesses, one file: each can only cite their own commits.',
    witness_err: 'The witness does not answer: {msg}', duel_err: 'The duel did not take place: {msg}', verdict_err: 'Cannot deliver a verdict: {msg}',
    duel_title: 'Ghost duel', duel_search: 'Looking for the file they fight over…', duel_file: 'Contested file: {file}',
    versus: '{a} vs {b}',
    score: 'Defense {d} points · Prosecution {p} points',
    EXECUTER: 'EXECUTE', DEBRANCHER: 'UNPLUG', verdict_say: 'Verdict: {v}.',
    voice_sample: 'I am the ghost of this repository.',
    nogl: 'The courtroom 3D is not available on this device. The trial remains usable.',
    speak_lang: 'en',
    trial: 'Full trial', objections: 'Objections', objection_btn: 'Objection', cinema_on: 'Cinema', cinema_off: 'Exit cinema', verifying: 'checking git…',
    ph_open: 'Court is open', ph_summon: 'Summoning', ph_testimony: 'Testimony', ph_cross: 'Cross-examination', ph_objection: 'Objection!', ph_verdict: 'Verdict',
    recorded: 'recorded trial (run locally for live git)',
    no_backend: 'The game server is not reachable. Run "npm start" and open http://127.0.0.1:3000 (static hosting cannot serve /api).',
  },
  fr: {
    kicker: 'Le procès du code mort', opening: 'Ouverture du dossier…', enter: 'Entrer dans la salle',
    case_line: 'AFFAIRE N° 1 · {name} · {commits} commits · {span}', case_err: 'Dossier illisible : {msg}',
    summon: 'Convoquer un témoin', duel: 'Duel des fantômes', duel_sub: 'le fichier qu’ils se disputent',
    perjury: 'Témoin menteur', demo: '(démo)',
    sound_off: 'Son : activer', sound_on: 'Son : actif', voice_off: 'Voix : activer', voice_on: 'Voix : actives',
    dossier: 'Pièces du dossier', defense: 'Défense', prosecution: 'Accusation', fact: 'FAIT',
    court_open: 'Salle d’audience ouverte', summon_hint: 'Convoquez un témoin à gauche.',
    verified: 'Vérifiées', rejected: 'Rejetées', verdict_btn: 'Rendre le verdict',
    objection: 'OBJECTION !', back: 'Retour à la salle', lang_btn: 'EN', lang_title: 'Switch to English',
    summoning: 'Invocation en cours…', mode_llm: 'parole générée par IA', mode_offline: 'parole reconstituée hors-ligne à partir de vrais commits',
    stamp_ok: 'vérifié', stamp_bad: 'rejeté',
    note_witness: 'Chaque phrase est contrôlée contre le vrai historique git avant d’être acceptée.',
    note_duel: 'Deux témoins, un même fichier : chacun ne peut citer que ses propres commits.',
    witness_err: 'Le témoin ne répond pas : {msg}', duel_err: 'Le duel n’a pas eu lieu : {msg}', verdict_err: 'Verdict impossible : {msg}',
    duel_title: 'Duel des fantômes', duel_search: 'Recherche du fichier qu’ils se disputent…', duel_file: 'Fichier contesté : {file}',
    versus: '{a} contre {b}',
    score: 'Défense {d} points · Accusation {p} points',
    EXECUTER: 'EXÉCUTER', DEBRANCHER: 'DÉBRANCHER', verdict_say: 'Verdict : {v}.',
    voice_sample: 'Je suis le fantôme de ce dépôt.',
    nogl: 'La 3D n’est pas disponible sur cet appareil. Le procès reste utilisable.',
    speak_lang: 'fr',
    trial: 'Procès complet', objections: 'Objections', objection_btn: 'Objection', cinema_on: 'Cinéma', cinema_off: 'Quitter cinéma', verifying: 'vérification dans git…',
    ph_open: 'Audience ouverte', ph_summon: 'Invocation', ph_testimony: 'Témoignage', ph_cross: 'Contre-interrogatoire', ph_objection: 'Objection !', ph_verdict: 'Verdict',
    recorded: 'procès enregistré (lancez en local pour git en direct)',
    no_backend: 'Le serveur du jeu est injoignable. Lancez « npm start » puis ouvrez http://127.0.0.1:3000 (un hébergement statique ne peut pas servir /api).',
  },
};

function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fr' || q === 'en') return q;
  try { const s = localStorage.getItem('hc-lang'); if (s === 'fr' || s === 'en') return s; } catch { /* stockage indisponible */ }
  return 'en';
}

export const lang = initialLang();
document.documentElement.lang = lang;

export function tr(key, vars = {}) {
  const s = STR[lang][key] ?? STR.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** Change de langue et recharge (garde la salle ouverte si le procès a déjà commencé). */
export function switchLang() {
  const next = lang === 'en' ? 'fr' : 'en';
  try { localStorage.setItem('hc-lang', next); } catch { /* ignoré */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  if (document.body.classList.contains('in')) url.hash = '#enter';
  location.href = url.toString();
}

/** Applique les textes aux éléments marqués data-i18n (et data-i18n-title). */
export function applyStatic() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = tr(el.dataset.i18nTitle); });
}
