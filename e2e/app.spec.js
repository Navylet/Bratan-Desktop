const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');

test.describe('OpenClaw Desktop Fluent shell', () => {
  test.describe.configure({ mode: 'serial' });

  let electronApp;
  let page;

  const ui = (id) => page.locator(`#${id}, [data-testid="${id}"]`).first();

  async function openTab(tabId, expectedTitle, panelId, extraSelectors = []) {
    await ui(`tab-${tabId}`).click();
    await expect(ui(`content-${tabId}`)).toBeVisible();
    await expect(ui('current-tab-title')).toHaveText(expectedTitle);
    await expect(ui(panelId)).toBeVisible();

    for (const selectorId of extraSelectors) {
      await expect(ui(selectorId)).toBeVisible();
    }
  }

  test.beforeAll(async () => {
    electronApp = await electron.launch({ args: ['.'] });
    page = await electronApp.firstWindow();
    await ui('current-tab-title').waitFor();
    await ui('chat-input').waitFor();
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('loads Fluent shell by default', async () => {
    await expect(page).toHaveTitle('OpenClaw Fluent Shell');
    await expect(ui('current-tab-title')).toHaveText('Чат');
    await expect(ui('chat-panel')).toBeVisible();
    await expect(ui('chat-input')).toBeVisible();
    await expect(ui('btn-send')).toBeVisible();
    await expect(ui('gateway-status')).toBeVisible();
    await expect(ui('btn-shell-start-gateway')).toBeVisible();
    await expect(ui('btn-shell-stop-gateway')).toBeVisible();
  });

  test('switches across all Fluent tabs and shows key controls', async () => {
    await openTab('logs', 'Логи', 'logs-panel', ['btn-clear-logs', 'log-container']);
    await openTab('files', 'Файлы', 'files-panel', ['btn-files-home']);
    await openTab('agents', 'Агенты', 'agents-panel', ['btn-refresh-agent-runtime', 'agents-sessions-list', 'new-agent-name', 'new-agent-task']);
    await openTab('rag', 'RAG', 'rag-panel', ['btn-rag-pick-files', 'btn-rag-index', 'btn-rag-search', 'btn-rag-ask']);
    await openTab('integrations', 'Интеграции', 'integrations-panel', ['btn-model-provider-refresh', 'model-provider-select', 'btn-model-provider-save-token', 'btn-model-provider-test']);
    await openTab('settings', 'Настройки', 'settings-panel', ['gateway-status-badge', 'openclaw-version-installed', 'openclaw-model-select', 'btn-save-settings']);
    await openTab('chat', 'Чат', 'chat-panel', ['chat-input', 'btn-send']);
  });

  test('preserves basic chat input interactions', async () => {
    await openTab('chat', 'Чат', 'chat-panel', ['chat-input', 'btn-send']);

    await ui('chat-input').fill('smoke test draft message');
    await expect(ui('chat-input')).toHaveValue('smoke test draft message');
  });
});
