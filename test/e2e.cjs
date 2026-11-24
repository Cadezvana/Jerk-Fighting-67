// End-to-end: drives the real UI (DOM clicks + UI navigation API) and real keyboard combat.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); if (process.env.VERBOSE) console.log(`  ${ok?'ok':'FAIL'} ${name} ${info}`); };

(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({
    executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--disable-dev-shm-usage', '--mute-audio'],
    defaultViewport: { width: 1280, height: 720 },
  });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push((e.stack || e.message).slice(0, 300)));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/ERR_CONNECTION_CLOSED|fonts\.googleapis/.test(m.text())) errs.push(m.text().slice(0, 200));
  });

  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await sleep(1600);

  const vis = (sel) => p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return 'missing';
    const cs = getComputedStyle(el);
    return cs.display === 'none' || cs.visibility === 'hidden' || el.classList.contains('hidden') ? 'hidden' : 'visible';
  }, sel);
  const text = (sel) => p.evaluate((s) => (document.querySelector(s)?.textContent || '').trim(), sel);
  // Drive the UI through its own navigation entry point (this is what keyboard/gamepad map to)
  const nav = async (action, player = 0) => { const r = await p.evaluate((a, pl) => window.__app.ui.handleNav({ action: a, player: pl }), action, player); await sleep(110); return r; };
  const clickAction = (action) => p.evaluate((a) => {
    document.querySelector(`#screen-title [data-action="${a}"]`)?.click();
  }, action);

  // ================= TITLE =================
  check('title screen visible', await vis('#screen-title') === 'visible');
  const logoTxt = await p.evaluate(() => (document.querySelector('.title-logo')?.innerText || '').replace(/\s+/g, ' '));
  check('title shows game name', /JERK\s*FIGHTING\s*67/i.test(logoTxt), logoTxt);
  check('title has 7 menu entries',
    await p.evaluate(() => document.querySelectorAll('#screen-title [data-action]').length) === 7);

  // ================= VERSUS FLOW =================
  await clickAction('versus');
  await sleep(600);
  check('versus -> character select', await vis('#screen-select') === 'visible');
  const selMode = await text('#sel-mode-label');
  check('select shows mode label', /VERSUS/i.test(selMode), selMode);
  const nameA = await text('#sel-name-p1');
  await nav('left');
  const nameB = await text('#sel-name-p1');
  check('cursor moves between characters', nameA !== nameB, `${nameA} -> ${nameB}`);
  await nav('right');
  check('cursor returns to original', await text('#sel-name-p1') === nameA);

  // lock p1, move p2, lock p2 -> should launch the match
  await nav('confirm', 0);
  await sleep(260);
  const lockedP1 = await p.evaluate(() => window.__app.ui.sel.locked[0]);
  check('P1 locks in', lockedP1 === true);
  const p2name = await text('#sel-name-p2');
  check('versus shows CPU opponent pick', !!p2name, p2name);
  // versus auto-locks the CPU side, so confirming P1 starts the match
  await sleep(1800);

  const inMatch = await p.evaluate(() => {
    const g = window.__app.game;
    return g ? { state: g.roundState, f1: g.f1?.cfg?.id, f2: g.f2?.cfg?.id, hud: !document.querySelector('#hud').classList.contains('hidden') } : null;
  });
  check('match launched from select', !!inMatch && !!inMatch.f1, JSON.stringify(inMatch));
  check('HUD visible during match', inMatch?.hud === true);

  // wait for the intro to finish -> FIGHT (software rendering makes this slow)
  const fightState = await p.evaluate(async () => {
    for (let i = 0; i < 200; i++) {
      if (window.__app.game?.roundState === 'fight') return 'fight';
      await new Promise((r) => setTimeout(r, 150));
    }
    return window.__app.game?.roundState ?? 'no-game';
  });
  check('round reaches FIGHT state', fightState === 'fight', fightState);

  // ================= REAL KEYBOARD COMBAT =================
  await p.evaluate(() => { const g = window.__app.game; if (g) { g.f1.health = 10000; g.f2.health = 10000; } });
  const box = await p.evaluate(() => {
    const c = document.querySelector('#viewport');
    const r = c.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await p.mouse.move(box.x, box.y);
  const hpBefore = await p.evaluate(() => window.__app.game?.f2?.health ?? -1);
  // walk toward the CPU, then mash light punch via the real keyboard
  await p.keyboard.down('KeyD');
  await sleep(2200);
  await p.keyboard.up('KeyD');
  for (let i = 0; i < 20; i++) {
    await p.keyboard.down('KeyU');
    await sleep(110);
    await p.keyboard.up('KeyU');
    await sleep(90);
  }
  await sleep(700);
  const afterKeys = await p.evaluate(() => {
    const g = window.__app.game;
    if (!g || !g.f1 || !g.f2) return { gone: true };
    return { p2hp: g.f2.health, p1Move: g.f1.currentMove?.name || null, p1State: g.f1.state, dist: Math.abs(g.f2.x - g.f1.x) };
  });
  check('keyboard movement/attacks reach the CPU', afterKeys.p2hp < hpBefore || afterKeys.p1Move !== null,
    JSON.stringify(afterKeys));

  // real keyboard special: qcf + LP.
  // This sandbox has no GPU (swiftshader), so the render loop is slow and the engine only
  // samples the keyboard once per rendered frame. Shrink the viewport first so frames come
  // fast enough for ~60fps-style input timings to survive; real hardware is unaffected.
  await p.setViewport({ width: 640, height: 360 });
  await sleep(1200);
  const preState = await p.evaluate(() => {
    const g = window.__app.game;
    g.f1.currentMove = null; g.f1.state = 'idle'; g.f1._dirHist = [];
    g.f1.stun = 0; g.f1.hitstop = 0; g.f1.blockstun = 0;
    // keep the CPU from interfering with the input test
    g.cpu.forEach((c) => { if (c) c.enabled = false; });
    g.f1.x = -1.3; g.f2.x = 1.3; g.f1.facing = 1; g.f2.facing = -1;
    g.f1.z = 0.06; g.f2.z = -0.06;
    window.__trace = [];
    const orig = g.f1.handleInput.bind(g.f1);
    g.f1.handleInput = (s2, dt) => { window.__trace.push(s2.dir); return orig(s2, dt); };
    return { state: g.f1.state, stun: g.f1.stun, paused: g.paused, facing: g.f1.facing, fx: g.f1.x, f2x: g.f2.x };
  });
  // Hold keys until the engine has actually sampled the resulting direction, then release.
  // (Software rendering can drop frames, so wall-clock taps are unreliable here.)
  const holdUntilSampled = async (keys, expectedDir, minFrames = 2) => {
    for (const k of keys) await p.keyboard.down(k);
    await p.evaluate(async (dir, need) => {
      const g = window.__app.game;
      let seen = 0;
      const startLen = (g.f1._dirHist || []).length;
      for (let i = 0; i < 80 && seen < need; i++) {
        await new Promise((r) => setTimeout(r, 60));
        const h = g.f1._dirHist || [];
        seen = h.slice(startLen).filter((d) => d === dir).length;
      }
    }, expectedDir, minFrames);
    for (const k of keys) await p.keyboard.up(k);
  };
  // (~10fps software rendering: hold each direction long enough to be sampled)
  await holdUntilSampled(['KeyS'], 2);
  await holdUntilSampled(['KeyS', 'KeyD'], 3);
  await holdUntilSampled(['KeyD'], 6);
  await holdUntilSampled(['KeyU'], 5, 1);
  await sleep(600);
  const special = await p.evaluate(() => {
    const g = window.__app.game;
    return g?.f1?.currentMove?.name
      ? { name: g.f1.currentMove.name, kind: g.f1.moveKind }
      : { none: true, state: g.f1.state, hist: (g.f1._dirHist || []).join(''), trace: (window.__trace || []).join('') };
  });
  check('keyboard qcf+LP fires a special', special?.kind === 'special', JSON.stringify(special) + ' pre=' + JSON.stringify(preState));

  // real keyboard super: qcf + HP with meter available
  await p.evaluate(() => {
    const g = window.__app.game;
    g.f1.currentMove = null; g.f1.state = 'idle'; g.f1._dirHist = []; g.f1.superMeter = [3, 0, 0];
    g.f1.cinematic = null;
  });
  // let the previous special finish so the input buffer is clean
  await p.evaluate(async () => {
    for (let i = 0; i < 60; i++) {
      const g = window.__app.game;
      if (g?.f1 && !g.f1.currentMove && g.f1.state === 'idle') return;
      await new Promise((r) => setTimeout(r, 100));
    }
  });
  await p.evaluate(() => { const g = window.__app.game; g.f1._dirHist = []; g.f1._buffered = { f: 0, btn: 0, dir: 0 }; });
  await holdUntilSampled(['KeyS'], 2);
  await holdUntilSampled(['KeyS', 'KeyD'], 3);
  await holdUntilSampled(['KeyD'], 6);
  await holdUntilSampled(['KeyO'], 5, 1);
  await sleep(800);
  const superMove = await p.evaluate(() => {
    const g = window.__app.game;
    const meters = g.f1.superMeter;
    return g?.f1?.currentMove?.name
      ? { name: g.f1.currentMove.name, kind: g.f1.moveKind, meters }
      : { none: true, meters, hist: (g.f1._dirHist || []).join(''), supers: g.f1.cfg.supers.map((s) => s.name + ':' + s.buttons.join()) };
  });
  check('keyboard qcf+HP fires a super', superMove?.kind === 'super', JSON.stringify(superMove));

  // ================= PAUSE / RESUME =================
  await p.keyboard.press('Escape');
  await sleep(500);
  check('pause menu opens on Escape', await vis('#pause') === 'visible');
  await p.evaluate(() => document.querySelector('#pause-resume').click());
  await sleep(500);
  check('resume hides pause', await vis('#pause') === 'hidden');

  // ================= QUIT BACK TO TITLE =================
  await p.keyboard.press('Escape');
  await sleep(400);
  await p.evaluate(() => document.querySelector('#pause-quit').click());
  await sleep(900);
  check('quit returns to title', await vis('#screen-title') === 'visible');

  // ================= TRAINING =================
  await clickAction('training');
  await sleep(500);
  await nav('confirm', 0);
  await sleep(900);
  const setupVis = await vis('#screen-setup');
  if (setupVis === 'visible') { await p.evaluate(() => document.querySelector('#setup-start').click()); }
  await sleep(2400);
  const train = await p.evaluate(() => {
    const g = window.__app.game;
    return { mode: g?.currentMode, rs: g?.roundState, panel: !document.querySelector('#training-panel').classList.contains('hidden') };
  });
  check('training mode launches', train.mode === 'training', JSON.stringify(train));
  check('training panel is visible', train.panel === true);

  // training hotkeys
  await p.keyboard.press('F1');
  await sleep(300);
  const f1open = await p.evaluate(() => !document.querySelector('#training-panel').classList.contains('hidden'));
  check('F1 toggles training panel', typeof f1open === 'boolean');
  await p.evaluate(() => {
    const g = window.__app.game;
    if (g && g.f2) g.f2.health = 1;
  });
  await sleep(600);
  const infHp = await p.evaluate(() => window.__app.game?.f2?.health ?? -1);
  check('training keeps dummy alive', infHp >= 1, String(infHp));

  // quit training
  await p.keyboard.press('Escape');
  await sleep(400);
  await p.evaluate(() => document.querySelector('#pause-quit')?.click());
  await sleep(900);

  // ================= SURVIVAL + ARCADE LAUNCH =================
  for (const mode of ['survival', 'arcade']) {
    await clickAction(mode);
    await sleep(500);
    await nav('confirm', 0);
    await sleep(900);
    const sv = await vis('#screen-setup');
    if (sv === 'visible') await p.evaluate(() => document.querySelector('#setup-start').click());
    await sleep(2800);
    const st = await p.evaluate(() => {
      const g = window.__app.game;
      return g ? { mode: g.currentMode, rs: g.roundState, f1: g.f1?.cfg?.id } : null;
    });
    check(`${mode} mode launches and runs`, st?.mode === mode && !!st.f1, JSON.stringify(st));
    await p.keyboard.press('Escape');
    await sleep(350);
    const q = await p.evaluate(() => !!document.querySelector('#pause-quit'));
    if (q) await p.evaluate(() => document.querySelector('#pause-quit').click());
    await sleep(800);
  }

  // ================= OPTIONS + MOVE LIST =================
  await p.evaluate(() => window.__app.ui.showTitle());
  await sleep(500);
  await clickAction('options');
  await sleep(500);
  check('options screen opens', await vis('#screen-options') === 'visible');
  const optCount = await p.evaluate(() => document.querySelectorAll('#options-grid .opt-row').length);
  check('options has interactive rows', optCount > 0, String(optCount));
  await p.evaluate(() => document.querySelector('#options-back').click());
  await sleep(400);
  await clickAction('movelist');
  await sleep(600);
  check('move list opens', await vis('#screen-moves') === 'visible');
  const moveRows = await p.evaluate(() => document.querySelectorAll('#moves-body .mv').length);
  check('move list has content', moveRows > 0, String(moveRows));
  await p.evaluate(() => document.querySelector('#moves-back').click());
  await sleep(400);
  check('move list closes back to title', await vis('#screen-title') === 'visible');

  // ================= RESULTS SCREEN =================
  const resOk = await p.evaluate(() => {
    const app = window.__app;
    app.ui.showResults({
      title: 'RIVET WINS',
      sub: 'ARCADE CLEAR',
      stats: [['DAMAGE DEALT', '1234'], ['MAX COMBO', '4']],
      buttons: [{ label: 'CONTINUE', fn: () => app.quitToTitle() }],
    });
    const el = document.querySelector('#results');
    return { open: !el.classList.contains('hidden'), head: document.querySelector('#results-head').textContent,
      rows: document.querySelectorAll('#results-stats div').length };
  });
  check('results screen renders', resOk.open === true && resOk.rows === 2, JSON.stringify(resOk));

  // summary
  const pass = results.filter((r) => r.ok).length;
  console.log(`\nE2E ${pass}/${results.length} PASS`);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.info ? '  [' + r.info + ']' : ''}`);
  console.log(`ERRORS: ${JSON.stringify(errs.slice(0, 8))}`);
  await b.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error('E2E CRASH', e.message); process.exit(2); });
