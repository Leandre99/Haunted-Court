// Ambiance sonore synthétisée (aucun fichier audio) + voix des fantômes (Web Speech API).
// Tout est désactivé par défaut : les navigateurs exigent un geste de l'utilisateur.

export function createAudio() {
  let ctx = null, master = null, rain = null, drone = null, thunderTimer = null;
  let sfxOn = false, voiceOn = false;
  let voicePref = 'fr', frVoice = null;

  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  function pickVoice() {
    if (!synth) return;
    const all = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(voicePref));
    const male = voicePref === 'fr' ? /henri|paul|thomas|claude|male|homme/i : /david|mark|guy|george|daniel|male/i;
    frVoice = all.find((v) => male.test(v.name)) || all.find((v) => v.localService) || all[0] || null;
  }
  if (synth) { pickVoice(); synth.addEventListener?.('voiceschanged', pickVoice); }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    // Réverbération d'église : bruit décroissant
    const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.45;
    master.connect(conv); conv.connect(wet); wet.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(sec) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function startAmbience() {
    if (rain) return;
    // Pluie sur le vitrail
    rain = ctx.createBufferSource(); rain.buffer = noiseBuffer(2); rain.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0.05;
    rain.connect(hp); hp.connect(g); g.connect(master); rain.start();
    // Bourdon grave qui respire
    const g2 = ctx.createGain(); g2.gain.value = 0.05; g2.connect(master);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.12; lg.gain.value = 0.03; lfo.connect(lg); lg.connect(g2.gain); lfo.start();
    drone = [55, 82.4, 110.6].map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g2); o.start(); return o; });
    scheduleThunder();
  }
  function stopAmbience() {
    try { rain?.stop(); drone?.forEach((o) => o.stop()); } catch { /* déjà arrêtés */ }
    rain = null; drone = null; clearTimeout(thunderTimer);
  }
  function scheduleThunder() {
    clearTimeout(thunderTimer);
    thunderTimer = setTimeout(() => { if (sfxOn) { SFX.thunder(); scheduleThunder(); } }, 18000 + Math.random() * 22000);
  }

  function tone(freq, dur, type = 'sine', vol = 0.15, slide) {
    if (!sfxOn || !ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(slide, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fc, swell) {
    if (!sfxOn || !ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 0.8;
    const g = ctx.createGain(), t = ctx.currentTime;
    if (swell) { g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.6); g.gain.linearRampToValueAtTime(0.001, t + dur); }
    else { g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); }
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  function chord(freqs, type, peak, attack, total, cutoff) {
    if (!sfxOn || !ctx) return;
    const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + attack); g.gain.linearRampToValueAtTime(0.0001, t + total);
    f.type = 'lowpass'; f.frequency.value = cutoff; f.connect(g); g.connect(master);
    freqs.forEach((fr, i) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = fr * (1 + (i - 1.5) * 0.002); o.connect(f); o.start(t); o.stop(t + total + 0.2); });
  }

  const SFX = {
    tick: () => tone(660, 0.3, 'sine', 0.06),
    ok: () => { tone(784, 0.8, 'sine', 0.1); tone(1176, 0.9, 'sine', 0.05); },
    bad: () => { tone(130, 0.5, 'sawtooth', 0.12, 50); noise(0.35, 0.12, 900); },
    gavel: () => { tone(95, 0.6, 'sine', 0.5, 32); noise(0.25, 0.28, 220); },
    thunder: () => { noise(3, 0.45, 130, true); tone(48, 2.4, 'sine', 0.3, 26); },
    whisper: () => noise(2.4, 0.14, 1700, true),
    door: () => { tone(70, 1.2, 'sawtooth', 0.12, 45); noise(1.2, 0.1, 400, true); },
    choir: () => chord([220, 261.6, 329.6, 440], 'sine', 0.2, 2.4, 6.2, 900),
    organ: () => chord([110, 130.8, 164.8, 220], 'sawtooth', 0.22, 1.8, 4.8, 520),
  };

  /** Fait parler un fantôme. Résout à la fin de la phrase (ou après `maxMs`). Jamais bloquant si la voix est coupée. */
  function speak(text, { pitch = 0.6, rate = 0.82 } = {}, maxMs = 9000) {
    if (!voiceOn || !synth) return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text.replace(/[‹›«»]/g, ' ').replace(/`/g, ''));
      u.lang = frVoice?.lang || (voicePref === 'fr' ? 'fr-FR' : 'en-US'); if (frVoice) u.voice = frVoice;
      u.pitch = pitch; u.rate = rate; u.volume = 1;
      const done = () => { clearTimeout(to); resolve(); };
      const to = setTimeout(() => { synth.cancel(); done(); }, maxMs);
      u.onend = done; u.onerror = done;
      synth.speak(u);
    });
  }

  return {
    sfxOn: () => sfxOn,
    voiceOn: () => voiceOn,
    voiceAvailable: () => Boolean(synth),
    setLang(l) { voicePref = l === 'fr' ? 'fr' : 'en'; pickVoice(); },
    setSfx(on) {
      sfxOn = on;
      if (!ensure()) { sfxOn = false; return false; }
      ctx.resume?.();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(on ? 1 : 0, ctx.currentTime + 0.6);
      if (on) startAmbience(); else stopAmbience();
      return sfxOn;
    },
    setVoice(on) { voiceOn = on && Boolean(synth); if (!voiceOn) synth?.cancel(); return voiceOn; },
    play(name) { try { SFX[name]?.(); } catch { /* le son n'est jamais critique */ } },
    speak,
    cancelVoice: () => synth?.cancel(),
  };
}
