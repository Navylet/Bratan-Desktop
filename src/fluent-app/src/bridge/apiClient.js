export function getDesktopApi() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.api || null;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function apiSendMessage(payload) {
  const api = getDesktopApi();
  if (!api?.openclaw?.sendMessage) {
    throw new Error('window.api.openclaw.sendMessage not available');
  }
  return api.openclaw.sendMessage(payload);
}

export async function apiPickFiles(options = {}) {
  const api = getDesktopApi();
  if (!api?.openclaw?.pickFiles) {
    throw new Error('window.api.openclaw.pickFiles not available');
  }
  return api.openclaw.pickFiles(options);
}

export async function apiListModels() {
  const api = getDesktopApi();
  if (!api?.openclaw?.listModels) return { models: [] };
  try {
    return await api.openclaw.listModels();
  } catch {
    return { models: [] };
  }
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────

function lsGet(key) {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function lsRemove(key) {
  try {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const THREADS_KEY = 'fluent_chat_threads_v1';
const ACTIVE_THREAD_KEY = 'fluent_chat_active_thread_v1';

function resolveScopedStorageKey(baseKey, workspaceScopeKey) {
  const scope = String(workspaceScopeKey || '').trim();
  if (!scope || scope === 'default') {
    return baseKey;
  }
  return `${baseKey}_${scope}`;
}

export function loadThreadsFromStorage(workspaceScopeKey = 'default') {
  try {
    const raw = lsGet(resolveScopedStorageKey(THREADS_KEY, workspaceScopeKey));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveThreadsToStorage(threads, activeThreadId, workspaceScopeKey = 'default') {
  lsSet(resolveScopedStorageKey(THREADS_KEY, workspaceScopeKey), JSON.stringify(threads));
  if (activeThreadId) {
    lsSet(resolveScopedStorageKey(ACTIVE_THREAD_KEY, workspaceScopeKey), activeThreadId);
  }
}

export function loadActiveThreadIdFromStorage(workspaceScopeKey = 'default') {
  return lsGet(resolveScopedStorageKey(ACTIVE_THREAD_KEY, workspaceScopeKey)) || null;
}

export function clearThreadsStorage(workspaceScopeKey = 'default') {
  lsRemove(resolveScopedStorageKey(THREADS_KEY, workspaceScopeKey));
  lsRemove(resolveScopedStorageKey(ACTIVE_THREAD_KEY, workspaceScopeKey));
}

export async function fetchGatewayRunning() {
  const api = getDesktopApi();

  if (!api || !api.openclaw || typeof api.openclaw.status !== 'function') {
    return false;
  }

  try {
    const payload = await api.openclaw.status();
    return Boolean(payload && payload.running);
  } catch {
    return false;
  }
}

export function getSavedThemeSetting(defaultValue = 'light') {
  if (typeof window === 'undefined') {
    return defaultValue;
  }

  try {
    const value = window.localStorage.getItem('setting-theme');
    if (value === 'light' || value === 'dark' || value === 'auto') {
      return value;
    }
  } catch {
    // Ignore localStorage access failures.
  }

  return defaultValue;
}

export function saveThemeSetting(value) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem('setting-theme', value);
  } catch {
    // Ignore localStorage access failures.
  }
}
