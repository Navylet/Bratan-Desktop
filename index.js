const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  shell,
  Menu,
  Tray,
  globalShortcut,
} = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
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

function createWindow() {
  global.isQuitting = false;
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
    show: false,
  });

  // Load the index.html
  mainWindow.loadFile('index.html');

  // Show when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates, notifications, etc.
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

function startOpenClawGateway() {
  if (openclawProcess) {
    showNotification('OpenClaw Gateway уже запущен.');
    return;
  }

  showNotification('Запуск OpenClaw Gateway...');

  openclawProcess = spawn('openclaw', ['gateway', 'start'], {
    stdio: 'pipe',
    shell: false,
  });

  openclawProcess.stdout.on('data', (data) => {
    const message = data.toString().trim();
    if (mainWindow) {
      mainWindow.webContents.send('openclaw-log', { type: 'stdout', message });
    }
    console.log('OpenClaw stdout:', message);
  });

  openclawProcess.stderr.on('data', (data) => {
    const message = data.toString().trim();
    if (mainWindow) {
      mainWindow.webContents.send('openclaw-log', { type: 'stderr', message });
    }
    console.error('OpenClaw stderr:', message);
  });

  openclawProcess.on('close', (code) => {
    showNotification(`OpenClaw Gateway завершён с кодом ${code}`);
    if (mainWindow) {
      mainWindow.webContents.send('openclaw-log', { type: 'close', code });
    }
    openclawProcess = null;
  });

  openclawProcess.on('error', (err) => {
    showNotification(`Ошибка запуска OpenClaw: ${err.message}`);
    if (mainWindow) {
      mainWindow.webContents.send('openclaw-log', { type: 'error', message: err.message });
    }
    openclawProcess = null;
  });

  // Save PID to file for later use
  if (openclawProcess.pid) {
    fs.writeFileSync(path.join(__dirname, 'gateway.pid'), openclawProcess.pid.toString());
  }
}

function stopOpenClawGateway() {
  if (!openclawProcess) {
    showNotification('OpenClaw Gateway не запущен.');
    return;
  }

  showNotification('Остановка OpenClaw Gateway...');
  openclawProcess.kill('SIGTERM');
  openclawProcess = null;

  // Remove PID file
  const pidFile = path.join(__dirname, 'gateway.pid');
  if (fs.existsSync(pidFile)) {
    fs.unlinkSync(pidFile);
  }
}

function checkGatewayStatus() {
  const check = spawn('openclaw', ['gateway', 'status'], { shell: false });
  let output = '';
  check.stdout.on('data', (data) => (output += data.toString()));
  check.stderr.on('data', (data) => (output += data.toString()));
  check.on('close', () => {
    showNotification(`Статус OpenClaw Gateway:\n${output}`);
  });
}

function showNotification(message) {
  new Notification({
    title: 'Братан Desktop',
    body: message,
  }).show();
}

ipcMain.handle('show-notification', (event, { title, body }) => {
  new Notification({
    title: title || 'Братан Desktop',
    body: body || '',
  }).show();
});

// IPC handlers
ipcMain.handle('openclaw-start', () => startOpenClawGateway());
ipcMain.handle('openclaw-stop', () => stopOpenClawGateway());
ipcMain.handle('openclaw-status', () => checkGatewayStatus());
ipcMain.handle('openclaw-send-message', async (event, message) => {
  return new Promise((resolve, reject) => {
    const send = spawn(
      'openclaw',
      ['sessions', 'send', '--session', 'telegram:446533349', message],
      { shell: false }
    );
    let stdout = '';
    let stderr = '';

    send.stdout.on('data', (data) => (stdout += data.toString()));
    send.stderr.on('data', (data) => (stderr += data.toString()));

    send.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`OpenClaw send failed (${code}): ${stderr || stdout}`));
      }

      if (stderr && !stderr.toLowerCase().includes('warning')) {
        return reject(new Error(stderr));
      }

      resolve({ success: true, output: stdout });
    });

    send.on('error', (err) => {
      reject(new Error(`Ошибка отправки сообщения: ${err.message}`));
    });
  });
});

ipcMain.handle('openclaw-get-messages', async () => {
  return new Promise((resolve, reject) => {
    const history = spawn(
      'openclaw',
      ['sessions', 'history', '--session', 'telegram:446533349', '--limit', '20', '--json'],
      { shell: false }
    );
    let stdout = '';
    let stderr = '';

    history.stdout.on('data', (data) => (stdout += data.toString()));
    history.stderr.on('data', (data) => (stderr += data.toString()));

    history.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`OpenClaw history failed (${code}): ${stderr || stdout}`));
      }

      if (stderr && !stderr.toLowerCase().includes('warning')) {
        console.warn('OpenClaw history stderr:', stderr);
      }

      let messages = [];
      try {
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
          messages = parsed.map((msg) => ({
            id: msg.id || msg.timestamp,
            sender: msg.sender || 'Unknown',
            text: msg.text || msg.content || '',
            timestamp: msg.timestamp || Date.now(),
            isUser: msg.sender === 'user' || msg.sender === 'D U' || msg.sender === '446533349',
          }));
        }
      } catch (parseErr) {
        console.warn('Failed to parse messages JSON:', parseErr);
      }

      resolve({ messages });
    });

    history.on('error', (err) => {
      reject(new Error(`Ошибка получения сообщений: ${err.message}`));
    });
  });
});
ipcMain.handle('get-workspace-path', () => {
  return path.join(os.homedir(), '.openclaw', 'workspace');
});

ipcMain.handle('open-folder', (event, folderPath) => {
  const workspace = path.join(os.homedir(), '.openclaw', 'workspace');
  const resolved = path.resolve(folderPath);
  if (!resolved.startsWith(workspace)) {
    throw new Error('Открытие папки за пределами рабочего пространства запрещено.');
  }
  shell.openPath(resolved);
});

ipcMain.handle('fs-read-file', async (event, filePath) => {
  try {
    const fs = require('fs').promises;
    const workspace = path.join(os.homedir(), '.openclaw', 'workspace');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(workspace)) {
      throw new Error('Чтение файлов за пределами рабочего пространства запрещено.');
    }

    const content = await fs.readFile(resolved, 'utf8');
    return content;
  } catch (err) {
    throw new Error(`Ошибка чтения файла: ${err.message}`);
  }
});

ipcMain.handle('fs-write-file', async (event, filePath, content) => {
  try {
    const fs = require('fs').promises;
    const workspace = path.join(os.homedir(), '.openclaw', 'workspace');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(workspace)) {
      throw new Error('Запись файлов за пределами рабочего пространства запрещено.');
    }

    await fs.writeFile(resolved, content, 'utf8');
    return { success: true };
  } catch (err) {
    throw new Error(`Ошибка записи файла: ${err.message}`);
  }
});

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

// App lifecycle
app.whenReady().then(() => {
  // Initialize managers
  const { HeavyTaskManager } = require('./taskManager');
  taskManager = new HeavyTaskManager();

  googleIntegration = new GoogleIntegration();
  githubIntegration = new GitHubIntegration();

  // Try to load saved tokens
  loadIntegrations();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Auto-start gateway (optional)
  // startOpenClawGateway();
});

async function loadIntegrations() {
  // Try to load GitHub token
  try {
    const tokenPath = path.join(__dirname, 'tokens', 'github.json');
    if (require('fs').existsSync(tokenPath)) {
      const data = JSON.parse(require('fs').readFileSync(tokenPath, 'utf8'));
      await githubIntegration.initialize(data.token);
    }
  } catch (err) {
    console.log('GitHub token not loaded:', err.message);
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
