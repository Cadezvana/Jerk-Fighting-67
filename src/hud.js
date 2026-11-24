// In-game HUD: health, gauges, timer, combo counters, announcements, training panel.
import { clamp, lerp } from './utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = $('hud');
    this.el = {
      p1: { name: $('p1-name'), health: $('p1-health'), trail: $('p1-health-trail'), super: $('p1-super'), superWrap: $('p1-superwrap'),
        superLv: $('p1-superlv'), drive: $('p1-drive'), combo: $('p1-combo'), pips: $('p1-pips') },
      p2: { name: $('p2-name'), health: $('p2-health'), trail: $('p2-health-trail'), super: $('p2-super'), superWrap: $('p2-superwrap'),
        superLv: $('p2-superlv'), drive: $('p2-drive'), combo: $('p2-combo'), pips: $('p2-pips') },
      timer: $('timer'), round: $('round-label'), announce: $('announce'), subannounce: $('subannounce'),
      hint: $('hint-strip'),
    };
    this.trail = [1, 1];
    this.bannerTimer = 0;
    this.comboTimers = [0, 0];
    this.last = {};
    this.training = {
      panel: $('training-panel'), mode: $('tp-mode'), dummy: $('tp-dummy'), damage: $('tp-damage'),
      combo: $('tp-combo'), scaling: $('tp-scaling'), frames: $('tp-frames'), inputs: $('tp-inputs'),
    };
    this.bannerEl = $('training-banner');
    this.bannerTimer2 = 0;
    this._initPips();
  }

  _initPips() {
    for (const p of ['p1', 'p2']) {
      this.el[p].pips.innerHTML = '<i></i><i></i>';
    }
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setNames(n1, n2) {
    this.el.p1.name.textContent = n1;
    this.el.p2.name.textContent = n2;
  }

  setPips(won1, won2) {
    const set = (el, n) => {
      const kids = el.children;
      for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('won', i < n);
    };
    set(this.el.p1.pips, won1);
    set(this.el.p2.pips, won2);
  }

  resetForRound() {
    this.trail = [1, 1];
    this.last = {};
    this.comboTimers = [0, 0];
    this.el.p1.combo.classList.remove('show');
    this.el.p2.combo.classList.remove('show');
  }

  update(dt, f1, f2, timerVal, mode) {
    if (!f1 || !f2) return;
    const update = (el, f, idx) => {
      // health
      const hr = f.healthRatio;
      const lastHr = this.last[idx] ?? hr;
      if (hr < lastHr - 0.0001) this.trail[idx] = Math.max(this.trail[idx] ?? 1, lastHr);
      this.trail[idx] = lerp(this.trail[idx] ?? 1, hr, 1 - Math.exp(-6 * dt));
      if (this.trail[idx] < hr) this.trail[idx] = hr;
      const healthScale = mode === 'training' && this.game.trainingUnlimited ? 1 : hr;
      el.health.style.transform = `scaleX(${clamp(healthScale, 0, 1)})`;
      el.health.classList.toggle('low', hr < 0.3);
      el.trail.style.transform = `scaleX(${clamp(this.trail[idx], 0, 1)})`;
      this.last[idx] = hr;
      // super
      const lvl = f.superMeter[0];
      el.super.style.transform = `scaleX(${clamp(lvl / 3, 0, 1)})`;
      el.super.classList.toggle('lv2', lvl >= 2 && lvl < 3);
      el.super.classList.toggle('lv3', lvl >= 3);
      // drive
      const dr = f.driveRatio;
      el.drive.style.transform = `scaleX(${clamp(dr, 0, 1)})`;
      el.drive.classList.toggle('low', dr < 0.34 && !f.burnout);
      el.drive.classList.toggle('burnout', f.burnout);
      // combo
      if (this.comboTimers[idx] > 0) {
        this.comboTimers[idx] -= dt;
        if (this.comboTimers[idx] <= 0) el.combo.classList.remove('show');
      }
    };
    update(this.el.p1, f1, 0);
    update(this.el.p2, f2, 1);

    const t = Math.ceil(timerVal);
    if (this._lastTimer !== t) {
      this.el.timer.textContent = String(Math.max(0, t)).padStart(2, '0');
      this.el.timer.classList.toggle('hurry', t <= 10 && t > 0);
      this._lastTimer = t;
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.el.announce.classList.remove('show');
        this.el.subannounce.classList.remove('show');
      }
    }
    if (this.bannerTimer2 > 0) {
      this.bannerTimer2 -= dt;
      if (this.bannerTimer2 <= 0) this.bannerEl.classList.add('hidden');
    }
  }

  announce(text, sub = '', dur = 1.4, cls = '') {
    const a = this.el.announce;
    a.textContent = text;
    a.className = 'announce show ' + cls;
    const s = this.el.subannounce;
    s.textContent = sub;
    s.className = 'subannounce' + (sub ? ' show' : '');
    this.bannerTimer = dur;
    // force reflow for animation restart
    void a.offsetWidth;
  }

  banner(text, sub = '', dur = 1.4) {
    this.el.announce.textContent = text;
    this.el.announce.className = 'announce show';
    this.el.subannounce.textContent = sub;
    this.el.subannounce.className = 'subannounce' + (sub ? ' show' : '');
    this.bannerTimer = dur;
  }

  clearAnnounce() {
    this.el.announce.classList.remove('show');
    this.el.subannounce.classList.remove('show');
    this.bannerTimer = 0;
  }

  setRound(n, total = 3) {
    // `total === 0` is the legacy "final round" sentinel; a training session sets
    // `this.trainingLabel` instead so it never reads as FINAL ROUND.
    if (this.trainingLabel) { this.el.round.textContent = this.trainingLabel; return; }
    this.el.round.textContent = total ? `ROUND ${n}` : 'FINAL ROUND';
  }

  combo(playerIdx, hits, damage, scaled = 1) {
    const el = playerIdx === 0 ? this.el.p1.combo : this.el.p2.combo;
    if (hits < 2) { el.classList.remove('show'); return; }
    el.innerHTML = `<b>${hits}</b> HIT COMBO<br><span style="font-size:.55em;letter-spacing:.1em;color:#ffd23c">${damage.toLocaleString()} DMG</span>`;
    el.classList.add('show');
    this.comboTimers[playerIdx] = 2.2;
  }

  hideCombo(playerIdx) {
    const el = playerIdx === 0 ? this.el.p1.combo : this.el.p2.combo;
    el.classList.remove('show');
    this.comboTimers[playerIdx] = 0;
  }

  hint(text, dur = 1.6) {
    this.el.hint.textContent = text;
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => { this.el.hint.textContent = this.game.currentMode === 'training' ? 'F1 DISPLAY · F2 POSITIONS · F3 REC/PLAY · F4 DUMMY · F5 RESET · F6 HEALTH · ESC MENU' : ''; }, dur * 1000);
  }

  // ---- training panel ----
  showTraining(on) {
    this.training.panel.classList.toggle('hidden', !on);
    this.el.hint.textContent = on ? 'F1 DISPLAY · F2 POSITIONS · F3 REC/PLAY · F4 DUMMY · F5 RESET · F6 HEALTH · ESC MENU' : '';
  }

  updateTraining(info) {
    const t = this.training;
    t.mode.textContent = info.mode || 'FREE';
    t.dummy.textContent = info.dummy || 'STAND';
    t.damage.textContent = info.damage ?? 0;
    t.combo.textContent = `${info.hits ?? 0} HITS`;
    t.scaling.textContent = `${Math.round((info.scaling ?? 1) * 100)}%`;
    if (info.frames) {
      const fr = info.frames;
      t.frames.innerHTML = `<div><label>STARTUP</label><span class="fr-hit">${fr.startup}F</span></div>
        <div><label>ACTIVE</label><span class="fr-hit">${fr.active}F</span></div>
        <div><label>RECOVERY</label><span class="fr-hit">${fr.recovery}F</span></div>
        <div><label>ON HIT</label><span class="fr-hit">${fr.onHit >= 0 ? '+' : ''}${fr.onHit}F</span></div>
        <div><label>ON BLOCK</label><span class="fr-block">${fr.onBlock >= 0 ? '+' : ''}${fr.onBlock}F</span></div>
        <div><label>${fr.counterLabel || 'ADVANTAGE'}</label><span class="fr-punish">${fr.advLabel || ''}</span></div>`;
    } else {
      t.frames.innerHTML = '<div style="color:#5f6c80;font-size:10px">— no active move —</div>';
    }
    if (info.inputs) {
      t.inputs.innerHTML = info.inputs.slice(-14).map((i) => `<i class="${i.hi ? 'hi' : ''}">${i.t}</i>`).join('');
    }
  }

  trainBanner(text, dur = 1.2) {
    this.bannerEl.innerHTML = text;
    this.bannerEl.classList.remove('hidden');
    this.bannerTimer2 = dur;
  }
}
