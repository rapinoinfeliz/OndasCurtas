const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + __dirname + '/site/index.html');
  // Espera carregar
  await page.waitForTimeout(2000);
  // clica no primeiro listen-btn que não está hidden
  await page.evaluate(() => {
    const btn = document.querySelector('.listen-btn:not([hidden])');
    if(btn) btn.click();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'modal_test.png' });
  await browser.close();
})();
