const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  shell,
  Menu,
  Tray,
  globalShortcut,
  dialog,
} = require('electron');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const logger = require('./logger');
const { GoogleIntegration } = require('./integrations/google');
const { GitHubIntegration } = require('./integrations/github');

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let openclawProcess = null;
let tray = null;

// Managers and integrations
let taskManager = null;
let googleIntegration = null;
let githubIntegration = null;

const appDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : process.cwd();
logger.init(appDataPath);
logger.info('Main process starting...');

process.on('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err.stack || err.message}`);
  if (dialog && typeof dialog.showErrorBox === 'function') {
    dialog.showErrorBox('Critical Error', `Uncaught exception:\n${err.stack || err.message}`);
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error(`unhandledRejection: ${reason}`);
  if (dialog && typeof dialog.showErrorBox === 'function') {
    dialog.showErrorBox('Unhandled Promise Rejection', `Unhandled rejection:\n${reason}`);
  }
});

function toggleWindowVisibility(section) {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
    mainWindow.setSkipTaskbar(true);
  } else {
    mainWindow.setSkipTaskbar(false);
    mainWindow.show();
    mainWindow.focus();
    if (section && mainWindow.webContents) {
      mainWindow.webContents.send('navigate', section);
    }
  }
}

function showWindow(section) {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) {
    mainWindow.setSkipTaskbar(false);
    mainWindow.show();
    mainWindow.focus();
  }
  if (section && mainWindow.webContents) {
    mainWindow.webContents.send('navigate', section);
  }
}

function showError(title, message) {
  logger.error(`${title}: ${message}`);
  if (dialog && typeof dialog.showErrorBox === 'function') {
    dialog.showErrorBox(title, message);
  }
}

async function createWindow() {
  global.isQuitting = false;
  const fluentUiEntry = path.join(__dirname, 'dist-fluent', 'index.html');
  const legacyUiEntry = path.join(__dirname, 'index.html');
  const preferredUiEntry = fs.existsSync(fluentUiEntry) ? fluentUiEntry : legacyUiEntry;

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false, // sandbox mode can be enabled with full refactor
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Братан Desktop',
    show: true,
  });

  // Prefer the Fluent bundle when it exists; fall back to the legacy renderer.
  try {
    await mainWindow.loadFile(preferredUiEntry);
    logger.info(`UI loaded: ${path.relative(__dirname, preferredUiEntry) || path.basename(preferredUiEntry)}`);
  } catch (err) {
    logger.error('Failed to load UI: ' + err.message);
    showError('Загрузка UI не удалась', `Не удалось открыть ${path.basename(preferredUiEntry)}:\n${err.message}`);
  }

  // Show when ready (and also protect from failure-to-show)
  mainWindow.once('ready-to-show', () => {
    logger.info('Window ready-to-show');
    if (!mainWindow.isVisible()) mainWindow.show();
  });

  if (mainWindow.webContents && typeof mainWindow.webContents.on === 'function') {
    mainWindow.webContents.on('did-finish-load', () => {
      logger.info('WebContents did-finish-load');
      if (!mainWindow.isVisible()) mainWindow.show();
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      const message = `Не удалось загрузить интерфейс (${errorCode}: ${errorDescription}) ${validatedURL}`;
      logger.error(message);
      showError('Ошибка загрузки интерфейса', message);
      if (!mainWindow.isVisible()) mainWindow.show();
    });
  } else {
    logger.warn('mainWindow.webContents unavailable; skipping did-finish-load/did-fail-load handlers');
  }

  mainWindow.webContents.on('crashed', () => {
    const err = 'WebContents crashed';
    logger.error(err);
    showError('Сбой рендерера', err);
    if (!mainWindow.isVisible()) mainWindow.show();
  });

  mainWindow.on('unresponsive', () => {
    logger.warn('Window is unresponsive');
    // Don't hide. Keep visible to user and set a message in UI if needed.
  });

  // Open DevTools (remove in production)
  // mainWindow.webContents.openDevTools();

  // Prevent closing the window: hide to tray instead
  mainWindow.on('close', (event) => {
    if (!global.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true);
      // Show notification that app is still running in tray (optional)
      // new Notification({ title: 'Братан Desktop', body: 'Приложение свернуто в трей' }).show();
    }
    // If global.isQuitting is true, the window will close normally
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set custom menu
  setApplicationMenu();
  // Create tray icon and global shortcuts
  createTray();
}

function setApplicationMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Открыть рабочую папку',
          click: () => {
            shell.openPath(path.join(os.homedir(), '.openclaw', 'workspace'));
          },
        },
        {
          label: 'Открыть папку проекта',
          click: () => {
            shell.openPath(__dirname);
          },
        },
        { type: 'separator' },
        {
          label: 'Выйти',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Сервер',
      submenu: [
        {
          label: 'Запустить OpenClaw Gateway',
          click: startOpenClawGateway,
        },
        {
          label: 'Остановить OpenClaw Gateway',
          click: stopOpenClawGateway,
        },
        { type: 'separator' },
        {
          label: 'Проверить статус',
          click: checkGatewayStatus,
        },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Помощь',
      submenu: [
        {
          label: 'Документация OpenClaw',
          click: () => shell.openExternal('https://docs.openclaw.ai'),
        },
        {
          label: 'GitHub',
          click: () => shell.openExternal('https://github.com/openclaw/openclaw'),
        },
        { type: 'separator' },
        {
          label: 'О приложении',
          click: showAbout,
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать/Скрыть окно',
      click: toggleWindowVisibility,
    },
    {
      label: 'Открыть чат',
      click: () => showWindow('chat'),
    },
    {
      label: 'Открыть логи',
      click: () => showWindow('logs'),
    },
    {
      label: 'Открыть настройки',
      click: () => showWindow('settings'),
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        global.isQuitting = true;
        // Unregister global shortcuts before quit
        unregisterGlobalShortcuts();
        if (tray) tray.destroy();
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Братан Desktop');
  tray.setContextMenu(contextMenu);

  // Левый клик переключает видимость окна
  tray.on('click', toggleWindowVisibility);

  // Register global shortcuts
  registerGlobalShortcuts();
}

function registerGlobalShortcuts() {
  // Unregister any existing shortcuts first
  unregisterGlobalShortcuts();

  // Register new shortcuts
  globalShortcut.register('Ctrl+Shift+C', () => toggleWindowVisibility('chat'));
  globalShortcut.register('Ctrl+Shift+L', () => toggleWindowVisibility('logs'));
  globalShortcut.register('Ctrl+Shift+S', () => toggleWindowVisibility('settings'));
  globalShortcut.register('Ctrl+Shift+Q', () => {
    global.isQuitting = true;
    unregisterGlobalShortcuts();
    if (tray) tray.destroy();
    app.quit();
  });
}

function unregisterGlobalShortcuts() {
  globalShortcut.unregisterAll();
}

function showAbout() {
  new Notification({
    title: 'Братан Desktop',
    body: 'Десктопное приложение OpenClaw для управления агентами и файлами.',
  }).show();
}

const DEFAULT_OPENCLAW_COMMAND = process.platform === 'win32' ? 'openclaw.exe' : 'openclaw';
const DEFAULT_OPENCLAW_CHAT_SESSION_ID = 'bratan-desktop-ui';
const openClawRuntimeConfig = {
  cliPath: null,
  gatewayPort: 18789,
};
const MAX_CHAT_ATTACHMENTS = 5;
const MAX_ATTACHMENT_PREVIEW_CHARS = 16000;
const MAX_ATTACHMENT_TOTAL_CHARS = 50000;
const RAG_STORE_FILENAME = 'rag-index.json';
const RAG_STORE_VERSION = 1;
const RAG_CHUNK_SIZE = 1200;
const RAG_CHUNK_OVERLAP = 200;
const RAG_SCOPE_DEFAULT = 'default';

const ragStoreCacheByScope = new Map();
let openClawUpdateInProgress = false;
let openClawAgentListCommand = null;
let openClawSessionListCommand = null;
let openClawAgentCreateCommand = null;
let openClawPreferLocalUntil = 0;

const OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS = 10 * 60 * 1000;

function updateOpenClawRuntimeConfig(config = {}) {
  if (!config || typeof config !== 'object') {
    return { ...openClawRuntimeConfig };
  }

  if (typeof config.cliPath === 'string') {
    const cliPath = config.cliPath.trim();
    openClawRuntimeConfig.cliPath = cliPath || null;
  }

  if (config.gatewayPort !== undefined && config.gatewayPort !== null) {
    const gatewayPort = Number(config.gatewayPort);
    if (Number.isInteger(gatewayPort) && gatewayPort > 0) {
      openClawRuntimeConfig.gatewayPort = gatewayPort;
    }
  }

  return { ...openClawRuntimeConfig };
}

function getOpenClawGatewayUrl() {
  return `ws://127.0.0.1:${openClawRuntimeConfig.gatewayPort}`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripControlChars(value = '') {
  return Array.from(String(value || ''))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');
}

function stripKnownCliNoise(text = '') {
  return stripControlChars(text)
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;

      const lower = trimmed.toLowerCase();
      return !(
        lower.includes('wsl:') ||
        /^wsl:/i.test(trimmed) ||
        /^<\d+>wsl/i.test(trimmed) ||
        (trimmed.includes('WSL') && lower.includes('localhost')) ||
        lower.includes('конфигурация прокси-сервера localhost обнаружена') ||
        lower.includes('wsl в режиме nat не поддерживает прокси-серверы localhost') ||
        lower.includes('localhost proxy configuration was detected') ||
        lower.includes('not mirrored into wsl') ||
        (lower.includes('wsl in nat mode') && lower.includes('localhost')) ||
        (lower.includes('wsl') && lower.includes('localhost') && lower.includes('proxy'))
      );
    })
    .join('\n')
    .trim();
}

function isUnknownAgentFailureText(text = '') {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes('unknown agent id') || normalized.includes('unknown agent');
}

function isSessionLockFailureText(text = '') {
  const normalized = String(text || '').toLowerCase();
  if (!normalized) {
    return false;
  }

  return (
    normalized.includes('session file locked') ||
    normalized.includes('.jsonl.lock') ||
    normalized.includes('session lock') ||
    normalized.includes('lock timeout')
  );
}

function buildRecoveredSessionId(baseSessionId = DEFAULT_OPENCLAW_CHAT_SESSION_ID) {
  const source = String(baseSessionId || DEFAULT_OPENCLAW_CHAT_SESSION_ID)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const prefix = source || DEFAULT_OPENCLAW_CHAT_SESSION_ID;
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  const candidate = `${prefix}-recovery-${stamp}-${random}`;
  return candidate.slice(0, 96);
}

function summarizeOpenClawFailure(text = '') {
  const cleaned = stripKnownCliNoise(text);
  if (!cleaned) {
    return '';
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith('[tools]') &&
        !line.startsWith('[agent/embedded]') &&
        !line.startsWith('[diagnostic]') &&
        !line.startsWith('[compaction-safeguard]')
    );

  const unknownAgentLine = lines.find((line) => isUnknownAgentFailureText(line));
  if (unknownAgentLine) {
    return unknownAgentLine;
  }

  const allModelsLine = lines.find((line) => line.includes('All models failed'));
  if (allModelsLine) {
    return allModelsLine;
  }

  const authLine = lines.find(
    (line) =>
      line.toLowerCase().includes('auth issue') ||
      line.toLowerCase().includes('forbidden') ||
      line.toLowerCase().includes('request not allowed')
  );
  if (authLine) {
    return authLine;
  }

  const timeoutLine = lines.find((line) => line.toLowerCase().includes('timed out'));
  if (timeoutLine) {
    return timeoutLine;
  }

  return lines.slice(0, 3).join(' | ');
}

function parseJsonFromText(text) {
  const source = String(text || '').trim();
  if (!source) return null;

  try {
    return JSON.parse(source);
  } catch {
    // recover from banners and extra lines
  }

  const lines = source.split(/\r?\n/).filter((line) => line.trim());
  for (let start = 0; start < lines.length; start += 1) {
    try {
      return JSON.parse(lines.slice(start).join('\n'));
    } catch {
      // continue
    }
  }

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // continue
    }
  }

  const extractBalancedJson = (input, startIndex) => {
    const startChar = input[startIndex];
    const endChar = startChar === '{' ? '}' : startChar === '[' ? ']' : '';
    if (!endChar) {
      return '';
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = startIndex; index < input.length; index += 1) {
      const char = input[index];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (char === '\\') {
          escaped = true;
          continue;
        }

        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }

      if (char === startChar) {
        depth += 1;
        continue;
      }

      if (char === endChar) {
        depth -= 1;
        if (depth === 0) {
          return input.slice(startIndex, index + 1);
        }
      }
    }

    return '';
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char !== '{' && char !== '[') {
      continue;
    }

    const candidate = extractBalancedJson(source, index);
    if (!candidate) {
      continue;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

function parseOpenClawVersionText(text = '') {
  const source = String(text || '').trim();
  if (!source) return null;

  const calendarMatch = source.match(/\b(\d{4}\.\d+\.\d+)\b/);
  if (calendarMatch) {
    return calendarMatch[1];
  }

  const semverMatch = source.match(/\b(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)\b/);
  if (semverMatch) {
    return semverMatch[1];
  }

  return null;
}

function normalizeAgentTimeoutSeconds(value, fallback = 120) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1800, Math.max(30, Math.round(parsed)));
}

function isTransientModelFailureText(text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return true;

  return (
    normalized.includes('llm request timed out') ||
    normalized.includes('all models failed') ||
    normalized.includes('provider auth issue') ||
    normalized.includes('request not allowed') ||
    normalized.includes('forbidden') ||
    normalized === 'timed out' ||
    normalized === 'timeout'
  );
}

function detectTransientModelPayloadFailure(parsedPayload, outputText, metaPayload) {
  const outputTextRaw = String(outputText || '').trim();
  const parsedOutputPayload = outputTextRaw ? parseJsonFromText(outputTextRaw) : null;
  const outputLooksJsonEnvelope = Boolean(parsedOutputPayload && typeof parsedOutputPayload === 'object');
  const extractedOutputFromEnvelope = outputLooksJsonEnvelope ? extractOpenClawText(parsedOutputPayload) : '';
  const normalizedOutput = outputLooksJsonEnvelope
    ? String(extractedOutputFromEnvelope || '').trim()
    : outputTextRaw;

  const effectivePayload =
    parsedPayload && typeof parsedPayload === 'object' && Object.keys(parsedPayload).length
      ? parsedPayload
      : parsedOutputPayload && typeof parsedOutputPayload === 'object'
        ? parsedOutputPayload
        : parsedPayload;

  if (normalizedOutput && isTransientModelFailureText(normalizedOutput)) {
    return summarizeOpenClawFailure(normalizedOutput) || normalizedOutput;
  }

  const parsedMeta =
    (effectivePayload &&
    typeof effectivePayload === 'object' &&
    effectivePayload.meta &&
    typeof effectivePayload.meta === 'object'
      ? effectivePayload.meta
      : null) ||
    (effectivePayload &&
    typeof effectivePayload === 'object' &&
    effectivePayload.result &&
    typeof effectivePayload.result === 'object' &&
    effectivePayload.result.meta &&
    typeof effectivePayload.result.meta === 'object'
      ? effectivePayload.result.meta
      : null) ||
    null;

  const mergedMeta = metaPayload && typeof metaPayload === 'object' ? metaPayload : parsedMeta;
  const parsedError = toText(
    (effectivePayload && typeof effectivePayload === 'object' && effectivePayload.error) ||
      parsedMeta?.error ||
      parsedMeta?.agentMeta?.error ||
      mergedMeta?.error ||
      mergedMeta?.agentMeta?.error
  );
  const stopReason = toText(parsedMeta?.stopReason || mergedMeta?.stopReason);
  const normalizedStopReason = stopReason.toLowerCase();
  const aborted = Boolean(parsedMeta?.aborted ?? mergedMeta?.aborted);
  const payloads = Array.isArray(effectivePayload?.payloads) ? effectivePayload.payloads : [];
  const hasPayloadText = payloads.some((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidateText =
      (typeof entry.text === 'string' ? entry.text : '') ||
      (typeof entry.content === 'string' ? entry.content : '') ||
      (typeof entry.message === 'string' ? entry.message : '');

    return Boolean(String(candidateText || '').trim());
  });

  if (parsedError && isTransientModelFailureText(parsedError)) {
    return summarizeOpenClawFailure(parsedError) || parsedError;
  }

  if (stopReason && isTransientModelFailureText(stopReason)) {
    return summarizeOpenClawFailure(stopReason) || stopReason;
  }

  if (normalizedStopReason === 'tooluse' && !normalizedOutput && !hasPayloadText) {
    return 'Модель завершила ход с stopReason=toolUse без финального текста.';
  }

  if (aborted && !normalizedOutput) {
    return 'Запрос прерван до получения ответа.';
  }

  return '';
}

