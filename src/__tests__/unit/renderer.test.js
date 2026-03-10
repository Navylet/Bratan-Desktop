/**
 * @jest-environment jsdom
 */

const flushPromises = () => new Promise(setImmediate);

describe.skip('Renderer PDF analysis UI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button id="btn-start-gateway"></button>
      <button id="btn-stop-gateway"></button>
      <div id="gateway-status"><span class="w-3"></span><span></span></div>
      <div id="log-container"></div>
      <button id="btn-clear-logs"></button>
      <button id="btn-save-logs"></button>
      <div id="file-list"></div>
      <button id="btn-refresh-files"></button>
      <button id="btn-open-workspace"></button>
      <div id="task-monitor"></div>
      <input id="workspace-path" />
      <button id="btn-google-auth"></button>
      <button id="btn-github-auth"></button>
      <button id="btn-perplexity-search"></button>
      <input id="perplexity-query" />
      <input id="pdf-path" />
      <input id="pdf-pages" />
      <input id="pdf-ocr" type="checkbox" />
      <button id="btn-pdf-analyze"></button>
      <pre id="pdf-analysis-result"></pre>
      <button id="btn-notifications"></button>
      <div id="notification-count" class="hidden"></div>
      <span id="current-time"></span>
      <button id="btn-save-settings"></button>
      <button id="btn-reset-settings"></button>
      <textarea id="chat-input"></textarea>
      <div id="chat-messages"></div>
      <button id="btn-send"></button>
    `;

    global.window.api = {
      tasks: {
        analyzePDF: jest
          .fn()
          .mockResolvedValue({ pageCount: 1, ocrUsed: true, pages: [{ page: 1 }] }),
        webSearch: jest.fn().mockResolvedValue({ answer: 'ok', sources: [] }),
      },
      onOpenClawLog: jest.fn(),
      removeOpenClawLogListener: jest.fn(),
    };

    // Avoid missing object in renderer loading
    global.window.OpenClawWebSocket = class {
      constructor() {}
      on() {}
      connect() {}
      disconnect() {}
    };

    require('../../../renderer');
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  test('calls analyzePDF with pages and ocr parameters', async () => {
    document.getElementById('pdf-path').value = '/tmp/test.pdf';
    document.getElementById('pdf-pages').value = '1-1';
    document.getElementById('pdf-ocr').checked = true;

    document.getElementById('btn-pdf-analyze').click();

    await flushPromises();

    expect(window.api.tasks.analyzePDF).toHaveBeenCalledWith('/tmp/test.pdf', {
      pages: '1-1',
      ocr: true,
    });
    expect(document.getElementById('pdf-analysis-result').textContent).toContain('pageCount');
  });
});
