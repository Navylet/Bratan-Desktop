/**
 * SettingsPanel — Phase 3 Fluent settings tab.
 * Gateway control, OpenClaw version/update, model selection, UI prefs.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Field,
  Input,
  Select,
  Spinner,
  Switch,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ArrowClockwise20Regular,
  ArrowDownload20Regular,
  Checkmark20Regular,
  DismissCircle20Regular,
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
    paddingRight: tokens.spacingHorizontalXS,
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
    color: tokens.colorNeutralForeground1,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: tokens.spacingHorizontalM,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
});

const CHANNEL_OPTIONS = ['stable', 'beta', 'dev'];

function lsGet(key, fallback = '') {
  try { return window.localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { window.localStorage.setItem(key, String(value)); } catch {/* */}
}

export default function SettingsPanel({ onThemeChange, resolvedTheme }) {
  const styles = useStyles();
  const api = getDesktopApi();

  // ── Gateway controls ─────────────────────────────────────────────────────
  const [gatewayRunning, setGatewayRunning] = useState(false);
  const [gatewayBusy, setGatewayBusy] = useState(false);

  // ── OpenClaw version ─────────────────────────────────────────────────────
  const [versionInfo, setVersionInfo] = useState({
    installedVersion: null,
    latestVersion: null,
    updateAvailable: false,
    channel: lsGet('openclaw_update_channel', 'stable'),
  });
  const [versionLoading, setVersionLoading] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);

  // ── Model selection ──────────────────────────────────────────────────────
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [modelLoading, setModelLoading] = useState(false);
  const [modelApplying, setModelApplying] = useState(false);

  // ── UI preferences ───────────────────────────────────────────────────────
  const [gatewayPort, setGatewayPort] = useState(() => Number(lsGet('openclaw_gateway_port', '18789')) || 18789);
  const [cliPath, setCliPath] = useState(() => lsGet('openclaw_cli_path', ''));
  const [notifications, setNotifications] = useState(() => lsGet('openclaw_notifications', 'true') !== 'false');
  const [autostart, setAutostart] = useState(() => lsGet('openclaw_autostart', 'false') === 'true');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const syncGatewayStatus = useCallback(async () => {
    const s = await api?.openclaw?.status?.().catch(() => null);
    setGatewayRunning(Boolean(s?.running));
  }, [api]);

  // Load gateway status
  useEffect(() => {
    async function syncStatus() {
      await syncGatewayStatus();
    }
    void syncStatus();
    const timer = window.setInterval(() => void syncStatus(), 6000);
    return () => window.clearInterval(timer);
  }, [syncGatewayStatus]);

  // Load version info
  const refreshVersionInfo = useCallback(async () => {
    if (versionLoading) return;
    setVersionLoading(true);
    try {
      const info = await api?.openclaw?.versionInfo?.() ?? {};
      setVersionInfo((prev) => ({
        ...prev,
        installedVersion: info.installedVersion || null,
        latestVersion: info.latestVersion || null,
        updateAvailable: Boolean(info.updateAvailable),
        channel: info.channel || prev.channel,
      }));
    } catch {/* keep prev */}
    finally { setVersionLoading(false); }
  }, [api, versionLoading]);

  useEffect(() => { void refreshVersionInfo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load models
  const refreshModels = useCallback(async () => {
    if (modelLoading) return;
    setModelLoading(true);
    try {
      const payload = await api?.openclaw?.listModels?.() ?? {};
      const ms = Array.isArray(payload?.models) ? payload.models : [];
      setModels(ms);
      const resolved = String(payload?.resolvedModel || payload?.currentModel || '').trim();
      setCurrentModel(resolved);
      setSelectedModel(resolved || (ms[0]?.key ?? ''));
    } catch {/* keep prev */}
    finally { setModelLoading(false); }
  }, [api, modelLoading]);

  useEffect(() => { void refreshModels(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Gateway actions
  const startGateway = useCallback(async () => {
    setGatewayBusy(true);
    try {
      await api?.openclaw?.start?.();
    } catch {
      // no-op
    } finally {
      await syncGatewayStatus();
      setGatewayBusy(false);
    }
  }, [api, syncGatewayStatus]);

  const stopGateway = useCallback(async () => {
    setGatewayBusy(true);
    try {
      await api?.openclaw?.stop?.();
    } catch {
      // no-op
    } finally {
      await syncGatewayStatus();
      setGatewayBusy(false);
    }
  }, [api, syncGatewayStatus]);

  // Version update
  const doUpdate = useCallback(async () => {
    if (!versionInfo.updateAvailable) {
      void refreshVersionInfo();
      return;
    }
    if (!window.confirm(`Обновить OpenClaw?\n${versionInfo.installedVersion} → ${versionInfo.latestVersion}`)) return;
    setUpdateInProgress(true);
    try {
      await api?.openclaw?.update?.({ restart: true, channel: versionInfo.channel });
      void refreshVersionInfo();
    } catch {/* */}
    finally { setUpdateInProgress(false); }
  }, [api, versionInfo, refreshVersionInfo]);

  // Apply model
  const applyModel = useCallback(async () => {
    if (!selectedModel || modelApplying) return;
    setModelApplying(true);
    try {
      await api?.openclaw?.setModel?.({ model: selectedModel });
      setCurrentModel(selectedModel);
    } catch {/* */}
    finally { setModelApplying(false); }
  }, [api, selectedModel, modelApplying]);

  // Save prefs
  const savePrefs = useCallback(async () => {
    if (settingsSaving) return;
    setSettingsSaving(true);
    lsSet('openclaw_gateway_port', gatewayPort);
    lsSet('openclaw_cli_path', cliPath);
    lsSet('openclaw_notifications', notifications ? 'true' : 'false');
    lsSet('openclaw_autostart', autostart ? 'true' : 'false');
    lsSet('openclaw_update_channel', versionInfo.channel);

    try {
      await api?.openclaw?.configure?.({
        cliPath: cliPath.trim(),
        gatewayPort,
      });
    } catch {
      // local settings are still persisted even if runtime configure fails
    } finally {
      setSettingsSaving(false);
    }
  }, [api, autostart, cliPath, gatewayPort, notifications, settingsSaving, versionInfo.channel]);

  const resetPrefs = useCallback(async () => {
    const nextGatewayPort = 18789;
    const nextCliPath = '';

    setGatewayPort(nextGatewayPort);
    setCliPath(nextCliPath);
    setNotifications(true);
    setAutostart(false);
    lsSet('openclaw_gateway_port', '18789');
    lsSet('openclaw_cli_path', '');
    lsSet('openclaw_notifications', 'true');
    lsSet('openclaw_autostart', 'false');

    try {
      await api?.openclaw?.configure?.({
        cliPath: nextCliPath,
        gatewayPort: nextGatewayPort,
      });
    } catch {
      // no-op
    }
  }, [api]);

  return (
    <div className={styles.root} data-testid="settings-panel">

      {/* Gateway */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Gateway</span>
        <div className={styles.row}>
          <Badge
            appearance={gatewayRunning ? 'filled' : 'tint'}
            color={gatewayRunning ? 'success' : 'danger'}
            id="gateway-status-badge"
          >
            {gatewayRunning ? 'Online' : 'Offline'}
          </Badge>
          <Button
            size="small"
            appearance="primary"
            disabled={gatewayBusy || gatewayRunning}
            onClick={() => void startGateway()}
            id="btn-start-gateway"
            data-testid="btn-start-gateway"
          >
            {gatewayBusy ? <Spinner size="tiny" /> : 'Запустить'}
          </Button>
          <Button
            size="small"
            appearance="secondary"
            disabled={gatewayBusy || !gatewayRunning}
            onClick={() => void stopGateway()}
            id="btn-stop-gateway"
            data-testid="btn-stop-gateway"
          >
            Остановить
          </Button>
        </div>
      </div>

      {/* OpenClaw version */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>OpenClaw версия</span>
        <div className={styles.statusRow}>
          <Text size={200} id="openclaw-version-installed" data-testid="openclaw-version-installed">
            installed: {versionInfo.installedVersion || '—'}
          </Text>
          <Text size={200} id="openclaw-version-latest" data-testid="openclaw-version-latest">
            latest: {versionInfo.latestVersion || '—'}
          </Text>
          <Badge id="openclaw-update-state" appearance="tint" color={versionInfo.updateAvailable ? 'warning' : 'subtle'}>
            {versionLoading ? 'Проверяю...' : versionInfo.updateAvailable ? 'Есть обновление' : 'Версия актуальна'}
          </Badge>
        </div>
        <div className={styles.row}>
          <Field label="Канал" style={{ width: '140px' }}>
            <Select
              size="small"
              value={versionInfo.channel}
              onChange={(_, d) =>
                setVersionInfo((prev) => ({ ...prev, channel: d.value }))
              }
              id="openclaw-update-channel"
              data-testid="openclaw-update-channel"
            >
              {CHANNEL_OPTIONS.map((ch) => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </Select>
          </Field>
          <Button
            size="small"
            appearance={versionInfo.updateAvailable ? 'primary' : 'subtle'}
            icon={updateInProgress ? <Spinner size="tiny" /> : <ArrowDownload20Regular />}
            disabled={versionLoading || updateInProgress}
            onClick={() => void doUpdate()}
            id="btn-openclaw-update"
            data-testid="btn-openclaw-update"
          >
            {updateInProgress ? 'Обновляется...' : versionInfo.updateAvailable ? 'Обновить' : 'Проверить'}
          </Button>
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowClockwise20Regular />}
            disabled={versionLoading}
            onClick={() => void refreshVersionInfo()}
          />
        </div>
      </div>

      {/* Model selection */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Модель</span>
        <Text size={200} id="openclaw-model-state" data-testid="openclaw-model-state">
          {modelLoading ? 'Модели: загрузка...' : currentModel ? `Активная модель: ${currentModel}` : 'Модель не определена'}
        </Text>
        <div className={styles.row}>
          <Field label="Выбрать модель" style={{ flex: 1, minWidth: '200px' }}>
            <Select
              size="small"
              value={selectedModel}
              onChange={(_, d) => setSelectedModel(d.value)}
              disabled={modelLoading || modelApplying || !models.length}
              id="openclaw-model-select"
              data-testid="openclaw-model-select"
            >
              {!models.length && <option value="">Модели не найдены</option>}
              {models.map((m) => {
                const ctx = Number(m.contextWindow);
                const ctxLabel = Number.isFinite(ctx) && ctx > 0 ? ` | ${ctx.toLocaleString('ru-RU')} ctx` : '';
                const unavailable = m.available === false || m.missing === true;
                return (
                  <option key={m.key} value={m.key} disabled={unavailable}>
                    {m.key}{ctxLabel}{unavailable ? ' [unavail]' : ''}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Button
            size="small"
            appearance="primary"
            icon={modelApplying ? <Spinner size="tiny" /> : <Checkmark20Regular />}
            disabled={!selectedModel || modelLoading || modelApplying}
            onClick={() => void applyModel()}
            id="btn-openclaw-model-apply"
            data-testid="btn-openclaw-model-apply"
          >
            {modelApplying ? 'Применяю...' : 'Применить модель'}
          </Button>
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowClockwise20Regular />}
            disabled={modelLoading}
            onClick={() => void refreshModels()}
          />
        </div>
      </div>

      {/* UI Preferences */}
      <div className={styles.section}>
        <span className={styles.sectionTitle}>Параметры интерфейса</span>
        <div className={styles.fieldGroup}>
          <Field label="Gateway port">
            <Input
              size="small"
              type="number"
              value={String(gatewayPort)}
              onChange={(_, d) => setGatewayPort(Number(d.value) || 18789)}
              id="setting-gateway-port"
              data-testid="setting-gateway-port"
            />
          </Field>
          <Field label="CLI path">
            <Input
              size="small"
              value={cliPath}
              onChange={(_, d) => setCliPath(d.value)}
              placeholder="openclaw"
              id="setting-cli-path"
              data-testid="setting-cli-path"
            />
          </Field>
        </div>
        <div className={styles.row}>
          <Switch
            checked={notifications}
            onChange={(_, d) => setNotifications(d.checked)}
            label="Уведомления"
            id="setting-notifications"
          />
          <Switch
            checked={autostart}
            onChange={(_, d) => setAutostart(d.checked)}
            label="Автозапуск"
            id="setting-autostart"
          />
        </div>
        <div className={styles.actions}>
          <Button
            appearance="primary"
            size="small"
            icon={<Checkmark20Regular />}
            disabled={settingsSaving}
            onClick={() => void savePrefs()}
            id="btn-save-settings"
            data-testid="btn-save-settings"
          >
            {settingsSaving ? 'Сохраняю...' : 'Сохранить'}
          </Button>
          <Button
            appearance="subtle"
            size="small"
            icon={<DismissCircle20Regular />}
            disabled={settingsSaving}
            onClick={() => void resetPrefs()}
            id="btn-reset-settings"
            data-testid="btn-reset-settings"
          >
            Сбросить
          </Button>
        </div>
      </div>
    </div>
  );
}
