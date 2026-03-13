/**
 * FilesPanel — Phase 3 Fluent file browser tab.
 * Wraps window.api.fs.listDir / openFile with Fluent components.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Breadcrumb,
  BreadcrumbButton,
  BreadcrumbDivider,
  BreadcrumbItem,
  Button,
  Divider,
  Input,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowUp20Regular,
  Document20Regular,
  FolderOpen20Regular,
  Home20Regular,
  ArrowClockwise20Regular,
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
  navBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
  pathInput: {
    flex: 1,
    minWidth: '200px',
  },
  breadcrumbRow: {
    padding: `0 ${tokens.spacingHorizontalXS}`,
  },
  fileGrid: {
    flex: 1,
    overflowY: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalS,
    alignContent: 'flex-start',
    minHeight: 0,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  fileCard: {
    cursor: 'pointer',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    textAlign: 'center',
    ':hover': {
      background: tokens.colorNeutralBackground1Hover,
      borderColor: tokens.colorBrandStroke1,
    },
  },
  fileName: {
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  fileMeta: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minHeight: '22px',
  },
  workspaceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizePath(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  const isUncLikeInput = /^[\\/]{2,}[^\\/]/.test(input);
  let n = input.replace(/\\/g, '/').replace(/\/+/g, '/');
  if ((isUncLikeInput || /^\/(wsl\.localhost|wsl\$)\//i.test(n)) && n.startsWith('/') && !n.startsWith('//')) {
    n = `/${n}`;
  }

  const driveOnly = n.match(/^([A-Za-z]:)$/);
  if (driveOnly) return `${driveOnly[1]}/`;
  const root = getRoot(n);
  if (n.length > root.length) n = n.replace(/\/+$/, '');
  return n;
}

function getRoot(p) {
  const unc = p.match(/^(\/\/[^/]+\/[^/]+)(?:\/|$)/);
  if (unc) return `${unc[1]}/`;
  const drive = p.match(/^([A-Za-z]:)(?:\/|$)/);
  if (drive) return `${drive[1]}/`;
  if (p.startsWith('/')) return '/';
  return '';
}

function getSegments(p) {
  const n = normalizePath(p);
  const root = getRoot(n);
  const rest = root ? n.slice(root.length) : n;
  return rest.split('/').filter(Boolean);
}

function joinPath(root, segments) {
  const safe = (Array.isArray(segments) ? segments : []).filter(Boolean);
  if (!root) return safe.join('/');
  if (!safe.length) return root;
  return `${root}${safe.join('/')}`;
}

function isRoot(p) {
  const n = normalizePath(p);
  const root = getRoot(n);
  return Boolean(root) && n.toLowerCase() === root.toLowerCase();
}

function getParent(p) {
  const n = normalizePath(p);
  if (!n) return '';
  const root = getRoot(n);
  if (root && n.toLowerCase() === root.toLowerCase()) return root;
  const segments = getSegments(n);
  if (!segments.length) return root || n;
  segments.pop();
  return segments.length ? joinPath(root, segments) : root || n;
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilesPanel({ workspacePathOverride = '' }) {
  const styles = useStyles();
  const api = getDesktopApi();

  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [currentDir, setCurrentDir] = useState('');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pathInputValue, setPathInputValue] = useState('');

  // Initialize workspace root
  useEffect(() => {
    async function init() {
      try {
        const wsPath = normalizePath(
          workspacePathOverride || (api?.getWorkspacePath ? await api.getWorkspacePath() : '~/.openclaw/workspace')
        );
        setWorkspaceRoot(wsPath);
        setCurrentDir(wsPath);
        setPathInputValue(wsPath);
      } catch {
        const fallback = normalizePath(workspacePathOverride || '~/.openclaw/workspace');
        setWorkspaceRoot(fallback);
        setCurrentDir(fallback);
        setPathInputValue(fallback);
      }
    }
    void init();
  }, [api, workspacePathOverride]);

  // Load entries whenever currentDir changes
  useEffect(() => {
    if (!currentDir) return;
    void loadDir(currentDir);
  }, [currentDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDir = useCallback(async (targetPath) => {
    const normalized = normalizePath(targetPath || currentDir);
    if (!normalized) return;

    setLoading(true);
    setError('');

    try {
      const rawEntries = await api?.fs?.listDir?.(normalized) ?? [];
      const sorted = [...rawEntries].sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      setEntries(sorted);
      setCurrentDir(normalized);
      setPathInputValue(normalized);
    } catch (err) {
      setError(`Ошибка загрузки: ${err?.message || String(err)}`);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [api, currentDir]);

  const navigateTo = useCallback((path) => {
    void loadDir(path);
  }, [loadDir]);

  const handleEntryClick = useCallback((entry) => {
    const entryPath = normalizePath(`${currentDir}/${entry.name}`);
    if (entry.isDirectory) {
      navigateTo(entryPath);
    } else {
      if (!api?.fs?.openFile) return;
      void api.fs.openFile(entryPath).catch(() => {});
    }
  }, [currentDir, navigateTo, api]);

  const handlePathSubmit = useCallback((e) => {
    if (e.key === 'Enter') navigateTo(pathInputValue);
  }, [pathInputValue, navigateTo]);

  // Breadcrumb segments
  const root = getRoot(normalizePath(currentDir));
  const segments = getSegments(normalizePath(currentDir));
  const rootLabel = root === '/' ? '/' : root.replace(/\/$/, '');

  return (
    <div className={styles.root} data-testid="files-panel">
      {/* Navigation bar */}
      <div className={styles.navBar}>
        <Button
          icon={<Home20Regular />}
          size="small"
          appearance="subtle"
          id="btn-files-home"
          title="Home — рабочая папка"
          aria-label="Home — рабочая папка"
          onClick={() => navigateTo(workspaceRoot)}
        />
        <Button
          icon={<ArrowUp20Regular />}
          size="small"
          appearance="subtle"
          id="btn-files-up"
          title="На уровень вверх"
          aria-label="На уровень вверх"
          disabled={isRoot(currentDir)}
          onClick={() => navigateTo(getParent(currentDir))}
        />
        <Button
          icon={<ArrowClockwise20Regular />}
          size="small"
          appearance="subtle"
          title="Обновить"
          aria-label="Обновить"
          disabled={loading}
          onClick={() => void loadDir(currentDir)}
        />
        <Input
          className={styles.pathInput}
          size="small"
          value={pathInputValue}
          onChange={(_, d) => setPathInputValue(d.value)}
          onKeyDown={handlePathSubmit}
          placeholder="Путь к директории"
          id="files-current-path"
          data-testid="files-current-path"
        />
      </div>

      {/* Breadcrumb */}
      {(root || segments.length > 0) && (
        <div className={styles.breadcrumbRow} id="files-breadcrumbs" data-testid="files-breadcrumbs">
          <Breadcrumb size="small">
            {root && (
              <BreadcrumbItem>
                <BreadcrumbButton onClick={() => navigateTo(root)} data-fs-crumb={root}>
                  {rootLabel}
                </BreadcrumbButton>
              </BreadcrumbItem>
            )}
            {segments.map((segment, i) => {
              const crumbPath = joinPath(root, segments.slice(0, i + 1));
              return (
                <React.Fragment key={crumbPath}>
                  <BreadcrumbDivider />
                  <BreadcrumbItem>
                    <BreadcrumbButton
                      current={i === segments.length - 1}
                      onClick={() => navigateTo(crumbPath)}
                      data-fs-crumb={crumbPath}
                    >
                      {segment}
                    </BreadcrumbButton>
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </Breadcrumb>
        </div>
      )}

      <Divider />

      {/* File grid */}
      <div className={styles.fileGrid} id="file-list" data-testid="file-list">
        {loading && (
          <div className={styles.empty}>
            <Spinner size="small" label="Загрузка..." />
          </div>
        )}
        {!loading && error && (
          <div className={styles.empty}>
            <Text size={200} style={{ color: tokens.colorStatusDangerForeground1 }}>{error}</Text>
          </div>
        )}
        {!loading && !error && entries.length === 0 && (
          <div className={styles.empty}>
            <Text size={200}>Папка пуста</Text>
          </div>
        )}
        {!loading && !error && entries.map((entry) => (
          <div
            key={entry.name}
            className={styles.fileCard}
            onClick={() => handleEntryClick(entry)}
            onDoubleClick={() => handleEntryClick(entry)}
            data-entry-name={entry.name}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleEntryClick(entry)}
          >
            {entry.isDirectory
              ? <FolderOpen20Regular style={{ fontSize: '28px', color: tokens.colorBrandForeground1 }} />
              : <Document20Regular style={{ fontSize: '28px', color: tokens.colorNeutralForeground2 }} />
            }
            <span className={styles.fileName} title={entry.name}>{entry.name}</span>
            {!entry.isDirectory && entry.size !== undefined && (
              <span className={styles.fileMeta}>{formatSize(entry.size)}</span>
            )}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div className={styles.statusBar}>
        <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
          Рабочая папка: <strong data-testid="workspace-path">{workspaceRoot || '—'}</strong>
        </Text>
        <Badge appearance="tint" color="subtle">
          {entries.length} элем.
        </Badge>
      </div>
    </div>
  );
}
