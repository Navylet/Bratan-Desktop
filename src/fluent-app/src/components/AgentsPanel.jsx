/**
 * AgentsPanel — Phase 3 Fluent agents tab.
 * Lists known agents and active sessions from window.api.openclaw.
 * Supports create / delete agent, apply to chat.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Divider,
  Field,
  Input,
  Spinner,
  Tab,
  TabList,
  Text,
  Textarea,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Add20Regular,
  ArrowClockwise20Regular,
  BotSparkle20Regular,
  Delete20Regular,
  LinkSquare20Regular,
  Person20Regular,
} from '@fluentui/react-icons';
import { getDesktopApi } from '../bridge/apiClient';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    gap: tokens.spacingVerticalS,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: tokens.spacingHorizontalM,
    minHeight: 0,
    overflow: 'hidden',
  },
  agentsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingVerticalS,
    overflowY: 'auto',
    alignContent: 'flex-start',
    padding: tokens.spacingHorizontalXS,
    minHeight: 0,
  },
  agentCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  agentCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
  },
  agentName: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  agentMeta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  agentDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    overflow: 'hidden',
    display: '-webkit-box',
    '-webkit-line-clamp': '3',
    '-webkit-box-orient': 'vertical',
  },
  agentActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    overflowY: 'auto',
    minHeight: 0,
  },
  sessionItem: {
    cursor: 'pointer',
    borderRadius: tokens.borderRadiusMedium,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    background: tokens.colorNeutralBackground1,
    textAlign: 'left',
    ':hover': { background: tokens.colorNeutralBackground1Hover },
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalS,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  empty: {
    padding: tokens.spacingVerticalL,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
});

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function isActiveAgent(agent) {
  return (
    Number(agent?.sessionCount) > 0 ||
    ['active', 'running', 'online'].includes(String(agent?.status || '').toLowerCase())
  );
}

export default function AgentsPanel({ onApplyToChat }) {
  const styles = useStyles();
  const api = getDesktopApi();

  const [agents, setAgents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newName, setNewName] = useState('');
  const [newTask, setNewTask] = useState('');

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [agentsRes, sessionsRes] = await Promise.all([
        api?.openclaw?.listAgents?.() ?? { agents: [] },
        api?.openclaw?.listSessions?.() ?? { sessions: [] },
      ]);

      const rAgents = Array.isArray(agentsRes?.agents) ? agentsRes.agents : [];
      const rSessions = Array.isArray(sessionsRes?.sessions) ? sessionsRes.sessions : [];

      // merge session counts into agents
      const sessionsByAgent = new Map();
      rSessions.forEach((s) => {
        const aid = String(s?.agentId || '').toLowerCase();
        if (aid) sessionsByAgent.set(aid, (sessionsByAgent.get(aid) || 0) + 1);
      });

      const merged = rAgents.map((a) => ({
        ...a,
        sessionCount: Math.max(
          Number(a.sessionCount) || 0,
          sessionsByAgent.get(String(a.agentId || '').toLowerCase()) || 0
        ),
      }));

      setAgents(merged);
      setSessions(rSessions);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [api, loading]);

  // Load on mount + tab focus
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = useCallback(async () => {
    if (!newName.trim() || !newTask.trim() || creating) return;
    setCreating(true);
    try {
      const result = await api?.openclaw?.createAgent?.({ name: newName.trim(), task: newTask.trim() });
      const createdAgent = result?.agent || null;
      const createdId = String(result?.agent?.agentId || '').trim();
      setNewName('');
      setNewTask('');
      await refresh();
      if (createdId && onApplyToChat) {
        onApplyToChat({
          agentId: createdId,
          sessionId: `${createdId}-chat-${Date.now().toString(36)}`,
          workspacePath: String(createdAgent?.workspacePath || '').trim(),
        });
      }
    } catch (err) {
      // surface error inline
      console.error('Create agent error:', err);
    } finally {
      setCreating(false);
    }
  }, [newName, newTask, creating, api, refresh, onApplyToChat]);

  const handleDelete = useCallback(async (agentId) => {
    if (!window.confirm(`Удалить агента "${agentId}"?`)) return;
    try {
      await api?.openclaw?.deleteAgent?.({ agentId });
      await refresh();
    } catch (err) {
      console.error('Delete agent error:', err);
    }
  }, [api, refresh]);

  return (
    <div className={styles.root} data-testid="agents-panel">
      <div className={styles.topBar}>
        <Button
          icon={<ArrowClockwise20Regular />}
          size="small"
          appearance="subtle"
          disabled={loading}
          onClick={() => void refresh()}
          id="btn-refresh-agent-runtime"
          data-testid="btn-refresh-agent-runtime"
        >
          {loading ? <Spinner size="tiny" /> : 'Обновить'}
        </Button>
        <Badge appearance="tint" color={agents.length ? 'brand' : 'subtle'}>
          {agents.length} агентов · {sessions.length} сессий
        </Badge>
      </div>

      <div className={styles.body}>
        {/* Agent cards */}
        <div className={styles.agentsGrid} id="agents-grid" data-testid="agents-grid">
          {agents.length === 0 && !loading && (
            <div className={styles.empty}>
              <Text size={200}>Агенты не найдены. Запустите runtime и нажмите «Обновить».</Text>
            </div>
          )}
          {agents.map((agent) => {
            const agentId = String(agent?.agentId || '').trim();
            const name = String(agent?.name || agentId || 'unknown');
            const desc = String(agent?.description || '').trim() || 'Описание отсутствует.';
            const active = isActiveAgent(agent);

            return (
              <div key={agentId} className={styles.agentCard} data-testid={`agent-card-${agentId}`}>
                <div className={styles.agentCardHeader}>
                  <div
                    className={styles.dot}
                    style={{ background: active ? tokens.colorStatusSuccessForeground1 : tokens.colorNeutralForeground4 }}
                  />
                  <span className={styles.agentName} title={name}>{name}</span>
                </div>
                <Text className={styles.agentDesc} size={200}>{desc}</Text>
                <Text className={styles.agentMeta}>ID: {agentId}</Text>
                <Text className={styles.agentMeta}>sessions: {agent.sessionCount || 0}</Text>
                {agent.workspacePath && (
                  <Text className={styles.agentMeta} title={agent.workspacePath} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    workspace: {agent.workspacePath}
                  </Text>
                )}
                <div className={styles.agentActions}>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<LinkSquare20Regular />}
                    style={{ flex: 1 }}
                    disabled={!onApplyToChat}
                    data-grid-agent-id={agentId}
                    onClick={() => onApplyToChat?.({
                      agentId,
                      sessionId: '',
                      workspacePath: String(agent.workspacePath || '').trim(),
                    })}
                  >
                    Применить в чат
                  </Button>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Delete20Regular />}
                    data-delete-agent-id={agentId}
                    onClick={() => void handleDelete(agentId)}
                    title="Удалить агента"
                    aria-label="Удалить агента"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar: sessions + create form */}
        <aside className={styles.sidebar}>
          {/* Sessions list */}
          <Text weight="semibold" size={300}>Сессии</Text>
          <div id="agents-sessions-list" data-testid="agents-sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sessions.length === 0 && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Нет активных runtime-сессий</Text>
            )}
            {sessions.map((session, i) => (
              <button
                key={`${session.sessionId}-${i}`}
                className={styles.sessionItem}
                onClick={() => onApplyToChat?.({
                  agentId: session.agentId || '',
                  sessionId: session.sessionId,
                  workspacePath: String(session.workspacePath || '').trim(),
                })}
                data-session-id={session.sessionId}
              >
                <Text weight="semibold" size={200}>{session.sessionId}</Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                  agent: {session.agentId || 'default'}
                </Text>
                {session.updatedAt && (
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                    updated: {session.updatedAt}
                  </Text>
                )}
              </button>
            ))}
          </div>

          <Divider />

          {/* Create agent form */}
          <div className={styles.createForm}>
            <Text weight="semibold" size={300}>Новый агент</Text>
            <Field label="Имя агента">
              <Input
                size="small"
                value={newName}
                onChange={(_, d) => setNewName(d.value)}
                placeholder="my-agent"
                id="new-agent-name"
                data-testid="new-agent-name"
                onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
              />
            </Field>
            <Field label="Задача">
              <Textarea
                size="small"
                value={newTask}
                onChange={(_, d) => setNewTask(d.value)}
                placeholder="Опиши задачу агента..."
                id="new-agent-task"
                data-testid="new-agent-task"
                rows={3}
              />
            </Field>
            <Button
              icon={<Add20Regular />}
              size="small"
              appearance="primary"
              disabled={!newName.trim() || !newTask.trim() || creating}
              onClick={() => void handleCreate()}
              id="btn-create-agent"
              data-testid="btn-create-agent"
            >
              {creating ? <Spinner size="tiny" /> : 'Создать'}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
