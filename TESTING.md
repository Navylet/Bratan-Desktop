# Testing Setup for OpenClaw Desktop

This document describes the testing infrastructure for OpenClaw Desktop.

## Unit Tests (Jest)

Unit tests are located in `src/__tests__/` and follow the naming pattern `*.test.js`.

### Configuration

- **Jest config**: `jest.config.js`
- **Test environment**: Node.js (no DOM)
- **Coverage reports**: generated in `coverage/`

### Running Unit Tests

```bash
npm test
```

To run with coverage:

```bash
npm test -- --coverage
```

### Current Test Coverage

- `googleIntegration.js` – basic connect/disconnect, status, listFiles, createDocument
- `githubIntegration.js` – connect/disconnect, token handling, repos, branches

## Manual Regression Additions (March 2026)

Critical regression surface after latest updates:

- Chat attachment flow (`openclaw-pick-files`, `openclaw-send-message` with `attachments`).
- Agent/subagent runtime selectors (`agentId`, `sessionId`, `thinking`).
- Reasoning/trace rendering in Chat + Agents tabs.
- Realtime response preparation indicator (typing/progress UI state).
- RAG API and UI (`rag-pick-files`, `rag-index-files`, `rag-status`, `rag-search`, `rag-ask`, `rag-clear`).
- Stream chunk updates from CLI request pipeline (`openclaw-stream` events).
- RAG collections + index import/export workflow.

Recommended smoke checklist:

1. Open Chat, attach at least one file, send message, verify normal response text.
2. Toggle reasoning visibility, verify panel updates after response.
3. Open Agents tab, refresh runtime list, apply session to chat, send next message.
4. Verify typing/progress indicator appears while waiting and disappears on response.
5. Open RAG Studio, index files, run retrieval-only search, then ask with RAG.
6. Clear RAG index and verify empty state is handled correctly.

### Adding New Unit Tests

1. Create a `__tests__` folder in the relevant source directory.
2. Name test files as `*.test.js`.
3. Use Jest’s `describe`/`test` or `it` patterns.
4. Mock external dependencies (fetch, WebSocket) using `jest.mock()`.

## E2E Tests (Playwright)

E2E tests are located in `e2e/` and use Playwright with Electron.

### Configuration

- **Playwright config**: `playwright.config.js`
- **Test directory**: `e2e/`
- **Reporter**: HTML report in `playwright-report/`

### Running E2E Tests Locally

**Prerequisites:** Xvfb (for Linux headless GUI) and Electron system libraries.

```bash
# Install browsers (chromium) for Playwright
npx playwright install chromium

# Run e2e tests with a virtual display (Linux)
xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" npm run test:e2e
```

On macOS/Windows with a real display you can run directly:

```bash
npm run test:e2e
```

### Current E2E Tests

- `app.spec.js` – basic application launch, tab switching, chat message, gateway controls.

### Suggested E2E Extensions

Add scenarios in `e2e/app.spec.js` or split into dedicated specs:

- `chat-attachments.spec.js`: attach file, send, response normalization.
- `agent-runtime.spec.js`: session/agent selection from runtime panel.
- `rag-studio.spec.js`: file pick/index/search/ask/clear states.
- `realtime-progress.spec.js`: typing/progress indicator state transitions.

**Note:** The e2e test suite currently launches the real Electron app with remote debugging and connects via CDP. This requires a graphical environment (or Xvfb) and may need adjustment for CI environments.

### Adding New E2E Tests

1. Add new `.spec.js` files in the `e2e/` directory.
2. Use Playwright’s `test` and `expect` API.
3. Use `page.locator()` to find elements.
4. Follow the existing pattern for beforeAll/afterAll hooks.

## CI Pipeline

A GitHub Actions workflow (`.github/workflows/ci.yml`) is set up to run tests on push/pull request.

**Steps:**

1. Install Node.js and dependencies (`npm ci`)
2. Run unit tests (`npm test`)
3. Install Playwright browsers
4. Install Xvfb and GUI libraries
5. Run e2e tests with Xvfb

## Next Steps / Known Issues

- **E2E tests** may fail due to port conflicts or Electron startup delays; consider using a more robust launcher (e.g., `playwright-electron`).
- **Mocking** for unit tests could be extended to simulate network errors and edge cases.
- **CI** might need additional tweaks for different operating systems (Windows/macOS).
- **Coverage thresholds** could be added to enforce a minimum coverage percentage.
- **RAG tests** currently require fixture files and stable CLI connectivity; add deterministic local fixtures for CI.

## References

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Playwright Electron Plugin](https://github.com/spaceagetv/playwright-electron)
- [Electron Testing with Playwright](https://www.electronjs.org/docs/latest/tutorial/automated-testing#using-playwright)
