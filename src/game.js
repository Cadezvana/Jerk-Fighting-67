// Game engine: match orchestration, collision, damage, rounds, modes.
import * as THREE from 'three';
import { Fighter, FPS, ROUND_TIME } from './fighter.js';
import { FightCamera } from './camera.js';
import { FX } from './effects.js';
import { Stage, STAGE_DEFS } from './stages.js';
import { HUD } from './hud.js';
import { characterById, CHARACTERS } from './characters.js';
import { clamp, lerp, damp, sign, rand, easeOutCubic } from './utils.js';
import { CPU } from './cpu.js';
import { getPose, mixPose } from './poses.js';

const STAGE_HALF = 8.4;
const GRAVITY = 24;

export class Game {
  constructor(app) {
    this.app = app;
    this.renderer = app.renderer;
    this.scene = app.scene;
    this.audio = app.audio;
    this.input = app.input;
    this.canvas = app.canvas;
    this.camera = new FightCamera(window.innerWidth / window.innerHeight);
    this.hud = new HUD(this);
    this.fx = new FX(this);
    this.fighters = [null, null];
    this.stage = null;
    this.frame = 0;
    this.freezeTimer = 0;
    this.frozen = false;
    this.paused = false;
    this.currentMode = 'arcade';
    this.options = app.options;
    this.training = { active: false };
    this.accumulator = 0;
    this.step = 1 / FPS;
    this.roundState = 'none';
    this.roundTimer = ROUND_TIME * FPS;
    this.roundNum = 1;
    this.roundWins = [0, 0];
    this.matchOver = false;
    this.cpu = [];
    this.hitstop = 0;
    this.slowmo = 0;
    this.superCine = null;
    this.listeners = {};
    this.stats = [
      { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, parries: 0, drives: 0 },
      { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, parries: 0, drives: 0 },
    ];
    this.projectiles = [];
    this.beams = [];
    this.trainingState = {
      unlimited: true, dummyMode: 'stand', recState: 'idle', recording: [], playback: null,
      display: true, resetPositions: true, hitDisplay: 0, lastMove: null,
    };
    this._buildDriveMoves();
    this.hitSparkCooldown = 0;
    this.matchWinner = null;
    this.onFrameEnd = null;
  }

  _buildDriveMoves() {
    this.driveImpactMove = {
      name: 'Drive Impact', type: 'driveImpact', startup: 24, active: 6, recovery: 32, damage: 1100,
      hitstun: 30, blockstun: 22, hitstop: 14, chip: 0.2, knockdown: 'hard',
      hitbox: { bone: 'handA', offset: [0, 0.02, 0.2], size: [0.9, 0.9, 0.85], reach: 1.2 },
      motion: { type: 'lunge', speed: 12, frames: 26 }, level: 'mid', cancel: {}, priority: 99,
      armor: true, wallBounce: true, anim: 'rush', sfx: 'punch', kind: 'punch',
    };
    this.driveImpactMove._anim = null;
    this.throwMove = { name: 'Throw', type: 'throw', startup: 3, active: 4, recovery: 20, damage: 1250, cancel: {}, level: 'unblockable' };
  }

  // ============ SETUP ============
  startMatch(config) {
    const { p1Char, p2Char, stageId, mode, cpuLevel, cpuChar, survivalRound = 1, arcadeStage = 0 } = config;
    this.config = config;
    this.currentMode = mode;
    this.survivalRound = survivalRound;
    this.arcadeStage = arcadeStage;
    this.clearingScene();

    // stage
    const stageDef = STAGE_DEFS.find((s) => s.id === stageId) || STAGE_DEFS[0];
    this.stage = new Stage(this.scene, stageDef, this.renderer);

    // fighters
    const c1 = characterById(p1Char);
    const c2 = characterById(p2Char);
    this.f1 = new Fighter(this, c1, 0, 0);
    this.f2 = new Fighter(this, c2, 1, 1);
    this.fighters = [this.f1, this.f2];
    this.f1.opponentIdx = 1; this.f2.opponentIdx = 0;
    this.hud.setNames(c1.name, c2.name);
    this.hud.show();
    this.hud.setPips(0, 0);
    this.training.active = mode === 'training';
    this.hud.showTraining(mode === 'training');
    this.trainingUnlimited = mode === 'training' && this.trainingState.unlimited;
    this.trainingState.dummyMode = this.options.trainingDummy || 'stand';
    this.training.inputLog = [];
    this.training.sessionDamage = 0;
    this.training.sessionHits = 0;
    this.training.lastDamage = 0;
    this.training.lastHits = 0;
    this.training.bestCombo = 0;
    this.training.lastMoveInfo = null;

    // CPU
    this.cpu = [];
    if (mode === 'versus' || mode === 'arcade' || mode === 'survival') {
      const lvl = mode === 'survival' ? Math.min(4, 1 + Math.floor(survivalRound / 2)) : cpuLevel;
      this.cpu[1] = new CPU(this, this.f2, lvl);
      this.cpu[0] = null;
      this.hud.el.p2.name.textContent = this.cpu[1].label;
    } else if (mode === 'training') {
      this.cpu[1] = new CPU(this, this.f2, 0);
      this.cpu[1].enabled = false;
      this.cpu[0] = null;
    }

    if (this.hud) this.hud.trainingLabel = mode === 'training' ? 'TRAINING' : null;

    this.roundWins = [0, 0];
    this.roundNum = 1;
    this.matchOver = false;
    this.matchWinner = null;
    this.stats = [
      { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, parries: 0, drives: 0 },
      { damage: 0, maxCombo: 0, hits: 0, supers: 0, drives: 0 },
    ];
    this.stats = [
      { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, parries: 0, drives: 0 },
      { damage: 0, maxCombo: 0, hits: 0, specials: 0, supers: 0, parries: 0, drives: 0 },
    ];
    this.projectiles = [];
    for (const p of this.fx.projectiles) this.scene.remove(p.mesh);
    this.fx.projectiles.length = 0;
    this.beams = [];
    this.config = config;
    this.beginRound(true);
    this.audio.startMusic('fight', 132);
    this.audio.setMusicMode('fight', 132);
    this.app.showGameView();
  }

  clearingScene() {
    if (this.f1) { this.f1.dispose(); this.f1 = null; }
    if (this.f2) { this.f2.dispose(); this.f2 = null; }
    this.fighters = [null, null];
    if (this.stage) { this.stage.dispose(); this.stage = null; }
    this.cpu = [];
    if (!this._baseLights) this._createBaseLights();
  }

  _createBaseLights() {
    this._baseLights = true;
  }

