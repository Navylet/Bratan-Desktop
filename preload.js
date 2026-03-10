const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  openclaw: {
    start: () => ipcRenderer.invoke('openclaw-start'),
    stop: () => ipcRenderer.invoke('openclaw-stop'),
    status: () => ipcRenderer.invoke('openclaw-status'),
    sendMessage: (message) => ipcRenderer.invoke('openclaw-send-message', message),
    getMessages: () => ipcRenderer.invoke('openclaw-get-messages'),
  },
  fs: {
    openFolder: (path) => ipcRenderer.invoke('open-folder', path),
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
  removeOpenClawLogListener: () => {
    ipcRenderer.removeAllListeners('openclaw-log');
  },
  showNotification: ({ title, body }) => {
    ipcRenderer.invoke('show-notification', { title, body });
  },
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
});
