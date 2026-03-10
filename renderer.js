// Renderer process logic for Братан Desktop

function initRenderer() {
  // Tab switching
  const tabs = {
    'tab-chat': { title: 'Чат с Братаном', content: 'content-chat' },
    'tab-logs': { title: 'Логи агентов', content: 'content-logs' },
    'tab-files': { title: 'Файлы рабочего пространства', content: 'content-files' },
    'tab-editor': { title: 'Редактор файлов', content: 'content-editor' },
    'tab-agents': { title: 'Активные агенты', content: 'content-agents' },
    'tab-integrations': { title: 'Интеграции', content: 'content-integrations' },
    'tab-settings': { title: 'Настройки', content: 'content-settings' },
  };

  Object.keys(tabs).forEach((tabId) => {
    const tabBtn = document.getElementById(tabId);
    if (tabBtn) {
      tabBtn.addEventListener('click', () => {
        // Remove active class from all tabs
        document
          .querySelectorAll('.sidebar-tab')
          .forEach((t) => t.classList.remove('active', 'tab-active'));
        // Hide all content
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
        // Activate clicked tab
        tabBtn.classList.add('active', 'tab-active');
        const contentId = tabs[tabId].content;
        document.getElementById(contentId).classList.remove('hidden');
        document.getElementById('current-tab-title').textContent = tabs[tabId].title;
        // Update ARIA attributes for accessibility
        document
          .querySelectorAll('[role="tab"]')
          .forEach((t) => t.setAttribute('aria-selected', 'false'));
        tabBtn.setAttribute('aria-selected', 'true');
      });
    }
  });

  Object.keys(tabs).forEach((tabId) => {
    const tabBtn = document.getElementById(tabId);
    if (tabBtn) {
      tabBtn.addEventListener('click', () => {
        // Remove active class from all tabs
        document
          .querySelectorAll('.sidebar-tab')
          .forEach((t) => t.classList.remove('active', 'tab-active'));
        // Hide all content
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
        // Activate clicked tab
        tabBtn.classList.add('active', 'tab-active');
        const contentId = tabs[tabId].content;
        document.getElementById(contentId).classList.remove('hidden');
        document.getElementById('current-tab-title').textContent = tabs[tabId].title;
        // Update ARIA attributes for accessibility
        document
          .querySelectorAll('[role="tab"]')
          .forEach((t) => t.setAttribute('aria-selected', 'false'));
        tabBtn.setAttribute('aria-selected', 'true');
      });
    }
  });

  // Gateway controls
  const gatewayStatus = document.getElementById('gateway-status');
  const btnStart = document.getElementById('btn-start-gateway');
  const btnStop = document.getElementById('btn-stop-gateway');

  function updateGatewayStatus(isRunning) {
    const dot = gatewayStatus.querySelector('.w-3');
    const text = gatewayStatus.querySelector('span:last-child');
    if (isRunning) {
      dot.classList.remove('bg-red-500');
      dot.classList.add('bg-green-500');
      text.textContent = 'Gateway запущен';
      btnStart.disabled = true;
      btnStop.disabled = false;
    } else {
      dot.classList.remove('bg-green-500');
      dot.classList.add('bg-red-500');
      text.textContent = 'Gateway не запущен';
      btnStart.disabled = false;
      btnStop.disabled = true;
    }
  }

  btnStart.addEventListener('click', async () => {
    try {
      await window.api.openclaw.start();
      updateGatewayStatus(true);
      showNotification('Gateway запущен', 'success');
    } catch (err) {
      showNotification('Ошибка запуска: ' + err.message, 'error');
    }
  });

  btnStop.addEventListener('click', async () => {
    try {
      await window.api.openclaw.stop();
      updateGatewayStatus(false);
      showNotification('Gateway остановлен', 'info');
    } catch (err) {
      showNotification('Ошибка остановки: ' + err.message, 'error');
    }
  });

  // Logs handling
  const logContainer = document.getElementById('log-container');
  window.api.onOpenClawLog((data) => {
    const entry = document.createElement('div');
    entry.className = `log-entry ${data.type === 'stdout' ? 'log-stdout' : 'log-stderr'}`;
    const timestamp = new Date().toLocaleTimeString();
    entry.textContent = `[${timestamp}] ${data.message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  });

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    logContainer.innerHTML = '';
  });

  document.getElementById('btn-save-logs').addEventListener('click', () => {
    const logs = Array.from(logContainer.children)
      .map((el) => el.textContent)
      .join('\n');
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Логи сохранены', 'success');
  });

  // Files handling
  const fileList = document.getElementById('file-list');
  const workspacePath = document.getElementById('workspace-path');

  async function initWorkspacePath() {
    try {
      const wsPath = await window.api.getWorkspacePath();
      workspacePath.textContent = wsPath;
    } catch (err) {
      workspacePath.textContent = '~/.openclaw/workspace';
      console.warn('Не удалось получить путь рабочей папки:', err);
    }
  }

  async function refreshFileList() {
    // TODO: implement actual file listing via IPC
    fileList.innerHTML = `
      <div class="file-item flex items-center p-3 border-b cursor-pointer" data-file-path="${workspacePath.textContent}/MEMORY.md">
        <i class="fas fa-file-alt text-gray-400 mr-3"></i>
        <div class="flex-1">
          <div class="font-medium">MEMORY.md</div>
          <div class="text-sm text-gray-500">Долговременная память ассистента</div>
        </div>
        <div class="text-xs text-gray-500">2 КБ</div>
      </div>
      <div class="file-item flex items-center p-3 border-b cursor-pointer" data-file-path="${workspacePath.textContent}/knowledge">
        <i class="fas fa-folder text-yellow-500 mr-3"></i>
        <div class="flex-1">
          <div class="font-medium">knowledge</div>
          <div class="text-sm text-gray-500">База знаний GIGA ARPA</div>
        </div>
        <div class="text-xs text-gray-500">—</div>
      </div>
      <div class="file-item flex items-center p-3 border-b cursor-pointer" data-file-path="${workspacePath.textContent}/GIGA-ARPA-PRD.docx">
        <i class="fas fa-file-word text-blue-400 mr-3"></i>
        <div class="flex-1">
          <div class="font-medium">GIGA-ARPA-PRD.docx</div>
          <div class="text-sm text-gray-500">Product Requirements Document</div>
        </div>
        <div class="text-xs text-gray-500">1.2 МБ</div>
      </div>
      <div class="file-item flex items-center p-3 border-b cursor-pointer" data-file-path="${workspacePath.textContent}/Strategiya-i-pozicionirovanie-GIGA-ARPA-2030 1.2.pdf">
        <i class="fas fa-file-pdf text-red-400 mr-3"></i>
        <div class="flex-1">
          <div class="font-medium">Strategiya-i-pozicionirovanie-GIGA-ARPA-2030 1.2.pdf</div>
          <div class="text-sm text-gray-500">Стратегия и позиционирование</div>
        </div>
        <div class="text-xs text-gray-500">5.5 МБ</div>
      </div>
    `;

    fileList.querySelectorAll('.file-item').forEach((item) => {
      item.addEventListener('click', () => {
        const path = item.dataset.filePath;
        if (path) openFileInEditor(path);
      });
    });
  }

  document.getElementById('btn-refresh-files').addEventListener('click', refreshFileList);
  document.getElementById('btn-open-workspace').addEventListener('click', () => {
    window.api.fs.openFolder(workspacePath.textContent);
  });

  // Chat functionality
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const btnSend = document.getElementById('btn-send');

  function addMessage(sender, text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = isUser ? 'chat-message-user' : 'chat-message-assistant';
    const senderDiv = document.createElement('div');
    senderDiv.className = isUser ? 'font-semibold text-gray-700' : 'font-semibold text-blue-600';
    senderDiv.textContent = sender;
    const textDiv = document.createElement('div');
    textDiv.textContent = text;
    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-500 mt-1';
    timeDiv.textContent = new Date().toLocaleTimeString();
    msgDiv.appendChild(senderDiv);
    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(timeDiv);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  btnSend.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    addMessage('Дмитрий', text, true);
    chatInput.value = '';

    // Send via WebSocket
    if (openClawWS && openClawWS.getStatus() === 'connected') {
      openClawWS.sendMessage(
        {
          text,
          timestamp: Date.now(),
          sender: 'user',
        },
        'message'
      );
      // Response will arrive via WebSocket 'message' event
    } else {
      // Offline: queue message and show notification
      if (openClawWS) {
        openClawWS.sendMessage(
          {
            text,
            timestamp: Date.now(),
            sender: 'user',
          },
          'message'
        );
        addMessage('Система', 'Сообщение сохранено в очередь. Отправлю при восстановлении связи.');
      } else {
        addMessage('Система', 'WebSocket не инициализирован. Сообщение не отправлено.');
      }
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnSend.click();
    }
  });

  // Agents
  document.getElementById('btn-create-agent').addEventListener('click', () => {
    const name = document.getElementById('new-agent-name').value.trim();
    const task = document.getElementById('new-agent-task').value.trim();
    if (!name || !task) {
      showNotification('Введите имя и задачу агента', 'warning');
      return;
    }
    showNotification(`Агент "${name}" создаётся...`, 'info');
    // TODO: IPC to create agent
    document.getElementById('new-agent-name').value = '';
    document.getElementById('new-agent-task').value = '';
  });

  // Settings
  const settingFontSize = document.getElementById('setting-font-size');
  const fontSizeValue = document.getElementById('font-size-value');
  settingFontSize.addEventListener('input', () => {
    fontSizeValue.textContent = `${settingFontSize.value}px`;
    document.documentElement.style.fontSize = `${settingFontSize.value}px`;
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    showNotification('Настройки сохранены', 'success');
  });

  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    settingFontSize.value = 16;
    fontSizeValue.textContent = '16px';
    document.documentElement.style.fontSize = '16px';
    document.getElementById('setting-autostart').checked = false;
    document.getElementById('setting-notifications').checked = true;
    document.getElementById('setting-sound').checked = true;
    document.getElementById('setting-theme').value = 'light';
    document.getElementById('setting-cli-path').value = 'openclaw';
    document.getElementById('setting-gateway-port').value = '3000';
    showNotification('Настройки сброшены', 'info');
  });

  // Notifications
  const notificationDot = document.getElementById('notification-count');
  let notificationCount = 0;

  function showNotification(message, type = 'info') {
    if (window.api && typeof window.api.showNotification === 'function') {
      window.api.showNotification({ title: 'Братан Desktop', body: message });
    } else {
      // Fallback to browser notification
      if (Notification.permission === 'granted') {
        new Notification('Братан Desktop', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('Братан Desktop', { body: message });
          }
        });
      }
    }

    // Use type to adjust log level for diagnostics (no-unused-vars fix)
    console.log(`Notification type: ${type}`);

    // Update notification dot
    notificationCount++;
    notificationDot.classList.remove('hidden');
    notificationDot.textContent = notificationCount > 9 ? '9+' : notificationCount.toString();
  }

  document.getElementById('btn-notifications').addEventListener('click', () => {
    notificationCount = 0;
    notificationDot.classList.add('hidden');
    showNotification('Уведомления очищены', 'info');
  });

  // Current time
  function updateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  setInterval(updateTime, 1000);
  updateTime();

  // Integrations
  // Google
  document.getElementById('btn-google-auth').addEventListener('click', async () => {
    try {
      const authUrl = await window.api.google.authUrl();
      document.getElementById('google-auth-link').href = authUrl;
      document.getElementById('google-auth-link').textContent = authUrl;
      document.getElementById('google-auth-url').classList.remove('hidden');
      showNotification('Откройте ссылку для авторизации', 'info');
    } catch (err) {
      showNotification('Ошибка Google OAuth: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-google-submit-code').addEventListener('click', async () => {
    const code = document.getElementById('google-auth-code').value.trim();
    if (!code) {
      showNotification('Введите код', 'warning');
      return;
    }
    try {
      await window.api.google.authCode(code);
      document.getElementById('google-status').textContent = 'Авторизован';
      document
        .getElementById('google-status')
        .previousElementSibling.classList.remove('bg-red-500');
      document.getElementById('google-status').previousElementSibling.classList.add('bg-green-500');
      document.getElementById('google-auth-url').classList.add('hidden');
      showNotification('Google авторизован успешно', 'success');
    } catch (err) {
      showNotification('Ошибка авторизации: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-google-list-files').addEventListener('click', async () => {
    try {
      const files = await window.api.google.listFiles('', 20);
      showNotification(`Загружено ${files.length} файлов`, 'success');
      console.log('Google files:', files);
    } catch (err) {
      showNotification('Ошибка загрузки файлов: ' + err.message, 'error');
    }
  });

  // GitHub
  document.getElementById('btn-github-auth').addEventListener('click', async () => {
    const token = document.getElementById('github-token').value.trim();
    if (!token) {
      showNotification('Введите GitHub токен', 'warning');
      return;
    }
    try {
      await window.api.github.init(token);
      document.getElementById('github-status').textContent = 'Авторизован';
      document
        .getElementById('github-status')
        .previousElementSibling.classList.remove('bg-red-500');
      document.getElementById('github-status').previousElementSibling.classList.add('bg-green-500');
      document.getElementById('github-token').value = '';
      showNotification('GitHub авторизован успешно', 'success');
    } catch (err) {
      showNotification('Ошибка GitHub: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-github-repos').addEventListener('click', async () => {
    try {
      const repos = await window.api.github.userRepos();
      showNotification(`Загружено ${repos.length} репозиториев`, 'success');
      console.log('GitHub repos:', repos);
    } catch (err) {
      showNotification('Ошибка загрузки репозиториев: ' + err.message, 'error');
    }
  });

  // Perplexity search
  document.getElementById('btn-perplexity-search').addEventListener('click', async () => {
    const query = document.getElementById('perplexity-query').value.trim();
    if (!query) {
      showNotification('Введите запрос', 'warning');
      return;
    }
    try {
      const result = await window.api.tasks.webSearch(query);
      showNotification(`Найдено ответов: ${result.sources?.length || 0}`, 'success');
      // Можно вывести результат в чат
      addMessage('Perplexity AI', `По запросу "${query}":\n${result.answer.substring(0, 300)}...`);
    } catch (err) {
      showNotification('Ошибка поиска: ' + err.message, 'error');
    }
  });

  // PDF analysis
  document.getElementById('btn-pdf-analyze').addEventListener('click', async () => {
    const pdfPath = document.getElementById('pdf-path').value.trim();
    const pages = document.getElementById('pdf-pages').value.trim() || 'all';
    const ocr = document.getElementById('pdf-ocr').checked;
    const resultArea = document.getElementById('pdf-analysis-result');

    if (!pdfPath) {
      showNotification('Укажите путь к PDF', 'warning');
      return;
    }

    try {
      resultArea.textContent = 'Анализируется...';
      const data = await window.api.tasks.analyzePDF(pdfPath, { pages, ocr });
      resultArea.textContent = JSON.stringify(data, null, 2);
      showNotification('Анализ PDF завершён', 'success');
    } catch (err) {
      resultArea.textContent = `Ошибка: ${err.message}`;
      showNotification('Ошибка анализа PDF: ' + err.message, 'error');
    }
  });

  // File editor
  let codeEditor = null;
  let currentEditorFile = null;

  function initCodeEditor() {
    if (codeEditor) return;

    const textarea = document.getElementById('editor-fallback');
    codeEditor = CodeMirror.fromTextArea(textarea, {
      lineNumbers: true,
      mode: 'javascript',
      theme: 'dracula',
      indentUnit: 2,
      tabSize: 2,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      extraKeys: {
        'Ctrl-S': saveEditorFile,
        'Cmd-S': saveEditorFile,
      },
    });

    codeEditor.on('change', () => {
      document.getElementById('editor-save').disabled = false;
      updateEditorStatus('Изменения не сохранены');
    });

    // Theme selector
    document.getElementById('editor-theme').addEventListener('change', (e) => {
      const theme = e.target.value;
      let cmTheme = 'default';
      if (theme === 'dark') cmTheme = 'dracula';
      else if (theme === 'one-dark') cmTheme = 'dracula';
      else if (theme === 'light') cmTheme = 'eclipse';
      codeEditor.setOption('theme', cmTheme);
    });

    // Language selector
    document.getElementById('editor-language').addEventListener('change', (e) => {
      const lang = e.target.value;
      codeEditor.setOption('mode', lang === 'auto' ? null : lang);
    });

    // Save button
    document.getElementById('editor-save').addEventListener('click', saveEditorFile);

    // Close button
    document.getElementById('editor-close').addEventListener('click', () => {
      if (
        document.getElementById('editor-save').disabled ||
        confirm('Есть несохранённые изменения. Закрыть без сохранения?')
      ) {
        resetEditor();
      }
    });

    updateEditorStatus('Редактор готов');
  }

  function updateEditorStatus(text) {
    document.getElementById('editor-status').textContent = text;
  }

  function resetEditor() {
    codeEditor.setValue('');
    document.getElementById('editor-filename').textContent = 'Не выбран';
    document.getElementById('editor-save').disabled = true;
    currentEditorFile = null;
    updateEditorStatus('Готов');
  }

  async function openFileInEditor(filePath) {
    try {
      const content = await window.api.fs.readFile(filePath); // Need to add this IPC
      if (codeEditor) {
        codeEditor.setValue(content);
        currentEditorFile = filePath;
        document.getElementById('editor-filename').textContent = filePath;
        document.getElementById('editor-save').disabled = true;

        // Auto-detect language
        const ext = filePath.split('.').pop().toLowerCase();
        const langMap = {
          js: 'javascript',
          ts: 'javascript',
          jsx: 'javascript',
          py: 'python',
          html: 'html',
          htm: 'html',
          css: 'css',
          json: 'json',
          md: 'markdown',
          xml: 'xml',
          yml: 'yaml',
          yaml: 'yaml',
        };
        const lang = langMap[ext] || 'auto';
        document.getElementById('editor-language').value = lang;
        codeEditor.setOption('mode', lang === 'auto' ? null : lang);

        updateEditorStatus(`Файл загружен: ${ext.toUpperCase()}`);
        // Switch to editor tab
        document.getElementById('tab-editor').click();
      }
    } catch (err) {
      showNotification('Ошибка загрузки файла: ' + err.message, 'error');
    }
  }

  async function saveEditorFile() {
    if (!currentEditorFile || !codeEditor) return;
    try {
      const content = codeEditor.getValue();
      await window.api.fs.writeFile(currentEditorFile, content); // Need IPC
      document.getElementById('editor-save').disabled = true;
      updateEditorStatus('Файл сохранён');
      showNotification(`Файл сохранён: ${currentEditorFile}`, 'success');
    } catch (err) {
      showNotification('Ошибка сохранения: ' + err.message, 'error');
    }
  }

  // Initialize editor when editor tab is shown
  document.getElementById('tab-editor').addEventListener('click', () => {
    initCodeEditor();
  });

  // OpenClaw WebSocket real-time integration
  let openClawWS = null;
  let lastMessageId = null;

  function initOpenClawWebSocket() {
    if (openClawWS) {
      console.warn('OpenClaw WebSocket already initialized');
      return;
    }

    try {
      openClawWS = new OpenClawWebSocket({
        wsUrl: 'ws://localhost:8080',
        maxReconnectAttempts: 20,
        reconnectDelay: 1000,
        heartbeatInterval: 30000,
      });

      openClawWS.on('open', () => {
        console.log('OpenClaw WebSocket connected');
        updateConnectionStatus('connected');
      });

      openClawWS.on('close', () => {
        console.log('OpenClaw WebSocket disconnected');
        updateConnectionStatus('disconnected');
      });

      openClawWS.on('error', (err) => {
        console.error('OpenClaw WebSocket error:', err);
        updateConnectionStatus('error');
      });

      openClawWS.on('message', (data) => {
        // Handle incoming messages from OpenClaw
        if (data.type === 'message' && data.payload) {
          const message = typeof data.payload === 'string' ? data.payload : data.payload.text;
          const sender = data.sender || 'Братан';
          if (data.id !== lastMessageId) {
            addMessage(sender, message);
            lastMessageId = data.id;
          }
        }
      });

      openClawWS.on('statusChange', ({ previous, current }) => {
        console.log(`OpenClaw WebSocket status changed: ${previous} -> ${current}`);
        updateConnectionStatus(current);
      });

      openClawWS.connect();
    } catch (err) {
      console.error('Failed to initialize OpenClaw WebSocket:', err);
      updateConnectionStatus('failed');
    }
  }

  // Update UI connection status indicator
  function updateConnectionStatus(status) {
    const statusEl = document.getElementById('websocket-status');
    if (!statusEl) return;

    // Ensure element is visible
    statusEl.classList.remove('hidden');

    const statusText = {
      connecting: 'Подключение...',
      connected: 'Онлайн',
      disconnected: 'Офлайн',
      offline: 'Офлайн (сообщения в очереди)',
      error: 'Ошибка подключения',
      failed: 'Соединение потеряно',
    };

    statusEl.textContent = statusText[status] || status;
    statusEl.className = 'px-2 py-1 rounded text-xs';

    // Color coding
    if (status === 'connected') {
      statusEl.classList.add('bg-green-100', 'text-green-800');
    } else if (status === 'connecting') {
      statusEl.classList.add('bg-yellow-100', 'text-yellow-800');
    } else if (status === 'offline') {
      statusEl.classList.add('bg-orange-100', 'text-orange-800');
    } else {
      statusEl.classList.add('bg-red-100', 'text-red-800');
    }
  }

  // Initialize WebSocket connection
  initOpenClawWebSocket();

  // Graceful shutdown on window close
  window.addEventListener('beforeunload', () => {
    if (openClawWS) {
      openClawWS.disconnect();
    }
  });

  // Task monitor polling
  function updateTaskMonitor() {
    window.api.tasks
      .getStatus()
      .then((status) => {
        const monitor = document.getElementById('task-monitor');
        const { pdfQueue, webQueue, aiQueue } = status;
        const totalPending = pdfQueue.pending + webQueue.pending + aiQueue.pending;
        const totalRunning = pdfQueue.running + webQueue.running + aiQueue.running;

        if (totalPending === 0 && totalRunning === 0) {
          monitor.innerHTML =
            '<div class="text-center text-gray-500 py-4">Нет активных задач</div>';
          return;
        }

        let html = '<div class="space-y-2">';
        if (pdfQueue.pending > 0 || pdfQueue.running > 0) {
          html += `<div class="flex justify-between items-center">
          <span class="text-sm">PDF анализ</span>
          <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${pdfQueue.running} выполняется, ${pdfQueue.pending} в очереди</span>
        </div>`;
        }
        if (webQueue.pending > 0 || webQueue.running > 0) {
          html += `<div class="flex justify-between items-center">
          <span class="text-sm">Веб-поиск</span>
          <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">${webQueue.running} выполняется, ${webQueue.pending} в очереди</span>
        </div>`;
        }
        if (aiQueue.pending > 0 || aiQueue.running > 0) {
          html += `<div class="flex justify-between items-center">
          <span class="text-sm">AI анализ</span>
          <span class="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">${aiQueue.running} выполняется, ${aiQueue.pending} в очереди</span>
        </div>`;
        }
        html += '</div>';
        monitor.innerHTML = html;
      })
      .catch(console.error);
  }

  setInterval(updateTaskMonitor, 3000);
  updateTaskMonitor();

  // Initialize
  initWorkspacePath().then(() => refreshFileList());
  updateGatewayStatus(false);
  showNotification('Братан Desktop запущен', 'info');

  // Keyboard shortcuts for accessibility
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
      const tabIndex = parseInt(e.key) - 1;
      const tabs = ['chat', 'logs', 'files', 'editor', 'agents', 'integrations', 'settings'];
      const tabId = tabs[tabIndex];
      const tabButton = document.getElementById('tab-' + tabId);
      if (tabButton) {
        tabButton.click();
        e.preventDefault();
      }
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initRenderer);
  window.initRenderer = initRenderer;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initRenderer };
}
