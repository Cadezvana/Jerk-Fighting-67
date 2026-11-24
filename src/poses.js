// Pose library. All angles in DEGREES for authoring; converted to radians on build.
import { blankPose, mixPose } from './rig.js';

const D = Math.PI / 180;
const KEYS = ['hips', 'spine', 'chest', 'neck', 'head', 'shA', 'armA', 'foreA', 'handA',
  'shB', 'armB', 'foreB', 'handB', 'thighA', 'shinA', 'footA', 'thighB', 'shinB', 'footB'];
const SCALARS = ['hipX', 'hipY', 'hipZ', 'rootYaw', 'rootRoll', 'rootPitch', 'headYaw', 'scaleY', 'lean'];

export function blendDefs(a, b, t) {
  const out = { ...a };
  for (const k of KEYS) {
    const av = a[k] || [0, 0, 0], bv = b[k] || [0, 0, 0];
    out[k] = [av[0] + (bv[0] - av[0]) * t, av[1] + (bv[1] - av[1]) * t, av[2] + (bv[2] - av[2]) * t];
  }
  for (const k of SCALARS) {
    const av = a[k] ?? 0, bv = b[k] ?? 0;
    out[k] = av + (bv - av) * t;
  }
  return out;
}

export function P(o = {}) {
  const p = blankPose();
  for (const k of KEYS) {
    const v = o[k];
    if (v) { p[k][0] = (v[0] || 0) * D; p[k][1] = (v[1] || 0) * D; p[k][2] = -(v[2] || 0) * D; }
  }
  for (const k of SCALARS) if (o[k] !== undefined) p[k] = o[k];
  return p;
}

// blend overrides onto a base pose definition object (degrees)
export function PO(base, o = {}) {
  const out = { ...base };
  for (const k of KEYS) if (o[k]) out[k] = o[k];
  for (const k of SCALARS) if (o[k] !== undefined) out[k] = o[k];
  return out;
}

// ---------- base definitions (deg) ----------
export const GUARD = {
  hips: [0, -24, 0], spine: [-4, -6, 0], chest: [-2, -8, 2], neck: [4, 10, 0], head: [2, 8, 0],
  shA: [-10, 0, -14], armA: [-58, 10, -8], foreA: [-78, 0, -12], handA: [-10, 0, 0],
  shB: [-6, 0, 14], armB: [-36, -12, 6], foreB: [-98, 0, 16], handB: [-12, 0, 0],
  thighA: [-18, 0, -5], shinA: [22, 0, 0], footA: [-4, 0, 0],
  thighB: [12, 0, 6], shinB: [26, 0, 0], footB: [-12, 0, 0],
  hipY: -0.045, hipX: 0.015, hipZ: 0, rootRoll: 0, rootPitch: 0, scaleY: 1,
};

