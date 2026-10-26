const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const msgs = [];
  page.on('console', (m) => { if (['error','warning'].includes(m.type())) msgs.push(m.type() + ': ' + m.text().slice(0, 400)); });
  page.on('pageerror', (e) => msgs.push('pageerror: ' + String(e && e.message).slice(0, 400)));
  await page.goto('http://localhost:5173/overview', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  const host = await page.evaluate(() => {
    const el = document.querySelector('.dc-host');
    if (!el) return 'no .dc-host';
    return { h: el.clientHeight, w: el.clientWidth, childCount: el.childElementCount, hasCanvas: !!el.querySelector('canvas') };
  });
  console.log(JSON.stringify({ host, msgs }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
