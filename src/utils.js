// Small shared helpers.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

let _seed = 1337;
export function srand() { // deterministic RNG for cosmetic variation
  _seed = (_seed * 1664525 + 1013904223) % 4294967296;
  return _seed / 4294967296;
}

export function fmt(n, d = 0) { return Number(n).toFixed(d); }

// Format a frame count like "5F".
export const fr = (n) => `${Math.round(n)}F`;

// Angle helpers
export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function lerpAngle(a, b, t) { return a + wrapAngle(b - a) * t; }

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

export class EventBus {
  constructor() { this.map = new Map(); }
  on(k, f) { if (!this.map.has(k)) this.map.set(k, new Set()); this.map.get(k).add(f); return () => this.off(k, f); }
  off(k, f) { this.map.get(k)?.delete(f); }
  emit(k, ...args) { const s = this.map.get(k); if (s) for (const f of s) f(...args); }
}

// Very small tween helper working on plain objects: tween(obj, {x: 5}, 0.3, ease)
export function tweenObj(obj, target, dur, ease = (t) => t, onDone = null) {
  const from = {}; let t = 0;
  for (const k in target) from[k] = obj[k];
  return {
    update(dt) {
      t += dt;
      const p = Math.min(1, t / dur); const e = ease(p);
      for (const k in target) obj[k] = from[k] + (target[k] - from[k]) * e;
      if (p >= 1 && onDone) { const f = onDone; onDone = null; f(); }
      return p >= 1;
    },
  };
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}
