// Procedural WebAudio: SFX + adaptive synth music. No external assets.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.masterVol = 0.8;
    this.musicVol = 0.4;
    this.sfxVol = 0.85;
    this.muted = false;
    this.musicOn = true;
    this.noiseBuf = null;
    this.music = { mode: 'menu', step: 0, next: 0, bpm: 118, playing: false, gain: null, intensity: 0.4 };
    this.active = 0;
  }

  async init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // master chain
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVol;
    this.comp = this.ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.knee.value = 24; this.comp.ratio.value = 6;
    this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master.connect(this.comp).connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = this.musicVol; this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sfxVol; this.sfxBus.connect(this.master);
    // reverb-ish send (small algorithmic delay)
    this._makeNoise();
    this.ready = true;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  resume() { if (this.ctx?.state === 'suspended') this.ctx.resume(); }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setVolumes(master, music, sfx) {
    this.masterVol = master; this.musicVol = music; this.sfxVol = sfx;
    if (this.ready) {
      this.master.gain.value = this.muted ? 0 : master;
      this.musicBus.gain.value = music;
      this.sfxBus.gain.value = sfx;
    }
  }
  setMuted(m) {
    this.muted = m;
    if (this.ready) this.master.gain.value = m ? 0 : this.masterVol;
  }

  // ---------- primitives ----------
  _env(gainNode, t0, a, d, peak = 1, sus = 0) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t0 + a + d);
  }

  tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.5, attack = 0.004, slide = null, dest = null, pan = 0, when = 0, detune = 0 }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (detune) o.detune.value = detune;
    if (slide != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; o.connect(g).connect(p).connect(dest || this.sfxBus); }
    else o.connect(g).connect(dest || this.sfxBus);
    this._env(g, t0, attack, dur, vol);
    o.start(t0); o.stop(t0 + attack + dur + 0.05);
  }

  noise({ dur = 0.15, vol = 0.4, type = 'highpass', freq = 1800, q = 0.7, when = 0, dest = null, pan = 0, attack = 0.002, slide = null }) {
    if (!this.ready) return;
    const t0 = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (slide != null) f.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = pan; s.connect(f).connect(g).connect(p).connect(dest || this.sfxBus); }
    else s.connect(f).connect(g).connect(dest || this.sfxBus);
    this._env(g, t0, attack, dur, vol);
    s.start(t0); s.stop(t0 + attack + dur + 0.05);
  }

  // ---------- game SFX ----------
  hit(power = 1, kind = 'flesh', blocked = false, pan = 0) {
    if (!this.ready) return;
    if (blocked) {
      this.noise({ dur: 0.085, vol: 0.3, type: 'bandpass', freq: 1400 + power * 300, q: 1.4, pan });
      this.tone({ freq: 220 + power * 40, type: 'square', dur: 0.06, vol: 0.12, slide: 130, pan });
      return;
    }
    const p = Math.min(1.6, power);
    this.noise({ dur: 0.05 + 0.03 * p, vol: 0.32 + 0.1 * p, type: 'lowpass', freq: 1100 + 300 * p, slide: 220, pan });
    this.tone({ freq: 150 - 20 * p, type: 'sine', dur: 0.1 + 0.05 * p, vol: 0.35 * p, slide: 45, pan });
    if (kind === 'kick') this.tone({ freq: 95, type: 'triangle', dur: 0.16, vol: 0.3 * p, slide: 38, pan });
    if (p > 1.2) this.tone({ freq: 70, type: 'sawtooth', dur: 0.22, vol: 0.22, slide: 30, pan });
    this.noise({ dur: 0.012, vol: 0.22, type: 'highpass', freq: 5200, pan });
  }

  whoosh(power = 1, pan = 0) {
    this.noise({ dur: 0.13 + 0.05 * power, vol: 0.1 + 0.06 * power, type: 'bandpass', freq: 500 + 300 * power, q: 2.2, slide: 2400, pan });
  }

  block() { this.noise({ dur: 0.07, vol: 0.22, type: 'highpass', freq: 2600 }); this.tone({ freq: 330, type: 'square', dur: 0.04, vol: 0.1 }); }

  parry() {
    if (!this.ready) return;
    this.tone({ freq: 1320, type: 'sine', dur: 0.28, vol: 0.28, slide: 2640 });
    this.tone({ freq: 990, type: 'triangle', dur: 0.22, vol: 0.16, slide: 1980 });
    this.noise({ dur: 0.16, vol: 0.14, type: 'highpass', freq: 4200 });
  }

  counter() {
    if (!this.ready) return;
    this.tone({ freq: 160, type: 'sawtooth', dur: 0.3, vol: 0.3, slide: 60 });
    this.noise({ dur: 0.22, vol: 0.3, type: 'lowpass', freq: 2400, slide: 300 });
    this.tone({ freq: 880, type: 'square', dur: 0.1, vol: 0.12, slide: 440, when: 0.02 });
  }

  driveImpact() {
    if (!this.ready) return;
    this.tone({ freq: 90, type: 'sawtooth', dur: 0.5, vol: 0.35, slide: 32 });
    this.noise({ dur: 0.36, vol: 0.3, type: 'lowpass', freq: 3000, slide: 200 });
    this.tone({ freq: 520, type: 'square', dur: 0.16, vol: 0.12, slide: 90, when: 0.03 });
  }

  driveRush() {
    if (!this.ready) return;
    this.noise({ dur: 0.34, vol: 0.22, type: 'bandpass', freq: 700, q: 1.2, slide: 3400 });
    this.tone({ freq: 240, type: 'sawtooth', dur: 0.22, vol: 0.12, slide: 720 });
  }

  driveParry() {
    if (!this.ready) return;
    this.tone({ freq: 660, type: 'sine', dur: 0.2, vol: 0.2, slide: 1320 });
    this.tone({ freq: 880, type: 'triangle', dur: 0.14, vol: 0.14, slide: 1760 });
  }

  burnout() {
    if (!this.ready) return;
    this.noise({ dur: 0.7, vol: 0.26, type: 'lowpass', freq: 1600, slide: 120 });
    this.tone({ freq: 300, type: 'sawtooth', dur: 0.6, vol: 0.12, slide: 60 });
  }

  throwHit() {
    this.noise({ dur: 0.2, vol: 0.3, type: 'lowpass', freq: 900, slide: 120 });
    this.tone({ freq: 110, type: 'triangle', dur: 0.28, vol: 0.32, slide: 40 });
  }

  superFlash(level = 1) {
    if (!this.ready) return;
    this.noise({ dur: 0.7, vol: 0.24, type: 'bandpass', freq: 300, q: 0.8, slide: 4200 });
    this.tone({ freq: 220 * level, type: 'sawtooth', dur: 0.5, vol: 0.16, slide: 880 * level });
    this.tone({ freq: 110 * level, type: 'sine', dur: 0.8, vol: 0.2, slide: 440 * level });
  }

  superHit(level = 1) {
    if (!this.ready) return;
    for (let i = 0; i < 3 + level; i++) {
      this.noise({ dur: 0.16, vol: 0.24, type: 'lowpass', freq: 2600 - i * 200, slide: 200, when: i * 0.07 });
      this.tone({ freq: 130 - i * 10, type: 'triangle', dur: 0.2, vol: 0.24, slide: 40, when: i * 0.07 });
    }
  }

  ko() {
    if (!this.ready) return;
    this.tone({ freq: 70, type: 'sawtooth', dur: 1.1, vol: 0.36, slide: 22 });
    this.noise({ dur: 1.0, vol: 0.3, type: 'lowpass', freq: 2400, slide: 80 });
    this.tone({ freq: 440, type: 'square', dur: 0.5, vol: 0.1, slide: 55 });
    this.cheer(1.0);
  }

  cheer(amt = 0.6) {
    if (!this.ready) return;
    this.noise({ dur: 1.5, vol: 0.1 * amt, type: 'bandpass', freq: 1200, q: 0.5, attack: 0.2 });
    this.noise({ dur: 1.8, vol: 0.06 * amt, type: 'highpass', freq: 2200, attack: 0.3 });
  }

  announce(kind) {
    // tonal "announcer" stinger to punctuate text
    if (!this.ready) return;
    if (kind === 'round') {
      this.tone({ freq: 330, type: 'sawtooth', dur: 0.3, vol: 0.2, slide: 660 });
      this.tone({ freq: 165, type: 'square', dur: 0.3, vol: 0.14 });
      this.tone({ freq: 660, type: 'sawtooth', dur: 0.4, vol: 0.16, slide: 990, when: 0.12 });
    } else if (kind === 'fight') {
      this.tone({ freq: 220, type: 'sawtooth', dur: 0.5, vol: 0.24, slide: 880 });
      this.tone({ freq: 440, type: 'square', dur: 0.4, vol: 0.14, slide: 1760, when: 0.04 });
      this.noise({ dur: 0.4, vol: 0.16, type: 'highpass', freq: 1600, when: 0.05 });
    } else if (kind === 'ko') {
      this.tone({ freq: 110, type: 'sawtooth', dur: 0.9, vol: 0.3, slide: 55 });
      this.noise({ dur: 0.6, vol: 0.24, type: 'lowpass', freq: 3000, slide: 200 });
    } else if (kind === 'win') {
      this.tone({ freq: 523.25, type: 'square', dur: 0.22, vol: 0.16 });
      this.tone({ freq: 659.25, type: 'square', dur: 0.22, vol: 0.16, when: 0.16 });
      this.tone({ freq: 783.99, type: 'square', dur: 0.3, vol: 0.18, when: 0.32 });
      this.tone({ freq: 1046.5, type: 'triangle', dur: 0.5, vol: 0.16, when: 0.48 });
    } else if (kind === 'timeout') {
      this.tone({ freq: 440, type: 'square', dur: 0.16, vol: 0.18 });
      this.tone({ freq: 440, type: 'square', dur: 0.16, vol: 0.18, when: 0.2 });
      this.tone({ freq: 330, type: 'square', dur: 0.4, vol: 0.18, when: 0.4 });
    } else if (kind === 'perfect') {
      this.tone({ freq: 880, type: 'sine', dur: 0.5, vol: 0.2, slide: 1760 });
      this.tone({ freq: 1320, type: 'triangle', dur: 0.6, vol: 0.14, slide: 2640, when: 0.1 });
    }
  }

  ui(kind = 'move') {
    if (!this.ready) return;
    if (kind === 'move') this.tone({ freq: 720, type: 'square', dur: 0.035, vol: 0.07 });
    else if (kind === 'confirm') { this.tone({ freq: 640, type: 'square', dur: 0.08, vol: 0.12 }); this.tone({ freq: 960, type: 'square', dur: 0.1, vol: 0.1, when: 0.05 }); }
    else if (kind === 'cancel') this.tone({ freq: 400, type: 'square', dur: 0.1, vol: 0.1, slide: 220 });
    else if (kind === 'error') { this.tone({ freq: 200, type: 'sawtooth', dur: 0.2, vol: 0.12 }); this.tone({ freq: 180, type: 'sawtooth', dur: 0.2, vol: 0.12, when: 0.09 }); }
    else if (kind === 'coin') { this.tone({ freq: 1320, type: 'square', dur: 0.06, vol: 0.12 }); this.tone({ freq: 1760, type: 'square', dur: 0.18, vol: 0.12, when: 0.06 }); }
    else if (kind === 'tick') this.tone({ freq: 1200, type: 'sine', dur: 0.03, vol: 0.06 });
  }

  // ---------- music ----------
  startMusic(mode = 'menu', bpm = 118) {
    if (!this.ready || !this.musicOn) return;
    this.music.mode = mode; this.music.bpm = bpm; this.music.step = 0;
    this.music.next = this.ctx.currentTime + 0.1;
    this.music.playing = true;
    if (!this._musicTimer) this._musicTimer = setInterval(() => this._scheduleMusic(), 40);
  }

  stopMusic() {
    this.music.playing = false;
    if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; }
  }

  setMusicMode(mode, bpm = null) {
    if (!this.music.playing) { this.startMusic(mode, bpm || this.music.bpm); return; }
    this.music.mode = mode;
    if (bpm) this.music.bpm = bpm;
  }

  setIntensity(v) { this.music.intensity = v; }

  _scheduleMusic() {
    if (!this.ready || !this.music.playing || !this.musicOn) return;
    const m = this.music;
    const stepDur = 60 / m.bpm / 4; // 16ths
    while (m.next < this.ctx.currentTime + 0.15) {
      this._playStep(m.step, m.next, stepDur, m);
      m.next += stepDur;
      m.step = (m.step + 1) % 64;
    }
  }

  _mnote(freq, t, dur, type = 'sawtooth', vol = 0.12, detune = 0) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    f.type = 'lowpass'; f.frequency.value = 2200; f.Q.value = 0.6;
    o.connect(f).connect(g).connect(this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _drum(kind, t, vol = 0.3) {
    if (kind === 'kick') {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.18);
    } else if (kind === 'snare') {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      s.connect(f).connect(g).connect(this.musicBus); s.start(t); s.stop(t + 0.15);
      const o = this.ctx.createOscillator(), g2 = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 190;
      g2.gain.setValueAtTime(vol * 0.6, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g2).connect(this.musicBus); o.start(t); o.stop(t + 0.1);
    } else if (kind === 'hat') {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      s.connect(f).connect(g).connect(this.musicBus); s.start(t); s.stop(t + 0.06);
    }
  }

  _playStep(step, t, sd, m) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const intense = m.intensity;
    const scale = m.mode === 'menu' ? [0, 3, 5, 7, 10] : [0, 2, 3, 7, 8];
    const root = m.mode === 'menu' ? 55 : m.mode === 'fight' ? 49 : 44;
    // drums
    if (s16 === 0 || s16 === 6 || s16 === 8 || (s16 === 14 && bar % 2 === 1)) this._drum('kick', t, 0.34);
    if (s16 === 4 || s16 === 12) this._drum('snare', t, m.mode === 'menu' ? 0.12 : 0.22);
    if (s16 % 2 === 0) this._drum('hat', t, 0.05 + intense * 0.04);
    if (s16 === 15 && bar % 4 === 3) this._drum('snare', t, 0.16);
    // bass
    const bassPat = [0, 0, 7, 0, 0, 3, 0, 5, 0, 0, 7, 10, 0, 3, 5, 3];
    if (s16 % 2 === 0) {
      const n = bassPat[s16] + (bar % 2 ? 2 : 0);
      this._mnote(this._hz(root + n), t, sd * 1.9, 'square', 0.10 + intense * 0.05);
    }
    // arp / lead
    if (m.mode !== 'menu' || bar >= 2) {
      if (s16 % 2 === 1 || (bar % 2 === 0 && intense > 0.55)) {
        const idx = (step * 3) % scale.length;
        const oct = (Math.floor(step / 5) % 2) * 12;
        const f = this._hz(root * 4 + scale[idx] + oct);
        this._mnote(f, t, sd * 1.2, 'triangle', 0.035 + intense * 0.04);
      }
    }
    // pad chords on bar start
    if (s16 === 0) {
      const chordRoot = root * 2 + (bar % 4 === 0 ? 0 : bar % 4 === 1 ? 3 : bar % 4 === 2 ? 7 : 5);
      for (const iv of [0, 7, 12, 15]) {
        this._mnote(this._hz(chordRoot + iv), t, sd * 15, 'sawtooth', 0.018, (Math.random() - 0.5) * 8);
      }
    }
  }

  _hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
}