function pickPreferredOpenClawText(texts) {
  const cleaned = texts.map((text) => String(text || '').trim()).filter(Boolean);
  if (!cleaned.length) {
    return '';
  }

  const nonFailure = cleaned.filter((text) => !isTransientModelFailureText(text));
  const preferred = nonFailure.length ? nonFailure[nonFailure.length - 1] : cleaned[cleaned.length - 1];
  return preferred || '';
}

function extractOpenClawText(payload) {
  if (payload === null || payload === undefined) return '';
  if (typeof payload === 'string') {
    const parsed = parseJsonFromText(payload);
    if (parsed && parsed !== payload) {
      const extracted = extractOpenClawText(parsed);
      if (extracted) {
        return extracted;
      }
    }

    return payload;
  }

  if (Array.isArray(payload)) {
    return pickPreferredOpenClawText(payload.map((entry) => extractOpenClawText(entry)));
  }

  if (payload && typeof payload === 'object' && Array.isArray(payload.payloads)) {
    const payloadText = pickPreferredOpenClawText(
      payload.payloads.map((entry) => (entry && typeof entry.text === 'string' ? entry.text : extractOpenClawText(entry)))
    );
    if (payloadText) {
      return payloadText;
    }
  }

  const preferredKeys = ['output', 'message', 'text', 'content', 'reply'];
  for (const key of preferredKeys) {
    if (typeof payload[key] === 'string' && payload[key].trim()) {
      return payload[key];
    }
  }

  const nestedKeys = ['result', 'final', 'data'];
  for (const key of nestedKeys) {
    if (payload[key] !== undefined) {
      const nestedText = extractOpenClawText(payload[key]);
      if (nestedText) return nestedText;
    }
  }

  // Do not stringify unknown object payloads into chat text.
  // Returning empty string allows transient/aborted detection to kick in.
  return '';
}

const TEXT_FILE_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.json',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.css',
  '.html',
  '.xml',
  '.yml',
  '.yaml',
  '.csv',
  '.py',
  '.java',
  '.go',
  '.rs',
  '.sql',
  '.ini',
  '.toml',
  '.env',
  '.log',
]);

const OFFICE_DOCUMENT_EXTENSIONS = new Set([
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.pptx',
  '.ppt',
  '.pdf',
  '.rtf',
  '.odt',
  '.ods',
  '.odp',
]);

function detectMimeTypeByExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.tsx': 'application/typescript',
    '.jsx': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.xml': 'application/xml',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.csv': 'text/csv',
    '.py': 'text/x-python',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function isTextFileExtension(filePath) {
  return TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

let officeParserModule = null;
let pdfParseFunction = undefined;

function getPdfParseFunction() {
  if (pdfParseFunction !== undefined) {
    return pdfParseFunction;
  }

  try {
    const imported = require('pdf-parse');
    const resolved = typeof imported === 'function' ? imported : imported && typeof imported.default === 'function' ? imported.default : null;
    if (!resolved) {
      throw new Error('pdf-parse export is not a function');
    }

    pdfParseFunction = resolved;
  } catch (err) {
    logger.warn(`pdf-parse module is unavailable: ${err.message}`);
    pdfParseFunction = null;
  }

  return pdfParseFunction;
}

async function extractPdfDocumentText(filePath) {
  const parser = getPdfParseFunction();
  if (!parser) {
    return {
      text: '',
      extraction: 'pdf-parse-unavailable',
    };
  }

  try {
    const buffer = await fs.promises.readFile(filePath);
    const parsed = await parser(buffer, { max: 0 });
    const text = String(parsed && parsed.text ? parsed.text : '').trim();
    if (text) {
      return {
        text,
        extraction: 'pdf-parse',
      };
    }
  } catch (err) {
    logger.warn(`pdf-parse extraction failed for ${filePath}: ${err.message}`);
  }

  return {
    text: '',
    extraction: 'pdf-parse-empty',
  };
}

async function getOfficeParserModule() {
  if (officeParserModule) return officeParserModule;

  const imported = await import('officeparser');
  officeParserModule = imported?.parseOffice
    ? imported
    : imported?.default?.parseOffice
      ? imported.default
      : null;

  if (!officeParserModule || typeof officeParserModule.parseOffice !== 'function') {
    throw new Error('Не удалось загрузить officeparser');
  }

  return officeParserModule;
}

async function extractWithOfficeParser(filePath, ext) {
  try {
    const parser = await getOfficeParserModule();
    const ast = await parser.parseOffice(filePath, {
      ignoreNotes: true,
      newlineDelimiter: '\n',
      outputErrorToConsole: false,
      toText: false,
    });

    if (ast && typeof ast.toText === 'function') {
      const text = String(ast.toText() || '').trim();
      if (text) {
        return {
          text,
          extraction: `officeparser:${ext.replace('.', '')}`,
        };
      }
    }
  } catch (err) {
    logger.warn(`Office extraction failed for ${filePath}: ${err.message}`);
  }

  return {
    text: '',
    extraction: `unsupported:${ext.replace('.', '')}`,
  };
}

async function extractOfficeDocumentText(filePath, ext) {
  if (ext === '.pdf') {
    const pdfParsePayload = await extractPdfDocumentText(filePath);
    if (pdfParsePayload.text) {
      return pdfParsePayload;
    }

    const officePdfPayload = await extractWithOfficeParser(filePath, ext);
    if (officePdfPayload.text) {
      return officePdfPayload;
    }

    if (taskManager && typeof taskManager.analyzePDF === 'function') {
      try {
        const pdfData = await taskManager.analyzePDF(filePath, { pages: '1-20', ocr: false });
        const text = String(pdfData.rawText || '').trim();
        if (text) {
          return {
            text,
            extraction: 'pdf-task-manager',
          };
        }
      } catch (err) {
        logger.warn(`PDF fallback extraction failed for ${filePath}: ${err.message}`);
      }
    }

    return {
      text: '',
      extraction: pdfParsePayload.extraction || officePdfPayload.extraction || 'unsupported:pdf',
    };
  }

  return extractWithOfficeParser(filePath, ext);
}

function normalizeWorkspaceScope(value, fallback = RAG_SCOPE_DEFAULT) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return fallback;
  }

  const normalized = raw
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.slice(0, 96) || fallback;
}

function deriveRagScopeKey(input = {}) {
  if (typeof input === 'string') {
    return normalizeWorkspaceScope(input);
  }

  const payload = input && typeof input === 'object' ? input : {};
  const workspaceKey = String(payload.workspaceKey || '').trim();
  if (workspaceKey) {
    return normalizeWorkspaceScope(workspaceKey);
  }

  const workspacePath = String(payload.workspacePath || '').trim();
  if (workspacePath) {
    return normalizeWorkspaceScope(workspacePath);
  }

  return RAG_SCOPE_DEFAULT;
}

function buildRagStoreFileName(scopeKey = RAG_SCOPE_DEFAULT) {
  const normalizedScope = normalizeWorkspaceScope(scopeKey);
  if (normalizedScope === RAG_SCOPE_DEFAULT) {
    return RAG_STORE_FILENAME;
  }

  return `rag-index-${normalizedScope}.json`;
}

function getRagStorePath(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  return path.join(appDataPath, buildRagStoreFileName(scopeKey));
}

function createEmptyRagStore() {
  return {
    version: RAG_STORE_VERSION,
    updatedAt: new Date().toISOString(),
    documents: [],
    chunks: [],
  };
}

function normalizeRagStorePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return createEmptyRagStore();
  }

  return {
    version: payload.version || RAG_STORE_VERSION,
    updatedAt: payload.updatedAt || new Date().toISOString(),
    documents: Array.isArray(payload.documents) ? payload.documents : [],
    chunks: Array.isArray(payload.chunks) ? payload.chunks : [],
  };
}

function ensureRagStoreLoaded(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  if (ragStoreCacheByScope.has(scopeKey)) {
    return ragStoreCacheByScope.get(scopeKey);
  }

  const storePath = getRagStorePath({ workspaceKey: scopeKey });
  let loadedStore;

  try {
    if (fs.existsSync(storePath)) {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
      loadedStore = normalizeRagStorePayload(parsed);
    } else {
      loadedStore = createEmptyRagStore();
    }
  } catch (err) {
    logger.warn(`Failed to load RAG store (${scopeKey}): ${err.message}`);
    loadedStore = createEmptyRagStore();
  }

  ragStoreCacheByScope.set(scopeKey, loadedStore);
  return loadedStore;
}

function saveRagStore(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  const store = ensureRagStoreLoaded({ workspaceKey: scopeKey });
  store.updatedAt = new Date().toISOString();
  const storePath = getRagStorePath({ workspaceKey: scopeKey });
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  ragStoreCacheByScope.set(scopeKey, store);
  return store;
}

function tokenizeRagText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .slice(0, 5000);
}

function normalizeCollectionName(value) {
  const raw = String(value || 'default').trim();
  if (!raw) return 'default';
  return raw.slice(0, 80);
}

function splitTextToChunks(text, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP) {
  const source = String(text || '').trim();
  if (!source) return [];

  const chunks = [];
  let start = 0;
  while (start < source.length) {
    const end = Math.min(source.length, start + chunkSize);
    const chunkText = source.slice(start, end).trim();
    if (chunkText) {
      chunks.push(chunkText);
    }
    if (end >= source.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

async function readFileForContext(filePath, options = {}) {
  const maxChars = Number.isInteger(options.maxChars) && options.maxChars > 0 ? options.maxChars : MAX_ATTACHMENT_PREVIEW_CHARS;
  const resolved = path.resolve(String(filePath || ''));
  const stats = await fs.promises.stat(resolved);
  const ext = path.extname(resolved).toLowerCase();

  let content = '';
  let extraction = 'none';

  if (OFFICE_DOCUMENT_EXTENSIONS.has(ext)) {
    const officePayload = await extractOfficeDocumentText(resolved, ext);
    content = String(officePayload.text || '');
    extraction = officePayload.extraction;
  }

  if (!content && isTextFileExtension(resolved)) {
    content = await fs.promises.readFile(resolved, 'utf8');
    extraction = 'text';
  }

  const normalized = String(content || '').replace(/\u0000/g, '');
  const truncated = normalized.length > maxChars;
  const preview = truncated ? normalized.slice(0, maxChars) : normalized;

  return {
    name: path.basename(resolved),
    path: resolved,
    size: stats.size,
    ext,
    mime: detectMimeTypeByExtension(resolved),
    preview,
    truncated,
    hasText: Boolean(preview.trim()),
    extraction,
  };
}

function buildAttachmentPrompt(baseText, attachments) {
  const cleanText = String(baseText || '').trim();
  if (!attachments || !attachments.length) {
    return cleanText;
  }

  let remainingChars = MAX_ATTACHMENT_TOTAL_CHARS;
  const sections = attachments.map((attachment, index) => {
    const header = `Файл ${index + 1}: ${attachment.name} (${attachment.size} bytes, ${attachment.mime})`;
    if (!attachment.hasText || remainingChars <= 0) {
      return `${header}\n[Текст не извлечён автоматически. Используйте имя/тип файла как контекст.]`;
    }

    const snippet = attachment.preview.slice(0, Math.max(0, remainingChars));
    remainingChars -= snippet.length;
    const suffix = attachment.truncated || snippet.length < attachment.preview.length ? '\n...[обрезано]' : '';
    return `${header}\n${snippet}${suffix}`;
  });

  return [
    cleanText,
    '',
    '---',
    'Пользователь приложил файлы. Используй содержимое ниже как дополнительный контекст:',
    sections.join('\n\n---\n\n'),
  ].join('\n');
}

function extractOpenClawReasoning(payload) {
  const reasoningKeys = new Set(['reasoning', 'analysis', 'thinking', 'thoughts', 'rationale', 'plan', 'trace']);
  const collected = [];
  const visited = new Set();
  const stack = [payload];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') {
      continue;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    Object.entries(current).forEach(([key, value]) => {
      const normalizedKey = String(key || '').toLowerCase();
      if (typeof value === 'string' && value.trim() && reasoningKeys.has(normalizedKey)) {
        collected.push(value.trim());
      }

      if (value && typeof value === 'object') {
        stack.push(value);
      }
    });
  }

  return Array.from(new Set(collected)).slice(0, 8);
}

function extractOpenClawMeta(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (payload.meta && typeof payload.meta === 'object') {
    return payload.meta;
  }

  if (payload.result && payload.result.meta && typeof payload.result.meta === 'object') {
    return payload.result.meta;
  }

  return null;
}

async function pickFilesFromDialog(options = {}) {
  if (!dialog || typeof dialog.showOpenDialog !== 'function') {
    throw new Error('File dialog API is unavailable.');
  }

  const result = await dialog.showOpenDialog(mainWindow || undefined, {
    title: options.title || 'Выберите файлы',
    properties: ['openFile', ...(options.multi === false ? [] : ['multiSelections'])],
  });

  if (result.canceled) {
    return [];
  }

  return Promise.all(
    result.filePaths.map(async (filePath) => {
      try {
        const stats = await fs.promises.stat(filePath);
        return {
          path: filePath,
          name: path.basename(filePath),
          size: stats.size,
          mime: detectMimeTypeByExtension(filePath),
        };
      } catch {
        return {
          path: filePath,
          name: path.basename(filePath),
          size: 0,
          mime: detectMimeTypeByExtension(filePath),
        };
      }
    })
  );
}

function normalizeAttachmentPaths(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const paths = input
    .map((entry) => {
      if (!entry) return '';
      if (typeof entry === 'string') return entry;
      if (typeof entry.path === 'string') return entry.path;
      return '';
    })
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

  return Array.from(new Set(paths)).slice(0, MAX_CHAT_ATTACHMENTS);
}

async function prepareAttachmentContexts(attachments) {
  const attachmentPaths = normalizeAttachmentPaths(attachments);
  if (!attachmentPaths.length) {
    return [];
  }

  const prepared = [];
  for (const filePath of attachmentPaths) {
    try {
      const context = await readFileForContext(filePath, { maxChars: MAX_ATTACHMENT_PREVIEW_CHARS });
      prepared.push(context);
    } catch (err) {
      prepared.push({
        name: path.basename(filePath),
        path: filePath,
        size: 0,
        ext: path.extname(filePath).toLowerCase(),
        mime: detectMimeTypeByExtension(filePath),
        preview: '',
        truncated: false,
        hasText: false,
        extraction: 'error',
        error: err.message,
      });
    }
  }

  return prepared;
}

function emitOpenClawStream(update) {
  if (!mainWindow || !mainWindow.webContents) {
    return;
  }

  try {
    mainWindow.webContents.send('openclaw-stream', update);
  } catch (err) {
    logger.warn(`Failed to emit openclaw-stream: ${err.message}`);
  }
}

const GATEWAY_FALLBACK_RE = /gateway(?:\s+agent)?\s+failed|falling back to embedded|gateway closed.*1006/i;
const GATEWAY_FAILURE_RE = /gateway\s+closed|abnormal\s+closure|no\s+close\s+frame|falling\s+back\s+to\s+embedded/i;
const GATEWAY_DIAGNOSTIC_LINE_RE = /^(gateway\s+agent\s+failed;\s*falling\s+back\s+to\s+embedded:|gateway\s+target:|source:\s*local\s+loopback|config:\s*\/home\/[^\s]+\/\.openclaw\/openclaw\.json|bind:\s*loopback)/i;
const REASONING_LOOP_LINE_RE = /(готовлю\s+ответ|анализирую\s+контекст|собираю\s+reasoning|формирую\s+финальный\s+текст|preparing\s+answer|analyzing\s+context|building\s+reasoning|forming\s+final\s+text)/i;

function stripGatewayDiagnosticLines(text = '') {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !GATEWAY_DIAGNOSTIC_LINE_RE.test(line))
    .join('\n')
    .trim();
}

function isGatewayFailureText(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return false;
  }

  return GATEWAY_FALLBACK_RE.test(normalized) || GATEWAY_FAILURE_RE.test(normalized);
}

