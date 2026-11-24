// Procedural articulated 3D humanoid rig with stylised gear.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { lerp, damp, clamp } from './utils.js';

const D = Math.PI / 180;

// helper: capsule along Y from joint downward
function limbMesh(radiusTop, radiusBot, len, mat) {
  const g = new THREE.CylinderGeometry(radiusTop, radiusBot, len, 12, 1);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 6, 12);
  g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function ball(r, mat, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 16, 12);
  const m = new THREE.Mesh(g, mat);
  m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true;
  return m;
}

function rbox(w, h, d, r, mat) {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2 - 0.001));
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

const BONES = ['hips', 'spine', 'chest', 'neck', 'head', 'shA', 'armA', 'foreA', 'handA',
  'shB', 'armB', 'foreB', 'handB', 'thighA', 'shinA', 'footA', 'thighB', 'shinB', 'footB'];

export const DEFAULT_POSE = {
  hipX: 0, hipY: 0, hipZ: 0, rootYaw: 0, rootRoll: 0, rootPitch: 0, headYaw: 0,
  hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
  shA: [0, 0, 0], armA: [0, 0, 0], foreA: [0, 0, 0], handA: [0, 0, 0],
  shB: [0, 0, 0], armB: [0, 0, 0], foreB: [0, 0, 0], handB: [0, 0, 0],
  thighA: [0, 0, 0], shinA: [0, 0, 0], footA: [0, 0, 0],
  thighB: [0, 0, 0], shinB: [0, 0, 0], footB: [0, 0, 0],
  scaleY: 1, lean: 0,
};

export function blankPose() {
  const p = {};
  for (const k in DEFAULT_POSE) p[k] = Array.isArray(DEFAULT_POSE[k]) ? [0, 0, 0] : 0;
  p.scaleY = 1;
  return p;
}

export function copyPose(src, dst) {
  for (const k in src) {
    const v = src[k];
    if (Array.isArray(v)) { if (dst[k]) { dst[k][0] = v[0]; dst[k][1] = v[1]; dst[k][2] = v[2]; } else dst[k] = v.slice(); }
    else dst[k] = v;
  }
  return dst;
}

export function mixPose(a, b, t) {
  const out = blankPose();
  for (const k in out) {
    if (Array.isArray(out[k])) {
      const av = a[k] || [0, 0, 0], bv = b[k] || [0, 0, 0];
      out[k][0] = av[0] + (bv[0] - av[0]) * t;
      out[k][1] = av[1] + (bv[1] - av[1]) * t;
      out[k][2] = av[2] + (bv[2] - av[2]) * t;
    } else {
      out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
    }
  }
  return out;
}

export class Rig {
  constructor(cfg) {
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.bones = {};
    this.meshes = [];
    this.materials = [];
    this.basePose = blankPose();
    this.curPose = blankPose();
    this.targetPose = blankPose();
    this._buildBody();
    this._buildGear();
    this.setPose(blankPose(), 1);
  }

