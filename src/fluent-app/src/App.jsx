import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  FluentProvider,
  Tab,
  TabList,
  Text,
  Title3,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import {
  Bot20Regular,
  Chat20Regular,
  ClipboardTextLtr20Regular,
  DocumentSearch20Regular,
  Folder20Regular,
  PlugConnected20Regular,
  Settings20Regular,
} from '@fluentui/react-icons';
import {
  fetchGatewayRunning,
  getSavedThemeSetting,
  saveThemeSetting,
} from './bridge/apiClient';
import AgentsPanel from './components/AgentsPanel';
import ChatPanel from './components/ChatPanel';
import FilesPanel from './components/FilesPanel';
import IntegrationsPanel from './components/IntegrationsPanel';
import LogsPanel from './components/LogsPanel';
import RagPanel from './components/RagPanel';
import SettingsPanel from './components/SettingsPanel';
import TabErrorBoundary from './components/TabErrorBoundary';

const TABS = [
  { id: 'chat', label: 'Чат', icon: <Chat20Regular /> },
  { id: 'logs', label: 'Логи', icon: <ClipboardTextLtr20Regular /> },
  { id: 'files', label: 'Файлы', icon: <Folder20Regular /> },
  { id: 'agents', label: 'Агенты', icon: <Bot20Regular /> },
  { id: 'rag', label: 'RAG', icon: <DocumentSearch20Regular /> },
  { id: 'integrations', label: 'Интеграции', icon: <PlugConnected20Regular /> },
  { id: 'settings', label: 'Настройки', icon: <Settings20Regular /> },
];

function resolveThemeMode(themeSetting) {
  if (themeSetting === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }

  return themeSetting === 'dark' ? 'dark' : 'light';
}

