// Pose sets for special/super move archetypes.
import { POSE_DEFS, P, PO, GUARD, blendDefs, getPose } from './poses.js';

const D = Math.PI / 180;
const G = POSE_DEFS.stance;

const STYLES = {
  // Rising uppercut style (dragon punch)
  uppercut: {
    wind: PO(G, {
      thighA: [-46, 0, -8], shinA: [62, 0, 0], thighB: [-6, 0, 8], shinB: [64, 0, 0], hipY: -0.2,
      spine: [14, 6, 0], chest: [8, 8, 2], head: [-6, -8, 0],
      armA: [-20, 20, -40], foreA: [-84, 0, -10], armB: [-30, -14, 20], foreB: [-96, 0, 14],
    }),
    active: PO(G, {
      hipY: 0.1, rootPitch: -0.12, spine: [-14, -10, 0], chest: [-10, -12, 2], head: [12, 8, 0],
      armA: [-176, 4, -6], foreA: [-6, 0, 0], handA: [0, 0, 0],
      armB: [-40, -20, 20], foreB: [-60, 0, 10],
      thighA: [-58, 0, -8], shinA: [26, 0, 0], footA: [-26, 0, 0],
      thighB: [16, 0, 10], shinB: [54, 0, 0], footB: [-30, 0, 0],
    }),
    follow: PO(G, {
      hipY: -0.06, spine: [-4, -6, 0], chest: [-2, -8, 2], head: [4, 8, 0],
      armA: [-150, 10, -14], foreA: [-30, 0, 0], armB: [-30, -16, 16], foreB: [-80, 0, 10],
      thighA: [-30, 0, -8], shinA: [46, 0, 0], thighB: [14, 0, 8], shinB: [34, 0, 0],
    }),
  },
  // Projectile throw
  projectile: {
    wind: PO(G, {
      hips: [0, -6, 0], spine: [8, 6, 0], chest: [4, 8, 2], head: [-4, -8, 0],
      armA: [-40, 40, -30], foreA: [-116, 0, -10], armB: [-52, -10, 18], foreB: [-110, 0, 16],
      thighA: [-26, 0, -8], thighB: [-4, 0, 10], hipY: -0.1,
    }),
    active: PO(G, {
      hips: [0, -32, 0], spine: [0, -16, 0], chest: [-2, -24, 2], head: [2, 18, 0],
      armA: [-92, 8, -6], foreA: [-4, 0, 0], handA: [0, 0, 0],
      armB: [-84, -8, 6], foreB: [-8, 0, 0], handB: [0, 0, 0],
      thighA: [-24, 0, -8], thighB: [16, 0, 8], hipY: -0.06, hipZ: 0.05,
    }),
    follow: PO(G, {
      hips: [0, -28, 0], spine: [0, -12, 0], chest: [-2, -20, 2], head: [2, 16, 0],
      armA: [-82, 10, -8], foreA: [-30, 0, -4], armB: [-70, -10, 8], foreB: [-40, 0, 6],
      thighA: [-24, 0, -8], thighB: [16, 0, 8], hipY: -0.07,
    }),
  },
  // Horizontal charging rush (shoulder tackle / lunge punch)
  rush: {
    wind: PO(G, {
      hips: [0, -8, 0], spine: [16, 6, 0], chest: [10, 8, 2], head: [-8, -8, 0],
      armA: [-60, 20, -30], foreA: [-100, 0, -10], armB: [-30, -14, 20], foreB: [-100, 0, 16],
      thighA: [-40, 0, -8], shinA: [50, 0, 0], thighB: [8, 0, 8], shinB: [46, 0, 0], hipY: -0.16,
    }),
    active: PO(G, {
      hips: [0, -42, 0], spine: [-24, -20, 0], chest: [-18, -26, 2], head: [18, 20, 0],
      armA: [-88, 30, -20], foreA: [-16, 0, 0], armB: [-40, -30, 26], foreB: [-60, 0, 6],
      thighA: [-64, 0, -8], shinA: [36, 0, 0], footA: [-16, 0, 0],
      thighB: [40, 0, 8], shinB: [70, 0, 0], footB: [-40, 0, 0], hipY: -0.12, hipZ: 0.12,
    }),
    follow: PO(G, {
      hips: [0, -34, 0], spine: [-10, -16, 0], chest: [-6, -20, 2], head: [8, 16, 0],
      armA: [-80, 20, -16], foreA: [-40, 0, -6], armB: [-30, -20, 20], foreB: [-80, 0, 10],
      thighA: [-40, 0, -8], thighB: [10, 0, 8], hipY: -0.14,
    }),
  },
  // Spinning kick (tatsu style)
  spin: {
    wind: PO(G, {
      hips: [0, -20, 0], spine: [10, -6, 0], chest: [4, -8, 2], head: [-4, 8, 0],
      thighA: [-54, 0, -8], shinA: [64, 0, 0], thighB: [-14, 0, 8], shinB: [60, 0, 0], hipY: -0.26,
      armA: [-30, 20, -40], foreA: [-70, 0, -10], armB: [-20, -20, 30], foreB: [-80, 0, 10],
    }),
    active: PO(G, {
      hips: [0, -30, 0], spine: [16, -8, 0], chest: [8, -10, 2], head: [-8, 10, 0],
      rootRoll: 0.35, thighA: [-92, 0, -14], shinA: [10, 0, 0], footA: [-16, 0, 0],
      thighB: [18, 0, 12], shinB: [34, 0, 0],
      armA: [-30, 40, -60], foreA: [-40, 0, -10], armB: [-20, -40, 50], foreB: [-50, 0, 10],
      hipY: -0.03,
    }),
    follow: PO(G, {
      hips: [0, -26, 0], spine: [6, -6, 0], chest: [2, -8, 2],
      thighA: [-46, 0, -10], shinA: [50, 0, 0], thighB: [10, 0, 10], shinB: [36, 0, 0],
      armA: [-40, 20, -30], foreA: [-70, 0, -10], armB: [-30, -20, 24], foreB: [-80, 0, 10], hipY: -0.12,
    }),
  },
  // Air dive kick
  dive: {
    wind: PO(G, {
      hips: [0, -20, 0], spine: [-10, -4, 0], chest: [-8, -6, 2], head: [10, 6, 0],
      thighA: [-70, 0, -8], shinA: [86, 0, 0], thighB: [-10, 0, 8], shinB: [80, 0, 0],
      armA: [-130, 20, -40], foreA: [-40, 0, 0], armB: [-120, -20, 40], foreB: [-50, 0, 0],
      hipY: 0.06,
    }),
    active: PO(G, {
      rootPitch: 0.35, hips: [0, -16, 0], spine: [8, -4, 0], chest: [6, -6, 2], head: [-8, 6, 0],
      thighA: [-86, 0, -6], shinA: [20, 0, 0], footA: [-30, 0, 0],
      thighB: [6, 0, 8], shinB: [50, 0, 0],
      armA: [-60, 40, -50], foreA: [-40, 0, -10], armB: [-30, -40, 40], foreB: [-50, 0, 10], hipY: 0.04,
    }),
    follow: PO(G, {
      rootPitch: 0.2, hips: [0, -14, 0], spine: [4, -4, 0],
      thighA: [-70, 0, -6], shinA: [40, 0, 0], thighB: [10, 0, 8], shinB: [46, 0, 0],
      armA: [-40, 30, -40], foreA: [-60, 0, -10], armB: [-30, -30, 30], foreB: [-70, 0, 10],
    }),
  },
  // Counter stance (blade guard / zen guard)
  counter: {
    wind: PO(G, {
      hips: [0, -30, 0], spine: [6, -10, 0], chest: [2, -16, 2], head: [-4, 14, 0],
      armA: [-96, 26, -40], foreA: [-24, 0, 0], armB: [-70, -18, 30], foreB: [-100, 0, 20],
      thighA: [-38, 0, -8], shinA: [50, 0, 0], thighB: [-4, 0, 8], shinB: [40, 0, 0], hipY: -0.2,
    }),
    active: PO(G, {
      hips: [0, -34, 0], spine: [2, -14, 0], chest: [0, -20, 2], head: [0, 16, 0],
      armA: [-84, 30, -60], foreA: [-14, 0, 0], armB: [-66, -20, 40], foreB: [-90, 0, 26],
      thighA: [-42, 0, -8], shinA: [54, 0, 0], thighB: [-6, 0, 8], shinB: [44, 0, 0], hipY: -0.24,
    }),
    follow: PO(G, {
      hips: [0, -20, 0], spine: [-6, -8, 0], chest: [-2, -12, 2],
      armA: [-30, 30, -60], foreA: [-30, 0, 0], armB: [-24, -20, 30], foreB: [-70, 0, 10], hipY: -0.08,
    }),
  },
  // Ground stomp / shockwave
  stomp: {
    wind: PO(G, {
      hips: [0, -10, 0], spine: [8, 6, 0], chest: [4, 8, 2], head: [-6, -8, 0],
      thighA: [-90, 0, -10], shinA: [100, 0, 0], footA: [-30, 0, 0],
      thighB: [10, 0, 8], shinB: [20, 0, 0],
      armA: [-40, 30, -50], foreA: [-80, 0, -10], armB: [-30, -30, 40], foreB: [-90, 0, 10], hipY: -0.1,
    }),
    active: PO(G, {
      hips: [14, -14, 0], spine: [20, 0, 0], chest: [14, 0, 2], head: [-18, 0, 0],
      thighA: [-56, 0, -10], shinA: [40, 0, 0], footA: [-20, 0, 0],
      thighB: [-26, 0, 10], shinB: [80, 0, 0], footB: [-44, 0, 0],
      armA: [-20, 30, -40], foreA: [-100, 0, -10], armB: [-16, -30, 34], foreB: [-100, 0, 10], hipY: -0.34,
    }),
    follow: PO(G, {
      hips: [8, -18, 0], spine: [12, -4, 0], chest: [8, -6, 2],
      thighA: [-46, 0, -10], shinA: [56, 0, 0], thighB: [-12, 0, 10], shinB: [70, 0, 0], hipY: -0.3,
    }),
  },
  // Command grab
  grab: {
    wind: PO(G, {
      hips: [0, -14, 0], spine: [12, 4, 0], chest: [8, 6, 2], head: [-6, -6, 0],
      armA: [-70, 30, -60], foreA: [-70, 0, -10], armB: [-70, -30, 60], foreB: [-70, 0, 10],
      thighA: [-40, 0, -10], shinA: [50, 0, 0], thighB: [0, 0, 12], shinB: [44, 0, 0], hipY: -0.18,
    }),
    active: PO(G, {
      hips: [0, -20, 0], spine: [-10, -10, 0], chest: [-8, -14, 2], head: [10, 12, 0],
      armA: [-86, 20, -30], foreA: [-16, 0, 0], armB: [-86, -20, 30], foreB: [-16, 0, 0],
      thighA: [-20, 0, -10], thighB: [18, 0, 10], hipY: -0.06, hipZ: 0.08,
    }),
    follow: PO(G, {
      hips: [10, -16, 0], spine: [18, -4, 0], chest: [12, -4, 2], head: [-14, 4, 0],
      armA: [-24, 24, -40], foreA: [-60, 0, 0], armB: [-20, -24, 36], foreB: [-60, 0, 0],
      thighA: [-40, 0, -10], shinA: [50, 0, 0], thighB: [-6, 0, 10], shinB: [54, 0, 0], hipY: -0.24,
    }),
  },
  // Teleport / phase
  teleport: {
    wind: PO(G, {
      hips: [0, -14, 0], spine: [10, 0, 0], chest: [8, 0, 2], head: [-8, 0, 0],
      armA: [-24, 50, -80], foreA: [-70, 0, -10], armB: [-24, -50, 80], foreB: [-70, 0, 10],
      thighA: [-40, 0, -14], shinA: [60, 0, 0], thighB: [-10, 0, 14], shinB: [56, 0, 0], hipY: -0.2,
    }),
    active: PO(G, {
      hips: [0, -10, 0], spine: [-4, 0, 0], chest: [-2, 0, 2], head: [4, 0, 0],
      armA: [-20, 60, -90], foreA: [-40, 0, 0], armB: [-20, -60, 90], foreB: [-40, 0, 0],
      thighA: [-30, 0, -16], shinA: [40, 0, 0], thighB: [-4, 0, 16], shinB: [36, 0, 0], hipY: -0.1,
    }),
    follow: PO(G, {
      hips: [0, -24, 0], spine: [4, -6, 0], chest: [2, -8, 2],
      armA: [-50, 20, -30], foreA: [-80, 0, -10], armB: [-40, -20, 26], foreB: [-90, 0, 10], hipY: -0.12,
    }),
  },
  // Beam / laser super
  beam: {
    wind: PO(G, {
      hips: [0, -14, 0], spine: [14, 6, 0], chest: [10, 8, 2], head: [-10, -8, 0],
      armA: [-30, 44, -70], foreA: [-100, 0, -10], armB: [-30, -44, 70], foreB: [-100, 0, 10],
      thighA: [-46, 0, -12], shinA: [60, 0, 0], thighB: [-6, 0, 12], shinB: [56, 0, 0], hipY: -0.24,
    }),
    active: PO(G, {
      hips: [0, -22, 0], spine: [-6, -12, 0], chest: [-4, -18, 2], head: [6, 14, 0],
      armA: [-88, 24, -20], foreA: [-4, 0, 0], armB: [-88, -24, 20], foreB: [-4, 0, 0],
      thighA: [-34, 0, -10], shinA: [44, 0, 0], thighB: [14, 0, 10], shinB: [40, 0, 0], hipY: -0.1, hipZ: 0.06,
    }),
    follow: PO(G, {
      hips: [0, -26, 0], spine: [-2, -10, 0], chest: [0, -16, 2], head: [4, 12, 0],
      armA: [-80, 20, -16], foreA: [-16, 0, 0], armB: [-70, -20, 18], foreB: [-24, 0, 0], hipY: -0.12,
    }),
  },
  // Multi-hit flurry (super)
  flurry: {
    wind: PO(G, {
      hips: [0, -34, 0], spine: [2, -18, 0], chest: [0, -26, 2], head: [2, 20, 0],
      armA: [-70, 20, -20], foreA: [-70, 0, -10], armB: [-40, -16, 16], foreB: [-100, 0, 14],
      thighA: [-34, 0, -10], shinA: [46, 0, 0], thighB: [6, 0, 10], shinB: [42, 0, 0], hipY: -0.18,
    }),
    active: PO(G, {
      hips: [0, -44, 0], spine: [0, -26, 0], chest: [-2, -34, 2], head: [2, 26, 0],
      armA: [-96, 2, -4], foreA: [-6, 0, 0], armB: [-88, -2, 4], foreB: [-8, 0, 0],
      thighA: [-26, 0, -10], shinA: [34, 0, 0], thighB: [16, 0, 10], shinB: [30, 0, 0], hipY: -0.12, hipZ: 0.08,
    }),
    follow: PO(G, {
      hips: [0, -38, 0], spine: [0, -20, 0], chest: [-2, -28, 2], head: [2, 22, 0],
      armA: [-80, 12, -12], foreA: [-30, 0, 0], armB: [-70, -12, 12], foreB: [-40, 0, 0], hipY: -0.14,
    }),
  },
  // Rising strike super
  rising: {
    wind: PO(G, {
      hips: [0, -24, 0], spine: [18, 0, 0], chest: [12, 0, 2], head: [-14, 0, 0],
      armA: [-20, 30, -50], foreA: [-90, 0, -10], armB: [-20, -30, 50], foreB: [-90, 0, 10],
      thighA: [-56, 0, -12], shinA: [78, 0, 0], thighB: [-14, 0, 12], shinB: [70, 0, 0], hipY: -0.34,
    }),
    active: PO(G, {
      hips: [0, -8, 0], spine: [-24, 0, 0], chest: [-18, 0, 2], head: [20, 0, 0],
      armA: [-176, 6, -10], foreA: [-4, 0, 0], armB: [-160, -6, 10], foreB: [-10, 0, 0],
      thighA: [-64, 0, -12], shinA: [24, 0, 0], thighB: [10, 0, 12], shinB: [40, 0, 0], hipY: 0.16, rootPitch: -0.2,
    }),
    follow: PO(G, {
      hips: [0, -18, 0], spine: [-8, 0, 0], chest: [-4, 0, 2], head: [10, 0, 0],
      armA: [-150, 10, -20], foreA: [-30, 0, 0], armB: [-130, -10, 20], foreB: [-40, 0, 0], hipY: -0.06,
    }),
  },
  // Blade slash
  slash: {
    wind: PO(G, {
      hips: [0, -20, 0], spine: [-8, 14, 0], chest: [-6, 20, 2], head: [6, -14, 0],
      armA: [-140, 20, -50], foreA: [-40, 0, -10], armB: [-30, -20, 30], foreB: [-100, 0, 14],
      thighA: [-34, 0, -10], shinA: [44, 0, 0], thighB: [-4, 0, 10], shinB: [40, 0, 0], hipY: -0.16,
    }),
    active: PO(G, {
      hips: [0, -46, 0], spine: [4, -26, 0], chest: [-2, -36, 2], head: [4, 26, 0],
      armA: [-86, 10, -10], foreA: [-8, 0, 0], armB: [-30, -16, 24], foreB: [-70, 0, 10],
      thighA: [-40, 0, -10], shinA: [30, 0, 0], thighB: [24, 0, 12], shinB: [40, 0, 0], hipY: -0.1, hipZ: 0.1,
    }),
    follow: PO(G, {
      hips: [0, -34, 0], spine: [0, -14, 0], chest: [-2, -24, 2], head: [2, 18, 0],
      armA: [-70, 16, -20], foreA: [-36, 0, 0], armB: [-30, -16, 20], foreB: [-80, 0, 10], hipY: -0.12,
    }),
  },
  // Kicks barrage super
  kickstorm: {
    wind: PO(G, {
      hips: [0, -16, 0], spine: [6, -10, 0], chest: [2, -14, 2], head: [-2, 12, 0],
      thighA: [-70, 0, -12], shinA: [90, 0, 0], thighB: [-14, 0, 12], shinB: [80, 0, 0],
      armA: [-52, 30, -50], foreA: [-60, 0, -10], armB: [-30, -30, 40], foreB: [-70, 0, 10], hipY: -0.3,
    }),
    active: PO(G, {
      hips: [0, -44, 0], spine: [12, -18, 0], chest: [6, -22, 2], head: [-6, 16, 0],
      thighA: [-98, 0, -10], shinA: [8, 0, 0], footA: [-24, 0, 0],
      thighB: [-10, 0, 12], shinB: [80, 0, 0],
      armA: [-30, 30, -50], foreA: [-70, 0, -10], armB: [-20, -30, 40], foreB: [-80, 0, 10], hipY: -0.02,
    }),
    follow: PO(G, {
      hips: [0, -30, 0], spine: [4, -12, 0], chest: [0, -16, 2],
      thighA: [-60, 0, -10], shinA: [40, 0, 0], thighB: [0, 0, 12], shinB: [50, 0, 0],
      armA: [-40, 24, -40], foreA: [-70, 0, -10], armB: [-30, -24, 30], foreB: [-80, 0, 10], hipY: -0.16,
    }),
  },
  // Void sphere charge
  orb: {
    wind: PO(G, {
      hips: [0, -10, 0], spine: [10, 0, 0], chest: [6, 0, 2], head: [-8, 0, 0],
      armA: [-70, 40, -60], foreA: [-60, 0, -20], armB: [-70, -40, 60], foreB: [-60, 0, 20],
      thighA: [-30, 0, -12], shinA: [40, 0, 0], thighB: [-4, 0, 12], shinB: [36, 0, 0], hipY: -0.14,
    }),
    active: PO(G, {
      hips: [0, -26, 0], spine: [-4, -8, 0], chest: [-2, -12, 2], head: [4, 10, 0],
      armA: [-92, 14, -16], foreA: [-6, 0, 0], armB: [-92, -14, 16], foreB: [-6, 0, 0],
      thighA: [-24, 0, -10], thighB: [16, 0, 10], hipY: -0.06, hipZ: 0.05,
    }),
    follow: PO(G, {
      hips: [0, -22, 0], spine: [0, -6, 0], chest: [0, -10, 2],
      armA: [-80, 16, -20], foreA: [-24, 0, 0], armB: [-80, -16, 20], foreB: [-24, 0, 0], hipY: -0.08,
    }),
  },
};

const cache = new Map();
export function getAnim(style) {
  if (cache.has(style)) return cache.get(style);
  const def = STYLES[style] || STYLES.rush;
  const a = { wind: P(def.wind), active: P(def.active), follow: P(def.follow) };
  cache.set(style, a);
  return a;
}

export function animStyleList() { return Object.keys(STYLES); }
