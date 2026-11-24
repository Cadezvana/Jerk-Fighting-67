const puppeteer = require('puppeteer-core');
const steps = JSON.parse(process.env.STEPS || '[]');
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio','--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 } });
  const p = await b.newPage();
  const errs = new Set();
  p.on('console', m => { if (m.type() === 'error') errs.add(m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.add((e.stack || e.message).slice(0, 500)));
  p.on('requestfailed', r => errs.add('REQFAIL ' + r.url().slice(0, 120) + ' ' + r.failure()?.errorText));
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2200));
  for (const s of steps) {
    if (s.wait) await new Promise(r => setTimeout(r, s.wait));
    if (s.key) { await p.keyboard.down(s.key); await new Promise(r=>setTimeout(r, s.hold||60)); await p.keyboard.up(s.key); }
    if (s.press) await p.keyboard.press(s.press);
    if (s.eval) { try { const r = await p.evaluate(s.eval); if (r !== undefined) console.log('EVAL:', JSON.stringify(r).slice(0, 1200)); } catch(e) { console.log('EVAL-ERR', e.message.slice(0,400)); } }
    if (s.shot) await p.screenshot({ path: 'test/shots/' + s.shot });
    if (s.click) await p.click(s.click);
  }
  console.log('ERRORS:', [...errs].slice(0, 10));
  await b.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
