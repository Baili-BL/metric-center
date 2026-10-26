const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const [w, h, name] of [[1920, 1080, 'wide'], [1366, 768, 'mid']]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('http://localhost:5173/overview', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `C:/Users/user/Desktop/metric-center/scripts/shot-overview-${name}.png` });
    const m = await page.evaluate(() => {
      const card = document.querySelector('.page-panel');
      const pg = document.querySelector('.dh-page');
      const stat = document.querySelector('.dh-stat');
      const plat = document.querySelector('.dh-plat-card');
      return {
        cardW: card?.clientWidth, pgW: pg?.clientWidth, pgH: pg?.clientHeight,
        statW: stat?.clientWidth, platW: plat?.clientWidth,
        statGridCols: getComputedStyle(document.querySelector('.dh-stat-grid')).gridTemplateColumns.split(' ').length,
        platGridCols: getComputedStyle(document.querySelector('.dh-plat-grid')).gridTemplateColumns.split(' ').length,
        docScrollW: document.documentElement.scrollWidth,
      };
    });
    console.log(name, JSON.stringify(m));
    await page.close();
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e && e.message); process.exit(1); });
