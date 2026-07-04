const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  const url = 'file://' + path.resolve('site/index.html');
  console.log('Navigating to', url);
  await page.goto(url);
  
  // Wait a bit
  await page.waitForTimeout(2000);
  
  console.log('Clicking map toggle button...');
  try {
    await page.click('#mapToggleBtn');
    await page.waitForTimeout(1000);
    
    const isHidden = await page.evaluate(() => document.querySelector('#mapSection').hidden);
    console.log('mapSection is hidden:', isHidden);
  } catch (err) {
    console.log('Failed to click button:', err.message);
  }
  
  await browser.close();
})();
