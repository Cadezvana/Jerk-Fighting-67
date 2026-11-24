// Original fighter roster: identities, stats, gear, and move sets.

// ---------- move factories ----------
const NOW = 0;

function proj(spec) {
  return {
    type: 'projectile', name: 'Projectile', vx: 6.2, life: 1.4, radius: 0.28,
    damage: 600, hitstun: 19, blockstun: 15, hitstop: 8, count: 1, delay: 0,
    color: 0x66ccff, y: 1.05, pierce: false, ghost: false,
    ...spec,
  };
}
function shockwave(spec) { return { ...proj({ vx: 7, life: 1.1, radius: 0.35, damage: 700, ...spec, type: 'shockwave' }) }; }
function beam(spec) {
  return { type: 'beam', name: 'Beam', length: 9, width: 0.55, height: 0.5, activeFor: 36, hitInterval: 8,
    damage: 260, hitstun: 16, blockstun: 12, hitstop: 4, color: 0xff5533, y: 1.0, chip: 0.18, ...spec };
}
function rushProp(spec) {
  return {
    type: 'rushProp', name: 'Rush', speed: 9.5, duration: 16, hits: 1, damage: 700, hitstun: 22,
    blockstun: 16, hitstop: 9, invulnBefore: 0, push: 0.08, onWallBounce: false, color: 0xffaa33, ...spec,
  };
}

export const SPECIAL_ANIM = {
  uppercut: 'uppercut', projectile: 'projectile', rush: 'rush', spin: 'spin', dive: 'dive',
  counter: 'counter', stomp: 'stomp', grab: 'grab', teleport: 'teleport', beam: 'beam',
  flurry: 'flurry', rising: 'rising', slash: 'slash', kickstorm: 'kickstorm', orb: 'orb',
};

// Special move definition. Inputs are mirror-relative: 'qcf' 'qcb' 'dp' 'hcf' 'hcb' 'qcfx2' 'qcbx2'
function special(o) {
  return {
    name: 'Special', input: 'qcf', buttons: ['LP'], anim: 'projectile', ex: false,
    startup: 12, active: 3, recovery: 22, damage: 780, hitstun: 21, blockstun: 16, hitstop: 9,
    hitbox: { bone: 'handA', offset: [0, 0, 0.16], size: [0.44, 0.4, 0.55], reach: 0.9 },
    cancel: { super: true, drive: true, jump: false, dash: false },
    proj: null, motion: { type: 'lunge', speed: 4.2, frames: 10 },
    knockdown: 'soft', chip: 0.15, cost: 0, type: 'special', level: 'mid',
    ...o,
  };
}

function superArt(o) {
  // Each Super Art level has its own button so all three are independently usable:
  // SA1 = qcf+LP, SA2 = qcf+MP, SA3 = qcf+HP (see superArt buttons below).
  const BUTTONS = { 1: ['LP'], 2: ['MP'], 3: ['HP'] };
  const meter = o.meter || 1;
  return special({
    type: 'super', anim: 'flurry', startup: 10, active: 12, recovery: 34, damage: 2200,
    hitstun: 30, blockstun: 20, hitstop: 12, knockdown: 'hard', cinematic: true,
    cancel: {}, meter, buttons: BUTTONS[meter] || ['LP'], ...o,
  });
}

// ---------- character definitions ----------
// Each has 6 normals (generated), 4 specials, 3 supers, 2 throws.
function normalsFor(spec) { return spec; }

