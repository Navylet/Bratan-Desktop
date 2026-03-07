// GitHub Integration Stub
class GitHubIntegration {
  constructor() {
    this.name = 'GitHub';
    this.connected = false;
    this.token = null;
  }

  async connect(token) {
    console.log('[GitHub] Simulating connection with token...');
    this.token = token || 'stub-token';
    this.connected = true;
    return { success: true, message: 'Connected (stub)' };
  }

  async disconnect() {
    this.connected = false;
    this.token = null;
    return { success: true, message: 'Disconnected (stub)' };
  }

  async getStatus() {
    return {
      connected: this.connected,
      name: this.name,
      user: this.token ? 'stub-user' : null,
      scopes: ['repo', 'user']
    };
  }

  // Stub methods
  async listRepos() {
    return [
      { id: 1, name: 'openclaw-desktop', full_name: 'user/openclaw-desktop', private: false },
      { id: 2, name: 'agentic-rpa', full_name: 'user/agentic-rpa', private: true }
    ];
  }

  async createRepo(name, privateRepo = false) {
    return { id: Date.now(), name, private: privateRepo, html_url: 'https://github.com/user/' + name };
  }

  async getBranches(repo) {
    return [
      { name: 'main', commit: { sha: 'abc123' } },
      { name: 'develop', commit: { sha: 'def456' } }
    ];
  }
}

module.exports = new GitHubIntegration();