// Core fighter state machine & combat resolution.
import * as THREE from 'three';
import { clamp, lerp, damp, approach, sign, rand } from './utils.js';
import { Rig, blankPose, copyPose, mixPose } from './rig.js';
import { getPose, POSE_DEFS, P, PO } from './poses.js';
import { getAnim } from './anim.js';
import { buildMoveAnim } from './moves.js';
import { facingDir, detectMotion } from './input.js';

export const FPS = 60;
export const ROUND_TIME = 99;
const GRAVITY = 24;
const STAGE_HALF = 8.4;
const DRIVE_MAX = 6;
const GROUND_Y = 0;
const MOTION_WEIGHT = { qcf: 1, qcb: 1, dp: 3, hcf: 2, hcb: 2, qcfx2: 5, qcbx2: 5 };

let FID = 0;

export class Fighter {
  constructor(game, cfg, playerIndex, side) {
    this.game = game;
    this.cfg = cfg;
    this.id = 'f' + FID++;
    this.playerIndex = playerIndex;
    this.side = side; // 0 = left spawn
    this.rig = new Rig(cfg);
    this.scene = game.scene;
    this.scene.add(this.rig.group);
    this.rig.group.position.set(0, 0, 0);

    this.x = side === 0 ? -3.2 : 3.2;
    this.z = side === 0 ? 0.12 : -0.12;
    this.y = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = side === 0 ? 1 : -1; // +1 = +Z (right)
    this.baseFacing = this.facing;

    this.maxHealth = 10000;
    this.health = this.maxHealth;
    this.drive = DRIVE_MAX;
    this.superMeter = [0, 0, 0];
    this.juggle = 0;
    this.comboHits = 0;
    this.comboDamage = 0;
    this.comboStartFrame = -999;
    this.receivedHits = 0;
    this.blockedHits = 0;
    this.hitStreak = 0;

    this.state = 'idle';
    this.stateFrame = 0;
    this.stun = 0;
    this.blockstun = 0;
    this.hitstop = 0;
    this.invuln = 0;
    this.armor = 0;
    this.air = false;
    this.crouching = false;
    this.blocking = false;
    this.parry = 0;
    this.parryPerfect = 0;
    this.burnout = false;
    this.recoverFrame = 0;
    this.walkDir = 0;
    this.wasAir = false;
    this.currentMove = null;
    this.moveFrame = 0;
    this.movePhase = 'none';
    this.hitCount = 0;
    this.cancelWindow = 0;
    this.buffer = {};
    this.crouchHold = false;
    this.dashDir = 0;
    this.dashFrame = 0;
    this.jumpDir = 0;
    this.throwTimer = 0;
    this.throwTarget = null;
    this.throwAnim = null;
    this.throwFrame = 0;
    this.thrownBy = null;
    this.counterWindow = 0;
    this.punishCounter = 0;
    this.dizzyTimer = 0;
    this.dizzyMeter = 0;
    this.projectileHits = 0;
    this.lastHitBy = null;
    this.lastBlockedFrame = -999;
    this.lastParryFrame = -999;
    this.lastCounterFrame = -999;
    this.driveRushFrames = 0;
    this.driveImpactFrames = 0;
    this.superFlash = 0;
    this.cinematic = null;
    this.animT = 0;
    this.poseBlend = 0.3;
    this.curAnimKey = 'stance';
    this.animOverride = null;
    this.guardPose = 0;
    this.hitFlash = 0;
    this.shakeT = 0;
    this.shapecache = null;
    this.forcePose = null;
    this.winPose = 0;
    this.trail = null;
    this.lastDamageTaken = 0;
    this.blockStunTimer = 0;
    this._prevPose = null;
    this._animState = { t: 0, key: 'stance' };
    this.aura = null;
    this._buildAura();
  }

