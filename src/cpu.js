// CPU opponent AI with four difficulty tiers.
import { clamp, sign, rand, randInt, pick, approach } from './utils.js';
import { detectMotion, facingDir } from './input.js';

const LEVELS = [
  { name: 'BEGINNER', label: 'CPU · BEGINNER', react: 26, aggression: 0.32, blockChance: 0.2, antiAir: 0.06, punish: 0.06, comboLen: 1, driveUse: 0.05, jumpiness: 0.1, tech: 0.05, parryChance: 0.02 },
  { name: 'NORMAL', label: 'CPU · NORMAL', react: 17, aggression: 0.52, blockChance: 0.5, antiAir: 0.28, punish: 0.3, comboLen: 2, driveUse: 0.2, jumpiness: 0.2, tech: 0.2, parryChance: 0.08 },
  { name: 'ADVANCED', label: 'CPU · ADVANCED', react: 11, aggression: 0.7, blockChance: 0.74, antiAir: 0.55, punish: 0.62, comboLen: 3, driveUse: 0.42, jumpiness: 0.26, tech: 0.45, parryChance: 0.18 },
  { name: 'EXPERT', label: 'CPU · EXPERT', react: 7, aggression: 0.86, blockChance: 0.9, antiAir: 0.8, punish: 0.88, comboLen: 4, driveUse: 0.66, jumpiness: 0.3, tech: 0.7, parryChance: 0.32 },
];

export class CPU {
  constructor(game, fighter, level = 2) {
    this.game = game;
    this.f = fighter;
    this.level = clamp(level, 0, 3);
    this.cfg = LEVELS[this.level];
    this.enabled = true;
    this.plan = null;
    this.planT = 0;
    this.cooldown = 0;
    this.reactT = 0;
    this.comboQueue = [];
    this.lastOppState = '';
    this.decisionT = 0;
    this.holdDir = 5;
    this.holdButtons = 0;
    this.pressQueue = [];
    this.throwCooldown = 0;
    this.dashCooldown = 0;
    this.levelInput = { dir: 5, buttons: 0, pressed: 0, released: 0 };
    this.oppPrev = { state: '', frame: -99 };
    this.bufferDir = [];
  }

  get label() { return this.cfg.label; }

