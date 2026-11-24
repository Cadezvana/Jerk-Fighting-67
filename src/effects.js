// Particles, impact FX, projectiles, beams, screen flashes.
import * as THREE from 'three';
import { rand, randInt, clamp, lerp, sign } from './utils.js';

function makeSpriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function makeStarTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.translate(64, 64);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath();
    ctx.moveTo(0, -62); ctx.lineTo(10, 0); ctx.lineTo(0, 62); ctx.lineTo(-10, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  return new THREE.CanvasTexture(c);
}
function makeRingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.4; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.arc(64, 64, 52, 0, Math.PI * 2); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.tex = makeSpriteTexture();
    this.starTex = makeStarTexture();
    this.ringTex = makeRingTexture();

    this.particles = [];
    this.pool = [];
    this.maxParticles = 340;
    const ringGeo = new THREE.RingGeometry(0.4, 0.46, 32);
    this.ringGeo = ringGeo;
    for (let i = 0; i < this.maxParticles; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      sp.scale.setScalar(0.3);
      this.scene.add(sp);
      this.pool.push({ spr: sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, size: 0.3, spin: 0, type: 'spark' });
    }
    this.rings = [];
    for (let i = 0; i < 24; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const m = new THREE.Mesh(ringGeo, mat);
      m.visible = false; m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.rings.push({ mesh: m, life: 0, max: 1, size0: 0.3, size1: 1.4, flat: true });
    }
    this.projectiles = [];
    this.beams = [];
    this.afterimages = [];
    this.screenFlash = 0;
    this.screenFlashColor = new THREE.Color(1, 1, 1);
    this.hitmarks = [];
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.starTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(mat);
      sp.visible = false; this.scene.add(sp);
      this.hitmarks.push({ spr: sp, life: 0, max: 1, rot: 0 });
    }
    this.overlay = document.getElementById('flash-overlay');
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.id = 'flash-overlay';
      this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;opacity:0;background:#fff;mix-blend-mode:screen;transition:opacity .08s';
      document.getElementById('app').appendChild(this.overlay);
    }
  }

  _spawn(type, x, y, z, opts = {}) {
    let p = null;
    for (const q of this.pool) if (q.life <= 0) { p = q; break; }
    if (!p) return null;
    p.spr.visible = true;
    p.life = opts.life ?? 0.4; p.max = p.life;
    p.vx = opts.vx ?? rand(-2, 2); p.vy = opts.vy ?? rand(0, 3); p.vz = opts.vz ?? rand(-1, 1);
    p.grav = opts.grav ?? -6; p.drag = opts.drag ?? 1.6;
    p.size = opts.size ?? 0.3;
    p.spr.position.set(x, y, z);
    p.spr.material.color.setHex(opts.color ?? 0xffffff);
    p.spr.material.opacity = 1;
    p.spr.material.map = opts.star ? this.starTex : this.tex;
    p.spr.scale.setScalar(p.size);
    p.spr.material.rotation = opts.rot ?? 0;
    p.spin = opts.spin ?? 0;
    p.type = type;
    p.fade = opts.fade ?? 1;
    p.grow = opts.grow ?? 0;
    return p;
  }

  _ring(x, y, z, opts = {}) {
    let r = this.rings.find((q) => q.life <= 0);
    if (!r) return;
    r.life = opts.life ?? 0.4; r.max = r.life;
    r.mesh.visible = true;
    r.mesh.position.set(x, y, z);
    r.mesh.material.color.setHex(opts.color ?? 0xffffff);
    r.mesh.material.opacity = opts.opacity ?? 0.9;
    r.size0 = opts.size0 ?? 0.2; r.size1 = opts.size1 ?? 1.4;
    r.mesh.scale.setScalar(r.size0);
    r.mesh.rotation.set(opts.flat === false ? 0 : -Math.PI / 2, 0, 0);
    r.mesh.material.side = THREE.DoubleSide;
    r.flat = opts.flat !== false;
    r.fade = opts.fade ?? 1;
    r.spin = opts.spin ?? 0;
    r.tag = opts.tag;
  }

  hitSpark(x, y, z, color = 0xffdd66, count = 12, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(2, 7) * power;
      this._spawn('spark', x, y, z, {
        vx: Math.cos(a) * sp * 0.55, vy: rand(-0.6, 1.6) * sp * 0.7, vz: Math.sin(a) * sp * 0.5,
        life: rand(0.18, 0.4), size: rand(0.12, 0.32) * power, color, grav: -7, drag: 2.2, star: i % 3 === 0,
      });
    }
    this._ring(x, y, z, { size0: 0.12, size1: 0.85 * power, life: 0.24, color, flat: false, opacity: 0.85 });
    this._spawn('flash', x, y, z, { life: 0.09, size: 1.2 * power, color: 0xffffff, grav: 0, drag: 0, vx: 0, vy: 0, vz: 0 });
    this.hitmark(x, y, z, color, power);
  }

  hitmark(x, y, z, color = 0xffffff, power = 1) {
    const h = this.hitmarks.find((q) => q.life <= 0);
    if (!h) return;
    h.life = 0.16; h.max = 0.16;
    h.spr.visible = true;
    h.spr.position.set(x, y, z + 0.1);
    h.spr.material.color.setHex(color);
    h.spr.material.opacity = 1;
    h.spr.scale.setScalar(rand(0.9, 1.3) * power);
    h.rot = rand(0, Math.PI);
    h.spr.material.rotation = h.rot;
  }

  blockSpark(x, y, z, color = 0x66ccff, count = 8) {
    for (let i = 0; i < count; i++) {
      this._spawn('spark', x, y, z, {
        vx: rand(-2, 2), vy: rand(0, 3), vz: rand(1.5, 4),
        life: rand(0.12, 0.26), size: rand(0.1, 0.2), color, grav: -4, drag: 2, star: true,
      });
    }
    this._ring(x, y, z, { size0: 0.1, size1: 0.5, life: 0.18, color, flat: false });
  }

  parryFlash(fighter) {
    const y = fighter.y + 1.15;
    this._ring(fighter.x, y, fighter.z, { size0: 0.3, size1: 2.2, life: 0.42, color: 0x9fe8ff, flat: false, opacity: 0.95 });
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('spark', fighter.x, y, fighter.z, {
        vx: Math.cos(a) * rand(1, 6), vy: rand(-1, 4), vz: Math.sin(a) * rand(1, 4),
        life: rand(0.2, 0.45), size: rand(0.1, 0.26), color: 0xbdf3ff, grav: -3, drag: 2.6, star: true,
      });
    }
    this.flashScreen(0x9fe8ff, 0.28);
  }

  driveImpactCharge(fighter) {
    this._ring(fighter.x, fighter.y + 0.05, fighter.z, { size0: 0.3, size1: 2.0, life: 0.5, color: 0xffc93c, opacity: 0.8 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('spark', fighter.x + Math.cos(a) * 1.2, 0.1, fighter.z + Math.sin(a) * 1.2, {
        vx: -Math.cos(a) * rand(3, 6), vy: rand(0.2, 1.5), vz: -Math.sin(a) * rand(2, 4),
        life: rand(0.25, 0.4), size: rand(0.12, 0.24), color: 0xffc93c, grav: 0, drag: 1.2,
      });
    }
  }

  dust(x, z, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(0.5, 2.5);
      this._spawn('dust', x + Math.cos(a) * rand(0, 0.3), rand(0.02, 0.15), z + Math.sin(a) * rand(0, 0.3), {
        vx: Math.cos(a) * sp, vy: rand(0.3, 1.3), vz: Math.sin(a) * sp * 0.7,
        life: rand(0.3, 0.6), size: rand(0.16, 0.36), color: 0xb0a08a, grav: -1.5, drag: 2.4, fade: 0.6,
      });
    }
  }

  burnoutBurst(f) {
    this._ring(f.x, f.y + 0.1, f.z, { size0: 0.2, size1: 2.6, life: 0.6, color: 0xff2d3d, opacity: 0.9 });
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('spark', f.x, 0.4 + rand(0, 0.8), f.z, {
        vx: Math.cos(a) * rand(1, 4), vy: rand(1, 5), vz: Math.sin(a) * rand(1, 4),
        life: rand(0.4, 0.9), size: rand(0.1, 0.3), color: 0xff4b6e, grav: -3, drag: 1.4,
      });
    }
    this.flashScreen(0xff2d3d, 0.2);
  }

  teleportPoof(f) {
    for (let i = 0; i < 16; i++) {
      this._spawn('dust', f.x + rand(-0.3, 0.3), rand(0.1, 1.8), f.z + rand(-0.3, 0.3), {
        vx: rand(-1, 1), vy: rand(0.2, 1.6), vz: rand(-1, 1),
        life: rand(0.25, 0.5), size: rand(0.2, 0.45), color: 0x7a3aff, grav: 0.4, drag: 2.6, fade: 0.7,
      });
    }
  }

  superCharge(f, color, level) {
    const y = f.y + 1.0;
    this._ring(f.x, y, f.z, { size0: 0.2, size1: 4.5, life: 0.9, color, opacity: 1, flat: false });
    this._ring(f.x, 0.05, f.z, { size0: 0.3, size1: 3.2, life: 0.8, color, opacity: 0.9 });
    for (let i = 0; i < 46; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0.6, 2.4);
      this._spawn('spark', f.x + Math.cos(a) * r, y + rand(-0.8, 1.0), f.z + Math.sin(a) * r, {
        vx: -Math.cos(a) * rand(2, 7), vy: rand(0.5, 3), vz: -Math.sin(a) * rand(2, 7),
        life: rand(0.3, 0.7), size: rand(0.12, 0.4), color, grav: 1.2, drag: 0.6, star: i % 2 === 0,
      });
    }
    for (let i = 0; i < 3 + level; i++) {
      const a = (i / (3 + level)) * Math.PI * 2;
      this._spawn('beam', f.x + Math.cos(a) * 2, y + rand(-0.4, 0.6), f.z + Math.sin(a) * 2, {
        vx: -Math.cos(a) * 9, vy: 0.5, vz: -Math.sin(a) * 9, life: 0.35, size: 0.6, color, grav: 0, drag: 0,
      });
    }
    this.flashScreen(color, 0.45 + level * 0.1);
  }

  wallBounce(x, y, z, color = 0xffcc66) {
    this._ring(x, y, z, { size0: 0.3, size1: 2.2, life: 0.45, color, flat: false });
    for (let i = 0; i < 20; i++) {
      this._spawn('spark', x, y, z, {
        vx: rand(-4, 4), vy: rand(0, 5), vz: rand(0, 4),
        life: rand(0.2, 0.5), size: rand(0.1, 0.3), color, grav: -8, drag: 1.5, star: true,
      });
    }
    for (let i = 0; i < 8; i++) {
      this._spawn('dust', x, rand(0.1, 0.8), z + rand(-0.4, 0.4), {
        vx: rand(-1, 1), vy: rand(0.2, 1.2), vz: rand(-1, 1), life: rand(0.4, 0.8), size: rand(0.24, 0.5),
        color: 0xc8b89a, grav: -1.2, drag: 2,
      });
    }
    this.flashScreen(color, 0.16);
  }

  flashScreen(color, amt = 0.4) {
    this.overlay.style.background = '#' + new THREE.Color(color).getHexString();
    this.overlay.style.opacity = clamp(amt, 0, 1);
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { this.overlay.style.opacity = 0; }, 70);
  }

  afterimage(fighter, color = 0xffffff) {
    // simple ghost ring at fighter position
    this._ring(fighter.x, fighter.y + 0.9, fighter.z, { size0: 0.2, size1: 0.7, life: 0.14, color, flat: false, opacity: 0.35 });
  }

  spawnProjectileMesh(proj, color) {
    const g = new THREE.Group();
    const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    const core = new THREE.Mesh(new THREE.SphereGeometry(proj.radius, 14, 10), coreMat);
    core.scale.set(1, 1, 1);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(proj.radius * 1.8, 12, 10), glowMat);
    g.add(core); g.add(glow);
    if (proj.type === 'shockwave') {
      core.scale.set(1, 0.35, 0.4);
      glow.scale.set(1, 0.5, 0.5);
      g.position.y = 0.18;
    }
    // trailing ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(proj.radius * 1.2, proj.radius * 0.16, 6, 18), coreMat);
    ring.rotation.y = Math.PI / 2; g.add(ring);
    g.userData.parts = { core, glow, ring };
    this.scene.add(g);
    return g;
  }

  update(dt) {
    // particles
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.spr.visible = false; continue; }
      p.vy += p.grav * dt;
      const d = 1 - p.drag * dt;
      p.vx *= d; p.vz *= d;
      p.spr.position.x += p.vx * dt;
      p.spr.position.y += p.vy * dt;
      p.spr.position.z += p.vz * dt;
      if (p.spr.position.y < 0.02) { p.spr.position.y = 0.02; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.7; p.vz *= 0.7; }
      const t = p.life / p.max;
      p.spr.material.opacity = Math.pow(t, 0.7) * p.fade;
      p.spr.material.rotation += p.spin * dt;
      const sc = p.size * (1 + p.grow * (1 - t)) * (0.35 + 0.65 * t);
      p.spr.scale.setScalar(sc);
    }
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; continue; }
      const t = 1 - r.life / r.max;
      const s = lerp(r.size0, r.size1, 1 - Math.pow(1 - t, 2.2));
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - t) * (r.fade || 1);
      if (r.spin) r.mesh.rotation.z += r.spin * dt;
    }
    for (const h of this.hitmarks) {
      if (h.life <= 0) continue;
      h.life -= dt;
      if (h.life <= 0) { h.spr.visible = false; continue; }
      const t = h.life / h.max;
      h.spr.material.opacity = t;
      h.spr.material.rotation = h.rot + (1 - t) * 0.6;
      h.spr.scale.setScalar(h.spr.scale.x * (1 + dt * 1.5));
    }
  }
}