  _buildAura() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: this.cfg.colors.accent, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 24), mat);
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.66, 24), mat.clone());
    ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.02; g.add(ring2);
    this.scene.add(g);
    this.aura = { group: g, ring, ring2, mat, mat2: ring2.material };
  }

  resetForRound(side, keepStats = false) {
    this.side = side;
    this.x = side === 0 ? -3.2 : 3.2;
    this.z = side === 0 ? 0.12 : -0.12;
    this.y = 0; this.vx = 0; this.vy = 0; this.vz = 0;
    this.facing = side === 0 ? 1 : -1;
    this.health = this.maxHealth;
    this.drive = DRIVE_MAX;
    if (!keepStats) this.superMeter = [0, 0, 0];
    this.state = 'idle'; this.stateFrame = 0;
    this.stun = 0; this.blockstun = 0; this.hitstop = 0; this.invuln = 0; this.armor = 0;
    this.air = false; this.crouching = false; this.blocking = false; this.parry = 0;
    this.burnout = false; this.dizzyMeter = 0; this.dizzyTimer = 0;
    this.currentMove = null; this.moveFrame = 0; this.movePhase = 'none';
    this.hitCount = 0; this.juggle = 0; this.comboHits = 0; this.comboDamage = 0;
    this.throwTimer = 0; this.throwTarget = null; this.thrownBy = null;
    this.counterWindow = 0; this.punishCounter = 0;
    this.projectileHits = 0;
    this.animOverride = null; this.forcePose = null;
    this.cinematic = null; this.winPose = 0;
    this.rig.group.position.set(this.x, 0, this.z);
    this.rig.group.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.rig.flash(0x000000, 0);
    this.lastHitBy = null;
    this.driveRushFrames = 0; this.driveImpactFrames = 0;
  }

  get driveRatio() { return this.drive / DRIVE_MAX; }
  get healthRatio() { return clamp(this.health / this.maxHealth, 0, 1); }
  get superLevel() { return this.superMeter[0] >= 3 ? 3 : this.superMeter[0]; }

  addDrive(v) {
    const before = this.drive;
    this.drive = clamp(this.drive + v, 0, DRIVE_MAX);
    if (this.drive <= 0 && before > 0) this._enterBurnout();
    if (this.drive > 0 && this.burnout) this.burnout = false;
  }
  _enterBurnout() {
    if (this.burnout) return;
    this.burnout = true;
    this.game.audio.burnout();
    this.game.fx.burnoutBurst(this);
    this.game.hud.banner('BURNOUT', 'DRIVE GAUGE DEPLETED');
  }

  stateLabel() {
    if (this.burnout) return 'BURNOUT';
    return this.state.toUpperCase();
  }
  hasArmor() { return this.armor > 0; }
  isInvuln() { return this.invuln > 0 || this.state === 'knockdown' || this.state === 'thrown' || this.state === 'wakeup'; }
  isAttacking() { return this.currentMove != null; }

  // ---- Pose/anim ----
  _setAnimPose(pose, rate = 0.4) {
    this.rig.setPose(pose, rate);
  }

  // Select base animation pose from state
  _poseForState(t) {
    const b = this.animT;
    switch (this.state) {
      case 'idle': return getPose(this.burnout ? 'stagger' : (Math.sin(b * 3.2) > 0 ? 'stance' : 'stanceBreathe'));
      case 'walkF': return getPose(Math.sin(b * 12) > 0 ? 'walkF1' : 'walkF2');
      case 'walkB': return getPose(Math.sin(b * 12) > 0 ? 'walkB1' : 'walkB2');
      case 'crouch': return getPose(this.crouching ? 'crouchBreathe' : 'crouch');
      case 'block': return getPose(this.crouching ? 'blockLow' : 'block');
      case 'dash': return getPose(this.dashDir > 0 ? 'dashF' : 'dashB');
      case 'jump': {
        if (this.vy > 1.5) return this.air && this.jumpDir !== 0 ? getPose('jumpUp') : getPose('jumpUp');
        return getPose(this.vy < -3 ? 'jumpFall' : 'jumpUp');
      }
      case 'land': return getPose('land');
      case 'hit': return getPose(this.hitPoseName || 'hitMid');
      case 'knockdown': return getPose(this.knockdownPhase === 'down' ? 'knockdown' : 'hitMid');
      case 'wakeup': return getPose(this.wakePhase === 'kneel' ? 'wakeKneel' : 'land');
      case 'dizzy': return getPose('dizzy');
      case 'stagger': return getPose('stagger');
      case 'throwStart': return getPose('throwGrab');
      case 'thrown': return getPose('thrown');
      case 'driveImpact': return getPose('dashF');
      case 'driveRush': return getPose('dashF');
      case 'parry': return getPose('block');
      case 'win': return getPose(this.winPose > 0.5 ? 'victory' : 'victoryPoint');
      case 'intro': return getPose('intro');
      case 'ko': return getPose('knockdown');
      default: return getPose('stance');
    }
  }

  // ============ INPUT HANDLING ============
  handleInput(sample, dt) {
    if (this.state === 'ko' || this.game.frozen) return;
    const g = this.game;
    this.lastSample = sample;
    this._dirHist = this._dirHist || [];
    this._dirHist.push(sample.dir);
    if (this._dirHist.length > 40) this._dirHist.shift();
    // resolve facing toward the opponent first so motion inputs are read relative to it
    if (this.opponent && !this.air && !this.currentMove && this.stun <= 0 && this.state !== 'knockdown') {
      const toward = sign(this.opponent.x - this.x);
      if (toward !== 0 && Math.abs(this.opponent.x - this.x) > 0.12) this.facing = toward;
    }
    const raw = sample.dir;
    const dir = facingDir(raw, this.facing);
    const hist = this._motionHistory();
    const facingSign = this.facing;

    // helper to test button presses
    const wasPressed = (mask) => (sample.pressed & mask) === mask;
    const isHeld = (mask) => (sample.buttons & mask) === mask;

    const canAct = this.stun <= 0 && this.hitstop <= 0 && !this.currentMove && this.state !== 'knockdown' && this.state !== 'thrown' && this.state !== 'wakeup' && this.state !== 'dizzy' && this.state !== 'win' && this.state !== 'land' && this.state !== 'thrown' && !this.cinematic;
    const parryHeld = isHeld(64 | 16); // MP+MK
    const impactHeld = isHeld(4 | 32); // HP+HK

    // ======= Drive Parry (MP+MK) =======
    if (canAct && parryHeld) {
      if (this.state !== 'parry') { this.state = 'parry'; this.parry = 0; this.stateFrame = 0; }
      this.parry++;
      if (this.parry === 1) { g.audio.driveParry(); g.fx.parryFlash(this); }
      this.parryPerfect = this.parry <= 11 ? 12 - this.parry : 0;
      // drain drive for held parry beyond perfect window
      if (this.parry > 12) this.addDrive(-0.011);
      if (this.drive <= 0) { this.parry = 0; }
      // still allow cancel to attack? no
      this._updateFacing(sample, false);
      return;
    } else if (this.state === 'parry' && !parryHeld) {
      this.state = 'idle';
      this.parry = 0; this.parryPerfect = 0;
    }

    // ======= Drive Impact (HP+HK) =======
    if (canAct && wasPressed(4 | 32)) {
      if (this.drive > 0) {
        this.startDriveImpact();
        return;
      } else { g.audio.ui('error'); }
    }

    // ======= Drive Reversal (in blockstun/guard) =======
    if ((this.blockstun > 0 || this.state === 'block') && wasPressed(4 | 32) && this.drive > 0) {
      this.startDriveReversal();
      return;
    }

    // ======= Throw (LP+LK) =======
    if (canAct && wasPressed(1 | 8)) {
      this.startThrow();
      return;
    }
    if (canAct && isHeld(1 | 8) && this.state !== 'throwStart' && !this.thrownBy) {
      if (this.game.frame - this.lastThrowInput > 8) { this.startThrow(); this.lastThrowInput = this.game.frame; }
    }

    // ======= Dash (double tap) =======
    if (canAct && !this.air) {
      const prev = this._dirHistory || [];
      if (raw === 6 && this.prevRawDir !== 6 && prev.slice(-12).some((d) => d === 6) && this._dashGrace <= 0) {
        // we track via buffer below
      }
    }

    // EX special: motion + two buttons at once (consumes one drive bar)
    if (wasPressed(1 | 2) || wasPressed(2 | 4) || wasPressed(8 | 16) || wasPressed(16 | 32) || wasPressed(1 | 4) || wasPressed(8 | 32)) {
      if (this.drive >= 1) {
        const pairBtn = (wasPressed(1|2)) ? 'LP' : (wasPressed(2|4)) ? 'MP' : (wasPressed(4|8)) ? 'HP' : (wasPressed(8|16)) ? 'LK' : 'HK';
        if (this.tryExSpecial(hist, pairBtn)) return;
      }
    }

    // special/super checks on button press (any single attack button)
    if (sample.pressed & (1 | 2 | 4 | 8 | 16 | 32)) {
      const btn = wasPressed(4) && !wasPressed(2) && !wasPressed(1) ? 'HP'
        : wasPressed(2) ? 'MP' : wasPressed(1) ? 'LP' : wasPressed(32) ? 'HK' : wasPressed(16) ? 'MK' : wasPressed(8) ? 'LK' : 'LP';
      const btnList = [];
      if (sample.pressed & 1) btnList.push('LP');
      if (sample.pressed & 2) btnList.push('MP');
      if (sample.pressed & 4) btnList.push('HP');
      if (sample.pressed & 8) btnList.push('LK');
      if (sample.pressed & 16) btnList.push('MK');
      if (sample.pressed & 32) btnList.push('HK');
      for (const b of btnList) {
        if (this.trySuper(hist, b)) return;
        if (this.trySpecial(hist, b)) return;
      }
      // normals
      const nBtn = btnList[btnList.length - 1];
      if (nBtn) this.tryNormal(nBtn, canAct, sample);
    }

    // movement
    if (canAct) this._movement(sample, dir, dt);
  }

  _motionHistory() {
    // Facing-relative history of this fighter's own inputs (works for human + CPU).
    const h = this._dirHist || [];
    return h.map((d) => ({ dir: facingDir(d, this.facing) }));
  }

  _updateFacing(sample, allowTurn) {
    const g = this.game;
    const opp = this.opponent;
    if (!opp) return;
    const toward = sign(opp.x - this.x);
    if (Math.abs(opp.x - this.x) < 0.1) return;
    if (!this.air && this.state !== 'dash' && this.state !== 'driveRush' && !this.currentMove && this.stun <= 0) {
      const inBlock = this.blocking || this.blockstun > 0;
      const rawDir = sample.dir;
      const local = facingDir(rawDir, this.facing);
      if (!inBlock && local !== 4 && local !== 7 && local !== 1) {
        this.facing = toward;
      } else if (inBlock) {
        this.facing = toward;
      }
    }
    this._followFacing = true;
  }

  _movement(sample, dir, dt) {
    const g = this.game;
    const opp = this.opponent;
    // `dir` here is already facing-relative (6 = toward the opponent), so back is always 4
    const backDir = 4;
    const isBack = dir === 4 || dir === 1;
    const isDown = dir === 1 || dir === 2 || dir === 3;
    const isUp = dir === 7 || dir === 8 || dir === 9;

    this.crouching = isDown;
    // blocking on back input
    const canBlock = !this.air && this.drive > 0;
    this.blocking = isBack && canBlock && !this.currentMove;

    if (this.air) {
      // air control + air normals handled via buffer
      const airFwd = this.facing;
      this.vx = lerp(this.vx, 0, 2.2 * dt);
      return;
    }

    if (this.blocking) {
      this.state = 'block';
      this.vx = 0;
      // walking backwards while blocking (slower)
      return;
    }

    // dash detection via double-tap
    if ((dir === 6 || dir === 4) && this.prevDir !== dir) {
      const now = g.frame;
      if (this._lastDirTap && this._lastDirTap.dir === dir && now - this._lastDirTap.f < 14) {
        this.startDash(dir === 6 ? 1 : -1);
        this._lastDirTap = null;
        this.prevDir = dir;
        return;
      }
      this._lastDirTap = { dir, f: now };
    }
    this.prevDir = dir;

    if (isUp) {
      this.startJump(dir, sample);
      return;
    }

    // walk
    const spd = this.cfg.walkSpeed * 2.6;
    if (dir === 6) { this.state = 'walkF'; this.vx = this.facing * spd; }
    else if (dir === 4) { this.state = 'walkB'; this.vx = -this.facing * spd * this.cfg.walkBack; }
    else if (isDown) { this.state = 'crouch'; this.vx = 0; }
    else { this.state = 'idle'; this.vx = 0; }
  }

  startDash(dir) {
    if (this.burnout) { this.game.audio.ui('error'); return; }
    this.state = 'dash';
    this.stateFrame = 0;
    this.dashDir = dir;
    this.dashFrame = 0;
    this.vx = dir * this.facing * 11 * this.cfg.dashSpeed;
    this.addDrive(-0.35);
    this.game.audio.ui('move');
  }

  startJump(dir, sample) {
    this.state = 'jump';
    this.stateFrame = 0;
    this.air = true;
    this.vy = GRAVITY * 0.52 * this.cfg.jumpVel;
    this.jumpDir = dir;
    this.vx = this.facing * (dir === 9 ? 4.6 : dir === 7 ? -4.2 : 0) * this.cfg.walkSpeed;
    this.jumpAttackUsed = false;
    this.game.audio.whoosh(0.4);
  }

  startDriveImpact() {
    this.hitTargets = new Set();
    this.addDrive(-1);
    this.state = 'driveImpact';
    this.stateFrame = 0;
    this.driveImpactFrames = 0;
    this.movePhase = 'startup';
    this.armor = 3;
    this.currentMove = this.game.driveImpactMove;
    this.moveFrame = 0;
    this.hitCount = 0;
    this.game.audio.driveImpact();
    this.game.fx.driveImpactCharge(this);
    this.invuln = 0;
  }

  startDriveReversal() {
    this.hitTargets = new Set();
    this.addDrive(-2);
    this.state = 'driveReversal';
    this.stateFrame = 0;
    this.armor = 2;
    this.invuln = 4;
    this.currentMove = { type: 'driveReversal', damage: 500, hitstun: 24, blockstun: 12, hitstop: 8, startup: 6, active: 4, recovery: 18,
      hitbox: { bone: 'handA', offset: [0, 0, 0.2], size: [0.9, 0.8, 0.9], reach: 1.2 }, knockdown: 'hard', name: 'Drive Reversal', level: 'mid', cancel: {} };
    this.moveFrame = 0;
    this.movePhase = 'startup';
    this.game.audio.driveRush();
  }

  startThrow() {
    this.hitTargets = new Set();
    this.state = 'throwStart';
    this.stateFrame = 0;
    this.throwFrame = 0;
    this._throwChecked = false;
    this._thrownOpp = null;
    this.vx = 0;
    this.currentMove = this.game.throwMove;
    this.moveFrame = 0;
    this.movePhase = 'startup';
    this.game.audio.whoosh(0.5);
  }

  tryNormal(btn, canAct, sample) {
    if (!canAct) {
      // buffer for cancels / wake-up
      this.buffer = { btn, frame: this.game.frame };
      return;
    }
    const key = btn + (this.air ? 'A' : this.crouching ? 'C' : 'S');
    const mv = this.cfg._normalsById[key];
    if (!mv) return;
    this.startMove(mv, 'normal');
  }

  startMove(mv, kind, extra = {}) {
    this.currentMove = mv;
    this.moveKind = kind;
    this.moveFrame = 0;
    this.movePhase = 'startup';
    this.hitCount = 0;
    this.hitTargets = new Set();
    this.cancelUsed = false;
    this.state = kind === 'super' ? 'super' : kind === 'special' ? 'special' : 'attack';
    this.stateFrame = 0;
    this.vx = 0;
    this.animOverride = null;
    this.lastMoveStarted = this.game.frame;
    this.blocking = false;
    Object.assign(this, extra);
    this._buildMoveAnimCache(mv);
    if (kind === 'super') {
      this.superFlash = mv.meter;
      this.cinematic = { move: mv, t: 0 };
      this.game.onSuperStart(this, mv);
    }
    if (kind === 'special' || kind === 'super') this.game.audio.whoosh(0.8);
    else if (mv.kind === 'kick') this.game.audio.whoosh(0.35);
    else this.game.audio.whoosh(0.25);
    if (mv.ex) { this.game.audio.driveParry(); this.addDrive(-1); }
  }

  _buildMoveAnimCache(mv) {
    if (mv._anim) return;
    if (mv.anim && getAnim(mv.anim)) {
      mv._anim = getAnim(mv.anim);
    } else {
      mv._anim = buildMoveAnim(mv, this.cfg);
    }
  }

  trySpecial(hist, btn) {
    const list = this.cfg.specials;
    // try the longest / highest-priority motions first so hcf/hcb win over qcf/qcb
    const order = [...list].sort((a, b) => (MOTION_WEIGHT[b.input] || 0) - (MOTION_WEIGHT[a.input] || 0));
    if (!this._heldMotionTried) this._heldMotionTried = 0;
    for (const sp of order) {
      if (!sp.buttons.includes(btn)) continue;
      if (!this._specialInputOk(sp, hist)) continue;
      if (sp.ex && this.drive < 1) { this.game.hud.hint('NOT ENOUGH DRIVE'); continue; }
      this.startSpecial(sp);
      return true;
    }
    return false;
  }

  tryExSpecial(hist, btn) {
    const order = [...this.cfg.specials].sort((a, b) => (MOTION_WEIGHT[b.input] || 0) - (MOTION_WEIGHT[a.input] || 0));
    for (const sp of order) {
      if (sp.buttons.includes(btn)) {
        if (!this._specialInputOk(sp, hist)) continue;
        this.startSpecial(sp, true);
        return true;
      }
    }
    // any special whose motion matches, using its own button
    for (const sp of order) {
      if (!this._specialInputOk(sp, hist)) continue;
      this.startSpecial(sp, true);
      return true;
    }
    return false;
  }

  _specialInputOk(sp, hist) {
    const facing = this.facing;
    switch (sp.input) {
      case 'qcf': return detectMotion(hist, facing, 'qcf');
      case 'qcb': return detectMotion(hist, facing, 'qcb');
      case 'dp': return detectMotion(hist, facing, 'dp');
      case 'hcf': return detectMotion(hist, facing, 'hcf');
      case 'hcb': return detectMotion(hist, facing, 'hcb');
      case 'qcfx2': return detectMotion(hist, facing, 'qcfx2');
      case 'qcbx2': return detectMotion(hist, facing, 'qcbx2');
      default: return false;
    }
  }

  trySuper(hist, btn) {
    // supers use the same motion as listed; attempt highest meter first
    const canSuper = this.superMeter[0] >= 1;
    if (!canSuper) return false;
    const list = [...this.cfg.supers].sort((a, b) => b.meter - a.meter);
    for (const s of list) {
      if (this.superMeter[0] < s.meter) continue;
      const kindOk = s.buttons.includes(btn) || btn === s.buttons[0];
      if (!kindOk) continue;
      // require qcf motion (or double for level 2/3 flavor)
      const ok = s.meter >= 2 ? detectMotion(hist, this.facing, 'qcf') : detectMotion(hist, this.facing, 'qcf');
      if (!ok) continue;
      const cost = s.meter;
      this.superMeter[0] -= cost;
      this.startMove(s, 'super');
      return true;
    }
    return false;
  }

  startSpecial(sp, forceEx = false) {
    this._lastSpecialInput = sp.input;
    const ex = forceEx || sp.ex;
    if (ex) {
      sp = { ...sp, ex: true, damage: Math.round((sp.damage || 700) * 1.28), hitstun: (sp.hitstun || 20) + 4,
        chip: (sp.chip ?? 0.15) * 1.2, startup: Math.max(3, (sp.startup || 10) - 2), color: sp.color || 0xffd166 };
      sp.name = sp.name + ' EX';
      this.addDrive(-1);
      this.game.fx.flashScreen(0xffd166, 0.22);
      this.game.audio.driveParry();
    } else {
      this.addDrive(-0.5);
    }
    this.startMove(sp, sp.cinematic ? 'super' : 'special');
    this._projCreated = 0;
    this._moveTimer = 0;
    this._spinFrames = 0;
  }

  // ============ UPDATE ============
  update(dt) {
    const g = this.game;
    this.animT += dt;
    this.rig.tickFlash(dt);
    // visuals first so the skeleton matches the freshly initialised state
    this._updateVisual(dt);
    if (this.hitstop > 0) { this.hitstop -= dt * FPS; return; }
    if (this.superFlash > 0) { this.superFlash -= dt; }
    if (this.invuln > 0) this.invuln -= dt * FPS;
    if (this.counterWindow > 0) this.counterWindow -= dt * FPS;
    if (this.stateFrame < 9999) this.stateFrame += dt * FPS;
    if (this.driveRushFrames > 0) this.driveRushFrames -= dt * FPS;
    if (this.juggle > 0) this.juggle -= dt * FPS * 0.2;

    // regen drive
    if (this.burnout) {
      this.drive = clamp(this.drive + 0.0125 * dt * FPS, 0, DRIVE_MAX);
      if (this.drive >= DRIVE_MAX) { this.burnout = false; this.drive = DRIVE_MAX; }
    } else if (this.state !== 'parry' && this.drive < DRIVE_MAX) {
      this.drive = clamp(this.drive + 0.0035 * dt * FPS, 0, DRIVE_MAX);
    }
    if (this.drive <= 0 && !this.burnout) this._enterBurnout();

    // dizzy meter decay
    if (this.dizzyMeter > 0) this.dizzyMeter -= dt * 6;

    // physics
    this._physics(dt);

    // state machine
    this._stateUpdate(dt);

    // contact push
    this._resolvePush();

  }

  _physics(dt) {
    const g = this.game;
    if (this.air || this.y > 0) {
      const gravMul = this.juggle > 0 ? 0.62 : 1;
      this.vy -= GRAVITY * gravMul * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.y <= 0) {
        this.y = 0;
        if (this.state === 'jump' || this.state === 'attack' || this.state === 'special' || this.state === 'hit') {
          this._land();
        }
        this.vy = 0;
      }
    } else {
      this.x += this.vx * dt;
      if (this.vx !== 0 && (this.state === 'idle' || this.state === 'walkF' || this.state === 'walkB' || this.state === 'crouch')) {
        this.vx = approach(this.vx, 0, 26 * dt);
      }
    }
    if (this.state === 'knockdown' && this.y <= 0) {
      this.vx = approach(this.vx, 0, 8 * dt);
    }
    this.x = clamp(this.x, -STAGE_HALF, STAGE_HALF);
  }

  _land() {
    const g = this.game;
    this.air = false;
    if (this.state === 'attack' && this.moveKind === 'normal' && this.currentMove.air) {
      this.currentMove = null; this.moveFrame = 0; this.movePhase = 'none';
    }
    this.vx *= 0.4;
    if (this.state === 'hit' && this.hitWasAir) {
      // air hit → knockdown on landing
      this._startKnockdown('soft');
      return;
    }
    if (this.state === 'knockdown') return;
    if (this.state === 'jump' || this.state === 'attack' || this.state === 'special' || this.state === 'super') {
      if (this.currentMove && this.moveKind !== 'normal') { /* special keeps going */ }
      this.state = 'land';
      this.stateFrame = 0;
      this.movePhase = 'land';
      this.landRecover = 6;
      this.vx = 0;
      this.game.fx.dust(this.x, this.z, 8);
      this.game.audio.noise({ dur: 0.1, vol: 0.12, type: 'lowpass', freq: 600 });
    } else if (this.state === 'thrown') {
      this._startKnockdown('hard');
    }
  }

  _startKnockdown(kind) {
    this.state = 'knockdown';
    this.stateFrame = 0;
    this.knockdownPhase = 'fall';
    this.hitWasAir = false;
    this.stun = 30;
    this.vx = sign(this.vx) * 4.4 * (this.facing > 0 ? 1 : 1);
    this.vy = kind === 'hard' ? 8.5 : 6.2;
    this.y = Math.max(this.y, 0.05);
    this.air = true;
    this.currentMove = null;
    this.game.fx.dust(this.x, this.z, 14);
    this.game.audio.hit(1.2, 'flesh', false, 0);
    this.game.camera.shake(0.32, 0.25);
  }

  _stateUpdate(dt) {
    const g = this.game;
    const f = dt * FPS;
    switch (this.state) {
      case 'idle': case 'walkF': case 'walkB': case 'crouch': case 'block': case 'parry': {
        if (this.stun > 0) { this.stun -= f; }
        this.blockstun = Math.max(0, this.blockstun - f);
        break;
      }
      case 'dash': {
        this.dashFrame += f;
        this.vx = this.dashDir * this.facing * 11 * this.cfg.dashSpeed * Math.max(0.2, 1 - this.dashFrame / 14);
        if (this.dashFrame >= 14) { this.state = 'idle'; this.vx = 0; }
        break;
      }
      case 'jump': {
        // air attacks
        if (!this.jumpAttackUsed && g.canAirAttack(this)) {
          const s = g.input.getSample(this.playerIndex);
          if (s && s.pressed) {
            const btn = ['LP','MP','HP','LK','MK','HK'].find((b, i) => s.pressed & (1 << i));
            if (btn) {
              const mv = this.cfg._normalsById[btn + 'A'];
              if (mv) { this.jumpAttackUsed = true; this.startMove(mv, 'normal'); }
            }
          }
        }
        break;
      }
      case 'attack': case 'special': case 'super': {
        this._moveUpdate(dt);
        break;
      }
      case 'driveImpact': {
        this._moveUpdate(dt);
        break;
      }
      case 'driveReversal': {
        this._moveUpdate(dt);
        break;
      }
      case 'hit': {
        this.stun -= f;
        if (this.y > 0) { /* air juggle */ }
        if (this.stun <= 0) {
          if (this.y > 0) { /* wait */ }
          else { this.state = 'idle'; this.stateFrame = 0; this.vx = 0; this.hitWasAir = false; }
        }
        if (this.x <= -STAGE_HALF || this.x >= STAGE_HALF) this.game.wallBounce(this);
        break;
      }
      case 'knockdown': {
        if (this.y > 0) {
          // falling
        } else {
          if (this.knockdownPhase === 'fall') {
            this.knockdownPhase = 'down';
            this.stun = 22;
            this.air = false;
            this.game.camera.shake(0.5, 0.35);
            this.game.fx.dust(this.x, this.z, 18);
            const snd = () => this.game.audio.hit(1.4, 'flesh');
            snd();
          } else if (this.knockdownPhase === 'down') {
            this.stun -= f;
            if (this.stun <= 0) { this.knockdownPhase = 'wakeup'; this.stun = 20; this.wakePhase = 'kneel'; this.invuln = 1; }
          } else if (this.knockdownPhase === 'wakeup') {
            this.stun -= f;
            if (this.stun <= 8) this.wakePhase = 'up';
            if (this.stun <= 0) { this.state = 'idle'; this.stateFrame = 0; this.invuln = 0; this.juggle = 0; this.comboHits = 0; this.vx = 0; }
          }
        }
        break;
      }
      case 'land': {
        this.stun = (this.stun || 0) - f;
        this.landRecover -= f;
        if (this.landRecover <= 0) { this.state = 'idle'; this.stateFrame = 0; }
        break;
      }
      case 'dizzy': {
        this.stun -= f;
        if (this.stun <= 0) { this.state = 'idle'; this.dizzyTimer = 0; }
        break;
      }
      case 'stagger': {
        this.stun -= f;
        if (this.stun <= 0) { this.state = 'idle'; }
        break;
      }
      case 'throwStart': {
        this._throwUpdate(dt);
        break;
      }
      case 'thrown': {
        this._thrownUpdate(dt);
        break;
      }
      case 'driveRush': {
        if (this.driveRushFrames <= 0) { this.state = 'idle'; this.vx = 0; }
        break;
      }
      case 'ko': {
        break;
      }
      case 'intro': case 'win': {
        break;
      }
    }
  }

  _moveUpdate(dt) {
    const g = this.game;
    const mv = this.currentMove;
    if (!mv) { this.state = 'idle'; return; }
    const f = dt * FPS;
    this.moveFrame += f;
    const total = mv.startup + mv.active + mv.recovery;
    this.movePhase = this.moveFrame < mv.startup ? 'startup' : this.moveFrame < mv.startup + mv.active ? 'active' : 'recovery';

    // movement during moves
    if (mv.motion) {
      const m = mv.motion;
      const t = this.moveFrame;
      if (m.type === 'lunge' && t < m.frames + mv.startup * 0.3) {
        this.vx = this.facing * m.speed * (1 - t / (m.frames + 8));
      } else if (m.type === 'rise') {
        if (t >= mv.startup - 2 && t < mv.startup + m.frames) {
          if (!this._rose) { this._rose = true; this.vy = m.speed * 0.5; this.air = true; this.y = Math.max(this.y, 0.02); this.vy = 7; }
        }
      } else if (m.type === 'dash') {
        if (t < m.frames) this.vx = this.facing * m.speed;
        else this.vx = 0;
      } else if (m.type === 'teleport') {
        if (!this._tpDone && t >= mv.startup * 0.5) {
          this._tpDone = true;
          g.fx.teleportPoof(this);
          const opp = this.opponent;
          if (opp) this.x = opp.x - sign(opp.x - this.x) * m.speed;
          g.fx.teleportPoof(this);
          this.facing = opp ? sign(opp.x - this.x) : this.facing;
        }
        this.vx = 0;
      } else if (m.type === 'stomp') {
        if (t < 8) this.vx = this.facing * 2;
        else this.vx = 0;
      } else if (m.type === 'leap') {
        if (t >= mv.startup - 3 && t < mv.startup + 6) { if (!this._leaped) { this._leaped = true; this.vy = m.speed * 0.62; this.air = true; this.y = Math.max(this.y, 0.02); this.vx = this.facing * m.speed * 0.55; } }
      }
    }

    // spinning visuals
    if (mv.anim === 'spin' || mv.anim === 'kickstorm') {
      this._spinFrames = (this._spinFrames || 0) + f;
      this.rig.group.rotation.y += (mv.anim === 'kickstorm' ? 0.52 : 0.34) * f * this.facing;
    }

    // EX flash effect
    if (mv.ex && this.moveFrame < 4) this.rig.flash(0xffffff, 0.4);

    // projectile spawn
    if (mv.proj && this.moveFrame >= mv.startup) {
      if (!this._projCreated || (mv.ex && this._projCreated < (mv.proj.count || 1) + 1)) {
        this._projCreated = (this._projCreated || 0) + 1;
        g.spawnProjectile(this, mv.proj, this._projCreated);
        if (!mv.ex || this._projCreated >= 1) this._projCreated = 100;
      }
    }
    if (mv.beamObj && this.moveFrame >= mv.startup && !this._beamStarted) {
      this._beamStarted = true;
      g.spawnBeam(this, mv.beamObj);
    }

    // active hitbox collision
    if (this.movePhase === 'active' && mv.hitbox && !mv.commandGrab) {
      g.resolveAttack(this, mv, dt);
    }
    if (mv.commandGrab && this.movePhase === 'active') {
      g.resolveCommandGrab(this, mv);
    }

    // charge drive rush
    if (this.driveRushCharge && this.moveFrame > mv.startup + mv.active) {
      // handled in game
    }

    // move end
    if (this.moveFrame >= total) {
      this.endMove();
    }
    // cancel window
    if (this.movePhase === 'active' || (this.movePhase === 'recovery' && this.moveFrame < mv.startup + mv.active + 4)) {
      if (this.hitCount > 0 || mv.type === 'special' || mv.type === 'super') {
        // allow chain/special cancels
        this.cancelWindow = 1;
      }
    } else this.cancelWindow = 0;
    if (this.cancelWindow > 0 && (mv.cancel?.special || mv.cancel?.super)) {
      this._tryCancel();
    }
    // chain normals on hit
    if (this.cancelWindow > 0 && mv.cancel?.chain && this.hitCount > 0) {
      const s = g.input.getSample(this.playerIndex);
      if (s && s.pressed) {
        const btn = ['LP','MP','HP','LK','MK','HK'].find((b, i) => s.pressed & (1 << i));
        if (btn && !this._chainUsed) {
          const next = this.cfg._normalsById[btn + (this.crouching ? 'C' : 'S')];
          if (next && next.damage < mv.damage * 1.3) {
            this._chainUsed = true;
            this.startMove(next, 'normal');
            this._chainUsed = false;
            this.comboFrom = this.id;
          }
        }
      }
    }
    // drive rush extension
    if (this.currentMove && this.driveRushFrames > 0 && this.moveFrame < 4) { /* handled */ }
  }

  _tryCancel() {
    const g = this.game;
    const mv = this.currentMove;
    const s = this.lastSample || g.input.getSample(this.playerIndex);
    if (!s || !s.pressed) return;
    const hist = this._motionHistory();
    const btnList = [];
    if (s.pressed & 1) btnList.push('LP');
    if (s.pressed & 2) btnList.push('MP');
    if (s.pressed & 4) btnList.push('HP');
    if (s.pressed & 8) btnList.push('LK');
    if (s.pressed & 16) btnList.push('MK');
    if (s.pressed & 32) btnList.push('HK');
    for (const b of btnList) {
      if (mv.cancel?.super && this.trySuper(hist, b)) return;
      if (mv.cancel?.special) {
        for (const sp of this.cfg.specials) {
          if (!sp.buttons.includes(b)) continue;
          if (this.superMeter[0] >= 3) { /* skip supers here */ }
          if (!this._specialInputOk(sp, hist)) continue;
          if (this.drive < (sp.ex ? 1 : 0.5)) continue;
          this.startSpecial(sp);
          return;
        }
      }
    }
  }

  endMove() {
    const g = this.game;
    const mv = this.currentMove;
    if (this.state === 'driveImpact') { this.armor = 0; }
    if (g.onMoveEnd) g.onMoveEnd(this, mv);
    this.currentMove = null;
    this.moveFrame = 0;
    this.movePhase = 'none';
    this.hitCount = 0;
    this._projCreated = 0; this._rose = false; this._tpDone = false; this._leaped = false; this._beamStarted = false;
    this._spinFrames = 0;
    this.rig.group.rotation.y = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (this.state !== 'knockdown' && this.state !== 'ko') {
      this.state = this.air ? 'jump' : 'idle';
      this.stateFrame = 0;
    }
    if (g.onMoveEndClear) g.onMoveEndClear(this);
  }

  _throwUpdate(dt) {
    const g = this.game;
    const f = dt * FPS;
    this.throwFrame += f;
    const opp = this.opponent;
    if (this.throwFrame < 1.2 && this._throwFrameInitial === undefined) { this._throwFrameInitial = 1; }
    if (this.throwFrame <= 3) {
      // grab check happens in game resolveThrows
    } else if (this.throwFrame > 3 && this.throwFrame < 10) {
      // hold
    } else if (this.throwFrame >= 10 && this.throwFrame < 26) {
      if (this._thrownOpp) {
        this._thrownOpp.y = 1.1 + Math.sin((this.throwFrame - 10) / 16 * Math.PI) * 0.6;
        this._thrownOpp.x = this.x + this.facing * (0.55 + (this.throwFrame - 10) / 16 * 0.6);
        this._thrownOpp.z = this.z;
      }
    } else if (this.throwFrame >= 26) {
      if (this._thrownOpp) {
        const t = this._thrownOpp;
        t.y = Math.max(0, t.y);
        t._startKnockdown('hard');
        t.vx = this.facing * 5;
        const dmg = this._throwDamage || 1200;
        t.health -= dmg;
        t.lastDamageTaken = dmg;
        g.stats[this.playerIndex].damage += Math.round(dmg);
        g.stats[this.playerIndex].hits++;
        if (g.currentMode === 'training') { g.training.sessionDamage += Math.round(dmg); g.training.lastDamage = Math.round(dmg); g.training.lastHits = 1; }
        g.audio.throwHit();
        g.fx.hitSpark(t.x, 1.0, t.z, 0xffcc66, 20);
        g.camera.shake(0.55, 0.3);
        if (t.health <= 0) g.checkKO(t);
        this._thrownOpp = null;
      }
      this.state = 'idle';
      this.currentMove = null;
      this.stateFrame = 0;
    }
  }

  _thrownUpdate(dt) {
    const f = dt * FPS;
    this.stun -= f;
    if (this.stun <= 0) { this.state = 'idle'; this.stun = 0; }
  }

  // Contact pushbox
  _resolvePush() {
    const g = this.game;
    const opp = this.opponent;
    if (!opp) return;
    if (this.state === 'thrown' || opp.state === 'thrown') return;
    const minDist = 0.6 * ((this.cfg.body.bulk + opp.cfg.body.bulk) / 2);
    const dz = this.z - opp.z;
    const dx = this.x - opp.x;
    if (Math.abs(dz) < 0.62 && Math.abs(dx) < minDist) {
      const overlap = minDist - Math.abs(dx);
      const dir = sign(dx) || (this.side === 0 ? -1 : 1);
      const move = overlap * 0.5 * dir;
      const isCorner = (this.x > STAGE_HALF - 0.1 && dir > 0) || (this.x < -STAGE_HALF + 0.1 && dir < 0);
      const isCornerOpp = (opp.x > STAGE_HALF - 0.1 && dir < 0) || (opp.x < -STAGE_HALF + 0.1 && dir > 0);
      if (!isCorner) this.x += move;
      if (!isCornerOpp) opp.x -= move * (isCorner ? 1.6 : 1);
      // ensure they don't overlap
      if (isCorner) opp.x -= move * 1.2;
      this.x = clamp(this.x, -STAGE_HALF, STAGE_HALF);
      opp.x = clamp(opp.x, -STAGE_HALF, STAGE_HALF);
    }
  }

  // ============ VISUAL ============
  _applyVisualOnly(dt) {
    // during hitstop keep pose but add shake
    const jitter = this.hitstop > 0 ? Math.sin(this.game.frame * 3.1) * 0.02 : 0;
    this._syncTransform(jitter);
    this.rig.update(dt);
  }

  _syncTransform(jitter = 0) {
    const p = this.rig.group.position;
    p.x = this.x;
    p.y = this.y;
    p.z = this.z + jitter;
    const baseYaw = this.facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (this.state !== 'super' && this.state !== 'special' || (this.currentMove?.anim !== 'spin' && this.currentMove?.anim !== 'kickstorm')) {
      this.rig.group.rotation.y = baseYaw;
    }
  }

  setFacingVisual(f) {
    this.facing = f;
    const yaw = f > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.rig.group.rotation.y = yaw;
  }

  _updateVisual(dt) {
    this._syncTransform(0);
    // choose pose
    let pose;
    if (this.cinematic && this.cinematic.t >= 0) {
      pose = this._cinematicPose(dt);
    } else if (this.currentMove && this.currentMove._anim) {
      pose = this._movePose(dt);
      // "stretch" assist: extend the attacking limb toward max reach so the
      // visuals match the hitbox reach regardless of body proportions.
      if (pose && this.movePhase === 'active' && this.currentMove.hitbox) {
        const reachBoost = clamp((this.currentMove.hitbox.reach ?? 0.6) - 0.55, 0, 0.75);
        if (reachBoost > 0.02) {
          const bone = this.currentMove.hitbox.bone;
          const isFoot = bone === 'footA' || bone === 'footB';
          const side = isFoot ? (bone === 'footA' ? 'A' : 'B') : (bone === 'handA' ? 'A' : 'B');
          if (!isFoot) {
            pose = { ...pose, [`arm${side}`]: (pose[`arm${side}`] || [0, 0, 0]).slice(), [`fore${side}`]: (pose[`fore${side}`] || [0, 0, 0]).slice(), chest: (pose.chest || [0, 0, 0]).slice() };
            pose.hipZ = (pose.hipZ || 0) + this.facing * reachBoost * 0.5;
            pose.chest[1] += this.facing * reachBoost * 0.45;
          } else {
            pose = { ...pose, [`thigh${side}`]: (pose[`thigh${side}`] || [0, 0, 0]).slice(), [`shin${side}`]: (pose[`shin${side}`] || [0, 0, 0]).slice() };
            pose[`thigh${side}`][0] -= reachBoost * 0.5;
            pose[`shin${side}`][0] = Math.min(pose[`shin${side}`][0], 0.1);
          }
        }
      }
        } else if (this.state === 'throwStart') {
      pose = getPose(this.throwFrame < 10 ? 'throwGrab' : this.throwFrame < 26 ? 'throwLift' : 'throwSlam');
    } else {
      pose = this._poseForState(this.animT);
    }
    const rate = this.currentMove ? 0.78 : this.state === 'hit' ? 0.9 : 0.42;
    if (pose) this.rig.setPose(pose, 1 - Math.pow(1 - rate, dt * 60));
    this.rig.update(dt);

    // aura ring follows
    this.aura.group.position.set(this.x, this.y + 0.02, this.z);
    const active = this.state === 'parry' || this.driveRushFrames > 0 || (this.superFlash > 0);
    const opacity = active ? 0.5 + Math.sin(performance.now() * 0.02) * 0.2 : 0;
    this.aura.mat.opacity = damp(this.aura.mat.opacity, opacity, 8, dt);
    this.aura.mat2.opacity = damp(this.aura.mat2.opacity, opacity * 0.6, 8, dt);
  }

  _cinematicPose(dt) {
    const c = this.cinematic;
    c.t += dt;
    const mv = c.move;
    const anim = mv._anim || getPose('superCharge');
    if (c.t < 0.5) {
      // charge pose with rising arms
      const p = mixPose(getPose('superCharge'), anim.wind, clamp(c.t / 0.5, 0, 1));
      return p;
    }
    const total = (mv.startup + mv.active + mv.recovery) / FPS;
    const elapsed = c.t - 0.5;
    if (elapsed < mv.startup / FPS) return anim.wind;
    if (elapsed < (mv.startup + mv.active) / FPS) return anim.active;
    return anim.follow;
  }

  _movePose(dt) {
    const mv = this.currentMove;
    const anim = mv._anim;
    if (!anim) return null;
    const f = this.moveFrame;
    const s = mv.startup, a = mv.active, r = mv.recovery;
    const total = s + a + r;
    if (mv.cinematic && this.cinematic) return this._cinematicPose(dt);
    if (f < s * 0.72) {
      // windup: blend stance→wind
      const t = clamp(f / Math.max(1, s * 0.72), 0, 1);
      return mixPose(getPose(mv.crouch ? 'crouch' : 'stance'), anim.wind, t * 0.9);
    } else if (f < s) {
      return anim.wind;
    } else if (f < s + a) {
      return anim.active;
    } else if (f < s + a + Math.min(6, r * 0.4)) {
      return anim.follow;
    } else {
      const t = clamp((f - (s + a + 3)) / Math.max(1, r), 0, 1);
      return mixPose(anim.follow, getPose(mv.crouch ? 'crouch' : 'stance'), t * 0.7);
    }
  }

  dispose() {
    this.scene.remove(this.rig.group);
    this.scene.remove(this.aura.group);
  }

  get opponent() { return this.game.fighters[1 - this.playerIndex]; }
}
