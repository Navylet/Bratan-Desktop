/**
 * ChatPanel — Phase 2 Fluent chat tab.
 *
 * Porting the full multi-thread chat logic from renderer.js into
 * a React/Fluent component tree. Business logic is intentionally
 * kept equivalent to the original; only the rendering layer changes.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Badge,
  Button,
  Card,
  Divider,
  Field,
  Input,
  Select,
  Spinner,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Add20Regular,
  ArrowRight20Filled,
  Attach20Regular,
  Delete20Regular,
  Edit20Regular,
} from '@fluentui/react-icons';
import {
  apiListModels,
  apiPickFiles,
  apiSendMessage,
  loadActiveThreadIdFromStorage,
  loadThreadsFromStorage,
  saveThreadsToStorage,
} from '../bridge/apiClient';

// ── Constants ─────────────────────────────────────────────────────────────────

const MESSAGE_LIMIT = 600;
const DEFAULT_GREETING =
  'Привет, бро! Я запущен в десктопном приложении. Готов помогать с GIGA ARPA и не только. Что будем делать?';
const THINKING_OPTIONS = ['off', 'minimal', 'low', 'medium', 'high'];

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    height: '100%',
    minHeight: 0,
    gap: tokens.spacingHorizontalM,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    minHeight: 0,
    overflow: 'hidden',
  },
  sidebarActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  threadList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    paddingRight: tokens.spacingHorizontalXXS,
  },
  threadItem: {
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    textAlign: 'left',
    ':hover': {
      background: tokens.colorNeutralBackground1Hover,
    },
  },
  threadItemActive: {
    background: tokens.colorBrandBackground2,
    borderColor: tokens.colorBrandStroke1,
    ':hover': {
      background: tokens.colorBrandBackground2Hover,
    },
  },
  threadTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  threadMeta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    gap: tokens.spacingVerticalS,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    paddingRight: tokens.spacingHorizontalXS,
  },
  msgUser: {
    alignSelf: 'flex-end',
    maxWidth: '76%',
    background: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    borderRadius: `${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusNone} ${tokens.borderRadiusXLarge}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
  },
  msgAsst: {
    alignSelf: 'flex-start',
    maxWidth: '82%',
    background: tokens.colorNeutralBackground3,
    borderRadius: `${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusNone}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  msgSystem: {
    alignSelf: 'center',
    maxWidth: '90%',
    textAlign: 'center',
    background: tokens.colorStatusWarningBackground1,
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    border: `1px solid ${tokens.colorStatusWarningBorder1}`,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorStatusWarningForeground1,
  },
  msgSender: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalXXS,
  },
  msgText: {
    fontSize: tokens.fontSizeBase300,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  msgTime: {
    fontSize: tokens.fontSizeBase100,
    marginTop: tokens.spacingVerticalXXS,
    opacity: 0.65,
  },
  inputBar: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end',
  },
  inputArea: {
    flex: 1,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minHeight: '24px',
  },
  settingsRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  settingField: {
    minWidth: '120px',
    flex: '1 1 120px',
  },
  attachmentsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  attachmentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    background: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: `2px ${tokens.spacingHorizontalXS}`,
    maxWidth: '320px',
  },
  attachmentName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '190px',
    fontSize: tokens.fontSizeBase200,
  },
  attachmentMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    flexShrink: 0,
  },
  msgMarkdown: {
    lineHeight: '1.5',
    '& p': {
      marginTop: '0',
      marginBottom: tokens.spacingVerticalXS,
    },
    '& p:last-child': {
      marginBottom: '0',
    },
    '& ul, & ol': {
      marginTop: tokens.spacingVerticalXS,
      marginBottom: tokens.spacingVerticalXS,
      paddingLeft: tokens.spacingHorizontalL,
    },
    '& li': {
      marginBottom: '2px',
    },
    '& blockquote': {
      margin: `${tokens.spacingVerticalXS} 0`,
      paddingLeft: tokens.spacingHorizontalS,
      borderLeft: `3px solid ${tokens.colorNeutralStroke2}`,
      color: tokens.colorNeutralForeground3,
    },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      marginTop: tokens.spacingVerticalXS,
      marginBottom: tokens.spacingVerticalXS,
      fontSize: tokens.fontSizeBase200,
    },
    '& th, & td': {
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      padding: `4px ${tokens.spacingHorizontalXS}`,
      textAlign: 'left',
    },
  },
  inlineCode: {
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    background: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusSmall,
    padding: '0 4px',
  },
  codeBlock: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    overflowX: 'auto',
    fontFamily: 'Consolas, "Courier New", monospace',
    fontSize: tokens.fontSizeBase200,
    lineHeight: '1.45',
    whiteSpace: 'pre',
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeThinking(value) {
  const v = String(value || '').trim().toLowerCase();
  return THINKING_OPTIONS.includes(v) ? v : 'medium';
}

function normalizeTimeout(value, fallback = 180) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 10 && n <= 600 ? n : fallback;
}

function normalizeSessionId(value, fallback = 'bratan-desktop-ui') {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
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
  return `${base || 'bratan-desktop-ui'}-chat-${Date.now().toString(36)}`;
}

function buildThreadTitle(agentId, sessionId) {
  if (agentId) return agentId;
  if (sessionId) return `default · ${sessionId}`;
  return 'Братан';
}

function createDefaultThread() {
  return makeThread({
    id: uid('thread'),
    agentId: '',
    sessionId: 'bratan-desktop-ui',
    thinking: 'medium',
    timeoutSeconds: 180,
    messages: [
      {
        id: uid('msg'),
        role: 'assistant',
        sender: 'Братан',
        text: DEFAULT_GREETING,
        transport: 'seed',
      },
    ],
  });
}

function loadScopedThreads(workspaceScopeKey) {
  const raw = loadThreadsFromStorage(workspaceScopeKey);
  if (raw.length) {
    return raw.map((thread, index) => makeThread(thread, index));
  }
  return [createDefaultThread()];
}

function loadScopedActiveThreadId(workspaceScopeKey) {
  const savedId = loadActiveThreadIdFromStorage(workspaceScopeKey);
  const raw = loadThreadsFromStorage(workspaceScopeKey);
  if (raw.length && savedId && raw.find((thread) => thread.id === savedId)) {
    return savedId;
  }
  if (raw.length) {
    return raw[0].id;
  }
  return null;
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function makeMessage(fields, index = 0) {
  const role = fields.role === 'user' ? 'user' : fields.role === 'system' ? 'system' : 'assistant';
  const text = String(fields.text || '').trim();
  const sender = String(
    fields.sender || (role === 'user' ? 'Дмитрий' : role === 'system' ? 'Система' : 'Братан')
  ).trim();
  return {
    id: String(fields.id || uid('msg')),
    role,
    sender,
    text,
    createdAt: String(fields.createdAt || new Date(Date.now() + index).toISOString()),
    reasoning: Array.isArray(fields.reasoning)
      ? fields.reasoning.map((e) => String(e || '')).filter(Boolean).slice(0, 16)
      : [],
    meta: fields.meta && typeof fields.meta === 'object' ? fields.meta : null,
    requestId: fields.requestId ? String(fields.requestId) : null,
    transport: fields.transport ? String(fields.transport) : null,
  };
}

function makeThread(fields, index = 0) {
  const agentId = String(fields.agentId || '').trim();
  const fallbackSid = agentId ? buildDerivedSessionId(agentId) : 'bratan-desktop-ui';
  const sessionId = normalizeSessionId(fields.sessionId, fallbackSid);
  const now = new Date().toISOString();
  const messages = Array.isArray(fields.messages)
    ? fields.messages
        .map((m, i) => makeMessage(m, i))
        .filter((m) => Boolean(m.text) || m.role === 'system')
        .slice(-MESSAGE_LIMIT)
    : [];
  return {
    id: String(fields.id || uid('thread')),
    title: fields.customTitle
      ? String(fields.title || buildThreadTitle(agentId, sessionId))
      : buildThreadTitle(agentId, sessionId),
    customTitle: fields.customTitle === true && Boolean(fields.title),
    agentId,
    sessionId,
    thinking: normalizeThinking(fields.thinking),
    timeoutSeconds: normalizeTimeout(fields.timeoutSeconds, 180),
    createdAt: String(fields.createdAt || now),
    updatedAt: String(fields.updatedAt || now),
    messages,
  };
}

function extractReplyText(result) {
  if (!result) return '';
  const candidates = [
    result.text,
    result.message,
    result.response,
    result.reply,
    result.content,
    typeof result.result === 'string' ? result.result : null,
    result.output,
  ];
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (v) return v;
  }
  return '';
}

function extractMeta(result) {
  if (!result) return null;
  const r = result?.raw || result;
  if (r?.usage && typeof r.usage === 'object') return r.usage;
  if (r?.meta && typeof r.meta === 'object') return r.meta;
  return null;
}

function extractReasoning(result) {
  const r = result?.raw || result;
  if (Array.isArray(r?.reasoning)) return r.reasoning;
  if (Array.isArray(result?.reasoning)) return result.reasoning;
  return [];
}

function executionModeLabel(mode) {
  const m = String(mode || 'auto').toLowerCase();
  const MAP = {
    auto: 'auto',
    pending: 'auto',
    gateway: 'gateway',
    local: 'local',
    websocket: 'websocket',
    cli: 'cli',
    error: 'error',
  };
  return MAP[m] || m;
}

function execModeBadgeColor(mode) {
  switch (mode) {
    case 'local':
      return 'success';
    case 'gateway':
      return 'informative';
    case 'websocket':
      return 'brand';
    case 'error':
      return 'danger';
    default:
      return 'subtle';
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChatMessage({ msg }) {
  const styles = useStyles();
  const dateStr = useMemo(() => {
    try {
      return new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [msg.createdAt]);

  if (msg.role === 'system') {
    return (
      <div className={styles.msgSystem}>
        <Text size={200}>{msg.text}</Text>
      </div>
    );
  }

  const isUser = msg.role === 'user';
  const shouldRenderMarkdown = !isUser;

  return (
    <div className={isUser ? styles.msgUser : styles.msgAsst}>
      <div className={styles.msgSender}>
        <Text size={200} weight="semibold">
          {msg.sender}
        </Text>
      </div>
      <div className={styles.msgText}>
        {shouldRenderMarkdown ? (
          <div className={styles.msgMarkdown}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noreferrer noopener">
                    {children}
                  </a>
                ),
                code: ({ inline, children }) => {
                  const codeText = String(children || '').replace(/\n$/, '');
                  if (inline) {
                    return <code className={styles.inlineCode}>{codeText}</code>;
                  }
                  return (
                    <pre className={styles.codeBlock}>
                      <code>{codeText}</code>
                    </pre>
                  );
                },
              }}
            >
              {msg.text}
            </ReactMarkdown>
          </div>
        ) : (
          <Text size={300}>{msg.text}</Text>
        )}
      </div>
      <div className={styles.msgTime}>
        <Text size={100}>{dateStr}</Text>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px' }}>
      <Spinner size="tiny" />
      <Text size={200} style={{ opacity: 0.7 }}>
        Братан думает...
      </Text>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ChatPanel({ runtimeSelectionRequest = null, workspaceScopeKey = 'default' }) {
  const styles = useStyles();
  const normalizedWorkspaceScopeKey = String(workspaceScopeKey || 'default').trim() || 'default';
  const appliedRuntimeRequestRef = useRef(null);

  // ── Threads state ────────────────────────────────────────────────────────
  const [threads, setThreads] = useState(() => {
    return loadScopedThreads(normalizedWorkspaceScopeKey);
  });

  const [activeThreadId, setActiveThreadId] = useState(() => {
    return loadScopedActiveThreadId(normalizedWorkspaceScopeKey);
  });

  // sync initial active thread id to first thread when bootstrapping empty
  useEffect(() => {
    if (!activeThreadId && threads.length) {
      setActiveThreadId(threads[0].id);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever threads or activeThreadId changes
  useEffect(() => {
    saveThreadsToStorage(threads, activeThreadId, normalizedWorkspaceScopeKey);
  }, [threads, activeThreadId, normalizedWorkspaceScopeKey]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId]
  );

  // ── Chat settings (synced from active thread) ────────────────────────────
  const [agentId, setAgentId] = useState(activeThread?.agentId || '');
  const [sessionId, setSessionId] = useState(activeThread?.sessionId || 'bratan-desktop-ui');
  const [thinking, setThinking] = useState(activeThread?.thinking || 'medium');
  const [timeoutSecs, setTimeoutSecs] = useState(activeThread?.timeoutSeconds || 180);

  // Sync controls when active thread changes
  useEffect(() => {
    if (!activeThread) return;
    setAgentId(activeThread.agentId || '');
    setSessionId(activeThread.sessionId || 'bratan-desktop-ui');
    setThinking(activeThread.thinking || 'medium');
    setTimeoutSecs(activeThread.timeoutSeconds || 180);
  }, [activeThread]);

  useEffect(() => {
    if (!activeThread) return;

    const normalizedAgentId = String(agentId || '').trim();
    const normalizedSessionId = normalizeSessionId(
      sessionId,
      normalizedAgentId ? buildDerivedSessionId(normalizedAgentId) : 'bratan-desktop-ui'
    );
    const normalizedThinking = normalizeThinking(thinking);
    const normalizedTimeoutSecs = normalizeTimeout(timeoutSecs, 180);

    setThreads((prev) => {
      let changed = false;
      const nextThreads = prev.map((thread) => {
        if (thread.id !== activeThread.id) {
          return thread;
        }

        const nextTitle = thread.customTitle === true
          ? thread.title
          : buildThreadTitle(normalizedAgentId, normalizedSessionId);

        const nextThread = {
          ...thread,
          agentId: normalizedAgentId,
          sessionId: normalizedSessionId,
          thinking: normalizedThinking,
          timeoutSeconds: normalizedTimeoutSecs,
          title: nextTitle,
        };

        if (
          nextThread.agentId === thread.agentId &&
          nextThread.sessionId === thread.sessionId &&
          nextThread.thinking === thread.thinking &&
          nextThread.timeoutSeconds === thread.timeoutSeconds &&
          nextThread.title === thread.title
        ) {
          return thread;
        }

        changed = true;
        return {
          ...nextThread,
          updatedAt: new Date().toISOString(),
        };
      });

      return changed ? nextThreads : prev;
    });
  }, [activeThread, agentId, sessionId, thinking, timeoutSecs]);

  // ── Sending state ────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [execMode, setExecMode] = useState('auto');

  // ── Streaming message accumulation ──────────────────────────────────────
  const [streamingText, setStreamingText] = useState('');
  const [streamingRequestId, setStreamingRequestId] = useState(null);
  const [selectedAttachments, setSelectedAttachments] = useState([]);

  useEffect(() => {
    const request = runtimeSelectionRequest;
    if (!request?.requestId || appliedRuntimeRequestRef.current === request.requestId) {
      return;
    }

    appliedRuntimeRequestRef.current = request.requestId;

    const normalizedAgentId = String(request.agentId || '').trim();
    const normalizedSessionId = normalizeSessionId(
      request.sessionId,
      normalizedAgentId ? buildDerivedSessionId(normalizedAgentId) : 'bratan-desktop-ui'
    );

    const matchBySession = threads.find((thread) => thread.sessionId === normalizedSessionId);
    const matchByAgent = normalizedAgentId
      ? threads.find((thread) => String(thread.agentId || '').trim().toLowerCase() === normalizedAgentId.toLowerCase())
      : null;
    const targetThread = matchBySession || matchByAgent;

    if (!targetThread) {
      const nowIso = new Date().toISOString();
      const newThread = makeThread({
        id: uid('thread'),
        agentId: normalizedAgentId,
        sessionId: normalizedSessionId,
        thinking: 'medium',
        timeoutSeconds: 180,
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: [],
      });

      setAgentId(normalizedAgentId);
      setSessionId(normalizedSessionId);
      setThinking(newThread.thinking || 'medium');
      setTimeoutSecs(newThread.timeoutSeconds || 180);
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      return;
    }

    const nextTitle = targetThread.customTitle === true
      ? targetThread.title
      : buildThreadTitle(normalizedAgentId, normalizedSessionId);

    setThreads((prev) => prev.map((thread) => {
      if (thread.id !== targetThread.id) {
        return thread;
      }

      return {
        ...thread,
        agentId: normalizedAgentId || thread.agentId,
        sessionId: normalizedSessionId,
        title: nextTitle,
        updatedAt: new Date().toISOString(),
      };
    }));
    setAgentId(normalizedAgentId || targetThread.agentId || '');
    setSessionId(normalizedSessionId);
    setThinking(targetThread.thinking || 'medium');
    setTimeoutSecs(targetThread.timeoutSeconds || 180);
    setActiveThreadId(targetThread.id);
  }, [runtimeSelectionRequest, threads]);

  // ── Ref for auto-scroll ──────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages, streamingText, sending]);

  // ── Models preload (best-effort) ─────────────────────────────────────────
  useEffect(() => {
    void apiListModels();
  }, []);

  const pickChatAttachments = useCallback(async () => {
    if (sending) return;

    try {
      const files = await apiPickFiles({ multi: true });
      if (!Array.isArray(files) || files.length === 0) return;

      setSelectedAttachments((prev) => {
        const known = new Set(prev.map((file) => file.path));
        const next = [...prev];

        files.forEach((file) => {
          const filePath = String(file?.path || '').trim();
          if (!filePath || known.has(filePath)) {
            return;
          }

          known.add(filePath);
          next.push({
            path: filePath,
            name: String(file?.name || filePath.split(/[\\/]/).pop() || filePath),
            size: Number(file?.size) || 0,
            mime: String(file?.mime || 'application/octet-stream'),
          });
        });

        return next.slice(0, 5);
      });
    } catch (err) {
      setLiveStatus(`Ошибка выбора файлов: ${err?.message || String(err)}`);
    }
  }, [sending]);

  const removeChatAttachment = useCallback((filePath) => {
    setSelectedAttachments((prev) => prev.filter((file) => file.path !== filePath));
  }, []);

  // ── Thread mutations ─────────────────────────────────────────────────────

  const addMessageToThread = useCallback((threadId, msgFields) => {
    setThreads((prev) => {
      return prev.map((thread) => {
        if (thread.id !== threadId) return thread;
        const msg = makeMessage({ ...msgFields }, thread.messages.length);
        if (!msg.text && msg.role !== 'system') return thread;
        const messages = [...thread.messages, msg].slice(-MESSAGE_LIMIT);
        return {
          ...thread,
          messages,
          updatedAt: msg.createdAt,
        };
      });
    });
  }, []);

  const createThread = useCallback(
    (options = {}) => {
      const nowIso = new Date().toISOString();
      const newThread = makeThread({
        id: uid('thread'),
        agentId: agentId,
        sessionId: normalizeSessionId(sessionId, buildDerivedSessionId(agentId)),
        thinking,
        timeoutSeconds: timeoutSecs,
        createdAt: nowIso,
        updatedAt: nowIso,
        messages: options.seed !== false
          ? [
              {
                id: uid('msg'),
                role: 'assistant',
                sender: 'Братан',
                text: DEFAULT_GREETING,
                transport: 'seed',
              },
            ]
          : [],
      });
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
      return newThread;
    },
    [agentId, sessionId, thinking, timeoutSecs]
  );

  const deleteActiveThread = useCallback(() => {
    if (!activeThreadId || threads.length <= 1) return;
    setThreads((prev) => {
      const next = prev.filter((t) => t.id !== activeThreadId);
      return next;
    });
    setThreads((prev) => {
      // pick first remaining
      if (prev.length) setActiveThreadId(prev[0].id);
      return prev;
    });
  }, [activeThreadId, threads.length]);

  const renameActiveThread = useCallback(() => {
    if (!activeThread) return;
    const newTitle = window.prompt('Введите новое название чата:', activeThread.title || '');
    if (!newTitle) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThread.id
          ? { ...t, title: newTitle.trim(), customTitle: true }
          : t
      )
    );
  }, [activeThread]);

  // ── Send handler ─────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    const attachmentPaths = selectedAttachments
      .map((file) => String(file?.path || '').trim())
      .filter(Boolean)
      .slice(0, 5);

    if ((!text && attachmentPaths.length === 0) || sending) return;

    const targetThread = activeThread;
    if (!targetThread) {
      alert('Нет активного чата. Создайте новый.');
      return;
    }

    const requestId = uid('req');
    const normalizedSession = normalizeSessionId(sessionId, 'bratan-desktop-ui');
    const normalizedAgent = agentId.trim();
    const userDisplayText = text || `Отправлены вложения: ${selectedAttachments.map((file) => file.name).join(', ')}`;

    // Optimistic: add user message
    addMessageToThread(targetThread.id, {
      role: 'user',
      sender: 'Дмитрий',
      text: userDisplayText,
      requestId,
      transport: 'user',
    });

    setInputText('');
    setSending(true);
    setLiveStatus('Запрос отправлен. Агент готовит ответ...');
    setExecMode('pending');
    setStreamingRequestId(requestId);

    try {
      const result = await apiSendMessage({
        text: text || 'Проанализируй приложенные файлы и ответь по их содержимому.',
        attachments: attachmentPaths,
        agentId: normalizedAgent || undefined,
        sessionId: normalizedSession,
        thinking: normalizeThinking(thinking),
        timeoutSeconds: normalizeTimeout(timeoutSecs, 180),
        requestId,
      });

      const replyText = extractReplyText(result) || 'Ответ получен, но текст пустой.';
      const responseMeta = extractMeta(result);
      const responseReasoning = extractReasoning(result);
      const effectiveAgent = String(result?.agentIdUsed || normalizedAgent || 'Братан');
      const mode = executionModeLabel(result?.executionMode || 'cli');

      addMessageToThread(targetThread.id, {
        role: 'assistant',
        sender: effectiveAgent,
        text: replyText,
        requestId,
        reasoning: responseReasoning,
        meta: responseMeta,
        transport: mode,
      });

      setSelectedAttachments([]);
      setExecMode(mode);
      setLiveStatus('');
    } catch (err) {
      addMessageToThread(targetThread.id, {
        role: 'system',
        sender: 'Система',
        text: 'Ошибка: ' + (err?.message || String(err)),
        transport: 'error',
      });
      setExecMode('error');
      setLiveStatus('');
    } finally {
      setSending(false);
      setStreamingRequestId(null);
      setStreamingText('');
    }
  }, [inputText, selectedAttachments, sending, activeThread, agentId, sessionId, thinking, timeoutSecs, addMessageToThread]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const sortedThreads = useMemo(
    () =>
      [...threads].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return tb - ta;
      }),
    [threads]
  );

  return (
    <div className={styles.root} data-testid="chat-panel">
      {/* ── Thread sidebar ─────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarActions}>
          <Button
            icon={<Add20Regular />}
            size="small"
            appearance="subtle"
            disabled={sending}
            onClick={() => createThread()}
            data-testid="btn-new-thread"
            title="Новый чат"
            aria-label="Новый чат"
          />
          <Button
            icon={<Edit20Regular />}
            size="small"
            appearance="subtle"
            disabled={!activeThreadId || sending}
            onClick={renameActiveThread}
            data-testid="btn-rename-thread"
            title="Переименовать"
            aria-label="Переименовать"
          />
          <Button
            icon={<Delete20Regular />}
            size="small"
            appearance="subtle"
            disabled={threads.length <= 1 || sending}
            onClick={deleteActiveThread}
            data-testid="btn-delete-thread"
            title="Удалить чат"
            aria-label="Удалить чат"
          />
        </div>
        <Divider />
        <div className={styles.threadList} data-testid="chat-threads-list">
          {sortedThreads.map((t) => (
            <button
              key={t.id}
              className={`${styles.threadItem} ${t.id === activeThreadId ? styles.threadItemActive : ''}`}
              onClick={() => setActiveThreadId(t.id)}
              data-testid={`thread-item-${t.id}`}
            >
              <div className={styles.threadTitle}>{t.title || 'Без названия'}</div>
              {t.agentId && (
                <div className={styles.threadMeta}>agent: {t.agentId}</div>
              )}
              <div className={styles.threadMeta}>{t.messages.length} сообщ.</div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main chat area ─────────────────────────────────────────────── */}
      <section className={styles.main}>
        {/* Settings row */}
        <div className={styles.settingsRow}>
          <Field label="Agent ID" className={styles.settingField}>
            <Input
              size="small"
              value={agentId}
              onChange={(_, d) => setAgentId(d.value)}
              placeholder="default"
              data-testid="chat-agent-id"
            />
          </Field>
          <Field label="Session ID" className={styles.settingField}>
            <Input
              size="small"
              value={sessionId}
              onChange={(_, d) => setSessionId(d.value)}
              placeholder="bratan-desktop-ui"
              data-testid="chat-session-id"
            />
          </Field>
          <Field label="Thinking" className={styles.settingField}>
            <Select
              size="small"
              value={thinking}
              onChange={(_, d) => setThinking(d.value)}
              data-testid="chat-thinking"
            >
              {THINKING_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timeout (s)" className={styles.settingField}>
            <Input
              size="small"
              type="number"
              value={String(timeoutSecs)}
              min={10}
              max={600}
              onChange={(_, d) => setTimeoutSecs(Number(d.value) || 180)}
              data-testid="chat-timeout-seconds"
            />
          </Field>
        </div>

        {/* Messages */}
        <Card
          appearance="filled-alternative"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        >
          <div
            className={styles.messages}
            id="chat-messages"
            data-testid="chat-messages"
          >
            {(activeThread?.messages || []).map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            {sending && <TypingDots />}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Status bar */}
        <div className={styles.statusBar}>
          {liveStatus && (
            <Text size={200} style={{ opacity: 0.75, flex: 1 }} data-testid="chat-live-status">
              {liveStatus}
            </Text>
          )}
          {execMode && execMode !== 'auto' && (
            <Badge
              appearance="tint"
              color={execModeBadgeColor(execMode)}
              data-testid="chat-execution-mode"
            >
              {execModeLabel(execMode)}
            </Badge>
          )}
        </div>

        {selectedAttachments.length > 0 && (
          <div className={styles.attachmentsRow} id="chat-attachments" data-testid="chat-attachments">
            {selectedAttachments.map((file) => (
              <div key={file.path} className={styles.attachmentChip}>
                <span className={styles.attachmentName} title={file.path}>{file.name}</span>
                <span className={styles.attachmentMeta}>{formatBytes(file.size)}</span>
                <Button
                  size="small"
                  appearance="subtle"
                  icon={<Delete20Regular />}
                  onClick={() => removeChatAttachment(file.path)}
                  title="Убрать файл"
                  aria-label="Убрать файл"
                />
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className={styles.inputBar}>
          <Button
            appearance="secondary"
            icon={<Attach20Regular />}
            disabled={sending}
            onClick={() => void pickChatAttachments()}
            id="btn-chat-attach"
            data-testid="btn-chat-attach"
            title="Прикрепить файлы"
            aria-label="Прикрепить файлы"
          />
          <Textarea
            className={styles.inputArea}
            resize="vertical"
            placeholder="Написать сообщение... (Enter — отправить, Shift+Enter — перенос)"
            value={inputText}
            onChange={(_, d) => setInputText(d.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            id="chat-input"
            data-testid="chat-input"
            rows={2}
          />
          <Button
            appearance="primary"
            icon={<ArrowRight20Filled />}
            iconPosition="after"
            disabled={(!inputText.trim() && selectedAttachments.length === 0) || sending}
            onClick={handleSend}
            id="btn-send"
            data-testid="btn-send"
          >
            Отправить
          </Button>
        </div>
      </section>
    </div>
  );
}

// tiny helper used in render (outside component to avoid re-creation)
function execModeLabel(mode) {
  const MAP = {
    auto: 'auto',
    pending: 'обработка...',
    gateway: 'gateway',
    local: 'local',
    websocket: 'websocket',
    cli: 'cli',
    error: 'ошибка',
  };
  return MAP[String(mode || 'auto').toLowerCase()] || mode;
}