export const POSE_DEFS = {
  stance: GUARD,
  stanceBreathe: PO(GUARD, { hipY: -0.058, chest: [-3, -8, 2], armA: [-60, 10, -10], armB: [-34, -12, 9], head: [3, 8, 0] }),

  crouch: PO(GUARD, {
    thighA: [-62, 0, -12], shinA: [96, 0, 0], footA: [-32, 0, 0],
    thighB: [-26, 0, 14], shinB: [102, 0, 0], footB: [-46, 0, 0], hips: [12, -24, 0],
    hipY: -0.34, spine: [8, -6, 0], chest: [6, -8, 2], head: [-8, 8, 0],
    armA: [-56, 8, -10], foreA: [-88, 0, -12], armB: [-32, -10, 9], foreB: [-104, 0, 20],
  }),
  crouchBreathe: PO(GUARD, {
    thighA: [-62, 0, -12], shinA: [96, 0, 0], footA: [-32, 0, 0],
    thighB: [-26, 0, 14], shinB: [102, 0, 0], footB: [-46, 0, 0], hips: [12, -24, 0],
    hipY: -0.352, spine: [9, -6, 0], chest: [7, -8, 2], head: [-7, 8, 0],
    armA: [-58, 8, -10], foreA: [-86, 0, -12], armB: [-34, -10, 9], foreB: [-102, 0, 20],
  }),

  block: PO(GUARD, {
    armA: [-96, 24, -32], foreA: [-100, 0, -34], armB: [-88, -22, 30], foreB: [-106, 0, 38],
    chest: [-6, -14, 2], head: [6, 10, 0], hipY: -0.06, hipX: -0.04,
  }),
  blockLow: PO(GUARD, {
    thighA: [-62, 0, -12], shinA: [98, 0, 0], footA: [-32, 0, 0],
    thighB: [-26, 0, 14], shinB: [104, 0, 0], footB: [-46, 0, 0], hips: [12, -24, 0],
    hipY: -0.34, spine: [10, -6, 0], chest: [8, -14, 2], head: [-8, 10, 0],
    armA: [-88, 24, -32], foreA: [-104, 0, -34], armB: [-80, -22, 30], foreB: [-108, 0, 38],
  }),

  walkF1: PO(GUARD, {
    thighA: [-36, 0, -12], shinA: [30, 0, 0], footA: [-2, 0, 0],
    thighB: [22, 0, 12], shinB: [36, 0, 0], footB: [-24, 0, 0], hipY: -0.065, hipZ: 0.02,
    hips: [0, -26, -3], chest: [0, -8, 1], armA: [-62, 10, -10], armB: [-32, -10, 9],
  }),
  walkF2: PO(GUARD, {
    thighA: [-24, 0, -12], shinA: [26, 0, 0], footA: [-6, 0, 0],
    thighB: [16, 0, 12], shinB: [42, 0, 0], footB: [-20, 0, 0], hipY: -0.03, hipZ: -0.01,
    hips: [0, -22, 2], chest: [0, -8, 3], armA: [-57, 10, -10], armB: [-38, -10, 9],
  }),
  walkB1: PO(GUARD, {
    thighA: [-10, 0, -12], shinA: [22, 0, 0], footA: [-8, 0, 0],
    thighB: [26, 0, 12], shinB: [42, 0, 0], footB: [-28, 0, 0], hipY: -0.07, hipZ: -0.02,
    chest: [-4, -8, 2], armA: [-54, 10, -10], armB: [-40, -10, 9],
  }),
  walkB2: PO(GUARD, {
    thighA: [-20, 0, -12], shinA: [26, 0, 0], footA: [-6, 0, 0],
    thighB: [18, 0, 12], shinB: [30, 0, 0], footB: [-18, 0, 0], hipY: -0.038, hipZ: 0.01,
    chest: [-2, -8, 2], armA: [-60, 10, -10], armB: [-34, -10, 9],
  }),

  jumpPrep: PO(GUARD, {
    thighA: [-52, 0, -12], shinA: [80, 0, 0], footA: [-28, 0, 0],
    thighB: [-22, 0, 14], shinB: [86, 0, 0], footB: [-38, 0, 0], hipY: -0.28, spine: [10, -6, 0],
    armA: [-40, 10, -10], armB: [-24, -10, 9],
  }),
  jumpUp: PO(GUARD, {
    thighA: [-58, 0, -14], shinA: [94, 0, 0], footA: [-34, 0, 0],
    thighB: [-16, 0, 14], shinB: [74, 0, 0], footB: [-30, 0, 0], hipY: 0, spine: [-6, -6, 0],
    armA: [-120, 20, -34], foreA: [-40, 0, 0], armB: [-30, -20, 26], foreB: [-60, 0, 0],
  }),
  jumpFall: PO(GUARD, {
    thighA: [-40, 0, -12], shinA: [56, 0, 0], footA: [-20, 0, 0],
    thighB: [-6, 0, 12], shinB: [46, 0, 0], footB: [-26, 0, 0], hipY: -0.04, spine: [4, -6, 0],
    armA: [-80, 20, -30], foreA: [-66, 0, 0], armB: [-50, -18, 22], foreB: [-80, 0, 0],
  }),
  land: PO(GUARD, {
    thighA: [-60, 0, -12], shinA: [90, 0, 0], footA: [-28, 0, 0],
    thighB: [-28, 0, 14], shinB: [94, 0, 0], footB: [-42, 0, 0], hipY: -0.32, spine: [14, -6, 0],
    chest: [8, -8, 2], armA: [-30, 10, -10], armB: [-20, -10, 9],
  }),

  dashF: PO(GUARD, {
    thighA: [-46, 0, -10], shinA: [50, 0, 0], footA: [-6, 0, 0],
    thighB: [30, 0, 12], shinB: [60, 0, 0], footB: [-32, 0, 0], hipY: -0.12, spine: [-16, -6, 0],
    chest: [-8, -8, 2], head: [14, 8, 0], armA: [-36, 10, -10], armB: [-14, -10, 9],
  }),
  dashB: PO(GUARD, {
    thighA: [-30, 0, -10], shinA: [44, 0, 0], footA: [-14, 0, 0],
    thighB: [26, 0, 12], shinB: [46, 0, 0], footB: [-24, 0, 0], hipY: -0.08, spine: [6, -6, 0],
    armA: [-40, 10, -10], armB: [-24, -10, 9],
  }),

  // ---------- reactions ----------
  hitHigh: PO(GUARD, {
    head: [26, 16, -6], neck: [18, 10, 0], chest: [16, -2, -6], spine: [14, -2, -2], hips: [-4, -24, 0],
    armA: [-30, 24, -36], foreA: [-50, 0, -10], armB: [-16, -34, 32], foreB: [-40, 0, 0],
    thighA: [-24, 0, -12], thighB: [22, 0, 12], hipY: -0.09, hipX: -0.05,
  }),
  hitMid: PO(GUARD, {
    chest: [10, -6, -4], spine: [22, -6, 0], head: [10, 8, 0], neck: [8, 8, 0], hips: [8, -24, 0],
    armA: [-24, 22, -26], foreA: [-66, 0, -10], armB: [-16, -22, 24], foreB: [-76, 0, 10],
    hipY: -0.14, hipX: -0.06, thighA: [-32, 0, -12], shinA: [40, 0, 0], thighB: [10, 0, 12], shinB: [44, 0, 0],
  }),
  hitLow: PO(GUARD, {
    spine: [30, -6, 0], chest: [20, -6, 4], head: [-16, 8, 0], neck: [10, 8, 0], hips: [16, -24, 0],
    armA: [-60, 30, -36], foreA: [-40, 0, -10], armB: [-30, -40, 32], foreB: [-46, 0, 0],
    thighA: [-50, 0, -12], shinA: [56, 0, 0], thighB: [-14, 0, 12], shinB: [60, 0, 0], hipY: -0.22, hipX: -0.03,
  }),
  stagger: PO(GUARD, {
    spine: [18, -4, 6], chest: [8, 0, 10], head: [12, 4, -8], armA: [-16, 30, -46], foreA: [-30, 0, 0],
    armB: [-6, -30, 40], foreB: [-36, 0, 0], hipY: -0.12, rootRoll: 0.12, thighA: [-20, 0, -12], thighB: [14, 0, 12],
  }),
  crumple: PO(GUARD, {
    hips: [24, -14, 0], spine: [24, -4, 6], chest: [18, 0, 8], head: [-20, 10, 0],
    armA: [-14, 20, -30], foreA: [-24, 0, 0], armB: [-10, -20, 26], foreB: [-30, 0, 0],
    thighA: [-70, 0, -14], shinA: [100, 0, 0], thighB: [-40, 0, 14], shinB: [104, 0, 0],
    hipY: -0.5, hipZ: -0.1,
  }),
  knockdown: PO(GUARD, {
    rootPitch: -84, hipY: -0.76, hips: [0, -6, 0], spine: [-12, 0, 0], chest: [-8, 0, 4], head: [-8, -10, 0],
    armA: [-110, 20, -56], foreA: [-20, 0, 0], armB: [-80, -20, 46], foreB: [-30, 0, 0],
    thighA: [-50, 0, -10], shinA: [30, 0, 0], footA: [-20, 0, 0], thighB: [-30, 0, 12], shinB: [50, 0, 0], footB: [-20, 0, 0],
    hipZ: 0.1,
  }),
  wakeKneel: PO(GUARD, {
    hips: [20, -14, 0], spine: [16, -4, 0], chest: [10, -6, 0], head: [-14, 8, 0],
    thighA: [-80, 0, -14], shinA: [110, 0, 0], thighB: [-60, 0, 14], shinB: [120, 0, 0],
    armA: [-30, 20, -26], foreA: [-40, 0, 0], armB: [-20, -20, 24], foreB: [-46, 0, 0], hipY: -0.55,
  }),
  dizzy: PO(GUARD, {
    spine: [8, 0, 10], chest: [4, 0, 12], head: [4, 0, -16], neck: [0, 0, 10],
    armA: [-14, 10, -46], foreA: [-16, 0, 0], armB: [-10, -10, 46], foreB: [-20, 0, 0],
    thighA: [-16, 0, -12], shinA: [24, 0, 0], thighB: [8, 0, 14], shinB: [26, 0, 0], hipY: -0.06, rootRoll: 0.06,
  }),

  // ---------- attacks ----------
  punchLv1: PO(GUARD, {
    hips: [0, -34, 0], spine: [-2, -14, 0], chest: [-2, -22, 2], head: [2, 18, 0],
    armA: [-96, 6, 4], foreA: [-6, 0, 0], handA: [0, 0, 0],
    armB: [-26, -16, 10], foreB: [-104, 0, 20], thighA: [-22, 0, -10], thighB: [14, 0, 10],
    hipY: -0.05, hipX: 0.04, hipZ: 0.06,
  }),
  punchLv2: PO(GUARD, {
    hips: [0, -18, 0], spine: [-6, -2, 0], chest: [-4, -4, 0], head: [4, 4, 0],
    armA: [-96, 14, 10], foreA: [-34, 0, 4], armB: [-40, -14, 10], foreB: [-100, 0, 16],
    hipY: -0.06, hipZ: 0.02,
  }),
  punchB: PO(GUARD, {
    hips: [0, -46, 0], spine: [0, -24, 0], chest: [-2, -34, 2], head: [2, 28, 0],
    armA: [-52, 10, -18], foreA: [-90, 0, -10], armB: [-96, -4, 12], foreB: [-8, 0, 0], handB: [0, 0, 0],
    thighA: [-24, 0, -10], thighB: [18, 0, 12], hipZ: 0.08, hipX: 0.02, hipY: -0.055,
  }),
  kickLv1: PO(GUARD, {
    hips: [0, -30, 0], spine: [8, -10, 0], chest: [2, -12, 2], head: [-4, 12, 0],
    thighA: [-70, 0, -10], shinA: [20, 0, 0], footA: [-26, 0, 0], thighB: [10, 0, 12], shinB: [26, 0, 0],
    armA: [-44, 12, -22], foreA: [-70, 0, -10], armB: [-30, -14, 16], foreB: [-96, 0, 16], hipY: -0.02,
  }),
  kickLv2: PO(GUARD, {
    hips: [0, -40, 0], spine: [14, -16, 0], chest: [6, -18, 2], head: [-6, 16, 0],
    thighA: [-88, 0, -14], shinA: [10, 0, 0], footA: [-30, 0, 0], thighB: [16, 0, 12], shinB: [30, 0, 0],
    armA: [-30, 14, -28], foreA: [-60, 0, -10], armB: [-20, -16, 22], foreB: [-80, 0, 16], hipY: -0.01,
  }),
  kickB: PO(GUARD, {
    hips: [0, -52, 0], spine: [16, -26, 0], chest: [8, -28, 2], head: [-8, 24, 0],
    thighB: [-100, 0, 20], shinB: [8, 0, 0], footB: [-28, 0, 0], thighA: [-10, 0, -10], shinA: [22, 0, 0],
    armA: [-14, 20, -34], foreA: [-40, 0, -10], armB: [-64, -10, 12], foreB: [-40, 0, 6], hipY: 0.02,
  }),

  crouchPunch: PO(GUARD, {
    hips: [12, -34, 0], spine: [8, -14, 0], chest: [4, -22, 2], head: [-6, 18, 0],
    armA: [-78, 8, 2], foreA: [-10, 0, 0], armB: [-30, -14, 10], foreB: [-100, 0, 18],
    thighA: [-62, 0, -12], shinA: [96, 0, 0], footA: [-32, 0, 0], thighB: [-26, 0, 14], shinB: [102, 0, 0], footB: [-46, 0, 0],
    hipY: -0.33,
  }),
  crouchKick: PO(GUARD, {
    hips: [14, -30, 0], spine: [12, -10, 0], chest: [6, -12, 2],
    thighA: [-98, 0, -16], shinA: [14, 0, 0], footA: [-20, 0, 0], thighB: [-26, 0, 14], shinB: [106, 0, 0], footB: [-46, 0, 0],
    hipY: -0.4, armA: [-40, 12, -22], foreA: [-70, 0, -10], armB: [-28, -14, 16], foreB: [-96, 0, 16],
  }),
  sweepPose: PO(GUARD, {
    hips: [20, -40, 0], spine: [18, -16, 0], chest: [10, -20, 2], head: [-14, 16, 0],
    thighA: [-104, 0, -26], shinA: [12, 0, 0], footA: [-14, 0, 0],
    thighB: [-30, 0, 16], shinB: [112, 0, 0], footB: [-48, 0, 0],
    armA: [-30, 20, -40], foreA: [-50, 0, 0], armB: [-26, -20, 30], foreB: [-60, 0, 0], hipY: -0.44,
  }),

  // ---------- grabs / throws ----------
  throwGrab: PO(GUARD, {
    hips: [0, -30, 0], spine: [-4, -8, 0], chest: [-2, -12, 2], head: [2, 10, 0],
    armA: [-88, 14, -22], foreA: [-14, 0, 0], armB: [-84, -14, 22], foreB: [-16, 0, 0],
    thighA: [-24, 0, -10], thighB: [16, 0, 12], hipY: -0.08, hipZ: 0.06,
  }),
  throwLift: PO(GUARD, {
    hips: [-6, -20, 0], spine: [-16, -4, 0], chest: [-12, -4, 2], head: [10, 4, 0],
    armA: [-150, 14, -18], foreA: [-20, 0, 0], armB: [-140, -14, 18], foreB: [-24, 0, 0],
    thighA: [-30, 0, -10], thighB: [10, 0, 12], hipY: -0.04,
  }),
  throwSlam: PO(GUARD, {
    hips: [16, -14, 0], spine: [26, 0, 0], chest: [18, 0, 4], head: [-24, 0, 0],
    armA: [-6, 14, -18], foreA: [-20, 0, 0], armB: [-4, -14, 18], foreB: [-20, 0, 0],
    thighA: [-56, 0, -12], shinA: [70, 0, 0], thighB: [-20, 0, 12], shinB: [76, 0, 0], hipY: -0.28,
  }),
  thrown: PO(GUARD, {
    rootPitch: -70, hipY: -0.7, spine: [10, 0, 0], chest: [6, 0, 6], head: [10, -8, 0],
    armA: [-150, 20, -76], armB: [-140, -20, 66], thighA: [-70, 0, -16], shinA: [40, 0, 0], thighB: [-50, 0, 16], shinB: [50, 0, 0],
  }),

  // ---------- cinematic ----------
  intro: PO(GUARD, {
    hips: [0, -34, 0], chest: [-6, -26, 2], head: [4, 22, 0], spine: [-2, -16, 0],
    armA: [-30, 30, -76], foreA: [-60, 0, -10], armB: [-24, -30, 66], foreB: [-70, 0, 10],
    thighA: [-20, 0, -12], thighB: [16, 0, 14], hipY: -0.05,
  }),
  introFlex: PO(GUARD, {
    hips: [0, -16, 0], chest: [-10, -10, 0], spine: [-8, -6, 0], head: [-6, 6, 0],
    armA: [-120, 30, -86], foreA: [-110, 0, 0], armB: [-120, -30, 86], foreB: [-110, 0, 0],
    thighA: [-16, 0, -16], thighB: [14, 0, 18], hipY: -0.04,
  }),
  victory: PO(GUARD, {
    hips: [0, -12, 0], chest: [-4, -6, 0], spine: [-2, -4, 0], head: [0, 4, 0],
    armA: [-150, 12, -34], foreA: [-30, 0, 0], armB: [-30, -16, 34], foreB: [-60, 0, 0],
    thighA: [-14, 0, -12], thighB: [14, 0, 12], hipY: -0.03,
  }),
  victoryPoint: PO(GUARD, {
    hips: [0, -26, 0], chest: [-4, -16, 2], head: [0, 12, 0],
    armA: [-104, 10, -16], foreA: [-6, 0, 0], armB: [-20, -14, 18], foreB: [-90, 0, 12],
    thighA: [-16, 0, -10], thighB: [12, 0, 10], hipY: -0.04,
  }),
  taunt: PO(GUARD, {
    hips: [0, -20, 0], chest: [0, -10, 2], head: [0, 16, 0],
    armA: [-40, 20, -56], foreA: [-100, 0, -10], armB: [-20, -14, 18], foreB: [-90, 0, 12],
    hipY: -0.04,
  }),
  perfectPose: PO(GUARD, {
    hips: [0, -10, 0], chest: [-14, -4, 0], spine: [-10, -2, 0], head: [-16, 0, 0],
    armA: [-140, 20, -56], foreA: [-20, 0, 0], armB: [-140, -20, 52], foreB: [-20, 0, 0],
    thighA: [-10, 0, -10], thighB: [10, 0, 10], hipY: 0.02,
  }),
  superCharge: PO(GUARD, {
    hips: [12, -8, 0], spine: [22, 0, 0], chest: [16, 0, 0], head: [-26, 0, 0], neck: [-8, 0, 0],
    armA: [-30, 40, -80], foreA: [-120, 0, 0], armB: [-30, -40, 80], foreB: [-120, 0, 0],
    thighA: [-40, 0, -20], shinA: [56, 0, 0], thighB: [-10, 0, 20], shinB: [50, 0, 0], hipY: -0.2,
  }),
  superLaunch: PO(GUARD, {
    hips: [0, -18, 0], spine: [-20, -8, 0], chest: [-16, -8, 0], head: [16, 6, 0],
    armA: [-170, 12, -12], foreA: [-4, 0, 0], armB: [-130, -12, 14], foreB: [-14, 0, 0],
    thighA: [-30, 0, -10], thighB: [20, 0, 10], hipY: 0.04,
  }),
};

// Build pose objects lazily
const cache = new Map();
export function getPose(name) {
  if (cache.has(name)) return cache.get(name);
  const def = POSE_DEFS[name];
  if (!def) { console.warn('missing pose', name); return getPose('stance'); }
  const p = P(def);
  cache.set(name, p);
  return p;
}

export function poseFrom(def) { return P(def); }
export { mixPose, blankPose };