function isReasoningLoopHintLine(text = '') {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return false;
  }

  return REASONING_LOOP_LINE_RE.test(normalized);
}

function scheduleGatewayRestartIfNeeded(requestId) {
  setTimeout(async () => {
    logger.info('[gateway-auto-restart] Gateway 1006 fallback detected — restarting in background...');
    emitOpenClawStream({
      requestId,
      phase: 'gateway-restart',
      message: 'Обнаружен сбой gateway (1006). Перезапускаю в фоне...',
    });
    try {
      if (openclawProcess) {
        try { openclawProcess.kill('SIGTERM'); } catch (_) {}
        openclawProcess = null;
        await delay(1500);
      }
      await startOpenClawGateway();
      logger.info('[gateway-auto-restart] Gateway restarted successfully.');
    } catch (err) {
      logger.warn('[gateway-auto-restart] Restart failed: ' + err.message);
    }
  }, 2000);
}

async function runOpenClawAgentTurn(payload = {}) {
  const request = typeof payload === 'string' ? { text: payload } : payload || {};
  const requestId = typeof request.requestId === 'string' && request.requestId.trim()
    ? request.requestId.trim()
    : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const text = String(request.text || request.message || '').trim();
  const agentId = typeof request.agentId === 'string' ? request.agentId.trim() : '';
  const requestedSessionId =
    typeof request.sessionId === 'string' && request.sessionId.trim()
      ? request.sessionId.trim()
      : DEFAULT_OPENCLAW_CHAT_SESSION_ID;
  let sessionId = requestedSessionId;
  const thinking = ['off', 'minimal', 'low', 'medium', 'high'].includes(String(request.thinking || '').toLowerCase())
    ? String(request.thinking).toLowerCase()
    : null;
  const timeoutSeconds = normalizeAgentTimeoutSeconds(request.timeoutSeconds, 120);

  if (!text) {
    throw new Error('Пустое сообщение');
  }

  emitOpenClawStream({
    requestId,
    phase: 'queued',
    message: 'Запрос получен и поставлен в обработку.',
  });

  let gatewayFallback = false;

  try {
    const attachmentContexts = await prepareAttachmentContexts(request.attachments);
    const messageForAgent = buildAttachmentPrompt(text, attachmentContexts).slice(0, 120000);

    let initialThinking = thinking || null;
    const hasAttachments = attachmentContexts.length > 0;
    const isHeavyAttachmentPrompt =
      messageForAgent.length >= 8000 ||
      attachmentContexts.length >= 2 ||
      attachmentContexts.some((attachment) => attachment.truncated || (attachment.preview && attachment.preview.length >= 12000));

    if (hasAttachments && isHeavyAttachmentPrompt && (initialThinking === 'medium' || initialThinking === 'high')) {
      initialThinking = 'minimal';
      emitOpenClawStream({
        requestId,
        phase: 'thinking-adjusted',
        message: `Большой запрос с вложениями: thinking ${thinking} -> minimal для стабильности.`,
      });
    }

    emitOpenClawStream({
      requestId,
      phase: 'context-prepared',
      message: `Контекст подготовлен. Вложений: ${attachmentContexts.length}`,
    });

    const forcedLocalFromRequest = request.localMode === true;
    const shouldPreferLocalByCooldown = Date.now() < openClawPreferLocalUntil;
    let usedLocalMode = forcedLocalFromRequest || shouldPreferLocalByCooldown;

    if (!usedLocalMode) {
      await ensureGatewayRunning();
      emitOpenClawStream({
        requestId,
        phase: 'gateway-ready',
        message: 'Gateway доступен. Отправляю запрос в модель.',
      });
    } else {
      emitOpenClawStream({
        requestId,
        phase: 'gateway-ready',
        message: 'Gateway нестабилен, выполняю запрос в local mode.',
      });
    }

    const commandTimeoutMs = Math.max(90000, (timeoutSeconds + 20) * 1000);
    const commandMaxTotalTimeoutMs = Math.min(900000, Math.max(180000, commandTimeoutMs + 90000));

    const buildAgentArgs = (resolvedAgentId, selectedThinking = thinking, useLocalMode = false, selectedSessionId = sessionId) => {
      const args = ['agent'];
      if (useLocalMode) {
        args.push('--local');
      }

      if (resolvedAgentId) {
        args.push('--agent', resolvedAgentId);
      }

      if (selectedThinking) {
        args.push('--thinking', selectedThinking);
      }

      args.push('--session-id', selectedSessionId, '--timeout', String(timeoutSeconds), '--message', messageForAgent, '--json');
      return args;
    };

    let streamChunks = 0;
    const emitChunk = (source, chunk) => {
      const cleaned = stripKnownCliNoise(chunk);
      if (!cleaned) return;

      let streamText = cleaned;
      if (source === 'stderr') {
        if (isGatewayFailureText(chunk) || isGatewayFailureText(cleaned)) {
          gatewayFallback = true;
        }

        streamText = stripGatewayDiagnosticLines(streamText);
        if (!streamText) {
          return;
        }
      }

      streamChunks += 1;
      emitOpenClawStream({
        requestId,
        phase: source === 'stdout' ? 'stdout' : 'stderr',
        source,
        chunk: streamText,
        streamedChunks: streamChunks,
      });
    };

    const runAgentCommand = (
      resolvedAgentId,
      selectedThinking = thinking,
      useLocalMode = false,
      selectedSessionId = sessionId
    ) => {
      const loopLineCounts = new Map();
      return runOpenClawCommand(buildAgentArgs(resolvedAgentId, selectedThinking, useLocalMode, selectedSessionId), {
        timeoutMs: commandTimeoutMs,
        maxTotalTimeoutMs: commandMaxTotalTimeoutMs,
        resetTimeoutOnActivity: true,
        onStdoutData: (chunk) => emitChunk('stdout', chunk),
        onStderrData: (chunk) => emitChunk('stderr', chunk),
        onStreamData: (source, chunk, stats) => {
          const normalizedChunk = stripKnownCliNoise(chunk);
          if (!normalizedChunk) {
            return null;
          }

          if (!useLocalMode && source === 'stderr' && isGatewayFailureText(normalizedChunk)) {
            return { terminate: true, reason: 'gateway-fallback-detected' };
          }

          if (stats.elapsedMs < 25000) {
            return null;
          }

          const lines = normalizedChunk
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

          for (const line of lines) {
            if (!isReasoningLoopHintLine(line)) {
              continue;
            }

            const key = line.toLowerCase();
            const nextCount = (loopLineCounts.get(key) || 0) + 1;
            loopLineCounts.set(key, nextCount);

            if (nextCount >= 8) {
              return { terminate: true, reason: 'reasoning-loop-detected' };
            }
          }

          return null;
        },
      });
    };

    let resolvedAgentId = agentId;
    let usedThinking = initialThinking;
    let result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
    let sessionRecoveredFrom = null;
    let sessionRecoveryAttempted = false;
    let fallbackToDefaultFromTransient = false;
    let transientSessionRetryAttempted = false;

    const maybeRetryWithRecoveredSession = async (currentResult) => {
      if (!currentResult || currentResult.code === 0 || sessionRecoveryAttempted) {
        return currentResult;
      }

      const failureText = currentResult.output || `${currentResult.stdout}\n${currentResult.stderr}`;
      if (!isSessionLockFailureText(failureText)) {
        return currentResult;
      }

      const previousSessionId = sessionId;
      const nextSessionId = buildRecoveredSessionId(previousSessionId);
      if (!nextSessionId || nextSessionId === previousSessionId) {
        return currentResult;
      }

      sessionRecoveryAttempted = true;
      sessionRecoveredFrom = previousSessionId;
      sessionId = nextSessionId;

      emitOpenClawStream({
        requestId,
        phase: 'session-retry',
        message: `Сессия ${previousSessionId} заблокирована. Повторяю запрос с новой сессией ${sessionId}.`,
      });

      return runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode, sessionId);
    };

    result = await maybeRetryWithRecoveredSession(result);

    if (result.code !== 0 && resolvedAgentId) {
      const failureText = result.output || `${result.stdout}\n${result.stderr}`;
      if (isUnknownAgentFailureText(failureText)) {
        emitOpenClawStream({
          requestId,
          phase: 'agent-fallback',
          message: `Агент "${resolvedAgentId}" не найден. Повторяю запрос с default agent.`,
        });

        resolvedAgentId = '';
        result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
        result = await maybeRetryWithRecoveredSession(result);
      }
    }

    if (result.code !== 0 && !usedLocalMode) {
      const failureText = result.output || `${result.stdout}\n${result.stderr}`;
      const hookReason = String(result.terminateReason || '').toLowerCase();
      const shouldRetryLocal =
        gatewayFallback ||
        isGatewayFailureText(failureText) ||
        hookReason === 'gateway-fallback-detected' ||
        hookReason === 'reasoning-loop-detected';

      if (shouldRetryLocal) {
        gatewayFallback = true;
        usedLocalMode = true;
        openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;

        if (hookReason === 'reasoning-loop-detected' && usedThinking && usedThinking !== 'off') {
          usedThinking = 'off';
        }

        emitOpenClawStream({
          requestId,
          phase: 'agent-fallback',
          message:
            hookReason === 'reasoning-loop-detected'
              ? 'Обнаружен цикл reasoning. Повторяю в local mode (thinking=off).'
              : 'Gateway нестабилен. Повторяю запрос в local mode.',
        });

        result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
        result = await maybeRetryWithRecoveredSession(result);
      }
    }

    if (result.code !== 0 && String(result.terminateReason || '').toLowerCase() === 'reasoning-loop-detected' && usedThinking && usedThinking !== 'off') {
      emitOpenClawStream({
        requestId,
        phase: 'timeout-retry',
        message: 'Обнаружен цикл reasoning. Повторяю с thinking=off.',
      });

      usedThinking = 'off';
      result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
      result = await maybeRetryWithRecoveredSession(result);
    }

    if (result.code !== 0 && result.timedOut && usedThinking && usedThinking !== 'off') {
      emitOpenClawStream({
        requestId,
        phase: 'timeout-retry',
        message: 'Запрос завис на reasoning. Повторяю с thinking=off.',
      });

      usedThinking = 'off';
      result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
      result = await maybeRetryWithRecoveredSession(result);
    }

    if (result.code !== 0 && result.timedOut && !usedThinking) {
      emitOpenClawStream({
        requestId,
        phase: 'timeout-retry',
        message: 'Запрос не завершился вовремя. Повторяю с thinking=off.',
      });

      usedThinking = 'off';
      result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
      result = await maybeRetryWithRecoveredSession(result);
    }

    for (let transientAttempt = 0; transientAttempt < 2 && result.code === 0; transientAttempt += 1) {
      const parsed = parseJsonFromText(result.stdout || result.output);
      const output = extractOpenClawText(parsed || result.stdout || result.output);
      const meta = extractOpenClawMeta(parsed || {});
      const transientPayloadFailure = detectTransientModelPayloadFailure(parsed || {}, output, meta);

      if (!transientPayloadFailure) {
        break;
      }

      const shouldRetryLocal = !usedLocalMode;
      const shouldRetryThinkingOff = usedLocalMode && usedThinking && usedThinking !== 'off';

      if (shouldRetryLocal || shouldRetryThinkingOff) {
        if (shouldRetryLocal) {
          gatewayFallback = true;
          usedLocalMode = true;
          openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;
        }

        if (usedThinking !== 'off') {
          usedThinking = 'off';
        }

        emitOpenClawStream({
          requestId,
          phase: 'timeout-retry',
          message:
            shouldRetryLocal
              ? `Модель вернула временную ошибку (${transientPayloadFailure}). Повторяю в local mode (thinking=off).`
              : `Модель вернула временную ошибку (${transientPayloadFailure}). Повторяю с thinking=off.`,
        });

        result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
        result = await maybeRetryWithRecoveredSession(result);
        continue;
      }

      if (!resolvedAgentId && !transientSessionRetryAttempted) {
        const previousSessionId = sessionId;
        const nextSessionId = buildRecoveredSessionId(previousSessionId);
        if (nextSessionId && nextSessionId !== previousSessionId) {
          transientSessionRetryAttempted = true;
          sessionRecoveredFrom = sessionRecoveredFrom || previousSessionId;
          sessionId = nextSessionId;

          gatewayFallback = true;
          usedLocalMode = true;
          openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;
          if (usedThinking !== 'off') {
            usedThinking = 'off';
          }

          emitOpenClawStream({
            requestId,
            phase: 'session-retry',
            message: `Сессия ${previousSessionId} вернула некорректный/неполный ответ (${transientPayloadFailure}). Повторяю с новой сессией ${sessionId}.`,
          });

          result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode, sessionId);
          result = await maybeRetryWithRecoveredSession(result);
          continue;
        }
      }

      if (resolvedAgentId && !fallbackToDefaultFromTransient) {
        const failedAgentId = resolvedAgentId;
        fallbackToDefaultFromTransient = true;
        gatewayFallback = true;
        usedLocalMode = true;
        openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;
        usedThinking = 'off';
        resolvedAgentId = '';

        emitOpenClawStream({
          requestId,
          phase: 'agent-fallback',
          message: `Агент ${failedAgentId} не вернул финальный ответ (${transientPayloadFailure}). Повторяю через default agent (local mode, thinking=off).`,
        });

        result = await runAgentCommand(resolvedAgentId, usedThinking, usedLocalMode);
        result = await maybeRetryWithRecoveredSession(result);
        continue;
      }

      emitOpenClawStream({
        requestId,
        phase: 'error',
        message: `Модель вернула ошибку: ${transientPayloadFailure}`,
      });
      throw new Error(`OpenClaw returned transient model failure payload: ${transientPayloadFailure}`);
    }

    if (result.code !== 0) {
      if (result.timedOut) {
        const timeoutHint = usedThinking && usedThinking !== 'off'
          ? 'Попробуйте уменьшить thinking до off/minimal или увеличить timeout.'
          : 'Попробуйте увеличить timeout или проверить доступность провайдера модели.';
        emitOpenClawStream({
          requestId,
          phase: 'error',
          message: `Таймаут выполнения запроса в OpenClaw. ${timeoutHint}`,
        });
        throw new Error(`OpenClaw call timed out in the desktop app. ${timeoutHint}`);
      }

      const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
      const exitState = result.code !== null && result.code !== undefined
        ? String(result.code)
        : result.signal
          ? `signal ${result.signal}`
          : 'unknown';
      emitOpenClawStream({
        requestId,
        phase: 'error',
        message: `Ошибка OpenClaw (${exitState}): ${details || 'unknown error'}`,
      });
      throw new Error(`OpenClaw call failed (${exitState}): ${details || 'unknown error'}`);
    }

    const parsed = parseJsonFromText(result.stdout || result.output);
    const output = extractOpenClawText(parsed || result.stdout || result.output);
    const reasoning = extractOpenClawReasoning(parsed || {});
    const meta = extractOpenClawMeta(parsed || {});

    emitOpenClawStream({
      requestId,
      phase: 'completed',
      message: 'Ответ полностью получен.',
      output,
      reasoning,
      meta,
      streamedChunks: streamChunks,
    });

    if (gatewayFallback) {
      openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;
      scheduleGatewayRestartIfNeeded(requestId);
    }

    return {
      success: true,
      requestId,
      output: output || 'Ответ получен, но не удалось извлечь текст.',
      reasoning,
      meta,
      requestedAgentId: agentId || null,
      agentIdUsed: resolvedAgentId || null,
      requestedSessionId: requestedSessionId || null,
      sessionIdUsed: sessionId || null,
      sessionRecoveredFrom,
      executionMode: usedLocalMode ? 'local' : 'gateway',
      thinkingUsed: usedThinking,
      fallbackToDefaultAgent: Boolean(agentId && !resolvedAgentId),
      attachments: attachmentContexts.map((attachment) => ({
        name: attachment.name,
        path: attachment.path,
        size: attachment.size,
        mime: attachment.mime,
        extracted: attachment.extraction,
        hasText: attachment.hasText,
        error: attachment.error || null,
      })),
      raw: parsed || result.stdout || result.output,
    };
  } catch (err) {
    emitOpenClawStream({
      requestId,
      phase: 'error',
      message: err.message || 'Неизвестная ошибка выполнения запроса.',
    });
    if (gatewayFallback) {
      openClawPreferLocalUntil = Date.now() + OPENCLAW_LOCAL_FALLBACK_COOLDOWN_MS;
      scheduleGatewayRestartIfNeeded(requestId);
    }
    throw err;
  }
}

