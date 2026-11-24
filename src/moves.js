// Attack animation generator + skeletal hitbox resolution.
import * as THREE from 'three';
import { POSE_DEFS, P, PO, GUARD, blendDefs, getPose, blendDefs as bd } from './poses.js';

const D = Math.PI / 180;

// Build a windup → active → follow-through pose triplet from a strike pose.
// k = strike intensity 0..1 (light..heavy). kind: punch/kick/uppercut/overhead
export function makeStrikePoses(kind, k = 0.5, opts = {}) {
  let strikeBase;
  if (kind === 'punch') strikeBase = k > 0.62 ? 'punchB' : k > 0.32 ? 'punchLv2' : 'punchLv1';
  else if (kind === 'jab') strikeBase = 'punchLv1';
  else if (kind === 'kick') strikeBase = k > 0.62 ? 'kickB' : k > 0.32 ? 'kickLv2' : 'kickLv1';
  else if (kind === 'lowkick') strikeBase = 'crouchKick';
  else if (kind === 'uppercut') strikeBase = 'kickLv2';
  else strikeBase = 'punchLv1';
  const S = POSE_DEFS[strikeBase];
  const G = POSE_DEFS.stance;

  // windup: pull back from guard
  const wind = blendDefs(G, S, -0.32);
  if (kind === 'kick' || kind === 'uppercut') {
    wind.thighA = [-30, 0, -8]; wind.shinA = [44, 0, 0]; wind.hipY = -0.13;
    wind.chest = [2, 6, 2]; wind.spine = [6, 4, 0]; wind.head = [0, -6, 0];
  } else {
    wind.armA = [-52, 18, -22]; wind.foreA = [-84, 0, -16];
    wind.chest = [-4, 6, 2]; wind.spine = [2, 4, 0]; wind.head = [2, -6, 0];
    wind.hipY = -0.075;
  }
  if (opts.overhead) {
    wind.armA = [-150, 6, -30]; wind.foreA = [-30, 0, -10]; wind.chest = [-16, 0, 0];
  }

  // active = strike plus a little extension past it
  const active = blendDefs(S, G, -0.1);
  // follow through: hold for a beat
  const follow = blendDefs(S, G, 0.28);

  return { wind, active, follow, strike: S };
}

export function makeCrouchStrike(kind, k = 0.5) {
  const S = POSE_DEFS[kind === 'kick' ? 'crouchKick' : 'crouchPunch'];
  const G = POSE_DEFS.crouch;
  return { wind: blendDefs(G, S, -0.3), active: blendDefs(S, G, -0.08), follow: blendDefs(S, G, 0.3) };
}

// Attack definitions. Each move = timeline of phases with pose names and hitbox specs.
// Weapon/hand: 'handA' | 'handB' | 'footA' | 'footB'
const NOW = 0;
let _id = 0;

export function attack(spec) {
  // Normalise: authored moves may use `start` / `f` shorthand.
  if (spec && spec.startup === undefined && spec.start !== undefined) spec = { ...spec, startup: spec.start };
  if (spec && spec.startup === undefined) spec = { ...spec, startup: 6 };
  if (spec && spec.active === undefined) spec = { ...spec, active: 3 };
  if (spec && spec.recovery === undefined) spec = { ...spec, recovery: 10 };
  const a = {
    id: 'a' + _id++,
    name: 'Attack',
    kind: 'punch',
    button: 'LP',
    level: 'mid',
    damage: 300,
    chip: 0.12,
    hitstun: 14,
    blockstun: 10,
    start: 5,
    active: 3,
    recovery: 9,
    hitbox: { bone: 'handA', offset: [0, 0, 0.06], size: [0.32, 0.3, 0.36], reach: 0.5 },
    cancel: { special: false, super: false, drive: true, chain: false, jump: false, dash: false },
    hitstop: 6,
    push: 0.055,
    knockdown: null,
    launcher: 0,
    counterBonus: 1.2,
    ex: false,
    priority: 1,
    sfx: 'punch',
    ...spec,
  };
  return a;
}

