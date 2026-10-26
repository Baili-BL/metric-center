const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message).slice(0, 200)));
  await page.goto('http://localhost:5173/docs', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/Users/user/Desktop/metric-center/scripts/shot-docs-tab1.png' });
  await page.locator('.docs-tab', { hasText: '数据采集' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/Users/user/Desktop/metric-center/scripts/shot-docs-tab2.png' });
  const title = await page.locator('.docs-h1').innerText();
  const tabCount = await page.locator('.docs-tab').count();
  console.log(JSON.stringify({ tabCount, titleAfterSwitch: title, errors }));
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