function scoreRagChunk(queryTokens, chunk) {
  if (!queryTokens.length || !chunk || !Array.isArray(chunk.tokens)) {
    return 0;
  }

  const tokenSet = new Set(chunk.tokens);
  let score = 0;
  queryTokens.forEach((token) => {
    if (tokenSet.has(token)) {
      score += 2;
    } else if (typeof chunk.text === 'string' && chunk.text.toLowerCase().includes(token)) {
      score += 1;
    }
  });

  return score;
}

function getRagStatus(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  const store = ensureRagStoreLoaded({ workspaceKey: scopeKey });
  const collectionMap = new Map();
  store.documents.forEach((doc) => {
    const collection = normalizeCollectionName(doc.collection || 'default');
    const current = collectionMap.get(collection) || 0;
    collectionMap.set(collection, current + 1);
  });

  return {
    scopeKey,
    version: store.version,
    updatedAt: store.updatedAt,
    documentsCount: store.documents.length,
    chunksCount: store.chunks.length,
    collections: Array.from(collectionMap.entries())
      .map(([name, documents]) => ({ name, documents }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    documents: store.documents.map((doc) => ({
      id: doc.id,
      name: doc.name,
      collection: normalizeCollectionName(doc.collection || 'default'),
      path: doc.path,
      size: doc.size,
      chunks: doc.chunks,
      updatedAt: doc.updatedAt,
    })),
  };
}

async function indexFilesToRag(filePaths, options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  const store = ensureRagStoreLoaded({ workspaceKey: scopeKey });
  const sourceFiles = Array.isArray(filePaths) ? filePaths : options.files || [];
  const normalizedPaths = normalizeAttachmentPaths(sourceFiles);
  const collection = normalizeCollectionName(options.collection || 'default');

  if (!normalizedPaths.length) {
    return {
      indexed: 0,
      skipped: 0,
      errors: ['Нет файлов для индексации.'],
      status: getRagStatus({ workspaceKey: scopeKey }),
    };
  }

  let indexed = 0;
  let skipped = 0;
  const errors = [];

  for (const filePath of normalizedPaths) {
    try {
      const fileData = await readFileForContext(filePath, { maxChars: 250000 });
      const chunkTexts = splitTextToChunks(fileData.preview, RAG_CHUNK_SIZE, RAG_CHUNK_OVERLAP);
      if (!chunkTexts.length) {
        skipped += 1;
        errors.push(`${path.basename(filePath)}: текст не извлечён (${fileData.extraction || 'unknown'})`);
        continue;
      }

      const docKey = `${collection}::${path.resolve(filePath)}`;
      const docId = `doc_${Buffer.from(docKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`;
      store.documents = store.documents.filter((doc) => doc.id !== docId);
      store.chunks = store.chunks.filter((chunk) => chunk.docId !== docId);

      const nowIso = new Date().toISOString();
      const newChunks = chunkTexts.map((chunkText, index) => ({
        id: `${docId}_chunk_${index + 1}`,
        docId,
        collection,
        path: fileData.path,
        name: fileData.name,
        index,
        text: chunkText,
        tokens: Array.from(new Set(tokenizeRagText(chunkText))).slice(0, 300),
      }));

      store.documents.push({
        id: docId,
        name: fileData.name,
        collection,
        path: fileData.path,
        size: fileData.size,
        mime: fileData.mime,
        chunks: newChunks.length,
        updatedAt: nowIso,
      });
      store.chunks.push(...newChunks);
      indexed += 1;
    } catch (err) {
      errors.push(`${path.basename(filePath)}: ${err.message}`);
    }
  }

  saveRagStore({ workspaceKey: scopeKey });

  return {
    indexed,
    skipped,
    errors,
    status: getRagStatus({ workspaceKey: scopeKey }),
  };
}

function searchRag(query, options = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    return [];
  }

  const scopeKey = deriveRagScopeKey(options);
  const limit = Number.isInteger(Number(options.topK)) && Number(options.topK) > 0 ? Number(options.topK) : 5;
  const collection = normalizeCollectionName(options.collection || 'all');
  const store = ensureRagStoreLoaded({ workspaceKey: scopeKey });
  const queryTokens = Array.from(new Set(tokenizeRagText(cleanQuery))).slice(0, 60);

  return store.chunks
    .filter((chunk) => collection === 'all' || normalizeCollectionName(chunk.collection || 'default') === collection)
    .map((chunk) => ({
      ...chunk,
      score: scoreRagChunk(queryTokens, chunk),
    }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((chunk) => ({
      id: chunk.id,
      docId: chunk.docId,
      name: chunk.name,
      path: chunk.path,
      index: chunk.index,
      collection: normalizeCollectionName(chunk.collection || 'default'),
      score: chunk.score,
      snippet: chunk.text.slice(0, 600),
    }));
}

function buildRagPrompt(query, hits) {
  const intro = 'Ты отвечаешь строго на основе RAG-контекста. Если данных не хватает, явно скажи об этом.';
  const contextBlocks = hits.map(
    (hit, index) =>
      `[Источник ${index + 1}] ${hit.name} (chunk ${hit.index + 1}, score ${hit.score})\n${hit.snippet}`
  );

  return [
    intro,
    '',
    'Вопрос пользователя:',
    query,
    '',
    'RAG-контекст:',
    contextBlocks.join('\n\n---\n\n'),
    '',
    'Сформируй структурированный ответ: краткий вывод, подтверждения из источников, пробелы.',
  ].join('\n');
}

async function askWithRag(payload = {}) {
  const query = String(payload.query || '').trim();
  if (!query) {
    throw new Error('Пустой RAG-запрос.');
  }

  const scopeKey = deriveRagScopeKey(payload);
  const collection = normalizeCollectionName(payload.collection || 'all');

  const hits = searchRag(query, {
    topK: payload.topK || 5,
    collection,
    workspaceKey: scopeKey,
  });
  if (!hits.length) {
    return {
      success: true,
      answer: 'Не найдено релевантных фрагментов в RAG-индексе. Добавьте файлы, выберите корректную коллекцию и переиндексируйте.',
      hits: [],
      reasoning: [],
      meta: null,
      collection,
      scopeKey,
    };
  }

  const ragMessage = buildRagPrompt(query, hits);
  const result = await runOpenClawAgentTurn({
    text: ragMessage,
    sessionId: payload.sessionId || 'rag-studio-session',
    agentId: payload.agentId || '',
    thinking: payload.thinking || 'medium',
    timeoutSeconds: normalizeAgentTimeoutSeconds(payload.timeoutSeconds, 180),
    requestId: payload.requestId,
  });

  return {
    success: true,
    answer: result.output,
    hits,
    reasoning: result.reasoning,
    meta: result.meta,
    collection,
    scopeKey,
    raw: result.raw,
  };
}

async function exportRagIndex(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  const store = ensureRagStoreLoaded({ workspaceKey: scopeKey });
  const defaultName = `bratan-rag-export-${scopeKey}-${new Date().toISOString().slice(0, 10)}.json`;

  let destinationPath = typeof options.filePath === 'string' ? options.filePath.trim() : '';
  if (!destinationPath) {
    if (!dialog || typeof dialog.showSaveDialog !== 'function') {
      throw new Error('Save dialog API is unavailable.');
    }

    const saveResult = await dialog.showSaveDialog(mainWindow || undefined, {
      title: 'Экспорт RAG индекса',
      defaultPath: path.join(os.homedir(), defaultName),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    destinationPath = saveResult.filePath;
  }

  const payload = JSON.stringify(store, null, 2);
  fs.writeFileSync(destinationPath, payload, 'utf8');

  return {
    success: true,
    scopeKey,
    filePath: destinationPath,
    bytes: Buffer.byteLength(payload, 'utf8'),
    status: getRagStatus({ workspaceKey: scopeKey }),
  };
}

function mergeRagStores(baseStore, incomingStore) {
  const base = normalizeRagStorePayload(baseStore);
  const incoming = normalizeRagStorePayload(incomingStore);

  const docMap = new Map(base.documents.map((doc) => [doc.id, doc]));
  incoming.documents.forEach((doc) => {
    docMap.set(doc.id, doc);
  });

  const chunkMap = new Map(base.chunks.map((chunk) => [chunk.id, chunk]));
  incoming.chunks.forEach((chunk) => {
    chunkMap.set(chunk.id, chunk);
  });

  return {
    version: Math.max(base.version || RAG_STORE_VERSION, incoming.version || RAG_STORE_VERSION),
    updatedAt: new Date().toISOString(),
    documents: Array.from(docMap.values()),
    chunks: Array.from(chunkMap.values()),
  };
}

async function importRagIndex(options = {}) {
  const scopeKey = deriveRagScopeKey(options);
  let sourcePath = typeof options.filePath === 'string' ? options.filePath.trim() : '';
  if (!sourcePath) {
    if (!dialog || typeof dialog.showOpenDialog !== 'function') {
      throw new Error('Open dialog API is unavailable.');
    }

    const openResult = await dialog.showOpenDialog(mainWindow || undefined, {
      title: 'Импорт RAG индекса',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (openResult.canceled || !openResult.filePaths || !openResult.filePaths.length) {
      return { canceled: true };
    }

    sourcePath = openResult.filePaths[0];
  }

  const mode = String(options.mode || 'replace').toLowerCase() === 'merge' ? 'merge' : 'replace';
  const importedRaw = fs.readFileSync(sourcePath, 'utf8');
  const importedPayload = normalizeRagStorePayload(JSON.parse(importedRaw));

  const nextStore = mode === 'merge'
    ? mergeRagStores(ensureRagStoreLoaded({ workspaceKey: scopeKey }), importedPayload)
    : importedPayload;

  ragStoreCacheByScope.set(scopeKey, nextStore);
  saveRagStore({ workspaceKey: scopeKey });

  return {
    success: true,
    mode,
    scopeKey,
    filePath: sourcePath,
    status: getRagStatus({ workspaceKey: scopeKey }),
  };
}

let cachedWslOpenClawCommand = null;

function detectWslOpenClawCommand() {
  if (process.platform !== 'win32') {
    return null;
  }

  if (cachedWslOpenClawCommand) {
    return cachedWslOpenClawCommand;
  }

  const probes = [
    'command -v openclaw 2>/dev/null',
    '[ -x "$HOME/.local/bin/openclaw" ] && printf "%s" "$HOME/.local/bin/openclaw"',
    '[ -x "/usr/local/bin/openclaw" ] && printf "%s" "/usr/local/bin/openclaw"',
  ];

  for (const probe of probes) {
    try {
      const resolved = execFileSync('wsl', ['sh', '-lc', probe], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      if (!resolved) {
        continue;
      }

      cachedWslOpenClawCommand = `wsl ${resolved}`;
      return cachedWslOpenClawCommand;
    } catch {
      // try next probe
    }
  }

  return null;
}

function resolveOpenClawCommand(preferredCommand) {
  const envCmd =
    preferredCommand ||
    openClawRuntimeConfig.cliPath ||
    process.env.OPENCLAW_PATH ||
    process.env.OPENCLAW_CLI ||
    process.env.OPENCLAW ||
    DEFAULT_OPENCLAW_COMMAND;
  const candidates = [envCmd].filter(Boolean);

  if (process.platform === 'win32') {
    if (!candidates.includes('openclaw.exe')) candidates.push('openclaw.exe');
    if (!candidates.includes('openclaw')) candidates.push('openclaw');
  } else {
    if (!candidates.includes('openclaw')) candidates.push('openclaw');
  }

  const appExePath = app && typeof app.getPath === 'function' ? path.normalize(app.getPath('exe')).toLowerCase() : null;
  const appRootDir = __dirname ? path.normalize(__dirname).toLowerCase() : null;

  for (const candidate of candidates) {
    try {
      if (path.isAbsolute(candidate) && fs.existsSync(candidate)) {
        const cmp = path.normalize(candidate).toLowerCase();
        if (appExePath && cmp === appExePath) {
          // не используем UI-бинарник как CLI
          continue;
        }
        if (appRootDir && cmp.startsWith(appRootDir)) {
          // не запускаем бинарь из той же папки, где UI
          continue;
        }
        return candidate;
      }
    } catch {
      // continue
    }
  }

  const lookup = process.platform === 'win32' ? 'where' : 'which';
  for (const candidate of candidates) {
    const trimmedCandidate = String(candidate || '').trim();

    // Allow explicit WSL invocation (with args) as a command string directly.
    if (/^wsl(\.exe)?\s+/i.test(trimmedCandidate)) {
      return trimmedCandidate;
    }

    // If user specified Linux path directly in OpenCLAW_PATH on Windows, wrap through wsl.
    if (process.platform === 'win32' && path.isAbsolute(trimmedCandidate) && trimmedCandidate.startsWith('/')) {
      return `wsl ${trimmedCandidate}`;
    }

    try {
      const resolved = require('child_process')
        .execSync(`${lookup} ${trimmedCandidate}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .split(/\r?\n/)
        .find((p) => p && p.trim());

      if (resolved) {
        const resolvedNormalized = path.normalize(resolved.trim()).toLowerCase();
        if (appExePath && resolvedNormalized === appExePath) {
          continue;
        }
        if (appRootDir && resolvedNormalized.startsWith(appRootDir)) {
          continue;
        }
        return resolved.trim();
      }
    } catch (err) {
      logger.warn(`OpenClaw path lookup failed (${lookup} ${trimmedCandidate}): ${err.message}`);
      continue;
    }
  }

  if (process.platform === 'win32') {
    const wslCommand = detectWslOpenClawCommand();
    if (wslCommand) {
      logger.info(`OpenClaw resolved via WSL auto-detect: ${wslCommand}`);
      return wslCommand;
    }
  }

  // Не найден; возвращаем ошибку с подсказкой.
  throw new Error(
    `OpenClaw не найден. Установите openclaw и добавьте в PATH, или задайте OPENCLAW_PATH (например: wsl /home/<user>/.local/bin/openclaw). Попытки: ${candidates.join(', ')}`
  );
}

function prepareOpenClawExecution(baseCmd, subArgs = []) {
  const trimmed = (baseCmd || '').trim();
  if (!trimmed) {
    throw new Error('OpenClaw command пустой');
  }

  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g).map((p) => p.replace(/^"|"$/g, ''));
  if (!parts.length) {
    throw new Error('OpenClaw команда не может быть разобрана');
  }

  // WSL-style invocation: OPENCLAW_PATH='wsl openclaw'
  if (process.platform === 'win32' && /^(wsl|wsl\.exe)$/i.test(path.basename(parts[0]))) {
    const wslParts = parts.slice(1);
    const command = parts[0];
    const args = [...wslParts, ...subArgs];
    return { command, args };
  }

  // If on Windows and the user points to a Linux absolute path (WSL path), route through wsl
  if (process.platform === 'win32' && path.isAbsolute(parts[0]) && parts[0].startsWith('/')) {
    const command = 'wsl';
    const args = [parts[0], ...parts.slice(1), ...subArgs];
    return { command, args };
  }

  return { command: parts[0], args: [...parts.slice(1), ...subArgs] };
}

function getPreparedOpenClawCommand(cliPath) {
  return prepareOpenClawExecution(resolveOpenClawCommand(cliPath));
}

function getWslInvocationPrefix(cliPath) {
  if (process.platform !== 'win32') {
    return null;
  }

  let prepared;
  try {
    prepared = getPreparedOpenClawCommand(cliPath);
  } catch {
    return null;
  }

  if (!/^(wsl|wsl\.exe)$/i.test(path.basename(prepared.command))) {
    return null;
  }

  const firstLinuxArgIndex = prepared.args.findIndex((arg) => typeof arg === 'string' && arg.startsWith('/'));
  const prefixArgs = firstLinuxArgIndex >= 0 ? prepared.args.slice(0, firstLinuxArgIndex) : prepared.args.slice();
  return { command: prepared.command, args: prefixArgs };
}

function runWslShellCommand(shellCommand, cliPath) {
  const invocation = getWslInvocationPrefix(cliPath);
  if (!invocation) {
    return null;
  }

  try {
    return execFileSync(invocation.command, [...invocation.args, 'sh', '-lc', shellCommand], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    logger.warn(`WSL shell command failed: ${err.message}`);
    return null;
  }
}

function quoteForPosixShell(value) {
  return `'${String(value || '').replace(/'/g, `'"'"'`)}'`;
}

function normalizeWorkspacePathForUi(targetPath, cliPath) {
  const raw = String(targetPath || '').trim();
  if (!raw) {
    return '';
  }

  if (process.platform !== 'win32') {
    return raw;
  }

  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) {
    return raw;
  }

  if (!raw.startsWith('/')) {
    return raw;
  }

  const translated = runWslShellCommand(`wslpath -w ${quoteForPosixShell(raw)}`, cliPath);
  return translated || raw;
}

function normalizePathForComparison(targetPath) {
  return path.normalize(targetPath).replace(/\\+$/, '').toLowerCase();
}

function getWorkspaceRootPath() {
  const defaultWorkspace = path.join(os.homedir(), '.openclaw', 'workspace');
  if (process.platform !== 'win32') {
    return defaultWorkspace;
  }

  const wslWorkspace = runWslShellCommand('wslpath -w "$HOME/.openclaw/workspace"');
  return wslWorkspace || defaultWorkspace;
}

function resolveUserPath(filePath, options = {}) {
  const fallbackPath = String(options.fallbackPath || '').trim();
  const targetPath = String(filePath || '').trim() || fallbackPath;
  if (!targetPath) {
    throw new Error('Путь не указан.');
  }

  return { resolved: path.resolve(targetPath) };
}

function ensurePathInWorkspace(filePath) {
  const workspace = getWorkspaceRootPath();
  const resolved = path.resolve(filePath);
  const normalizedWorkspace = normalizePathForComparison(workspace);
  const normalizedResolved = normalizePathForComparison(resolved);

  if (normalizedResolved !== normalizedWorkspace && !normalizedResolved.startsWith(`${normalizedWorkspace}${path.sep.toLowerCase()}`)) {
    throw new Error('Доступ за пределами рабочего пространства запрещён.');
  }

  return { workspace, resolved };
}

function spawnOpenClaw(subArgs, options = {}) {
  const cmd = resolveOpenClawCommand(options.cliPath);
  const { command, args } = prepareOpenClawExecution(cmd, subArgs);
  return spawn(command, args, { shell: false, ...options.spawnOptions });
}

function runOpenClawCommand(subArgs, options = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnOpenClaw(['--no-color', ...subArgs], options);
    } catch (err) {
      reject(err);
      return;
    }

    let stdout = '';
    let stderr = '';
    let timeoutId = null;
    let timedOut = false;
    let terminatedByHook = false;
    let terminateReason = '';

    const startedAt = Date.now();
    const inactivityTimeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 0;
    const maxTotalTimeoutMs = Number(options.maxTotalTimeoutMs) > 0
      ? Number(options.maxTotalTimeoutMs)
      : inactivityTimeoutMs;
    const resetTimeoutOnActivity = options.resetTimeoutOnActivity !== false;

    const clearCommandTimeout = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const terminateCommand = (reason = '', asTimeout = false) => {
      if (timedOut || terminatedByHook) {
        return;
      }

      if (asTimeout) {
        timedOut = true;
      } else {
        terminatedByHook = true;
        terminateReason = String(reason || '').trim();
      }

      try {
        child.kill('SIGTERM');
      } catch {
        // ignore kill errors
      }
    };

    const terminateByTimeout = () => {
      terminateCommand('', true);
    };

    const applyStreamHook = (source, chunk) => {
      if (typeof options.onStreamData !== 'function' || !chunk) {
        return;
      }

      try {
        const hookResult = options.onStreamData(source, chunk, {
          startedAt,
          elapsedMs: Date.now() - startedAt,
          stdout,
          stderr,
        });

        if (hookResult && typeof hookResult === 'object' && hookResult.terminate) {
          terminateCommand(hookResult.reason || '', false);
        }
      } catch {
        // ignore stream hook errors
      }
    };

    const scheduleCommandTimeout = () => {
      if (!inactivityTimeoutMs || timedOut) {
        return;
      }

      clearCommandTimeout();

      if (maxTotalTimeoutMs > 0) {
        const elapsed = Date.now() - startedAt;
        const totalRemaining = maxTotalTimeoutMs - elapsed;
        if (totalRemaining <= 0) {
          terminateByTimeout();
          return;
        }

        timeoutId = setTimeout(terminateByTimeout, Math.min(inactivityTimeoutMs, totalRemaining));
        return;
      }

      timeoutId = setTimeout(terminateByTimeout, inactivityTimeoutMs);
    };

    scheduleCommandTimeout();

    if (typeof options.stdinText === 'string') {
      try {
        child.stdin.write(options.stdinText);
      } catch {
        // ignore stdin write errors
      }

      try {
        child.stdin.end();
      } catch {
        // ignore stdin close errors
      }
    }

    child.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
      if (resetTimeoutOnActivity) {
        scheduleCommandTimeout();
      }
      applyStreamHook('stdout', chunk);
      if (typeof options.onStdoutData === 'function') {
        try {
          options.onStdoutData(chunk);
        } catch {
          // ignore stream callback errors
        }
      }
    });
    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderr += chunk;
      if (resetTimeoutOnActivity) {
        scheduleCommandTimeout();
      }
      applyStreamHook('stderr', chunk);
      if (typeof options.onStderrData === 'function') {
        try {
          options.onStderrData(chunk);
        } catch {
          // ignore stream callback errors
        }
      }
    });

    child.on('error', (err) => {
      clearCommandTimeout();
      reject(err);
    });

    child.on('close', (code, signal) => {
      clearCommandTimeout();
      const cleanStdout = stripKnownCliNoise(stdout);
      const cleanStderr = stripKnownCliNoise(stderr);
      resolve({
        code,
        signal,
        timedOut,
        terminatedByHook,
        terminateReason,
        stdout: cleanStdout,
        stderr: cleanStderr,
        output: [cleanStdout, cleanStderr].filter(Boolean).join('\n').trim(),
      });
    });
  });
}

async function ensureGatewayRunning() {
  const status = await getGatewayStatus();
  if (status.running) {
    return status;
  }

  await startOpenClawGateway();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await delay(1500);
    const currentStatus = await getGatewayStatus();
    if (currentStatus.running) {
      return currentStatus;
    }
  }

  throw new Error('Gateway не запустился. Проверьте `openclaw gateway status` в WSL.');
}

