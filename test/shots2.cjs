// Capture gameplay screenshots at key moments to eyeball poses / HUD / effects.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio'],
    defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', (e.stack||e.message).slice(0,200)));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await sleep(1800);
  const shoot = async (name) => { await p.screenshot({ path: `test/shots/${name}.png` }); console.log('shot', name); };

  // menu
  await shoot('s1-title');

  // start a training match
  await p.evaluate(() => {
    window.__app.startMatch({ p1Char: 'rivet', p2Char: 'grizz', stageId: 'neon-docks', mode: 'training', cpuLevel: 2 });
  });
  await sleep(2500);
  await shoot('s2-training-idle');

  // freeze a punch mid-swing and capture
  const poseShot = async (char, moveKey, name) => {
    await p.evaluate((c, mk) => {
      const g = window.__app.game;
      g.cpu.forEach((x) => { if (x) x.enabled = false; });
      g.f1.x = -0.55; g.f2.x = 0.55; g.f1.facing = 1; g.f2.facing = -1;
      g.f1.z = 0.06; g.f2.z = -0.06;
      g.f1.health = 10000; g.f2.health = 10000;
      g.f1.currentMove = null; g.f1.state = 'idle'; g.f1.stun = 0; g.f1.hitstop = 0;
      const mv = g.f1.cfg._normalsById[mk] || g.f1.cfg.specials[0];
      g.f1.startMove(mv, g.f1.cfg._normalsById[mk] ? 'normal' : 'special');
      // advance to the middle of the active window
      for (let i = 0; i < (mv.startup + Math.max(1, mv.active / 2)); i++) {
        g.f1.x = -0.55; g.f2.x = 0.55; g.f1.facing = 1; g.f2.facing = -1;
        g.simulate(1 / 60);
      }
      g.f1.hitstop = 999; g.f2.hitstop = 999;
    }, char, moveKey, name);
    await sleep(500);
    await shoot(name);
    await p.evaluate(() => { const g = window.__app.game; g.f1.hitstop = 0; g.f2.hitstop = 0; });
    await sleep(300);
  };
  await poseShot('rivet', 'HPS', 's3-heavy-punch');
  await poseShot('rivet', 'HKC', 's4-sweep');
  await poseShot('rivet', 'HPA', 's5-air-kick');
  await poseShot('rivet', 'special', 's6-special');

  // super cinematic
  await p.evaluate(() => {
    const g = window.__app.game;
    g.f1.currentMove = null; g.f1.state = 'idle'; g.f1.hitstop = 0; g.f2.hitstop = 0;
    g.f1.superMeter = [3, 0, 0];
    g.f1.x = -1.0; g.f2.x = 0.6; g.f1.facing = 1; g.f2.facing = -1;
    g.f1.startMove(g.f1.cfg.supers[2], 'super');
    for (let i = 0; i < 14; i++) g.simulate(1/60);
  });
  await sleep(700);
  await shoot('s7-super');

  // HUD close-up with low health + combo
  await p.evaluate(() => {
    const g = window.__app.game;
    g.f1.hitstop = 0; g.f2.hitstop = 0;
    g.f1.health = 2600; g.f2.health = 1400;
    g.f2.comboHits = 4; g.f1.comboHits = 0;
    g.f1.drive = 2.4; g.f2.drive = 5.1;
    g.f1.superMeter = [2, 0, 0]; g.f2.superMeter = [3, 0, 0];
    g.hud.update(0.016, g.f1, g.f2, 42, 'training');
  });
  await sleep(600);
  await shoot('s8-hud');

  await b.close(); process.exit(0);
})();