// Convenience builder for the 6 normals of a character.
export function normalSet(opts) {
  const { kind = 'standard', dmg = [320, 550, 850], reach = [0.78, 0.94, 1.08], speed = 1 } = opts;
  const mk = (button, id, o) => attack({ name: id, button, ...o });
  const S = Math.max(0.7, speed);
  const list = [
    mk('LP', 'Standing Light Punch', {
      kind: 'punch', level: 'mid', damage: dmg[0], start: Math.round(4 / S), active: 3, recovery: Math.round(8 / S),
      hitbox: { bone: 'handA', offset: [0, 0, 0.1], size: [0.34, 0.3, 0.36], reach: reach[0] },
      hitstun: 15, blockstun: 11, hitstop: 5, push: 0.05,
      cancel: { special: true, super: true, drive: true, chain: true, jump: false, dash: true },
      poseKind: 'jab', strikeK: 0.2, sfx: 'punch', priority: 1,
    }),
    mk('MP', 'Standing Medium Punch', {
      kind: 'punch', level: 'mid', damage: dmg[1], start: Math.round(6 / S), active: 4, recovery: Math.round(12 / S),
      hitbox: { bone: 'handA', offset: [0, 0, 0.12], size: [0.4, 0.34, 0.44], reach: reach[1] },
      hitstun: 19, blockstun: 13, hitstop: 7, push: 0.062,
      cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: true },
      poseKind: 'punch', strikeK: 0.5, sfx: 'punch', priority: 2,
    }),
    mk('HP', 'Standing Heavy Punch', {
      kind: 'punch', level: 'mid', damage: dmg[2], start: Math.round(9 / S), active: 4, recovery: Math.round(17 / S),
      hitbox: { bone: 'handA', offset: [0, 0, 0.16], size: [0.46, 0.4, 0.52], reach: reach[2] },
      hitstun: 23, blockstun: 16, hitstop: 9, push: 0.085,
      cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: false },
      poseKind: 'punch', strikeK: 0.9, sfx: 'punch', priority: 3,
    }),
    mk('LK', 'Standing Light Kick', {
      kind: 'kick', level: 'mid', damage: dmg[0] * 0.95, start: Math.round(5 / S), active: 3, recovery: Math.round(9 / S),
      hitbox: { bone: 'footA', offset: [0, 0, 0.08], size: [0.36, 0.34, 0.42], reach: reach[0] * 1.1 },
      hitstun: 15, blockstun: 11, hitstop: 5, push: 0.05,
      cancel: { special: true, super: true, drive: true, chain: true, jump: false, dash: true },
      poseKind: 'kick', strikeK: 0.2, sfx: 'kick', priority: 1,
    }),
    mk('MK', 'Standing Medium Kick', {
      kind: 'kick', level: 'mid', damage: dmg[1] * 0.98, start: Math.round(7 / S), active: 4, recovery: Math.round(13 / S),
      hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [0.42, 0.36, 0.48], reach: reach[1] * 1.12 },
      hitstun: 19, blockstun: 13, hitstop: 7, push: 0.062,
      cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: true },
      poseKind: 'kick', strikeK: 0.5, sfx: 'kick', priority: 2,
    }),
    mk('HK', 'Standing Heavy Kick', {
      kind: 'kick', level: 'mid', damage: dmg[2] * 1.02, start: Math.round(10 / S), active: 5, recovery: Math.round(18 / S),
      hitbox: { bone: 'footB', offset: [0, 0, 0.14], size: [0.48, 0.4, 0.58], reach: reach[2] * 1.14 },
      hitstun: 24, blockstun: 16, hitstop: 9, push: 0.095,
      cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: false },
      poseKind: 'kick', strikeK: 0.95, sfx: 'kick', priority: 3, knockdown: 'hard',
    }),
  ];
  // crouching
  const crouchDmg = [0.72, 0.85, 1.0];
  list.push(attack({
    name: 'Crouching Light Punch', button: 'LP', crouch: true, kind: 'punch', level: 'low',
    damage: dmg[0] * crouchDmg[0], start: Math.round(4 / S), active: 3, recovery: Math.round(8 / S),
    hitbox: { bone: 'handA', offset: [0, 0, 0.1], size: [0.34, 0.3, 0.34], reach: reach[0] * 0.95 },
    hitstun: 14, blockstun: 10, hitstop: 5, push: 0.045,
    cancel: { special: true, super: true, drive: true, chain: true, jump: false, dash: false },
    poseKind: 'crouchpunch', strikeK: 0.2, sfx: 'punch', priority: 1,
  }));
  list.push(attack({
    name: 'Crouching Medium Punch', button: 'MP', crouch: true, kind: 'punch', level: 'mid',
    damage: dmg[1] * crouchDmg[1], start: Math.round(6 / S), active: 4, recovery: Math.round(12 / S),
    hitbox: { bone: 'handA', offset: [0, 0, 0.12], size: [0.38, 0.34, 0.42], reach: reach[1] * 0.95 },
    hitstun: 19, blockstun: 13, hitstop: 7, push: 0.05,
    cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: false },
    poseKind: 'crouchpunch', strikeK: 0.5, sfx: 'punch', priority: 2,
  }));
  list.push(attack({
    name: 'Crouching Heavy Punch', button: 'HP', crouch: true, kind: 'punch', level: 'mid', antiAir: true,
    damage: dmg[2] * crouchDmg[2], start: Math.round(9 / S), active: 4, recovery: Math.round(17 / S),
    hitbox: { bone: 'handA', offset: [0, 0.1, 0.1], size: [0.42, 0.62, 0.44], reach: reach[2] * 0.9 },
    hitstun: 26, blockstun: 16, hitstop: 9, push: 0.06, launcher: 7.5,
    cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: false },
    poseKind: 'crouchpunch', strikeK: 0.9, sfx: 'punch', priority: 3,
  }));
  list.push(attack({
    name: 'Crouching Light Kick', button: 'LK', crouch: true, kind: 'kick', level: 'low',
    damage: dmg[0] * 0.7, start: Math.round(4 / S), active: 3, recovery: Math.round(8 / S),
    hitbox: { bone: 'footA', offset: [0, 0, 0.05], size: [0.38, 0.3, 0.42], reach: reach[0] * 1.0 },
    hitstun: 14, blockstun: 10, hitstop: 5, push: 0.045,
    cancel: { special: true, super: true, drive: true, chain: true, jump: false, dash: false },
    poseKind: 'crouchkick', strikeK: 0.2, sfx: 'kick', priority: 1,
  }));
  list.push(attack({
    name: 'Crouching Medium Kick', button: 'MK', crouch: true, kind: 'kick', level: 'low',
    damage: dmg[1] * crouchDmg[1], start: Math.round(7 / S), active: 4, recovery: Math.round(13 / S),
    hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [0.44, 0.34, 0.5], reach: reach[1] * 1.1 },
    hitstun: 20, blockstun: 13, hitstop: 7, push: 0.05,
    cancel: { special: true, super: true, drive: true, chain: false, jump: false, dash: false },
    poseKind: 'crouchkick', strikeK: 0.5, sfx: 'kick', priority: 2,
  }));
  list.push(attack({
    name: 'Crouching Heavy Kick', button: 'HK', crouch: true, kind: 'kick', level: 'low', sweep: true,
    damage: dmg[2] * 1.05, start: Math.round(9 / S), active: 4, recovery: Math.round(20 / S),
    hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [0.5, 0.32, 0.64], reach: reach[2] * 1.25 },
    hitstun: 22, blockstun: 15, hitstop: 9, push: 0.05, knockdown: 'hard',
    cancel: { special: false, super: true, drive: true, chain: false, jump: false, dash: false },
    poseKind: 'crouchkick', strikeK: 0.95, sfx: 'kick', priority: 3,
  }));
  // air
  const air = (button, id, o) => attack({ name: id, button, air: true, ...o });
  list.push(air('LP', 'Jumping Light Punch', {
    kind: 'punch', level: 'high', damage: dmg[0] * 0.9, start: 4, active: 6, recovery: 8,
    hitbox: { bone: 'handA', offset: [0, -0.05, 0.1], size: [0.38, 0.34, 0.38], reach: reach[0] * 1.0 },
    hitstun: 16, blockstun: 12, hitstop: 6, push: 0.045, poseKind: 'jumpPunch', strikeK: 0.25, sfx: 'punch', priority: 1,
  }));
  list.push(air('MP', 'Jumping Medium Punch', {
    kind: 'punch', level: 'high', damage: dmg[1] * 0.92, start: 5, active: 7, recovery: 9,
    hitbox: { bone: 'handA', offset: [0, -0.05, 0.12], size: [0.42, 0.36, 0.46], reach: reach[1] * 1.02 },
    hitstun: 19, blockstun: 14, hitstop: 7, push: 0.05, poseKind: 'jumpPunch', strikeK: 0.6, sfx: 'punch', priority: 2,
  }));
  list.push(air('HP', 'Jumping Heavy Punch', {
    kind: 'punch', level: 'high', damage: dmg[2] * 0.95, start: 6, active: 6, recovery: 12,
    hitbox: { bone: 'handA', offset: [0, -0.02, 0.14], size: [0.48, 0.42, 0.52], reach: reach[2] * 1.05 },
    hitstun: 22, blockstun: 16, hitstop: 9, push: 0.07, poseKind: 'jumpOverhead', strikeK: 0.9, sfx: 'punch', priority: 3,
  }));
  list.push(air('LK', 'Jumping Light Kick', {
    kind: 'kick', level: 'high', damage: dmg[0] * 0.85, start: 4, active: 6, recovery: 8,
    hitbox: { bone: 'footA', offset: [0, -0.06, 0.06], size: [0.4, 0.36, 0.42], reach: reach[0] * 1.05 },
    hitstun: 16, blockstun: 12, hitstop: 6, push: 0.045, poseKind: 'jumpKick', strikeK: 0.25, sfx: 'kick', priority: 1,
  }));
  list.push(air('MK', 'Jumping Medium Kick', {
    kind: 'kick', level: 'high', damage: dmg[1] * 0.9, start: 5, active: 7, recovery: 9,
    hitbox: { bone: 'footA', offset: [0, -0.05, 0.1], size: [0.44, 0.38, 0.52], reach: reach[1] * 1.08 },
    hitstun: 20, blockstun: 14, hitstop: 7, push: 0.055, poseKind: 'jumpKick', strikeK: 0.55, sfx: 'kick', priority: 2,
  }));
  list.push(air('HK', 'Jumping Heavy Kick', {
    kind: 'kick', level: 'high', damage: dmg[2] * 0.92, start: 6, active: 8, recovery: 10,
    hitbox: { bone: 'footB', offset: [0, -0.02, 0.1], size: [0.5, 0.4, 0.62], reach: reach[2] * 1.15 },
    hitstun: 22, blockstun: 16, hitstop: 9, push: 0.075, poseKind: 'jumpKick', strikeK: 0.95, sfx: 'kick', priority: 3, crossup: true,
  }));
  return list;
}