function getGatewayStatus() {
  return runOpenClawCommand(['gateway', 'status'], { timeoutMs: 20000 })
    .then(({ code, stdout, stderr, output }) => {
      const normalizedOutput = stripKnownCliNoise(`${stdout}\n${stderr}`) || output;
      const lower = normalizedOutput.toLowerCase();
      const running =
        code === 0 &&
        ((lower.includes('runtime: running') || lower.includes('rpc probe: ok')) ||
          (lower.includes('running') && lower.includes('active')));
      return { code, running, output: normalizedOutput.trim() };
    })
    .catch(() => ({ code: 1, running: false, output: '' }));
}

async function startOpenClawGateway() {
  if (openclawProcess) {
    showNotification('OpenClaw Gateway уже запущен.');
    return { success: true, reason: 'already-running' };
  }

  let status;
  try {
    status = await getGatewayStatus();
  } catch (err) {
    showError('Ошибка Gateway', err.message);
    return { success: false, error: err.message };
  }

  if (status.running) {
    showNotification('OpenClaw Gateway уже запущен.');
    return { success: true, reason: 'already-running' };
  }

  showNotification('Запуск OpenClaw Gateway...');

  try {
    resolveOpenClawCommand();
  } catch (err) {
    showError('OpenClaw не найден', err.message);
    return { success: false, error: err.message };
  }

  openclawProcess = spawnOpenClaw(['gateway', 'start'], { spawnOptions: { stdio: 'pipe' } });

  openclawProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'stdout', message });
    logger.info('OpenClaw stdout: ' + message);
  });

  openclawProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'stderr', message });
    logger.error('OpenClaw stderr: ' + message);
  });

  openclawProcess.on('close', (code) => {
    showNotification(`OpenClaw Gateway завершён с кодом ${code}`);
    if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'close', code });
    openclawProcess = null;

    const pidFile = path.join(__dirname, 'gateway.pid');
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  });

  openclawProcess.on('error', (err) => {
    showNotification(`Ошибка запуска OpenClaw: ${err.message}`);
    if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'error', message: err.message });
    logger.error('OpenClaw spawn error: ' + err.stack);
    openclawProcess = null;
  });

  // Save PID to file for later use
  if (openclawProcess.pid) {
    fs.writeFileSync(path.join(__dirname, 'gateway.pid'), openclawProcess.pid.toString());
  }

  return { success: true, pid: openclawProcess ? openclawProcess.pid : null };
}

async function stopOpenClawGateway() {
  let status;
  try {
    status = await getGatewayStatus();
  } catch (err) {
    showError('Ошибка Gateway', err.message);
    return { success: false, error: err.message };
  }

  if (!status.running && !openclawProcess) {
    showNotification('OpenClaw Gateway не запущен.');
    return { success: false, reason: 'not-running' };
  }

  showNotification('Остановка OpenClaw Gateway...');

  // If we started process internally, prefer graceful kill
  if (openclawProcess && openclawProcess.pid) {
    try {
      openclawProcess.kill('SIGTERM');
      openclawProcess = null;
    } catch (err) {
      logger.warn('Failed to kill local process: ' + err.message);
    }
  }

  try {
    resolveOpenClawCommand();
  } catch (err) {
    showError('OpenClaw не найден', err.message);
    return { success: false, error: err.message };
  }

  const stop = spawnOpenClaw(['gateway', 'stop']);

  stop.on('close', (code) => {
    showNotification(`OpenClaw Gateway stop completed (code ${code})`);
    if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'info', message: 'gateway stop code ' + code });
  });

  // Remove PID file
  const pidFile = path.join(__dirname, 'gateway.pid');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }

  return { success: true };
}

async function checkGatewayStatus(options = {}) {
  let status;
  try {
    status = await getGatewayStatus();
  } catch (err) {
    showError('OpenClaw не найден', err.message);
    return { success: false, error: err.message };
  }

  const statusText = status.running ? 'Gateway запущен' : 'Gateway не запущен';
  if (!options.silent) {
    showNotification(`Статус OpenClaw Gateway: ${statusText}`);
  }
  if (mainWindow) mainWindow.webContents.send('openclaw-log', { type: 'status', message: statusText });
  return status;
}

function normalizeOpenClawSessions(payload) {
  if (!payload) return [];

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.sessions)) {
    return payload.sessions;
  }

  if (Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}

const OPENCLAW_AGENT_LIST_COMMAND_CANDIDATES = [
  ['agents', 'list', '--json'],
  ['agents', 'ls', '--json'],
  ['agent', 'list', '--json'],
  ['agent', 'ls', '--json'],
];

const OPENCLAW_SESSION_LIST_COMMAND_CANDIDATES = [
  ['sessions', 'list', '--json'],
  ['sessions', '--json'],
  ['session', 'list', '--json'],
];

const OPENCLAW_AGENT_CREATE_BASE_COMMANDS = [
  ['agents', 'add'],
  ['agents', 'create'],
  ['agent', 'create'],
];

function commandArgsEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildCommandCandidates(cachedCommand, defaults) {
  const candidates = [];

  if (Array.isArray(cachedCommand) && cachedCommand.length > 0) {
    candidates.push(cachedCommand);
  }

  defaults.forEach((command) => {
    if (!candidates.some((candidate) => commandArgsEqual(candidate, command))) {
      candidates.push(command);
    }
  });

  return candidates;
}

function normalizeAgentIdFromName(name) {
  const slug = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return slug || `agent-${Date.now().toString(36)}`;
}

function toText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOpenClawAgentRecord(agent, fallback = {}) {
  if (agent === null || agent === undefined) {
    return null;
  }

  if (typeof agent === 'string') {
    const agentId = toText(agent) || toText(fallback.agentId);
    if (!agentId) {
      return null;
    }

    const workspacePath = normalizeWorkspacePathForUi(
      toText(fallback.workspacePath) || toText(fallback.workspace),
      fallback.cliPath || null
    );

    return {
      agentId,
      name: toText(fallback.name) || agentId,
      description: toText(fallback.description),
      status: toText(fallback.status) || null,
      updatedAt: fallback.updatedAt || null,
      sessionCount: Number(fallback.sessionCount) || 0,
      workspacePath: workspacePath || null,
      source: toText(fallback.source) || 'runtime',
      raw: agent,
    };
  }

  if (typeof agent !== 'object') {
    return null;
  }

  const resolvedAgentId =
    toText(agent.agentId) ||
    toText(agent.id) ||
    toText(agent.slug) ||
    toText(agent.handle) ||
    toText(fallback.agentId) ||
    toText(agent.name) ||
    toText(fallback.name);

  if (!resolvedAgentId) {
    return null;
  }

  const resolvedName =
    toText(agent.name) ||
    toText(agent.title) ||
    toText(agent.displayName) ||
    toText(agent.alias) ||
    toText(fallback.name) ||
    resolvedAgentId;

  const resolvedDescription =
    toText(agent.description) ||
    toText(agent.task) ||
    toText(agent.prompt) ||
    toText(agent.goal) ||
    toText(agent.instructions) ||
    toText(fallback.description);

  const resolvedStatus =
    toText(agent.status) ||
    toText(agent.state) ||
    toText(agent.runtimeStatus) ||
    toText(fallback.status) ||
    null;

  const resolvedUpdatedAt =
    toText(agent.updatedAt) ||
    toText(agent.lastMessageAt) ||
    toText(agent.modifiedAt) ||
    toText(fallback.updatedAt) ||
    null;

  const sessionCount = Number.isFinite(Number(agent.sessionCount))
    ? Number(agent.sessionCount)
    : Number.isFinite(Number(fallback.sessionCount))
      ? Number(fallback.sessionCount)
      : 0;

  const resolvedWorkspacePath = normalizeWorkspacePathForUi(
    toText(agent.workspacePath) ||
      toText(agent.workspace) ||
      toText(agent.workingDirectory) ||
      toText(agent.workdir) ||
      toText(agent.cwd) ||
      toText(fallback.workspacePath) ||
      toText(fallback.workspace),
    fallback.cliPath || null
  );

  return {
    agentId: resolvedAgentId,
    name: resolvedName,
    description: resolvedDescription,
    status: resolvedStatus,
    updatedAt: resolvedUpdatedAt,
    sessionCount,
    workspacePath: resolvedWorkspacePath || null,
    source: toText(agent.source) || toText(fallback.source) || 'runtime',
    raw: agent,
  };
}

