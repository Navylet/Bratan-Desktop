const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  openclaw: {
    start: () => ipcRenderer.invoke('openclaw-start'),
    stop: () => ipcRenderer.invoke('openclaw-stop'),
    status: (options) => ipcRenderer.invoke('openclaw-status', options),
    configure: (config) => ipcRenderer.invoke('openclaw-configure', config),
    versionInfo: () => ipcRenderer.invoke('openclaw-version-info'),
    update: (options) => ipcRenderer.invoke('openclaw-update', options),
    sendMessage: (message) => ipcRenderer.invoke('openclaw-send-message', message),
    getMessages: () => ipcRenderer.invoke('openclaw-get-messages'),
    pickFiles: (options) => ipcRenderer.invoke('openclaw-pick-files', options),
    listSessions: () => ipcRenderer.invoke('openclaw-list-sessions'),
    listAgents: () => ipcRenderer.invoke('openclaw-list-agents'),
  },
  rag: {
    pickFiles: (options) => ipcRenderer.invoke('rag-pick-files', options),
    indexFiles: (payload) => ipcRenderer.invoke('rag-index-files', payload),
    status: () => ipcRenderer.invoke('rag-status'),
    search: (payload) => ipcRenderer.invoke('rag-search', payload),
    ask: (payload) => ipcRenderer.invoke('rag-ask', payload),
    clear: () => ipcRenderer.invoke('rag-clear'),
    exportIndex: (payload) => ipcRenderer.invoke('rag-export', payload),
    importIndex: (payload) => ipcRenderer.invoke('rag-import', payload),
  },
  fs: {
    listDir: (path) => ipcRenderer.invoke('fs-list-dir', path),
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
    openFile: (path) => ipcRenderer.invoke('open-file-default', path),
    readFile: (path) => ipcRenderer.invoke('fs-read-file', path),
    writeFile: (path, content) => ipcRenderer.invoke('fs-write-file', path, content),
  },
  tasks: {
    analyzePDF: (pdfPath, options) => ipcRenderer.invoke('analyze-pdf', pdfPath, options),
    webSearch: (query, options) => ipcRenderer.invoke('web-search', query, options),
    aiAnalysis: (text, instruction, options) =>
      ipcRenderer.invoke('ai-analysis', text, instruction, options),
    getStatus: () => ipcRenderer.invoke('task-status'),
  },
  google: {
    authUrl: () => ipcRenderer.invoke('google-auth-url'),
    authCode: (code) => ipcRenderer.invoke('google-auth-code', code),
    listFiles: (query, pageSize) => ipcRenderer.invoke('google-list-files', query, pageSize),
    readDoc: (docId) => ipcRenderer.invoke('google-read-doc', docId),
    calendarEvents: (maxResults, timeMin) =>
      ipcRenderer.invoke('google-calendar-events', maxResults, timeMin),
    unreadEmails: (maxResults) => ipcRenderer.invoke('google-unread-emails', maxResults),
  },
  github: {
    init: (token) => ipcRenderer.invoke('github-init', token),
    userRepos: (sort, direction) => ipcRenderer.invoke('github-user-repos', sort, direction),
    searchRepos: (query, options) => ipcRenderer.invoke('github-search-repos', query, options),
    fileContent: (owner, repo, filePath, ref) =>
      ipcRenderer.invoke('github-file-content', owner, repo, filePath, ref),
    createIssue: (owner, repo, title, body, labels) =>
      ipcRenderer.invoke('github-create-issue', owner, repo, title, body, labels),
    recentCommits: (owner, repo, branch, perPage) =>
      ipcRenderer.invoke('github-recent-commits', owner, repo, branch, perPage),
  },
  onOpenClawLog: (callback) => {
    ipcRenderer.on('openclaw-log', (event, data) => callback(data));
  },
  onOpenClawStream: (callback) => {
    ipcRenderer.on('openclaw-stream', (event, data) => callback(data));
  },
  removeOpenClawLogListener: () => {
    ipcRenderer.removeAllListeners('openclaw-log');
  },
  removeOpenClawStreamListener: () => {
    ipcRenderer.removeAllListeners('openclaw-stream');
  },
  log: (level, message) => {
    ipcRenderer.send('renderer-log', { level, message });
  },
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  showNotification: ({ title, body }) => {
    ipcRenderer.invoke('show-notification', { title, body });
  },
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
});