// Resolve hitbox into world space from the rig's current bone transforms.
const _v = new THREE.Vector3();
export function resolveHitbox(rig, hb, facing, group) {
  const bone = rig.bones[hb.bone] || rig.bones.handA;
  bone.updateWorldMatrix(true, false);
  _v.set(hb.offset?.[0] ?? 0, hb.offset?.[1] ?? 0, hb.offset?.[2] ?? 0);
  const p = _v.applyMatrix4(bone.matrixWorld);
  // local space: model faces +Z; world facing handled by rig group scale/rotation
  const c = new THREE.Vector3(p.x, p.y, p.z);
  return {
    cx: c.x, cy: c.y, cz: c.z,
    hw: hb.size[0] / 2, hh: hb.size[1] / 2, hd: hb.size[2] / 2,
    reach: hb.reach ?? 0.5,
  };
}

// Build animation keyframe arrays for move phases using generated poses.
export function buildMoveAnim(move, cfg) {
  const L = move.animStyle || cfg.animStyle || 'standard';
  const k = move.strikeK ?? 0.5;
  const isCrouch = !!move.crouch;
  const isAir = !!move.air;
  let poses;
  if (isAir) {
    const strike = P(POSE_DEFS[move.poseKind === 'jumpKick' ? 'kickLv2' : 'punchLv2']);
    const base = P(POSE_DEFS.jumpUp);
    poses = {
      wind: blendPoses(base, strike, 0.25),
      active: blendPoses(base, strike, 0.85),
      follow: blendPoses(base, strike, 0.55),
    };
  } else if (isCrouch) {
    poses = makeCrouchStrike(move.kind, k);
    poses.wind = P(poses.wind); poses.active = P(poses.active); poses.follow = P(poses.follow);
  } else {
    const p = makeStrikePoses(move.kind === 'kick' ? 'kick' : 'punch', k, { overhead: move.overhead });
    poses = { wind: P(p.wind), active: P(p.active), follow: P(p.follow) };
  }
  // special per-character style tweak
  if (cfg.animTweak) cfg.animTweak(move, poses);
  return poses;
}

function blendPoses(a, b, t) {
  const out = {};
  for (const key in a) {
    if (Array.isArray(a[key])) out[key] = [a[key][0] + (b[key][0] - a[key][0]) * t, a[key][1] + (b[key][1] - a[key][1]) * t, a[key][2] + (b[key][2] - a[key][2]) * t];
    else out[key] = a[key] + ((b[key] ?? 0) - a[key]) * t;
  }
  return out;
}