function normalizeOpenClawAgents(payload) {
  if (!payload) {
    return [];
  }

  let candidates = [];
  if (Array.isArray(payload)) {
    candidates = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.agents)) {
      candidates = payload.agents;
    } else if (Array.isArray(payload.items)) {
      candidates = payload.items;
    } else if (Array.isArray(payload.results)) {
      candidates = payload.results;
    } else if (Array.isArray(payload.data)) {
      candidates = payload.data;
    } else if (payload.result && Array.isArray(payload.result.agents)) {
      candidates = payload.result.agents;
    } else if (payload.result && Array.isArray(payload.result.items)) {
      candidates = payload.result.items;
    } else if (payload.result && typeof payload.result === 'object') {
      candidates = [payload.result];
    } else {
      candidates = [payload];
    }
  }

  const seen = new Set();
  const normalized = [];

  candidates.forEach((candidate) => {
    const item = normalizeOpenClawAgentRecord(candidate);
    if (!item || !item.agentId) {
      return;
    }

    const key = item.agentId.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push(item);
  });

  return normalized;
}

async function listOpenClawAgentsFromCli() {
  const candidates = buildCommandCandidates(openClawAgentListCommand, OPENCLAW_AGENT_LIST_COMMAND_CANDIDATES);

  for (const commandArgs of candidates) {
    try {
      const result = await runOpenClawCommand(commandArgs, { timeoutMs: 30000 });
      if (result.code !== 0) {
        continue;
      }

      const parsed = parseJsonFromText(result.stdout || result.output);
      const agents = normalizeOpenClawAgents(parsed).map((agent) => ({
        ...agent,
        source: agent.source || 'cli',
      }));

      openClawAgentListCommand = commandArgs.slice();
      return agents;
    } catch (err) {
      logger.warn(`Unable to list OpenClaw agents via ${commandArgs.join(' ')}: ${err.message}`);
    }
  }

  return [];
}

function mergeAgentRecord(current, next) {
  const collectSourceTokens = (value) => {
    return String(value || '')
      .split('+')
      .map((item) => item.trim())
      .filter(Boolean);
  };

  if (!current) {
    const initialSources = collectSourceTokens(next.source);
    return {
      ...next,
      source: initialSources[0] || next.source || 'runtime',
      sources: initialSources,
    };
  }

  const sourceSet = new Set(Array.isArray(current.sources) ? current.sources : []);
  collectSourceTokens(current.source).forEach((item) => sourceSet.add(item));
  collectSourceTokens(next.source).forEach((item) => sourceSet.add(item));

  const mergedSources = Array.from(sourceSet).sort();
  const currentSessionCount = Number(current.sessionCount) || 0;
  const nextSessionCount = Number(next.sessionCount) || 0;

  return {
    ...current,
    ...next,
    name: toText(next.name) || toText(current.name) || next.agentId || current.agentId,
    description: toText(next.description) || toText(current.description),
    status: toText(next.status) || toText(current.status) || null,
    updatedAt: toText(next.updatedAt) || toText(current.updatedAt) || null,
    workspacePath: toText(next.workspacePath) || toText(current.workspacePath) || null,
    sessionCount: Math.max(currentSessionCount, nextSessionCount),
    source: mergedSources[0] || next.source || current.source || 'runtime',
    sources: mergedSources,
  };
}

function buildOpenClawAgentWorkspacePath(agentId) {
  const suffix = normalizeAgentIdFromName(agentId || 'agent');
  const wslWorkspace = runWslShellCommand('printf "%s" "$HOME/.openclaw/workspace"');
  if (wslWorkspace) {
    return `${wslWorkspace.replace(/[\\/]+$/, '')}-${suffix}`;
  }

  const workspaceRoot = String(getWorkspaceRootPath() || '').replace(/[\\/]+$/, '');
  const rootBaseName = path.basename(workspaceRoot) || 'workspace';
  const rootDirName = path.dirname(workspaceRoot || process.cwd());
  return path.join(rootDirName, `${rootBaseName}-${suffix}`);
}