  _mkMat(color, opts = {}) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: opts.rough ?? 0.62, metalness: opts.metal ?? 0.06,
      emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
      flatShading: !!opts.flat, side: opts.side ?? THREE.FrontSide,
      transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    });
    this.materials.push(m);
    return m;
  }

  _buildBody() {
    const c = this.cfg.colors;
    const body = this.cfg.body || {};
    this.height = 1.78 * (body.height ?? 1);
    this.bulk = body.bulk ?? 1;
    const s = this.bulk;
    this.skinMat = this._mkMat(c.skin, { rough: 0.55 });
    this.outfitMat = this._mkMat(c.outfit, { rough: 0.7 });
    this.outfit2Mat = this._mkMat(c.outfit2 ?? c.outfit, { rough: 0.58 });
    this.trimMat = this._mkMat(c.trim, { rough: 0.35, metal: 0.35 });
    this.darkMat = this._mkMat(c.dark ?? 0x1b1d24, { rough: 0.5 });
    this.hairMat = this._mkMat(c.hair, { rough: 0.72 });
    this.accentMat = this._mkMat(c.accent, { rough: 0.3, metal: 0.2, emissive: c.accent, emissiveIntensity: 0.35 });
    this.glowMat = this._mkMat(c.glow ?? c.accent, { emissive: c.glow ?? c.accent, emissiveIntensity: 1.4, rough: 0.25 });

    const H = this.height;
    const scale = H / 1.78;
    const root = this.group;
    const hipsY = 0.93 * scale;

    const hips = new THREE.Group(); hips.position.set(0, hipsY, 0); root.add(hips); this.bones.hips = hips;
    // pelvis
    const pelvis = rbox(0.34 * scale * s, 0.2 * scale, 0.24 * scale, 0.07 * scale, this.outfit2Mat);
    pelvis.position.y = 0.02 * scale; hips.add(pelvis);
    // belt
    if (this.cfg.gear.belt !== false) {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.185 * scale * s, 0.185 * scale * s, 0.075 * scale, 14), this.darkMat);
      belt.position.y = 0.095 * scale; belt.scale.z = 0.75; belt.castShadow = true; hips.add(belt);
      if (this.cfg.gear.buckle) {
        const bk = rbox(0.09 * scale, 0.07 * scale, 0.04 * scale, 0.01, this.trimMat);
        bk.position.set(0, 0.095 * scale, 0.135 * scale); hips.add(bk);
      }
    }

    // legs
    const legTop = 0.055 * scale;
    for (const side of ['A', 'B']) {
      const sx = side === 'A' ? 1 : -1;
      const thigh = new THREE.Group();
      thigh.position.set(0.115 * scale * sx * s, -legTop, 0);
      hips.add(thigh); this.bones['thigh' + side] = thigh;
      const thLen = 0.44 * scale;
      const thighM = capsule(0.083 * scale * (0.9 + 0.2 * s), thLen, this.cfg.gear.pants === 'bare' ? this.skinMat : this.outfitMat);
      thigh.add(thighM);
      if (this.cfg.gear.thighWrap && side === 'A') {
        const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.092 * scale, 0.088 * scale, 0.16 * scale, 12), this.trimMat);
        wrap.position.y = -0.12 * scale; thigh.add(wrap);
      }
      const shin = new THREE.Group();
      shin.position.y = -thLen; thigh.add(shin); this.bones['shin' + side] = shin;
      const shinLen = 0.42 * scale;
      const shinM = capsule(0.068 * scale, shinLen, this.cfg.gear.pants === 'bare' ? this.skinMat : this.outfit2Mat);
      shin.add(shinM);
      const foot = new THREE.Group(); foot.position.y = -shinLen; shin.add(foot); this.bones['foot' + side] = foot;
      const bootMat = this.cfg.gear.bareFeet ? this.skinMat : this.darkMat;
      const boot = rbox(0.125 * scale, 0.105 * scale, 0.31 * scale, 0.035 * scale, bootMat);
      boot.position.set(0, -0.025 * scale, 0.07 * scale); foot.add(boot);
      const toe = rbox(0.12 * scale, 0.07 * scale, 0.1 * scale, 0.03 * scale, this.trimMat);
      toe.position.set(0, -0.04 * scale, 0.19 * scale); foot.add(toe);
      if (this.cfg.gear.boots && this.cfg.gear.boots !== 'none') {
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.078 * scale, 0.072 * scale, 0.16 * scale, 12), this.trimMat);
        sh.position.y = -0.34 * scale; shin.add(sh);
      }
    }

    // spine / chest
    const spine = new THREE.Group(); spine.position.y = 0.13 * scale; hips.add(spine); this.bones.spine = spine;
    const waist = ball(0.155 * scale, this.skinMat, 1.05 * s, 0.8, 0.72);
    waist.position.y = 0.0; spine.add(waist);
    const chest = new THREE.Group(); chest.position.y = 0.2 * scale; spine.add(chest); this.bones.chest = chest;
    const chestW = 0.42 * scale * s;
    const chestMesh = rbox(chestW, 0.3 * scale, 0.24 * scale * s, 0.09 * scale, this.cfg.gear.torsoBare ? this.skinMat : this.outfitMat);
    chestMesh.position.y = 0.09 * scale; chest.add(chestMesh);
    const upperChest = rbox(chestW * 0.86, 0.13 * scale, 0.23 * scale * s, 0.06 * scale, this.cfg.gear.torsoBare ? this.skinMat : this.outfitMat);
    upperChest.position.y = 0.245 * scale; chest.add(upperChest);
    // collar / trim
    const collar = rbox(chestW * 0.7, 0.055 * scale, 0.19 * scale, 0.02 * scale, this.trimMat);
    collar.position.y = 0.30 * scale; chest.add(collar);
    if (this.cfg.gear.chestMark) {
      const mark = new THREE.Mesh(new THREE.CircleGeometry(0.055 * scale, 12), this.glowMat);
      mark.position.set(0.055 * scale, 0.16 * scale, 0.125 * scale * s); chest.add(mark);
    }
    if (this.cfg.gear.armorChest) {
      const armor = rbox(chestW * 1.04, 0.2 * scale, 0.29 * scale * s, 0.07 * scale, this.trimMat);
      armor.position.y = 0.17 * scale; chest.add(armor);
    }

    // neck + head
    const neck = new THREE.Group(); neck.position.y = 0.32 * scale; chest.add(neck); this.bones.neck = neck;
    const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * scale, 0.055 * scale, 0.09 * scale, 10), this.skinMat);
    neckM.position.y = 0.03 * scale; neck.add(neckM);
    const head = new THREE.Group(); head.position.y = 0.1 * scale; neck.add(head); this.bones.head = head;
    const headR = 0.125 * scale;
    const skull = ball(headR, this.skinMat, 1.0, 1.12, 0.98);
    skull.position.y = 0.06 * scale; head.add(skull);
    const jaw = rbox(headR * 1.35, headR * 0.75, headR * 1.4, headR * 0.3, this.skinMat);
    jaw.position.set(0, -0.015 * scale, 0.012 * scale); head.add(jaw);
    // eyes
    const eyeMat = this._mkMat(0xf7f9ff, { rough: 0.25 });
    const pupilMat = this._mkMat(c.eye ?? 0x1a2233, { rough: 0.2 });
    for (const sx of [-1, 1]) {
      const eyeW = ball(headR * 0.24, eyeMat, 1.1, 0.8, 0.5);
      eyeW.position.set(sx * headR * 0.36, 0.075 * scale, headR * 0.9 * 0.98); head.add(eyeW);
      const pu = ball(headR * 0.13, pupilMat, 1, 1, 0.6);
      pu.position.set(sx * headR * 0.36, 0.075 * scale, headR * 0.99); head.add(pu);
    }
    // brow
    const brow = rbox(headR * 1.5, 0.022 * scale, 0.04 * scale, 0.008, this.cfg.colors.hair);
    brow.position.set(0, 0.14 * scale, headR * 0.85); brow.rotation.x = 0.1; head.add(brow);

    // arms
    for (const side of ['A', 'B']) {
      const sx = side === 'A' ? 1 : -1;
      const sh = new THREE.Group();
      sh.position.set(sx * chestW * 0.52, 0.27 * scale, 0);
      chest.add(sh); this.bones['sh' + side] = sh;
      const delt = ball(0.077 * scale * (0.9 + 0.22 * s), this.cfg.gear.torsoBare ? this.skinMat : this.outfitMat, 1.05, 0.95, 1);
      sh.add(delt);
      const arm = new THREE.Group(); sh.add(arm); this.bones['arm' + side] = arm;
      const upLen = 0.3 * scale;
      arm.add(capsule(0.06 * scale * (0.9 + 0.2 * s), upLen, this.cfg.gear.sleeves === 'long' ? this.outfitMat : this.skinMat));
      const fore = new THREE.Group(); fore.position.y = -upLen; arm.add(fore); this.bones['fore' + side] = fore;
      const foreLen = 0.28 * scale;
      fore.add(capsule(0.052 * scale * (0.9 + 0.2 * s), foreLen, this.skinMat));
      // forearm wrap / glove
      if (this.cfg.gear.wraps) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.062 * scale, 0.056 * scale, 0.18 * scale, 10), this.trimMat);
        w.position.y = -0.16 * scale; fore.add(w);
      }
      const hand = new THREE.Group(); hand.position.y = -foreLen; fore.add(hand); this.bones['hand' + side] = hand;
      const glove = rbox(0.1 * scale, 0.13 * scale, 0.11 * scale, 0.035 * scale, this.cfg.gear.gloves ? this.trimMat : this.skinMat);
      glove.position.y = -0.04 * scale; hand.add(glove);
    }

    this._baseScale = scale;
  }

  _buildGear() {
    const g = this.cfg.gear;
    const head = this.bones.head;
    const s = this._baseScale;
    const c = this.cfg.colors;
    // headgear
    if (g.head === 'bandana') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.135 * s, 0.132 * s, 0.05 * s, 14, 1, true), this.trimMat);
      band.position.y = 0.13 * s; band.rotation.x = 0.1; head.add(band);
      const knot = ball(0.035 * s, this.trimMat, 1, 1, 0.6); knot.position.set(0, 0.13 * s, -0.13 * s); head.add(knot);
      for (let i = 0; i < 2; i++) {
        const tail = rbox(0.03 * s, 0.16 * s, 0.012 * s, 0.005, this.trimMat);
        tail.position.set((i ? 0.03 : -0.03) * s, 0.05 * s, -0.15 * s - i * 0.02 * s);
        tail.rotation.x = 0.3 + i * 0.3; tail.rotation.z = (i ? -0.25 : 0.18); head.add(tail);
      }
      const hairBack = ball(0.128 * s, this.hairMat, 1, 0.95, 0.9);
      hairBack.position.set(0, 0.06 * s, -0.02 * s); hairBack.scale.y = 1.05; head.add(hairBack);
    } else if (g.head === 'spikes') {
      const cap = ball(0.135 * s, this.hairMat, 1.02, 1.0, 1.0); cap.position.y = 0.085 * s; head.add(cap);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035 * s, 0.13 * s, 5), this.hairMat);
        spike.position.set(Math.cos(a) * 0.085 * s, 0.17 * s + Math.sin(i) * 0.015 * s, Math.sin(a) * 0.085 * s + 0.01);
        spike.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
        spike.castShadow = true; head.add(spike);
      }
    } else if (g.head === 'ponytail') {
      const cap = ball(0.137 * s, this.hairMat, 1.02, 1.02, 1.0); cap.position.set(0, 0.075 * s, -0.005 * s); head.add(cap);
      const bang = rbox(0.2 * s, 0.06 * s, 0.05 * s, 0.02, this.hairMat); bang.position.set(0, 0.14 * s, 0.1 * s); bang.rotation.x = -0.15; head.add(bang);
      let prev = head;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, i === 0 ? 0.06 * s : -0.1 * s, i === 0 ? -0.13 * s : -0.0);
        prev.add(seg);
        const m = new THREE.Mesh(new THREE.CylinderGeometry((0.045 - i * 0.01) * s, (0.035 - i * 0.01) * s, 0.12 * s, 8), this.hairMat);
        m.position.y = -0.06 * s; m.castShadow = true; seg.add(m);
        seg.rotation.x = i === 0 ? 0.6 : 0.12;
        this.bones['tail' + i] = seg;
        prev = seg;
      }
    } else if (g.head === 'helmet') {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), this.trimMat);
      helm.position.y = 0.075 * s; helm.castShadow = true; head.add(helm);
      const ridge = rbox(0.03 * s, 0.11 * s, 0.26 * s, 0.01, this.accentMat); ridge.position.set(0, 0.17 * s, 0); head.add(ridge);
      for (const sx of [-1, 1]) {
        const wing = rbox(0.02 * s, 0.11 * s, 0.09 * s, 0.008, this.accentMat);
        wing.position.set(sx * 0.135 * s, 0.1 * s, -0.03 * s); wing.rotation.z = sx * 0.5; head.add(wing);
      }
    } else if (g.head === 'hood') {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), this.outfitMat);
      hood.position.y = 0.05 * s; hood.castShadow = true; head.add(hood);
      const back = rbox(0.24 * s, 0.22 * s, 0.12 * s, 0.05 * s, this.outfitMat);
      back.position.set(0, -0.02 * s, -0.11 * s); head.add(back);
    } else if (g.head === 'mohawk') {
      const base = ball(0.13 * s, this.hairMat, 1.0, 0.96, 1.0); base.position.set(0, 0.06 * s, -0.01 * s); head.add(base);
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, (0.13 - i * 0.012) * s, 4), this.hairMat);
        sp.position.set(0, (0.18 - i * 0.012) * s, (0.07 - i * 0.045) * s);
        sp.rotation.x = -0.28; sp.castShadow = true; head.add(sp);
      }
    } else if (g.head === 'mask') {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.135 * s, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), this.trimMat);
      mask.position.set(0, 0.03 * s, 0.05 * s); mask.rotation.x = 0.5; mask.castShadow = true; head.add(mask);
      const hairTop = ball(0.132 * s, this.hairMat, 1, 0.9, 1.0); hairTop.position.set(0, 0.1 * s, -0.01 * s); head.add(hairTop);
    } else if (g.head === 'bun') {
      const cap = ball(0.136 * s, this.hairMat, 1.01, 0.98, 1.0); cap.position.set(0, 0.07 * s, -0.01 * s); head.add(cap);
      const bun = ball(0.07 * s, this.hairMat, 1, 1, 1); bun.position.set(0, 0.21 * s, -0.03 * s); head.add(bun);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.24 * s, 6), this.trimMat);
      stick.rotation.z = 1.35; stick.position.set(0, 0.23 * s, -0.03 * s); head.add(stick);
    } else if (g.head === 'cap') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.138 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), this.outfit2Mat);
      cap.position.y = 0.075 * s; cap.castShadow = true; head.add(cap);
      const brim = rbox(0.22 * s, 0.022 * s, 0.14 * s, 0.01, this.outfit2Mat);
      brim.position.set(0, 0.11 * s, 0.13 * s); brim.rotation.x = 0.12; head.add(brim);
    } else if (g.head === 'afro') {
      const af = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21 * s, 1), this.hairMat);
      af.position.set(0, 0.14 * s, -0.02 * s); af.castShadow = true; head.add(af);
    }

    // shoulder gear
    if (g.shoulderPads) {
      for (const side of ['A', 'B']) {
        const sh = this.bones['sh' + side];
        const pad = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), this.trimMat);
        pad.rotation.z = side === 'A' ? -0.4 : 0.4; pad.position.y = 0.02 * s; pad.castShadow = true; sh.add(pad);
        if (g.padSpikes) {
          const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03 * s, 0.11 * s, 5), this.accentMat);
          sp.position.set(side === 'A' ? 0.06 * s : -0.06 * s, 0.08 * s, 0); sh.add(sp);
        }
      }
    }
    // scarf
    if (g.scarf) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.105 * s, 0.037 * s, 8, 14), this.accentMat);
      wrap.rotation.x = Math.PI / 2 + 0.12; wrap.position.y = 0.33 * s; this.bones.chest.add(wrap);
      let prev = this.bones.chest;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        seg.position.set(i === 0 ? 0.08 * s : 0, i === 0 ? 0.3 * s : -0.13 * s, i === 0 ? -0.12 * s : 0);
        prev.add(seg);
        const cloth = rbox(0.075 * s, 0.14 * s, 0.02 * s, 0.008, this.accentMat);
        cloth.position.y = -0.07 * s; seg.add(cloth);
        seg.rotation.x = i === 0 ? 0.2 : 0.15;
        this.bones['scarf' + i] = seg; prev = seg;
      }
    }
    // coat tails
    if (g.coat) {
      for (let i = 0; i < 2; i++) {
        const seg = new THREE.Group();
        seg.position.set((i ? 0.12 : -0.12) * s, -0.06 * s, -0.12 * s);
        this.bones.hips.add(seg);
        const cloth = rbox(0.2 * s, 0.4 * s, 0.04 * s, 0.015, this.outfitMat);
        cloth.position.y = -0.2 * s; cloth.rotation.x = 0.06; seg.add(cloth);
        this.bones['coat' + i] = seg;
      }
    }
    // cape
    if (g.cape) {
      const segs = [];
      let prev = this.bones.chest;
      for (let i = 0; i < 3; i++) {
        const seg = new THREE.Group();
        seg.position.set(0, i === 0 ? 0.26 * s : -0.22 * s, -0.13 * s);
        prev.add(seg);
        const cloth = rbox((0.34 + i * 0.06) * s, 0.24 * s, 0.02 * s, 0.01, this.outfit2Mat);
        cloth.position.y = -0.1 * s; seg.add(cloth);
        seg.rotation.x = -0.1;
        segs.push(seg); this.bones['cape' + i] = seg; prev = seg;
      }
    }
    // gauntlets / cyber arm
    if (g.cyberArm) {
      const fore = this.bones.foreA;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.062 * s, 0.052 * s, 0.22 * s, 10), this.trimMat);
      m.position.y = -0.14 * s; fore.add(m);
      const glow = new THREE.Mesh(new THREE.TorusGeometry(0.05 * s, 0.011 * s, 6, 12), this.glowMat);
      glow.rotation.x = Math.PI / 2; glow.position.y = -0.25 * s; fore.add(glow);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085 * s, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), this.trimMat);
      shoulder.rotation.z = -0.5; this.bones.shA.add(shoulder);
    }
    // chest strap
    if (g.strap) {
      const strap = rbox(0.07 * s, 0.4 * s, 0.02 * s, 0.008, this.darkMat);
      strap.rotation.z = -0.55; strap.position.set(0, 0.14 * s, 0.13 * s); this.bones.chest.add(strap);
    }
    // leg bands
    if (g.legBands) {
      for (const side of ['A', 'B']) {
        const th = this.bones['thigh' + side];
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.088 * s, 0.05 * s, 12), this.accentMat);
        band.position.y = -0.3 * s; th.add(band);
        const shinBand = new THREE.Mesh(new THREE.CylinderGeometry(0.074 * s, 0.07 * s, 0.06 * s, 12), this.trimMat);
        shinBand.position.y = -0.3 * s; this.bones['shin' + side].add(shinBand);
      }
    }
    // skirt / sash for gi
    if (g.giSash) {
      const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * s, 0.21 * s, 0.09 * s, 14), this.accentMat);
      sash.position.y = 0.03 * s; sash.scale.z = 0.78; this.bones.hips.add(sash);
      const tail = rbox(0.06 * s, 0.2 * s, 0.015 * s, 0.005, this.accentMat);
      tail.position.set(-0.11 * s, -0.1 * s, 0.15 * s); tail.rotation.x = 0.08; this.bones.hips.add(tail);
    }
    // wings / energy back
    if (g.backVents) {
      for (const sx of [-1, 1]) {
        const vent = rbox(0.05 * s, 0.18 * s, 0.05 * s, 0.015, this.trimMat);
        vent.position.set(sx * 0.13 * s, 0.13 * s, -0.13 * s); vent.rotation.y = sx * 0.3; this.bones.chest.add(vent);
        const glow = rbox(0.012 * s, 0.12 * s, 0.012 * s, 0.004, this.glowMat);
        glow.position.set(sx * 0.16 * s, 0.13 * s, -0.15 * s); this.bones.chest.add(glow);
      }
    }
  }

  // Apply a pose. `rate` 0..1 blending factor per call (1 = snap).
  setPose(pose, rate = 0.35) {
    this.targetPose = pose;
    const cur = this.curPose;
    const r = clamp(rate, 0, 1);
    for (const k in pose) {
      if (Array.isArray(pose[k])) {
        const cv = cur[k] || (cur[k] = [0, 0, 0]);
        cv[0] = lerp(cv[0], pose[k][0], r);
        cv[1] = lerp(cv[1], pose[k][1], r);
        cv[2] = lerp(cv[2], pose[k][2], r);
      } else {
        cur[k] = lerp(cur[k] ?? 0, pose[k], r);
      }
    }
    this._apply(cur);
  }

  snapPose(pose) { this.setPose(pose, 1); }

  _apply(p) {
    const b = this.bones;
    this.group.rotation.y = p.rootYaw;
    this.group.rotation.z = p.rootRoll;
    this.group.rotation.x = p.rootPitch;
    b.hips.position.set(p.hipX, 0.93 * this._baseScale + p.hipY, p.hipZ);
    for (const k of BONES) {
      const bone = b[k];
      if (!bone) continue;
      const v = p[k];
      if (!v) continue;
      bone.rotation.set(v[0], v[1], v[2]);
    }
    if (p.headYaw) b.head.rotation.y += p.headYaw;
  }

  update(dt) {
    // secondary motion for cloth/hair
    const t = performance.now() * 0.001;
    const sway = Math.sin(t * 2.2) * 0.04;
    for (const key of ['cape0', 'cape1', 'cape2']) {
      const s = this.bones[key]; if (!s) continue;
      s.rotation.z = sway * 0.7 + s.rotation.z * 0.9;
    }
    for (const key of ['scarf0', 'scarf1', 'scarf2']) {
      const s = this.bones[key]; if (!s) continue;
      s.rotation.z = Math.sin(t * 3.1 + 1) * 0.12;
    }
    for (const key of ['tail0', 'tail1', 'tail2']) {
      const s = this.bones[key]; if (!s) continue;
      s.rotation.z = Math.sin(t * 2.4) * 0.07;
    }
    for (const key of ['coat0', 'coat1']) {
      const s = this.bones[key]; if (!s) continue;
      s.rotation.x = 0.06 + Math.sin(t * 2.8 + (key === 'coat0' ? 0 : 1)) * 0.05;
    }
  }

  setVisible(v) { this.group.visible = v; }

  flash(color = 0xffffff, intensity = 0.6) {
    for (const m of this.materials) {
      if (!m._baseEmissive) { m._baseEmissive = m.emissive.getHex(); m._baseEmissiveInt = m.emissiveIntensity; }
      m.emissive.setHex(color);
      m.emissiveIntensity = intensity;
    }
    this._flashTimer = 0.12;
  }

  tickFlash(dt) {
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) {
        for (const m of this.materials) {
          if (m._baseEmissive !== undefined) { m.emissive.setHex(m._baseEmissive); m.emissiveIntensity = m._baseEmissiveInt; }
        }
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
