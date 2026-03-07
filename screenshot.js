const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateScreenshot() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });
  
  const page = await browser.newPage();
  
  // Load the HTML file
  const htmlPath = path.join(__dirname, 'index.html');
  const htmlUrl = `file://${htmlPath}`;
  
  await page.goto(htmlUrl, { waitUntil: 'networkidle0' });
  
  // Wait for fonts and styles
  await page.waitForTimeout(1000);
  
  // Set dark mode for screenshot
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  
  await page.waitForTimeout(500);
  
  // Take screenshot of the whole app
  const screenshotPath = path.join(__dirname, 'screenshot.png');
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    type: 'png',
    quality: 90
  });
  
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
  // Also take screenshot of main interface (viewport)
  const viewportPath = path.join(__dirname, 'screenshot-viewport.png');
  await page.screenshot({
    path: viewportPath,
    type: 'png',
    quality: 90
  });
  
  console.log(`Viewport screenshot saved to: ${viewportPath}`);
  
  await browser.close();
  
  // Check file sizes
  const stats = fs.statSync(screenshotPath);
  console.log(`Full screenshot size: ${Math.round(stats.size / 1024)} KB`);
  
  return { screenshotPath, viewportPath };
}

// Run if called directly
if (require.main === module) {
  generateScreenshot().catch(err => {
    console.error('Error generating screenshot:', err);
    process.exit(1);
  });
}

module.exports = generateScreenshot;