function buildAgentCreateCommandVariants(baseCommand, payload) {
  const { name, task, fallbackAgentId, workspacePath } = payload;
  const normalizedBase = Array.isArray(baseCommand)
    ? baseCommand.map((part) => String(part || '').toLowerCase())
    : [];

  let variants;
  if (normalizedBase.includes('add')) {
    variants = [
      [...baseCommand, name, '--json', '--non-interactive', '--workspace', workspacePath],
      [...baseCommand, fallbackAgentId, '--json', '--non-interactive', '--workspace', workspacePath],
    ];
  } else {
    variants = [
      [...baseCommand, '--name', name, '--task', task, '--workspace', workspacePath, '--json'],
      [...baseCommand, '--name', name, '--description', task, '--workspace', workspacePath, '--json'],
      [...baseCommand, '--id', fallbackAgentId, '--name', name, '--task', task, '--workspace', workspacePath, '--json'],
      [...baseCommand, '--agent-id', fallbackAgentId, '--name', name, '--task', task, '--workspace', workspacePath, '--json'],
      [...baseCommand, '--name', name, '--task', task, '--json'],
      [...baseCommand, '--name', name, '--description', task, '--json'],
      [...baseCommand, '--id', fallbackAgentId, '--name', name, '--task', task, '--json'],
      [...baseCommand, '--agent-id', fallbackAgentId, '--name', name, '--task', task, '--json'],
    ];
  }

  const seen = new Set();
  return variants.filter((variant) => {
    const key = variant.join('\u0000');
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function pickCreatedOpenClawAgent(payload, fallback) {
  if (!payload || typeof payload !== 'object') {
    return normalizeOpenClawAgentRecord(fallback, fallback);
  }

  const candidateNodes = [];
  if (payload.agent) {
    candidateNodes.push(payload.agent);
  }
  if (payload.item) {
    candidateNodes.push(payload.item);
  }
  if (payload.data) {
    candidateNodes.push(payload.data);
    if (payload.data.agent) {
      candidateNodes.push(payload.data.agent);
    }
  }
  if (payload.result) {
    candidateNodes.push(payload.result);
    if (payload.result.agent) {
      candidateNodes.push(payload.result.agent);
    }
  }
  candidateNodes.push(payload);

  for (const node of candidateNodes) {
    const normalized = normalizeOpenClawAgentRecord(node, fallback);
    if (normalized && normalized.agentId) {
      return normalized;
    }
  }

  return normalizeOpenClawAgentRecord(fallback, fallback);
}

async function createOpenClawAgent(payload = {}) {
  const name = toText(payload.name);
  const task = toText(payload.task);

  if (!name) {
    throw new Error('Укажите имя агента.');
  }
  if (!task) {
    throw new Error('Укажите задачу агента.');
  }

  const fallbackAgentId = normalizeAgentIdFromName(name);
  const workspacePath = buildOpenClawAgentWorkspacePath(fallbackAgentId);
  const workspacePathForUi = normalizeWorkspacePathForUi(workspacePath);
  const baseCommands = buildCommandCandidates(openClawAgentCreateCommand, OPENCLAW_AGENT_CREATE_BASE_COMMANDS);

  let lastFailure = '';

  for (const baseCommand of baseCommands) {
    const variants = buildAgentCreateCommandVariants(baseCommand, {
      name,
      task,
      fallbackAgentId,
      workspacePath,
    });

    for (const commandArgs of variants) {
      try {
        const result = await runOpenClawCommand(commandArgs, { timeoutMs: 30000 });
        if (result.code !== 0) {
          const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
          lastFailure = details || `Команда завершилась с кодом ${result.code}.`;
          continue;
        }

        const parsed = parseJsonFromText(result.stdout || result.output) || {};
        const createdAgent = pickCreatedOpenClawAgent(parsed, {
          agentId: fallbackAgentId,
          name,
          description: task,
          status: 'created',
          workspacePath: workspacePathForUi || workspacePath,
          source: 'cli-create',
        });

        openClawAgentCreateCommand = baseCommand.slice();
        return {
          success: true,
          agent: createdAgent,
          workspacePath: workspacePathForUi || workspacePath,
          command: commandArgs.join(' '),
        };
      } catch (err) {
        lastFailure = err.message || 'Неизвестная ошибка';
      }
    }
  }

  throw new Error(
    lastFailure
      ? `Не удалось создать агента через OpenClaw CLI: ${lastFailure}`
      : 'В этой версии OpenClaw CLI создание агента не поддерживается (ожидалась команда agents add/create).'
  );
}

async function deleteOpenClawAgent(payload = {}) {
  const agentId = toText(payload.agentId);
  if (!agentId) {
    throw new Error('Укажите ID агента.');
  }

  const result = await runOpenClawCommand(['agents', 'delete', agentId, '--force', '--json'], { timeoutMs: 30000 });
  if (result.code !== 0) {
    const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
    throw new Error(details || `Не удалось удалить агента (код ${result.code}).`);
  }

  return { success: true, agentId };
}

function extractAgentIdFromSessionsPath(sessionsPath) {
  const normalized = String(sessionsPath || '').replace(/\\/g, '/').trim();
  if (!normalized) {
    return '';
  }

  const match = normalized.match(/\/agents\/([^/]+)\/sessions\/sessions\.json$/i);
  return match ? String(match[1] || '').trim() : '';
}

async function listOpenClawSessions() {
  const candidates = buildCommandCandidates(openClawSessionListCommand, OPENCLAW_SESSION_LIST_COMMAND_CANDIDATES);

  for (const commandArgs of candidates) {
    try {
      const result = await runOpenClawCommand(commandArgs, { timeoutMs: 30000 });
      if (result.code !== 0) {
        continue;
      }

      const parsed = parseJsonFromText(result.stdout || result.output) || {};
      const sessions = normalizeOpenClawSessions(parsed);
      const rootWorkspacePath = normalizeWorkspacePathForUi(
        toText(parsed.workspacePath) || toText(parsed.workspace),
        null
      );
      const sessionsFilePath = toText(parsed.path);
      const fallbackAgentId = extractAgentIdFromSessionsPath(sessionsFilePath);

      const normalizedSessions = sessions.map((session, index) => {
        const sessionId =
          toText(session.sessionId) || toText(session.id) || toText(session.key) || `session-${index + 1}`;
        const agentId =
          toText(session.agentId) || toText(session.agent) || toText(session.agentName) || fallbackAgentId;
        const updatedAt = session.updatedAt || session.lastMessageAt || session.modifiedAt || null;
        const workspacePath = normalizeWorkspacePathForUi(
          toText(session.workspacePath) || toText(session.workspace) || rootWorkspacePath,
          null
        );

        return {
          sessionId,
          agentId,
          updatedAt,
          workspacePath: workspacePath || null,
          raw: session,
        };
      });

      openClawSessionListCommand = commandArgs.slice();
      return normalizedSessions;
    } catch (err) {
      logger.warn(`Unable to list OpenClaw sessions via ${commandArgs.join(' ')}: ${err.message}`);
    }
  }

  return [];
}

async function listOpenClawAgents() {
  const [sessions, cliAgents] = await Promise.all([listOpenClawSessions(), listOpenClawAgentsFromCli()]);
  const mergedAgents = new Map();

  cliAgents.forEach((agent) => {
    if (!agent || !agent.agentId) {
      return;
    }

    const key = agent.agentId.toLowerCase();
    mergedAgents.set(key, mergeAgentRecord(mergedAgents.get(key), agent));
  });

  sessions.forEach((session) => {
    const sessionAgentId = toText(session.agentId);
    if (!sessionAgentId) {
      return;
    }

    const key = sessionAgentId.toLowerCase();
    const current = mergedAgents.get(key);
    const next = normalizeOpenClawAgentRecord(
      {
        agentId: sessionAgentId,
        name: sessionAgentId,
        status: 'active',
        updatedAt: session.updatedAt,
        workspacePath: session.workspacePath,
        sessionCount: (Number(current && current.sessionCount) || 0) + 1,
        source: 'sessions',
      },
      {
        agentId: sessionAgentId,
      }
    );

    if (!next) {
      return;
    }

    mergedAgents.set(key, mergeAgentRecord(current, next));
  });

  return Array.from(mergedAgents.values()).sort((left, right) => {
    const sessionDelta = (Number(right.sessionCount) || 0) - (Number(left.sessionCount) || 0);
    if (sessionDelta !== 0) {
      return sessionDelta;
    }

    return left.agentId.localeCompare(right.agentId);
  });
}

async function getOpenClawVersionInfo() {
  const payload = {
    installedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    inProgress: openClawUpdateInProgress,
    channel: null,
  };

  try {
    const installed = await runOpenClawCommand(['--version'], { timeoutMs: 30000 });
    const rawInstalled = stripKnownCliNoise(installed.stdout || installed.output || installed.stderr);
    if (installed.code === 0) {
      payload.installedVersion = parseOpenClawVersionText(rawInstalled);
    }
  } catch (err) {
    logger.warn(`Unable to resolve installed OpenClaw version: ${err.message}`);
  }

  try {
    const statusResult = await runOpenClawCommand(['update', 'status', '--json'], { timeoutMs: 60000 });
    if (statusResult.code === 0) {
      const statusPayload = parseJsonFromText(statusResult.stdout || statusResult.output);
      const availability = statusPayload && statusPayload.availability ? statusPayload.availability : null;
      const registry = statusPayload && statusPayload.update && statusPayload.update.registry
        ? statusPayload.update.registry
        : null;

      payload.latestVersion = parseOpenClawVersionText(
        (availability && availability.latestVersion) || (registry && registry.latestVersion) || ''
      );
      payload.channel = statusPayload && statusPayload.channel ? statusPayload.channel.value || null : null;

      if (availability && typeof availability.available === 'boolean') {
        payload.updateAvailable = availability.available;
      }
    }
  } catch (err) {
    logger.warn(`Unable to resolve OpenClaw update status: ${err.message}`);
  }

  if (!payload.latestVersion && payload.installedVersion) {
    payload.latestVersion = payload.installedVersion;
  }

  if (!payload.updateAvailable && payload.installedVersion && payload.latestVersion) {
    payload.updateAvailable = payload.installedVersion !== payload.latestVersion;
  }

  return payload;
}

function normalizeOpenClawModelRecord(model, fallback = {}) {
  if (!model || typeof model !== 'object') {
    return null;
  }

  const key =
    toText(model.key) ||
    toText(model.model) ||
    toText(model.id) ||
    toText(fallback.key) ||
    toText(fallback.model);

  if (!key) {
    return null;
  }

  const rawContextWindow = Number(model.contextWindow ?? model.context_window ?? fallback.contextWindow);
  const contextWindow = Number.isFinite(rawContextWindow) && rawContextWindow > 0 ? Math.round(rawContextWindow) : null;

  const tagsSource = Array.isArray(model.tags) ? model.tags : Array.isArray(fallback.tags) ? fallback.tags : [];
  const tags = tagsSource
    .map((tag) => toText(tag))
    .filter(Boolean);

  return {
    key,
    name: toText(model.name) || key,
    input: toText(model.input) || null,
    contextWindow,
    available: model.available !== false,
    local: Boolean(model.local),
    missing: Boolean(model.missing),
    tags,
  };
}

async function listOpenClawModels() {
  const payload = {
    models: [],
    currentModel: null,
    resolvedModel: null,
    allowed: [],
  };

  try {
    const statusResult = await runOpenClawCommand(['models', 'status', '--json'], { timeoutMs: 30000 });
    if (statusResult.code === 0) {
      const statusPayload = parseJsonFromText(statusResult.stdout || statusResult.output) || {};
      payload.currentModel = toText(statusPayload.defaultModel) || null;
      payload.resolvedModel = toText(statusPayload.resolvedDefault) || payload.currentModel;
      payload.allowed = Array.isArray(statusPayload.allowed)
        ? statusPayload.allowed.map((entry) => toText(entry)).filter(Boolean)
        : [];
    }
  } catch (err) {
    logger.warn(`Unable to read OpenClaw models status: ${err.message}`);
  }

  try {
    const listResult = await runOpenClawCommand(['models', 'list', '--json'], { timeoutMs: 30000 });
    if (listResult.code !== 0) {
      const details = summarizeOpenClawFailure(listResult.output || `${listResult.stdout}\n${listResult.stderr}`);
      throw new Error(details || `openclaw models list exited with ${listResult.code}`);
    }

    const listPayload = parseJsonFromText(listResult.stdout || listResult.output) || {};
    const modelRows = Array.isArray(listPayload.models) ? listPayload.models : Array.isArray(listPayload.items) ? listPayload.items : [];
    const byKey = new Map();

    modelRows.forEach((row) => {
      const normalized = normalizeOpenClawModelRecord(row);
      if (!normalized) {
        return;
      }

      const key = normalized.key.toLowerCase();
      byKey.set(key, normalized);
    });

    payload.allowed.forEach((allowedModel) => {
      const key = allowedModel.toLowerCase();
      if (byKey.has(key)) {
        return;
      }

      byKey.set(
        key,
        normalizeOpenClawModelRecord(
          {
            key: allowedModel,
            name: allowedModel,
            available: true,
          },
          { key: allowedModel }
        )
      );
    });

    payload.models = Array.from(byKey.values())
      .map((entry) => ({
        ...entry,
        allowed: payload.allowed.length ? payload.allowed.includes(entry.key) : true,
        selected: entry.key === payload.currentModel || entry.key === payload.resolvedModel,
      }))
      .sort((left, right) => {
        const leftSelected = left.selected ? 1 : 0;
        const rightSelected = right.selected ? 1 : 0;
        if (leftSelected !== rightSelected) {
          return rightSelected - leftSelected;
        }

        const leftAvailable = left.available ? 1 : 0;
        const rightAvailable = right.available ? 1 : 0;
        if (leftAvailable !== rightAvailable) {
          return rightAvailable - leftAvailable;
        }

        return left.key.localeCompare(right.key);
      });
  } catch (err) {
    throw new Error(`Не удалось получить список моделей OpenClaw: ${err.message}`);
  }

  if (!payload.resolvedModel && payload.models.length) {
    payload.resolvedModel = payload.models[0].key;
  }
  if (!payload.currentModel && payload.resolvedModel) {
    payload.currentModel = payload.resolvedModel;
  }

  return payload;
}

async function setOpenClawDefaultModel(payload = {}) {
  const model = toText(payload.model || payload.key);
  if (!model) {
    throw new Error('Укажите модель OpenClaw.');
  }

  const result = await runOpenClawCommand(['models', 'set', model], { timeoutMs: 45000 });
  if (result.code !== 0) {
    const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
    throw new Error(details || `Не удалось переключить модель (код ${result.code}).`);
  }

  const state = await listOpenClawModels();
  return {
    success: true,
    model,
    ...state,
  };
}

function getOpenClawProviderFromModelKey(modelKey = '') {
  const normalized = toText(modelKey);
  if (!normalized) {
    return '';
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0) {
    return '';
  }

  return normalized.slice(0, slashIndex);
}

function normalizeProviderTestTimeoutSeconds(value, fallback = 45) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(180, Math.max(15, Math.round(parsed)));
}

async function getOpenClawModelIntegrationsStatus() {
  const modelState = await listOpenClawModels();

  const statusResult = await runOpenClawCommand(['models', 'status', '--json'], { timeoutMs: 30000 });
  if (statusResult.code !== 0) {
    const details = summarizeOpenClawFailure(statusResult.output || `${statusResult.stdout}\n${statusResult.stderr}`);
    throw new Error(details || `Не удалось получить статус моделей (код ${statusResult.code}).`);
  }

  const statusPayload = parseJsonFromText(statusResult.stdout || statusResult.output) || {};
  const authPayload = statusPayload.auth && typeof statusPayload.auth === 'object' ? statusPayload.auth : {};
  const providerRows = Array.isArray(authPayload.providers) ? authPayload.providers : [];

  const modelsByProvider = new Map();
  (Array.isArray(modelState.models) ? modelState.models : []).forEach((model) => {
    const provider = getOpenClawProviderFromModelKey(model.key);
    if (!provider) {
      return;
    }

    const current = modelsByProvider.get(provider) || [];
    current.push({
      key: model.key,
      name: model.name,
      contextWindow: model.contextWindow,
      available: model.available,
      selected: model.selected,
    });
    modelsByProvider.set(provider, current);
  });

  const providerMap = new Map();

  providerRows.forEach((row) => {
    const provider = toText(row && row.provider);
    if (!provider) {
      return;
    }

    const profiles = row && row.profiles && typeof row.profiles === 'object' ? row.profiles : {};
    const modelsJson = row && row.modelsJson && typeof row.modelsJson === 'object' ? row.modelsJson : {};
    const effective = row && row.effective && typeof row.effective === 'object' ? row.effective : {};
    const profileLabels = Array.isArray(profiles.labels) ? profiles.labels.map((value) => toText(value)).filter(Boolean) : [];
    const modelCandidates = modelsByProvider.get(provider) || [];

    const hasAuth =
      Number(profiles.count || 0) > 0 ||
      Boolean(toText(modelsJson.value)) ||
      ['profiles', 'models.json', 'env'].includes(toText(effective.kind).toLowerCase());

    providerMap.set(provider.toLowerCase(), {
      provider,
      hasAuth,
      authKind: toText(effective.kind) || 'unknown',
      authDetail: toText(effective.detail),
      profilesCount: Number(profiles.count || 0),
      labels: profileLabels,
      oauthStatus:
        toText(
          (Array.isArray(authPayload.oauth?.providers)
            ? authPayload.oauth.providers.find((item) => toText(item?.provider) === provider)?.status
            : '') || ''
        ) || 'unknown',
      models: modelCandidates,
      selectedModel: modelCandidates.find((item) => item.selected)?.key || null,
      status: hasAuth ? 'configured' : 'missing-auth',
    });
  });

  modelsByProvider.forEach((modelCandidates, provider) => {
    const key = provider.toLowerCase();
    if (providerMap.has(key)) {
      return;
    }

    providerMap.set(key, {
      provider,
      hasAuth: false,
      authKind: 'unknown',
      authDetail: '',
      profilesCount: 0,
      labels: [],
      oauthStatus: 'unknown',
      models: modelCandidates,
      selectedModel: modelCandidates.find((item) => item.selected)?.key || null,
      status: 'unknown',
    });
  });

  return {
    currentModel: modelState.currentModel,
    resolvedModel: modelState.resolvedModel,
    providers: Array.from(providerMap.values()).sort((left, right) => left.provider.localeCompare(right.provider)),
    models: modelState.models,
  };
}

function maskSecretValue(value = '') {
  const source = String(value || '').trim();
  if (!source) {
    return '';
  }

  if (source.length <= 8) {
    return '*'.repeat(source.length);
  }

  return `${source.slice(0, 4)}...${source.slice(-4)}`;
}

function toHostFilesystemPathFromCliPath(targetPath) {
  const raw = toText(targetPath);
  if (!raw) {
    return '';
  }

  if (process.platform !== 'win32') {
    return raw;
  }

  if (!raw.startsWith('/')) {
    return raw;
  }

  const escaped = raw.replace(/'/g, `'"'"'`);
  const converted = runWslShellCommand(`wslpath -w '${escaped}'`);
  return converted || raw;
}

function readJsonFileIfExists(filePath) {
  const resolvedPath = toText(filePath);
  if (!resolvedPath) {
    return null;
  }

  try {
    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const raw = fs.readFileSync(resolvedPath, 'utf8');
    if (!raw || !raw.trim()) {
      return null;
    }

    return JSON.parse(raw);
  } catch (err) {
    logger.warn(`Unable to read JSON file ${resolvedPath}: ${err.message}`);
    return null;
  }
}

function getProfilesFromAuthStore(payload) {
  const profilesNode = payload && typeof payload === 'object' ? payload.profiles : null;
  if (!profilesNode) {
    return [];
  }

  if (Array.isArray(profilesNode)) {
    return profilesNode.filter((profile) => profile && typeof profile === 'object');
  }

  if (profilesNode && typeof profilesNode === 'object') {
    return Object.entries(profilesNode)
      .filter((entry) => entry && entry[1] && typeof entry[1] === 'object')
      .map(([profileId, profile]) => ({
        profileId,
        ...profile,
      }));
  }

  return [];
}

function pickProviderCredentialFromAuthStore(payload, provider) {
  const providerId = toText(provider).toLowerCase();
  if (!providerId) {
    return '';
  }

  const profiles = getProfilesFromAuthStore(payload);
  for (const profile of profiles) {
    if (toText(profile.provider).toLowerCase() !== providerId) {
      continue;
    }

    const candidates = [profile.token, profile.key, profile.apiKey, profile.api_key];
    const secret = candidates
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find(Boolean);

    if (secret) {
      return secret;
    }
  }

  return '';
}

function pickProviderCredentialFromModelsConfig(payload, provider) {
  const providerId = toText(provider).toLowerCase();
  if (!providerId || !payload || typeof payload !== 'object') {
    return '';
  }

  const providersNode = payload.providers && typeof payload.providers === 'object' ? payload.providers : {};
  const providerEntry = Object.entries(providersNode)
    .find(([name]) => toText(name).toLowerCase() === providerId);

  if (!providerEntry || !providerEntry[1] || typeof providerEntry[1] !== 'object') {
    return '';
  }

  const providerConfig = providerEntry[1];
  const candidates = [providerConfig.apiKey, providerConfig.api_key, providerConfig.token, providerConfig.key];
  const secret = candidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  return secret || '';
}

async function getOpenClawModelProviderToken(payload = {}) {
  const provider = toText(payload.provider).toLowerCase();
  if (!provider) {
    throw new Error('Укажите provider для чтения ключа.');
  }

  const statusResult = await runOpenClawCommand(['models', 'status', '--json'], { timeoutMs: 30000 });
  if (statusResult.code !== 0) {
    const details = summarizeOpenClawFailure(statusResult.output || `${statusResult.stdout}\n${statusResult.stderr}`);
    throw new Error(details || 'Не удалось получить статус моделей для чтения ключа.');
  }

  const statusPayload = parseJsonFromText(statusResult.stdout || statusResult.output) || {};
  let credential = '';
  let source = '';

  const authStorePath = toHostFilesystemPathFromCliPath(toText(statusPayload?.auth?.storePath));
  if (authStorePath) {
    const authStorePayload = readJsonFileIfExists(authStorePath);
    credential = pickProviderCredentialFromAuthStore(authStorePayload, provider);
    if (credential) {
      source = 'auth-profiles';
    }
  }

  if (!credential) {
    const statusAgentDir = toText(statusPayload.agentDir);
    const fallbackAgentDir =
      process.platform === 'win32'
        ? runWslShellCommand('printf "%s" "$HOME/.openclaw/agents/main/agent"')
        : path.join(os.homedir(), '.openclaw', 'agents', 'main', 'agent');
    const agentDir = statusAgentDir || fallbackAgentDir || '';
    const modelsPath = agentDir ? `${agentDir.replace(/[\\/]+$/, '')}/models.json` : '';
    const hostModelsPath = toHostFilesystemPathFromCliPath(modelsPath);
    if (hostModelsPath) {
      const modelsPayload = readJsonFileIfExists(hostModelsPath);
      credential = pickProviderCredentialFromModelsConfig(modelsPayload, provider);
      if (credential) {
        source = 'models.json';
      }
    }
  }

  return {
    success: true,
    provider,
    hasToken: Boolean(credential),
    token: credential,
    masked: maskSecretValue(credential),
    source: source || null,
  };
}

async function setOpenClawModelProviderToken(payload = {}) {
  const provider = toText(payload.provider);
  const token = typeof payload.token === 'string' ? payload.token.trim() : '';
  const profileId = toText(payload.profileId) || `${provider}:manual`;
  const expiresIn = toText(payload.expiresIn);

  if (!provider) {
    throw new Error('Укажите provider для сохранения ключа.');
  }
  if (!token) {
    throw new Error('Введите ключ доступа.');
  }

  const args = ['models', 'auth', 'paste-token', '--provider', provider, '--profile-id', profileId];
  if (expiresIn) {
    args.push('--expires-in', expiresIn);
  }

  const result = await runOpenClawCommand(args, {
    timeoutMs: 45000,
    maxTotalTimeoutMs: 120000,
    stdinText: `${token}\n`,
  });

  if (result.code !== 0) {
    const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
    throw new Error(details || `Не удалось сохранить ключ (код ${result.code}).`);
  }

  const status = await getOpenClawModelIntegrationsStatus();
  return {
    success: true,
    provider,
    profileId,
    ...status,
  };
}

async function testOpenClawModelIntegration(payload = {}) {
  const requestedProvider = toText(payload.provider);
  const requestedModel = toText(payload.model);
  const testMessage = toText(payload.message) || 'Reply exactly: OK';
  const timeoutSeconds = normalizeProviderTestTimeoutSeconds(payload.timeoutSeconds, 30);

  const modelState = await listOpenClawModels();
  const availableModels = Array.isArray(modelState.models) ? modelState.models : [];
  const targetModel =
    requestedModel ||
    (requestedProvider
      ? (availableModels.find((item) => getOpenClawProviderFromModelKey(item.key) === requestedProvider && item.available !== false)?.key || '')
      : '') ||
    modelState.resolvedModel ||
    modelState.currentModel ||
    '';

  if (!targetModel) {
    throw new Error('Не удалось определить модель для теста.');
  }

  const originalModel = modelState.currentModel || modelState.resolvedModel || '';
  let switched = false;
  let restored = false;
  let restoreError = null;
  const startedAt = Date.now();

  let alive = false;
  let error = '';
  let responsePreview = '';
  let modeUsed = '';
  let warning = '';
  let canonicalReply = false;
  const probeErrors = [];

  const evaluateHealthProbeResult = (result) => {
    const parsed = parseJsonFromText(result.stdout || result.output);
    const output = extractOpenClawText(parsed || result.stdout || result.output);
    const normalizedOutput = String(output || '').trim();
    const parsedError = toText(parsed?.error || parsed?.meta?.error || parsed?.meta?.agentMeta?.error);
    const stopReason = toText(parsed?.meta?.stopReason);
    const aborted = Boolean(parsed?.meta?.aborted);

    const failureCandidate = [normalizedOutput, parsedError, stopReason]
      .map((value) => toText(value))
      .find((value) => value && isTransientModelFailureText(value));

    let failureText = '';
    if (failureCandidate) {
      failureText = summarizeOpenClawFailure(failureCandidate) || failureCandidate;
    } else if (aborted) {
      failureText = 'Запрос прерван до получения ответа.';
    } else if (!normalizedOutput) {
      failureText = 'Пустой ответ от модели.';
    }

    return {
      parsed,
      normalizedOutput,
      failureText,
    };
  };

  const runHealthProbe = async (useLocalMode) => {
    const sessionPrefix = useLocalMode ? 'local' : 'gateway';
    const args = ['agent'];
    if (useLocalMode) {
      args.push('--local');
    }

    args.push(
      '--session-id',
      `desktop-model-health-${sessionPrefix}-${Date.now()}`,
      '--thinking',
      'off',
      '--timeout',
      String(timeoutSeconds),
      '--message',
      testMessage,
      '--json'
    );

    return runOpenClawCommand(args, {
      timeoutMs: Math.max(60000, (timeoutSeconds + 10) * 1000),
      maxTotalTimeoutMs: Math.max(120000, (timeoutSeconds + 25) * 1000),
      resetTimeoutOnActivity: true,
    });
  };

  try {
    if (originalModel && originalModel !== targetModel) {
      const switchResult = await runOpenClawCommand(['models', 'set', targetModel], { timeoutMs: 45000 });
      if (switchResult.code !== 0) {
        const details = summarizeOpenClawFailure(switchResult.output || `${switchResult.stdout}\n${switchResult.stderr}`);
        throw new Error(details || `Не удалось переключить модель на ${targetModel}.`);
      }
      switched = true;
    }

    let successfulProbe = null;
    const probeModes = [
      { name: 'local', useLocalMode: true },
      { name: 'gateway', useLocalMode: false },
    ];

    for (const probe of probeModes) {
      try {
        const result = await runHealthProbe(probe.useLocalMode);
        if (result.code !== 0) {
          const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
          probeErrors.push(`${probe.name}: ${details || `код ${result.code}`}`);
          continue;
        }

        const outcome = evaluateHealthProbeResult(result);
        if (outcome.failureText) {
          probeErrors.push(`${probe.name}: ${outcome.failureText}`);
          continue;
        }

        successfulProbe = { probe, result, outcome };
        modeUsed = probe.name;
        break;
      } catch (probeErr) {
        probeErrors.push(`${probe.name}: ${probeErr.message || 'неизвестная ошибка'}`);
      }
    }

    if (!successfulProbe) {
      error = probeErrors.join(' | ') || 'Тест модели завершился ошибкой.';
    } else {
      const normalizedOutput = successfulProbe.outcome.normalizedOutput;
      responsePreview = normalizedOutput.slice(0, 500);
      canonicalReply = /^ok[.!]?$/i.test(normalizedOutput);
      if (!canonicalReply && normalizedOutput) {
        warning = 'Нестандартный тестовый ответ (ожидалось "OK"), но провайдер доступен.';
      }
      alive = true;
    }
  } catch (err) {
    error = err.message || 'Неизвестная ошибка тестового запроса.';
  } finally {
    if (switched && originalModel && originalModel !== targetModel) {
      try {
        const restoreResult = await runOpenClawCommand(['models', 'set', originalModel], { timeoutMs: 45000 });
        restored = restoreResult.code === 0;
        if (!restored) {
          restoreError = summarizeOpenClawFailure(restoreResult.output || `${restoreResult.stdout}\n${restoreResult.stderr}`) || 'Не удалось вернуть исходную модель.';
        }
      } catch (restoreErr) {
        restored = false;
        restoreError = restoreErr.message || 'Не удалось вернуть исходную модель.';
      }
    } else {
      restored = true;
    }
  }

  return {
    success: alive,
    alive,
    provider: requestedProvider || getOpenClawProviderFromModelKey(targetModel),
    model: targetModel,
    timeoutSeconds,
    switched,
    restored,
    restoreError,
    modeUsed,
    canonicalReply,
    warning,
    probeErrors,
    latencyMs: Date.now() - startedAt,
    responsePreview,
    error,
  };
}

async function runOpenClawUpdate(options = {}) {
  if (openClawUpdateInProgress) {
    throw new Error('Обновление OpenClaw уже выполняется.');
  }

  const request = options && typeof options === 'object' ? options : {};
  const dryRun = Boolean(request.dryRun);
  const restart = request.restart !== false;
  const timeoutSeconds = Number.isInteger(Number(request.timeoutSeconds)) && Number(request.timeoutSeconds) > 0
    ? Math.min(1800, Number(request.timeoutSeconds))
    : 1200;
  const requestedChannel = ['stable', 'beta', 'dev'].includes(String(request.channel || '').toLowerCase())
    ? String(request.channel).toLowerCase()
    : null;

  const args = ['update', '--json', '--yes', '--timeout', String(timeoutSeconds)];
  if (dryRun) {
    args.push('--dry-run');
  }
  if (!restart) {
    args.push('--no-restart');
  }
  if (requestedChannel) {
    args.push('--channel', requestedChannel);
  }

  openClawUpdateInProgress = true;
  try {
    const result = await runOpenClawCommand(args, {
      timeoutMs: Math.max(180000, (timeoutSeconds + 60) * 1000),
    });

    if (result.code !== 0) {
      const details = summarizeOpenClawFailure(result.output || `${result.stdout}\n${result.stderr}`);
      throw new Error(details || 'Не удалось выполнить обновление OpenClaw');
    }

    const parsed = parseJsonFromText(result.stdout || result.output) || {};
    return {
      success: true,
      dryRun,
      currentVersion: parseOpenClawVersionText(parsed.currentVersion || ''),
      targetVersion: parseOpenClawVersionText(parsed.targetVersion || ''),
      effectiveChannel: parsed.effectiveChannel || requestedChannel || null,
      restart: !parsed.dryRun && restart,
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    };
  } finally {
    openClawUpdateInProgress = false;
  }
}

function showNotification(message) {
  new Notification({
    title: 'Братан Desktop',
    body: message,
  }).show();
}

if (ipcMain && typeof ipcMain.handle === 'function') {
  const safeHandle = (channel, handler) => {
    if (ipcMain.removeHandler && typeof ipcMain.removeHandler === 'function') {
      ipcMain.removeHandler(channel);
    }
    ipcMain.handle(channel, handler);
  };

  safeHandle('show-notification', (event, { title, body }) => {
    new Notification({
      title: title || 'Братан Desktop',
      body: body || '',
    }).show();
  });

  // IPC handlers
  safeHandle('openclaw-start', () => startOpenClawGateway());
  safeHandle('openclaw-stop', () => stopOpenClawGateway());
  safeHandle('openclaw-status', (event, options) => checkGatewayStatus(options || {}));
  safeHandle('openclaw-configure', (event, config) => updateOpenClawRuntimeConfig(config));
  safeHandle('openclaw-version-info', async () => getOpenClawVersionInfo());
  safeHandle('openclaw-models-list', async () => listOpenClawModels());
  safeHandle('openclaw-models-set', async (event, payload) => setOpenClawDefaultModel(payload || {}));
  safeHandle('openclaw-model-integrations-status', async () => getOpenClawModelIntegrationsStatus());
  safeHandle('openclaw-model-integrations-get-token', async (event, payload) => getOpenClawModelProviderToken(payload || {}));
  safeHandle('openclaw-model-integrations-set-token', async (event, payload) => setOpenClawModelProviderToken(payload || {}));
  safeHandle('openclaw-model-integrations-test', async (event, payload) => testOpenClawModelIntegration(payload || {}));
  safeHandle('openclaw-update', async (event, options) => runOpenClawUpdate(options || {}));

  safeHandle('openclaw-send-message', async (event, payload) => runOpenClawAgentTurn(payload));

  safeHandle('openclaw-pick-files', async (event, options) => {
    return pickFilesFromDialog({
      title: 'Выберите файлы для отправки в чат',
      multi: true,
      ...(options || {}),
    });
  });

  safeHandle('openclaw-create-agent', async (event, payload) => {
    return createOpenClawAgent(payload || {});
  });

  safeHandle('openclaw-delete-agent', async (event, payload) => {
    return deleteOpenClawAgent(payload || {});
  });

  safeHandle('openclaw-list-sessions', async () => {
    const sessions = await listOpenClawSessions();
    return { sessions };
  });

  safeHandle('openclaw-list-agents', async () => {
    const agents = await listOpenClawAgents();
    return { agents };
  });

  safeHandle('openclaw-get-messages', async () => {
    return { messages: [] };
  });

  safeHandle('rag-pick-files', async (event, options) => {
    return pickFilesFromDialog({
      title: 'Выберите файлы для RAG индекса',
      multi: true,
      ...(options || {}),
    });
  });

  safeHandle('rag-index-files', async (event, payload) => {
    const request = payload || {};
    return indexFilesToRag(request.files || [], {
      collection: request.collection,
      workspaceKey: request.workspaceKey,
      workspacePath: request.workspacePath,
    });
  });

  safeHandle('rag-status', async (event, payload) => {
    const request = payload || {};
    return getRagStatus({
      workspaceKey: request.workspaceKey,
      workspacePath: request.workspacePath,
    });
  });

  safeHandle('rag-search', async (event, payload) => {
    const request = payload || {};
    const query = String(request.query || '').trim();
    const topK = request.topK || 5;
    const collection = request.collection || 'all';
    return {
      query,
      collection,
      hits: searchRag(query, {
        topK,
        collection,
        workspaceKey: request.workspaceKey,
        workspacePath: request.workspacePath,
      }),
    };
  });

  safeHandle('rag-ask', async (event, payload) => {
    return askWithRag(payload || {});
  });

  safeHandle('rag-clear', async (event, payload) => {
    const request = payload || {};
    const scopeKey = deriveRagScopeKey(request);
    ragStoreCacheByScope.set(scopeKey, createEmptyRagStore());
    saveRagStore({ workspaceKey: scopeKey });
    return getRagStatus({ workspaceKey: scopeKey });
  });

  safeHandle('rag-export', async (event, payload) => {
    return exportRagIndex(payload || {});
  });

  safeHandle('rag-import', async (event, payload) => {
    return importRagIndex(payload || {});
  });

  safeHandle('get-workspace-path', () => {
    return getWorkspaceRootPath();
  });

  safeHandle('fs-list-dir', async (event, folderPath) => {
    const fsPromises = require('fs').promises;
    const fallbackPath = getWorkspaceRootPath();
    const { resolved } = resolveUserPath(folderPath, { fallbackPath });

    let entries;
    try {
      entries = await fsPromises.readdir(resolved, { withFileTypes: true });
    } catch (err) {
      const isMissingDirectory = err && err.code === 'ENOENT';
      const resolvedNormalized = normalizePathForComparison(resolved);
      const fallbackNormalized = normalizePathForComparison(path.resolve(fallbackPath));

      if (isMissingDirectory && resolvedNormalized === fallbackNormalized) {
        await fsPromises.mkdir(resolved, { recursive: true });
        entries = await fsPromises.readdir(resolved, { withFileTypes: true });
      } else {
        throw err;
      }
    }

    const detailedEntries = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(resolved, entry.name);
        let size = 0;
        try {
          if (!entry.isDirectory()) {
            const stats = await fsPromises.stat(entryPath);
            size = stats.size;
          }
        } catch {
          // ignore stat failures for now
        }

        return {
          name: entry.name,
          path: entryPath,
          isDirectory: entry.isDirectory(),
          size,
        };
      })
    );

    detailedEntries.sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) {
        return left.isDirectory ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

    return detailedEntries;
  });

  safeHandle('open-folder', (event, folderPath) => {
    const { resolved } = resolveUserPath(folderPath);
    shell.openPath(resolved);
  });

  safeHandle('open-file-default', async (event, filePath) => {
    const { resolved } = resolveUserPath(filePath);
    const errorMessage = await shell.openPath(resolved);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    return { success: true };
  });

  safeHandle('fs-read-file', async (event, filePath) => {
    try {
      const fs = require('fs').promises;
      const { resolved } = ensurePathInWorkspace(filePath);

      const content = await fs.readFile(resolved, 'utf8');
      return content;
    } catch (err) {
      throw new Error(`Ошибка чтения файла: ${err.message}`);
    }
  });

  safeHandle('fs-write-file', async (event, filePath, content) => {
    try {
      const fs = require('fs').promises;
      const { resolved } = ensurePathInWorkspace(filePath);

      await fs.writeFile(resolved, content, 'utf8');
      return { success: true };
    } catch (err) {
      throw new Error(`Ошибка записи файла: ${err.message}`);
    }
  });
} else {
  logger.warn('ipcMain is unavailable; skipping IPC handler registration.');
}





