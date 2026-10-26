const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message).slice(0, 200)));
  await page.goto('http://localhost:5173/docs', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/user/Desktop/metric-center/scripts/shot-docs.png' });
  console.log(JSON.stringify({ url: page.url(), errors, codeBlocks: await page.locator('.docs-code').count() }));
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
