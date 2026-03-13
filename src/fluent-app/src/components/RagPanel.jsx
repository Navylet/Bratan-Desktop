/**
 * RagPanel — Phase 3 Fluent RAG Studio tab.
 * Wraps window.api.rag.* calls with Fluent components.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
  ArrowClockwise20Regular,
  ArrowExportLtr20Regular,
  ArrowImport20Regular,
  Delete20Regular,
  DocumentSearch20Regular,
  Search20Regular,
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
  body: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
    minHeight: 0,
    overflow: 'hidden',
  },
  left: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    overflow: 'hidden',
    minHeight: 0,
  },
  right: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    overflow: 'hidden',
    minHeight: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalS,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    maxHeight: '100px',
    overflowY: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
    padding: `2px ${tokens.spacingHorizontalXS}`,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  documents: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minHeight: 0,
  },
  docCard: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  hitsArea: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    minHeight: 0,
  },
  hit: {
    padding: tokens.spacingHorizontalS,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  answer: {
    padding: tokens.spacingHorizontalS,
    background: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '140px',
    overflowY: 'auto',
  },
  toolbar: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  liveStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minHeight: '22px',
  },
});

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

function safeText(value, fallback = '') {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text;
  return fallback;
}

function normalizeCollection(value, index = 0) {
  if (typeof value === 'string') {
    return { name: value, documents: 0, id: `collection-${index}` };
  }

  return {
    id: safeText(value?.id, `collection-${index}`),
    name: safeText(value?.name, 'default'),
    documents: Number(value?.documents) || 0,
  };
}

function normalizeChunkCount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object') return 1;
  return 0;
}

function normalizeDocument(doc, index = 0) {
  const docPath = safeText(doc?.path);
  const fallbackName = docPath ? docPath.split(/[\\/]/).pop() || `document-${index + 1}` : `document-${index + 1}`;

  return {
    id: safeText(doc?.id, `doc-${index}`),
    name: safeText(doc?.name, fallbackName),
    collection: safeText(doc?.collection, 'default'),
    path: docPath,
    size: Number(doc?.size) || 0,
    chunks: normalizeChunkCount(doc?.chunks),
    updatedAt: safeText(doc?.updatedAt),
  };
}

function normalizeHit(hit, index = 0) {
  const snippetSource = hit?.snippet ?? hit?.text ?? hit?.chunk ?? '';
  const snippet = safeText(snippetSource, safeText(snippetSource?.text, ''));

  return {
    id: safeText(hit?.id, `hit-${index}`),
    name: safeText(hit?.name, safeText(hit?.path, `hit-${index + 1}`)),
    collection: safeText(hit?.collection, 'default'),
    index: Number(hit?.index),
    score: Number.isFinite(Number(hit?.score)) ? Number(hit.score) : null,
    snippet,
  };
}

export default function RagPanel({ workspaceKey = 'default' }) {
  const styles = useStyles();
  const api = getDesktopApi();
  const normalizedWorkspaceKey = String(workspaceKey || 'default').trim() || 'default';

  const [status, setStatus] = useState({ documentsCount: 0, chunksCount: 0, documents: [], collections: [] });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [collection, setCollection] = useState('default');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [hits, setHits] = useState([]);
  const [answer, setAnswer] = useState('');
  const [liveStatus, setLiveStatus] = useState('');
  const [busyIndexing, setBusyIndexing] = useState(false);
  const [busySearch, setBusySearch] = useState(false);
  const [busyAsk, setBusyAsk] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api?.rag?.status?.({ workspaceKey: normalizedWorkspaceKey }) ?? {};
      setStatus({
        documentsCount: Number(s.documentsCount) || 0,
        chunksCount: Number(s.chunksCount) || 0,
        updatedAt: String(s.updatedAt || ''),
        documents: Array.isArray(s.documents) ? s.documents.map((doc, index) => normalizeDocument(doc, index)) : [],
        collections: Array.isArray(s.collections) ? s.collections.map((item, index) => normalizeCollection(item, index)) : [],
      });
    } catch {
      // keep last state
    }
  }, [api, normalizedWorkspaceKey]);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  const pickFiles = useCallback(async () => {
    try {
      const files = await api?.rag?.pickFiles?.({ multi: true }) ?? [];
      if (!Array.isArray(files)) return;
      setSelectedFiles((prev) => {
        const known = new Set(prev.map((f) => f.path));
        const added = files.filter((f) => f?.path && !known.has(f.path));
        return [...prev, ...added];
      });
    } catch {/* ignore */}
  }, [api]);

  const removeFile = useCallback((path) => {
    setSelectedFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const indexFiles = useCallback(async () => {
    if (!selectedFiles.length || busyIndexing) return;
    setBusyIndexing(true);
    setLiveStatus('Индексация файлов...');
    try {
      const result = await api?.rag?.indexFiles?.({
        files: selectedFiles.map((f) => f.path),
        collection: collection.trim() || 'default',
        workspaceKey: normalizedWorkspaceKey,
      });
      if (result?.status) {
        setStatus({
          documentsCount: Number(result.status.documentsCount) || 0,
          chunksCount: Number(result.status.chunksCount) || 0,
          updatedAt: String(result.status.updatedAt || ''),
          documents: Array.isArray(result.status.documents)
            ? result.status.documents.map((doc, index) => normalizeDocument(doc, index))
            : [],
          collections: Array.isArray(result.status.collections)
            ? result.status.collections.map((item, index) => normalizeCollection(item, index))
            : [],
        });
      }
      setLiveStatus(`Проиндексировано: ${result?.indexed || 0}`);
    } catch (err) {
      setLiveStatus(`Ошибка: ${err?.message}`);
    } finally {
      setBusyIndexing(false);
      setTimeout(() => setLiveStatus(''), 3000);
    }
  }, [selectedFiles, collection, busyIndexing, api, normalizedWorkspaceKey]);

  const searchRag = useCallback(async () => {
    if (!query.trim() || busySearch) return;
    setBusySearch(true);
    setLiveStatus('Поиск...');
    try {
      const result = await api?.rag?.search?.({
        query: query.trim(),
        topK,
        collection: collectionFilter,
        workspaceKey: normalizedWorkspaceKey,
      });
      setHits(Array.isArray(result?.hits) ? result.hits.map((hit, index) => normalizeHit(hit, index)) : []);
      setAnswer(`Найдено фрагментов: ${(result?.hits || []).length}`);
    } catch (err) {
      setAnswer(`Ошибка: ${err?.message}`);
    } finally {
      setBusySearch(false);
      setLiveStatus('');
    }
  }, [query, topK, collectionFilter, busySearch, api, normalizedWorkspaceKey]);

  const askRag = useCallback(async () => {
    if (!query.trim() || busyAsk) return;
    setBusyAsk(true);
    setLiveStatus('Генерирую ответ агента...');
    try {
      const result = await api?.rag?.ask?.({
        query: query.trim(),
        topK,
        collection: collectionFilter,
        sessionId: 'rag-studio-session',
        workspaceKey: normalizedWorkspaceKey,
      });
      setAnswer(safeText(result?.answer, 'Пустой ответ'));
      setHits(Array.isArray(result?.hits) ? result.hits.map((hit, index) => normalizeHit(hit, index)) : []);
    } catch (err) {
      setAnswer(`Ошибка: ${err?.message}`);
    } finally {
      setBusyAsk(false);
      setLiveStatus('');
    }
  }, [query, topK, collectionFilter, busyAsk, api, normalizedWorkspaceKey]);

  const clearIndex = useCallback(async () => {
    if (!window.confirm('Очистить RAG-индекс?')) return;
    try {
      const s = await api?.rag?.clear?.({ workspaceKey: normalizedWorkspaceKey });
      if (s) setStatus({
        documentsCount: 0, chunksCount: 0, updatedAt: '', documents: [], collections: [],
      });
      setHits([]);
      setAnswer('');
    } catch {/* ignore */}
  }, [api, normalizedWorkspaceKey]);

  const collections = [{ name: 'all' }, ...status.collections];

  return (
    <div className={styles.root} data-testid="rag-panel">
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Button size="small" appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={() => void refreshStatus()}>
          Обновить
        </Button>
        <Button size="small" appearance="subtle" icon={<Delete20Regular />} onClick={() => void clearIndex()}>
          Очистить индекс
        </Button>
        <Button
          size="small"
          appearance="subtle"
          icon={<ArrowExportLtr20Regular />}
          onClick={() => void api?.rag?.exportIndex?.({ workspaceKey: normalizedWorkspaceKey })}
        >
          Экспорт
        </Button>
        <Button
          size="small"
          appearance="subtle"
          icon={<ArrowImport20Regular />}
          onClick={() => void api?.rag?.importIndex?.({ mode: 'replace', workspaceKey: normalizedWorkspaceKey })}
        >
          Импорт
        </Button>
        <Badge appearance="tint" color="brand">
          {status.documentsCount} docs · {status.chunksCount} chunks
        </Badge>
        {liveStatus && (
          <div className={styles.liveStatus}>
            <Spinner size="tiny" />
            <Text size={200}>{liveStatus}</Text>
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* Left: indexing */}
        <div className={styles.left}>
          {/* File picker + indexing */}
          <div className={styles.section}>
            <Text weight="semibold" size={300}>Индексация</Text>
            <div className={styles.toolbar}>
              <Button size="small" appearance="subtle" icon={<Add20Regular />}
                id="btn-rag-pick-files" data-testid="btn-rag-pick-files"
                onClick={() => void pickFiles()}>
                Добавить файлы
              </Button>
              <Field label="Collection">
                <Input size="small" value={collection}
                  onChange={(_, d) => setCollection(d.value)}
                  id="rag-index-collection"
                  style={{ width: '120px' }} />
              </Field>
              <Button size="small" appearance="primary"
                icon={busyIndexing ? <Spinner size="tiny" /> : <DocumentSearch20Regular />}
                disabled={!selectedFiles.length || busyIndexing}
                id="btn-rag-index" data-testid="btn-rag-index"
                onClick={() => void indexFiles()}>
                Индексировать
              </Button>
            </div>
            <div className={styles.fileList} id="rag-selected-files" data-testid="rag-selected-files">
              {selectedFiles.length === 0 && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Файлы не выбраны</Text>
              )}
              {selectedFiles.map((f) => (
                <div key={f.path} className={styles.fileItem}>
                  <Text size={200} title={f.path} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {f.name}
                  </Text>
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }}>
                    {formatBytes(f.size)}
                  </Text>
                  <Button size="small" appearance="subtle" icon={<Delete20Regular />}
                    data-rag-remove={f.path}
                    onClick={() => removeFile(f.path)} />
                </div>
              ))}
            </div>
          </div>

          {/* Documents list */}
          <Text weight="semibold" size={300}>
            Документы в индексе{' '}
            <Badge appearance="tint" id="rag-index-status" data-testid="rag-index-status">
              {status.documentsCount} / {status.chunksCount} chunks
              {status.updatedAt ? ` · ${status.updatedAt}` : ''}
            </Badge>
          </Text>
          <div className={styles.documents} id="rag-documents" data-testid="rag-documents">
            {status.documents.length === 0 && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Индекс пуст</Text>
            )}
            {status.documents.map((doc, i) => (
              <div key={`${doc.path}-${i}`} className={styles.docCard}>
                <Text weight="semibold" size={200}>{doc.name}</Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                  collection: {doc.collection || 'default'} · chunks: {doc.chunks} · {formatBytes(doc.size)}
                </Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.path}>
                  {doc.path}
                </Text>
              </div>
            ))}
          </div>
        </div>

        {/* Right: search / ask */}
        <div className={styles.right}>
          <div className={styles.section}>
            <Text weight="semibold" size={300}>Поиск / Вопрос</Text>
            <Field label="Вопрос">
              <Textarea
                size="small"
                value={query}
                onChange={(_, d) => setQuery(d.value)}
                placeholder="Введите запрос к RAG..."
                id="rag-query"
                data-testid="rag-query"
                rows={3}
              />
            </Field>
            <div className={styles.toolbar}>
              <Field label="Top-K" style={{ width: '80px' }}>
                <Input size="small" type="number" min={1} max={20}
                  value={String(topK)}
                  onChange={(_, d) => setTopK(Number(d.value) || 5)}
                  id="rag-topk" />
              </Field>
              <Field label="Collection">
                <Select size="small" value={collectionFilter}
                  onChange={(_, d) => setCollectionFilter(d.value)}
                  id="rag-collection-filter">
                  {collections.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Button size="small" appearance="subtle"
                icon={busySearch ? <Spinner size="tiny" /> : <Search20Regular />}
                disabled={!query.trim() || busySearch}
                id="btn-rag-search" data-testid="btn-rag-search"
                onClick={() => void searchRag()}>
                Поиск
              </Button>
              <Button size="small" appearance="primary"
                icon={busyAsk ? <Spinner size="tiny" /> : <DocumentSearch20Regular />}
                disabled={!query.trim() || busyAsk}
                id="btn-rag-ask" data-testid="btn-rag-ask"
                onClick={() => void askRag()}>
                Задать агенту
              </Button>
            </div>
          </div>

          {/* Answer */}
          {answer && (
            <div className={styles.answer} id="rag-answer" data-testid="rag-answer">
              <Text size={200}>{answer}</Text>
            </div>
          )}

          {/* Hits */}
          <div className={styles.hitsArea} id="rag-results" data-testid="rag-results">
            {hits.length === 0 && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                Результаты поиска появятся здесь
              </Text>
            )}
            {hits.map((hit, i) => (
              <div key={i} className={styles.hit}>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                  {hit.name} · collection {hit.collection || 'default'} · chunk {Number.isFinite(hit.index) ? hit.index + 1 : '—'} · score {hit.score ?? '—'}
                </Text>
                <Text size={200} style={{ whiteSpace: 'pre-wrap', display: 'block', marginTop: '4px' }}>{hit.snippet}</Text>
              </div>
            ))}
          </div>

          {/* Live status */}
          {liveStatus && (
            <div id="rag-live-status" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Spinner size="tiny" />
              <Text size={200}>{liveStatus}</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
