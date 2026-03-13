// Интеграция с GitHub API
let Octokit = null;
const fs = require('fs').promises;
const path = require('path');

async function getOctokit() {
  if (Octokit) return Octokit;
  const module = await import('@octokit/rest');
  Octokit = module.Octokit || module.default?.Octokit || module.default || module;
  if (!Octokit) throw new Error('Не удалось загрузить Octokit');
  return Octokit;
}

class GitHubIntegration {
  constructor(options = {}) {
    this.octokit = null;
    const storageDir = options.storageDir || path.join(__dirname, '..', 'tokens');
    this.tokenPath = path.join(storageDir, 'github.json');
  }

  // Инициализация с токеном
  async initialize(token) {
    const Oct = await getOctokit();
    if (token) {
      this.octokit = new Oct({ auth: token });
      await this.saveToken(token);
      return { initialized: true };
    }

    // Пробуем загрузить сохранённый токен
    try {
      const saved = JSON.parse(await fs.readFile(this.tokenPath, 'utf8'));
      this.octokit = new Oct({ auth: saved.token });
      return { initialized: true };
    } catch (err) {
      return { initialized: false, needAuth: true };
    }
  }

  // Сохранить токен
  async saveToken(token) {
    await fs.mkdir(path.dirname(this.tokenPath), { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify({ token }, null, 2));
  }

  // Получить репозитории пользователя
  async getUserRepos(sort = 'updated', direction = 'desc') {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const response = await this.octokit.repos.listForAuthenticatedUser({
      sort,
      direction,
      per_page: 100,
    });

    return response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updated: repo.updated_at,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      isPrivate: repo.private,
    }));
  }

  // Искать репозитории
  async searchRepos(query, options = {}) {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const { sort = 'stars', order = 'desc', perPage = 50 } = options;
    const response = await this.octokit.search.repos({
      q: query,
      sort,
      order,
      per_page: perPage,
    });

    return response.data.items.map((item) => ({
      id: item.id,
      name: item.name,
      fullName: item.full_name,
      owner: item.owner.login,
      description: item.description,
      language: item.language,
      stars: item.stargazers_count,
      forks: item.forks_count,
      updated: item.updated_at,
      url: item.html_url,
    }));
  }

  // Получить содержимое файла
  async getFileContent(owner, repo, path, ref = 'main') {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    try {
      const response = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (response.data.content) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf8');
        return {
          path,
          content,
          encoding: 'base64',
          size: response.data.size,
          sha: response.data.sha,
          url: response.data.html_url,
        };
      } else {
        // Это директория
        const files = response.data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type,
          size: item.size,
          url: item.html_url,
        }));
        return { path, isDirectory: true, files };
      }
    } catch (err) {
      if (err.status === 404) {
        throw new Error(`Файл не найден: ${owner}/${repo}/${path}`);
      }
      throw err;
    }
  }

  // Создать issue
  async createIssue(owner, repo, title, body, labels = []) {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const response = await this.octokit.issues.create({
      owner,
      repo,
      title,
      body,
      labels,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      state: response.data.state,
      url: response.data.html_url,
      createdAt: response.data.created_at,
    };
  }

  // Получить последние коммиты
  async getRecentCommits(owner, repo, branch = 'main', perPage = 30) {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const response = await this.octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: perPage,
    });

    return response.data.map((commit) => ({
      sha: commit.sha,
      author: commit.commit.author.name,
      email: commit.commit.author.email,
      date: commit.commit.author.date,
      message: commit.commit.message,
      url: commit.html_url,
    }));
  }

  // Создать Pull Request
  async createPullRequest(owner, repo, title, head, base, body = '') {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const response = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      head,
      base,
      body,
    });

    return {
      id: response.data.id,
      number: response.data.number,
      title: response.data.title,
      state: response.data.state,
      url: response.data.html_url,
    };
  }

  // Получить активность пользователя
  async getUserActivity(username, perPage = 50) {
    if (!this.octokit) throw new Error('GitHub не авторизован');

    const response = await this.octokit.activity.listEventsForUser({
      username,
      per_page: perPage,
    });

    return response.data.map((event) => ({
      id: event.id,
      type: event.type,
      repo: event.repo.name,
      actor: event.actor.login,
      createdAt: event.created_at,
      payload: event.payload,
    }));
  }

  // Проверить статус авторизации
  isAuthenticated() {
    return this.octokit !== null;
  }
}

module.exports = { GitHubIntegration };