// Task manager IPC
ipcMain.handle('analyze-pdf', (event, pdfPath, options) => {
  return taskManager.analyzePDF(pdfPath, options);
});

ipcMain.handle('web-search', (event, query, options) => {
  return taskManager.webSearch(query, options);
});

ipcMain.handle('ai-analysis', (event, text, instruction, options) => {
  return taskManager.aiAnalysis(text, instruction, options);
});

ipcMain.handle('task-status', () => {
  return taskManager.getStatus();
});

// Google integration IPC
ipcMain.handle('google-auth-url', () => {
  return googleIntegration.generateAuthUrl();
});

ipcMain.handle('google-auth-code', (event, code) => {
  return googleIntegration.handleAuthCode(code);
});

ipcMain.handle('google-list-files', (event, query, pageSize) => {
  return googleIntegration.listDriveFiles(query, pageSize);
});

ipcMain.handle('google-read-doc', (event, docId) => {
  return googleIntegration.readDocument(docId);
});

ipcMain.handle('google-calendar-events', (event, maxResults, timeMin) => {
  return googleIntegration.getCalendarEvents(maxResults, timeMin);
});

ipcMain.handle('google-unread-emails', (event, maxResults) => {
  return googleIntegration.getUnreadEmails(maxResults);
});

// GitHub integration IPC
ipcMain.handle('github-init', (event, token) => {
  return githubIntegration.initialize(token);
});

ipcMain.handle('github-user-repos', (event, sort, direction) => {
  return githubIntegration.getUserRepos(sort, direction);
});

ipcMain.handle('github-search-repos', (event, query, options) => {
  return githubIntegration.searchRepos(query, options);
});

ipcMain.handle('github-file-content', (event, owner, repo, filePath, ref) => {
  return githubIntegration.getFileContent(owner, repo, filePath, ref);
});

ipcMain.handle('github-create-issue', (event, owner, repo, title, body, labels) => {
  return githubIntegration.createIssue(owner, repo, title, body, labels);
});

ipcMain.handle('github-recent-commits', (event, owner, repo, branch, perPage) => {
  return githubIntegration.getRecentCommits(owner, repo, branch, perPage);
});

if (ipcMain && typeof ipcMain.on === 'function') {
  ipcMain.on('renderer-log', (event, { level, message }) => {
    if (level && logger[level]) {
      logger[level](`[renderer] ${message}`);
    } else {
      logger.info(`[renderer] ${message}`);
    }
  });
}

if (ipcMain && typeof ipcMain.handle === 'function') {
  ipcMain.handle('get-log-path', () => {
    return logger.getLogFilePath();
  });
}

// App lifecycle
if (!process.env.JEST_WORKER_ID && app && typeof app.whenReady === 'function') {
  app.whenReady().then(async () => {
  try {
    logger.info('App is ready, initializing');

    // Initialize managers
    const { HeavyTaskManager } = require('./taskManager');
    taskManager = new HeavyTaskManager();
    ensureRagStoreLoaded();

    googleIntegration = new GoogleIntegration();
    githubIntegration = new GitHubIntegration({
      storageDir: path.join(appDataPath, 'tokens'),
    });

    // Try to load saved tokens
    await loadIntegrations();

    await createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });

    // Auto-start gateway (optional)
    // startOpenClawGateway();
  } catch (err) {
    logger.error('Error in app ready handler: ' + err.stack);
    showError('Startup Error', `${err.message}\n${err.stack}`);
  }
}).catch((err) => {
  logger.error('app.whenReady() rejected: ' + err.stack);
  showError('Critical startup error', `${err.message}\n${err.stack}`);
});
}

async function loadIntegrations() {
  // Try to load GitHub token
  try {
    const tokenPath = githubIntegration && githubIntegration.tokenPath
      ? githubIntegration.tokenPath
      : path.join(appDataPath, 'tokens', 'github.json');
    if (require('fs').existsSync(tokenPath)) {
      const data = JSON.parse(require('fs').readFileSync(tokenPath, 'utf8'));
      await githubIntegration.initialize(data.token);
    }
  } catch (err) {
    logger.warn('GitHub token not loaded: ' + err.message);
  }

  // Google requires OAuth flow, will be initialized on demand
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  global.isQuitting = true;
  unregisterGlobalShortcuts();
  if (tray) tray.destroy();
  stopOpenClawGateway();
});

// Export for testing
module.exports = { startOpenClawGateway, stopOpenClawGateway };