  // ============ ROUND FLOW ============
  beginRound(first = false) {
    this.roundState = 'intro';
    this.roundTimer = ROUND_TIME * FPS;
    this.introTimer = 0;
    this.hitstop = 0;
    this.slowmo = 0;
    this.frozen = true;
    this.superCine = null;
    this.camera.endCine();
    this.projectiles = [];
    for (const p of this.fx.projectiles) this.scene.remove(p.mesh);
    this.fx.projectiles.length = 0;
    this.f1.resetForRound(0, false);
    this.f2.resetForRound(1, false);
    this.f1.setFacingVisual(1);
    this.f2.setFacingVisual(-1);
    this.f1.state = 'intro'; this.f2.state = 'intro';
    this.hud.resetForRound();
    this.hud.setRound(this.roundNum, 0);
    this.hud.setPips(this.roundWins[0], this.roundWins[1]);
    this.input.clearHistory();
    if (this.currentMode === 'training') {
      this.roundState = 'fight';
      this.frozen = false;
      this.hud.clearAnnounce();
      this.hud.trainingLabel = 'TRAINING';
      this.hud.setRound(1, 0);
      this.trainingState.hitDisplay = 0;
      this.training.sessionDamage = 0;
      this.training.sessionHits = 0;
      this.hud.trainBanner('<em>TRAINING</em> — F1 panel · F5 reset · F6 infinite health');
      return;
    }
    this.hud.announce('ROUND ' + this.roundNum, this.roundNum === 3 ? 'FINAL ROUND' : '', 1.3);
    this.audio.announce('round');
    this.camera.startIntroCamera(this.f1, this.f2);
    this.f1.forcePose = 'intro';
    this.f2.forcePose = 'intro';
    this.introT = 0;
  }

  startFight() {
    this.roundState = 'fight';
    this.frozen = false;
    this.hud.announce('FIGHT', '', 0.85);
    this.audio.announce('fight');
    this.f1.state = 'idle'; this.f2.state = 'idle';
    this.f1.forcePose = null; this.f2.forcePose = null;
    this.f1.invuln = 2; this.f2.invuln = 2;
  }

  // ============ MAIN UPDATE ============
  update(rdt) {
    if (this.paused) return;
    const dt = Math.min(rdt, 0.25);
    // intro handling
    if (this.roundState === 'intro') {
      this.introT += dt;
      this.f1.stateFrame += dt * FPS; this.f2.stateFrame += dt * FPS;
      this.f1.animT += dt; this.f2.animT += dt;
      // intro poses
      const t = this.introT;
      const p1p = mixPose(getPose('stance'), getPose('introFlex'), clamp((t - 0.35) / 0.6, 0, 1));
      const p2p = mixPose(getPose('stance'), getPose('intro'), clamp((t - 0.35) / 0.6, 0, 1));
      this.f1.rig.setPose(p1p, 0.2);
      this.f2.rig.setPose(p2p, 0.2);
      this.f1.rig.update(dt); this.f2.rig.update(dt);
      this.f1._syncTransform(0); this.f2._syncTransform(0);
      this.f1.aura.group.position.set(this.f1.x, 0.02, this.f1.z);
      this.f2.aura.group.position.set(this.f2.x, 0.02, this.f2.z);
      this.camera.update(dt, this.f1, this.f2, FPS);
      this.fx.update(dt);
      this.stage.update(dt, performance.now() * 0.001);
      this.hud.update(dt, this.f1, this.f2, this.roundTimer / FPS, this.currentMode);
      if (this.introT > 2.3) this.startFight();
      return;
    }
    if (this.roundState === 'ko' || this.roundState === 'roundEnd' || this.roundState === 'matchEnd') {
      this._updateRoundEnd(dt);
      return;
    }

    // -------- fixed step simulation --------
    let acc = dt + (this._residual || 0);
    const maxSteps = 20;
    let steps = Math.floor(acc / this.step);
    if (steps > maxSteps) { steps = maxSteps; acc = 0; this._residual = 0; } // drop backlog, stay responsive
    else this._residual = acc - steps * this.step;
    for (let i = 0; i < steps; i++) this.simulate(this.step);

    // -------- visuals --------
    this.updateVisuals(dt);
    this.hud.update(dt, this.f1, this.f2, this.roundTimer / FPS, this.currentMode);
    if (this.currentMode === 'training') this._updateTrainingPanel();
  }

