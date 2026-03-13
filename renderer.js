// Renderer process logic for Братан Desktop

function initRenderer() {
  window.api.log('info', 'Renderer initialized');

  // Tab switching
  const tabs = {
    'tab-chat': { title: 'Чат с Братаном', content: 'content-chat' },
    'tab-logs': { title: 'Логи агентов', content: 'content-logs' },
    'tab-files': { title: 'Файлы рабочего пространства', content: 'content-files' },
    'tab-agents': { title: 'Активные агенты', content: 'content-agents' },
    'tab-rag': { title: 'RAG Studio', content: 'content-rag' },
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
      void refreshTransportStatus();
    } catch (err) {
      showNotification('Ошибка запуска: ' + err.message, 'error');
    }
  });

  btnStop.addEventListener('click', async () => {
    try {
      await window.api.openclaw.stop();
      updateGatewayStatus(false);
      showNotification('Gateway остановлен', 'info');
      void refreshTransportStatus();
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

  if (window.api && typeof window.api.onOpenClawStream === 'function') {
    window.api.onOpenClawStream((data) => {
      if (!data || typeof data !== 'object') return;

      const requestId = data.requestId;
      if (activeRequestId && requestId && requestId !== activeRequestId) {
        return;
      }

      const runtime = getChatRuntimeOptions();
      const phase = String(data.phase || '').toLowerCase();
      const message = String(data.message || '').trim();

      if (phase === 'queued' || phase === 'context-prepared' || phase === 'gateway-ready') {
        const statusText = message || 'Обработка запроса...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI progress', statusText);
        return;
      }

      if (phase === 'stdout' || phase === 'stderr') {
        if (data.chunk) {
          appendStreamingChunk(runtime.agentId || 'Братан', requestId || activeRequestId || 'stream', data.chunk);
        }

        const statusText = phase === 'stderr' ? 'Провайдер отвечает, проверяю стабильность...' : 'Потоковый ответ поступает...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        return;
      }

      if (phase === 'agent-fallback') {
        const statusText = message || 'Переключаюсь на default agent...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI agent fallback', statusText);
        return;
      }

      if (phase === 'completed') {
        setChatLiveStatus('', false);
        return;
      }

      if (phase === 'error') {
        if (message) {
          appendAgentTrace('CLI stream error', message);
        }
        setChatLiveStatus('', false);
      }
    });
  }

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
  const filesCurrentPath = document.getElementById('files-current-path');
  const filesBreadcrumbs = document.getElementById('files-breadcrumbs');
  const btnFilesHome = document.getElementById('btn-files-home');
  const btnFilesUp = document.getElementById('btn-files-up');

  let workspaceRootPath = '';
  let currentDirectory = '';

  function normalizeFsPath(value) {
    return String(value || '').replace(/[\\/]+$/, '');
  }

  function pathsEqual(left, right) {
    return normalizeFsPath(left).toLowerCase() === normalizeFsPath(right).toLowerCase();
  }

  function isPathInsideWorkspace(candidatePath) {
    const root = normalizeFsPath(workspaceRootPath).toLowerCase();
    const candidate = normalizeFsPath(candidatePath).toLowerCase();
    return candidate === root || candidate.startsWith(`${root}\\`) || candidate.startsWith(`${root}/`);
  }

  function getParentDirectory(targetPath) {
    const normalized = normalizeFsPath(targetPath);
    if (!normalized || pathsEqual(normalized, workspaceRootPath)) {
      return normalizeFsPath(workspaceRootPath);
    }

    const parent = normalized.replace(/[\\/][^\\/]+$/, '');
    if (!parent || !isPathInsideWorkspace(parent)) {
      return normalizeFsPath(workspaceRootPath);
    }

    return normalizeFsPath(parent);
  }

  function setCurrentDirectory(targetPath) {
    currentDirectory = normalizeFsPath(targetPath || workspaceRootPath);

    if (filesCurrentPath) {
      filesCurrentPath.textContent = currentDirectory;
    }

    if (btnFilesUp) {
      btnFilesUp.disabled = pathsEqual(currentDirectory, workspaceRootPath);
      btnFilesUp.classList.toggle('opacity-50', btnFilesUp.disabled);
      btnFilesUp.classList.toggle('cursor-not-allowed', btnFilesUp.disabled);
    }

    renderFileBreadcrumbs();
  }

  function renderFileBreadcrumbs() {
    if (!filesBreadcrumbs) return;

    const root = normalizeFsPath(workspaceRootPath);
    const current = normalizeFsPath(currentDirectory || workspaceRootPath);
    const rel = current.toLowerCase().startsWith(root.toLowerCase())
      ? current.slice(root.length)
      : '';
    const segments = rel.split(/[\\/]+/).filter(Boolean);

    const crumbs = [
      `<button class="text-blue-600 hover:underline" data-fs-crumb="${escapeHtml(root)}">workspace</button>`,
    ];

    let accum = root;
    segments.forEach((segment) => {
      accum = `${accum}\\${segment}`;
      crumbs.push('<span class="text-gray-400">/</span>');
      crumbs.push(`<button class="text-blue-600 hover:underline" data-fs-crumb="${escapeHtml(accum)}">${escapeHtml(segment)}</button>`);
    });

    filesBreadcrumbs.innerHTML = crumbs.join(' ');
    filesBreadcrumbs.querySelectorAll('[data-fs-crumb]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-fs-crumb');
        if (!target) return;
        void refreshFileList(target);
      });
    });
  }

  async function openFileWithDefaultApp(filePath) {
    try {
      await window.api.fs.openFile(filePath);
      showNotification(`Открыт файл: ${filePath}`, 'success');
    } catch (err) {
      showNotification('Ошибка открытия файла: ' + err.message, 'error');
    }
  }

  async function initWorkspacePath() {
    try {
      const wsPath = await window.api.getWorkspacePath();
      workspacePath.textContent = wsPath;
      workspaceRootPath = normalizeFsPath(wsPath);
      setCurrentDirectory(workspaceRootPath);
    } catch (err) {
      workspacePath.textContent = '~/.openclaw/workspace';
      console.warn('Не удалось получить путь рабочей папки:', err);
      workspaceRootPath = normalizeFsPath('~/.openclaw/workspace');
      setCurrentDirectory(workspaceRootPath);
    }
  }

  async function refreshFileList(targetPath) {
    const nextPath = normalizeFsPath(targetPath || currentDirectory || workspaceRootPath || workspacePath.textContent);
    if (!nextPath) return;

    try {
      setCurrentDirectory(nextPath);
      const entries = await window.api.fs.listDir(nextPath);
      if (!entries.length) {
        fileList.innerHTML = '<div class="text-center text-gray-500 py-4">Рабочая папка пуста</div>';
        return;
      }

      fileList.innerHTML = entries
        .map((entry) => {
          const iconClass = entry.isDirectory
            ? 'fas fa-folder text-yellow-500'
            : entry.name.endsWith('.pdf')
              ? 'fas fa-file-pdf text-red-400'
              : entry.name.endsWith('.doc') || entry.name.endsWith('.docx')
                ? 'fas fa-file-word text-blue-400'
                : 'fas fa-file-alt text-gray-400';
          const sizeLabel = entry.isDirectory
            ? '—'
            : entry.size > 1024 * 1024
              ? `${(entry.size / (1024 * 1024)).toFixed(1)} МБ`
              : `${Math.max(1, Math.round(entry.size / 1024))} КБ`;

          return `
            <div class="file-item flex items-center p-3 border-b rounded cursor-pointer" data-file-path="${entry.path}" data-is-directory="${entry.isDirectory}">
              <i class="${iconClass} mr-3"></i>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">${entry.name}</div>
                <div class="text-sm text-gray-500">${entry.isDirectory ? 'Папка рабочего пространства' : 'Файл рабочего пространства'}</div>
              </div>
              <div class="text-xs text-gray-500">${sizeLabel}</div>
            </div>
          `;
        })
        .join('');

      fileList.querySelectorAll('.file-item').forEach((item) => {
        item.addEventListener('click', () => {
          fileList.querySelectorAll('.file-item').forEach((node) => node.classList.remove('file-item-active'));
          item.classList.add('file-item-active');
        });

        item.addEventListener('dblclick', () => {
          const entryPath = item.dataset.filePath;
          const isDirectory = item.dataset.isDirectory === 'true';
          if (!entryPath) return;

          if (isDirectory) {
            void refreshFileList(entryPath);
            return;
          }

          void openFileWithDefaultApp(entryPath);
        });
      });
    } catch (err) {
      fileList.innerHTML = '<div class="text-center text-red-500 py-4">Не удалось загрузить файлы</div>';
      showNotification('Ошибка загрузки списка файлов: ' + err.message, 'error');
    }
  }

  document.getElementById('btn-refresh-files').addEventListener('click', () => {
    void refreshFileList(currentDirectory);
  });

  if (btnFilesHome) {
    btnFilesHome.addEventListener('click', () => {
      void refreshFileList(workspaceRootPath);
    });
  }

  if (btnFilesUp) {
    btnFilesUp.addEventListener('click', () => {
      const parent = getParentDirectory(currentDirectory);
      void refreshFileList(parent);
    });
  }

  // Chat functionality
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  const btnSend = document.getElementById('btn-send');
  const btnChatAttach = document.getElementById('btn-chat-attach');
  const chatAttachmentsContainer = document.getElementById('chat-attachments');
  const chatAgentIdInput = document.getElementById('chat-agent-id');
  const chatSessionIdInput = document.getElementById('chat-session-id');
  const chatThinkingSelect = document.getElementById('chat-thinking');
  const chatShowReasoningCheckbox = document.getElementById('chat-show-reasoning');
  const chatReasoningOutput = document.getElementById('chat-reasoning-output');
  const chatLiveStatus = document.getElementById('chat-live-status');
  const agentReasoningOutput = document.getElementById('agent-reasoning-output');
  const agentTraceLog = document.getElementById('agent-trace-log');

  let selectedChatAttachments = [];
  let typingIndicator = null;
  let typingTimer = null;
  let traceCounter = 0;
  let traceHistory = [];
  let activeRequestId = null;
  let activeStreamMessage = null;

  function formatBytes(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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

    return {
      container: msgDiv,
      senderNode: senderDiv,
      textNode: textDiv,
      timeNode: timeDiv,
    };
  }

  function normalizeStreamChunk(chunk) {
    const text = String(chunk || '').trim();
    if (!text) return '';

    if (text.startsWith('{') || text.startsWith('[')) {
      return '';
    }

    if (/^(\[tools\]|\[agent\/embedded\]|\[diagnostic\])/i.test(text)) {
      return '';
    }

    if (/^config overwrite:/i.test(text)) {
      return '';
    }

    if (/^doctor warnings/i.test(text)) {
      return '';
    }

    return text;
  }

  function ensureStreamingAssistantMessage(sender, requestId) {
    if (activeStreamMessage && activeStreamMessage.requestId === requestId) {
      return activeStreamMessage;
    }

    const message = addMessage(sender || 'Братан', '', false);
    message.container.classList.add('border', 'border-indigo-200', 'bg-indigo-50');
    message.textNode.textContent = '';

    activeStreamMessage = {
      requestId,
      ...message,
    };

    return activeStreamMessage;
  }

  function appendStreamingChunk(sender, requestId, chunk) {
    const normalized = normalizeStreamChunk(chunk);
    if (!normalized) return;

    const streamingMessage = ensureStreamingAssistantMessage(sender, requestId);
    const separator = streamingMessage.textNode.textContent ? '\n' : '';
    streamingMessage.textNode.textContent += `${separator}${normalized}`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function finalizeStreamingMessage(sender, requestId, finalText) {
    const normalizedFinalText = String(finalText || '').trim();
    if (activeStreamMessage && activeStreamMessage.requestId === requestId) {
      activeStreamMessage.senderNode.textContent = sender || 'Братан';
      activeStreamMessage.textNode.textContent = normalizedFinalText || activeStreamMessage.textNode.textContent || 'Ответ получен.';
      activeStreamMessage.container.classList.remove('border', 'border-indigo-200', 'bg-indigo-50');
      activeStreamMessage = null;
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return;
    }

    addMessage(sender || 'Братан', normalizedFinalText || 'Ответ получен.');
  }

  function clearStreamingMessage(requestId) {
    if (!activeStreamMessage || activeStreamMessage.requestId !== requestId) {
      return;
    }

    if (activeStreamMessage.container && activeStreamMessage.container.parentNode) {
      activeStreamMessage.container.parentNode.removeChild(activeStreamMessage.container);
    }
    activeStreamMessage = null;
  }

  function appendAgentTrace(stage, details = '') {
    traceCounter += 1;
    const entry = {
      id: traceCounter,
      time: new Date().toLocaleTimeString(),
      stage,
      details,
    };

    traceHistory = [entry, ...traceHistory].slice(0, 50);
    if (!agentTraceLog) return;

    agentTraceLog.innerHTML = traceHistory
      .map(
        (trace) => `
        <div class="text-xs border rounded p-2 bg-gray-50">
          <div class="font-semibold text-gray-700">[${escapeHtml(trace.time)}] ${escapeHtml(trace.stage)}</div>
          <div class="text-gray-600 mt-1">${escapeHtml(trace.details || '—')}</div>
        </div>
      `
      )
      .join('');
  }

  function renderReasoning(reasoning, meta, transport) {
    const lines = [];
    if (Array.isArray(reasoning) && reasoning.length > 0) {
      lines.push('Reasoning fragments:');
      reasoning.forEach((item, index) => {
        lines.push(`${index + 1}. ${item}`);
      });
    }

    if (meta && typeof meta === 'object') {
      lines.push('');
      lines.push('Meta:');
      lines.push(JSON.stringify(meta, null, 2));
    }

    if (transport) {
      lines.unshift(`Transport: ${transport}`);
    }

    const finalText = lines.join('\n').trim();
    const output = finalText || 'Reasoning отсутствует для этого ответа.';
    if (chatReasoningOutput) {
      chatReasoningOutput.textContent = output;
    }
    if (agentReasoningOutput) {
      agentReasoningOutput.textContent = output;
    }
  }

  function setChatLiveStatus(message = '', visible = false) {
    if (!chatLiveStatus) return;
    chatLiveStatus.textContent = message;
    if (visible && message) {
      chatLiveStatus.classList.remove('hidden');
    } else {
      chatLiveStatus.classList.add('hidden');
    }
  }

  function startTypingIndicator(sender = 'Братан') {
    stopTypingIndicator();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message-typing';

    const senderDiv = document.createElement('div');
    senderDiv.className = 'font-semibold text-indigo-700';
    senderDiv.textContent = sender;

    const textDiv = document.createElement('div');
    textDiv.innerHTML = 'Готовлю ответ <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-500 mt-1';
    timeDiv.textContent = new Date().toLocaleTimeString();

    msgDiv.appendChild(senderDiv);
    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(timeDiv);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    typingIndicator = { container: msgDiv, textNode: textDiv };
    let stageIndex = 0;
    const stages = [
      'Готовлю ответ',
      'Анализирую контекст',
      'Собираю reasoning',
      'Формирую финальный текст',
    ];

    typingTimer = setInterval(() => {
      if (!typingIndicator) return;
      stageIndex = (stageIndex + 1) % stages.length;
      typingIndicator.textNode.innerHTML = `${stages[stageIndex]} <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
    }, 1500);
  }

  function updateTypingIndicator(stage) {
    if (!typingIndicator || !typingIndicator.textNode) return;
    typingIndicator.textNode.innerHTML = `${escapeHtml(stage)} <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>`;
  }

  function stopTypingIndicator() {
    if (typingTimer) {
      clearInterval(typingTimer);
      typingTimer = null;
    }

    if (typingIndicator && typingIndicator.container && typingIndicator.container.parentNode) {
      typingIndicator.container.parentNode.removeChild(typingIndicator.container);
    }

    typingIndicator = null;
  }

  function getChatRuntimeOptions() {
    const agentId = (chatAgentIdInput?.value || '').trim();
    const sessionId = (chatSessionIdInput?.value || '').trim() || 'bratan-desktop-ui';
    const thinking = (chatThinkingSelect?.value || 'medium').trim();
    const showReasoning = Boolean(chatShowReasoningCheckbox?.checked);

    return { agentId, sessionId, thinking, showReasoning };
  }

  function extractReasoningFromPayload(payload) {
    const reasoningKeys = new Set(['reasoning', 'analysis', 'thinking', 'thoughts', 'rationale', 'plan', 'trace']);
    const stack = [payload];
    const visited = new Set();
    const found = [];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== 'object') continue;
      if (visited.has(current)) continue;
      visited.add(current);

      if (Array.isArray(current)) {
        current.forEach((item) => stack.push(item));
        continue;
      }

      Object.entries(current).forEach(([key, value]) => {
        const normalizedKey = String(key || '').toLowerCase();
        if (typeof value === 'string' && value.trim() && reasoningKeys.has(normalizedKey)) {
          found.push(value.trim());
        }

        if (value && typeof value === 'object') {
          stack.push(value);
        }
      });
    }

    return Array.from(new Set(found)).slice(0, 8);
  }

  function extractMetaFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.meta && typeof payload.meta === 'object') return payload.meta;
    if (payload.result && payload.result.meta && typeof payload.result.meta === 'object') return payload.result.meta;
    return null;
  }

  function renderChatAttachments() {
    if (!chatAttachmentsContainer) return;
    if (!selectedChatAttachments.length) {
      chatAttachmentsContainer.innerHTML = '';
      return;
    }

    chatAttachmentsContainer.innerHTML = selectedChatAttachments
      .map(
        (file) => `
        <div class="inline-flex items-center bg-gray-100 border rounded px-2 py-1 text-xs">
          <i class="fas fa-file mr-2 text-gray-500"></i>
          <span class="mr-2">${escapeHtml(file.name)} (${formatBytes(file.size)})</span>
          <button class="text-red-500 hover:text-red-700" data-remove-chat-file="${escapeHtml(file.path)}" title="Удалить">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `
      )
      .join('');

    chatAttachmentsContainer.querySelectorAll('[data-remove-chat-file]').forEach((button) => {
      button.addEventListener('click', () => {
        const filePath = button.getAttribute('data-remove-chat-file');
        selectedChatAttachments = selectedChatAttachments.filter((file) => file.path !== filePath);
        renderChatAttachments();
      });
    });
  }

  async function pickChatAttachments() {
    try {
      const files = await window.api.openclaw.pickFiles({ multi: true });
      if (!Array.isArray(files) || files.length === 0) return;

      const known = new Set(selectedChatAttachments.map((file) => file.path));
      files.forEach((file) => {
        if (file?.path && !known.has(file.path)) {
          selectedChatAttachments.push(file);
          known.add(file.path);
        }
      });

      selectedChatAttachments = selectedChatAttachments.slice(0, 5);
      renderChatAttachments();
      appendAgentTrace('Файлы прикреплены', selectedChatAttachments.map((file) => file.name).join(', '));
    } catch (err) {
      showNotification('Ошибка выбора файлов: ' + err.message, 'error');
    }
  }

  if (btnChatAttach) {
    btnChatAttach.addEventListener('click', () => {
      void pickChatAttachments();
    });
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

  function pickPreferredReply(texts) {
    const cleaned = texts.map((text) => String(text || '').trim()).filter(Boolean);
    if (!cleaned.length) {
      return '';
    }

    const nonFailure = cleaned.filter((text) => !isTransientModelFailureText(text));
    const preferred = nonFailure.length ? nonFailure[nonFailure.length - 1] : cleaned[cleaned.length - 1];
    return preferred || '';
  }

  function extractAssistantReplyText(payload) {
    if (payload === null || payload === undefined) return '';
    if (typeof payload === 'string') return payload.trim();

    if (Array.isArray(payload)) {
      return pickPreferredReply(payload.map((entry) => extractAssistantReplyText(entry)));
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.payloads)) {
      return pickPreferredReply(
        payload.payloads.map((entry) => (entry && typeof entry.text === 'string' ? entry.text : extractAssistantReplyText(entry)))
      );
    }

    const preferredKeys = ['output', 'message', 'text', 'content', 'reply'];
    for (const key of preferredKeys) {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        return payload[key].trim();
      }
    }

    const nestedKeys = ['result', 'final', 'data'];
    for (const key of nestedKeys) {
      if (payload[key] !== undefined) {
        const nestedText = extractAssistantReplyText(payload[key]);
        if (nestedText) return nestedText;
      }
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }

  function persistChatRuntimeSettings() {
    localStorage.setItem('openclaw_chat_agent_id', chatAgentIdInput?.value || '');
    localStorage.setItem('openclaw_chat_session_id', chatSessionIdInput?.value || 'bratan-desktop-ui');
    localStorage.setItem('openclaw_chat_thinking', chatThinkingSelect?.value || 'medium');
    localStorage.setItem('openclaw_chat_show_reasoning', chatShowReasoningCheckbox?.checked ? 'true' : 'false');
  }

  [chatAgentIdInput, chatSessionIdInput, chatThinkingSelect, chatShowReasoningCheckbox].forEach((control) => {
    if (!control) return;
    control.addEventListener('change', persistChatRuntimeSettings);
  });

  async function syncOpenClawConfig() {
    const cliPath = document.getElementById('setting-cli-path').value.trim();
    const gatewayPort = Number(document.getElementById('setting-gateway-port').value);

    try {
      await window.api.openclaw.configure({ cliPath, gatewayPort });
    } catch (err) {
      console.error('OpenClaw config sync failed:', err);
    }
  }

  async function refreshTransportStatus() {
    try {
      const status = await window.api.openclaw.status({ silent: true });
      updateGatewayStatus(Boolean(status && status.running));

      if (openClawWS && openClawWS.getStatus() === 'connected') {
        updateConnectionStatus('connected');
      } else if (status && status.running) {
        updateConnectionStatus('cli');
      } else {
        updateConnectionStatus('disconnected');
      }
    } catch (err) {
      console.error('Failed to refresh transport status:', err);
      updateConnectionStatus('disconnected');
    }
  }

  btnSend.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text && selectedChatAttachments.length === 0) return;

    const runtime = getChatRuntimeOptions();
    const attachmentPaths = selectedChatAttachments.map((file) => file.path);
    const userDisplayText = text || `Отправлены вложения: ${selectedChatAttachments.map((file) => file.name).join(', ')}`;
    const requestId = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    activeRequestId = requestId;

    addMessage('Дмитрий', userDisplayText, true);
    chatInput.value = '';
    setChatLiveStatus('Запрос отправлен. Агент готовит ответ...', true);
    startTypingIndicator(runtime.agentId || 'Братан');
    appendAgentTrace('Запрос отправлен', `session=${runtime.sessionId}; agent=${runtime.agentId || 'default'}; attachments=${attachmentPaths.length}`);

    const requestPayload = {
      text: text || 'Проанализируй приложенные файлы и ответь по их содержимому.',
      attachments: attachmentPaths,
      agentId: runtime.agentId,
      sessionId: runtime.sessionId,
      thinking: runtime.thinking,
      timeoutSeconds: 180,
      requestId,
    };

    const sendViaCliFallback = async () => {
      appendAgentTrace('CLI fallback', 'Переход на выполнение через openclaw agent CLI');
      updateTypingIndicator('Получаю ответ через CLI');
      const result = await window.api.openclaw.sendMessage(requestPayload);

      if (result?.fallbackToDefaultAgent && runtime.agentId) {
        if (chatAgentIdInput) {
          chatAgentIdInput.value = '';
        }
        persistChatRuntimeSettings();
        appendAgentTrace('Agent reset', `Агент ${runtime.agentId} недоступен, использован default agent`);
        showNotification(`Агент "${runtime.agentId}" недоступен. Переключено на default agent.`, 'warning');
      }

      const response = extractAssistantReplyText(result) || 'Ответ получен, но текст пустой.';
      const effectiveAgentName = result?.agentIdUsed || runtime.agentId || 'Братан';
      stopTypingIndicator();
      finalizeStreamingMessage(effectiveAgentName, requestId, response);
      if (runtime.showReasoning) {
        renderReasoning(result.reasoning || extractReasoningFromPayload(result.raw || result), result.meta || extractMetaFromPayload(result.raw || result), 'cli');
      }
      appendAgentTrace('Ответ готов', `transport=cli; agent=${effectiveAgentName}; chars=${response.length}`);
      updateConnectionStatus('cli');
      return true;
    };

    if (openClawWS && openClawWS.getStatus() === 'connected' && attachmentPaths.length === 0) {
      try {
        updateTypingIndicator('Получаю ответ через Gateway WebSocket');
        appendAgentTrace('WS call', `agent=${runtime.agentId || 'default'}; thinking=${runtime.thinking}`);
        const result = await openClawWS.callAgent(runtime.agentId || null, 'message', {
          text: requestPayload.text,
          sessionId: runtime.sessionId,
          thinking: runtime.thinking,
          requestId,
        });
        const response = extractAssistantReplyText(result) || 'Ответ получен, но текст пустой.';
        stopTypingIndicator();
        clearStreamingMessage(requestId);
        addMessage(runtime.agentId || 'Братан', response);
        if (runtime.showReasoning) {
          renderReasoning(extractReasoningFromPayload(result), extractMetaFromPayload(result), 'websocket');
        }
        appendAgentTrace('Ответ готов', `transport=websocket; chars=${response.length}`);
        selectedChatAttachments = [];
        renderChatAttachments();
        setChatLiveStatus('', false);
        activeRequestId = null;
        return;
      } catch (err) {
        console.error('OpenClaw callAgent error:', err);
        appendAgentTrace('WS ошибка', err.message);
      }
    }

    try {
      await sendViaCliFallback();
      selectedChatAttachments = [];
      renderChatAttachments();
      setChatLiveStatus('', false);
      activeRequestId = null;
    } catch (err) {
      console.error('OpenClaw CLI fallback error:', err);
      stopTypingIndicator();
      setChatLiveStatus('', false);
      clearStreamingMessage(requestId);
      appendAgentTrace('Ошибка ответа', err.message);
      addMessage('Система', 'Ошибка отправки сообщения: ' + err.message);
      activeRequestId = null;
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

  const agentsKnownList = document.getElementById('agents-known-list');
  const agentsSessionsList = document.getElementById('agents-sessions-list');

  function applyRuntimeToChat({ agentId, sessionId }) {
    if (chatAgentIdInput && typeof agentId === 'string') {
      chatAgentIdInput.value = agentId;
    }
    if (chatSessionIdInput && typeof sessionId === 'string' && sessionId.trim()) {
      chatSessionIdInput.value = sessionId;
    }
    persistChatRuntimeSettings();
    showNotification('Параметры агента применены к чату', 'success');
  }

  function renderAgentRuntimeData(agents, sessions) {
    if (agentsKnownList) {
      if (!agents.length) {
        agentsKnownList.innerHTML = '<div class="text-gray-500">Агенты пока не обнаружены</div>';
      } else {
        agentsKnownList.innerHTML = agents
          .map(
            (agent) => `
            <button class="w-full text-left hover:bg-white border rounded px-2 py-1" data-apply-agent="${escapeHtml(agent.agentId)}">
              <span class="font-medium">${escapeHtml(agent.agentId)}</span>
            </button>
          `
          )
          .join('');

        agentsKnownList.querySelectorAll('[data-apply-agent]').forEach((button) => {
          button.addEventListener('click', () => {
            applyRuntimeToChat({
              agentId: button.getAttribute('data-apply-agent') || '',
              sessionId: chatSessionIdInput?.value || 'bratan-desktop-ui',
            });
          });
        });
      }
    }

    if (agentsSessionsList) {
      if (!sessions.length) {
        agentsSessionsList.innerHTML = '<div class="text-gray-500">Нет активных runtime-сессий</div>';
      } else {
        agentsSessionsList.innerHTML = sessions
          .map(
            (session) => `
            <button class="w-full text-left hover:bg-white border rounded px-2 py-1" data-session-id="${escapeHtml(session.sessionId)}" data-session-agent="${escapeHtml(session.agentId || '')}">
              <div class="font-medium">${escapeHtml(session.sessionId)}</div>
              <div class="text-xs text-gray-600">agent: ${escapeHtml(session.agentId || 'default')}</div>
              <div class="text-xs text-gray-500">updated: ${escapeHtml(session.updatedAt || 'unknown')}</div>
            </button>
          `
          )
          .join('');

        agentsSessionsList.querySelectorAll('[data-session-id]').forEach((button) => {
          button.addEventListener('click', () => {
            applyRuntimeToChat({
              agentId: button.getAttribute('data-session-agent') || '',
              sessionId: button.getAttribute('data-session-id') || 'bratan-desktop-ui',
            });
          });
        });
      }
    }
  }

  async function refreshAgentRuntime() {
    try {
      const [agentsResult, sessionsResult] = await Promise.all([
        window.api.openclaw.listAgents(),
        window.api.openclaw.listSessions(),
      ]);

      const agents = Array.isArray(agentsResult?.agents) ? agentsResult.agents : [];
      const sessions = Array.isArray(sessionsResult?.sessions) ? sessionsResult.sessions : [];
      renderAgentRuntimeData(agents, sessions);
      appendAgentTrace('Runtime обновлён', `agents=${agents.length}, sessions=${sessions.length}`);
    } catch (err) {
      if (agentsKnownList) agentsKnownList.innerHTML = '<div class="text-red-600">Ошибка загрузки агентов</div>';
      if (agentsSessionsList) agentsSessionsList.innerHTML = '<div class="text-red-600">Ошибка загрузки сессий</div>';
      appendAgentTrace('Runtime ошибка', err.message);
    }
  }

  const btnRefreshAgentRuntime = document.getElementById('btn-refresh-agent-runtime');
  if (btnRefreshAgentRuntime) {
    btnRefreshAgentRuntime.addEventListener('click', () => {
      void refreshAgentRuntime();
    });
  }

  document.getElementById('tab-agents').addEventListener('click', () => {
    void refreshAgentRuntime();
  });

  const ragSelectedFilesContainer = document.getElementById('rag-selected-files');
  const ragIndexStatus = document.getElementById('rag-index-status');
  const ragDocuments = document.getElementById('rag-documents');
  const ragResults = document.getElementById('rag-results');
  const ragAnswer = document.getElementById('rag-answer');
  const ragLiveStatus = document.getElementById('rag-live-status');
  const ragQueryInput = document.getElementById('rag-query');
  const ragTopKInput = document.getElementById('rag-topk');
  const ragIndexCollectionInput = document.getElementById('rag-index-collection');
  const ragCollectionFilter = document.getElementById('rag-collection-filter');

  let ragSelectedFiles = [];

  function setRagLiveStatus(message = '', visible = false) {
    if (!ragLiveStatus) return;
    ragLiveStatus.textContent = message;
    if (visible && message) {
      ragLiveStatus.classList.remove('hidden');
    } else {
      ragLiveStatus.classList.add('hidden');
    }
  }

  function renderRagSelectedFiles() {
    if (!ragSelectedFilesContainer) return;
    if (!ragSelectedFiles.length) {
      ragSelectedFilesContainer.innerHTML = '<div class="text-gray-500">Файлы не выбраны</div>';
      return;
    }

    ragSelectedFilesContainer.innerHTML = ragSelectedFiles
      .map(
        (file) => `
        <div class="flex items-center justify-between border rounded px-2 py-1 bg-white">
          <span class="truncate">${escapeHtml(file.name)} (${formatBytes(file.size)})</span>
          <button class="text-red-500 hover:text-red-700" data-rag-remove="${escapeHtml(file.path)}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `
      )
      .join('');

    ragSelectedFilesContainer.querySelectorAll('[data-rag-remove]').forEach((button) => {
      button.addEventListener('click', () => {
        const filePath = button.getAttribute('data-rag-remove');
        ragSelectedFiles = ragSelectedFiles.filter((file) => file.path !== filePath);
        renderRagSelectedFiles();
      });
    });
  }

  function renderRagHits(hits) {
    if (!ragResults) return;
    if (!Array.isArray(hits) || hits.length === 0) {
      ragResults.innerHTML = '<div class="text-sm text-gray-500">Совпадения не найдены</div>';
      return;
    }

    ragResults.innerHTML = hits
      .map(
        (hit) => `
        <div class="border rounded p-2 bg-gray-50">
          <div class="text-xs text-gray-500 mb-1">${escapeHtml(hit.name)} · collection ${escapeHtml(hit.collection || 'default')} · chunk ${Number(hit.index) + 1} · score ${hit.score}</div>
          <div class="text-sm whitespace-pre-wrap">${escapeHtml(hit.snippet)}</div>
        </div>
      `
      )
      .join('');
  }

  function renderRagStatus(status) {
    if (!ragIndexStatus || !ragDocuments) return;
    ragIndexStatus.textContent = `Документов: ${status.documentsCount || 0}, chunks: ${status.chunksCount || 0}, обновлён: ${status.updatedAt || '—'}`;

    if (ragCollectionFilter) {
      const previousValue = ragCollectionFilter.value || 'all';
      const collections = Array.isArray(status.collections) ? status.collections : [];
      const options = ['<option value="all">all collections</option>'];
      collections.forEach((collection) => {
        options.push(
          `<option value="${escapeHtml(collection.name)}">${escapeHtml(collection.name)} (${collection.documents})</option>`
        );
      });
      ragCollectionFilter.innerHTML = options.join('');

      const exists = collections.some((collection) => collection.name === previousValue) || previousValue === 'all';
      ragCollectionFilter.value = exists ? previousValue : 'all';
    }

    if (!Array.isArray(status.documents) || status.documents.length === 0) {
      ragDocuments.innerHTML = '<div class="text-gray-500">Индекс пуст</div>';
      return;
    }

    ragDocuments.innerHTML = status.documents
      .map(
        (doc) => `
        <div class="border rounded p-2 bg-white">
          <div class="font-medium text-sm">${escapeHtml(doc.name)}</div>
          <div class="text-xs text-gray-600">collection: ${escapeHtml(doc.collection || 'default')}</div>
          <div class="text-xs text-gray-600">chunks: ${doc.chunks}, size: ${formatBytes(doc.size)}</div>
          <div class="text-xs text-gray-500 truncate">${escapeHtml(doc.path)}</div>
        </div>
      `
      )
      .join('');
  }

  async function refreshRagStatus() {
    try {
      const status = await window.api.rag.status();
      renderRagStatus(status || {});
    } catch (err) {
      if (ragIndexStatus) ragIndexStatus.textContent = `Ошибка загрузки статуса: ${err.message}`;
    }
  }

  document.getElementById('btn-rag-pick-files').addEventListener('click', async () => {
    try {
      const files = await window.api.rag.pickFiles({ multi: true });
      if (!Array.isArray(files) || files.length === 0) return;

      const known = new Set(ragSelectedFiles.map((file) => file.path));
      files.forEach((file) => {
        if (file?.path && !known.has(file.path)) {
          ragSelectedFiles.push(file);
          known.add(file.path);
        }
      });
      renderRagSelectedFiles();
    } catch (err) {
      showNotification('Ошибка выбора файлов для RAG: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-rag-index').addEventListener('click', async () => {
    if (!ragSelectedFiles.length) {
      showNotification('Сначала выберите файлы для индексации', 'warning');
      return;
    }

    try {
      setRagLiveStatus('Индексация файлов...', true);
      const collection = String(ragIndexCollectionInput?.value || 'default').trim() || 'default';
      const result = await window.api.rag.indexFiles({
        files: ragSelectedFiles.map((file) => file.path),
        collection,
      });
      renderRagStatus(result?.status || {});
      const errorCount = Array.isArray(result?.errors) ? result.errors.length : 0;
      showNotification(`RAG индекс обновлён (${collection}): indexed=${result?.indexed || 0}, errors=${errorCount}`, 'success');
    } catch (err) {
      showNotification('Ошибка индексации RAG: ' + err.message, 'error');
    } finally {
      setRagLiveStatus('', false);
    }
  });

  document.getElementById('btn-rag-refresh').addEventListener('click', () => {
    void refreshRagStatus();
  });

  document.getElementById('btn-rag-clear').addEventListener('click', async () => {
    try {
      const status = await window.api.rag.clear();
      renderRagStatus(status || {});
      if (ragResults) ragResults.innerHTML = '';
      if (ragAnswer) ragAnswer.textContent = '';
      showNotification('RAG индекс очищен', 'info');
    } catch (err) {
      showNotification('Ошибка очистки RAG: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-rag-search').addEventListener('click', async () => {
    const query = String(ragQueryInput?.value || '').trim();
    const topK = Number(ragTopKInput?.value || 5);
    const collection = String(ragCollectionFilter?.value || 'all').trim() || 'all';
    if (!query) {
      showNotification('Введите вопрос для RAG поиска', 'warning');
      return;
    }

    try {
      setRagLiveStatus('Ищу релевантные фрагменты...', true);
      const result = await window.api.rag.search({ query, topK, collection });
      renderRagHits(result?.hits || []);
      if (ragAnswer) {
        ragAnswer.textContent = `Найдено фрагментов: ${(result?.hits || []).length} (collection: ${result?.collection || collection})`;
      }
    } catch (err) {
      showNotification('Ошибка RAG поиска: ' + err.message, 'error');
    } finally {
      setRagLiveStatus('', false);
    }
  });

  document.getElementById('btn-rag-ask').addEventListener('click', async () => {
    const query = String(ragQueryInput?.value || '').trim();
    const topK = Number(ragTopKInput?.value || 5);
    const collection = String(ragCollectionFilter?.value || 'all').trim() || 'all';
    if (!query) {
      showNotification('Введите вопрос для RAG запроса', 'warning');
      return;
    }

    try {
      setRagLiveStatus('Готовлю ответ агента по RAG...', true);
      const runtime = getChatRuntimeOptions();
      const requestId = `rag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await window.api.rag.ask({
        query,
        topK,
        collection,
        agentId: runtime.agentId,
        sessionId: runtime.sessionId || 'rag-studio-session',
        thinking: runtime.thinking,
        requestId,
      });

      if (ragAnswer) {
        ragAnswer.textContent = result?.answer || 'Пустой ответ';
      }
      renderRagHits(result?.hits || []);

      if (runtime.showReasoning) {
        renderReasoning(result?.reasoning || [], result?.meta || null, 'rag');
      }
    } catch (err) {
      if (ragAnswer) {
        ragAnswer.textContent = `Ошибка: ${err.message}`;
      }
      showNotification('Ошибка RAG ответа: ' + err.message, 'error');
    } finally {
      setRagLiveStatus('', false);
    }
  });

  document.getElementById('tab-rag').addEventListener('click', () => {
    void refreshRagStatus();
    renderRagSelectedFiles();
  });

  document.getElementById('btn-rag-export').addEventListener('click', async () => {
    try {
      const result = await window.api.rag.exportIndex({});
      if (result?.canceled) return;
      showNotification(`RAG экспортирован: ${result?.filePath || 'unknown file'}`, 'success');
    } catch (err) {
      showNotification('Ошибка экспорта RAG: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-rag-import').addEventListener('click', async () => {
    try {
      const result = await window.api.rag.importIndex({ mode: 'replace' });
      if (result?.canceled) return;
      renderRagStatus(result?.status || {});
      showNotification(`RAG импортирован: ${result?.filePath || 'unknown file'}`, 'success');
    } catch (err) {
      showNotification('Ошибка импорта RAG: ' + err.message, 'error');
    }
  });

  // Settings
  function loadUISettings() {
    const savedFontSize = Number(localStorage.getItem('openclaw_font_size')) || 16;
    const savedTheme = localStorage.getItem('openclaw_theme') || 'light';
    const savedAutostart = localStorage.getItem('openclaw_autostart') === 'true';
    const savedNotifications = localStorage.getItem('openclaw_notifications') !== 'false';
    const savedSound = localStorage.getItem('openclaw_sound') !== 'false';
    const savedGatewayPort = Number(localStorage.getItem('openclaw_gateway_port')) || 18789;
    const savedCliPath = localStorage.getItem('openclaw_cli_path') ?? '';
    const savedChatAgentId = localStorage.getItem('openclaw_chat_agent_id') || '';
    const savedChatSessionId = localStorage.getItem('openclaw_chat_session_id') || 'bratan-desktop-ui';
    const savedChatThinking = localStorage.getItem('openclaw_chat_thinking') || 'medium';
    const savedShowReasoning = localStorage.getItem('openclaw_chat_show_reasoning') !== 'false';

    settingFontSize.value = savedFontSize;
    fontSizeValue.textContent = `${savedFontSize}px`;
    document.documentElement.style.fontSize = `${savedFontSize}px`;

    document.getElementById('setting-theme').value = savedTheme;
    document.getElementById('setting-autostart').checked = savedAutostart;
    document.getElementById('setting-notifications').checked = savedNotifications;
    document.getElementById('setting-sound').checked = savedSound;
    document.getElementById('setting-gateway-port').value = String(savedGatewayPort);
    document.getElementById('setting-cli-path').value = savedCliPath;

    if (chatAgentIdInput) chatAgentIdInput.value = savedChatAgentId;
    if (chatSessionIdInput) chatSessionIdInput.value = savedChatSessionId;
    if (chatThinkingSelect) chatThinkingSelect.value = savedChatThinking;
    if (chatShowReasoningCheckbox) chatShowReasoningCheckbox.checked = savedShowReasoning;

    // Update gateway status if port changed
    if (openClawWS && openClawWS.gatewayPort !== savedGatewayPort) {
      openClawWS.disconnect();
      openClawWS = null;
      initOpenClawWebSocket();
    }
  }

  const settingFontSize = document.getElementById('setting-font-size');
  const fontSizeValue = document.getElementById('font-size-value');
  settingFontSize.addEventListener('input', () => {
    fontSizeValue.textContent = `${settingFontSize.value}px`;
    document.documentElement.style.fontSize = `${settingFontSize.value}px`;
  });

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    localStorage.setItem('openclaw_font_size', document.getElementById('setting-font-size').value);
    localStorage.setItem('openclaw_theme', document.getElementById('setting-theme').value);
    localStorage.setItem('openclaw_autostart', document.getElementById('setting-autostart').checked);
    localStorage.setItem('openclaw_notifications', document.getElementById('setting-notifications').checked);
    localStorage.setItem('openclaw_sound', document.getElementById('setting-sound').checked);
    localStorage.setItem('openclaw_gateway_port', document.getElementById('setting-gateway-port').value);
    localStorage.setItem('openclaw_cli_path', document.getElementById('setting-cli-path').value);

    showNotification('Настройки сохранены', 'success');

    // Re-initialize WebSocket if port changed
    const port = Number(document.getElementById('setting-gateway-port').value);
    if (openClawWS && openClawWS.gatewayPort !== port) {
      openClawWS.disconnect();
      openClawWS = null;
      initOpenClawWebSocket();
    }

    void syncOpenClawConfig().then(() => {
      void initWorkspacePath().then(() => refreshFileList());
      return refreshTransportStatus();
    });
  });

  document.getElementById('btn-reset-settings').addEventListener('click', () => {
    settingFontSize.value = 16;
    fontSizeValue.textContent = '16px';
    document.documentElement.style.fontSize = '16px';
    document.getElementById('setting-autostart').checked = false;
    document.getElementById('setting-notifications').checked = true;
    document.getElementById('setting-sound').checked = true;
    document.getElementById('setting-theme').value = 'light';
    document.getElementById('setting-cli-path').value = '';
    document.getElementById('setting-gateway-port').value = '18789';

    localStorage.removeItem('openclaw_font_size');
    localStorage.removeItem('openclaw_theme');
    localStorage.removeItem('openclaw_autostart');
    localStorage.removeItem('openclaw_notifications');
    localStorage.removeItem('openclaw_sound');
    localStorage.removeItem('openclaw_gateway_port');
    localStorage.removeItem('openclaw_cli_path');
    localStorage.removeItem('openclaw_chat_agent_id');
    localStorage.removeItem('openclaw_chat_session_id');
    localStorage.removeItem('openclaw_chat_thinking');
    localStorage.removeItem('openclaw_chat_show_reasoning');

    if (chatAgentIdInput) chatAgentIdInput.value = '';
    if (chatSessionIdInput) chatSessionIdInput.value = 'bratan-desktop-ui';
    if (chatThinkingSelect) chatThinkingSelect.value = 'medium';
    if (chatShowReasoningCheckbox) chatShowReasoningCheckbox.checked = true;

    showNotification('Настройки сброшены', 'info');

    openClawWS?.disconnect();
    openClawWS = null;
    initOpenClawWebSocket();
    void syncOpenClawConfig().then(() => {
      void initWorkspacePath().then(() => refreshFileList());
      return refreshTransportStatus();
    });
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
  const githubStatusLabel = document.getElementById('github-status');
  const githubStatusDot = githubStatusLabel ? githubStatusLabel.previousElementSibling : null;
  const githubReposStatus = document.getElementById('github-repos-status');
  const githubReposList = document.getElementById('github-repos-list');
  const githubSearchQueryInput = document.getElementById('github-search-query');

  function setGithubAuthStatus(isAuthorized) {
    if (!githubStatusLabel || !githubStatusDot) return;
    githubStatusLabel.textContent = isAuthorized ? 'Авторизован' : 'Не авторизован';
    githubStatusDot.classList.remove('bg-red-500', 'bg-green-500');
    githubStatusDot.classList.add(isAuthorized ? 'bg-green-500' : 'bg-red-500');
  }

  function setGithubReposStatus(message, isError = false) {
    if (!githubReposStatus) return;
    githubReposStatus.textContent = message;
    githubReposStatus.classList.remove('text-gray-600', 'text-red-600');
    githubReposStatus.classList.add(isError ? 'text-red-600' : 'text-gray-600');
  }

  function renderGithubRepos(repos, contextLabel) {
    if (!githubReposList) return;

    if (!Array.isArray(repos) || repos.length === 0) {
      githubReposList.innerHTML = '<div class="text-sm text-gray-500">Репозитории не найдены</div>';
      return;
    }

    const scope = contextLabel ? ` (${escapeHtml(contextLabel)})` : '';
    setGithubReposStatus(`Найдено ${repos.length} репозиториев${scope}`);

    githubReposList.innerHTML = repos
      .map((repo) => {
        const description = repo.description ? escapeHtml(repo.description) : 'Без описания';
        const language = repo.language ? escapeHtml(repo.language) : '—';
        const stars = Number(repo.stars) || 0;
        const forks = Number(repo.forks) || 0;
        const updated = repo.updated ? new Date(repo.updated).toLocaleDateString() : '—';
        const visibility = repo.isPrivate ? 'private' : 'public';
        const safeUrl = escapeHtml(repo.url || '#');

        return `
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="block border rounded bg-white p-3 hover:border-gray-400 transition-colors">
            <div class="flex items-center justify-between gap-2">
              <div class="font-medium text-sm truncate">${escapeHtml(repo.fullName || repo.name || 'unknown')}</div>
              <div class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">${visibility}</div>
            </div>
            <div class="text-xs text-gray-600 mt-1 line-clamp-2">${description}</div>
            <div class="text-xs text-gray-500 mt-2 flex items-center gap-3">
              <span><i class="fas fa-code mr-1"></i>${language}</span>
              <span><i class="fas fa-star mr-1"></i>${stars}</span>
              <span><i class="fas fa-code-branch mr-1"></i>${forks}</span>
              <span>Updated ${updated}</span>
            </div>
          </a>
        `;
      })
      .join('');
  }

  async function syncGithubAuthorizationState() {
    try {
      const result = await window.api.github.init();
      const initialized = Boolean(result?.initialized);
      setGithubAuthStatus(initialized);

      if (initialized) {
        setGithubReposStatus('GitHub авторизован. Нажмите "Мои репозитории", чтобы загрузить список.');
      } else {
        setGithubReposStatus('Укажите GitHub token, чтобы загрузить репозитории.');
      }
    } catch (err) {
      setGithubAuthStatus(false);
      setGithubReposStatus(`Ошибка проверки GitHub: ${err.message}`, true);
    }
  }

  document.getElementById('btn-github-auth').addEventListener('click', async () => {
    const token = document.getElementById('github-token').value.trim();
    if (!token) {
      showNotification('Введите GitHub токен', 'warning');
      return;
    }
    try {
      const result = await window.api.github.init(token);
      if (!result?.initialized) {
        throw new Error('Токен не принят GitHub API');
      }

      setGithubAuthStatus(true);
      document.getElementById('github-token').value = '';
      setGithubReposStatus('Токен сохранён. Теперь можно загрузить репозитории.');
      showNotification('GitHub авторизован успешно', 'success');
    } catch (err) {
      setGithubAuthStatus(false);
      setGithubReposStatus('Не удалось авторизоваться в GitHub', true);
      showNotification('Ошибка GitHub: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-github-repos').addEventListener('click', async () => {
    try {
      setGithubReposStatus('Загружаю ваши репозитории...');
      const repos = await window.api.github.userRepos('updated', 'desc');
      renderGithubRepos(repos, 'ваши');
      showNotification(`Загружено ${repos.length} репозиториев`, 'success');
    } catch (err) {
      setGithubReposStatus(`Ошибка загрузки репозиториев: ${err.message}`, true);
      if (githubReposList) {
        githubReposList.innerHTML = '<div class="text-sm text-red-600">Не удалось загрузить список репозиториев.</div>';
      }
      showNotification('Ошибка загрузки репозиториев: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-github-search').addEventListener('click', async () => {
    const query = String(githubSearchQueryInput?.value || '').trim();
    if (!query) {
      showNotification('Введите запрос для поиска репозиториев', 'warning');
      return;
    }

    try {
      setGithubReposStatus(`Поиск GitHub: ${query}`);
      const repos = await window.api.github.searchRepos(query, {
        sort: 'stars',
        order: 'desc',
        perPage: 50,
      });
      renderGithubRepos(repos, `поиск: ${query}`);
      showNotification(`Найдено ${repos.length} репозиториев`, 'success');
    } catch (err) {
      setGithubReposStatus(`Ошибка поиска: ${err.message}`, true);
      if (githubReposList) {
        githubReposList.innerHTML = '<div class="text-sm text-red-600">Поиск репозиториев завершился ошибкой.</div>';
      }
      showNotification('Ошибка поиска репозиториев: ' + err.message, 'error');
    }
  });

  if (githubSearchQueryInput) {
    githubSearchQueryInput.addEventListener('keypress', (event) => {
      if (event.key === 'Enter') {
        document.getElementById('btn-github-search').click();
      }
    });
  }

  void syncGithubAuthorizationState();

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

  // OpenClaw WebSocket real-time integration
  let openClawWS = null;

  function getSavedGatewayPort() {
    const saved = Number(localStorage.getItem('openclaw_gateway_port'));
    return Number.isInteger(saved) && saved > 0 ? saved : 18789;
  }

  function initOpenClawWebSocket() {
    if (openClawWS) {
      console.warn('OpenClaw WebSocket already initialized');
      return;
    }

    try {
      openClawWS = new OpenClawWebSocket({
        gatewayPort: getSavedGatewayPort(),
        maxReconnectAttempts: 20,
        reconnectDelay: 1000,
        heartbeatInterval: 30000,
      });

      openClawWS.on('open', async () => {
        console.log('OpenClaw WebSocket connected');
        updateConnectionStatus('connected');

        try {
          await openClawWS.hello();
          const storedToken = localStorage.getItem('openclaw_auth_token');
          if (storedToken) {
            await openClawWS.auth(storedToken);
            showNotification('OpenClaw авторизован', 'success');
          }
        } catch (err) {
          console.warn('OpenClaw WebSocket auth failed:', err);
          showNotification('Ошибка аутентификации OpenClaw', 'error');
        }
      });

      openClawWS.on('close', () => {
        console.log('OpenClaw WebSocket disconnected');
        void refreshTransportStatus();
      });

      openClawWS.on('error', (err) => {
        console.error('OpenClaw WebSocket error:', err);
        void refreshTransportStatus();
      });

      openClawWS.on('notification', (data) => {
        const method = String(data?.method || '').toLowerCase();
        if (method.includes('typing') || method.includes('progress') || method.includes('thinking')) {
          const stageText = typeof data?.params === 'string' ? data.params : data?.params?.text || 'Агент готовит ответ...';
          setChatLiveStatus(stageText, true);
          updateTypingIndicator(stageText);
          appendAgentTrace('WS progress', stageText);
          return;
        }

        if (data.method === 'message' && data.params) {
          const messageText = typeof data.params === 'string' ? data.params : data.params.text || JSON.stringify(data.params);
          addMessage('Братан', messageText);
          stopTypingIndicator();
          setChatLiveStatus('', false);
          appendAgentTrace('WS notification', `chars=${messageText.length}`);
        }
      });

      openClawWS.on('message', (data) => {
        // Raw messages for debug, keep history
        console.log('OpenClaw raw message:', data);
      });

      openClawWS.on('statusChange', ({ previous, current }) => {
        console.log(`OpenClaw WebSocket status changed: ${previous} -> ${current}`);
        if (current === 'connected' || current === 'connecting' || current === 'offline') {
          updateConnectionStatus(current);
        } else {
          void refreshTransportStatus();
        }
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
      cli: 'Онлайн через CLI',
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
    } else if (status === 'cli') {
      statusEl.classList.add('bg-blue-100', 'text-blue-800');
    } else if (status === 'connecting') {
      statusEl.classList.add('bg-yellow-100', 'text-yellow-800');
    } else if (status === 'offline') {
      statusEl.classList.add('bg-orange-100', 'text-orange-800');
    } else {
      statusEl.classList.add('bg-red-100', 'text-red-800');
    }
  }

  // Graceful shutdown on window close
  window.addEventListener('beforeunload', () => {
    if (openClawWS) {
      openClawWS.disconnect();
    }
    if (window.api && typeof window.api.removeOpenClawStreamListener === 'function') {
      window.api.removeOpenClawStreamListener();
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
  loadUISettings();
  renderChatAttachments();
  renderRagSelectedFiles();
  if (chatReasoningOutput) chatReasoningOutput.textContent = 'Reasoning появится после следующего ответа агента.';
  if (agentReasoningOutput) agentReasoningOutput.textContent = 'Reasoning появится после следующего ответа агента.';
  if (agentTraceLog) agentTraceLog.innerHTML = '<div class="text-xs text-gray-500">Trace пока пуст</div>';

  void syncOpenClawConfig().then(() => {
    initOpenClawWebSocket();
    void initWorkspacePath().then(() => refreshFileList());
    void refreshTransportStatus();
    void refreshAgentRuntime();
    void refreshRagStatus();
  });
  updateGatewayStatus(false);
  showNotification('Братан Desktop запущен', 'info');

  // Keyboard shortcuts for accessibility
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
      const tabIndex = parseInt(e.key) - 1;
      const tabs = ['chat', 'logs', 'files', 'agents', 'rag', 'integrations', 'settings'];
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
