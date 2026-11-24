const puppeteer = require('puppeteer-core');
(async () => {
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023x/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const b = await puppeteer.launch({ executablePath: '/tmp/chromium', headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--mute-audio'],
    defaultViewport: { width: 700, height: 400 } });
  const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', (e.stack||e.message).slice(0,400)));
  await p.goto('http://127.0.0.1:5173/' + (process.env.PAGE || ''), { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1600));
  console.log(JSON.stringify(await p.evaluate(() => window.__r), null, 1));
  if (process.env.SHOT) await p.screenshot({ path: 'test/shots/' + process.env.SHOT });
  await b.close(); process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
