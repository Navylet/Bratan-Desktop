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

## References

- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Playwright Electron Plugin](https://github.com/spaceagetv/playwright-electron)
- [Electron Testing with Playwright](https://www.electronjs.org/docs/latest/tutorial/automated-testing#using-playwright)