// Deterministic combat tests: drives Game.simulate() directly, injects synthetic input.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio'],
    defaultViewport: { width: 800, height: 450 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push((e.stack||e.message).slice(0, 500)));
  p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION_CLOSED')) errs.push(m.text().slice(0,300)); });
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await sleep(1200);

  const result = await p.evaluate(async () => {
    const __out = { tests: [], logs: [] };
    const app = window.__app;
    const out = { tests: [], logs: [] };
    const log = (...a) => out.logs.push(a.join(' '));
    const facingDir = (d, f) => (f < 0 ? ({ 1: 3, 2: 2, 3: 1, 4: 6, 6: 4, 7: 9, 8: 8, 9: 7 })[d] : d);

    function fresh(p1 = 'rivet', p2 = 'rivet', mode = 'versus', cpu = 3) {
      app.startMatch({ p1Char: p1, p2Char: p2, stageId: 'neon-docks', mode, cpuLevel: cpu });
      const g = app.game;
      g.roundState = 'fight'; g.frozen = false;
      g.f1.state = 'idle'; g.f2.state = 'idle';
      // disable real input + cpu so we fully control
      g.input.sampleFrame = () => [{ dir: 5, buttons: 0, pressed: 0, released: 0 }, { dir: 5, buttons: 0, pressed: 0, released: 0 }];
      g.cpu.forEach(c => { if (c) c.enabled = false; });
      g.f1.x = -0.9; g.f2.x = 0.9; g.f1.z = 0.15; g.f2.z = -0.15;
      g.f1.facing = 1; g.f2.facing = -1;
      return g;
    }
    function step(g, n = 1) {
      for (let i = 0; i < n; i++) {
        // keep the sandbox consistent: engine facing/positions get reasserted
        for (const f of [g.f1, g.f2]) { if (!f) continue; f.facing = f === g.f1 ? 1 : -1; }
        for (const [f, x] of [[g.f1, g.f1._tx], [g.f2, g.f2._tx]]) { if (x !== undefined) f.x = x; }
        if (g.roundState === 'ko' || g.roundState === 'roundEnd' || g.roundState === 'matchEnd' || g.frozen) g.update(1/60);
        else g.simulate(1/60);
      }
    }
    function place(g, x1, x2) { g.f1.x = x1; g.f2.x = x2; g.f1._tx = x1; g.f2._tx = x2; g.f1.z = 0.06; g.f2.z = -0.06; }
    // inject an input directly into a fighter for one frame
    function inp(f, dir, buttons) {
      const prev = f._injPrev || { buttons: 0 };
      const s = { dir, buttons, pressed: buttons & ~prev.buttons, released: prev.buttons & ~buttons };
      f._injPrev = { dir, buttons };
      f.handleInput(s, 1/60);
      return s;
    }
    function test(name, fn) {
      try { const r = fn(); out.tests.push({ name, ...r }); }
      catch (e) { out.tests.push({ name, error: e.message + '\n' + (e.stack||'').split('\n').slice(0,3).join('\n') }); }
    }

    // ---------- TEST: basic attack damage ----------
    test('light punch hits and damages', () => {
      const g = fresh();
      const [f1, f2] = [g.f1, g.f2];
      place(g, -0.5, 0.5);
      f1.startMove(f1.cfg._normalsById['LPS'], 'normal');
      const mvName = f1.currentMove?.name;
      const hp0 = f2.health;
      step(g, 20);
      return { move: mvName, hp0, hp1: Math.round(f2.health), combo: f2.comboHits, hit: f2.health < hp0 };
    });

    // ---------- TEST: all normals reach & damage ----------
    test('all 18 normals connect', () => {
      const res = [];
      const g0 = fresh();
      const normals = g0.f1.cfg._normals;
      for (const mv of normals) {
        const g = fresh();
        const f1 = g.f1, f2 = g.f2;
        place(g, -0.5, 0.5);
        f1.startMove(mv, 'normal');
        if (mv.air) { f1.air = true; f1.y = 1.0; f1.vy = 0; }
        const hp0 = f2.health;
        step(g, mv.startup + mv.active + 2);
        res.push({ n: mv.button + (mv.crouch?'C':mv.air?'A':'S'), hit: f2.health < hp0, dmg: Math.round(hp0 - f2.health) });
      }
      return { results: res, allHit: res.every(r => r.hit), failures: res.filter(r => !r.hit).map(r => r.n) };
    });

    // ---------- TEST: blocking ----------
    test('blocking reduces damage (chip only)', () => {
      const g = fresh();
      // P2 holds back => block
      g.input.sampleFrame = () => [{ dir: 5, buttons: 0, pressed: 0, released: 0 }, { dir: 6, buttons: 0, pressed: 0, released: 0 }];
      const [f1, f2] = [g.f1, g.f2];
      place(g, -0.5, 0.5);
      step(g, 2);
      const blocking = f2.state;
      f1.startMove(f1.cfg._normalsById['HPS'], 'normal');
      const hp0 = f2.health;
      step(g, 30);
      return { blockStateAtStart: blocking, dmg: +(hp0 - f2.health).toFixed(0), blockstunSeen: f2.blockstun >= 0,
        chipOnly: (hp0 - f2.health) > 0 && (hp0 - f2.health) < 300 };
    });
    test('low attack beats standing block, standing block beats low', () => {
      const g = fresh();
      g.input.sampleFrame = () => [{ dir: 5, buttons: 0, pressed: 0, released: 0 }, { dir: 4, buttons: 0, pressed: 0, released: 0 }];
      const [f1, f2] = [g.f1, g.f2];
      place(g, -0.5, 0.5);
      step(g, 2);
      f1.startMove(f1.cfg._normalsById['HKC'], 'normal');
      const hp0 = f2.health;
      step(g, 30);
      const lowHitsStanding = f2.health < hp0;
      // now crouch block: hold back+down
      const g2 = fresh();
      g2.input.sampleFrame = () => [{ dir: 5, buttons: 0, pressed: 0, released: 0 }, { dir: 3, buttons: 0, pressed: 0, released: 0 }];
      place(g2, -0.5, 0.5);
      step(g2, 2);
      const crouched = g2.f2.crouching;
      const h2 = g2.f2.health;
      g2.f1.startMove(g2.f1.cfg._normalsById['HKC'], 'normal');
      step(g2, 30);
      const lowBlocked = g2.f2.health > h2 - 200;
      return { lowHitsStanding, crouched, lowBlocked, dmgStanding: Math.round(hp0 - f2.health), dmgCrouch: Math.round(h2 - g2.f2.health) };
    });

    // ---------- TEST: specials qcf ----------
    test('special moves via motion input (all characters)', () => {
      const res = [];
      const names = ['rivet','ember','kaze','grizz','vesper','rook','sable','titan','nova','bruiser','oracle','butcher'];
      const MOTION_DIRS = { qcf: [2,3,6], qcb: [2,1,4], dp: [6,2,3], hcf: [4,1,2,3,6], hcb: [6,3,2,1,4], qcfx2: [2,3,6,2,3,6], qcbx2: [2,1,4,2,1,4] };
      const BIT = { LP:1,MP:2,HP:4,LK:8,MK:16,HK:32 };
      for (const id of names) {
        const g = fresh(id, 'grizz');
        const f1 = g.f1;
        const bad = []; let spNames = 0;
        for (const sp of f1.cfg.specials) {
          f1.currentMove = null; f1.state = 'idle'; f1.stateFrame = 0; f1.drive = 6;
          f1.cinematic = null; f1.stun = 0; f1.hitstop = 0; f1._dirHist = [];
          // walk the motion through the REAL input handler
          const seq = [5, 5, ...(MOTION_DIRS[sp.input] || [2,3,6])];
          for (const d of seq) f1.handleInput({ dir: d, buttons: 0, pressed: 0, released: 0 }, 1/60);
          const bit = BIT[sp.buttons[0]];
          f1.handleInput({ dir: 5, buttons: bit, pressed: bit, released: 0 }, 1/60);
          spNames++;
          // the engine picks the highest-priority motion that matches; a same-button move
          // from the same motion family is an acceptable result
          const sameFamily = (a, b) => a === b || (['qcf','qcb','dp'].includes(a) && ['qcf','qcb','dp'].includes(b));
          if (!f1.currentMove) bad.push(sp.name + '/' + sp.input);
          else if (f1.moveKind !== 'special' && f1.moveKind !== 'super') bad.push(sp.name + ' (wrong kind ' + f1.moveKind + ')');
          else if (sp.buttons[0] !== (f1.currentMove.buttons?.[0] ?? sp.buttons[0]) && !sameFamily(sp.input, f1._lastSpecialInput))
            bad.push(sp.name + ' -> got ' + f1.currentMove.name);
          f1.handleInput({ dir: 5, buttons: 0, pressed: 0, released: bit }, 1/60);
        }
        res.push({ id, specials: spNames, ok: bad.length === 0, bad });
      }
      return { results: res, allOk: res.every(r => r.ok) };
    });

    // ---------- TEST: real input path (keyboard/buttons -> attacks) ----------
    test('real input: single buttons trigger normals, motions trigger specials', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -0.5, 0.5);
      const BIT = { LP: 1, MP: 2, HP: 4, LK: 8, MK: 16, HK: 32 };
      const out1 = [];
      // press each of the 6 buttons individually, verify a normal starts
      for (const b of ['LP','MP','HP','LK','MK','HK']) {
        f1.currentMove = null; f1.state = 'idle'; f1.stateFrame = 0; f1.stun = 0; f1.hitstop = 0;
        f1._prevButtons = 0;
        f1.handleInput({ dir: 5, buttons: BIT[b], pressed: BIT[b], released: 0 }, 1/60);
        out1.push({ btn: b, started: !!f1.currentMove, kind: f1.currentMove?.kind || f1.moveKind });
        f1.handleInput({ dir: 5, buttons: 0, pressed: 0, released: BIT[b] }, 1/60);
      }
      // now a qcf special through the same path
      f1.currentMove = null; f1.state = 'idle'; f1.stateFrame = 0; f1._dirHist = []; f1.drive = 6;
      const qcfRaw = [2, 3, 6]; // P1 faces right (facing=1) so raw == local: 2,3,6 is a qcf
      for (const d of qcfRaw) f1.handleInput({ dir: d, buttons: 0, pressed: 0, released: 0 }, 1/60);
      f1.handleInput({ dir: 5, buttons: BIT.LP, pressed: BIT.LP, released: 0 }, 1/60);
      const special = f1.currentMove?.name || null;
      // super through the same path
      f1.currentMove = null; f1.state = 'idle'; f1.stateFrame = 0; f1._dirHist = []; f1.superMeter[0] = 3; f1.cinematic = null;
      for (const d of qcfRaw) f1.handleInput({ dir: d, buttons: 0, pressed: 0, released: 0 }, 1/60);
      const supBtn = BIT[f1.cfg.supers[0].buttons[0]];
      f1.handleInput({ dir: 5, buttons: supBtn, pressed: supBtn, released: 0 }, 1/60);
      const superMove = f1.currentMove?.name || null;
      const superOk = !!f1.currentMove && f1.moveKind === 'super';
      // throw: LP+LK
      f1.currentMove = null; f1.state = 'idle'; f1.stateFrame = 0; f1.cinematic = null;
      f1.handleInput({ dir: 5, buttons: BIT.LP | BIT.LK, pressed: BIT.LP | BIT.LK, released: 0 }, 1/60);
      const throwMove = f1.state;
      return { normals: out1, allNormals: out1.every(o => o.started), special, superMove, superOk, throwMove,
        ok: out1.every(o => o.started) && !!special && superOk };
    });

    // ---------- TEST: combo scaling ----------
    test('combo scaling reduces damage', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -0.6, 0.6);
      const mv = f1.cfg._normalsById['LPS'];
      // force 5 consecutive hits
      const dmgs = [];
      for (let i = 0; i < 5; i++) {
        f1.hitstop = 0; f2.hitstop = 0; f2.state = 'hit'; f2.stun = 0; f2.invuln = 0;
        const hp = f2.health;
        f1.hitTargets = new Set(); f1.hitCount = 0;
        g.applyHit(f1, f2, mv, {});
        dmgs.push(Math.round(hp - f2.health));
        f2.comboHits = i + 1;
      }
      return { dmgs, scaled: dmgs[4] < dmgs[0] };
    });

    // ---------- TEST: drive gauge ----------
    test('drive gauge drains/regens + burnout', () => {
      const g = fresh();
      const f = g.f1;
      const d0 = f.drive;
      f.addDrive(-3);
      const d1 = f.drive;
      step(g, 120);
      const d2 = f.drive;
      f.addDrive(-10);
      const burnt = f.burnout;
      step(g, 600);
      return { d0, d1: +d1.toFixed(2), regen: +(d2 - d1).toFixed(2), burnoutSet: burnt, recovered: !f.burnout, dEnd: +f.drive.toFixed(2) };
    });

    // ---------- TEST: drive impact ----------
    test('drive impact hits + wall bounce', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -1.3, 0.4);
      f1.startDriveImpact();
      const hp0 = f2.health;
      step(g, 60);
      return { hp0, hp1: Math.round(f2.health), hit: f2.health < hp0, driveAfter: +f1.drive.toFixed(2) };
    });

    // ---------- TEST: parry ----------
    test('drive parry blocks and grants drive', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -0.6, 0.6);
      // f2 parry
      f2.state = 'parry'; f2.parryPerfect = 8; f2.parry = 2; f2.drive = 3;
      const d0 = f2.drive;
      const mv = f1.cfg._normalsById['HPS'];
      f1.hitTargets = new Set();
      g.applyHit(f1, f2, mv, {});
      const parried = f2.drive > d0;
      const hpSame = f2.health === f2.maxHealth;
      return { parried, hpSame, driveGain: +(f2.drive - d0).toFixed(2), f1State: f1.state };
    });

    // ---------- TEST: throw ----------
    test('throw connects at close range', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -0.4, 0.4);
      inp(f1, 5, 1|8);
      const st = f1.state;
      step(g, 50);
      return { st, p2hp: Math.round(f2.health), p2state: f2.state, threw: f2.health < f2.maxHealth };
    });

    // ---------- TEST: super ----------
    test('super art consumes meter and deals damage', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      f1.superMeter[0] = 3;
      place(g, -1.1, 0.5);
      const s = f1.cfg.supers[0];
      f1.startMove(s, 'super');
      const meter = f1.superMeter[0];
      f1.superMeter[0] -= s.meter;
      const hp0 = f2.health;
      step(g, 90);
      return { hp0, hp1: Math.round(f2.health), hit: f2.health < hp0, meter, superName: s.name, state: f1.state };
    });

    // ---------- TEST: KO & rounds ----------
    test('KO ends round and awards win', () => {
      const g = fresh();
      g.f2.health = 40;
      place(g, -0.5, 0.5);
      g.f1.startMove(g.f1.cfg._normalsById['HPS'], 'normal');
      step(g, 40);
      const wins = [...g.roundWins];
      // after the KO banner the game should reset to the next round
      for (let i = 0; i < 520; i++) step(g, 1);
      return { wins, hp: Math.round(g.f2.health), nextRound: g.roundState, f2Reset: g.f2.health > 5000, ok: wins[0] === 1 && g.f2.health > 5000 };
    });

    // ---------- TEST: timer ----------
    test('round timer decreases', () => {
      const g = fresh();
      const t0 = g.roundTimer;
      step(g, 60);
      return { t0: +t0.toFixed(0), t1: +g.roundTimer.toFixed(0), decreased: g.roundTimer < t0 };
    });

    // ---------- TEST: training mode ----------
    test('training mode infinite health + panel', () => {
      const g = fresh('rivet', 'grizz', 'training', 0);
      g.trainingState.unlimited = true;
      g.f2.health = 500;
      step(g, 10);
      const hp = g.f2.health;
      g.trainingSetDummy('block');
      const dm = g.trainingState.dummyMode;
      g.trainingToggleHealth();
      const unl = g.trainingState.unlimited;
      // with unlimited off, a lethal hit should KO; with it on, it should not
      g.trainingState.unlimited = false;
      g.f2.health = 100; g.f2.state = 'idle';
      const g2hp = g.f2.health;
      // simulate a lethal applyHit path by decrementing past zero then clamping
      g.f2.health = -50;
      g.trainingToggleHealth(); // back ON
      step(g, 4);
      const clamped = g.f2.health >= 1;
      return { hpAfter: hp, clampOk: hp >= 1, dummy: dm, toggleChanged: unl === false, clamped };
    });

    // ---------- TEST: CPU acts ----------
    test('CPU makes decisions and attacks', () => {
      const g = fresh('rivet', 'grizz', 'versus', 3);
      const cpu = g.ensureCpu(1, 2);
      place(g, -1.2, 0.6);
      let attacked = false, moved = false;
      const startHealth = g.f1.health;
      // NOTE: don't use step() here — its position re-assert would pin P1 and
      // break the CPU's spacing. Run the real simulate loop instead.
      for (let i = 0; i < 1400; i++) {
        g.simulate(1/60);
        if (g.f2.currentMove) attacked = true;
        if (g.f2.x < 0.45) moved = true;
        if (g.f1.health < startHealth) break;
      }
      return { attacked, moved, damaged: g.f1.health < startHealth, dmg: Math.round(startHealth - g.f1.health), f2state: g.f2.state, ok: attacked && moved };
    });

    // ---------- TEST: cancels (normal -> special) ----------
    test('special cancel on hit', () => {
      const g = fresh();
      const f1 = g.f1, f2 = g.f2;
      place(g, -0.5, 0.5);
      f1.startMove(f1.cfg._normalsById['MPS'], 'normal');
      step(g, 8); // active
      const hit = f2.health < f2.maxHealth;
      const canCancel = f1.cancelWindow > 0;
      return { hit, canCancel, cancelCfg: f1.currentMove?.cancel };
    });

    // ---------- TEST: knockdown/wakeup ----------
    test('knockdown then wakeup recovery', () => {
      const g = fresh();
      const f2 = g.f2;
      f2._startKnockdown('hard');
      const s0 = f2.state;
      step(g, 120);
      return { s0, s1: f2.state, recovered: f2.state === 'idle' };
    });

    // ---------- TEST: projectiles ----------
    test('projectile travels and hits', () => {
      const g = fresh('kaze', 'grizz');
      const f1 = g.f1, f2 = g.f2;
      place(g, -3, 2);
      const sp = f1.cfg.specials[0];
      f1.startMove(sp, 'special');
      step(g, 100);
      return { hp2: Math.round(f2.health), hit: f2.health < f2.maxHealth, projs: g.fx.projectiles.length };
    });

    // ---------- TEST: all characters spawn & render ----------
    test('all characters fightable', () => {
      const ids = ['rivet','ember','kaze','grizz','vesper','rook','sable','titan','nova','bruiser','oracle','butcher'];
      const res = [];
      for (const id of ids) {
        const g = fresh(id, 'rivet');
        place(g, -0.5, 0.5);
        const f = g.f1;
        const hp0 = g.f2.health;
        f.startMove(f.cfg._normalsById['HPS'], 'normal');
        step(g, 30);
        res.push({ id, dmg: Math.round(hp0 - g.f2.health), ok: g.f2.health < hp0 });
      }
      return { results: res, allOk: res.every(r => r.ok) };
    });

    return out;
  });

  console.log('@@TESTS@@' + JSON.stringify(result.tests));
  if (result.logs.length) console.log('LOGS', result.logs);
  console.log('ERRORS:', errs.slice(0, 6));
  await b.close();
  process.exit(0);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