  update(dt, samples) {
    if (!this.enabled || !this.f || this.f.state === 'ko') return;
    this._ticks = (this._ticks || 0) + 1;
    const f = this.f, opp = f.opponent;
    if (!opp) return;
    const g = this.game;
    if (g.roundState !== 'fight') { this._release(); return; }
    if (f.stun > 0 || f.hitstop > 0 || f.state === 'knockdown' || f.state === 'thrown' || f.state === 'wakeup' || f.cinematic) { this._release(); return; }

    const dist = Math.abs(opp.x - f.x);
    const toward = sign(opp.x - f.x) || 1;
    const localToward = 6; // local space: 6 is always toward the opponent (facing is applied by _setInput)
    const localBack = 4;

    // continuous state machine
    this.decisionT -= dt * 60;

    // reaction: blocking when opponent attacks
    const oppAttacking = opp.currentMove && (opp.movePhase === 'startup' || opp.movePhase === 'active');
    const blocked = opp.currentMove && opp.movePhase === 'active';
    let wantBlock = false;
    if (oppAttacking && dist < 2.6 && (!this.plan || this.plan.type === 'block')) {
      if (this._blockRoll()) wantBlock = true;
      if (this._parryRoll() && this.level >= 2) wantBlock = 'parry';
    }
    // anti-air
    if (opp.air && opp.vy < 2 && dist < 3 && Math.random() < this.cfg.antiAir * 0.4) {
      this._queueSpecial(2); // dp
      return;
    }
    // punish whiffed recovery
    if (opp.currentMove && opp.movePhase === 'recovery' && dist < 2.2 && Math.random() < this.cfg.punish * 0.15) {
      this._doPunish(dist);
      return;
    }

    if (this.plan) {
      this.planT -= dt * 60;
      this._executePlan(dt);
      if (this.planT <= 0) { this.plan = null; this.holdButtons = 0; }
      return;
    }
    if (wantBlock === 'parry' && f.y === 0) {
      this._setInput(facingDir(localBack, f.facing) === 5 ? 4 : localBack, 2 | 16);
      return;
    }
    if (wantBlock) {
      const d = opp.y > 0 ? localBack : (opp.currentMove?.level === 'low' ? localBack : localBack);
      this._setInput(localBack, 0, opp.currentMove?.level === 'low' ? true : false);
      return;
    }

    // neutral decision
    if (this.plan) {
      this.planT -= dt * 60;
      this._executePlan(dt);
      if (this.planT <= 0) { this.plan = null; this.holdButtons = 0; }
      return;
    }

    if (this.decisionT > 0) {
      // drift toward preferred range
      this._idleMovement(dist, localToward, localBack);
      return;
    }
    this.decisionT = this.cfg.react * (0.6 + Math.random() * 0.8);

    const r = Math.random();
    const aggro = this.cfg.aggression;

    // wake-up pressure / oki
    if (opp.state === 'knockdown' && dist < 4) {
      if (Math.random() < 0.6) { this._setPlan('approach', 20); }
      return;
    }
    // if we're in range, attack
    const ATTACK_RANGE = 1.15;
    if (dist < ATTACK_RANGE) {
      if (r < aggro) {
        // combo/poke
        const combo = this._buildCombo(dist);
        this.comboQueue = combo;
        this._setPlan('combo', 30);
      } else if (r < aggro + 0.14 && this.throwCooldown <= 0 && dist < 0.95) {
        this._setPlan('throw', 18);
        this.throwCooldown = 60 + rand(0, 60);
      } else if (r > 0.88) {
        this._setPlan('backdash', 20);
      } else {
        this._setPlan('block', 18);
      }
      return;
    }
    // mid range
    if (dist < 3.4) {
      if (r < aggro * 0.7) {
        if (Math.random() < 0.3 && this.dashCooldown <= 0) this._setPlan('dashin', 22);
        else if (Math.random() < 0.55) this._queueSpecial(randInt(0, 1));
        else this._setPlan('approach', 24);
      } else if (r < aggro * 0.7 + 0.2 && dist > 2.4) {
        // projectile or special
        this._queueSpecial(0);
      } else {
        this._idleMovement(dist, localToward, localBack);
        if (Math.random() < 0.25) this._setPlan('approach', 14);
      }
      if (this.dashCooldown > 0) this.dashCooldown -= dt * 60;
      return;
    }
    // long range
    if (r < 0.42) this._queueSpecial(0); // projectile
    else if (r < 0.58 && this.dashCooldown <= 0) this._setPlan('dashin', 24);
    else if (r < 0.68 && this.level >= 2) this._setPlan('drrush', 20);
    else this._idleMovement(dist, localToward, localBack);

    if (this.throwCooldown > 0) this.throwCooldown -= dt * 60;
    if (this.dashCooldown > 0) this.dashCooldown -= dt * 60;
  }

  _blockRoll() {
    return Math.random() < this.cfg.blockChance * 0.14;
  }
  _parryRoll() {
    return Math.random() < this.cfg.parryChance * 0.1;
  }

  _buildCombo(dist) {
    const q = [];
    const f = this.f;
    const len = this.cfg.comboLen;
    const light = dist < 1.4 ? 'L' : 'M';
    q.push({ type: 'normal', btn: light, crouch: Math.random() < 0.4 });
    if (len >= 2 && Math.random() < 0.7) q.push({ type: 'normal', btn: 'M', crouch: true });
    if (len >= 3 && Math.random() < 0.55) q.push({ type: 'special', idx: Math.random() < 0.5 ? 1 : 0 });
    if (len >= 4 && Math.random() < 0.4) q.push({ type: 'special', idx: 1 });
    if (this.level >= 2 && Math.random() < 0.2 && f.superMeter[0] >= 1) q.push({ type: 'super', meter: 1 });
    return q;
  }

  _doPunish(dist) {
    const f = this.f;
    if (f.superMeter[0] >= 2 && Math.random() < 0.4) { this._queueSuper(2); return; }
    if (dist < 1.9) {
      this.comboQueue = [{ type: 'normal', btn: 'H', crouch: true }, { type: 'special', idx: 1 }];
      this._setPlan('combo', 30);
    } else this._queueSpecial(1);
  }

  _queueSpecial(idx) {
    const f = this.f;
    const sp = f.cfg.specials[idx];
    if (!sp) return;
    if (this.level < 2 && Math.random() < 0.35) return;
    this.plan = { type: 'special', idx, input: sp.input, btn: sp.buttons[0], ft: 0, phase: 0 };
    this.planT = 40;
  }

