const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

async function captureAppScreenshot() {
  // Create a hidden browser window
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  
  // Load the index.html
  const htmlPath = path.join(__dirname, 'index.html');
  await win.loadFile(htmlPath);
  
  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Enable dark mode
  await win.webContents.executeJavaScript(`
    document.documentElement.classList.add('dark');
  `);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Capture page
  const image = await win.webContents.capturePage();
  const screenshotPath = path.join(__dirname, 'screenshot-electron.png');
  fs.writeFileSync(screenshotPath, image.toPNG());
  
  console.log(`Screenshot saved to: ${screenshotPath}`);
  
  // Also capture viewport (no full page)
  const viewportPath = path.join(__dirname, 'screenshot-viewport-electron.png');
  const viewportImage = await win.webContents.capturePage({
    x: 0,
    y: 0,
    width: 1280,
    height: 800
  });
  fs.writeFileSync(viewportPath, viewportImage.toPNG());
  
  console.log(`Viewport screenshot saved to: ${viewportPath}`);
  
  win.close();
  
  return { screenshotPath, viewportPath };
}

// Run if not in Electron main process
if (!app.isReady) {
  app.whenReady().then(() => {
    captureAppScreenshot().then(() => {
      app.quit();
    }).catch(err => {
      console.error('Error:', err);
      app.quit();
      process.exit(1);
    });
  });
} else {
  // Already in Electron context
  module.exports = captureAppScreenshot;
}