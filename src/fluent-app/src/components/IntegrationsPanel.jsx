/**
 * IntegrationsPanel — Phase 3 Fluent integrations tab.
 * Model provider management: list providers, set API keys, test, refresh.
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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular,
  Checkmark20Regular,
  CircleFilled,
  PlugConnected20Regular,
  Send20Regular,
} from '@fluentui/react-icons';
import { getDesktopApi } from '../bridge/apiClient';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    gap: tokens.spacingVerticalM,
    overflowY: 'auto',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalM,
    minHeight: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  providerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  providerRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: tokens.spacingHorizontalS,
    background: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  providerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  configRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  liveRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minHeight: '22px',
  },
  testOutput: {
    padding: tokens.spacingHorizontalS,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '160px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
});

function normId(v) { return String(v || '').trim().toLowerCase(); }

function getLiveColor(health) {
  if (!health) return tokens.colorNeutralForeground4;
  return health.alive ? tokens.colorStatusSuccessForeground1 : tokens.colorStatusDangerForeground1;
}

export default function IntegrationsPanel() {
  const styles = useStyles();
  const api = getDesktopApi();

  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [health, setHealth] = useState(new Map()); // providerId → {alive,latencyMs,error}
  const [loading, setLoading] = useState(false);

  // Selected provider / model for config form
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [token, setToken] = useState('');
  const [profileId, setProfileId] = useState('');
  const [testQuery, setTestQuery] = useState('Reply with exactly: OK');
  const [testOutput, setTestOutput] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [liveStatus, setLiveStatus] = useState('');
  const [liveKind, setLiveKind] = useState('idle'); // idle | checking | alive | dead

  const refresh = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const payload = await api?.openclaw?.modelIntegrationsStatus?.() ?? {};
      const ps = Array.isArray(payload.providers) ? payload.providers : [];
      const ms = Array.isArray(payload.models) ? payload.models : [];
      setProviders(ps);
      setModels(ms);
      if (!selectedProvider && ps.length) {
        setSelectedProvider(ps[0].provider);
      }
    } catch {/* keep */}
    finally { setLoading(false); }
  }, [api, loading, selectedProvider]);

  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync model list when provider changes
  const providerModels = models.filter(
    (m) => normId(String(m.key || '').split('/')[0]) === normId(selectedProvider)
  );

  useEffect(() => {
    if (!selectedModel && providerModels.length) {
      setSelectedModel(providerModels[0].key);
    }
  }, [selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill token when provider selected
  useEffect(() => {
    if (!selectedProvider || !api?.openclaw?.modelIntegrationsGetToken) return;
    void api.openclaw.modelIntegrationsGetToken({ provider: selectedProvider })
      .then((payload) => {
        const t = String(payload?.token || '').trim();
        setToken(t);
      })
      .catch(() => {});
  }, [selectedProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToken = useCallback(async () => {
    if (!selectedProvider || saving) return;
    setSaving(true);
    setLiveStatus('Сохраняю ключ...');
    try {
      await api?.openclaw?.modelIntegrationsSetToken?.({
        provider: selectedProvider,
        token,
        profileId,
      });
      setLiveKind('alive');
      setLiveStatus('Ключ сохранён');
      void refresh();
    } catch (err) {
      setLiveKind('dead');
      setLiveStatus(`Ошибка: ${err?.message || err}`);
    } finally {
      setSaving(false);
      setTimeout(() => { setLiveStatus(''); setLiveKind('idle'); }, 3000);
    }
  }, [api, selectedProvider, token, profileId, saving, refresh]);

  const testProvider = useCallback(async () => {
    if (!selectedProvider || !testQuery.trim() || testing) return;
    setTesting(true);
    setLiveKind('checking');
    setLiveStatus('Тестирую...');
    setTestOutput('');
    try {
      const result = await api?.openclaw?.modelIntegrationsTest?.({
        provider: selectedProvider,
        model: selectedModel,
        query: testQuery.trim(),
      });
      const response = String(result?.response || result?.answer || '').trim() || JSON.stringify(result, null, 2);
      setTestOutput(response);
      const latency = Number(result?.latencyMs);
      setHealth((prev) => new Map(prev).set(normId(selectedProvider), {
        alive: true,
        latencyMs: latency || 0,
      }));
      setLiveKind('alive');
      setLiveStatus(`OK${Number.isFinite(latency) && latency > 0 ? ` (${latency} ms)` : ''}`);
    } catch (err) {
      setTestOutput(`Ошибка: ${err?.message || err}`);
      setHealth((prev) => new Map(prev).set(normId(selectedProvider), {
        alive: false,
        error: err?.message || String(err),
      }));
      setLiveKind('dead');
      setLiveStatus(`Ошибка: ${err?.message || err}`);
    } finally {
      setTesting(false);
    }
  }, [api, selectedProvider, selectedModel, testQuery, testing]);

  const providerLiveColor = {
    idle: tokens.colorNeutralForeground4,
    checking: tokens.colorStatusWarningForeground1,
    alive: tokens.colorStatusSuccessForeground1,
    dead: tokens.colorStatusDangerForeground1,
  }[liveKind] || tokens.colorNeutralForeground4;

  return (
    <div className={styles.root} data-testid="integrations-panel">
      <div className={styles.topBar}>
        <Button
          size="small"
          appearance="subtle"
          icon={loading ? <Spinner size="tiny" /> : <ArrowClockwise20Regular />}
          disabled={loading}
          onClick={() => void refresh()}
          id="btn-model-provider-refresh"
          data-testid="btn-model-provider-refresh"
        >
          Обновить
        </Button>
        <Badge appearance="tint" color="brand">
          {providers.length} провайдеров
        </Badge>
        {liveStatus && (
          <div className={styles.liveRow}>
            <div className={styles.dot} style={{ background: providerLiveColor }}
              id="model-provider-live-dot" />
            <Text size={200} id="model-provider-live-status">{liveStatus}</Text>
          </div>
        )}
      </div>

      <div className={styles.body}>
        {/* Provider list */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Провайдеры</span>
          <div className={styles.providerList} id="model-provider-status-list" data-testid="model-provider-status-list">
            {providers.length === 0 && !loading && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Провайдеры не найдены.</Text>
            )}
            {providers.map((p) => {
              const pid = normId(p.provider);
              const h = health.get(pid);
              const authOk = Boolean(p.hasAuth);
              const modelCount = Array.isArray(p.models) ? p.models.length : 0;

              return (
                <div key={p.provider} className={styles.providerRow}>
                  <div className={styles.providerHeader}>
                    <Text weight="semibold" size={200}>{p.provider}</Text>
                    <Text size={100} style={{ color: tokens.colorNeutralForeground3 }}>
                      {modelCount} models
                    </Text>
                  </div>
                  <div className={styles.row}>
                    <div className={styles.dot} style={{ background: authOk ? tokens.colorStatusSuccessForeground1 : tokens.colorStatusDangerForeground1 }} />
                    <Text size={100}>{authOk ? 'ключ настроен' : 'ключ отсутствует'}</Text>
                    <div className={styles.dot} style={{ background: getLiveColor(h) }} />
                    <Text size={100}>
                      {h ? (h.alive ? `жива (${Math.round(h.latencyMs || 0)} ms)` : `ошибка`) : 'не проверялась'}
                    </Text>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Config + test form */}
        <div className={styles.section}>
          <span className={styles.sectionTitle}>Настройка провайдера</span>
          <div className={styles.configRow}>
            <Field label="Провайдер">
              <Select
                size="small"
                value={selectedProvider}
                onChange={(_, d) => { setSelectedProvider(d.value); setToken(''); setSelectedModel(''); }}
                id="model-provider-select"
                data-testid="model-provider-select"
              >
                {providers.map((p) => (
                  <option key={p.provider} value={p.provider}>{p.provider}</option>
                ))}
              </Select>
            </Field>
            <Field label="Модель">
              <Select
                size="small"
                value={selectedModel}
                onChange={(_, d) => setSelectedModel(d.value)}
                id="model-provider-model-select"
                data-testid="model-provider-model-select"
              >
                {providerModels.length === 0 && <option value="">Модели не найдены</option>}
                {providerModels.map((m) => {
                  const ctx = Number(m.contextWindow);
                  const ctxLabel = Number.isFinite(ctx) && ctx > 0 ? ` | ${ctx.toLocaleString('ru-RU')} ctx` : '';
                  return <option key={m.key} value={m.key}>{m.key}{ctxLabel}</option>;
                })}
              </Select>
            </Field>
            <Field label="API key / token">
              <Input
                size="small"
                type="password"
                value={token}
                onChange={(_, d) => setToken(d.value)}
                placeholder="API key / token"
                id="model-provider-token"
                data-testid="model-provider-token"
              />
            </Field>
            <Field label="Profile ID (опц.)">
              <Input
                size="small"
                value={profileId}
                onChange={(_, d) => setProfileId(d.value)}
                placeholder="profile id"
                id="model-provider-profile-id"
                data-testid="model-provider-profile-id"
              />
            </Field>
          </div>
          <div className={styles.row}>
            <Button
              size="small"
              appearance="primary"
              icon={saving ? <Spinner size="tiny" /> : <Checkmark20Regular />}
              disabled={!selectedProvider || saving}
              onClick={() => void saveToken()}
              id="btn-model-provider-save-token"
              data-testid="btn-model-provider-save-token"
            >
              Сохранить ключ
            </Button>
          </div>

          <Divider />

          <Field label="Тестовый запрос">
            <Input
              size="small"
              value={testQuery}
              onChange={(_, d) => setTestQuery(d.value)}
              id="model-provider-test-query"
              data-testid="model-provider-test-query"
            />
          </Field>
          <Button
            size="small"
            appearance="subtle"
            icon={testing ? <Spinner size="tiny" /> : <Send20Regular />}
            disabled={!selectedProvider || !testQuery.trim() || testing}
            onClick={() => void testProvider()}
            id="btn-model-provider-test"
            data-testid="btn-model-provider-test"
          >
            Тестировать
          </Button>
          {testOutput && (
            <div className={styles.testOutput} id="model-provider-test-output" data-testid="model-provider-test-output">
              <Text size={200}>{testOutput}</Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