  _queueSuper(meter) {
    const f = this.f;
    const s = f.cfg.supers.find((x) => x.meter === meter) || f.cfg.supers[0];
    if (!s) return;
    this.plan = { type: 'super', move: s, ft: 0, phase: 0 };
    this.planT = 50;
  }

  _setPlan(type, frames) {
    this.plan = { type, ft: 0, phase: 0 };
    this.planT = frames;
  }

  _idleMovement(dist, localToward, localBack) {
    const f = this.f;
    const want = f.cfg.archetype === 'zoner' ? 3.6 : f.cfg.archetype === 'grappler' ? 1.1 : 1.6;
    if (dist > want + 0.4) this._setInput(localToward, 0);
    else if (dist < want - 0.3) this._setInput(localBack, 0);
    else this._setInput(5, 0);
  }

  _setInput(dir, buttons, lowGuard = false) {
    const f = this.f;
    // dir here is local; convert back to raw pad dir
    const raw = facingDir(dir, f.facing);
    this.lastLocalDir = dir;
    this.levelInput.dir = raw;
    this.levelInput.buttons = buttons;
    // directly drive the fighter using a synthetic sample
    const prev = this._prevInput || { buttons: 0 };
    const pressed = buttons & ~prev.buttons;
    const released = prev.buttons & ~buttons;
    this._prevInput = { dir: raw, buttons };
    this._ticks = (this._ticks || 0) + 1;
    this._lastSample = { dir: raw, buttons, pressed, released, cpu: true };
  }

  _release() {
    if (this._lastSample) this._lastSample = { dir: 5, buttons: 0, pressed: 0, released: 0, cpu: true };
    this._prevInput = { dir: 5, buttons: 0 };
  }

  _executePlan(dt) {
    const f = this.f, opp = f.opponent;
    const dist = Math.abs(opp.x - f.x);
    const toward = sign(opp.x - f.x) || 1;
    const localToward = 6; // local space: 6 is always toward the opponent (facing is applied by _setInput)
    const localBack = 4;
    const p = this.plan;
    p.ft += dt * 60;

    switch (p.type) {
      case 'approach': {
        if (dist > 1.5) this._setInput(localToward, 0);
        else { this.comboQueue = this._buildCombo(dist); this._setPlan('combo', 30); }
        break;
      }
      case 'dashin': {
        if (p.phase === 0) {
          this._setInput(localToward, 0);
          if (p.ft > 4) { this._setInput(5, 0); p.phase = 1; p.ft = 0; }
        } else if (p.phase === 1) {
          this._setInput(5, 0);
          if (p.ft > 2) { this._setInput(localToward, 0); p.phase = 2; p.ft = 0; }
        } else {
          this._setInput(localToward, 0);
          if (p.ft > 8) { this.planT = 0; this.dashCooldown = 50; }
        }
        break;
      }
      case 'block': {
        this._setInput(localBack, 0);
        break;
      }
      case 'backdash': {
        if (p.phase === 0) { this._setInput(localBack, 0); if (p.ft > 4) { this._setInput(5, 0); p.phase = 1; p.ft = 0; } }
        else if (p.phase === 1) { this._setInput(5, 0); if (p.ft > 2) { this._setInput(localBack, 0); p.phase = 2; p.ft = 0; } }
        else { this._setInput(localBack, 0); if (p.ft > 8) this.planT = 0; }
        break;
      }
      case 'throw': {
        if (dist > 1.0) this._setInput(localToward, 0);
        else this._setInput(5, 1 | 8);
        break;
      }
      case 'combo': {
        const item = this.comboQueue[0];
        if (!item) { this.planT = 0; this._setInput(5, 0); break; }
        if (item.type === 'normal') {
          const btnMap = { L: ['LP', 'LK'], M: ['MP', 'MK'], H: ['HP', 'HK'] };
          const options = btnMap[item.btn] || ['LP'];
          const name = options[randInt(0, options.length - 1)];
          const bit = { LP: 1, MP: 2, HP: 4, LK: 8, MK: 16, HK: 32 }[name];
          if (item.crouch) { this._setInput(2, bit); }
          else if (Math.random() < 0.3) this._setInput(localToward, bit);
          else this._setInput(5, bit);
          if (p.ft > 4) { this.comboQueue.shift(); p.ft = 0; }
        } else if (item.type === 'special') {
          this._doSpecialInput(item.idx, p);
        } else if (item.type === 'super') {
          this._doSuperInput(item.meter, p);
        }
        break;
      }
      case 'special': {
        this._doSpecialInput(p.idx, p);
        break;
      }
      case 'super': {
        this._doSuperInput(p.move.meter, p);
        break;
      }
      case 'drrush': {
        // drive rush: forward forward
        this._motion(['6', '5', '6'], p, 0, true);
        break;
      }
      default: this._setInput(5, 0);
    }
  }

