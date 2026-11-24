const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio','--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage();
  const errs = new Set();
  p.on('console', m => { if (m.type() === 'error') errs.add(m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.add((e.stack || e.message).slice(0, 700)));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Start a versus match programmatically (fast path) then exercise combat via keys
  await p.evaluate(() => {
    const app = window.__app;
    app.startMatch({ p1Char: 'rivet', p2Char: 'grizz', stageId: 'neon-docks', mode: 'versus', cpuLevel: 0 });
  });
  await sleep(600);
  await p.screenshot({ path: 'test/shots/10-intro.png' });
  const s0 = await p.evaluate(() => {
    const g = window.__app.game;
    return { roundState: g.roundState, f1x: g.f1.x, f2x: g.f2.x, frames: g.frame, hud: !document.getElementById('hud').classList.contains('hidden') };
  });
  console.log('STATE0', JSON.stringify(s0));
  await sleep(3000);
  await p.screenshot({ path: 'test/shots/11-fight.png' });
  // Walk forward + attack repeatedly
  for (let i = 0; i < 3; i++) {
    await p.keyboard.down('KeyD'); await sleep(260); await p.keyboard.up('KeyD');
  }
  await p.keyboard.press('KeyU'); await sleep(120);
  await p.keyboard.press('KeyO'); await sleep(120);
  await p.keyboard.press('KeyL'); await sleep(400);
  await p.screenshot({ path: 'test/shots/12-attack.png' });
  const s1 = await p.evaluate(() => {
    const g = window.__app.game;
    const f = g.f1, o = g.f2;
    return { x1: +f.x.toFixed(2), x2: +o.x.toFixed(2), state1: f.state, state2: o.state, hp2: Math.round(o.health), combo: o.comboHits, roundState: g.roundState, frame: g.frame };
  });
  console.log('STATE1', JSON.stringify(s1));
  // special move: qcf + LP (S, D, U)
  await p.keyboard.down('KeyS'); await sleep(60); await p.keyboard.down('KeyD'); await sleep(60); await p.keyboard.up('KeyS'); await sleep(60); await p.keyboard.press('KeyU'); await sleep(300);
  const s2 = await p.evaluate(() => {
    const g = window.__app.game; const f = g.f1;
    return { state: f.state, move: f.currentMove?.name, phase: f.movePhase, projs: g.fx.projectiles.length };
  });
  console.log('SPECIAL', JSON.stringify(s2));
  await p.screenshot({ path: 'test/shots/13-special.png' });
  // let CPU attack us
  await sleep(4000);
  const s3 = await p.evaluate(() => {
    const g = window.__app.game;
    return { hp1: Math.round(g.f1.health), hp2: Math.round(g.f2.health), rs: g.roundState, timer: Math.round(g.roundTimer/60), cpu: g.cpu[1]?.label };
  });
  console.log('STATE3', JSON.stringify(s3));
  await p.screenshot({ path: 'test/shots/14-later.png' });
  console.log('ERRORS:', [...errs].slice(0, 8));
  await b.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
