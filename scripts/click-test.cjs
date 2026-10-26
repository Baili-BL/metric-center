const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e && e.message).slice(0, 300)));
  const out = {};

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  out.step1_tabs = {
    tabCount: await page.locator('.tn-tab').count(),
    texts: await page.locator('.tn-tab').allInnerTexts(),
  };

  // step2: 点击顶栏页签 指标中心
  try {
    await page.locator('.tn-tab', { hasText: '指标中心' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1200);
    out.step2_tabClick = { url: page.url(), sidebar: await page.locator('aside.sidebar').count() };
  } catch (e) { out.step2_tabClick = { error: e.message.slice(0, 200) }; }

  // step3: 回总览，点击 产品与服务
  await page.goto('http://localhost:5173/overview', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  try {
    await page.locator('.tn-link').first().click({ timeout: 5000 });
    await page.waitForTimeout(700);
    out.step3_panel = {
      overlay: await page.locator('.tn-overlay').count(),
      mega: await page.locator('.tn-mega').count(),
      cats: await page.locator('.tn-cat').count(),
      secs: await page.locator('.tn-sec').count(),
      secHome: await page.locator('.tn-sec-home').count(),
      pcards: await page.locator('.tn-pcard').count(),
    };
  } catch (e) { out.step3_panel = { error: e.message.slice(0, 200) }; }

  // step4: 面板打开时点击顶栏页签 指标中心（回归测试遮罩问题）
  try {
    await page.locator('.tn-tab', { hasText: '指标中心' }).first().click({ timeout: 5000, force: true });
    await page.waitForTimeout(1000);
    out.step4_tabWhilePanel = { url: page.url(), panelStill: await page.locator('.tn-mega').count() };
  } catch (e) { out.step4_tabWhilePanel = { error: e.message.slice(0, 200) }; }

  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
