const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio'],
    defaultViewport: { width: 700, height: 400 } });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', (e.stack||e.message).slice(0,500)));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await sleep(1200);
  const out = await p.evaluate(() => {
    const app = window.__app;
    app.startMatch({ p1Char: 'rivet', p2Char: 'rivet', stageId: 'neon-docks', mode: 'versus', cpuLevel: 0 });
    const g = app.game;
    g.roundState = 'fight'; g.frozen = false;
    g.f1.state = 'idle'; g.f2.state = 'idle';
    g.input.sampleFrame = () => [{ dir: 5, buttons: 0, pressed: 0, released: 0 }, { dir: 5, buttons: 0, pressed: 0, released: 0 }];
    g.cpu.forEach(c => { if (c) c.enabled = false; });
    const f1 = g.f1, f2 = g.f2;
    f1.x = -0.62; f2.x = 0.62; f1.z = 0.15; f2.z = -0.15;
    f1.facing = 1; f2.facing = -1;
    const trace = [];
    const mv = f1.cfg._normalsById['LPS'];
    f1.startMove(mv, 'normal');
    trace.push({ step: 'start', state: f1.state, frame: f1.moveFrame, phase: f1.movePhase, mv: mv.name, startup: mv.startup, active: mv.active });
    for (let i = 0; i < 16; i++) {
      g.simulate(1/60);
      const box = f1.movePhase === 'active' ? g._worldHitbox(f1, mv) : null;
      const hbs = g.hurtboxes(f2);
      let overlap = null;
      if (box) overlap = g._overlaps(box, f2);
      trace.push({ i, st: f1.state, mf: +f1.moveFrame.toFixed(2), ph: f1.movePhase, hitstop: +f1.hitstop.toFixed(2),
        box: box ? [ +box.cx.toFixed(2), +box.cy.toFixed(2), +box.hw.toFixed(2), +box.hh.toFixed(2), +box.hd.toFixed(2) ] : null,
        hurt: hbs.map(h => [+h.x.toFixed(2), +h.y.toFixed(2), +h.hw.toFixed(2), +h.hh.toFixed(2), +h.hd.toFixed(2)]),
        ov: overlap, f2x: +f2.x.toFixed(2), hp2: Math.round(f2.health), frozen: g.frozen });
    }
    // direct applyHit probe
    const hp0 = f2.health;
    f2.state = 'idle'; f2.invuln = 0; f2.hitstop = 0;
    const r = g.applyHit(f1, f2, mv, {});
    return { trace, probe: { r, dmg: Math.round(hp0 - f2.health) } };
  });
  console.log(JSON.stringify(out.trace.slice(0, 14), null, 0).replace(/\},\{/g, '},\n{'));
  console.log('PROBE', JSON.stringify(out.probe));
  await b.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
