const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

test.describe('OpenClaw Desktop', () => {
  let electronProcess;
  let browser;
  let page;

  test.beforeAll(async () => {
    const port = 9223;
    // Launch Electron with remote debugging
    electronProcess = spawn(require('electron'), ['.', `--remote-debugging-port=${port}`], {
      stdio: 'inherit',
    });

    // Wait for Electron to start and open debugging port
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Connect to the Electron instance via CDP
    browser = await chromium.connectOverCDP(`http://localhost:${port}`);
    const contexts = browser.contexts();
    expect(contexts.length).toBeGreaterThan(0);
    page = contexts[0].pages()[0];
    if (!page) {
      page = await contexts[0].newPage();
    }

    // Wait for the app to load
    await page.waitForSelector('#current-tab-title');
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (electronProcess) {
      electronProcess.kill();
    }
  });

  test('should open application and show correct title', async () => {
    await expect(page).toHaveTitle('Братан Desktop');
    const title = await page.textContent('#current-tab-title');
    expect(title).toContain('Чат с Братаном');
  });

  test('should switch tabs', async () => {
    // Click on Logs tab
    await page.click('#tab-logs');
    await expect(page.locator('#content-logs')).not.toHaveClass('hidden');
    await expect(page.locator('#content-chat')).toHaveClass('hidden');
    const logsTitle = await page.textContent('h2');
    expect(logsTitle).toContain('Логи OpenClaw Gateway');

    // Click on Files tab
    await page.click('#tab-files');
    await expect(page.locator('#content-files')).not.toHaveClass('hidden');
    await expect(page.locator('#content-logs')).toHaveClass('hidden');

    // Click back to Chat tab
    await page.click('#tab-chat');
    await expect(page.locator('#content-chat')).not.toHaveClass('hidden');
    await expect(page.locator('#content-files')).toHaveClass('hidden');
  });

  test('should send a chat message', async () => {
    const input = page.locator('#chat-input');
    const sendButton = page.locator('#btn-send');
    await input.fill('Hello from e2e test');
    await sendButton.click();
    // Wait for the message to appear (assuming it adds a new message)
    // For now, just check that the input is cleared
    await expect(input).toHaveValue('');
  });

  test('should show gateway controls', async () => {
    const startButton = page.locator('#btn-start-gateway');
    const stopButton = page.locator('#btn-stop-gateway');
    const status = page.locator('#gateway-status');
    await expect(startButton).toBeVisible();
    await expect(stopButton).toBeDisabled();
    await expect(status).toContainText('Gateway не запущен');
  });
});