  _motion(steps, p, button, tapDash = false) {
    const f = this.f;
    const toward = sign(f.opponent.x - f.x) || 1;
    const localToward = 6; // local space: 6 is always toward the opponent (facing is applied by _setInput)
    const substep = Math.floor(p.ft / 4);
    if (substep < steps.length) {
      let d = steps[substep];
      // convert local dirs
      if (d === '6') this._setInput(localToward, 0);
      else if (d === '4') this._setInput(localToward === 6 ? 4 : 6, 0);
      else if (d === '2') this._setInput(2, 0);
      else if (d === '3') this._setInput(localToward === 6 ? 3 : 1, 0);
      else if (d === '1') this._setInput(localToward === 6 ? 1 : 3, 0);
      else this._setInput(5, 0);
    } else if (button) {
      this._setInput(5, button);
      p.phase = 99;
    } else {
      this.planT = 0;
    }
  }

  _doSpecialInput(idx, p) {
    const f = this.f;
    const sp = f.cfg.specials[idx];
    if (!sp) { this.planT = 0; return; }
    const bit = { LP: 1, MP: 2, HP: 4, LK: 8, MK: 16, HK: 32 }[sp.buttons[0]];
    let seq = {
      qcf: ['2', '3', '6'], qcb: ['2', '1', '4'], dp: ['6', '2', '3'], hcf: ['4', '1', '2', '3', '6'], hcb: ['6', '3', '2', '1', '4'],
      qcfx2: ['2','3','6','2','3','6'], qcbx2: ['2','1','4','2','1','4'],
    }[sp.input] || ['2', '3', '6'];
    // a trailing neutral keeps the final direction in history when the button fires
    seq = [...seq, '5'];
    const si = Math.floor(p.ft / 3);
    if (si < seq.length) {
      const d = seq[si];
      // seq holds LOCAL directions (6 = toward opponent); _setInput does the facing conversion
      this._setInput(parseInt(d, 10), 0);
      this._motionProg = true;
    } else if (p.phase !== 99) {
      this._setInput(5, bit);
      p.phase = 99;
      this.planT = Math.max(this.planT, 3);
    } else {
      this._setInput(5, 0);
      this.planT = Math.min(this.planT, 1);
    }
  }

  _doSuperInput(meter, p) {
    const f = this.f;
    const s = f.cfg.supers.find((x) => x.meter === meter);
    if (!s || f.superMeter[0] < meter) { this.planT = 0; return; }
    const bit = { LP: 1, MP: 2, HP: 4, LK: 8, MK: 16, HK: 32 }[s.buttons[0]];
    const seq = ['2', '3', '6', '2', '3', '6', '5'];
    const si = Math.floor(p.ft / 3);
    if (si < seq.length) {
      this._setInput(parseInt(seq[si], 10), 0);
    } else if (p.phase !== 99) {
      this._setInput(5, bit);
      p.phase = 99;
    } else { this._setInput(5, 0); this.planT = Math.min(this.planT, 1); }
  }

  // The game reads this each frame and injects it as the fighter's input
  getInput() {
    if (!this.enabled) return null;
    if (!this._lastSample) {
      this._lastSample = { dir: 5, buttons: 0, pressed: 0, released: 0, cpu: true };
      this._prevInput = { dir: 5, buttons: 0 };
    }
    const s = this._lastSample;
    // recompute edge detection against the actually-consumed sample
    const prev = this._consumedPrev || { buttons: 0 };
    const out = { dir: s.dir, buttons: s.buttons, pressed: s.buttons & ~prev.buttons, released: prev.buttons & ~s.buttons, cpu: true };
    this._consumedPrev = { buttons: s.buttons, dir: s.dir };
    return out;
  }
}

export { LEVELS };