function toClockLabel(value) {
  return value.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildWorkspaceKey(workspacePath) {
  const normalizedPath = String(workspacePath || '').trim();
  if (!normalizedPath) {
    return 'default';
  }

  return normalizedPath
    .toLowerCase()
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'default';
}

function createWorkspaceContext(agentId = '', workspacePath = '') {
  const normalizedAgentId = String(agentId || '').trim();
  const normalizedWorkspacePath = String(workspacePath || '').trim();

  return {
    agentId: normalizedAgentId,
    workspacePath: normalizedWorkspacePath,
    workspaceKey: buildWorkspaceKey(normalizedWorkspacePath),
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [themeSetting, setThemeSetting] = useState(() => getSavedThemeSetting('light'));
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveThemeMode(getSavedThemeSetting('light')));
  const [clock, setClock] = useState(() => toClockLabel(new Date()));
  const [gatewayOnline, setGatewayOnline] = useState(false);
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [workspaceContext, setWorkspaceContext] = useState(() => createWorkspaceContext());
  const [chatRuntimeRequest, setChatRuntimeRequest] = useState(null);

  const syncGatewayStatus = useCallback(async () => {
    const running = await fetchGatewayRunning();
    setGatewayOnline(running);
    return running;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(toClockLabel(new Date()));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncStatus() {
      const running = await fetchGatewayRunning();
      if (!cancelled) {
        setGatewayOnline(running);
      }
    }

    void syncStatus();
    const timer = window.setInterval(() => {
      void syncStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const nextTheme = resolveThemeMode(themeSetting);
    setResolvedTheme(nextTheme);
    saveThemeSetting(themeSetting);
  }, [themeSetting]);

  useEffect(() => {
    if (themeSetting !== 'auto' || typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      setResolvedTheme(media.matches ? 'dark' : 'light');
    };

    apply();

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [themeSetting]);

  const startGateway = useCallback(async () => {
    if (gatewayBusy || gatewayOnline) {
      return;
    }

    setGatewayBusy(true);
    try {
      await window.api?.openclaw?.start?.();
    } catch {
      // keep status polling as the source of truth
    } finally {
      await syncGatewayStatus();
      setGatewayBusy(false);
    }
  }, [gatewayBusy, gatewayOnline, syncGatewayStatus]);

  const stopGateway = useCallback(async () => {
    if (gatewayBusy || !gatewayOnline) {
      return;
    }

    setGatewayBusy(true);
    try {
      await window.api?.openclaw?.stop?.();
    } catch {
      // keep status polling as the source of truth
    } finally {
      await syncGatewayStatus();
      setGatewayBusy(false);
    }
  }, [gatewayBusy, gatewayOnline, syncGatewayStatus]);

  const fluentTheme = useMemo(() => {
    return resolvedTheme === 'dark' ? webDarkTheme : webLightTheme;
  }, [resolvedTheme]);

  const activeTabLabel = useMemo(() => {
    return TABS.find((t) => t.id === activeTab)?.label ?? activeTab;
  }, [activeTab]);

  const handleApplyToChat = useCallback((payload = {}) => {
    const nextAgentId = String(payload.agentId || '').trim();
    const nextSessionId = String(payload.sessionId || '').trim();
    const nextWorkspacePath = String(payload.workspacePath || '').trim();

    setWorkspaceContext(createWorkspaceContext(nextAgentId, nextWorkspacePath));
    setChatRuntimeRequest({
      agentId: nextAgentId,
      sessionId: nextSessionId,
      workspacePath: nextWorkspacePath,
      requestId: `runtime-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    });
    setActiveTab('chat');
  }, []);

  return (
    <FluentProvider className={`app-root theme-${resolvedTheme}`} theme={fluentTheme}>
      <div className="app-shell">
        <aside className="sidebar-panel">
          <div className="brand-dot">OC</div>
          <TabList
            vertical
            appearance="subtle"
            selectedValue={activeTab}
            onTabSelect={(_, data) => setActiveTab(data.value)}
            className="sidebar-tabs"
          >
            {TABS.map((tab) => (
              <Tab
                key={tab.id}
                id={`tab-${tab.id}`}
                data-testid={`tab-${tab.id}`}
                value={tab.id}
                icon={tab.icon}
                aria-label={tab.label}
                title={tab.label}
              />
            ))}
          </TabList>
        </aside>

        <section className="main-panel">
          <header className="topbar-panel">
            <div className="topbar-title-block">
              <Title3 id="current-tab-title" data-testid="current-tab-title">
                {activeTabLabel}
              </Title3>
              <div id="gateway-status" data-testid="gateway-status">
                <Badge appearance={gatewayOnline ? 'filled' : 'tint'} color={gatewayOnline ? 'success' : 'danger'}>
                  {gatewayOnline ? 'Gateway Online' : 'Gateway Offline'}
                </Badge>
              </div>
            </div>

            <div className="topbar-actions">
              <Button
                id="btn-shell-start-gateway"
                data-testid="btn-shell-start-gateway"
                appearance="primary"
                size="small"
                disabled={gatewayBusy || gatewayOnline}
                onClick={() => void startGateway()}
              >
                {gatewayBusy && !gatewayOnline ? 'Starting...' : 'Start'}
              </Button>
              <Button
                id="btn-shell-stop-gateway"
                data-testid="btn-shell-stop-gateway"
                appearance="secondary"
                size="small"
                disabled={gatewayBusy || !gatewayOnline}
                onClick={() => void stopGateway()}
              >
                {gatewayBusy && gatewayOnline ? 'Stopping...' : 'Stop'}
              </Button>
              <Button
                appearance={themeSetting === 'light' ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setThemeSetting('light')}
              >
                Light
              </Button>
              <Button
                appearance={themeSetting === 'dark' ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setThemeSetting('dark')}
              >
                Dark
              </Button>
              <Button
                appearance={themeSetting === 'auto' ? 'primary' : 'secondary'}
                size="small"
                onClick={() => setThemeSetting('auto')}
              >
                Auto
              </Button>
              <Text className="clock-pill">{clock}</Text>
            </div>
          </header>

          <main className="tab-panel-area">
            <div id={`content-${activeTab}`} data-testid={`content-${activeTab}`} className="tab-content-panel">
              <TabErrorBoundary resetKey={activeTab} tabId={activeTab} tabLabel={activeTabLabel}>
                {activeTab === 'chat' && (
                  <ChatPanel
                    key={`chat-${workspaceContext.workspaceKey}`}
                    workspaceScopeKey={workspaceContext.workspaceKey}
                    runtimeSelectionRequest={chatRuntimeRequest}
                  />
                )}
                {activeTab === 'logs' && <LogsPanel />}
                {activeTab === 'files' && <FilesPanel workspacePathOverride={workspaceContext.workspacePath} />}
                {activeTab === 'agents' && <AgentsPanel onApplyToChat={handleApplyToChat} />}
                {activeTab === 'rag' && <RagPanel workspaceKey={workspaceContext.workspaceKey} />}
                {activeTab === 'integrations' && <IntegrationsPanel />}
                {activeTab === 'settings' && <SettingsPanel />}
              </TabErrorBoundary>
            </div>
          </main>
        </section>
      </div>
    </FluentProvider>
  );
}
