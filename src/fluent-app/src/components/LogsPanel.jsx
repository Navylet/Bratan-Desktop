/**
 * LogsPanel — Phase 3 Fluent logs tab.
 * Hooks into window.api.onOpenClawLog for real-time log streaming.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Divider,
  Text,
  Toolbar,
  ToolbarButton,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  Delete20Regular,
  Save20Regular,
  ArrowDown20Regular,
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  logArea: {
    flex: 1,
    overflowY: 'auto',
    fontFamily: '"Cascadia Code", "Consolas", monospace',
    fontSize: tokens.fontSizeBase200,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minHeight: 0,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  logLine: {
    padding: '1px 0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    lineHeight: '1.5',
  },
  stdout: {
    color: tokens.colorNeutralForeground1,
  },
  stderr: {
    color: tokens.colorStatusDangerForeground1,
  },
  info: {
    color: tokens.colorBrandForeground1,
  },
  warn: {
    color: tokens.colorStatusWarningForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    padding: tokens.spacingVerticalM,
  },
  countBadge: {
    marginLeft: 'auto',
  },
});

function classifyLine(type, message) {
  const msg = String(message || '').toLowerCase();
  if (type === 'stderr') return 'stderr';
  if (msg.includes('error') || msg.includes('fail')) return 'stderr';
  if (msg.includes('warn')) return 'warn';
  if (msg.includes('info') || msg.includes('start')) return 'info';
  return 'stdout';
}

let logIdCounter = 0;
function nextId() {
  logIdCounter += 1;
  return logIdCounter;
}

export default function LogsPanel() {
  const styles = useStyles();
  const [lines, setLines] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef(null);
  const logAreaRef = useRef(null);

  // Attach IPC log listener
  useEffect(() => {
    const api = getDesktopApi();
    if (!api?.onOpenClawLog) return;

    const unsubscribe = api.onOpenClawLog((data) => {
      const type = String(data?.type || 'stdout');
      const message = String(data?.message || '').trim();
      if (!message) return;

      setLines((prev) => [
        ...prev.slice(-4999),
        {
          id: nextId(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          kind: classifyLine(type, message),
          message,
        },
      ]);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Auto-scroll when new lines arrive
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = logAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(nearBottom);
  }, []);

  const clearLogs = useCallback(() => setLines([]), []);

  const saveLogs = useCallback(() => {
    const content = lines.map((l) => `[${l.time}] ${l.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openclaw-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lines]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  }, []);

  return (
    <div className={styles.root} data-testid="logs-panel">
      <div className={styles.toolbar}>
        <Button
          icon={<Delete20Regular />}
          size="small"
          appearance="subtle"
          onClick={clearLogs}
          id="btn-clear-logs"
          data-testid="btn-clear-logs"
        >
          Очистить
        </Button>
        <Button
          icon={<Save20Regular />}
          size="small"
          appearance="subtle"
          disabled={!lines.length}
          onClick={saveLogs}
          id="btn-save-logs"
          data-testid="btn-save-logs"
        >
          Сохранить
        </Button>
        <Button
          icon={<ArrowDown20Regular />}
          size="small"
          appearance={autoScroll ? 'primary' : 'subtle'}
          onClick={scrollToBottom}
        >
          Прокрутить вниз
        </Button>
        <span className={styles.countBadge}>
          <Badge appearance="tint" color={lines.length ? 'brand' : 'subtle'}>
            {lines.length} строк
          </Badge>
        </span>
      </div>
      <Divider />
      <div
        ref={logAreaRef}
        className={styles.logArea}
        id="log-container"
        data-testid="log-container"
        onScroll={handleScroll}
      >
        {lines.length === 0 && (
          <div className={styles.empty}>
            <Text size={200}>Логи появятся при запуске Gateway или отправке запроса...</Text>
          </div>
        )}
        {lines.map((line) => (
          <div key={line.id} className={`${styles.logLine} ${styles[line.kind] || styles.stdout}`}>
            <Text size={200}>{`[${line.time}] ${line.message}`}</Text>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
