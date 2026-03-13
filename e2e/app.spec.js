const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

test.describe('OpenClaw Desktop', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.'],
    });

    page = await electronApp.firstWindow();

    // Wait for the app to load
    await page.waitForSelector('#current-tab-title');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
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
    await expect(page.locator('#content-chat')).toHaveClass(/(^|\s)hidden(\s|$)/);
    const logsTitle = await page.textContent('h2');
    expect(logsTitle).toContain('Логи OpenClaw Gateway');

    // Click on Files tab
    await page.click('#tab-files');
    await expect(page.locator('#content-files')).not.toHaveClass('hidden');
    await expect(page.locator('#content-logs')).toHaveClass(/(^|\s)hidden(\s|$)/);

    // Click back to Chat tab
    await page.click('#tab-chat');
    await expect(page.locator('#content-chat')).not.toHaveClass('hidden');
    await expect(page.locator('#content-files')).toHaveClass(/(^|\s)hidden(\s|$)/);
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

  test('should show advanced chat runtime controls', async () => {
    await page.click('#tab-chat');

    await expect(page.locator('#btn-chat-attach')).toBeVisible();
    await expect(page.locator('#chat-agent-id')).toBeVisible();
    await expect(page.locator('#chat-session-id')).toBeVisible();
    await expect(page.locator('#chat-thinking')).toBeVisible();
    await expect(page.locator('#chat-show-reasoning')).toBeVisible();
    await expect(page.locator('#chat-reasoning-panel')).toBeVisible();

    await page.fill('#chat-agent-id', 'main-agent');
    await page.fill('#chat-session-id', 'bratan-desktop-ui');
    await page.selectOption('#chat-thinking', 'low');

    await expect(page.locator('#chat-agent-id')).toHaveValue('main-agent');
    await expect(page.locator('#chat-session-id')).toHaveValue('bratan-desktop-ui');
    await expect(page.locator('#chat-thinking')).toHaveValue('low');
  });

  test('should show realtime response preparation indicator', async () => {
    await page.click('#tab-chat');

    const input = page.locator('#chat-input');
    await input.fill('e2e realtime indicator check');
    await page.click('#btn-send');

    const typingLocator = page.locator('.chat-message-typing');
    const liveStatusLocator = page.locator('#chat-live-status');

    // Indicator can be transient, so accept either typing bubble or visible live status.
    await expect
      .poll(async () => {
        const typingCount = await typingLocator.count();
        const statusHidden = await liveStatusLocator.evaluate((el) => el.classList.contains('hidden'));
        return typingCount > 0 || !statusHidden;
      })
      .toBeTruthy();
  });

  test('should render agents runtime panel', async () => {
    await page.click('#tab-agents');
    await expect(page.locator('#btn-refresh-agent-runtime')).toBeVisible();
    await expect(page.locator('#agents-known-list')).toBeVisible();
    await expect(page.locator('#agents-sessions-list')).toBeVisible();
    await expect(page.locator('#agent-reasoning-output')).toBeVisible();
    await expect(page.locator('#agent-trace-log')).toBeVisible();
  });

  test('should render RAG Studio controls', async () => {
    await page.click('#tab-rag');
    await expect(page.locator('#content-rag')).not.toHaveClass('hidden');

    await expect(page.locator('#btn-rag-pick-files')).toBeVisible();
    await expect(page.locator('#btn-rag-index')).toBeVisible();
    await expect(page.locator('#btn-rag-refresh')).toBeVisible();
    await expect(page.locator('#btn-rag-clear')).toBeVisible();
    await expect(page.locator('#btn-rag-export')).toBeVisible();
    await expect(page.locator('#btn-rag-import')).toBeVisible();
    await expect(page.locator('#rag-index-collection')).toBeVisible();
    await expect(page.locator('#rag-collection-filter')).toBeVisible();
    await expect(page.locator('#btn-rag-search')).toBeVisible();
    await expect(page.locator('#btn-rag-ask')).toBeVisible();
  });
});
