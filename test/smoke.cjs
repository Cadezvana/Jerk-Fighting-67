const puppeteer = require('puppeteer-core');
const path = require('node:path');

const EXE = '/tmp/chromium';
const LIBS = '/tmp/al2023x/lib';
const URL = process.env.GAME_URL || 'http://127.0.0.1:5173/';

async function launch() {
  process.env.LD_LIBRARY_PATH = [LIBS, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return puppeteer.launch({
    executablePath: EXE, headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-zygote', '--in-process-gpu',
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage', '--ignore-gpu-blocklist', '--font-render-hinting=none',
      '--disable-web-security', '--mute-audio', '--window-size=1280,720'],
    defaultViewport: { width: 1280, height: 720 },
  });
}

const errors = [];
async function withPage(fn) {
  const browser = await launch();
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e.stack || e.message)));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  try { await fn(page); } finally { await browser.close(); }
  return errors;
}
module.exports = { launch, withPage, errors, URL, EXE, LIBS };

if (require.main === module) {
  (async () => {
    const errs = await withPage(async (page) => {
      await new Promise((r) => setTimeout(r, 2500));
      const info = await page.evaluate(() => {
        const app = window.__app;
        return {
          hasApp: !!app,
          screen: app?.ui?.screen,
          titleVisible: !document.getElementById('screen-title').classList.contains('hidden'),
          canvas: !!document.querySelector('#viewport'),
          gl: (() => { const c = document.getElementById('viewport'); const g = c.getContext('webgl2'); return !!g; })(),
          menuFighters: app?.menuFighters?.length,
        };
      });
      console.log(JSON.stringify(info, null, 2));
      await page.screenshot({ path: 'test/shots/00-title.png' });
    });
    console.log('ERRORS:', errs.length ? JSON.stringify([...new Set(errs)].slice(0, 12), null, 2) : 'none');
    process.exit(errs.length ? 1 : 0);
  })();
}
