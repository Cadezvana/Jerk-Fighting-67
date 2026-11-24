// Verifies the production build boots and is playable with the font CDN blocked.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio'],
    defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push((e.stack || e.message).slice(0, 300)));
  p.on('console', m => {
    // A blocked font CDN logs a generic network error with no URL in the text — that is the
    // expected outcome of this test, so ignore bare network-failure messages.
    if (m.type() === 'error' && !/ERR_CONNECTION_CLOSED|ERR_NAME_NOT_RESOLVED|ERR_FAILED|net::ERR_|fonts\.googleapis|fonts\.gstatic/.test(m.text()))
      errs.push('CONSOLE ' + m.text().slice(0, 200));
  });
  // Simulate a preview proxy with NO access to the font CDN at all.
  await p.setRequestInterception(true);
  const t0 = Date.now();
  p.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) return r.abort();
    r.continue();
  });
  const res = await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  // How fast is the title interactive with fonts unreachable?
  await p.waitForFunction(() => !!window.__app, { timeout: 20000 });
  const readyMs = Date.now() - t0;
  await sleep(1200);
  const state = await p.evaluate(() => ({
    hasApp: !!window.__app,
    titleVisible: !document.querySelector('#screen-title')?.classList.contains('hidden'),
    gl: !!window.__app?.renderer?.getContext?.(),
    menuFighters: window.__app?.menuFighters?.length ?? null,
    fontsLoaded: document.fonts.status,
  }));

  // Play a real round: launch a match and land a hit.
  await p.evaluate(() => window.__app.startMatch({ p1Char: 'rivet', p2Char: 'grizz', stageId: 'neon-docks', mode: 'training', cpuLevel: 2 }));
  const fought = await p.evaluate(async () => {
    const g = window.__app.game;
    for (let i = 0; i < 200; i++) { if (g.roundState === 'fight') break; await new Promise(r => setTimeout(r, 100)); }
    if (g.roundState !== 'fight') return { ok: false, rs: g.roundState };
    g.cpu.forEach(c => { if (c) c.enabled = false; });
    g.f1.x = -0.5; g.f2.x = 0.5; g.f1.facing = 1; g.f2.facing = -1; g.f1.z = 0.06; g.f2.z = -0.06;
    const hp0 = g.f2.health;
    g.f1.startMove(g.f1.cfg._normalsById['HPS'], 'normal');
    for (let i = 0; i < 30; i++) { g.f1.x = -0.5; g.f2.x = 0.5; g.f1.facing = 1; g.f2.facing = -1; g.simulate(1 / 60); }
    return { ok: true, rs: g.roundState, damage: Math.round(hp0 - g.f2.health) };
  });

  console.log('HTTP', res.status(), '| interactive in', readyMs, 'ms');
  console.log(JSON.stringify({ ...state, fought }, null, 1));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  const good = state.hasApp && state.titleVisible && state.gl && fought.ok && fought.damage > 0 && errs.length === 0;
  console.log(good ? 'RESULT: PASS — playable with fonts blocked' : 'RESULT: FAIL');
  await b.close(); process.exit(good ? 0 : 1);
})();