  simulate(dt) {
    if (this.frozen) return;
    this.frame++;
    // global hitstop
    if (this.hitstop > 0) {
      this.hitstop -= dt * FPS;
      this.f1.update(dt); this.f2.update(dt); // they have their own hitstop, but still tick visuals
      this._tickProjectiles(dt, true);
      return;
    }
    if (this.f1.hitstop > 0 || this.f2.hitstop > 0) {
      // freeze both for a few frames
    }

    // inputs
    const samples = this.input.sampleFrame();
    this._logInputs(samples);

    // CPU decides first, then its synthetic input is fed to its fighter
    for (const c of this.cpu) if (c && c.enabled && this.roundState === 'fight' && !this.frozen) c.update(dt, samples);

    // player input
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i];
      if (!f) continue;
      let s = samples[i];
      if (this.cpu[i] && this.cpu[i].enabled) {
        const cs = this.cpu[i].getInput();
        if (cs) { s = cs; this.input.samples[i === 0 ? 'p1' : 'p2'] = cs; }
      }
      f.lastSample = s;
      if (this.currentMode === 'training' && i === 1 && this.cpu[1] && !this.cpu[1].enabled) {
        this._dummyUpdate(f, s, dt);
        continue;
      }
      f.handleInput(s, dt);
    }

    // physics & state
    for (const f of this.fighters) if (f) f.update(dt);

    // projectiles
    this._tickProjectiles(dt);

    // collision resolution handled in fighters during update; also do throws
    this._resolveThrows();

    // facing update at end of frame
    for (const f of this.fighters) {
      if (!f) continue;
      if (f.opponent) {
        const toward = sign(f.opponent.x - f.x);
        if (!f.currentMove && f.stun <= 0 && !f.air && f.state !== 'knockdown' && f.state !== 'dash' && f.state !== 'thrown' && Math.abs(f.opponent.x - f.x) > 0.12) {
          f.facing = toward;
        }
      }
    }

    // KO checks
    for (const f of this.fighters) {
      if (!f) continue;
      if (f.health <= 0 && this.currentMode !== 'training') {
        if (this.roundState === 'fight') this.checkKO(f);
      }
    }
    // timer
    if (this.roundState === 'fight') {
      this.roundTimer -= dt * FPS;
      if (this.roundTimer <= 0) { this.roundTimer = 0; this._timeUp(); }
    }

    // training health clamp
    if (this.currentMode === 'training' && this.trainingState.unlimited) {
      for (const f of this.fighters) if (f) f.health = Math.max(f.health, 1);
    }
  }

  _handleMenuKeys() {
    // handled by main loop for pause
  }

  _logInputs(samples) {
    if (this.currentMode !== 'training' || !samples) return;
    const dirSym = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '·', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
    const btnSym = { 1: 'LP', 2: 'MP', 4: 'HP', 8: 'LK', 16: 'MK', 32: 'HK' };
    for (let i = 0; i < 2; i++) {
      const s = samples[i];
      if (!s) continue;
      if (!this.training.inputLog) this.training.inputLog = [];
      const key = i + ':' + s.dir + ':' + s.buttons;
      if (this.training.inputLog._last === key) continue;
      this.training.inputLog._last = key;
      if (s.pressed || (this.training.inputLog._lastDir !== s.dir && s.dir !== 5)) {
        let txt = dirSym[s.dir] || '·';
        for (const b in btnSym) if (s.pressed & Number(b)) txt += btnSym[b][0] + btnSym[b][1].toLowerCase();
        this.training.inputLog.push({ t: txt, hi: !!s.pressed, p: i });
        if (this.training.inputLog.length > 100) this.training.inputLog.shift();
      }
      this.training.inputLog._lastDir = s.dir;
    }
  }

  _updateTrainingPanel() {
    if (!this.training || !this.f1) return;
    const f = this.f1;
    let frames = null;
    const mv = f.currentMove;
    if (mv && mv.hitbox) {
      const onHit = mv.hitstun - mv.recovery;
      const onBlock = mv.blockstun - mv.recovery;
      frames = { startup: mv.startup, active: mv.active, recovery: mv.recovery, onHit, onBlock, advLabel: onBlock >= 0 ? 'SAFE' : onBlock <= -6 ? 'PUNISHABLE' : 'SLIGHT' };
      this.training.lastMoveInfo = frames;
    } else if (this.training.lastMoveInfo) {
      frames = this.training.lastMoveInfo;
    }
    const lastDmg = this.training.lastDamage || 0;
    const info = {
      mode: this.trainingState.dummyMode.toUpperCase(),
      dummy: this.trainingState.dummyMode.toUpperCase() + (this.cpu[1]?.enabled ? '' : ''),
      damage: this.training.sessionDamage,
      hits: this.training.lastHits,
      scaling: this.training.lastScaling ?? 1,
      frames,
      inputs: (this.training.inputLog || []).filter((x) => x.p === 0),
    };
    this.hud.updateTraining(info);
  }

  _dummyUpdate(f, sample, dt) {
    if (this.trainingState.playback && this.trainingState.playback.length) {
      const pb = this.trainingState.playback;
      const idx = (this.frame - this.trainingState.playbackStart) % pb.length;
      const s = pb[idx % pb.length];
      const prev = this._pbPrev || { buttons: 0, dir: 5 };
      const pressed = s ? (s.buttons & ~prev.buttons) : 0;
      if (s) f.handleInput({ dir: s.dir, buttons: s.buttons, pressed, released: prev.buttons & ~s.buttons }, dt);
      if (s) this._pbPrev = { buttons: s.buttons, dir: s.dir };
      return;
    }
    const mode = this.trainingState.dummyMode;
    if (mode === 'crouch') { f.handleInput({ dir: 2, buttons: 0, pressed: 0, released: 0 }, dt); }
    else if (mode === 'jump') {
      if (!f.air && f.stun <= 0 && f.state !== 'jump') f.handleInput({ dir: 8, buttons: 0, pressed: 0, released: 0 }, dt);
    } else if (mode === 'block') {
      // hold back relative to attacker
      const toward = sign(f.opponent.x - f.x);
      const backDir = toward > 0 ? 4 : 6;
      f.handleInput({ dir: backDir, buttons: 0, pressed: 0, released: 0 }, dt);
    } else if (mode === 'cpu') {
      if (this.cpu[1]) { this.cpu[1].enabled = true; this.cpu[1].update(dt, [sample, sample]); const cs = this.cpu[1].getInput(); if (cs) f.handleInput(cs, dt); }
    } else if (mode === 'record') {
      this._recordDummyFrame(sample);
    } else {
      f.handleInput({ dir: 5, buttons: 0, pressed: 0, released: 0 }, dt);
    }
    if (mode !== 'cpu') this.cpu[1].enabled = false;
  }

  _recordDummyFrame(sample) {
    if (!this.trainingState.recording) this.trainingState.recording = [];
    this.trainingState.recording.push({ dir: sample.dir, buttons: sample.buttons });
    if (this.trainingState.recording.length > 240) this.trainingState.recording.shift();
  }

  // ============ COLLISION ============
  hurtboxes(f) {
    const h = f.y;
    const crouch = f.crouching || f.state === 'crouch' || (f.currentMove && f.currentMove.crouch);
    const knock = f.state === 'knockdown';
    const top = knock ? 0.5 : crouch ? 1.05 : 1.78 * (f.cfg.body.height || 1);
    const w = knock ? 1.1 : crouch ? 0.5 : 0.44 * (f.cfg.body.bulk || 1);
    return [
      { x: f.x, y: h + (knock ? 0.22 : top * 0.52), z: f.z, hw: w * 0.5, hh: top * 0.5, hd: 0.32, isHurt: true },
    ];
  }

  resolveAttack(attacker, mv, dt) {
    if (attacker.hitStopThisMove) { /* not needed */ }
    const targets = [attacker.opponent];
    // resolve hitbox from bone
    const box = this._worldHitbox(attacker, mv);
    if (!box) return;
    for (const t of targets) {
      if (!t) continue;
      if (mv.type === 'throw' || mv.commandGrab) continue;
      if (attacker.hitTargets.has(t.id)) continue;
      if (t.health <= 0) continue;
      const hit = this._overlaps(box, t);
      if (!hit) continue;
      attacker.hitTargets.add(t.id);
      attacker.hitCount++;
      this.applyHit(attacker, t, mv, { fromProjectile: false });
    }
  }

  _worldHitbox(f, mv) {
    const hb = mv.hitbox;
    if (!hb) return null;
    // Hitboxes are evaluated in fighter-local stage space: just in front of the
    // fighter at a height appropriate to the attack level. This keeps hit
    // detection deterministic and readable (the skeleton only drives visuals).
    let reach = hb.reach ?? 0.6;
    let hy = 1.05;
    let thickness = 0.45;
    if (hb.bone === 'handA' || hb.bone === 'handB') {
      hy = 1.05 + (hb.offset?.[1] ?? 0) + (mv.level === 'high' ? 0.32 : 0);
      if (hb.size) thickness = hb.size[1];
    } else if (hb.bone === 'footA' || hb.bone === 'footB') {
      hy = 0.95 + (hb.offset?.[1] ?? 0);
      if (mv.crouch) hy = 0.42;
      if (mv.sweep) hy = 0.26;
      if (hb.size) thickness = hb.size[1];
    }
    if (mv.crouch && (hb.bone === 'handA' || hb.bone === 'handB')) hy = 0.82;
    if (mv.air) hy = f.y + 0.55;
    else if (f.y > 0.3) hy = f.y + 0.6;
    const size = hb.size || [0.4, 0.4, 0.4];
    return {
      cx: f.x + f.facing * reach,
      cy: hy,
      cz: f.z,
      hw: size[0] / 2,
      hh: Math.max(size[1] / 2, 0.16),
      hd: Math.max(size[2] / 2, 0.24),
    };
  }

  _overlaps(box, f) {
    for (const hb of this.hurtboxes(f)) {
      if (Math.abs(box.cx - hb.x) < box.hw + hb.hw &&
        Math.abs(box.cy - hb.y) < box.hh + hb.hh &&
        Math.abs(box.cz - hb.z) < box.hd + hb.hd) return true;
    }
    return false;
  }

  // ============ DAMAGE / HIT RESOLUTION ============
  applyHit(attacker, defender, mv, opts = {}) {
    const fromProjectile = opts.fromProjectile;
    const projDir = opts.dir ?? attacker.facing;

    // invuln
    if (defender.invuln > 0 || defender.state === 'knockdown' || defender.state === 'thrown') {
      if (defender.state === 'knockdown' && !fromProjectile) {
        // can't hit downed (unless hard knockdown OTG disallowed)
      }
      return false;
    }

    // parry check
    if (defender.state === 'parry' && !fromProjectile && mv.level !== 'unblockable') {
      this._resolveParry(attacker, defender, mv);
      return true;
    }
    if (defender.parryPerfect > 0 && defender.state === 'parry') {
      this._resolveParry(attacker, defender, mv);
      return true;
    }

    // counter hit check (attacker hitting during defender's startup before active)
    let counter = false;
    if (!fromProjectile && defender.currentMove && defender.movePhase === 'startup' && mv.type !== 'throw') counter = true;
    if (defender.state === 'throwStart' && !fromProjectile) counter = true;

    // throw invulnerability / strike invul
    if (mv.type === 'throw') { if (defender.state !== 'idle' && defender.state !== 'walkF' && defender.state !== 'walkB' && defender.state !== 'crouch') return false; }

    // blocking
    const facingHit = sign(attacker.x - defender.x) === defender.facing || fromProjectile;
    const holdingBack = this._isHoldingBack(defender);
    let blocked = false;
    if (mv.level !== 'unblockable' && facingHit) {
      const highHit = (mv.level === 'high');
      const lowHit = (mv.level === 'low');
      if (defender.state === 'block' || defender.blocking || defender.blockstun > 0) {
        if (lowHit && !defender.crouching && defender.state === 'block' && !defender.blockingLow) blocked = false;
        else if (highHit && defender.crouching && (defender.state === 'block')) blocked = false;
        else blocked = true;
      } else if (holdingBack && !defender.air && defender.drive > 0.001 && defender.stun <= 0 && !defender.currentMove) {
        blocked = true;
        defender.state = 'block';
        defender.stateFrame = 0;
      }
    }
    if (defender.air) blocked = false;
    if (defender.state === 'dizzy' || defender.state === 'knockdown' || defender.state === 'wakeup') blocked = false;

    // combo scaling
    const scaleTable = [1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.45, 0.4, 0.35, 0.3, 0.28, 0.26, 0.24, 0.22, 0.2];
    let scale = 1;
    if (!blocked && defender.comboHits > 0) {
      scale = scaleTable[Math.min(scaleTable.length - 1, defender.comboHits)] || 0.2;
      if (defender.comboHits > 6) scale = Math.max(0.18, scale - (defender.comboHits - 6) * 0.012);
    }
    if (mv.type === 'super') scale = Math.max(scale, 0.55);
    // counter bonus
    if (counter) scale *= 1.25;
    if (defender.state === 'dizzy') scale *= 1.4;
    // juggle scaling
    if (defender.y > 0 && defender.comboHits > 0) scale *= 0.9;

    const baseDamage = mv.damage || 0;
    let damage = baseDamage * scale;
    if (blocked) damage = baseDamage * (mv.chip ?? 0.12) * (fromProjectile ? 1 : 1);

    // drive damage
    if (blocked) {
      defender.addDrive(-(0.22 + baseDamage / 9000));
    } else {
      defender.addDrive(-(0.10 + baseDamage / 22000));
      attacker.addDrive(baseDamage / 9000);
    }

    // apply
    const wasDizzy = defender.dizzyMeter;
    if (!blocked) {
      defender.health -= damage;
      if (this.currentMode === 'training' && this.trainingState.unlimited && defender.playerIndex === 1) {
        // keep alive
      }
      defender.lastDamageTaken = damage;
      defender.dizzyMeter = Math.min(100, defender.dizzyMeter + baseDamage / 220);
      this.stats[attacker.playerIndex].damage += Math.round(damage);
      this.stats[attacker.playerIndex].hits++;
      if (mv.type === 'special') this.stats[attacker.playerIndex].specials++;
      if (mv.type === 'super') this.stats[attacker.playerIndex].supers++;
      if (defender.comboHits === 0) defender.comboDamage = 0;
      defender.comboHits++;
      defender.comboDamage += damage;
      defender.receivedHits++;
      this.stats[attacker.playerIndex].maxCombo = Math.max(this.stats[attacker.playerIndex].maxCombo, defender.comboHits);
      if (this.currentMode === 'training') {
        this.training.sessionDamage += Math.round(damage);
        this.training.lastDamage = Math.round(damage);
        this.training.lastHits = defender.comboHits;
        this.training.lastScaling = scale;
        this.training.sessionHits = defender.comboHits;
      }
      this.hud.combo(attacker.playerIndex, defender.comboHits, Math.round(defender.comboDamage));
      this.hud.hideCombo(defender.playerIndex);
    } else {
      defender.blockedHits++;
      defender.health -= damage;
      attacker.hitCount = attacker.hitCount;
      defender.lastBlockedFrame = this.frame;
    }

    // super meter gain
    if (!blocked) {
      attacker.superMeter[0] = clamp(attacker.superMeter[0] + baseDamage / 3200, 0, 3);
      defender.superMeter[0] = clamp(defender.superMeter[0] + baseDamage / 7200, 0, 3);
    } else {
      attacker.superMeter[0] = clamp(attacker.superMeter[0] + baseDamage / 9000, 0, 3);
      defender.superMeter[0] = clamp(defender.superMeter[0] + baseDamage / 16000, 0, 3);
    }

    // hitstop
    const hitstopFrames = blocked ? Math.max(3, (mv.hitstop || 6) * 0.6) : (mv.hitstop || 6) * (mv.type === 'super' ? 1.2 : 1);
    attacker.hitstop = Math.max(attacker.hitstop, hitstopFrames);
    defender.hitstop = Math.max(defender.hitstop, hitstopFrames);
    this.hitstop = 0; // per-fighter hitstop

    // knockback / reaction
    const dir = sign(defender.x - attacker.x) || projDir;
    const push = mv.push ?? 0.06;
    if (blocked) {
      defender.vx = dir * 2.2 * (1 + push * 4);
      defender.blockstun = mv.blockstun || 12;
      defender.stun = Math.max(defender.stun, defender.blockstun);
      defender.state = 'block';
      defender.stateFrame = 0;
      this.fx.blockSpark(defender.x - dir * 0.3, defender.y + 1.0, defender.z, 0x9fd8ff, 8);
      this.audio.block();
      attacker.push = 0;
      attacker.vx = -dir * 0.6;
    } else {
      // determine reaction type
      let reaction = 'hitMid';
      if (mv.level === 'low' || mv.sweep) reaction = 'hitLow';
      if (mv.knockdown === 'hard' || mv.wallBounce) reaction = 'hard';
      // dizzy state build
      if (defender.dizzyMeter >= 100 && defender.state !== 'dizzy') {
        this._startDizzy(defender);
        this.hud.banner('STUN', '');
        this.audio.counter();
      }
      defender.stun = Math.max(defender.stun, mv.hitstun || 16);
      defender.state = 'hit';
      defender.stateFrame = 0;
      defender.hitPoseName = reaction;
      defender.currentMove = null; // interrupt
      defender._chainUsed = false;
      defender.cancelWindow = 0;
      defender.hitWasAir = defender.air;
      if (defender.y > 0) {
        defender.hitstunAir = true;
      }
      // launch / knockdown
      if (mv.launcher || (defender.air && !blocked)) {
        defender.vy = mv.launcher ? mv.launcher : Math.max(4, defender.vy);
        defender.air = true;
        defender.y = Math.max(defender.y, 0.02);
        defender.juggle++;
      } else if (mv.knockdown === 'hard') {
        if (mv.wallBounce) { defender.wallBouncePending = true; }
        if (defender.y > 0) { defender.vy = 4; }
        else {
          defender._pendingKnockdown = true;
          if (mv.type === 'super' || mv.wallBounce) { /* immediate */ }
        }
      } else if (mv.knockdown === 'soft') {
        if (defender.y > 0) defender.vy = Math.min(defender.vy, 3);
      }
      defender.vx = dir * (mv.type === 'super' ? 3 : 1) * (1.2 + push * 14) * (defender.air ? 0.6 : 1);
      if (mv.knockdown === 'hard' && !defender.air) {
        defender.y = Math.max(defender.y, 0.01);
        defender.air = true;
        defender.vy = 7.5;
        defender.vx = dir * 4.2;
      }

      // FX
      const hx = defender.x - dir * 0.22;
      const hy = defender.y + (mv.hitbox ? 1.05 : 1.0) + rand(-0.15, 0.15);
      const power = clamp((mv.damage || 300) / 700, 0.5, 2.2);
      this.fx.hitSpark(hx, hy, defender.z, counter ? 0xff4b6e : 0xffdd66, Math.round(8 + power * 8), power);
      this.audio.hit(power, mv.kind === 'kick' ? 'kick' : 'flesh', false, dir * 0.2);
      if (counter) {
        this.fx.flashScreen(0xff4b6e, 0.2);
        this.audio.counter();
        this.hud.trainBanner('<em>COUNTER HIT</em>', 0.9);
        attacker.punishCounter = 12;
      }
      this.camera.shake(0.14 + power * 0.26, 0.18 + power * 0.1);
      this.camera.punchIn(0.18 + power * 0.22);
      defender.rig.flash(0xffffff, 0.55);
      if (mv.type === 'super') {
        this.camera.shake(0.6, 0.5);
        this.fx.flashScreen(0xffcc66, 0.35);
        this.audio.superHit(mv.meter || 1);
        this.slowmo = Math.max(this.slowmo, 0.18);
      }
    }

    // punish counter detection for training
    if (!blocked && counter) { attacker.lastCounterFrame = this.frame; }

    // check KO
    if (defender.health <= 0 && this.currentMode !== 'training') {
      this.checkKO(defender);
    }
    return true;
  }

  _isHoldingBack(f) {
    const s = f.lastSample || this.input.getSample(f.playerIndex);
    if (!s) return false;
    const opp = f.opponent;
    const towardOpp = opp ? sign(opp.x - f.x) : 1;
    const rawDir = s.dir;
    if (towardOpp > 0) return rawDir === 4 || rawDir === 1 || rawDir === 7;
    return rawDir === 6 || rawDir === 3 || rawDir === 9;
  }

  _resolveParry(attacker, defender, mv) {
    const perfect = defender.parryPerfect > 0;
    defender.parryPerfect = 0;
    this.fx.parryFlash(defender);
    this.audio.parry();
    defender.addDrive(perfect ? 0.9 : 0.35);
    attacker.hitstop = Math.max(attacker.hitstop, 12);
    defender.hitstop = Math.max(defender.hitstop, perfect ? 18 : 10);
    this.camera.punchIn(0.3);
    this.camera.shake(0.25, 0.22);
    if (perfect) {
      this.slowmo = Math.max(this.slowmo, 0.4);
      this.fx.flashScreen(0xaaffff, 0.35);
      this.hud.trainBanner('<em>PERFECT PARRY</em>', 1.0);
      // punish window: attacker is now vulnerable (frame advantage)
      attacker.stun = Math.max(attacker.stun, 22);
      attacker.state = 'stagger';
      attacker.stateFrame = 0;
      attacker.currentMove = null;
      attacker.vx = 0;
    } else {
      defender.parry = 0;
      defender.state = 'parry';
      attacker.vx = -sign(attacker.x - defender.x) * 2;
    }
    if (this.currentMode === 'training') this.hud.trainBanner('<em>' + (perfect ? 'PERFECT PARRY' : 'PARRY') + '</em>', 0.9);
  }

  _startDizzy(f) {
    f.state = 'dizzy';
    f.stateFrame = 0;
    f.stun = 150;
    f.dizzyMeter = 0;
    f.currentMove = null;
    f.vx = 0;
    this.fx.hitSpark(f.x, f.y + 1.7, f.z, 0xffee66, 16, 1.4);
  }

  // ============ THROWS ============
  _resolveThrows() {
    for (const f of this.fighters) {
      if (!f || f.state !== 'throwStart') continue;
      if (f.throwFrame > 4 || f._throwChecked) continue;
      f._throwChecked = true;
      const opp = f.opponent;
      const dist = Math.abs(opp.x - f.x);
      const canGrab = dist < 1.15 * ((f.cfg.body.bulk + opp.cfg.body.bulk) / 2) &&
        Math.abs(opp.z - f.z) < 0.6 && opp.y < 0.35 &&
        opp.invuln <= 0 && opp.state !== 'thrown' && opp.state !== 'knockdown' && opp.state !== 'dizzy' &&
        (opp.state === 'idle' || opp.state === 'walkF' || opp.state === 'walkB' || opp.state === 'crouch' || opp.state === 'block' || opp.state === 'land');
      if (canGrab) {
        const toward = sign(opp.x - f.x);
        f.facing = toward || f.facing;
        opp.state = 'thrown';
        opp.stateFrame = 0;
        opp.stun = 60;
        opp.currentMove = null;
        opp.vx = 0; opp.vy = 0;
        opp.invuln = 0;
        f._thrownOpp = opp;
        f._throwDamage = f.cfg.throws[0].damage;
        this.fx.hitSpark(opp.x, 1.1, opp.z, 0xffeeaa, 10, 1.0);
        this.audio.throwHit();
        this.camera.shake(0.2, 0.18);
        this.stats[f.playerIndex].hits++;
        // throw damage applied at end via _throwUpdate
        opp._throwTaken = true;
      }
    }
    // reset throw checked when throw ends
    for (const f of this.fighters) if (f && f.state !== 'throwStart') f._throwChecked = false;
  }

  resolveCommandGrab(attacker, mv) {
    if (this.frame - (attacker._grabFrame || -99) < 6) return;
    const opp = attacker.opponent;
    if (!opp || opp.state === 'thrown' || opp.state === 'knockdown' || opp.invuln > 0) return;
    if (opp.y > 0.5) return;
    const dist = Math.abs(opp.x - attacker.x);
    if (dist > (mv.grabRange || 1.0)) return;
    if (Math.abs(opp.z - attacker.z) > 0.7) return;
    attacker._grabFrame = this.frame;
    // connected command grab
    attacker.hitTargets = attacker.hitTargets || new Set();
    opp.state = 'thrown';
    opp.stateFrame = 0;
    opp.stun = 70;
    attacker._thrownOpp = opp;
    attacker._throwDamage = mv.damage;
    attacker.state = 'throwStart';
    attacker.throwFrame = 4;
    attacker.currentMove = null;
    attacker._specialGrab = true;
    this.fx.hitSpark(opp.x, 1.0, opp.z, 0xff66aa, 14, 1.2);
    this.audio.throwHit();
    this.camera.shake(0.3, 0.25);
    this.fx.flashScreen(0xff88aa, 0.14);
  }

  // ============ PROJECTILES ============
  spawnProjectile(owner, def, count = 1) {
    const mesh = this.fx.spawnProjectileMesh(def, def.color);
    const startX = owner.x + owner.facing * 0.55;
    const startY = owner.y + (def.y ?? 1.05);
    const vert = def.arc ? 1.6 : 0;
    mesh.position.set(startX, startY, owner.z);
    const proj = {
      owner, def, mesh, x: startX, y: startY, z: owner.z,
      vx: owner.facing * (def.vx || 6) * (def.type === 'shockwave' ? 1 : 1),
      vy: vert, life: def.life || 1.4, hits: def.hits || 1, hitCount: 0, radius: def.radius || 0.28,
      color: def.color, dir: owner.facing, type: def.type, dead: false, party: owner.playerIndex,
      pierce: def.pierce, hitCooldown: 0,
    };
    if (def.type === 'shockwave') { mesh.position.y = 0.18; proj.y = 0; proj.vy = 0; }
    if (def.arc) proj.vy = 3.4;
    this.fx.projectiles.push(proj);
    this.audio.tone?.({ freq: 420, type: 'sawtooth', dur: 0.18, vol: 0.14, slide: 220 });
    this.audio.whoosh(0.6);
  }

  spawnBeam(owner, def) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const geo = new THREE.CylinderGeometry(def.width / 2, def.width / 2, def.length, 14, 1, true);
    geo.rotateZ(Math.PI / 2);
    const beamMesh = new THREE.Mesh(geo, mat);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(def.width / 4, def.width / 4, def.length, 10, 1, true), coreMat);
    core.geometry.rotateZ(Math.PI / 2);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(def.width * 0.9, 14, 10), mat);
    g.add(beamMesh); g.add(core); g.add(glow);
    const x = owner.x + owner.facing * (def.length / 2 + 0.5);
    const y = owner.y + (def.y ?? 1.0);
    g.position.set(x, y, owner.z);
    this.scene.add(g);
    const beam = {
      owner, def, group: g, life: def.activeFor, x0: owner.x, dir: owner.facing, y,
      z: owner.z, hitTimers: new Map(), width: def.width, height: def.height,
    };
    this.beams.push(beam);
    this.audio.superFlash(1);
    this.fx.flashScreen(def.color, 0.3);
    this.camera.shake(0.3, 0.5);
  }

  canAirAttack(f) {
    if (!f.air || f.jumpAttackUsed) return false;
    if (f.y < 0.35) return false;
    if (f.y > 3.4) return false;
    return true;
  }

  _tickProjectiles(dt, frozen = false) {
    // projectiles
    for (const p of this.fx.projectiles) {
      if (p.dead) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      if (p.def.arc) { p.vy -= GRAVITY * 0.55 * dt; p.y += p.vy * dt; if (p.y < 0.2) { p.y = 0.2; p.vy = Math.abs(p.vy) * 0.4; } }
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.z += dt * 6; p.mesh.rotation.x += dt * 3;
      const scale = 1 + Math.sin(performance.now() * 0.02 + p.x) * 0.08;
      p.mesh.scale.setScalar(scale);
      // trail
      if (Math.random() < 0.6) this.fx._spawn('spark', p.x - p.vx * 0.02, p.y, p.z, {
        vx: rand(-0.5, 0.5), vy: rand(-0.2, 0.9), vz: rand(-0.4, 0.4),
        life: 0.24, size: p.radius * 0.6, color: p.color, grav: 0, drag: 2, fade: 0.7,
      });
      // hit check
      if (p.hitCooldown > 0) p.hitCooldown -= dt * FPS;
      const opp = this.fighters[1 - p.party];
      if (opp && p.hitCooldown <= 0) {
        const hb = { cx: p.x, cy: p.y, cz: p.z, hw: p.radius, hh: p.radius, hd: p.radius };
        // projectile clash
        for (const q of this.fx.projectiles) {
          if (q === p || q.dead || q.party === p.party) continue;
          if (Math.abs(q.x - p.x) < p.radius + q.radius && Math.abs(q.y - p.y) < p.radius + q.radius && Math.abs(q.z - p.z) < 0.6) {
            this.fx.hitSpark((p.x + q.x) / 2, (p.y + q.y) / 2, p.z, 0xffffff, 18, 1.3);
            this.fx.flashScreen(0xffffff, 0.18);
            this.audio.block();
            p.dead = true; q.dead = true;
            this._removeProj(p); this._removeProj(q);
            break;
          }
        }
        if (p.dead) continue;
        if (this._overlaps(hb, opp)) {
          const mvP = {
            damage: p.def.damage, hitstun: p.def.hitstun || 18, blockstun: p.def.blockstun || 14,
            hitstop: p.def.hitstop || 7, chip: p.def.chip ?? 0.15, level: 'mid',
            knockdown: p.def.knockdown || null, name: 'Projectile', type: 'projectile', push: 0.05,
            kind: 'flesh', launcher: 0,
          };
          const land = this.applyHit(p.owner, opp, mvP, { fromProjectile: true, dir: sign(p.vx) });
          if (land) {
            p.hitCount++;
            p.hitCooldown = 6;
            this.fx.hitSpark(p.x, p.y, p.z, p.color, 14, 1.2);
            this.audio.hit(1.0, 'flesh', false, 0);
            if (!p.pierce || p.hitCount >= p.hits) { p.dead = true; this._removeProj(p); }
          } else {
            // blocked
            p.dead = true; this._removeProj(p);
          }
        }
      }
      if (Math.abs(p.x) > 13 || p.life <= 0) { p.dead = true; this._removeProj(p); }
    }
    // beams
    for (const b of this.beams) {
      if (b.dead) continue;
      b.life -= dt * FPS;
      const opp = b.owner.opponent;
      if (opp && b.life > 0) {
        // rectangle test: beam extends from owner forward
        const bx = b.x0 + b.dir * (4.6);
        const hb = { cx: bx + b.dir * 3, cy: b.y, cz: b.z, hw: 4.6, hh: b.def.height / 2, hd: b.def.width * 0.75 };
        const last = b.hitTimers.get(opp.id) || 0;
        if (this.frame - last >= (b.def.hitInterval || 8) && this._overlaps(hb, opp)) {
          b.hitTimers.set(opp.id, this.frame);
          const mvB = {
            damage: b.def.damage, hitstun: b.def.hitstun || 16, blockstun: b.def.blockstun || 12,
            hitstop: b.def.hitstop || 4, chip: b.def.chip ?? 0.15, level: 'mid', name: 'Beam', type: 'projectile',
            push: 0.02, kind: 'flesh', knockdown: null,
          };
          this.applyHit(b.owner, opp, mvB, { fromProjectile: true, dir: b.dir });
          this.fx.hitSpark(opp.x, b.y + rand(-0.3, 0.3), opp.z, b.def.color, 10, 1.0);
        }
      }
      b.group.children.forEach((c, i) => { c.material.opacity = (i === 0 ? 0.85 : 0.7) * (0.7 + Math.sin(performance.now() * 0.05 + i) * 0.3) * clamp(b.life / 12, 0, 1); });
      if (b.life <= 0) { b.dead = true; this.scene.remove(b.group); }
    }
    this.beams = this.beams.filter((b) => !b.dead);
    this.beams.forEach((b) => {
      const pulse = 1 + Math.sin(performance.now() * 0.03) * 0.12;
      b.group.children[0].scale.set(1, pulse, pulse);
    });
  }

  _removeProj(p) {
    this.scene.remove(p.mesh);
    p.mesh.traverse?.((o) => { o.geometry?.dispose?.(); if (o.material) o.material.dispose?.(); });
  }

  // ============ WALL BOUNCE ============
  wallBounce(f) {
    if (f._wallBounced) return;
    f._wallBounced = true;
    f.vx = -f.vx * 0.5;
    f.vy = Math.max(f.vy, 5.5);
    f.air = true;
    f.y = Math.max(f.y, 0.02);
    f.stun = Math.max(f.stun, 26);
    f.state = 'hit';
    f.hitPoseName = 'stagger';
    this.fx.wallBounce(f.x - sign(f.vx) * 0.2, 1.0, f.z, 0xffcc66);
    this.camera.shake(0.5, 0.3);
    this.audio.hit(1.6, 'flesh');
    this.slowmo = Math.max(this.slowmo, 0.12);
    setTimeout(() => { f._wallBounced = false; }, 600);
  }

  // ============ SUPER ============
  onSuperStart(f, mv) {
    this.superCine = { fighter: f, move: mv, t: 0 };
    this.audio.superFlash(mv.meter || 1);
    this.fx.superCharge(f, mv.color || f.cfg.colors.accent, mv.meter || 1);
    this.camera.startSuperCine(f, f.opponent, mv.meter || 1, mv.color);
    this.hud.announce(f.playerIndex === 0 ? 'SUPER ART' : 'SUPER ART', mv.name, 1.8);
    this.frozen = false;
    this.stats[f.playerIndex].supers++;
    // brief global freeze on level 3
    if (mv.meter >= 3) {
      this.hitstop = 22;
      this.fx.flashScreen(0xffffff, 0.8);
      this.camera.shake(0.6, 0.6);
    }
  }

  onMoveEnd(f, mv) {
    if (f.state === 'driveRush' || (mv && mv.type === 'driveRush')) { f.state = 'idle'; }
  }

  onMoveEndClear(f) {
    f.throwTimer = 0;
  }

  // ============ KO / ROUND END ============
  checkKO(loser) {
    if (this.roundState !== 'fight') return;
    if (this.currentMode === 'training') return;
    loser.health = 0;
    this.roundState = 'ko';
    this.koTimer = 0;
    this.frozen = true;
    this.slowmo = 0.9;
    this.matchWinner = this.fighters[1 - loser.playerIndex];
    loser.state = 'ko';
    loser.currentMove = null;
    loser.vx = sign(loser.x - this.matchWinner.x) * 3.5;
    loser.vy = 5.5;
    loser.air = true;
    loser.y = Math.max(loser.y, 0.02);
    this.matchWinner.state = 'win';
    this.matchWinner.winPose = 0;
    this.matchWinner.currentMove = null;
    this.hud.announce('K.O.', '', 2.2, 'ko');
    this.audio.announce('ko');
    this.audio.ko();
    this.fx.flashScreen(0xffffff, 0.55);
    this.camera.shake(0.8, 0.8);
    this.camera.startCinematicKO(this.matchWinner, loser);
    this.roundWins[this.matchWinner.playerIndex]++;
    this.hud.setPips(this.roundWins[0], this.roundWins[1]);
    this.stats[this.matchWinner.playerIndex].maxCombo = Math.max(this.stats[this.matchWinner.playerIndex].maxCombo, loser.comboHits);
    if (this.currentMode === 'training') this.hud.trainBanner('<em>K.O.</em>');
  }

  _timeUp() {
    if (this.roundState !== 'fight') return;
    this.roundState = 'roundEnd';
    this.frozen = true;
    this.roundEndTimer = 0;
    const h1 = this.f1.health, h2 = this.f2.health;
    if (h1 === h2) {
      this.hud.announce('DRAW', 'TIME UP', 2.0, 'timeout');
      this.audio.announce('timeout');
      this.winnerIdx = -1;
    } else {
      const wi = h1 > h2 ? 0 : 1;
      this.winnerIdx = wi;
      this.hud.announce('TIME UP', this.fighters[wi].cfg.name + ' WINS', 2.0, 'timeout');
      this.audio.announce('timeout');
      this.roundWins[wi]++;
      this.hud.setPips(this.roundWins[0], this.roundWins[1]);
      this.fighters[wi].state = 'win';
      this.fighters[1 - wi].state = 'idle';
      this.camera.startVictoryCam(this.fighters[wi]);
      this.audio.announce('win');
    }
    this._timeUpHandled = true;
  }

  ensureCpu(index, level = 2) {
    if (!this.cpu[index]) this.cpu[index] = new CPU(this, this.fighters[index], level);
    this.cpu[index].enabled = true;
    return this.cpu[index];
  }

  _updateRoundEnd(dt) {
    this.roundEndTimer = (this.roundEndTimer || 0) + dt;
    this.koTimer = (this.koTimer || 0) + dt;
    // physics for KO'd fighter
    if (this.roundState === 'ko') {
      const l = this.fighters[1 - this.matchWinner.playerIndex];
      if (l) {
        l.vy -= GRAVITY * dt;
        l.y += l.vy * dt; l.x += l.vx * dt;
        if (l.y <= 0) { l.y = 0; l.vy = 0; if (!l._koLanded) { l._koLanded = true; this.finishKO(l); } }
      }
      if (this.koTimer > 2.9 && !this._koFinished) this.finishKO(l);
    }
    this.updateVisuals(dt);
    this.hud.update(dt, this.f1, this.f2, this.roundTimer / FPS, this.currentMode);
    if (this.roundState === 'ko' && this.koTimer > 3.4) this._postKO();
    else if (this.roundState === 'roundEnd' && this.roundEndTimer > 2.4) this._postTimeUp();
  }

  finishKO(l) {
    if (this._koLanded2) return;
    this._koLanded2 = true;
    if (l) {
      l.state = 'knockdown';
      l.knockdownPhase = 'down';
      l.stun = 9999;
      l.y = 0;
      this.fx.dust(l.x, l.z, 22);
      this.camera.shake(0.9, 0.4);
      this.audio.hit(1.8, 'flesh');
      this.stats[this.matchWinner.playerIndex].maxCombo = Math.max(this.stats[this.matchWinner.playerIndex].maxCombo, l.comboHits);
    }
    const w = this.matchWinner;
    w.state = 'win';
    w.currentMove = null;
    this.camera.endCine();
    this.camera.startVictoryCam(w);
    this.audio.announce('win');
    this.hud.announce('', '', 0.1);
    this.hud.banner(w.cfg.name + ' WINS', this.roundWins[0] >= 2 || this.roundWins[1] >= 2 ? 'MATCH' : 'ROUND ' + this.roundNum, 2.4);
  }

  _postKO() {
    const wi = this.matchWinner.playerIndex;
    const wins = this.roundWins[wi];
    if (wins >= 2 || this.currentMode === 'survival' || this.currentMode === 'arcade') {
      this._endMatch(wi);
      return;
    }
    this.roundNum++;
    this._koLanded2 = false;
    this.roundState = 'none';
    this._koFinished = false;
    this.beginRound(false);
  }

  _postTimeUp() {
    if (this.winnerIdx === -1) {
      this.roundNum++;
      this.roundState = 'none';
      this.beginRound(false);
      return;
    }
    const wi = this.winnerIdx;
    if (this.roundWins[wi] >= 2) { this._endMatch(wi); return; }
    this.roundNum++;
    this.roundState = 'none';
    this.beginRound(false);
  }

  _endMatch(winnerIdx) {
    if (this.matchOver) return;
    this.matchOver = true;
    this.roundState = 'matchEnd';
    this.frozen = true;
    this.matchWinner = this.fighters[winnerIdx];
    this.matchLoser = this.fighters[1 - winnerIdx];
    this.matchWinner.state = 'win';
    this.matchWinner.winPose = 1;
    if (this.matchLoser.state !== 'knockdown') { this.matchLoser.state = 'ko'; this.matchLoser.stateFrame = 0; }
    this.camera.startVictoryCam(this.matchWinner);
    this.audio.stopMusic();
    this.audio.setMusicMode('menu', 96);
    this.audio.startMusic('menu', 96);
    this.onMatchEnd?.(winnerIdx);
    this.app.onMatchEnd?.(this, winnerIdx);
  }

  // ============ VISUALS ============
  updateVisuals(dt) {
    // slowmo
    let vdt = dt;
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      vdt = dt * 0.35;
    }
    for (const f of this.fighters) if (f) f.update(vdt);
    this.fx.update(vdt);
    if (this.stage) this.stage.update(vdt, performance.now() * 0.001);
    if (this.camera.cine) this.camera.update(dt, this.f1, this.f2, FPS);
    else this.camera.update(dt, this.f1, this.f2, FPS);
    // win pose progression
    if (this.matchWinner && this.matchWinner.state === 'win') this.matchWinner.winPose = Math.min(1, (this.matchWinner.winPose || 0) + dt);
    if (this.superCine) {
      this.superCine.t += dt;
      if (this.superCine.t > 2.2) this.superCine = null;
    }
  }

  // ============ TRAINING API ============
  trainingReset() {
    this.f1.resetForRound(0, true);
    this.f2.resetForRound(1, true);
    this.f1.setFacingVisual(1); this.f2.setFacingVisual(-1);
    this.projectiles = [];
    for (const p of this.fx.projectiles) this.scene.remove(p.mesh);
    this.fx.projectiles.length = 0;
    for (const b of this.beams) this.scene.remove(b.group);
    this.beams = [];
    this.f1.superMeter = [0, 0, 0]; this.f2.superMeter = [0, 0, 0];
    this.training.sessionDamage = 0;
    this.training.sessionHits = 0;
    this.training.lastDamage = 0;
    this.training.lastHits = 0;
    this.hud.trainBanner('<em>POSITIONS RESET</em>', 0.9);
    this.hud.hideCombo(0); this.hud.hideCombo(1);
  }

  trainingSetDummy(mode) {
    this.trainingState.dummyMode = mode;
    this.hud.trainBanner('DUMMY: <em>' + mode.toUpperCase() + '</em>', 1.0);
    if (mode === 'record') {
      this.trainingState.recording = [];
      this.trainingState.recState = 'rec';
    }
  }

  trainingToggleRecPlay() {
    const ts = this.trainingState;
    if (ts.recState === 'idle' || ts.recState === 'play') {
      ts.recState = 'rec';
      ts.recording = [];
      ts.playback = null;
      ts.dummyMode = 'record';
      this.hud.trainBanner('<em>RECORDING…</em> press F3 to stop', 1.4);
    } else if (ts.recState === 'rec') {
      ts.recState = 'play';
      ts.playback = ts.recording && ts.recording.length > 1 ? ts.recording.slice() : null;
      ts.playbackStart = this.frame;
      ts.dummyMode = 'playback';
      this.hud.trainBanner(ts.playback ? '<em>PLAYBACK</em> (' + ts.playback.length + 'F)' : 'NO RECORDING', 1.4);
    } else if (ts.recState === 'play') {
      ts.recState = 'rec';
      ts.recording = [];
      ts.playback = null;
      ts.dummyMode = 'record';
      this.hud.trainBanner('<em>RECORDING…</em>', 1.2);
    }
  }

  trainingToggleHealth() {
    this.trainingState.unlimited = !this.trainingState.unlimited;
    this.hud.trainBanner('HEALTH: <em>' + (this.trainingState.unlimited ? 'INFINITE' : 'NORMAL') + '</em>', 1.2);
  }

  trainingCycleDummy() {
    const modes = ['stand', 'crouch', 'jump', 'block', 'cpu'];
    const i = modes.indexOf(this.trainingState.dummyMode);
    this.trainingSetDummy(modes[(i + 1) % modes.length]);
  }

  get p1() { return this.f1; }
  get p2() { return this.f2; }
}
