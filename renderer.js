// Renderer process logic for Братан Desktop

function initRenderer() {
  window.api.log('info', 'Renderer initialized');

  // Tab switching
  const tabs = {
    'tab-chat': { title: 'Чат с Братаном', content: 'content-chat' },
    'tab-logs': { title: 'Логи агентов', content: 'content-logs' },
    'tab-files': { title: 'Файловый браузер', content: 'content-files' },
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
  const openClawVersionInstalled = document.getElementById('openclaw-version-installed');
  const openClawVersionLatest = document.getElementById('openclaw-version-latest');
  const openClawVersionChannel = document.getElementById('openclaw-version-channel');
  const openClawUpdateState = document.getElementById('openclaw-update-state');
  const openClawUpdateChannelSelect = document.getElementById('openclaw-update-channel');
  const btnOpenClawUpdate = document.getElementById('btn-openclaw-update');
  const openClawModelSelect = document.getElementById('openclaw-model-select');
  const btnOpenClawModelApply = document.getElementById('btn-openclaw-model-apply');
  const openClawModelStateLabel = document.getElementById('openclaw-model-state');
  const chatExecutionModeState = document.getElementById('chat-execution-mode-state');

  function setChatExecutionModeIndicator(mode, detail = '') {
    if (!chatExecutionModeState) return;

    const normalized = String(mode || '').trim().toLowerCase() || 'auto';
    const labels = {
      auto: 'Chat mode: auto',
      pending: 'Chat mode: auto (processing)',
      gateway: 'Chat mode: gateway',
      local: 'Chat mode: local',
      websocket: 'Chat mode: websocket',
      cli: 'Chat mode: cli',
      error: 'Chat mode: error',
    };

    const baseLabel = labels[normalized] || `Chat mode: ${normalized}`;
    chatExecutionModeState.textContent = detail ? `${baseLabel} · ${detail}` : baseLabel;

    chatExecutionModeState.classList.remove(
      'text-gray-600',
      'text-blue-700',
      'text-emerald-700',
      'text-indigo-700',
      'text-red-700',
      'bg-gray-50',
      'bg-blue-50',
      'bg-emerald-50',
      'bg-indigo-50',
      'bg-red-50'
    );

    if (normalized === 'local') {
      chatExecutionModeState.classList.add('text-emerald-700', 'bg-emerald-50');
    } else if (normalized === 'gateway') {
      chatExecutionModeState.classList.add('text-blue-700', 'bg-blue-50');
    } else if (normalized === 'websocket') {
      chatExecutionModeState.classList.add('text-indigo-700', 'bg-indigo-50');
    } else if (normalized === 'error') {
      chatExecutionModeState.classList.add('text-red-700', 'bg-red-50');
    } else {
      chatExecutionModeState.classList.add('text-gray-600', 'bg-gray-50');
    }
  }

  setChatExecutionModeIndicator('auto');

  function isKnownOpenClawChannel(value) {
    return ['stable', 'beta', 'dev'].includes(String(value || '').toLowerCase());
  }

  function getSelectedOpenClawChannel() {
    if (!openClawUpdateChannelSelect) {
      return 'stable';
    }

    const selected = String(openClawUpdateChannelSelect.value || '').toLowerCase();
    return isKnownOpenClawChannel(selected) ? selected : 'stable';
  }

  function setSelectedOpenClawChannel(channel, persist = true) {
    const normalized = isKnownOpenClawChannel(channel) ? String(channel).toLowerCase() : 'stable';
    if (openClawUpdateChannelSelect) {
      openClawUpdateChannelSelect.value = normalized;
    }

    if (persist) {
      localStorage.setItem('openclaw_update_channel', normalized);
    }

    return normalized;
  }

  const initialSavedOpenClawChannel = String(localStorage.getItem('openclaw_update_channel') || '').toLowerCase();
  setSelectedOpenClawChannel(initialSavedOpenClawChannel, false);

  let openClawVersionState = {
    installedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    inProgress: false,
    channel: null,
  };
  let openClawVersionLoading = false;
  let openClawModelLoading = false;
  let openClawModelApplying = false;
  let openClawModelsCatalog = new Map();
  let openClawModelUiState = {
    models: [],
    currentModel: null,
    resolvedModel: null,
    selectedModel: null,
  };

  function setOpenClawVersionUi(state = {}) {
    const installed = state.installedVersion || '—';
    const latest = state.latestVersion || '—';
    const channel = state.channel ? `(${state.channel})` : '';

    if (openClawVersionInstalled) {
      openClawVersionInstalled.textContent = `installed: ${installed}`;
    }
    if (openClawVersionLatest) {
      openClawVersionLatest.textContent = `latest: ${latest}`;
    }
    if (openClawVersionChannel) {
      openClawVersionChannel.textContent = channel;
    }

    if (openClawUpdateState) {
      if (state.loading) {
        openClawUpdateState.textContent = 'Проверка версий...';
      } else if (state.inProgress) {
        openClawUpdateState.textContent = 'Обновление OpenClaw...';
      } else if (state.updateAvailable) {
        openClawUpdateState.textContent = 'Доступно обновление';
      } else if (state.installedVersion && state.latestVersion) {
        openClawUpdateState.textContent = 'Версия актуальна';
      } else {
        openClawUpdateState.textContent = 'Статус версии недоступен';
      }
    }

    if (btnOpenClawUpdate) {
      const disabled = Boolean(state.loading || state.inProgress);
      btnOpenClawUpdate.disabled = disabled;
      btnOpenClawUpdate.classList.toggle('opacity-60', disabled);
      btnOpenClawUpdate.classList.toggle('cursor-not-allowed', disabled);
      const actionLabel = state.inProgress ? 'Обновляется...' : state.updateAvailable ? 'Обновить' : 'Проверить';
      btnOpenClawUpdate.innerHTML = `<i class="fas fa-download mr-1"></i> ${actionLabel}`;
    }

    if (openClawUpdateChannelSelect) {
      const disabled = Boolean(state.loading || state.inProgress);
      openClawUpdateChannelSelect.disabled = disabled;
      openClawUpdateChannelSelect.classList.toggle('opacity-60', disabled);
      openClawUpdateChannelSelect.classList.toggle('cursor-not-allowed', disabled);
    }
  }

  function normalizeModelKey(value) {
    return String(value || '').trim().toLowerCase();
  }

  function formatModelOptionLabel(model) {
    const key = String(model?.key || '').trim();
    const name = String(model?.name || key).trim();
    const contextWindow = Number(model?.contextWindow);
    const contextText = Number.isFinite(contextWindow) && contextWindow > 0
      ? `${contextWindow.toLocaleString('ru-RU')} ctx`
      : 'ctx ?';

    if (name && name !== key) {
      return `${name} (${key}) | ${contextText}`;
    }

    return `${key || 'unknown'} | ${contextText}`;
  }

  function setOpenClawModelUi(state = {}) {
    const models = Array.isArray(state.models) ? state.models : [];
    const selectedModel =
      String(state.selectedModel || '').trim() ||
      String(state.resolvedModel || '').trim() ||
      String(state.currentModel || '').trim();

    if (openClawModelSelect) {
      if (!models.length) {
        openClawModelSelect.innerHTML = '<option value="">Модели не найдены</option>';
        openClawModelSelect.value = '';
      } else {
        openClawModelSelect.innerHTML = models
          .map((model) => {
            const key = String(model?.key || '').trim();
            const disabled = model?.available === false || model?.missing === true;
            const selectedAttr = key === selectedModel ? ' selected' : '';
            const disabledAttr = disabled ? ' disabled' : '';
            const availabilitySuffix = disabled ? ' [unavailable]' : '';
            return `<option value="${escapeHtml(key)}"${selectedAttr}${disabledAttr}>${escapeHtml(formatModelOptionLabel(model) + availabilitySuffix)}</option>`;
          })
          .join('');

        if (!openClawModelSelect.value && models[0]?.key) {
          openClawModelSelect.value = models[0].key;
        }
      }

      const isDisabled = Boolean(state.loading || state.applying || !models.length);
      openClawModelSelect.disabled = isDisabled;
      openClawModelSelect.classList.toggle('opacity-60', isDisabled);
      openClawModelSelect.classList.toggle('cursor-not-allowed', isDisabled);
    }

    if (btnOpenClawModelApply) {
      const disabled = Boolean(state.loading || state.applying || !models.length);
      btnOpenClawModelApply.disabled = disabled;
      btnOpenClawModelApply.classList.toggle('opacity-60', disabled);
      btnOpenClawModelApply.classList.toggle('cursor-not-allowed', disabled);
      btnOpenClawModelApply.textContent = state.applying ? 'Применяю...' : 'Применить модель';
    }

    if (openClawModelStateLabel) {
      if (state.loading) {
        openClawModelStateLabel.textContent = 'Модели: загрузка...';
      } else if (state.applying) {
        openClawModelStateLabel.textContent = 'Модели: применяю...';
      } else if (state.resolvedModel || state.currentModel) {
        const active = String(state.resolvedModel || state.currentModel);
        const model = openClawModelsCatalog.get(normalizeModelKey(active));
        const contextWindow = Number(model?.contextWindow);
        const contextText = Number.isFinite(contextWindow) && contextWindow > 0
          ? ` · ${contextWindow.toLocaleString('ru-RU')} ctx`
          : '';
        openClawModelStateLabel.textContent = `Модель: ${active}${contextText}`;
      } else {
        openClawModelStateLabel.textContent = 'Модель не определена';
      }
    }
  }

  async function refreshOpenClawModels(options = {}) {
    if (openClawModelLoading) {
      return;
    }

    openClawModelLoading = true;
    setOpenClawModelUi({ ...openClawModelUiState, loading: true, applying: openClawModelApplying });
    try {
      const payload = await window.api.openclaw.listModels();
      const models = Array.isArray(payload?.models) ? payload.models : [];
      openClawModelsCatalog = new Map(
        models
          .filter((model) => model && typeof model === 'object' && model.key)
          .map((model) => [normalizeModelKey(model.key), model])
      );

      const selectedFromUi = String(openClawModelSelect?.value || '').trim();
      const selectedModel =
        String(payload?.resolvedModel || '').trim() ||
        String(payload?.currentModel || '').trim() ||
        selectedFromUi ||
        String(models[0]?.key || '').trim() ||
        null;

      openClawModelUiState = {
        models,
        currentModel: String(payload?.currentModel || '').trim() || null,
        resolvedModel: String(payload?.resolvedModel || '').trim() || null,
        selectedModel,
      };

      setOpenClawModelUi({ ...openClawModelUiState, loading: false, applying: false });

      if (options.notify) {
        showNotification(`Моделей доступно: ${models.length}`, 'info');
      }
    } catch (err) {
      setOpenClawModelUi({ ...openClawModelUiState, loading: false, applying: false });
      if (options.notify) {
        showNotification('Ошибка загрузки списка моделей: ' + err.message, 'error');
      }
    } finally {
      openClawModelLoading = false;
    }
  }

  async function applySelectedOpenClawModel() {
    if (openClawModelApplying || openClawModelLoading) {
      return;
    }

    const model = String(openClawModelSelect?.value || '').trim();
    if (!model) {
      showNotification('Выберите модель OpenClaw', 'warning');
      return;
    }

    openClawModelApplying = true;
    setOpenClawModelUi({ ...openClawModelUiState, selectedModel: model, applying: true, loading: false });
    try {
      const payload = await window.api.openclaw.setModel({ model });
      const models = Array.isArray(payload?.models) ? payload.models : openClawModelUiState.models;
      openClawModelsCatalog = new Map(
        models
          .filter((entry) => entry && typeof entry === 'object' && entry.key)
          .map((entry) => [normalizeModelKey(entry.key), entry])
      );

      openClawModelUiState = {
        models,
        currentModel: String(payload?.currentModel || model).trim() || model,
        resolvedModel: String(payload?.resolvedModel || model).trim() || model,
        selectedModel: String(payload?.resolvedModel || model).trim() || model,
      };

      setOpenClawModelUi({ ...openClawModelUiState, loading: false, applying: false });
      showNotification(`Модель переключена: ${openClawModelUiState.resolvedModel || model}`, 'success');
      appendAgentTrace('Model switched', `active=${openClawModelUiState.resolvedModel || model}`);
      void refreshOpenClawVersionInfo();
      void syncModelProviderFromActiveModel({
        modelKey: openClawModelUiState.resolvedModel || model,
        autofillToken: true,
      });
    } catch (err) {
      showNotification('Ошибка переключения модели: ' + err.message, 'error');
      setOpenClawModelUi({ ...openClawModelUiState, loading: false, applying: false });
    } finally {
      openClawModelApplying = false;
    }
  }

  async function refreshOpenClawVersionInfo(options = {}) {
    if (openClawVersionLoading) {
      return;
    }

    openClawVersionLoading = true;
    setOpenClawVersionUi({ ...openClawVersionState, loading: true });
    try {
      const info = await window.api.openclaw.versionInfo();
      if (!isKnownOpenClawChannel(localStorage.getItem('openclaw_update_channel')) && isKnownOpenClawChannel(info?.channel)) {
        setSelectedOpenClawChannel(info.channel, true);
      }

      const selectedChannel = getSelectedOpenClawChannel();
      openClawVersionState = {
        installedVersion: info?.installedVersion || null,
        latestVersion: info?.latestVersion || null,
        updateAvailable: Boolean(info?.updateAvailable),
        inProgress: Boolean(info?.inProgress),
        channel: info?.channel || null,
      };

      // Dry-run preview allows checking another update channel without applying changes.
      if (selectedChannel && selectedChannel !== openClawVersionState.channel) {
        try {
          const preview = await window.api.openclaw.update({
            dryRun: true,
            restart: false,
            channel: selectedChannel,
            timeoutSeconds: 120,
          });

          const previewCurrent = preview?.currentVersion || openClawVersionState.installedVersion;
          const previewTarget = preview?.targetVersion || openClawVersionState.latestVersion;
          openClawVersionState = {
            ...openClawVersionState,
            installedVersion: previewCurrent,
            latestVersion: previewTarget,
            updateAvailable: Boolean(previewCurrent && previewTarget && previewCurrent !== previewTarget),
            channel: preview?.effectiveChannel || selectedChannel,
          };
        } catch (previewErr) {
          console.warn('OpenClaw channel preview failed:', previewErr);
        }
      }

      setOpenClawVersionUi(openClawVersionState);

      if (options.notify) {
        const effectiveChannel = openClawVersionState.channel || selectedChannel;
        if (openClawVersionState.updateAvailable) {
          showNotification(
            `Доступно обновление OpenClaw (${effectiveChannel}): ${openClawVersionState.installedVersion || 'unknown'} -> ${openClawVersionState.latestVersion || 'latest'}`,
            'info'
          );
        } else {
          showNotification(`OpenClaw актуален (${effectiveChannel}): ${openClawVersionState.installedVersion || 'unknown'}`, 'success');
        }
      }
    } catch (err) {
      setOpenClawVersionUi({ ...openClawVersionState, loading: false });
      if (options.notify) {
        showNotification('Ошибка проверки версии OpenClaw: ' + err.message, 'error');
      }
    } finally {
      openClawVersionLoading = false;
    }
  }

  if (openClawUpdateChannelSelect) {
    openClawUpdateChannelSelect.addEventListener('change', () => {
      const selectedChannel = setSelectedOpenClawChannel(getSelectedOpenClawChannel(), true);
      openClawVersionState = { ...openClawVersionState, channel: selectedChannel };
      setOpenClawVersionUi(openClawVersionState);
      void refreshOpenClawVersionInfo({ notify: true });
    });
  }

  if (openClawModelSelect) {
    openClawModelSelect.addEventListener('change', () => {
      const selectedModel = String(openClawModelSelect.value || '').trim() || null;
      openClawModelUiState = {
        ...openClawModelUiState,
        selectedModel,
      };
      setOpenClawModelUi({ ...openClawModelUiState, loading: false, applying: openClawModelApplying });
      void syncModelProviderFromActiveModel({
        modelKey: selectedModel,
        autofillToken: true,
      });
    });
  }

  if (btnOpenClawModelApply) {
    btnOpenClawModelApply.addEventListener('click', () => {
      void applySelectedOpenClawModel();
    });
  }

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

      const requestId = String(data.requestId || '').trim();
      if (requestId) {
        if (activeRequestId && requestId !== activeRequestId) {
          return;
        }
        if (!activeRequestId && !requestThreadMap.has(requestId)) {
          return;
        }
      }

      const runtime = getChatRuntimeOptions();
      const phase = String(data.phase || '').toLowerCase();
      const message = String(data.message || '').trim();

      if (phase === 'queued' || phase === 'context-prepared') {
        const statusText = message || 'Обработка запроса...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI progress', statusText);
        setChatExecutionModeIndicator('pending');
        return;
      }

      if (phase === 'gateway-ready') {
        const statusText = message || 'Gateway доступен. Отправляю запрос.';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI progress', statusText);
        if (statusText.toLowerCase().includes('local mode')) {
          setChatExecutionModeIndicator('local');
        } else {
          setChatExecutionModeIndicator('gateway');
        }
        return;
      }

      if (phase === 'thinking-adjusted') {
        const statusText = message || 'Снижаю thinking до minimal для стабильности ответа...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI thinking adjusted', statusText);
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
        showNotification('Агент не ответил — переключаюсь на default agent.', 'warning');
        if (statusText.toLowerCase().includes('local mode')) {
          setChatExecutionModeIndicator('local');
        }
        return;
      }

      if (phase === 'timeout-retry') {
        const statusText = message || 'Слишком долгий reasoning. Повторяю запрос с thinking=off...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('CLI timeout retry', statusText);
        return;
      }

      if (phase === 'session-retry') {
        const statusText = message || 'Сессия заблокирована. Повторяю запрос с новой сессией...';
        setChatLiveStatus(statusText, true);
        updateTypingIndicator(statusText);
        appendAgentTrace('Session retry', statusText);
        showNotification('Сессия накрылась — автоматически создаю новую и повторяю запрос.', 'warning');
        setChatExecutionModeIndicator('pending', 'session recovery');
        return;
      }

      if (phase === 'gateway-restart') {
        showNotification('Gateway упал (1006) — перезапускаю в фоне...', 'warning');
        updateGatewayStatus(false);
        appendAgentTrace('Gateway auto-restart', message || 'перезапуск после сбоя 1006');
        setChatExecutionModeIndicator('local', 'gateway restart');
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
        setChatExecutionModeIndicator('error');
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
  // Cache of last resolved agent records (includes workspacePath from CLI)
  let lastKnownAgentsList = [];

  function getPathRoot(targetPath) {
    const value = String(targetPath || '');
    const uncMatch = value.match(/^(\/\/[^/]+\/[^/]+)(?:\/|$)/);
    if (uncMatch) {
      return `${uncMatch[1]}/`;
    }

    const driveMatch = value.match(/^([A-Za-z]:)(?:\/|$)/);
    if (driveMatch) {
      return `${driveMatch[1]}/`;
    }

    if (value.startsWith('/')) {
      return '/';
    }

    return '';
  }

  function normalizeFsPath(value) {
    const input = String(value || '').trim();
    if (!input) {
      return '';
    }

    let normalized = input.replace(/\\/g, '/');
    if (normalized.startsWith('//')) {
      normalized = `//${normalized.slice(2).replace(/\/+/g, '/')}`;
    } else {
      normalized = normalized.replace(/\/+/g, '/');
    }

    const driveOnlyMatch = normalized.match(/^([A-Za-z]:)$/);
    if (driveOnlyMatch) {
      normalized = `${driveOnlyMatch[1]}/`;
    }

    const root = getPathRoot(normalized);
    if (normalized.length > root.length) {
      normalized = normalized.replace(/\/+$/, '');
    }

    return normalized;
  }

  function pathsEqual(left, right) {
    return normalizeFsPath(left).toLowerCase() === normalizeFsPath(right).toLowerCase();
  }

  function getPathSegments(targetPath) {
    const normalized = normalizeFsPath(targetPath);
    const root = getPathRoot(normalized);
    const rest = root ? normalized.slice(root.length) : normalized;
    return rest.split('/').filter(Boolean);
  }

  function joinNormalizedPath(root, segments) {
    const safeSegments = Array.isArray(segments) ? segments.filter(Boolean) : [];
    if (!root) {
      return safeSegments.join('/');
    }
    if (!safeSegments.length) {
      return root;
    }
    return `${root}${safeSegments.join('/')}`;
  }

  function isPathRoot(targetPath) {
    const normalized = normalizeFsPath(targetPath);
    const root = getPathRoot(normalized);
    return Boolean(root) && pathsEqual(normalized, root);
  }

  function getParentDirectory(targetPath) {
    const normalized = normalizeFsPath(targetPath);
    if (!normalized) {
      return normalizeFsPath(workspaceRootPath);
    }

    const root = getPathRoot(normalized);
    if (root && pathsEqual(normalized, root)) {
      return root;
    }

    const segments = getPathSegments(normalized);
    if (!segments.length) {
      return root || normalized;
    }

    segments.pop();
    if (!segments.length) {
      return root || normalized;
    }

    return joinNormalizedPath(root, segments);
  }

  function setCurrentDirectory(targetPath) {
    currentDirectory = normalizeFsPath(targetPath || workspaceRootPath);

    if (filesCurrentPath) {
      filesCurrentPath.textContent = currentDirectory;
    }

    if (btnFilesUp) {
      btnFilesUp.disabled = isPathRoot(currentDirectory);
      btnFilesUp.classList.toggle('opacity-50', btnFilesUp.disabled);
      btnFilesUp.classList.toggle('cursor-not-allowed', btnFilesUp.disabled);
    }

    renderFileBreadcrumbs();
  }

  function renderFileBreadcrumbs() {
    if (!filesBreadcrumbs) return;

    const current = normalizeFsPath(currentDirectory || workspaceRootPath);
    const root = getPathRoot(current);
    const segments = getPathSegments(current);
    const rootLabel = root === '/' ? '/' : root.replace(/\/$/, '');
    const crumbs = [];

    if (root) {
      crumbs.push(
        `<button class="text-blue-600 hover:underline" data-fs-crumb="${escapeHtml(root)}">${escapeHtml(rootLabel)}</button>`
      );
    }

    segments.forEach((segment, index) => {
      const accum = joinNormalizedPath(root, segments.slice(0, index + 1));
      crumbs.push('<span class="text-gray-400">/</span>');
      crumbs.push(`<button class="text-blue-600 hover:underline" data-fs-crumb="${escapeHtml(accum)}">${escapeHtml(segment)}</button>`);
    });

    if (!crumbs.length && current) {
      crumbs.push(`<span class="text-gray-600">${escapeHtml(current)}</span>`);
    }

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

  async function initWorkspacePath(overridePath) {
    try {
      const wsPath = overridePath ? String(overridePath).trim() : await window.api.getWorkspacePath();
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
        fileList.innerHTML = '<div class="text-center text-gray-500 py-4">Папка пуста</div>';
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
                <div class="text-sm text-gray-500">${entry.isDirectory ? 'Папка' : 'Файл'}</div>
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
  const chatTimeoutSecondsInput = document.getElementById('chat-timeout-seconds');
  const chatShowReasoningCheckbox = document.getElementById('chat-show-reasoning');
  const chatReasoningOutput = document.getElementById('chat-reasoning-output');
  const chatTokenStats = document.getElementById('chat-token-stats');
  const chatLiveStatus = document.getElementById('chat-live-status');
  const chatThreadsList = document.getElementById('chat-threads-list');
  const chatThreadSummary = document.getElementById('chat-thread-summary');
  const btnChatNewThread = document.getElementById('btn-chat-new-thread');
  const btnChatRenameThread = document.getElementById('btn-chat-rename-thread');
  const btnChatDeleteThread = document.getElementById('btn-chat-delete-thread');
  const agentReasoningOutput = document.getElementById('agent-reasoning-output');
  const agentTokenStats = document.getElementById('agent-token-stats');
  const agentTraceLog = document.getElementById('agent-trace-log');

  // Active workspace scope used by files, chat history and RAG requests.
  let activeWorkspaceContext = { agentId: '', workspacePath: '', workspaceKey: '' };

  function setActiveWorkspaceContext(agentId, workspacePath) {
    const normalizedPath = String(workspacePath || '').trim();
    const key = normalizedPath
      ? normalizedPath
          .toLowerCase()
          .replace(/[\\/]+/g, '-')
          .replace(/[^a-z0-9._-]+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 96) || 'default'
      : 'default';
    activeWorkspaceContext = { agentId: String(agentId || '').trim(), workspacePath: normalizedPath, workspaceKey: key };
    return activeWorkspaceContext;
  }

  // Per-agent chat thread storage keys — scoped by active workspace/agent
  function getChatThreadsStorageKey() {
    const scope = activeWorkspaceContext.workspaceKey;
    return scope && scope !== 'default'
      ? `openclaw_chat_threads_v2_${scope}`
      : 'openclaw_chat_threads_v2';
  }
  function getChatActiveThreadStorageKey() {
    const scope = activeWorkspaceContext.workspaceKey;
    return scope && scope !== 'default'
      ? `openclaw_chat_active_thread_v2_${scope}`
      : 'openclaw_chat_active_thread_v2';
  }
  const CHAT_MESSAGE_LIMIT = 600;
  const DEFAULT_CHAT_GREETING =
    'Привет, бро! Я запущен в десктопном приложении. Готов помогать с GIGA ARPA и не только. Что будем делать?';

  let selectedChatAttachments = [];
  let typingIndicator = null;
  let typingTimer = null;
  let traceCounter = 0;
  let traceHistory = [];
  let activeRequestId = null;
  let activeStreamMessage = null;
  let chatThreads = [];
  let activeChatThreadId = null;
  const requestThreadMap = new Map();

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

  function createChatThreadId() {
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function createChatMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function normalizeChatThinking(value) {
    const thinking = String(value || '').trim().toLowerCase();
    return ['off', 'minimal', 'low', 'medium', 'high'].includes(thinking) ? thinking : 'medium';
  }

  function normalizeSessionIdValue(value, fallback = 'bratan-desktop-ui') {
    const raw = String(value || '').trim();
    if (!raw) {
      return fallback;
    }

    const cleaned = raw
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return cleaned || fallback;
  }

  function buildDerivedSessionId(agentId = '') {
    const base = String(agentId || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 36);

    const prefix = base || 'bratan-desktop-ui';
    return `${prefix}-chat-${Date.now().toString(36)}`;
  }

  function buildChatThreadTitle(agentId, sessionId) {
    const normalizedAgent = String(agentId || '').trim();
    if (normalizedAgent) {
      return normalizedAgent;
    }

    const normalizedSession = String(sessionId || '').trim();
    if (normalizedSession) {
      return `default · ${normalizedSession}`;
    }

    return 'Братан';
  }

  function applyAutoChatThreadTitle(thread) {
    if (!thread || thread.customTitle === true) {
      return;
    }

    thread.title = buildChatThreadTitle(thread.agentId, thread.sessionId);
  }

  function normalizeChatMessageRecord(raw, index = 0) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const role = raw.role === 'user' ? 'user' : raw.role === 'system' ? 'system' : 'assistant';
    const text = String(raw.text || '').trim();
    if (!text && role !== 'system') {
      return null;
    }

    const sender = String(
      raw.sender || (role === 'user' ? 'Дмитрий' : role === 'system' ? 'Система' : 'Братан')
    ).trim();
    const createdAt =
      String(raw.createdAt || raw.timestamp || '').trim() || new Date(Date.now() + index).toISOString();
    const reasoning = Array.isArray(raw.reasoning)
      ? raw.reasoning.map((entry) => String(entry || '').trim()).filter(Boolean).slice(0, 16)
      : [];
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : null;

    return {
      id: String(raw.id || createChatMessageId()),
      role,
      sender,
      text,
      createdAt,
      reasoning,
      meta,
      requestId: raw.requestId ? String(raw.requestId) : null,
      transport: raw.transport ? String(raw.transport) : null,
    };
  }

  function normalizeChatThreadRecord(raw, index = 0) {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const agentId = String(raw.agentId || '').trim();
    const fallbackSessionId = agentId ? buildDerivedSessionId(agentId) : 'bratan-desktop-ui';
    const sessionId = normalizeSessionIdValue(raw.sessionId, fallbackSessionId);
    const createdAt = String(raw.createdAt || '').trim() || new Date().toISOString();
    const updatedAt = String(raw.updatedAt || '').trim() || createdAt;
    const candidateTitle = String(raw.title || '').trim();
    const customTitle = raw.customTitle === true && Boolean(candidateTitle);
    const messages = Array.isArray(raw.messages)
      ? raw.messages
          .map((message, messageIndex) => normalizeChatMessageRecord(message, messageIndex))
          .filter(Boolean)
          .slice(-CHAT_MESSAGE_LIMIT)
      : [];

    return {
      id: String(raw.id || `thread_${index}_${Math.random().toString(36).slice(2, 8)}`),
      title: customTitle ? candidateTitle : buildChatThreadTitle(agentId, sessionId),
      customTitle,
      agentId,
      sessionId,
      thinking: normalizeChatThinking(raw.thinking),
      timeoutSeconds: normalizeChatTimeoutSeconds(raw.timeoutSeconds, 180),
      showReasoning: raw.showReasoning !== false,
      source: String(raw.source || 'chat-history').trim() || 'chat-history',
      createdAt,
      updatedAt,
      messages,
    };
  }

  function sortChatThreadsInPlace() {
    chatThreads.sort((left, right) => {
      const leftTs = new Date(left?.updatedAt || left?.createdAt || 0).getTime();
      const rightTs = new Date(right?.updatedAt || right?.createdAt || 0).getTime();
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }

      return String(left?.title || '').localeCompare(String(right?.title || ''));
    });
  }

  function saveChatThreadsStore() {
    try {
      localStorage.setItem(getChatThreadsStorageKey(), JSON.stringify(chatThreads));
      if (activeChatThreadId) {
        localStorage.setItem(getChatActiveThreadStorageKey(), activeChatThreadId);
      }
    } catch (err) {
      console.warn('Не удалось сохранить историю чатов:', err);
    }
  }

  function getChatThreadById(threadId) {
    const normalized = String(threadId || '').trim();
    if (!normalized) {
      return null;
    }

    return chatThreads.find((thread) => thread.id === normalized) || null;
  }

  function findChatThreadBySessionId(sessionId) {
    const normalized = String(sessionId || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return (
      chatThreads.find((thread) => String(thread?.sessionId || '').trim().toLowerCase() === normalized) || null
    );
  }

  function findChatThreadByAgentId(agentId) {
    const normalized = String(agentId || '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return chatThreads.find((thread) => String(thread?.agentId || '').trim().toLowerCase() === normalized) || null;
  }

  function getActiveChatThread() {
    return getChatThreadById(activeChatThreadId) || null;
  }

  function syncChatControlsFromThread(thread) {
    if (!thread) return;

    if (chatAgentIdInput) {
      chatAgentIdInput.value = thread.agentId || '';
    }
    if (chatSessionIdInput) {
      chatSessionIdInput.value = thread.sessionId || 'bratan-desktop-ui';
    }
    if (chatThinkingSelect) {
      chatThinkingSelect.value = normalizeChatThinking(thread.thinking);
    }
    if (chatTimeoutSecondsInput) {
      chatTimeoutSecondsInput.value = String(normalizeChatTimeoutSeconds(thread.timeoutSeconds, 180));
    }
    if (chatShowReasoningCheckbox) {
      chatShowReasoningCheckbox.checked = thread.showReasoning !== false;
    }
  }

  function renderChatThreadSummary(thread = getActiveChatThread()) {
    if (!chatThreadSummary) return;

    if (!thread) {
      chatThreadSummary.textContent = 'Чаты не созданы.';
      return;
    }

    const messagesCount = Array.isArray(thread.messages) ? thread.messages.length : 0;
    const updatedAtText = thread.updatedAt ? new Date(thread.updatedAt).toLocaleString() : '—';
    chatThreadSummary.textContent = `Активный чат: ${thread.title} | agent=${thread.agentId || 'default'} | session=${thread.sessionId} | messages=${messagesCount} | updated=${updatedAtText}`;
  }

  function appendMessageToThread(threadId, payload = {}) {
    const targetThread = getChatThreadById(threadId);
    if (!targetThread) {
      return null;
    }

    const candidate = normalizeChatMessageRecord(
      {
        id: payload.id || createChatMessageId(),
        role: payload.role,
        sender: payload.sender,
        text: payload.text,
        createdAt: payload.createdAt || new Date().toISOString(),
        reasoning: payload.reasoning,
        meta: payload.meta,
        requestId: payload.requestId,
        transport: payload.transport,
      },
      targetThread.messages.length
    );

    if (!candidate) {
      return null;
    }

    targetThread.messages.push(candidate);
    if (targetThread.messages.length > CHAT_MESSAGE_LIMIT) {
      targetThread.messages = targetThread.messages.slice(-CHAT_MESSAGE_LIMIT);
    }

    targetThread.updatedAt = candidate.createdAt;
    applyAutoChatThreadTitle(targetThread);
    sortChatThreadsInPlace();
    saveChatThreadsStore();
    renderChatThreadList();
    renderChatThreadSummary();

    return candidate;
  }

  function renderChatThreadList() {
    if (!chatThreadsList) return;

    if (!chatThreads.length) {
      chatThreadsList.innerHTML = '<div class="text-xs text-gray-500">Чатов пока нет</div>';
      if (btnChatDeleteThread) {
        btnChatDeleteThread.disabled = true;
        btnChatDeleteThread.classList.add('opacity-60', 'cursor-not-allowed');
      }
      if (btnChatRenameThread) {
        btnChatRenameThread.disabled = true;
        btnChatRenameThread.classList.add('opacity-60', 'cursor-not-allowed');
      }
      return;
    }

    sortChatThreadsInPlace();
    chatThreadsList.innerHTML = chatThreads
      .map((thread) => {
        const isActive = thread.id === activeChatThreadId;
        const messagesCount = Array.isArray(thread.messages) ? thread.messages.length : 0;
        return `
          <button class="text-left border rounded px-2 py-2 transition ${isActive ? 'chat-thread-item-active' : 'bg-white hover:bg-gray-50'}" data-chat-thread-id="${escapeHtml(thread.id)}">
            <div class="text-sm font-semibold truncate">${escapeHtml(thread.title || 'Без названия')}</div>
            <div class="text-xs text-gray-600 truncate">agent: ${escapeHtml(thread.agentId || 'default')}</div>
            <div class="text-xs text-gray-500 truncate">session: ${escapeHtml(thread.sessionId || '—')}</div>
            <div class="text-xs text-gray-500 mt-1">messages: ${messagesCount}</div>
          </button>
        `;
      })
      .join('');

    chatThreadsList.querySelectorAll('[data-chat-thread-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const threadId = button.getAttribute('data-chat-thread-id');
        if (!threadId) return;
        setActiveChatThread(threadId);
      });
    });

    if (btnChatDeleteThread) {
      const shouldDisable = chatThreads.length <= 1 || Boolean(activeRequestId);
      btnChatDeleteThread.disabled = shouldDisable;
      btnChatDeleteThread.classList.toggle('opacity-60', shouldDisable);
      btnChatDeleteThread.classList.toggle('cursor-not-allowed', shouldDisable);
    }

    if (btnChatNewThread) {
      const shouldDisable = Boolean(activeRequestId);
      btnChatNewThread.disabled = shouldDisable;
      btnChatNewThread.classList.toggle('opacity-60', shouldDisable);
      btnChatNewThread.classList.toggle('cursor-not-allowed', shouldDisable);
    }

    if (btnChatRenameThread) {
      const shouldDisable = !activeChatThreadId || Boolean(activeRequestId);
      btnChatRenameThread.disabled = shouldDisable;
      btnChatRenameThread.classList.toggle('opacity-60', shouldDisable);
      btnChatRenameThread.classList.toggle('cursor-not-allowed', shouldDisable);
    }
  }

  function renderChatThreadMessages() {
    if (!chatMessages) return;

    chatMessages.innerHTML = '';
    const thread = getActiveChatThread();
    if (!thread) {
      return;
    }

    if (!Array.isArray(thread.messages) || thread.messages.length === 0) {
      if (chatReasoningOutput) {
        chatReasoningOutput.textContent = 'Reasoning появится после следующего ответа агента.';
      }
      if (agentReasoningOutput) {
        agentReasoningOutput.textContent = 'Reasoning появится после следующего ответа агента.';
      }
      if (chatTokenStats) {
        chatTokenStats.classList.add('hidden');
      }
      if (agentTokenStats) {
        agentTokenStats.classList.add('hidden');
      }
      return;
    }

    thread.messages.forEach((message) => {
      const isUser = message.role === 'user';
      const sender = message.sender || (isUser ? 'Дмитрий' : message.role === 'system' ? 'Система' : 'Братан');
      addMessage(sender, message.text, isUser, {
        persist: false,
        timestamp: message.createdAt,
        role: message.role,
      });
    });

    const lastAssistant = [...thread.messages].reverse().find((entry) => entry.role === 'assistant');
    if (lastAssistant && chatShowReasoningCheckbox?.checked) {
      renderReasoning(lastAssistant.reasoning || [], lastAssistant.meta || null, lastAssistant.transport || 'history');
    } else {
      if (chatReasoningOutput) {
        chatReasoningOutput.textContent = 'Reasoning скрыт или отсутствует для текущего чата.';
      }
      if (agentReasoningOutput) {
        agentReasoningOutput.textContent = 'Reasoning скрыт или отсутствует для текущего чата.';
      }
    }
  }

  function setActiveChatThread(threadId, options = {}) {
    const targetThread = getChatThreadById(threadId) || chatThreads[0] || null;
    if (!targetThread) {
      return false;
    }

    const isDifferentThread = activeChatThreadId && targetThread.id !== activeChatThreadId;
    if (activeRequestId && isDifferentThread && !options.force) {
      showNotification('Дождитесь завершения текущего запроса перед переключением чата.', 'warning');
      return false;
    }

    activeChatThreadId = targetThread.id;
    syncChatControlsFromThread(targetThread);
    saveChatThreadsStore();
    renderChatThreadList();
    renderChatThreadSummary(targetThread);
    if (!options.skipRenderMessages) {
      renderChatThreadMessages();
    }

    return true;
  }

  function createChatThread(options = {}) {
    const now = new Date().toISOString();
    const normalizedAgentId = String(options.agentId || '').trim();
    const resolvedSessionId = normalizeSessionIdValue(
      options.sessionId,
      options.keepDefaultSession ? 'bratan-desktop-ui' : buildDerivedSessionId(normalizedAgentId)
    );
    const existingBySession = findChatThreadBySessionId(resolvedSessionId);

    if (existingBySession) {
      if (normalizedAgentId && !existingBySession.agentId) {
        existingBySession.agentId = normalizedAgentId;
        applyAutoChatThreadTitle(existingBySession);
      }
      if (options.select !== false) {
        setActiveChatThread(existingBySession.id, { force: Boolean(options.forceSelect) });
      }
      return existingBySession;
    }

    const thread = normalizeChatThreadRecord(
      {
        id: createChatThreadId(),
        title: options.title || buildChatThreadTitle(normalizedAgentId, resolvedSessionId),
        customTitle: options.customTitle === true,
        agentId: normalizedAgentId,
        sessionId: resolvedSessionId,
        thinking: options.thinking,
        timeoutSeconds: options.timeoutSeconds,
        showReasoning: options.showReasoning,
        source: options.source || 'manual',
        createdAt: options.createdAt || now,
        updatedAt: options.updatedAt || now,
        messages: options.messages || [],
      },
      chatThreads.length
    );

    if (!thread) {
      return null;
    }

    chatThreads.push(thread);
    sortChatThreadsInPlace();
    saveChatThreadsStore();

    if (options.select !== false) {
      setActiveChatThread(thread.id, { force: true });
    } else {
      renderChatThreadList();
      renderChatThreadSummary();
    }

    return thread;
  }

  function initializeChatThreads(seed = {}) {
    let restoredThreads = [];
    try {
      const raw = localStorage.getItem(getChatThreadsStorageKey());
      const parsed = raw ? JSON.parse(raw) : [];
      restoredThreads = Array.isArray(parsed)
        ? parsed
            .map((thread, index) => normalizeChatThreadRecord(thread, index))
            .filter(Boolean)
            .slice(0, 60)
        : [];
    } catch (err) {
      console.warn('Не удалось загрузить историю чатов:', err);
      restoredThreads = [];
    }

    chatThreads = restoredThreads;

    if (!chatThreads.length) {
      const seedThread = normalizeChatThreadRecord(
        {
          id: createChatThreadId(),
          title: buildChatThreadTitle(seed.agentId || '', seed.sessionId || 'bratan-desktop-ui'),
          customTitle: false,
          agentId: seed.agentId || '',
          sessionId: normalizeSessionIdValue(seed.sessionId, 'bratan-desktop-ui'),
          thinking: seed.thinking || 'medium',
          timeoutSeconds: seed.timeoutSeconds || 180,
          showReasoning: seed.showReasoning !== false,
          source: 'seed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [
            {
              id: createChatMessageId(),
              role: 'assistant',
              sender: 'Братан (🫂)',
              text: DEFAULT_CHAT_GREETING,
              createdAt: new Date().toISOString(),
              reasoning: [],
              meta: null,
              transport: 'seed',
            },
          ],
        },
        0
      );

      if (seedThread) {
        chatThreads = [seedThread];
      }
    }

    sortChatThreadsInPlace();
    const restoredActiveId = localStorage.getItem(getChatActiveThreadStorageKey());
    const activeCandidate = getChatThreadById(restoredActiveId) || chatThreads[0] || null;
    activeChatThreadId = activeCandidate ? activeCandidate.id : null;
    saveChatThreadsStore();
    renderChatThreadList();

    if (activeCandidate) {
      setActiveChatThread(activeCandidate.id, { force: true });
    }
  }

  function resetChatThreadsStore() {
    chatThreads = [];
    activeChatThreadId = null;
    localStorage.removeItem(getChatThreadsStorageKey());
    localStorage.removeItem(getChatActiveThreadStorageKey());
  }

  function addMessage(sender, text, isUser = false, options = {}) {
    const normalizedText = String(text || '');
    if (!normalizedText.trim() && options.allowEmpty !== true) {
      return {
        container: null,
        senderNode: null,
        textNode: null,
        timeNode: null,
      };
    }

    const msgDiv = document.createElement('div');
    if (options.role === 'system') {
      msgDiv.className = 'chat-message-assistant border border-amber-200 bg-amber-50';
    } else {
      msgDiv.className = isUser ? 'chat-message-user' : 'chat-message-assistant';
    }

    const senderDiv = document.createElement('div');
    if (options.role === 'system') {
      senderDiv.className = 'font-semibold text-amber-700';
    } else {
      senderDiv.className = isUser ? 'font-semibold text-gray-700' : 'font-semibold text-blue-600';
    }
    senderDiv.textContent = sender;

    const textDiv = document.createElement('div');
    textDiv.textContent = normalizedText;

    const timeDiv = document.createElement('div');
    timeDiv.className = 'text-xs text-gray-500 mt-1';
    const messageDate = options.timestamp ? new Date(options.timestamp) : new Date();
    timeDiv.textContent = Number.isFinite(messageDate.getTime())
      ? messageDate.toLocaleTimeString()
      : new Date().toLocaleTimeString();

    msgDiv.appendChild(senderDiv);
    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(timeDiv);
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (options.persist !== false) {
      const targetThreadId = options.threadId || activeChatThreadId;
      appendMessageToThread(targetThreadId, {
        role: options.role || (isUser ? 'user' : 'assistant'),
        sender,
        text: normalizedText,
        createdAt: options.timestamp || new Date().toISOString(),
        reasoning: options.reasoning || [],
        meta: options.meta || null,
        requestId: options.requestId || null,
        transport: options.transport || null,
      });
    }

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

    const message = addMessage(sender || 'Братан', '', false, {
      persist: false,
      allowEmpty: true,
    });
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

  function finalizeStreamingMessage(sender, requestId, finalText, options = {}) {
    const normalizedFinalText = String(finalText || '').trim() || 'Ответ получен.';
    const targetThreadId = options.threadId || requestThreadMap.get(requestId) || activeChatThreadId;

    if (activeStreamMessage && activeStreamMessage.requestId === requestId) {
      activeStreamMessage.senderNode.textContent = sender || 'Братан';
      activeStreamMessage.textNode.textContent =
        normalizedFinalText || activeStreamMessage.textNode.textContent || 'Ответ получен.';
      activeStreamMessage.container.classList.remove('border', 'border-indigo-200', 'bg-indigo-50');
      activeStreamMessage = null;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else {
      addMessage(sender || 'Братан', normalizedFinalText, false, {
        persist: false,
      });
    }

    if (options.persist !== false) {
      appendMessageToThread(targetThreadId, {
        role: options.role || 'assistant',
        sender: sender || 'Братан',
        text: normalizedFinalText,
        reasoning: Array.isArray(options.reasoning) ? options.reasoning : [],
        meta: options.meta && typeof options.meta === 'object' ? options.meta : null,
        requestId: requestId || options.requestId || null,
        transport: options.transport || null,
      });
    }

    if (requestId) {
      requestThreadMap.delete(requestId);
    }
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

  function toFiniteNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/[,\s]+/g, '');
      if (!cleaned) {
        return null;
      }
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return null;
  }

  function flattenNumericFields(source, maxDepth = 6) {
    const map = new Map();
    const stack = [{ value: source, path: '', depth: 0 }];
    const visited = new Set();

    while (stack.length > 0) {
      const current = stack.pop();
      const value = current.value;

      if (!value || typeof value !== 'object') {
        continue;
      }

      if (visited.has(value)) {
        continue;
      }
      visited.add(value);

      if (current.depth > maxDepth) {
        continue;
      }

      Object.entries(value).forEach(([key, entry]) => {
        const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const pathKey = current.path ? `${current.path}.${normalizedKey}` : normalizedKey;
        const numericValue = toFiniteNumber(entry);
        if (numericValue !== null) {
          map.set(pathKey, numericValue);
          return;
        }

        if (entry && typeof entry === 'object') {
          stack.push({ value: entry, path: pathKey, depth: current.depth + 1 });
        }
      });
    }

    return map;
  }

  function pickNumericField(numericMap, candidates) {
    for (const candidate of candidates) {
      const normalizedCandidate = String(candidate || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
      for (const [key, value] of numericMap.entries()) {
        if (key === normalizedCandidate || key.endsWith(`.${normalizedCandidate}`)) {
          return value;
        }
      }
    }
    return null;
  }

  function extractTokenUsage(metaLike) {
    if (!metaLike || typeof metaLike !== 'object') {
      return null;
    }

    const numericFields = flattenNumericFields(metaLike);
    if (!numericFields.size) {
      return null;
    }

    const input = pickNumericField(numericFields, [
      'prompt_tokens',
      'input_tokens',
      'request_tokens',
      'tokens_in',
      'input',
      'usage_input_tokens',
    ]);
    const output = pickNumericField(numericFields, [
      'completion_tokens',
      'output_tokens',
      'response_tokens',
      'generated_tokens',
      'tokens_out',
      'output',
      'usage_output_tokens',
    ]);

    let total = pickNumericField(numericFields, [
      'total_tokens',
      'tokens_total',
      'token_count',
      'usage_total_tokens',
      'consumed_tokens',
      'tokens_used',
    ]);
    if (total === null && input !== null && output !== null) {
      total = input + output;
    }

    let limit = pickNumericField(numericFields, [
      'token_limit',
      'max_tokens',
      'context_window',
      'max_context_tokens',
      'model_context_window',
      'quota_tokens',
      'limit_tokens',
    ]);

    let remaining = pickNumericField(numericFields, [
      'remaining_tokens',
      'tokens_remaining',
      'available_tokens',
      'quota_remaining',
      'remaining',
      'available',
    ]);

    if (remaining === null && limit !== null && total !== null) {
      remaining = Math.max(0, limit - total);
    }
    if (limit === null && remaining !== null && total !== null) {
      limit = remaining + total;
    }

    if (input === null && output === null && total === null && limit === null && remaining === null) {
      return null;
    }

    return {
      input,
      output,
      total,
      limit,
      remaining,
    };
  }

  function formatTokenValue(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return 'n/a';
    }
    return Number(value).toLocaleString('ru-RU');
  }

  function resolveModelKeyFromMeta(metaLike) {
    if (!metaLike || typeof metaLike !== 'object') {
      return '';
    }

    const direct = String(metaLike.model || '').trim();
    if (direct) {
      return direct;
    }

    const agentProvider = String(metaLike.agentMeta?.provider || '').trim();
    const agentModel = String(metaLike.agentMeta?.model || '').trim();
    if (agentProvider && agentModel) {
      return `${agentProvider}/${agentModel}`;
    }

    const promptProvider = String(metaLike.systemPromptReport?.provider || '').trim();
    const promptModel = String(metaLike.systemPromptReport?.model || '').trim();
    if (promptProvider && promptModel) {
      return `${promptProvider}/${promptModel}`;
    }

    return '';
  }

  function resolveModelContextWindow(metaLike) {
    const modelKey = resolveModelKeyFromMeta(metaLike);
    if (!modelKey) {
      return { modelKey: '', contextWindow: null };
    }

    const modelRecord = openClawModelsCatalog.get(normalizeModelKey(modelKey));
    const rawContext = Number(modelRecord?.contextWindow);
    const contextWindow = Number.isFinite(rawContext) && rawContext > 0 ? Math.round(rawContext) : null;

    return {
      modelKey,
      contextWindow,
    };
  }

  function formatTokenUsageSummary(metaLike) {
    const usage = extractTokenUsage(metaLike);
    const modelInfo = resolveModelContextWindow(metaLike);

    if (!usage && !modelInfo.contextWindow) {
      return '';
    }

    const input = usage?.input ?? null;
    const output = usage?.output ?? null;
    const total = usage?.total ?? null;

    let limit = usage?.limit ?? null;
    if (limit === null && modelInfo.contextWindow !== null) {
      limit = modelInfo.contextWindow;
    }

    let remaining = usage?.remaining ?? null;
    if (remaining === null && limit !== null && total !== null) {
      remaining = Math.max(0, limit - total);
    }

    const parts = [];
    if (input !== null) parts.push(`in ${formatTokenValue(input)}`);
    if (output !== null) parts.push(`out ${formatTokenValue(output)}`);
    if (total !== null) parts.push(`used ${formatTokenValue(total)}`);
    if (limit !== null) parts.push(`limit ${formatTokenValue(limit)}`);
    if (remaining !== null) parts.push(`remaining ${formatTokenValue(remaining)}`);
    if (modelInfo.modelKey) parts.push(`model ${modelInfo.modelKey}`);

    return parts.join(' | ');
  }

  function renderTokenUsage(metaLike, transport) {
    const summary = formatTokenUsageSummary(metaLike);
    const prefix = transport ? `${transport}: ` : '';

    if (summary) {
      const text = `Токены ${prefix}${summary}`;
      if (chatTokenStats) {
        chatTokenStats.textContent = text;
        chatTokenStats.classList.remove('hidden');
      }
      if (agentTokenStats) {
        agentTokenStats.textContent = text;
        agentTokenStats.classList.remove('hidden');
      }
      return summary;
    }

    const fallback = 'Токены: провайдер не вернул usage/limit в meta';
    if (chatTokenStats) {
      chatTokenStats.textContent = fallback;
      chatTokenStats.classList.remove('hidden');
    }
    if (agentTokenStats) {
      agentTokenStats.textContent = fallback;
      agentTokenStats.classList.remove('hidden');
    }

    return '';
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

    renderTokenUsage(meta, transport);

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

  function normalizeChatTimeoutSeconds(value, fallback = 180) {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
    return Math.min(1800, Math.max(30, normalized));
  }

  function getChatRuntimeOptions() {
    const activeThread = getActiveChatThread();
    const agentId = (chatAgentIdInput?.value || activeThread?.agentId || '').trim();
    const sessionFallback = activeThread?.sessionId || (agentId ? buildDerivedSessionId(agentId) : 'bratan-desktop-ui');
    const sessionId = normalizeSessionIdValue(chatSessionIdInput?.value, sessionFallback);
    const thinking = normalizeChatThinking(chatThinkingSelect?.value || activeThread?.thinking || 'medium');
    const timeoutSeconds = normalizeChatTimeoutSeconds(chatTimeoutSecondsInput?.value, 180);
    const showReasoning = chatShowReasoningCheckbox?.checked !== false;

    if (chatTimeoutSecondsInput) {
      chatTimeoutSecondsInput.value = String(timeoutSeconds);
    }
    if (chatSessionIdInput) {
      chatSessionIdInput.value = sessionId;
    }
    if (chatThinkingSelect) {
      chatThinkingSelect.value = thinking;
    }

    return { agentId, sessionId, thinking, timeoutSeconds, showReasoning };
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

  function tryParseReplyJsonEnvelope(rawText) {
    const text = String(rawText || '').trim();
    if (!text) {
      return null;
    }

    if (!(text.startsWith('{') || text.startsWith('['))) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function extractAssistantReplyText(payload) {
    if (payload === null || payload === undefined) return '';
    if (typeof payload === 'string') {
      const parsed = tryParseReplyJsonEnvelope(payload);
      if (parsed && parsed !== payload) {
        const extracted = extractAssistantReplyText(parsed);
        if (extracted) {
          return extracted;
        }
      }

      return payload.trim();
    }

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

    return '';
  }

  function persistChatRuntimeSettings() {
    const runtime = getChatRuntimeOptions();
    const activeThread = getActiveChatThread();

    if (activeThread) {
      activeThread.agentId = runtime.agentId;
      activeThread.sessionId = runtime.sessionId;
      activeThread.thinking = runtime.thinking;
      activeThread.timeoutSeconds = runtime.timeoutSeconds;
      activeThread.showReasoning = runtime.showReasoning;
      applyAutoChatThreadTitle(activeThread);
      activeThread.updatedAt = new Date().toISOString();
      sortChatThreadsInPlace();
      saveChatThreadsStore();
      renderChatThreadList();
      renderChatThreadSummary();
    }

    localStorage.setItem('openclaw_chat_agent_id', runtime.agentId || '');
    localStorage.setItem('openclaw_chat_session_id', runtime.sessionId || 'bratan-desktop-ui');
    localStorage.setItem('openclaw_chat_thinking', runtime.thinking || 'medium');
    localStorage.setItem('openclaw_chat_timeout_seconds', String(runtime.timeoutSeconds));
    localStorage.setItem('openclaw_chat_show_reasoning', runtime.showReasoning ? 'true' : 'false');
  }

  [chatAgentIdInput, chatSessionIdInput, chatThinkingSelect, chatTimeoutSecondsInput, chatShowReasoningCheckbox].forEach((control) => {
    if (!control) return;
    control.addEventListener('change', persistChatRuntimeSettings);
  });

  [chatAgentIdInput, chatSessionIdInput, chatTimeoutSecondsInput].forEach((control) => {
    if (!control) return;
    control.addEventListener('input', persistChatRuntimeSettings);
  });

  if (chatShowReasoningCheckbox) {
    chatShowReasoningCheckbox.addEventListener('change', () => {
      persistChatRuntimeSettings();
      renderChatThreadMessages();
    });
  }

  function createManualChatThread() {
    if (activeRequestId) {
      showNotification('Нельзя создать чат во время активного запроса.', 'warning');
      return;
    }

    const runtime = getChatRuntimeOptions();
    const newThread = createChatThread({
      agentId: runtime.agentId,
      sessionId: buildDerivedSessionId(runtime.agentId),
      thinking: runtime.thinking,
      timeoutSeconds: runtime.timeoutSeconds,
      showReasoning: runtime.showReasoning,
      source: 'manual',
      select: true,
    });

    if (!newThread) {
      return;
    }

    renderChatThreadMessages();
    setChatLiveStatus('', false);
    appendAgentTrace('Новый чат', `agent=${newThread.agentId || 'default'}; session=${newThread.sessionId}`);
    showNotification('Создан новый чат агента', 'success');
  }

  function renameActiveChatThread() {
    if (activeRequestId) {
      showNotification('Дождитесь завершения текущего запроса.', 'warning');
      return;
    }

    const activeThread = getActiveChatThread();
    if (!activeThread) {
      showNotification('Активный чат не найден.', 'warning');
      return;
    }

    const nextTitleRaw = prompt('Введите новое название чата:', activeThread.title || '');
    if (nextTitleRaw === null) {
      return;
    }

    const nextTitle = String(nextTitleRaw || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    if (!nextTitle) {
      showNotification('Название чата не может быть пустым.', 'warning');
      return;
    }

    activeThread.title = nextTitle;
    activeThread.customTitle = true;
    activeThread.updatedAt = new Date().toISOString();
    sortChatThreadsInPlace();
    saveChatThreadsStore();
    renderChatThreadList();
    renderChatThreadSummary(activeThread);
    showNotification('Чат переименован.', 'success');
  }

  function deleteActiveChatThread() {
    if (activeRequestId) {
      showNotification('Дождитесь завершения текущего запроса.', 'warning');
      return;
    }

    if (chatThreads.length <= 1) {
      showNotification('Нельзя удалить последний чат.', 'warning');
      return;
    }

    const activeThread = getActiveChatThread();
    if (!activeThread) {
      return;
    }

    const confirmed = confirm(`Удалить чат "${activeThread.title}"?`);
    if (!confirmed) {
      return;
    }

    chatThreads = chatThreads.filter((thread) => thread.id !== activeThread.id);
    sortChatThreadsInPlace();
    const nextThread = chatThreads[0] || null;
    activeChatThreadId = nextThread ? nextThread.id : null;
    saveChatThreadsStore();
    renderChatThreadList();

    if (nextThread) {
      setActiveChatThread(nextThread.id, { force: true });
    } else {
      chatMessages.innerHTML = '';
      renderChatThreadSummary(null);
    }

    showNotification('Чат удалён', 'info');
  }

  if (btnChatNewThread) {
    btnChatNewThread.addEventListener('click', () => {
      createManualChatThread();
    });
  }

  if (btnChatDeleteThread) {
    btnChatDeleteThread.addEventListener('click', () => {
      deleteActiveChatThread();
    });
  }

  if (btnChatRenameThread) {
    btnChatRenameThread.addEventListener('click', () => {
      renameActiveChatThread();
    });
  }

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

  if (btnOpenClawUpdate) {
    btnOpenClawUpdate.addEventListener('click', async () => {
      if (openClawVersionLoading || openClawVersionState.inProgress) {
        return;
      }

      if (!openClawVersionState.updateAvailable) {
        void refreshOpenClawVersionInfo({ notify: true });
        return;
      }

      const selectedChannel = getSelectedOpenClawChannel();
      const fromVersion = openClawVersionState.installedVersion || 'unknown';
      const toVersion = openClawVersionState.latestVersion || 'latest';
      const shouldUpdate = window.confirm(
        `Обновить OpenClaw сейчас?\n\nКанал: ${selectedChannel}\n${fromVersion} -> ${toVersion}`
      );
      if (!shouldUpdate) {
        return;
      }

      openClawVersionState = { ...openClawVersionState, inProgress: true };
      setOpenClawVersionUi(openClawVersionState);

      try {
        showNotification('Запускаю обновление OpenClaw...', 'info');
        const result = await window.api.openclaw.update({ restart: true, channel: selectedChannel });
        const nextVersion = result?.targetVersion || toVersion;
        showNotification(`Обновление OpenClaw завершено: ${fromVersion} -> ${nextVersion}`, 'success');
      } catch (err) {
        showNotification('Ошибка обновления OpenClaw: ' + err.message, 'error');
      } finally {
        openClawVersionState = { ...openClawVersionState, inProgress: false };
        setOpenClawVersionUi(openClawVersionState);
        void refreshOpenClawVersionInfo();
        void refreshOpenClawModels();
        void refreshTransportStatus();
      }
    });
  }

  btnSend.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text && selectedChatAttachments.length === 0) return;

    if (activeRequestId) {
      showNotification('Дождитесь завершения текущего запроса.', 'warning');
      return;
    }

    if (!openClawModelsCatalog.size) {
      void refreshOpenClawModels();
    }

    persistChatRuntimeSettings();
    const runtime = getChatRuntimeOptions();
    const activeThread = getActiveChatThread();
    if (!activeThread) {
      showNotification('Не удалось определить активный чат. Создайте новый чат.', 'error');
      return;
    }

    const requestThreadId = activeThread.id;
    const attachmentPaths = selectedChatAttachments.map((file) => file.path);
    const userDisplayText = text || `Отправлены вложения: ${selectedChatAttachments.map((file) => file.name).join(', ')}`;
    const requestId = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    activeRequestId = requestId;
    requestThreadMap.set(requestId, requestThreadId);

    addMessage('Дмитрий', userDisplayText, true, {
      threadId: requestThreadId,
      requestId,
      transport: 'user',
    });
    chatInput.value = '';
    setChatLiveStatus('Запрос отправлен. Агент готовит ответ...', true);
    setChatExecutionModeIndicator('pending');
    if (chatTokenStats) {
      chatTokenStats.textContent = 'Токены: ожидание данных usage...';
      chatTokenStats.classList.remove('hidden');
    }
    if (agentTokenStats) {
      agentTokenStats.textContent = 'Токены: ожидание данных usage...';
      agentTokenStats.classList.remove('hidden');
    }
    startTypingIndicator(runtime.agentId || 'Братан');
    appendAgentTrace(
      'Запрос отправлен',
      `session=${runtime.sessionId}; agent=${runtime.agentId || 'default'}; timeout=${runtime.timeoutSeconds}s; attachments=${attachmentPaths.length}`
    );

    const requestPayload = {
      text: text || 'Проанализируй приложенные файлы и ответь по их содержимому.',
      attachments: attachmentPaths,
      agentId: runtime.agentId,
      sessionId: runtime.sessionId,
      thinking: runtime.thinking,
      timeoutSeconds: runtime.timeoutSeconds,
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

      if (
        result?.sessionRecoveredFrom &&
        result?.sessionIdUsed &&
        result.sessionIdUsed !== result.sessionRecoveredFrom
      ) {
        if (chatSessionIdInput) {
          chatSessionIdInput.value = result.sessionIdUsed;
        }
        persistChatRuntimeSettings();
        appendAgentTrace('Session recovered', `lock=${result.sessionRecoveredFrom}; next=${result.sessionIdUsed}`);
        showNotification(
          `Сессия ${result.sessionRecoveredFrom} была заблокирована. Продолжаю в новой сессии ${result.sessionIdUsed}.`,
          'warning'
        );
      }

      const response = extractAssistantReplyText(result) || 'Ответ получен, но текст пустой.';
      const effectiveAgentName = result?.agentIdUsed || runtime.agentId || 'Братан';
      const responseMeta = result?.meta || extractMetaFromPayload(result?.raw || result);
      const responseReasoning = result?.reasoning || extractReasoningFromPayload(result?.raw || result);
      const executionMode = String(result?.executionMode || 'cli').toLowerCase();

      stopTypingIndicator();
      finalizeStreamingMessage(effectiveAgentName, requestId, response, {
        threadId: requestThreadId,
        requestId,
        reasoning: responseReasoning,
        meta: responseMeta,
        transport: executionMode,
      });
      const cliTokenSummary = renderTokenUsage(responseMeta, 'cli');
      appendAgentTrace('Token usage', cliTokenSummary || 'usage/limit недоступны в meta');
      if (runtime.showReasoning) {
        renderReasoning(responseReasoning, responseMeta, 'cli');
      }
      appendAgentTrace('Ответ готов', `transport=cli; agent=${effectiveAgentName}; chars=${response.length}`);
      if (executionMode === 'local' || executionMode === 'gateway') {
        setChatExecutionModeIndicator(executionMode);
      } else {
        setChatExecutionModeIndicator('cli');
      }

      void refreshAgentRuntime();
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
          timeoutSeconds: runtime.timeoutSeconds,
          requestId,
        });
        const response = extractAssistantReplyText(result) || 'Ответ получен, но текст пустой.';
        const wsMeta = extractMetaFromPayload(result);
        const wsReasoning = extractReasoningFromPayload(result);
        stopTypingIndicator();
        clearStreamingMessage(requestId);
        addMessage(runtime.agentId || 'Братан', response, false, {
          threadId: requestThreadId,
          requestId,
          reasoning: wsReasoning,
          meta: wsMeta || null,
          transport: 'websocket',
        });
        const wsTokenSummary = renderTokenUsage(wsMeta || result, 'websocket');
        appendAgentTrace('Token usage', wsTokenSummary || 'usage/limit недоступны в meta');
        if (runtime.showReasoning) {
          renderReasoning(wsReasoning, wsMeta || null, 'websocket');
        }
        appendAgentTrace('Ответ готов', `transport=websocket; chars=${response.length}`);
        setChatExecutionModeIndicator('websocket');
        selectedChatAttachments = [];
        renderChatAttachments();
        setChatLiveStatus('', false);
        requestThreadMap.delete(requestId);
        activeRequestId = null;
        renderChatThreadList();
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
      requestThreadMap.delete(requestId);
      activeRequestId = null;
      renderChatThreadList();
    } catch (err) {
      console.error('OpenClaw CLI fallback error:', err);
      stopTypingIndicator();
      setChatLiveStatus('', false);
      clearStreamingMessage(requestId);
      appendAgentTrace('Ошибка ответа', err.message);
      addMessage('Система', 'Ошибка отправки сообщения: ' + err.message, false, {
        role: 'system',
        threadId: requestThreadId,
      });
      setChatExecutionModeIndicator('error');
      requestThreadMap.delete(requestId);
      activeRequestId = null;
      renderChatThreadList();
    }
  });

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btnSend.click();
    }
  });

  // Agents
  const agentsGrid = document.getElementById('agents-grid');
  const agentsKnownList = document.getElementById('agents-known-list');
  const agentsSessionsList = document.getElementById('agents-sessions-list');
  const btnCreateAgent = document.getElementById('btn-create-agent');
  const newAgentNameInput = document.getElementById('new-agent-name');
  const newAgentTaskInput = document.getElementById('new-agent-task');
  const btnRefreshAgentRuntime = document.getElementById('btn-refresh-agent-runtime');

  let createAgentInProgress = false;
  let refreshAgentRuntimeInProgress = false;

  function setCreateAgentUiBusy(isBusy) {
    if (!btnCreateAgent) return;
    btnCreateAgent.disabled = isBusy;
    btnCreateAgent.classList.toggle('opacity-60', isBusy);
    btnCreateAgent.classList.toggle('cursor-not-allowed', isBusy);
    btnCreateAgent.innerHTML = isBusy
      ? '<i class="fas fa-spinner fa-spin mr-1"></i> Создаю...'
      : '<i class="fas fa-plus mr-1"></i> Создать';
  }

  function setRefreshAgentRuntimeUiBusy(isBusy) {
    if (!btnRefreshAgentRuntime) return;
    btnRefreshAgentRuntime.disabled = isBusy;
    btnRefreshAgentRuntime.classList.toggle('opacity-60', isBusy);
    btnRefreshAgentRuntime.classList.toggle('cursor-not-allowed', isBusy);
    btnRefreshAgentRuntime.innerHTML = isBusy
      ? '<i class="fas fa-spinner fa-spin mr-1"></i> Обновляю...'
      : '<i class="fas fa-sync-alt mr-1"></i> Обновить';
  }

  function buildAgentSessionStats(sessions) {
    const map = new Map();

    sessions.forEach((session) => {
      const agentId = String(session?.agentId || '').trim();
      if (!agentId) return;

      const key = agentId.toLowerCase();
      const current = map.get(key) || {
        agentId,
        count: 0,
        latestUpdatedAt: null,
        latestSessionId: null,
        latestUpdatedAtMs: 0,
      };

      current.count += 1;
      const updatedAt = String(session?.updatedAt || '').trim();
      const sessionId = String(session?.sessionId || '').trim();
      const parsedUpdatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0;
      const updatedAtMs = Number.isFinite(parsedUpdatedAtMs) ? parsedUpdatedAtMs : 0;

      if (!current.latestUpdatedAt || updatedAtMs >= current.latestUpdatedAtMs) {
        current.latestUpdatedAt = updatedAt || current.latestUpdatedAt;
        current.latestUpdatedAtMs = updatedAtMs;
        current.latestSessionId = sessionId || current.latestSessionId;
      }

      map.set(key, current);
    });

    return map;
  }

  function mergeRuntimeSessionsWithChatThreads(sessions) {
    const merged = new Map();

    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
      const sessionId = String(session?.sessionId || '').trim();
      if (!sessionId) return;
      merged.set(sessionId.toLowerCase(), {
        sessionId,
        agentId: String(session?.agentId || '').trim(),
        updatedAt: String(session?.updatedAt || '').trim() || null,
        source: String(session?.source || 'runtime').trim() || 'runtime',
      });
    });

    chatThreads.forEach((thread) => {
      const sessionId = String(thread?.sessionId || '').trim();
      if (!sessionId) return;

      const key = sessionId.toLowerCase();
      if (!merged.has(key)) {
        merged.set(key, {
          sessionId,
          agentId: String(thread?.agentId || '').trim(),
          updatedAt: String(thread?.updatedAt || thread?.createdAt || '').trim() || null,
          source: 'chat-history',
        });
      }
    });

    return Array.from(merged.values()).sort((left, right) => {
      const leftTs = new Date(left?.updatedAt || 0).getTime();
      const rightTs = new Date(right?.updatedAt || 0).getTime();
      if (rightTs !== leftTs) {
        return rightTs - leftTs;
      }

      return String(left?.sessionId || '').localeCompare(String(right?.sessionId || ''));
    });
  }

  function mergeRuntimeAgentsWithChatThreads(agents, sessions) {
    const merged = new Map();

    (Array.isArray(agents) ? agents : []).forEach((agent) => {
      const agentId = String(agent?.agentId || '').trim();
      if (!agentId) return;

      merged.set(agentId.toLowerCase(), {
        ...agent,
        agentId,
        name: String(agent?.name || agentId).trim() || agentId,
        source: String(agent?.source || 'runtime').trim() || 'runtime',
      });
    });

    const sessionStats = buildAgentSessionStats(sessions);
    chatThreads.forEach((thread) => {
      const agentId = String(thread?.agentId || '').trim();
      if (!agentId) return;

      const key = agentId.toLowerCase();
      const fromSessionCount = Number(sessionStats.get(key)?.count || 0);
      const current = merged.get(key);

      if (current) {
        const sourceParts = new Set(String(current.source || '').split('+').filter(Boolean));
        sourceParts.add('chat-history');
        merged.set(key, {
          ...current,
          sessionCount: Math.max(Number(current.sessionCount) || 0, fromSessionCount, 1),
          updatedAt: String(current.updatedAt || thread.updatedAt || '').trim() || null,
          source: Array.from(sourceParts).join('+'),
        });
      } else {
        merged.set(key, {
          agentId,
          name: agentId,
          description: 'Агент из сохранённой истории чатов.',
          status: 'history',
          updatedAt: String(thread.updatedAt || thread.createdAt || '').trim() || null,
          sessionCount: Math.max(fromSessionCount, 1),
          source: 'chat-history',
        });
      }
    });

    return Array.from(merged.values()).sort((left, right) => {
      const leftSessions = Number(left?.sessionCount) || 0;
      const rightSessions = Number(right?.sessionCount) || 0;
      if (rightSessions !== leftSessions) {
        return rightSessions - leftSessions;
      }

      return String(left?.agentId || '').localeCompare(String(right?.agentId || ''));
    });
  }

  function discoverRuntimeChatThreads(sessions) {
    let createdCount = 0;
    let changed = false;

    (Array.isArray(sessions) ? sessions : []).forEach((session) => {
      const sessionId = String(session?.sessionId || '').trim();
      if (!sessionId) return;

      const agentId = String(session?.agentId || '').trim();
      const existing = findChatThreadBySessionId(sessionId);

      if (!existing) {
        const created = createChatThread({
          agentId,
          sessionId,
          thinking: 'medium',
          timeoutSeconds: 180,
          showReasoning: true,
          source: 'runtime-discovered',
          updatedAt: String(session?.updatedAt || '').trim() || new Date().toISOString(),
          select: false,
        });

        if (created) {
          createdCount += 1;
          changed = true;
        }
        return;
      }

      let touched = false;
      if (agentId && !existing.agentId) {
        existing.agentId = agentId;
        touched = true;
      }

      const sessionUpdatedAt = String(session?.updatedAt || '').trim();
      if (sessionUpdatedAt) {
        const currentTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const nextTs = new Date(sessionUpdatedAt).getTime();
        if (Number.isFinite(nextTs) && nextTs > currentTs) {
          existing.updatedAt = sessionUpdatedAt;
          touched = true;
        }
      }

      if (touched) {
        applyAutoChatThreadTitle(existing);
        changed = true;
      }
    });

    if (changed) {
      sortChatThreadsInPlace();
      saveChatThreadsStore();
      renderChatThreadList();
      renderChatThreadSummary();
    }

    return { createdCount, changed };
  }

  function renderAgentsGrid(agents, sessions) {
    if (!agentsGrid) return;

    if (!agents.length) {
      agentsGrid.innerHTML = '<div class="bg-white border rounded-lg p-4 text-sm text-gray-600">Агенты не найдены. Запустите runtime и нажмите «Обновить».</div>';
      return;
    }

    const sessionStats = buildAgentSessionStats(sessions);

    agentsGrid.innerHTML = agents
      .map((agent) => {
        const agentId = String(agent?.agentId || '').trim();
        const key = agentId.toLowerCase();
        const stats = sessionStats.get(key);
        const sessionCount = Number(agent?.sessionCount) > 0 ? Number(agent.sessionCount) : Number(stats?.count) || 0;
        const isActive = sessionCount > 0 || ['active', 'running', 'online'].includes(String(agent?.status || '').toLowerCase());
        const statusDot = isActive ? 'bg-green-500' : 'bg-gray-400';
        const displayName = String(agent?.name || agentId || 'unknown');
        const description = String(agent?.description || '').trim() || 'Описание отсутствует в runtime.';
        const source = String(agent?.source || 'runtime');
        const updatedAt = String(agent?.updatedAt || stats?.latestUpdatedAt || '').trim();
        const agentWorkspacePath = String(agent?.workspacePath || '').trim();

        return `
          <div class="bg-white border rounded-lg p-4">
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="flex items-center min-w-0">
                <div class="w-3 h-3 rounded-full ${statusDot} mr-2"></div>
                <div class="font-semibold truncate" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
              </div>
              <span class="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">${escapeHtml(source)}</span>
            </div>
            <div class="text-sm text-gray-700 line-clamp-3">${escapeHtml(description)}</div>
            <div class="text-xs text-gray-600 mt-2">ID: ${escapeHtml(agentId || 'unknown')}</div>
            <div class="text-xs text-gray-500 mt-1">active sessions: ${sessionCount}</div>
            <div class="text-xs text-gray-500 mt-1">updated: ${escapeHtml(updatedAt || 'unknown')}</div>
            ${agentWorkspacePath ? `<div class="text-xs text-gray-500 mt-1 truncate" title="${escapeHtml(agentWorkspacePath)}">workspace: ${escapeHtml(agentWorkspacePath)}</div>` : ''}
            <div class="mt-3 flex gap-2">
              <button class="flex-1 text-sm border rounded px-2 py-1 hover:bg-gray-50" data-grid-agent-id="${escapeHtml(agentId)}" data-grid-session-id="${escapeHtml(stats?.latestSessionId || '')}" data-grid-workspace-path="${escapeHtml(agentWorkspacePath)}">
                Применить в чат
              </button>
              <button class="text-sm border border-red-300 text-red-600 rounded px-2 py-1 hover:bg-red-50" data-delete-agent-id="${escapeHtml(agentId)}">
                Удалить
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    agentsGrid.querySelectorAll('[data-grid-agent-id]').forEach((button) => {
      button.addEventListener('click', () => {
        applyRuntimeToChat({
          agentId: button.getAttribute('data-grid-agent-id') || '',
          sessionId: button.getAttribute('data-grid-session-id') || chatSessionIdInput?.value || 'bratan-desktop-ui',
          workspacePath: button.getAttribute('data-grid-workspace-path') || '',
        });
      });
    });

    agentsGrid.querySelectorAll('[data-delete-agent-id]').forEach((button) => {
      button.addEventListener('click', () => {
        deleteAgentById(button.getAttribute('data-delete-agent-id') || '');
      });
    });
  }

  async function deleteAgentById(agentId) {
    if (!agentId) return;

    const confirmed = confirm(`Удалить агента "${agentId}"? Это действие нельзя отменить.`);
    if (!confirmed) return;

    // grey-out the card while deleting
    const card = agentsGrid?.querySelector(`[data-delete-agent-id="${agentId}"]`)?.closest('.bg-white');
    if (card) card.style.opacity = '0.5';

    const deleteBtn = agentsGrid?.querySelector(`[data-delete-agent-id="${agentId}"]`);
    if (deleteBtn) deleteBtn.disabled = true;

    try {
      await window.api.openclaw.deleteAgent({ agentId });
      showNotification(`Агент "${agentId}" удалён.`, 'success');
      await refreshAgentRuntime();
    } catch (err) {
      if (card) card.style.opacity = '';
      if (deleteBtn) deleteBtn.disabled = false;
      showNotification(`Ошибка удаления: ${err?.message || err}`, 'error');
    }
  }

  async function createAgentFromForm() {
    if (createAgentInProgress) {
      return;
    }

    const name = String(newAgentNameInput?.value || '').trim();
    const task = String(newAgentTaskInput?.value || '').trim();

    if (!name || !task) {
      showNotification('Введите имя и задачу агента', 'warning');
      return;
    }

    createAgentInProgress = true;
    setCreateAgentUiBusy(true);
    appendAgentTrace('Create agent', `name=${name}`);

    try {
      const result = await window.api.openclaw.createAgent({ name, task });
      const createdAgent = result?.agent || null;
      const createdAgentId = String(createdAgent?.agentId || '').trim();

      if (newAgentNameInput) newAgentNameInput.value = '';
      if (newAgentTaskInput) newAgentTaskInput.value = '';

      if (createdAgentId) {
        applyRuntimeToChat({
          agentId: createdAgentId,
          sessionId: buildDerivedSessionId(createdAgentId),
          workspacePath: String(createdAgent?.workspacePath || '').trim(),
        });
      }

      showNotification(`Агент "${createdAgentId || name}" создан`, 'success');
      appendAgentTrace('Create agent success', `agent=${createdAgentId || name}`);
      await refreshAgentRuntime();
    } catch (err) {
      appendAgentTrace('Create agent error', err.message);
      showNotification('Ошибка создания агента: ' + err.message, 'error');
    } finally {
      createAgentInProgress = false;
      setCreateAgentUiBusy(false);
    }
  }

  if (btnCreateAgent) {
    btnCreateAgent.addEventListener('click', () => {
      void createAgentFromForm();
    });
  }

  [newAgentNameInput, newAgentTaskInput].forEach((input) => {
    if (!input) return;
    input.addEventListener('keypress', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      void createAgentFromForm();
    });
  });

  function applyRuntimeToChat({ agentId, sessionId, workspacePath: payloadWorkspacePath }) {
    const normalizedAgentId = String(agentId || '').trim();
    const normalizedSessionId = normalizeSessionIdValue(
      sessionId,
      normalizedAgentId ? buildDerivedSessionId(normalizedAgentId) : 'bratan-desktop-ui'
    );

    if (activeRequestId && normalizedAgentId && normalizedAgentId !== activeWorkspaceContext.agentId) {
      showNotification('Дождитесь завершения текущего запроса перед переключением агента.', 'warning');
      return;
    }

    const agentRecord = lastKnownAgentsList.find(
      (agent) => String(agent?.agentId || '').trim().toLowerCase() === normalizedAgentId.toLowerCase()
    );
    const newWorkspacePath = String(payloadWorkspacePath || agentRecord?.workspacePath || '').trim();
    const shouldSwitchWorkspace = Boolean(
      normalizedAgentId &&
        (normalizedAgentId !== activeWorkspaceContext.agentId ||
          (newWorkspacePath && newWorkspacePath !== activeWorkspaceContext.workspacePath))
    );

    if (shouldSwitchWorkspace) {
      // Persist current scope before changing localStorage keys.
      saveChatThreadsStore();

      if (newWorkspacePath) {
        setActiveWorkspaceContext(normalizedAgentId, newWorkspacePath);
        void initWorkspacePath(newWorkspacePath).then(() => refreshFileList(newWorkspacePath));
        showNotification(`Рабочая область переключена на агента "${normalizedAgentId}"`, 'info');
      } else {
        setActiveWorkspaceContext(normalizedAgentId, '');
        void initWorkspacePath().then(() => refreshFileList());
      }

      // Reload chat threads from the new storage scope (per workspace/agent).
      initializeChatThreads({ agentId: normalizedAgentId, sessionId: normalizedSessionId });
      void refreshRagStatus();
    }

    let targetThread = findChatThreadBySessionId(normalizedSessionId);
    if (!targetThread && normalizedAgentId) {
      targetThread = findChatThreadByAgentId(normalizedAgentId);
    }

    if (!targetThread) {
      targetThread = createChatThread({
        agentId: normalizedAgentId,
        sessionId: normalizedSessionId,
        thinking: 'medium',
        timeoutSeconds: 180,
        showReasoning: true,
        source: 'runtime-apply',
        select: false,
      });
    }

    if (!targetThread) {
      return;
    }

    if (normalizedAgentId) {
      targetThread.agentId = normalizedAgentId;
    }
    targetThread.sessionId = normalizedSessionId;
    applyAutoChatThreadTitle(targetThread);
    targetThread.updatedAt = new Date().toISOString();
    sortChatThreadsInPlace();
    saveChatThreadsStore();

    const switched = setActiveChatThread(targetThread.id);
    if (!switched) {
      return;
    }
    persistChatRuntimeSettings();
    showNotification('Параметры агента применены к чату', 'success');
  }

  function renderAgentRuntimeData(agents, sessions) {
    renderAgentsGrid(agents, sessions);

    if (agentsKnownList) {
      if (!agents.length) {
        agentsKnownList.innerHTML = '<div class="text-gray-500">Агенты пока не обнаружены</div>';
      } else {
        const sessionStats = buildAgentSessionStats(sessions);
        agentsKnownList.innerHTML = agents
          .map((agent) => {
            const stats = sessionStats.get(String(agent.agentId || '').toLowerCase());
            return `
            <button class="w-full text-left hover:bg-white border rounded px-2 py-1" data-apply-agent="${escapeHtml(agent.agentId)}" data-apply-session="${escapeHtml(stats?.latestSessionId || '')}" data-apply-workspace-path="${escapeHtml(agent.workspacePath || '')}">
              <span class="font-medium">${escapeHtml(agent.name || agent.agentId)}</span>
              <div class="text-xs text-gray-600">id: ${escapeHtml(agent.agentId)}</div>
              <div class="text-xs text-gray-500">sessions: ${Number(stats?.count || agent.sessionCount || 0)}</div>
            </button>
          `;
          })
          .join('');

        agentsKnownList.querySelectorAll('[data-apply-agent]').forEach((button) => {
          button.addEventListener('click', () => {
            applyRuntimeToChat({
              agentId: button.getAttribute('data-apply-agent') || '',
              sessionId: button.getAttribute('data-apply-session') || chatSessionIdInput?.value || 'bratan-desktop-ui',
              workspacePath: button.getAttribute('data-apply-workspace-path') || '',
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
            <button class="w-full text-left hover:bg-white border rounded px-2 py-1" data-session-id="${escapeHtml(session.sessionId)}" data-session-agent="${escapeHtml(session.agentId || '')}" data-session-workspace-path="${escapeHtml(session.workspacePath || '')}">
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
              workspacePath: button.getAttribute('data-session-workspace-path') || '',
            });
          });
        });
      }
    }
  }

  async function refreshAgentRuntime() {
    if (refreshAgentRuntimeInProgress) {
      return;
    }

    refreshAgentRuntimeInProgress = true;
    setRefreshAgentRuntimeUiBusy(true);

    try {
      const [agentsResult, sessionsResult] = await Promise.all([
        window.api.openclaw.listAgents(),
        window.api.openclaw.listSessions(),
      ]);

      const runtimeAgents = Array.isArray(agentsResult?.agents) ? agentsResult.agents : [];
      const runtimeSessions = Array.isArray(sessionsResult?.sessions) ? sessionsResult.sessions : [];
      const discovery = discoverRuntimeChatThreads(runtimeSessions);
      const sessions = mergeRuntimeSessionsWithChatThreads(runtimeSessions);
      const agents = mergeRuntimeAgentsWithChatThreads(runtimeAgents, sessions);

      lastKnownAgentsList = agents;
      renderAgentRuntimeData(agents, sessions);

      const activeRuntimeAgentId = String(chatAgentIdInput?.value || '').trim();
      if (activeRuntimeAgentId) {
        const activeRuntimeAgent = agents.find(
          (agent) => String(agent?.agentId || '').trim().toLowerCase() === activeRuntimeAgentId.toLowerCase()
        );
        const activeRuntimeWorkspacePath = String(activeRuntimeAgent?.workspacePath || '').trim();
        if (
          activeRuntimeWorkspacePath &&
          (activeWorkspaceContext.agentId !== activeRuntimeAgentId ||
            activeWorkspaceContext.workspacePath !== activeRuntimeWorkspacePath)
        ) {
          applyRuntimeToChat({
            agentId: activeRuntimeAgentId,
            sessionId: chatSessionIdInput?.value || buildDerivedSessionId(activeRuntimeAgentId),
            workspacePath: activeRuntimeWorkspacePath,
          });
        }
      }

      appendAgentTrace(
        'Runtime обновлён',
        `agents=${agents.length}, sessions=${sessions.length}, newChats=${discovery?.createdCount || 0}`
      );

      if (Number(discovery?.createdCount) > 0) {
        showNotification(`Обнаружены новые runtime-чаты: ${discovery.createdCount}`, 'info');
      }
    } catch (err) {
      if (agentsGrid) {
        agentsGrid.innerHTML = '<div class="bg-white border rounded-lg p-4 text-sm text-red-600">Не удалось загрузить runtime-агентов.</div>';
      }
      if (agentsKnownList) agentsKnownList.innerHTML = '<div class="text-red-600">Ошибка загрузки агентов</div>';
      if (agentsSessionsList) agentsSessionsList.innerHTML = '<div class="text-red-600">Ошибка загрузки сессий</div>';
      appendAgentTrace('Runtime ошибка', err.message);
    } finally {
      refreshAgentRuntimeInProgress = false;
      setRefreshAgentRuntimeUiBusy(false);
    }
  }

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
      const status = await window.api.rag.status({ workspaceKey: activeWorkspaceContext.workspaceKey });
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
        workspaceKey: activeWorkspaceContext.workspaceKey,
      });
      renderRagStatus(result?.status || {});
      const errors = Array.isArray(result?.errors) ? result.errors : [];
      const errorCount = errors.length;
      const notificationLevel = errorCount > 0 ? 'warning' : 'success';
      showNotification(`RAG индекс обновлён (${collection}): indexed=${result?.indexed || 0}, errors=${errorCount}`, notificationLevel);

      if (errorCount > 0 && ragAnswer) {
        ragAnswer.textContent = `Часть файлов не проиндексирована:\n${errors.slice(0, 6).join('\n')}`;
      }
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
      const status = await window.api.rag.clear({ workspaceKey: activeWorkspaceContext.workspaceKey });
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
      const result = await window.api.rag.search({ query, topK, collection, workspaceKey: activeWorkspaceContext.workspaceKey });
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
        timeoutSeconds: runtime.timeoutSeconds,
        requestId,
        workspaceKey: activeWorkspaceContext.workspaceKey,
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
      const result = await window.api.rag.exportIndex({ workspaceKey: activeWorkspaceContext.workspaceKey });
      if (result?.canceled) return;
      showNotification(`RAG экспортирован: ${result?.filePath || 'unknown file'}`, 'success');
    } catch (err) {
      showNotification('Ошибка экспорта RAG: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-rag-import').addEventListener('click', async () => {
    try {
      const result = await window.api.rag.importIndex({ mode: 'replace', workspaceKey: activeWorkspaceContext.workspaceKey });
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
    const savedChatTimeoutSeconds = normalizeChatTimeoutSeconds(localStorage.getItem('openclaw_chat_timeout_seconds'), 180);
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

    initializeChatThreads({
      agentId: savedChatAgentId,
      sessionId: savedChatSessionId,
      thinking: savedChatThinking,
      timeoutSeconds: savedChatTimeoutSeconds,
      showReasoning: savedShowReasoning,
    });

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
      const preferredWorkspacePath = String(activeWorkspaceContext.workspacePath || '').trim();
      void initWorkspacePath(preferredWorkspacePath).then(() => refreshFileList(preferredWorkspacePath || undefined));
      void refreshTransportStatus();
      void refreshOpenClawVersionInfo();
      void refreshOpenClawModels();
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
    localStorage.removeItem('openclaw_chat_timeout_seconds');
    localStorage.removeItem('openclaw_chat_show_reasoning');
    localStorage.removeItem('openclaw_update_channel');
    localStorage.removeItem(getChatThreadsStorageKey());
    localStorage.removeItem(getChatActiveThreadStorageKey());

    resetChatThreadsStore();
    initializeChatThreads({
      agentId: '',
      sessionId: 'bratan-desktop-ui',
      thinking: 'medium',
      timeoutSeconds: 180,
      showReasoning: true,
    });
    setSelectedOpenClawChannel('stable', false);

    showNotification('Настройки сброшены', 'info');

    openClawWS?.disconnect();
    openClawWS = null;
    initOpenClawWebSocket();
    void syncOpenClawConfig().then(() => {
      void initWorkspacePath().then(() => refreshFileList());
      void refreshTransportStatus();
      void refreshOpenClawVersionInfo();
      void refreshOpenClawModels();
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
  const modelProviderSelect = document.getElementById('model-provider-select');
  const modelProviderModelSelect = document.getElementById('model-provider-model-select');
  const modelProviderTokenInput = document.getElementById('model-provider-token');
  const modelProviderProfileIdInput = document.getElementById('model-provider-profile-id');
  const modelProviderTestQuery = document.getElementById('model-provider-test-query');
  const btnModelProviderSaveToken = document.getElementById('btn-model-provider-save-token');
  const btnModelProviderRefresh = document.getElementById('btn-model-provider-refresh');
  const btnModelProviderTest = document.getElementById('btn-model-provider-test');
  const modelProviderLiveDot = document.getElementById('model-provider-live-dot');
  const modelProviderLiveStatus = document.getElementById('model-provider-live-status');
  const modelProviderTestOutput = document.getElementById('model-provider-test-output');
  const modelProviderStatusList = document.getElementById('model-provider-status-list');

  let modelProviderState = {
    providers: [],
    models: [],
    currentModel: null,
    resolvedModel: null,
  };

  let modelProviderRefreshing = false;
  let modelProviderSaving = false;
  let modelProviderTesting = false;
  let modelProviderTokenAutofillInFlight = false;
  const modelProviderHealth = new Map();

  function normalizeProviderId(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getProviderIdFromModelKey(modelKey) {
    const normalized = String(modelKey || '').trim();
    const slashIndex = normalized.indexOf('/');
    if (slashIndex <= 0) {
      return '';
    }
    return normalized.slice(0, slashIndex);
  }

  function setModelProviderLiveIndicator(kind, message) {
    if (!modelProviderLiveDot || !modelProviderLiveStatus) {
      return;
    }

    modelProviderLiveDot.classList.remove('bg-gray-400', 'bg-green-500', 'bg-red-500', 'bg-yellow-500', 'bg-orange-500');

    if (kind === 'alive') {
      modelProviderLiveDot.classList.add('bg-green-500');
    } else if (kind === 'dead') {
      modelProviderLiveDot.classList.add('bg-red-500');
    } else if (kind === 'checking') {
      modelProviderLiveDot.classList.add('bg-yellow-500');
    } else if (kind === 'warning') {
      modelProviderLiveDot.classList.add('bg-orange-500');
    } else {
      modelProviderLiveDot.classList.add('bg-gray-400');
    }

    modelProviderLiveStatus.textContent = message || 'Статус: неизвестно';
  }

  function setModelProviderBusyUi() {
    const isBusy = modelProviderRefreshing || modelProviderSaving || modelProviderTesting;

    [modelProviderSelect, modelProviderModelSelect, modelProviderTokenInput, modelProviderProfileIdInput, modelProviderTestQuery]
      .forEach((control) => {
        if (!control) return;
        control.disabled = isBusy;
        control.classList.toggle('opacity-60', isBusy);
      });

    if (btnModelProviderRefresh) {
      btnModelProviderRefresh.disabled = isBusy;
      btnModelProviderRefresh.classList.toggle('opacity-60', isBusy);
    }
    if (btnModelProviderSaveToken) {
      btnModelProviderSaveToken.disabled = isBusy;
      btnModelProviderSaveToken.classList.toggle('opacity-60', isBusy);
    }
    if (btnModelProviderTest) {
      btnModelProviderTest.disabled = isBusy;
      btnModelProviderTest.classList.toggle('opacity-60', isBusy);
    }
  }

  function getSelectedProvider() {
    return normalizeProviderId(modelProviderSelect?.value || '');
  }

  function getSelectedProviderModels(providerId) {
    const id = normalizeProviderId(providerId);
    if (!id) {
      return [];
    }

    return (Array.isArray(modelProviderState.models) ? modelProviderState.models : [])
      .filter((model) => normalizeProviderId(getProviderIdFromModelKey(model.key)) === id);
  }

  async function syncModelProviderFromActiveModel(options = {}) {
    if (!modelProviderSelect || !modelProviderModelSelect) {
      return;
    }

    const activeModel = String(
      options.modelKey
      || openClawModelUiState.selectedModel
      || openClawModelUiState.resolvedModel
      || openClawModelUiState.currentModel
      || openClawModelSelect?.value
      || ''
    ).trim();

    if (!activeModel) {
      return;
    }

    if (!Array.isArray(modelProviderState.providers) || !modelProviderState.providers.length) {
      return;
    }

    const providerId = normalizeProviderId(getProviderIdFromModelKey(activeModel));
    if (!providerId) {
      return;
    }

    const providerRecord = modelProviderState.providers.find(
      (provider) => normalizeProviderId(provider.provider) === providerId
    );
    if (!providerRecord) {
      return;
    }

    modelProviderSelect.value = providerRecord.provider;
    renderModelProviderSelectors();

    const providerModels = getSelectedProviderModels(providerRecord.provider);
    const exactModel = providerModels.find((model) => String(model.key || '').trim() === activeModel);
    if (exactModel) {
      modelProviderModelSelect.value = exactModel.key;
    }

    if (!options.autofillToken || typeof window.api?.openclaw?.modelIntegrationsGetToken !== 'function') {
      return;
    }

    if (modelProviderTokenAutofillInFlight) {
      return;
    }

    modelProviderTokenAutofillInFlight = true;
    try {
      const payload = await window.api.openclaw.modelIntegrationsGetToken({
        provider: providerRecord.provider,
      });

      const token = String(payload?.token || '').trim();
      const masked = String(payload?.masked || '').trim();
      if (modelProviderTokenInput) {
        modelProviderTokenInput.value = token;
        if (token) {
          modelProviderTokenInput.placeholder = masked
            ? `Ключ подставлен (${masked})`
            : 'Ключ подставлен';
        } else {
          modelProviderTokenInput.placeholder = 'API key / token';
        }
      }
    } catch (err) {
      appendAgentTrace('Provider key autofill', `skip: ${err.message}`);
    } finally {
      modelProviderTokenAutofillInFlight = false;
    }
  }

  function renderModelProviderRows() {
    if (!modelProviderStatusList) {
      return;
    }

    const rows = Array.isArray(modelProviderState.providers) ? modelProviderState.providers : [];
    if (!rows.length) {
      modelProviderStatusList.innerHTML = '<div class="text-sm text-gray-500">Провайдеры не найдены.</div>';
      return;
    }

    modelProviderStatusList.innerHTML = rows
      .map((provider) => {
        const providerId = normalizeProviderId(provider.provider);
        const authOk = Boolean(provider.hasAuth);
        const authDot = authOk ? 'bg-green-500' : 'bg-red-500';
        const authText = authOk ? 'ключ настроен' : 'ключ отсутствует';
        const health = modelProviderHealth.get(providerId);

        const liveDot = health ? (health.alive ? 'bg-green-500' : 'bg-red-500') : 'bg-gray-400';
        const liveText = health
          ? (health.alive
            ? `жива (${Math.round(health.latencyMs || 0)} ms)`
            : `не жива (${health.error || 'ошибка'})`)
          : 'не проверялась';

        const modelCount = Array.isArray(provider.models) ? provider.models.length : 0;
        const selectedModel = provider.selectedModel ? `, active: ${escapeHtml(provider.selectedModel)}` : '';
        const labels = Array.isArray(provider.labels) && provider.labels.length
          ? `<div class="text-xs text-gray-500 mt-1 truncate">labels: ${escapeHtml(provider.labels.join(', '))}</div>`
          : '';

        return `
          <div class="border rounded p-2 bg-white">
            <div class="flex items-center justify-between gap-2">
              <div class="font-medium text-sm">${escapeHtml(provider.provider || 'unknown')}</div>
              <div class="text-xs text-gray-500">models: ${modelCount}${selectedModel}</div>
            </div>
            <div class="mt-1 flex items-center gap-3 text-xs">
              <span class="inline-flex items-center"><span class="w-2.5 h-2.5 rounded-full ${authDot} mr-1"></span>${escapeHtml(authText)}</span>
              <span class="inline-flex items-center"><span class="w-2.5 h-2.5 rounded-full ${liveDot} mr-1"></span>${escapeHtml(liveText)}</span>
            </div>
            <div class="text-xs text-gray-500 mt-1">auth: ${escapeHtml(provider.authKind || 'unknown')} ${escapeHtml(provider.authDetail || '')}</div>
            ${labels}
          </div>
        `;
      })
      .join('');
  }

  function renderModelProviderSelectors() {
    if (!modelProviderSelect || !modelProviderModelSelect) {
      return;
    }

    const providers = Array.isArray(modelProviderState.providers) ? modelProviderState.providers : [];
    const previousProvider = normalizeProviderId(modelProviderSelect.value);

    if (!providers.length) {
      modelProviderSelect.innerHTML = '<option value="">Провайдеры недоступны</option>';
      modelProviderModelSelect.innerHTML = '<option value="">Модели недоступны</option>';
      return;
    }

    modelProviderSelect.innerHTML = providers
      .map((provider) => `<option value="${escapeHtml(provider.provider)}">${escapeHtml(provider.provider)}</option>`)
      .join('');

    const defaultProvider = providers.find((provider) => normalizeProviderId(provider.provider) === previousProvider)?.provider
      || providers[0].provider;
    modelProviderSelect.value = defaultProvider;

    const selectedProvider = normalizeProviderId(defaultProvider);
    const providerModels = getSelectedProviderModels(selectedProvider);
    const previousModel = String(modelProviderModelSelect.value || '').trim();

    if (!providerModels.length) {
      modelProviderModelSelect.innerHTML = '<option value="">Модели не найдены</option>';
      modelProviderModelSelect.value = '';
    } else {
      modelProviderModelSelect.innerHTML = providerModels
        .map((model) => {
          const contextWindow = Number(model.contextWindow);
          const contextText = Number.isFinite(contextWindow) && contextWindow > 0
            ? ` | ${contextWindow.toLocaleString('ru-RU')} ctx`
            : '';
          return `<option value="${escapeHtml(model.key)}">${escapeHtml(model.key + contextText)}</option>`;
        })
        .join('');

      const matched = providerModels.some((model) => model.key === previousModel);
      modelProviderModelSelect.value = matched ? previousModel : providerModels[0].key;
    }

    if (modelProviderProfileIdInput && !modelProviderProfileIdInput.value.trim()) {
      modelProviderProfileIdInput.placeholder = `profile id (например: ${defaultProvider}:manual)`;
    }
  }

  async function refreshModelProviderIntegrations(options = {}) {
    if (modelProviderRefreshing) {
      return;
    }

    modelProviderRefreshing = true;
    setModelProviderBusyUi();
    if (modelProviderStatusList) {
      modelProviderStatusList.innerHTML = '<div class="text-sm text-gray-500">Обновляю статус провайдеров...</div>';
    }

    try {
      const payload = await window.api.openclaw.modelIntegrationsStatus();

      modelProviderState = {
        providers: Array.isArray(payload?.providers) ? payload.providers : [],
        models: Array.isArray(payload?.models) ? payload.models : [],
        currentModel: payload?.currentModel || null,
        resolvedModel: payload?.resolvedModel || null,
      };

      openClawModelsCatalog = new Map(
        modelProviderState.models
          .filter((model) => model && typeof model === 'object' && model.key)
          .map((model) => [normalizeModelKey(model.key), model])
      );

      renderModelProviderSelectors();
      renderModelProviderRows();
      const selectedProviderId = getSelectedProvider();
      const cachedHealth = modelProviderHealth.get(selectedProviderId);
      if (cachedHealth) {
        if (cachedHealth.alive) {
          setModelProviderLiveIndicator('alive', `Жива: ${cachedHealth.model} (${Math.round(cachedHealth.latencyMs || 0)} ms)`);
        } else {
          setModelProviderLiveIndicator('dead', `Не жива: ${cachedHealth.error || 'ошибка'}`);
        }
      } else {
        setModelProviderLiveIndicator('unknown', `Статус: model=${modelProviderState.resolvedModel || modelProviderState.currentModel || 'unknown'}`);
      }

      void syncModelProviderFromActiveModel({ autofillToken: true });

      if (options.notify) {
        showNotification(`Провайдеров моделей: ${modelProviderState.providers.length}`, 'info');
      }
    } catch (err) {
      if (modelProviderStatusList) {
        modelProviderStatusList.innerHTML = `<div class="text-sm text-red-600">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
      }
      setModelProviderLiveIndicator('dead', 'Статус: ошибка загрузки интеграций');
      if (options.notify) {
        showNotification('Ошибка загрузки интеграций моделей: ' + err.message, 'error');
      }
    } finally {
      modelProviderRefreshing = false;
      setModelProviderBusyUi();
    }
  }

  async function saveModelProviderToken() {
    const provider = String(modelProviderSelect?.value || '').trim();
    const token = String(modelProviderTokenInput?.value || '').trim();
    const profileId = String(modelProviderProfileIdInput?.value || '').trim();

    if (!provider) {
      showNotification('Выберите провайдера модели', 'warning');
      return;
    }
    if (!token) {
      showNotification('Введите ключ доступа провайдера', 'warning');
      return;
    }

    modelProviderSaving = true;
    setModelProviderBusyUi();
    setModelProviderLiveIndicator('checking', `Сохраняю ключ для ${provider}...`);

    try {
      const payload = await window.api.openclaw.modelIntegrationsSetToken({
        provider,
        token,
        profileId,
      });

      if (modelProviderTokenInput) {
        modelProviderTokenInput.value = '';
      }

      modelProviderState = {
        providers: Array.isArray(payload?.providers) ? payload.providers : modelProviderState.providers,
        models: Array.isArray(payload?.models) ? payload.models : modelProviderState.models,
        currentModel: payload?.currentModel || modelProviderState.currentModel,
        resolvedModel: payload?.resolvedModel || modelProviderState.resolvedModel,
      };

      openClawModelsCatalog = new Map(
        modelProviderState.models
          .filter((model) => model && typeof model === 'object' && model.key)
          .map((model) => [normalizeModelKey(model.key), model])
      );

      renderModelProviderSelectors();
      renderModelProviderRows();
      setModelProviderLiveIndicator('warning', `Ключ сохранён для ${provider}, запустите тест живости.`);
      showNotification(`Ключ для ${provider} сохранён`, 'success');
    } catch (err) {
      setModelProviderLiveIndicator('dead', `Ошибка сохранения ключа: ${err.message}`);
      showNotification('Ошибка сохранения ключа: ' + err.message, 'error');
    } finally {
      modelProviderSaving = false;
      setModelProviderBusyUi();
    }
  }

  async function runModelProviderHealthTest() {
    const provider = String(modelProviderSelect?.value || '').trim();
    const model = String(modelProviderModelSelect?.value || '').trim();
    const message = String(modelProviderTestQuery?.value || '').trim() || 'Reply exactly: OK';

    if (!provider) {
      showNotification('Выберите провайдера для теста', 'warning');
      return;
    }
    if (!model) {
      showNotification('Выберите модель для теста', 'warning');
      return;
    }

    modelProviderTesting = true;
    setModelProviderBusyUi();
    setModelProviderLiveIndicator('checking', `Проверяю ${provider} (${model})...`);
    if (modelProviderTestOutput) {
      modelProviderTestOutput.textContent = 'Выполняется тестовый запрос...';
    }

    try {
      const result = await window.api.openclaw.modelIntegrationsTest({
        provider,
        model,
        message,
        timeoutSeconds: 45,
      });

      const providerKey = normalizeProviderId(result?.provider || provider);
      modelProviderHealth.set(providerKey, {
        alive: Boolean(result?.alive),
        latencyMs: Number(result?.latencyMs) || 0,
        error: String(result?.error || '').trim(),
        model: String(result?.model || model).trim(),
        checkedAt: Date.now(),
      });

      renderModelProviderRows();

      if (result?.alive) {
        setModelProviderLiveIndicator('alive', `Жива: ${result.model} (${Math.round(result.latencyMs || 0)} ms)`);
        if (modelProviderTestOutput) {
          const restoredNote = result.restored === false
            ? `\n[WARNING] restore failed: ${result.restoreError || 'unknown'}`
            : '';
          const modeLine = result.modeUsed ? `\nmode=${result.modeUsed}` : '';
          const warningLine = result.warning ? `\nwarning=${result.warning}` : '';
          const canonicalLine = typeof result.canonicalReply === 'boolean'
            ? `\ncanonicalReply=${result.canonicalReply}`
            : '';
          const previewLine = result.warning && result.responsePreview
            ? `\n\n${result.responsePreview}`
            : '';
          modelProviderTestOutput.textContent = `alive=true\nmodel=${result.model}\nlatencyMs=${Math.round(result.latencyMs || 0)}${modeLine}${canonicalLine}${warningLine}${restoredNote}${previewLine}`;
        }
        showNotification(`Провайдер ${provider} отвечает`, 'success');
      } else {
        setModelProviderLiveIndicator('dead', `Не жива: ${result.error || 'ошибка теста'}`);
        if (modelProviderTestOutput) {
          const restoredNote = result.restored === false
            ? `\nrestoreError=${result.restoreError || 'unknown'}`
            : '';
          const modeLine = result.modeUsed ? `\nmode=${result.modeUsed}` : '';
          const probeErrorsLine = Array.isArray(result.probeErrors) && result.probeErrors.length
            ? `\nprobeErrors=${result.probeErrors.join(' | ')}`
            : '';
          const previewLine = result.responsePreview ? `\n\n${result.responsePreview}` : '';
          modelProviderTestOutput.textContent = `alive=false\nmodel=${result.model}\nlatencyMs=${Math.round(result.latencyMs || 0)}\nerror=${result.error || 'unknown'}${modeLine}${probeErrorsLine}${restoredNote}${previewLine}`;
        }
        showNotification(`Провайдер ${provider} не отвечает: ${result.error || 'unknown'}`, 'error');
      }

      void refreshOpenClawModels();
      void refreshModelProviderIntegrations();
    } catch (err) {
      setModelProviderLiveIndicator('dead', `Ошибка теста: ${err.message}`);
      if (modelProviderTestOutput) {
        modelProviderTestOutput.textContent = `Ошибка теста: ${err.message}`;
      }
      showNotification('Ошибка теста провайдера: ' + err.message, 'error');
    } finally {
      modelProviderTesting = false;
      setModelProviderBusyUi();
    }
  }

  if (modelProviderSelect) {
    modelProviderSelect.addEventListener('change', () => {
      renderModelProviderSelectors();
      const providerId = getSelectedProvider();
      const health = modelProviderHealth.get(providerId);
      if (health) {
        if (health.alive) {
          setModelProviderLiveIndicator('alive', `Жива: ${health.model} (${Math.round(health.latencyMs || 0)} ms)`);
        } else {
          setModelProviderLiveIndicator('dead', `Не жива: ${health.error || 'ошибка'}`);
        }
      } else {
        setModelProviderLiveIndicator('unknown', `Статус: ${providerId || 'неизвестно'}, тест не запускался`);
      }
    });
  }

  if (btnModelProviderRefresh) {
    btnModelProviderRefresh.addEventListener('click', () => {
      void refreshModelProviderIntegrations({ notify: true });
    });
  }

  if (btnModelProviderSaveToken) {
    btnModelProviderSaveToken.addEventListener('click', () => {
      void saveModelProviderToken();
    });
  }

  if (btnModelProviderTest) {
    btnModelProviderTest.addEventListener('click', () => {
      void runModelProviderHealthTest();
    });
  }

  const integrationsTab = document.getElementById('tab-integrations');
  if (integrationsTab) {
    integrationsTab.addEventListener('click', () => {
      void refreshModelProviderIntegrations();
    });
  }

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
  void refreshModelProviderIntegrations();

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
    void refreshOpenClawVersionInfo();
    void refreshOpenClawModels();
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