export const CHARACTERS = [
  // 1. RIVET — balanced all-rounder
  {
    id: 'rivet', name: 'RIVET', title: 'THE IRON FIST', style: 'Balanced Striker',
    archetype: 'balanced', difficulty: 'NORMAL', flag: 'USA',
    desc: 'A street-born brawler who fights with compressed-spring boxing. Solid at every range — the purest way to learn the system.',
    stats: { power: 3, speed: 3, range: 3, defense: 3 },
    body: { height: 1.0, bulk: 1.02, gender: 'm' },
    colors: { skin: 0xc18a63, outfit: 0x2f66d8, outfit2: 0x1c2f63, trim: 0xe9eef7, accent: 0x35d1ff, hair: 0x2a2118, dark: 0x151821, eye: 0x3b6ea8 },
    gear: { head: 'bandana', belt: true, buckle: true, wraps: true, gloves: true, boots: 'short', thighWrap: true, scarf: true },
    walkSpeed: 1.0, walkBack: 0.82, dashSpeed: 1.0, jumpVel: 1.0, weight: 1.0,
    normals: { kind: 'standard', dmg: [330, 570, 880], reach: [0.68, 0.83, 0.99], speed: 1.0 },
    specials: [
      special({ name: 'Spring Jab', input: 'qcf', buttons: ['LP'], anim: 'rush', startup: 13, recovery: 20, damage: 720, hitstun: 22,
        hitbox: { bone: 'handA', offset: [0, 0, 0.18], size: [0.46, 0.42, 0.6], reach: 1.05 }, motion: { type: 'lunge', speed: 5.2, frames: 9 },
        exText: 'EX: armour' }),
      special({ name: 'Rising Rivet', input: 'dp', buttons: ['LP'], anim: 'uppercut', startup: 5, active: 8, recovery: 26, damage: 900,
        hitbox: { bone: 'handA', offset: [0, 0.1, 0.06], size: [0.5, 1.2, 0.5], reach: 0.55 }, knockdown: 'hard', launcher: 11,
        motion: { type: 'rise', speed: 8.5, frames: 9 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Iron Shoulder', input: 'qcb', buttons: ['HP'], anim: 'rush', startup: 18, recovery: 26, damage: 1050,
        hitbox: { bone: 'handA', offset: [0, 0, 0.2], size: [0.6, 0.55, 0.6], reach: 1.0 }, motion: { type: 'lunge', speed: 9.5, frames: 12 },
        knockdown: 'hard', guardBreak: false, exText: 'EX: unblockable wall bounce' }),
      special({ name: 'Piston Sweep', input: 'hcf', buttons: ['HK'], anim: 'stomp', startup: 14, recovery: 24, damage: 820,
        hitbox: { bone: 'footA', offset: [0, 0, 0.06], size: [0.5, 0.3, 0.7], reach: 1.1 }, level: 'low', knockdown: 'hard',
        motion: { type: 'none' }, proj: shockwave({ damage: 0, vx: 0, life: 0.2, knock: true }), exText: 'EX: ground shockwave' }),
    ],
    supers: [
      superArt({ name: 'SPRING DRIVE', art: 'SPECIAL ART I', meter: 1, anim: 'flurry', hits: 5, damage: 1900, hitstun: 26, startup: 9,
        hitbox: { bone: 'handA', offset: [0, 0, 0.2], size: [0.7, 0.6, 0.9], reach: 1.15 }, motion: { type: 'lunge', speed: 14, frames: 14 },
        color: 0x35d1ff, desc: 'Five-hit spring-loaded rush ending in a launcher.' }),
      superArt({ name: 'IRON HURRICANE', art: 'SUPER ART II', meter: 2, anim: 'spin', hits: 8, damage: 3000, startup: 12,
        hitbox: { bone: 'footA', offset: [0, 0.1, 0.1], size: [1.3, 1.4, 1.3], reach: 1.3 }, motion: { type: 'lunge', speed: 8, frames: 30 },
        color: 0xffc93c, desc: 'Advancing multi-revolution kick storm.' }),
      superArt({ name: 'PEAK RIVET', art: 'CRITICAL ART III', meter: 3, anim: 'rising', hits: 3, damage: 4400, startup: 8,
        hitbox: { bone: 'handA', offset: [0, 0.4, 0.1], size: [0.9, 2.2, 0.9], reach: 0.9 }, motion: { type: 'rise', speed: 9, frames: 22 },
        color: 0xff2d3d, desc: 'Sky-splitting uppercut of pure kinetic metal.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Rivet Slam', kind: 'throw', damage: 1300, anim: 'forward', dir: 1 },
      { name: 'Backdrop Bolt', kind: 'throw', damage: 1300, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0x35d1ff,
    counterAnim: 'counter',
    superFlashColor: 0x35d1ff,
  },

  // 2. EMBER — rushdown boxer, fire
  {
    id: 'ember', name: 'EMBER', title: 'SCORCHED EARTH', style: 'Blitz Boxer',
    archetype: 'rushdown', difficulty: 'NORMAL', flag: 'BRA',
    desc: 'A fire-dancer turned prizefighter. Overwhelming pressure, fast dashes and a burning command dash that closes any gap.',
    stats: { power: 3, speed: 5, range: 2, defense: 2 },
    body: { height: 0.95, bulk: 0.94, gender: 'f' },
    colors: { skin: 0x9a6a4a, outfit: 0xd8342a, outfit2: 0x8e1a12, trim: 0xffca6a, accent: 0xff7a1a, hair: 0x2b1710, dark: 0x1a1013, eye: 0x8a3a12 },
    gear: { head: 'ponytail', belt: true, buckle: false, wraps: true, gloves: true, boots: 'short', legBands: true, giSash: false },
    walkSpeed: 1.12, walkBack: 0.9, dashSpeed: 1.24, jumpVel: 1.04, weight: 0.9,
    normals: { kind: 'standard', dmg: [300, 520, 810], reach: [0.6, 0.73, 0.88], speed: 1.14 },
    specials: [
      special({ name: 'Flare Kick', input: 'qcf', buttons: ['LK'], anim: 'spin', startup: 11, active: 9, recovery: 20, damage: 700,
        hitbox: { bone: 'footA', offset: [0, 0.1, 0.1], size: [0.9, 1.0, 0.9], reach: 0.8 }, motion: { type: 'lunge', speed: 7, frames: 12 },
        knockdown: 'soft', exText: 'EX: hits twice' }),
      special({ name: 'Blaze Uppercut', input: 'dp', buttons: ['MP'], anim: 'uppercut', startup: 5, active: 9, recovery: 28, damage: 880,
        hitbox: { bone: 'handA', offset: [0, 0.15, 0.05], size: [0.55, 1.3, 0.55], reach: 0.6 }, knockdown: 'hard', launcher: 12,
        motion: { type: 'rise', speed: 9, frames: 10 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Ember Dash', input: 'qcb', buttons: ['LK'], anim: 'teleport', startup: 8, recovery: 16, damage: 0,
        hitbox: null, motion: { type: 'dash', speed: 16, frames: 10 }, exText: 'EX: strike before dash', invuln: 4 }),
      special({ name: 'Solar Flare', input: 'hcb', buttons: ['HP'], anim: 'projectile', startup: 20, recovery: 26, damage: 760,
        hitbox: null, proj: proj({ damage: 760, vx: 5.4, color: 0xff7a1a, radius: 0.34, hits: 1 }), exText: 'EX: fast double fireball' }),
    ],
    supers: [
      superArt({ name: 'BLAZING FURY', art: 'SPECIAL ART I', meter: 1, anim: 'flurry', hits: 6, damage: 1850, startup: 8, hitstun: 25,
        hitbox: { bone: 'handA', offset: [0, 0, 0.2], size: [0.7, 0.6, 0.95], reach: 1.2 }, motion: { type: 'lunge', speed: 15, frames: 16 },
        color: 0xff7a1a, desc: 'A relentless string of burning punches.' }),
      superArt({ name: 'FIREBIRD DESCENT', art: 'SUPER ART II', meter: 2, anim: 'dive', hits: 2, damage: 3050, startup: 14,
        hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [1.0, 1.0, 1.0], reach: 1.0 }, motion: { type: 'leap', speed: 12, frames: 24 },
        color: 0xffc93c, desc: 'Leaping flaming dive that explodes on contact.' }),
      superArt({ name: 'PHOENIX PROTOCOL', art: 'CRITICAL ART III', meter: 3, anim: 'kickstorm', hits: 12, damage: 4450, startup: 10,
        hitbox: { bone: 'footA', offset: [0, 0.2, 0.1], size: [1.4, 1.4, 1.4], reach: 1.4 }, motion: { type: 'lunge', speed: 10, frames: 40 },
        color: 0xff2d3d, desc: 'Ashes to ashes — a rising tornado of blows.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Searing Toss', kind: 'throw', damage: 1250, anim: 'forward', dir: 1 },
      { name: 'Ashfall', kind: 'throw', damage: 1250, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0xff7a1a,
    counterAnim: 'counter', superFlashColor: 0xff7a1a,
  },

  // 3. KAZE — ranged zoner, wind
  {
    id: 'kaze', name: 'KAZE', title: 'VOICE OF THE GALE', style: 'Wind Zoner',
    archetype: 'zoner', difficulty: 'NORMAL', flag: 'JPN',
    desc: 'A wandering hermit-sage. Controls space with slicing wind fans and a gusting reflector, then punishes panicked approaches.',
    stats: { power: 2, speed: 3, range: 5, defense: 2 },
    body: { height: 1.0, bulk: 0.98, gender: 'm' },
    colors: { skin: 0xb98f6a, outfit: 0x2a8a7a, outfit2: 0x145048, trim: 0xe4f0ec, accent: 0x6fe0c8, hair: 0x111318, dark: 0x121a19, eye: 0x2a5a52 },
    gear: { head: 'bun', belt: true, buckle: false, wraps: false, gloves: false, boots: 'none', giSash: true, coat: true, bareFeet: true },
    walkSpeed: 0.95, walkBack: 0.86, dashSpeed: 0.92, jumpVel: 1.0, weight: 0.98,
    normals: { kind: 'standard', dmg: [310, 540, 840], reach: [0.73, 0.94, 1.14], speed: 0.96 },
    specials: [
      special({ name: 'Gale Fan', input: 'qcf', buttons: ['LP'], anim: 'projectile', startup: 14, recovery: 22, damage: 600,
        hitbox: null, proj: proj({ damage: 600, vx: 7.2, color: 0x6fe0c8, radius: 0.3 }), exText: 'EX: double fan' }),
      special({ name: 'Vacuum Palm', input: 'qcb', buttons: ['MP'], anim: 'orb', startup: 12, recovery: 20, damage: 650,
        hitbox: { bone: 'handA', offset: [0, 0.1, 0.1], size: [0.7, 0.6, 0.6], reach: 0.9 }, motion: { type: 'lunge', speed: 3, frames: 6 },
        knockdown: 'soft', exText: 'EX: pulls opponent in' }),
      special({ name: 'Wind Step', input: 'dp', buttons: ['LK'], anim: 'uppercut', startup: 6, active: 8, recovery: 26, damage: 780,
        hitbox: { bone: 'footA', offset: [0, 0.2, 0.05], size: [0.55, 1.25, 0.55], reach: 0.55 }, knockdown: 'hard', launcher: 10,
        motion: { type: 'rise', speed: 8, frames: 10 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Cyclone Reflect', input: 'hcb', buttons: ['HP'], anim: 'counter', startup: 6, recovery: 24, damage: 550,
        hitbox: null, counter: { window: 18, reflectProjectile: true, damage: 900, hitstun: 30, stunType: 'stagger', color: 0x6fe0c8 },
        exText: 'EX: reflects projectiles' }),
    ],
    supers: [
      superArt({ name: 'TEMPEST FAN', art: 'SPECIAL ART I', meter: 1, anim: 'projectile', hits: 1, damage: 1900, startup: 12,
        hitbox: null, proj: proj({ damage: 1900, vx: 8.5, color: 0x6fe0c8, radius: 0.7, hits: 3, hitstun: 22, blockstun: 18 }),
        color: 0x6fe0c8, desc: 'A great cutting fan of harnessed storm-wind.' }),
      superArt({ name: 'SEVERING GALE', art: 'SUPER ART II', meter: 2, anim: 'slash', hits: 4, damage: 3000, startup: 14,
        hitbox: { bone: 'handA', offset: [0, 0.2, 0.2], size: [1.6, 1.2, 1.2], reach: 1.5 }, motion: { type: 'lunge', speed: 6, frames: 14 },
        color: 0xffc93c, desc: 'Four razor wind crescents in succession.' }),
      superArt({ name: 'EYE OF THE STORM', art: 'CRITICAL ART III', meter: 3, anim: 'orb', hits: 1, damage: 4300, startup: 16,
        hitbox: null, proj: proj({ damage: 4300, vx: 4.0, color: 0x9ffff0, radius: 1.15, pierce: true, big: true, hits: 1, hitstun: 40 }),
        color: 0x6fe0c8, desc: 'Unleashes the still heart of a hurricane.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Gale Toss', kind: 'throw', damage: 1250, anim: 'forward', dir: 1 },
      { name: 'Reversal Wind', kind: 'throw', damage: 1250, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0x6fe0c8,
    counterAnim: 'counter', superFlashColor: 0x6fe0c8,
  },

  // 4. GRIZZ — grappler
  {
    id: 'grizz', name: 'GRIZZ', title: 'MOUNTAIN EATER', style: 'Iron Grappler',
    archetype: 'grappler', difficulty: 'EASY', flag: 'CAN',
    desc: 'A bear of a lumberjack who wrestled storms off the peaks. Slow, but one command grab can end a round on the spot.',
    stats: { power: 5, speed: 1, range: 2, defense: 5 },
    body: { height: 1.1, bulk: 1.26, gender: 'm' },
    colors: { skin: 0xc79a76, outfit: 0x5b3a1f, outfit2: 0x38230f, trim: 0xd9a24a, accent: 0xffb03a, hair: 0x3a2412, dark: 0x1c1610, eye: 0x5a3a1a },
    gear: { head: 'cap', belt: true, buckle: true, wraps: true, gloves: true, boots: 'none', strap: true, armorChest: false, bareFeet: false, torsoBare: false, shoulderPads: false },
    walkSpeed: 0.82, walkBack: 0.7, dashSpeed: 0.78, jumpVel: 0.9, weight: 1.3,
    normals: { kind: 'standard', dmg: [380, 650, 1050], reach: [0.73, 0.91, 1.04], speed: 0.82 },
    specials: [
      special({ name: 'Boulder Toss', input: 'qcf', buttons: ['HP'], anim: 'projectile', startup: 22, recovery: 26, damage: 850,
        hitbox: null, proj: proj({ damage: 850, vx: 4.4, color: 0xa0804a, radius: 0.42, knockdown: 'hard', arc: true }),
        exText: 'EX: two boulders' }),
      special({ name: 'Timber Uppercut', input: 'dp', buttons: ['HP'], anim: 'uppercut', startup: 8, active: 8, recovery: 32, damage: 1050,
        hitbox: { bone: 'handA', offset: [0, 0.2, 0.05], size: [0.7, 1.5, 0.7], reach: 0.7 }, knockdown: 'hard', launcher: 14,
        motion: { type: 'rise', speed: 10, frames: 11 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: "Bear's Grip", input: 'hcb', buttons: ['HP'], anim: 'grab', startup: 7, active: 3, recovery: 34, damage: 1500,
        hitbox: { bone: 'handA', offset: [0, 0, 0.14], size: [0.55, 0.6, 0.5], reach: 0.62 }, motion: { type: 'none' },
        commandGrab: true, grabRange: 0.95, grabWhiff: true, exText: 'EX: longer range', level: 'unblockable' }),
      special({ name: 'Mountain Crumble', input: 'qcb', buttons: ['HK'], anim: 'stomp', startup: 20, recovery: 28, damage: 900,
        hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [0.6, 0.4, 0.8], reach: 1.2 }, level: 'low', knockdown: 'hard',
        motion: { type: 'stomp', speed: 3, frames: 8 }, proj: shockwave({ damage: 700, vx: 6, color: 0xd9a24a }),
        exText: 'EX: two shockwaves' }),
    ],
    supers: [
      superArt({ name: 'TIMBERLINE', art: 'SPECIAL ART I', meter: 1, anim: 'uppercut', hits: 2, damage: 1950, startup: 9,
        hitbox: { bone: 'handA', offset: [0, 0.3, 0.05], size: [0.8, 1.7, 0.8], reach: 0.75 }, motion: { type: 'rise', speed: 10, frames: 18 },
        knockdown: 'hard', color: 0xffb03a, desc: 'Falling-tree uppercut that launches skyward.' }),
      superArt({ name: 'GLACIER BREAKER', art: 'SUPER ART II', meter: 2, anim: 'grab', hits: 3, damage: 3200, startup: 8,
        hitbox: { bone: 'handA', offset: [0, 0, 0.14], size: [0.7, 0.7, 0.7], reach: 0.8 }, motion: { type: 'lunge', speed: 12, frames: 12 },
        commandGrab: true, grabRange: 1.4, color: 0xffc93c, desc: 'A rushing command grab that shatters the ground.' }),
      superArt({ name: 'MOUNTAIN EATER', art: 'CRITICAL ART III', meter: 3, anim: 'rising', hits: 2, damage: 4600, startup: 10,
        hitbox: { bone: 'handA', offset: [0, 0.4, 0.1], size: [1.2, 2.0, 1.2], reach: 1.0 }, motion: { type: 'rise', speed: 8, frames: 24 },
        color: 0xff2d3d, desc: 'Lifts the arena itself and slams it back down.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Lumberjack Slam', kind: 'throw', damage: 1500, anim: 'forward', dir: 1 },
      { name: 'Felling Axe', kind: 'throw', damage: 1500, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0xffb03a,
    counterAnim: 'counter', superFlashColor: 0xffb03a,
  },

  // 5. VESPER — technical footsies, electric rapier
  {
    id: 'vesper', name: 'VESPER', title: 'ELECTRIC DUELLIST', style: 'Fencing Technician',
    archetype: 'technical', difficulty: 'HARD', flag: 'FRA',
    desc: 'A duelist wired into her family\'s lightning coil. Long, precise pokes, a parry-counter stance, and lethal confirms.',
    stats: { power: 2, speed: 4, range: 5, defense: 2 },
    body: { height: 1.02, bulk: 0.92, gender: 'f' },
    colors: { skin: 0xf0c9a8, outfit: 0xe8eaf2, outfit2: 0x2f3a6a, trim: 0xffc93c, accent: 0x9f6bff, hair: 0x8a8aa8, dark: 0x1a1e2a, eye: 0x6a5ab0 },
    gear: { head: 'ponytail', belt: true, buckle: true, wraps: false, gloves: true, boots: 'tall', coat: true, shoulderPads: true, legBands: true },
    walkSpeed: 1.06, walkBack: 0.9, dashSpeed: 1.08, jumpVel: 1.0, weight: 0.92,
    normals: { kind: 'standard', dmg: [300, 540, 840], reach: [0.81, 1.04, 1.27], speed: 1.06 },
    specials: [
      special({ name: 'Thunder Lunge', input: 'qcf', buttons: ['MK'], anim: 'rush', startup: 15, recovery: 22, damage: 780,
        hitbox: { bone: 'handA', offset: [0, 0.05, 0.22], size: [0.4, 0.4, 0.9], reach: 1.4 }, motion: { type: 'lunge', speed: 11, frames: 10 },
        knockdown: 'soft', exText: 'EX: full-screen lunge' }),
      special({ name: 'Volt Uppercut', input: 'dp', buttons: ['HP'], anim: 'uppercut', startup: 6, active: 9, recovery: 28, damage: 900,
        hitbox: { bone: 'handA', offset: [0, 0.15, 0.05], size: [0.55, 1.4, 0.55], reach: 0.6 }, knockdown: 'hard', launcher: 12,
        motion: { type: 'rise', speed: 9.5, frames: 10 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Riposte Stance', input: 'qcb', buttons: ['LP'], anim: 'counter', startup: 5, recovery: 26, damage: 0,
        hitbox: null, counter: { window: 20, damage: 1000, hitstun: 30, stunType: 'stagger', autoFollow: true }, exText: 'EX: longer window' }),
      special({ name: 'Arc Step', input: 'hcb', buttons: ['LK'], anim: 'teleport', startup: 7, recovery: 14, damage: 0,
        hitbox: null, motion: { type: 'dash', speed: 20, frames: 8 }, invuln: 6, exText: 'EX: counter-attack dash' }),
    ],
    supers: [
      superArt({ name: 'THOUSAND VOLT', art: 'SPECIAL ART I', meter: 1, anim: 'slash', hits: 5, damage: 1900, startup: 10,
        hitbox: { bone: 'handA', offset: [0, 0.1, 0.2], size: [1.2, 1.0, 1.1], reach: 1.3 }, motion: { type: 'lunge', speed: 12, frames: 16 },
        color: 0x9f6bff, desc: 'A blistering series of electrified thrusts.' }),
      superArt({ name: 'ARC CHAMBER', art: 'SUPER ART II', meter: 2, anim: 'beam', hits: 1, damage: 2900, startup: 14,
        hitbox: null, beamObj: beam({ damage: 290, activeFor: 40, hitInterval: 6, color: 0x9f6bff, width: 0.5 }),
        color: 0x9f6bff, desc: 'Channels lightning into a piercing beam.' }),
      superArt({ name: 'LIGHTNING SUCCESSION', art: 'CRITICAL ART III', meter: 3, anim: 'flurry', hits: 10, damage: 4300, startup: 9,
        hitbox: { bone: 'handA', offset: [0, 0, 0.25], size: [0.9, 0.8, 1.3], reach: 1.5 }, motion: { type: 'lunge', speed: 17, frames: 22 },
        color: 0xff2d3d, desc: 'Strikes faster than the eye can follow.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Foil Press', kind: 'throw', damage: 1250, anim: 'forward', dir: 1 },
      { name: 'Reverse Arc', kind: 'throw', damage: 1250, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0x9f6bff,
    counterAnim: 'counter', superFlashColor: 0x9f6bff,
  },

  // 6. ROOK — heavy armour neutral
  {
    id: 'rook', name: 'ROOK', title: 'THE LAST BULWARK', style: 'Armored Juggernaut',
    archetype: 'heavy', difficulty: 'EASY', flag: 'GER',
    desc: 'A siege-armoured ex-guard who traded a castle for a ring. Slow momentum, but armour through nearly everything.',
    stats: { power: 5, speed: 2, range: 3, defense: 5 },
    body: { height: 1.04, bulk: 1.2, gender: 'm' },
    colors: { skin: 0xd6b090, outfit: 0x3a4250, outfit2: 0x232936, trim: 0xc0c8d8, accent: 0x7ad4ff, hair: 0x6a6a6a, dark: 0x141821, eye: 0x4a5a6a },
    gear: { head: 'helmet', belt: true, buckle: true, wraps: false, gloves: true, boots: 'tall', armorChest: true, shoulderPads: true, padSpikes: true, strap: true },
    walkSpeed: 0.86, walkBack: 0.76, dashSpeed: 0.84, jumpVel: 0.92, weight: 1.25,
    normals: { kind: 'standard', dmg: [350, 600, 980], reach: [0.73, 0.88, 1.04], speed: 0.88 },
    specials: [
      special({ name: 'Shield Charge', input: 'qcf', buttons: ['HP'], anim: 'rush', startup: 16, recovery: 26, damage: 950,
        hitbox: { bone: 'handA', offset: [0, 0.05, 0.2], size: [0.8, 0.8, 0.7], reach: 1.0 }, motion: { type: 'lunge', speed: 8, frames: 14 },
        knockdown: 'hard', armor: true, armorHits: 2, exText: 'EX: 3 armour hits' }),
      special({ name: 'Spire Uppercut', input: 'dp', buttons: ['HP'], anim: 'uppercut', startup: 7, active: 8, recovery: 30, damage: 1000,
        hitbox: { bone: 'handA', offset: [0, 0.2, 0.05], size: [0.65, 1.5, 0.65], reach: 0.65 }, knockdown: 'hard', launcher: 13,
        motion: { type: 'rise', speed: 9, frames: 11 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Ground Pound', input: 'qcb', buttons: ['HK'], anim: 'stomp', startup: 24, recovery: 30, damage: 900,
        hitbox: { bone: 'footA', offset: [0, 0, 0.1], size: [0.6, 0.4, 0.7], reach: 1.0 }, level: 'low', knockdown: 'hard',
        motion: { type: 'stomp', speed: 2, frames: 8 }, proj: shockwave({ damage: 750, vx: 6.5, color: 0x7ad4ff }), exText: 'EX: both sides' }),
      special({ name: 'Bulwark Stance', input: 'hcb', buttons: ['MP'], anim: 'counter', startup: 6, recovery: 24, damage: 0,
        hitbox: null, counter: { window: 20, damage: 1100, hitstun: 32, stunType: 'crumple', armorFollow: true }, exText: 'EX: reflects and staggers' }),
    ],
    supers: [
      superArt({ name: 'SIEGE BREAKER', art: 'SPECIAL ART I', meter: 1, anim: 'rush', hits: 3, damage: 1950, startup: 11,
        hitbox: { bone: 'handA', offset: [0, 0, 0.2], size: [0.9, 0.9, 0.9], reach: 1.2 }, motion: { type: 'lunge', speed: 13, frames: 18 },
        color: 0x7ad4ff, desc: 'Armoured battering-ram charge.' }),
      superArt({ name: 'CATAPULT CRASH', art: 'SUPER ART II', meter: 2, anim: 'dive', hits: 2, damage: 3100, startup: 12,
        hitbox: { bone: 'footB', offset: [0, 0, 0.1], size: [1.2, 1.1, 1.2], reach: 1.2 }, motion: { type: 'leap', speed: 13, frames: 26 },
        knockdown: 'hard', color: 0xffc93c, desc: 'Leaps and crashes down like a falling fortress.' }),
      superArt({ name: 'LAST BULWARK', art: 'CRITICAL ART III', meter: 3, anim: 'kickstorm', hits: 6, damage: 4500, startup: 12,
        hitbox: { bone: 'footA', offset: [0, 0.2, 0.1], size: [1.6, 1.5, 1.6], reach: 1.5 }, motion: { type: 'lunge', speed: 8, frames: 34 },
        color: 0xff2d3d, desc: 'The wall advances. Nothing survives it.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Rampart Slam', kind: 'throw', damage: 1450, anim: 'forward', dir: 1 },
      { name: 'Gate Crush', kind: 'throw', damage: 1450, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0x7ad4ff,
    counterAnim: 'counter', superFlashColor: 0x7ad4ff,
  },

  // 7. SABLE — assassin, fast teleports
  {
    id: 'sable', name: 'SABLE', title: 'MIDNIGHT WHISPER', style: 'Shadow Assassin',
    archetype: 'rushdown', difficulty: 'HARD', flag: 'ESP',
    desc: 'A phantom blade who dissolves into smoke. Low health, but the fastest walk speed and brutal mix-ups off her teleports.',
    stats: { power: 3, speed: 5, range: 3, defense: 1 },
    body: { height: 0.97, bulk: 0.88, gender: 'f' },
    colors: { skin: 0x8d6a58, outfit: 0x1b1b26, outfit2: 0x2c2c3f, trim: 0x6a2a4a, accent: 0xff4b6e, hair: 0x121016, dark: 0x0e0e14, eye: 0xd04a6a },
    gear: { head: 'hood', belt: true, buckle: false, wraps: true, gloves: true, boots: 'short', cape: true, legBands: true },
    walkSpeed: 1.2, walkBack: 1.0, dashSpeed: 1.3, jumpVel: 1.08, weight: 0.84,
    normals: { kind: 'standard', dmg: [280, 500, 780], reach: [0.73, 0.88, 1.07], speed: 1.2 },
    specials: [
      special({ name: 'Smoke Slash', input: 'qcb', buttons: ['MP'], anim: 'slash', startup: 12, recovery: 20, damage: 700,
        hitbox: { bone: 'handA', offset: [0, 0.05, 0.2], size: [0.9, 0.7, 0.6], reach: 0.9 }, motion: { type: 'lunge', speed: 8, frames: 8 },
        knockdown: 'soft', exText: 'EX: strikes behind' }),
      special({ name: 'Phantom Rise', input: 'dp', buttons: ['LK'], anim: 'uppercut', startup: 5, active: 9, recovery: 26, damage: 820,
        hitbox: { bone: 'footA', offset: [0, 0.2, 0.05], size: [0.55, 1.3, 0.55], reach: 0.55 }, knockdown: 'hard', launcher: 12,
        motion: { type: 'rise', speed: 9.5, frames: 10 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Shadow Step', input: 'qcf', buttons: ['LK'], anim: 'teleport', startup: 6, recovery: 12, damage: 0,
        hitbox: null, motion: { type: 'teleport', speed: 3.4, frames: 6 }, invuln: 8, exText: 'EX: attacks on arrival' }),
      special({ name: 'Throat Fang', input: 'hcb', buttons: ['HP'], anim: 'grab', startup: 8, active: 3, recovery: 32, damage: 1250,
        hitbox: { bone: 'handA', offset: [0, 0, 0.12], size: [0.5, 0.55, 0.45], reach: 0.55 }, motion: { type: 'none' },
        commandGrab: true, grabRange: 0.85, grabWhiff: true, exText: 'EX: longer range', level: 'unblockable' }),
    ],
    supers: [
      superArt({ name: 'THOUSAND CUTS', art: 'SPECIAL ART I', meter: 1, anim: 'slash', hits: 6, damage: 1850, startup: 9,
        hitbox: { bone: 'handA', offset: [0, 0.1, 0.2], size: [1.0, 0.9, 1.1], reach: 1.2 }, motion: { type: 'lunge', speed: 15, frames: 16 },
        color: 0xff4b6e, desc: 'Six invisible slashes that appear all at once.' }),
      superArt({ name: 'ECLIPSE', art: 'SUPER ART II', meter: 2, anim: 'orb', hits: 1, damage: 3000, startup: 13,
        hitbox: null, proj: proj({ damage: 3000, vx: 3.4, color: 0xff4b6e, radius: 0.95, pierce: true, hits: 2, big: true }),
        color: 0xffc93c, desc: 'A creeping sphere of devouring shadow.' }),
      superArt({ name: 'WIDOW\'S KISS', art: 'CRITICAL ART III', meter: 3, anim: 'flurry', hits: 14, damage: 4250, startup: 8,
        hitbox: { bone: 'handA', offset: [0, 0.1, 0.2], size: [1.0, 0.9, 1.0], reach: 1.1 }, motion: { type: 'lunge', speed: 18, frames: 24 },
        color: 0xff2d3d, desc: 'Fourteen strikes. One breath.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Silent Drop', kind: 'throw', damage: 1200, anim: 'forward', dir: 1 },
      { name: 'Veil Pull', kind: 'throw', damage: 1200, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0xff4b6e,
    counterAnim: 'counter', superFlashColor: 0xff4b6e,
  },

  // 8. TITAN — cyber giant, projectiles + command grab
  {
    id: 'titan', name: 'TITAN', title: 'STEEL REBORN', style: 'Cybernetic Colossus',
    archetype: 'grappler', difficulty: 'NORMAL', flag: 'USA',
    desc: 'A construction frame piloted by a ghost. Plasma servos and a massive grab that vacuums opponents in from range.',
    stats: { power: 5, speed: 1, range: 4, defense: 5 },
    body: { height: 1.12, bulk: 1.3, gender: 'm' },
    colors: { skin: 0x9a8578, outfit: 0x2a3450, outfit2: 0x3c4a70, trim: 0x8fa8c8, accent: 0x35e5a0, glow: 0x35ffb0, hair: 0x2a2a2a, dark: 0x161a24, eye: 0x35e5a0 },
    gear: { head: 'spikes', belt: true, buckle: true, wraps: false, gloves: true, boots: 'tall', armorChest: true, shoulderPads: true, cyberArm: true, backVents: true, chestMark: true },
    walkSpeed: 0.8, walkBack: 0.7, dashSpeed: 0.8, jumpVel: 0.88, weight: 1.35,
    normals: { kind: 'standard', dmg: [370, 640, 1020], reach: [0.78, 0.96, 1.12], speed: 0.84 },
    specials: [
      special({ name: 'Plasma Bolt', input: 'qcf', buttons: ['MP'], anim: 'projectile', startup: 16, recovery: 22, damage: 700,
        hitbox: null, proj: proj({ damage: 700, vx: 6.4, color: 0x35ffb0, radius: 0.32 }), exText: 'EX: double plasma' }),
      special({ name: 'Servo Spike', input: 'dp', buttons: ['HP'], anim: 'uppercut', startup: 7, active: 8, recovery: 30, damage: 1000,
        hitbox: { bone: 'handA', offset: [0, 0.2, 0.05], size: [0.6, 1.5, 0.6], reach: 0.65 }, knockdown: 'hard', launcher: 13,
        motion: { type: 'rise', speed: 9, frames: 11 }, antiAir: true, exText: 'EX: invincible start' }),
      special({ name: 'Magnet Grip', input: 'hcb', buttons: ['HP'], anim: 'grab', startup: 10, active: 3, recovery: 36, damage: 1600,
        hitbox: { bone: 'handA', offset: [0, 0, 0.14], size: [0.6, 0.65, 0.6], reach: 0.7 }, motion: { type: 'none' },
        commandGrab: true, grabRange: 1.15, grabWhiff: true, exText: 'EX: huge range', level: 'unblockable' }),
      special({ name: 'Overclock Dash', input: 'qcb', buttons: ['HK'], anim: 'rush', startup: 14, recovery: 24, damage: 900,
        hitbox: { bone: 'handA', offset: [0, 0.05, 0.2], size: [0.8, 0.8, 0.7], reach: 1.0 }, motion: { type: 'lunge', speed: 10, frames: 14 },
        knockdown: 'hard', armor: true, armorHits: 1, exText: 'EX: 2 armour hits' }),
    ],
    supers: [
      superArt({ name: 'SYSTEM SHOCK', art: 'SPECIAL ART I', meter: 1, anim: 'beam', hits: 1, damage: 1950, startup: 12,
        hitbox: null, beamObj: beam({ damage: 320, activeFor: 30, hitInterval: 8, color: 0x35ffb0, width: 0.6 }),
        color: 0x35ffb0, desc: 'Vents reactor plasma in a straight line.' }),
      superArt({ name: 'MAGNETIC CRUSHER', art: 'SUPER ART II', meter: 2, anim: 'grab', hits: 4, damage: 3150, startup: 9,
        hitbox: { bone: 'handA', offset: [0, 0, 0.14], size: [0.8, 0.8, 0.8], reach: 0.8 }, commandGrab: true, grabRange: 1.6,
        motion: { type: 'none' }, color: 0xffc93c, desc: 'Pulls them in and compresses them to a point.' }),
      superArt({ name: 'ORBITAL DROP', art: 'CRITICAL ART III', meter: 3, anim: 'rising', hits: 2, damage: 4550, startup: 11,
        hitbox: { bone: 'handA', offset: [0, 0.4, 0.1], size: [1.3, 2.0, 1.3], reach: 1.0 }, motion: { type: 'rise', speed: 8.5, frames: 24 },
        color: 0xff2d3d, desc: 'Calls down a kinetic kill-rod on the arena.', cinematicBig: true }),
    ],
    throws: [
      { name: 'Hydraulic Press', kind: 'throw', damage: 1550, anim: 'forward', dir: 1 },
      { name: 'Piston Pile', kind: 'throw', damage: 1550, anim: 'back', dir: -1 },
    ],
    driveImpactAnim: 'rush', driveImpactColor: 0x35ffb0,
    counterAnim: 'counter', superFlashColor: 0x35ffb0,
  },
];

// 9-12 added below via merge to keep file readable
import { EXTRA_CHARACTERS } from './characters_extra.js';
for (const c of EXTRA_CHARACTERS) CHARACTERS.push(c);

for (const c of CHARACTERS) {
  for (const list of [c.specials, c.supers]) {
    for (const sp of list) {
      if (sp.startup === undefined) sp.startup = sp.start ?? 10;
      if (sp.active === undefined) sp.active = 3;
      if (sp.recovery === undefined) sp.recovery = 18;
    }
  }
}

export function characterById(id) { return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0]; }

export function moveNameList(c) {
  const out = [];
  out.push({ section: 'NORMALS' });
  for (const n of c._normals) out.push({ name: n.name, input: n.button, type: n.crouch ? 'LOW' : n.air ? 'AIR' : 'MID', dmg: n.damage, startup: n.start, recovery: n.recovery, cancel: 'Special · Super' });
  out.push({ section: 'THROWS' });
  for (const t of c.throws) out.push({ name: t.name, input: 'LP+LK', type: 'THROW', dmg: t.damage, startup: '—', recovery: '—', cancel: '—' });
  out.push({ section: 'SPECIALS' });
  for (const s of c.specials) out.push({ name: s.name, input: inputLabel(s.input) + '+' + s.buttons[0], type: 'SP', dmg: s.damage || '—', startup: s.startup, recovery: s.recovery, cancel: s.exText ?? '—' });
  out.push({ section: 'SUPER ARTS' });
  for (const s of c.supers) out.push({ name: s.name, input: inputLabel(s.input === 'qcfx2' ? 'qcfx2' : 'qcf') + '+' + (s.meter === 1 ? '2' : '1'), type: 'SA ' + s.meter, dmg: s.damage, startup: s.startup, recovery: s.recovery, cancel: s.desc ?? '' });
  out.push({ section: 'DRIVE SYSTEM' });
  out.push({ name: 'Drive Impact', input: 'HP+HK', type: 'DI', dmg: 1100, startup: 26, recovery: 36, cancel: 'Armour · Wall bounce' });
  out.push({ name: 'Drive Rush', input: '→→ / MP+MK', type: 'DR', dmg: '—', startup: '—', recovery: '—', cancel: 'Combo extension' });
  out.push({ name: 'Drive Parry', input: 'MP+MK (hold)', type: 'DP', dmg: '—', startup: 1, recovery: '—', cancel: 'Perfect parry 2F' });
  out.push({ name: 'Drive Reversal', input: '→+HP+HK', type: 'DR', dmg: 500, startup: 15, recovery: 26, cancel: 'Reverses pressure' });
  return out;
}

export function inputLabel(input) {
  return { qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘', hcf: '←↓↘→', hcb: '→↓↙←', qcfx2: '↓↘→↓↘→', qcbx2: '↓↙←↓↙←', none: '—' }[input] ?? input;
}

// Build normals for every character at load.
import { normalSet } from './moves.js';
for (const c of CHARACTERS) {
  c._normals = normalSet(c.normals);
  c._normalsById = {};
  for (const n of c._normals) c._normalsById[n.button + (n.crouch ? 'C' : n.air ? 'A' : 'S')] = n;
}
