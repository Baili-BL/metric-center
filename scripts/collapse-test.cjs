const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message).slice(0, 200)));
  await page.goto('http://localhost:5173/indicators', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  const out = {};
  out.before = { width: (await page.locator('aside.sidebar').boundingBox())?.width };
  await page.locator('.sb-collapse').click();
  await page.waitForTimeout(600);
  out.collapsed = {
    navCollapsedClass: await page.locator('.app-shell.nav-collapsed').count(),
    width: (await page.locator('aside.sidebar').boundingBox())?.width,
    textHidden: await page.locator('.menu-item .mi-text').first().isHidden(),
  };
  await page.locator('.sb-collapse').click();
  await page.waitForTimeout(600);
  out.expanded = {
    navCollapsedClass: await page.locator('.app-shell.nav-collapsed').count(),
    width: (await page.locator('aside.sidebar').boundingBox())?.width,
  };
  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
