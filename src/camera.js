// Dynamic fight camera with shake, zoom, cinematic super shots.
import * as THREE from 'three';
import { clamp, lerp, damp, rand, sign } from './utils.js';

export class FightCamera {
  constructor(aspect = 1.78) {
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 220);
    this.camera.position.set(0, 3.2, 9.5);
    this.camera.lookAt(0, 1.2, 0);
    this.shakeAmt = 0;
    this.shakeDur = 0;
    this.shakeT = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.mode = 'fight';
    this.cine = null;
    this.pan = new THREE.Vector3();
    this.impulse = 0;
    this.angle = 0;
    this.baseAngle = 0;
    this.orbit = 0;
  }

  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }

  shake(amt = 0.2, dur = 0.2) {
    if (amt > this.shakeAmt * 0.6) { this.shakeAmt = Math.max(this.shakeAmt, amt); }
    this.shakeT = Math.max(this.shakeT, dur);
    this.shakeDur = Math.max(this.shakeDur, dur);
  }

  punchIn(amt = 0.35) { this.impulse = Math.max(this.impulse, amt); }

  update(dt, p1, p2, frameHz) {
    if (!p1 || !p2) return;
    const midX = (p1.x + p2.x) * 0.5;
    const midZ = (p1.z + p2.z) * 0.5;
    const midY = (p1.y + p2.y) * 0.5 + 1.0;
    const dist = Math.abs(p1.x - p2.x);
    const airY = Math.max(p1.y, p2.y);

    this.shakeT = Math.max(0, this.shakeT - dt);
    this.impulse = damp(this.impulse, 0, 7, dt);

    if (this.cine) {
      this._updateCine(dt, this.cine, p1, p2);
      return;
    }

    // dynamic zoom: closer when close together
    const targetZoom = clamp(0.96 - (dist - 1.2) * 0.026, 0.62, 0.96);
    this.zoom = damp(this.zoom, targetZoom, 3.4, dt);

    const baseDist = 8.1 * this.zoom + this.impulse * 1.6;
    const baseHeight = 2.6 * this.zoom + airY * 0.34;
    const lookX = midX * 0.94;
    const lookY = 1.16 + (airY > 0.4 ? Math.min(airY * 0.6, 2.0) : 0);
    const lookZ = midZ * 0.65;

    this.angle = this.baseAngle;
    const camX = lookX + Math.sin(this.angle) * baseDist * 0.55;
    const camZ = lookZ + Math.cos(this.angle) * baseDist;
    const camY = baseHeight + 0.2;

    this.camera.position.x = damp(this.camera.position.x, camX, 6, dt);
    this.camera.position.y = damp(this.camera.position.y, camY, 5, dt);
    this.camera.position.z = damp(this.camera.position.z, camZ, 6, dt);

    this.pan.set(lookX * 0.2, lookY, lookZ);
    this._lookAt(lerp(lookX * 0.35, lookX, 1), lookY, lookZ);

    this._applyShake(dt);
    this.camera.fov = damp(this.camera.fov, 42 + this.impulse * 8, 6, dt);
    this.camera.updateProjectionMatrix();
  }

  _lookAt(x, y, z) {
    this.camera.lookAt(x, y, z);
  }

  _applyShake(dt) {
    if (this.shakeT > 0) {
      const k = this.shakeT / Math.max(0.001, this.shakeDur);
      const amt = this.shakeAmt * k * k;
      this.camera.position.x += rand(-amt, amt);
      this.camera.position.y += rand(-amt, amt) * 0.7;
      this.camera.position.z += rand(-amt, amt) * 0.5;
      this.camera.rotation.z += rand(-amt, amt) * 0.03;
      if (this.shakeT <= 0) this.shakeAmt = 0;
    }
  }

  startSuperCine(fighter, opponent, level, color) {
    const fSign = fighter.facing;
    this.cine = {
      t: 0, dur: 2.1, level, color,
      type: 'super', fighter, opponent,
      from: this.camera.position.clone(),
      phase: 'approach',
      startDist: Math.abs(fighter.x - opponent.x),
    };
    // dramatic close shot in front of attacker
    const fx = fighter.x + fSign * 0.0;
    const target = new THREE.Vector3(fx + fSign * 1.9, fighter.y + 1.5, fighter.z + 2.35);
    const look = new THREE.Vector3(fx + fSign * 0.35, fighter.y + 1.25, fighter.z);
    this.cine.camPos = target;
    this.cine.lookPos = look;
    this.cine.fromLook = new THREE.Vector3(fighter.x, 1.2, fighter.z);
    this.cine.startCam = this.camera.position.clone();
  }

  startCinematicKO(winner, loser) {
    this.cine = {
      t: 0, dur: 2.4, type: 'ko', phase: 'orbit',
      winner, loser, angle: 0, radius: 5.4, height: 1.5,
      look: new THREE.Vector3(loser.x, 0.6, loser.z),
    };
  }

  startIntroCamera(p1, p2) {
    this.cine = { t: 0, dur: 2.2, type: 'intro', phase: 'pan', p1, p2 };
  }

  endCine() { this.cine = null; }

  startVictoryCam(winner) {
    this.cine = {
      t: 0, dur: 4.0, type: 'victory', winner, phase: 'orbit',
      angle: winner.facing > 0 ? -0.5 : 0.5, radius: 4.2, height: 1.6,
    };
  }

  _updateCine(dt, cine, p1, p2) {
    cine.t += dt;
    const t = cine.t;
    if (cine.type === 'super') {
      // 0-0.55: whip to closeup, 0.55-1.35: hold on attacker, then pull back
      const targetPos = cine.camPos;
      const look = cine.lookPos;
      if (t < 0.5) {
        const k = t / 0.5;
        const e = 1 - Math.pow(1 - k, 3);
        this.camera.position.lerpVectors(cine.startCam, targetPos, e);
        const lk = new THREE.Vector3().lerpVectors(cine.fromLook.set(cine.fighter.x, 1.2, cine.fighter.z), look, e);
        this.camera.lookAt(lk);
        this.camera.fov = lerp(42, 30, e);
      } else if (t < 1.25) {
        // slow drift around attacker
        const k = (t - 0.5) / 0.75;
        const drift = Math.sin(k * Math.PI) * 0.18;
        this.camera.position.set(targetPos.x + drift * cine.fighter.facing, targetPos.y + Math.sin(k * Math.PI) * 0.12, targetPos.z + drift * 0.6);
        this.camera.lookAt(look.x, look.y + Math.sin(k * Math.PI) * 0.06, look.z);
        this.camera.fov = 30;
      } else if (t < 1.7) {
        const k = (t - 1.25) / 0.45;
        const endPos = new THREE.Vector3((p1.x + p2.x) / 2 * 0.9, 2.9, 9.0);
        this.camera.position.lerpVectors(this.camera.position, endPos, k * 0.6);
        this.camera.lookAt((p1.x + p2.x) / 2, 1.2, 0);
        this.camera.fov = lerp(30, 44, k);
      } else {
        this.cine = null;
      }
      this.camera.updateProjectionMatrix();
      this._applyShake(dt);
      return;
    }
    if (cine.type === 'ko') {
      cine.angle += dt * 1.1;
      const cx = cine.loser.x + Math.sin(cine.angle) * cine.radius;
      const cz = cine.loser.z + Math.cos(cine.angle) * cine.radius;
      this.camera.position.x = damp(this.camera.position.x, cx, 2.6, dt);
      this.camera.position.y = damp(this.camera.position.y, cine.height + 0.5, 2.6, dt);
      this.camera.position.z = damp(this.camera.position.z, cz, 2.6, dt);
      this.camera.lookAt(cine.loser.x, 0.8, cine.loser.z);
      this.camera.fov = damp(this.camera.fov, 36, 2, dt);
      this.camera.updateProjectionMatrix();
      if (t > cine.dur) this.cine = null;
      this._applyShake(dt);
      return;
    }
    if (cine.type === 'intro') {
      const k = clamp(t / 1.6, 0, 1);
      const a = lerp(0.9, 0.0, k);
      const dist = lerp(7.5, 9.3, k);
      const mx = (cine.p1.x + cine.p2.x) / 2;
      this.camera.position.set(mx + Math.sin(a) * 3.2, lerp(1.1, 3.0, k), Math.cos(a) * dist);
      this.camera.lookAt(mx * 0.6, lerp(1.35, 1.15, k), 0);
      this.camera.fov = lerp(34, 42, k);
      this.camera.updateProjectionMatrix();
      if (t > cine.dur) this.cine = null;
      return;
    }
    if (cine.type === 'victory') {
      cine.angle += dt * 0.42;
      const r = cine.radius;
      const w = cine.winner;
      const cx = w.x + Math.sin(cine.angle) * r;
      const cz = w.z + Math.cos(cine.angle) * r + 1.0;
      this.camera.position.x = damp(this.camera.position.x, cx, 2.2, dt);
      this.camera.position.y = damp(this.camera.position.y, 1.5, 2.2, dt);
      this.camera.position.z = damp(this.camera.position.z, cz, 2.2, dt);
      this.camera.lookAt(w.x, 1.1, w.z);
      this.camera.fov = damp(this.camera.fov, 40, 2, dt);
      this.camera.updateProjectionMatrix();
      if (t > cine.dur) this.cine = null;
      return;
    }
    this.cine = null;
  }
}
