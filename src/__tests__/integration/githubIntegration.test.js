const githubIntegration = require('../../renderer/src/lib/integration/githubIntegration');

describe('GitHub Integration Stub', () => {
  beforeEach(() => {
    githubIntegration.connected = false;
    githubIntegration.token = null;
  });

  test('should have correct name', () => {
    expect(githubIntegration.name).toBe('GitHub');
  });

  describe('connect', () => {
    test('should set connected and token', async () => {
      const result = await githubIntegration.connect('fake-token');
      expect(result.success).toBe(true);
      expect(githubIntegration.connected).toBe(true);
      expect(githubIntegration.token).toBe('fake-token');
    });

    test('should work with empty token', async () => {
      const result = await githubIntegration.connect();
      expect(result.success).toBe(true);
      expect(githubIntegration.token).toBe('stub-token');
    });
  });

  describe('disconnect', () => {
    test('should reset state', async () => {
      githubIntegration.connected = true;
      githubIntegration.token = 'some-token';
      const result = await githubIntegration.disconnect();
      expect(result.success).toBe(true);
      expect(githubIntegration.connected).toBe(false);
      expect(githubIntegration.token).toBeNull();
    });
  });

  describe('getStatus', () => {
    test('should return status with user when connected', async () => {
      githubIntegration.connected = true;
      githubIntegration.token = 'token';
      const status = await githubIntegration.getStatus();
      expect(status.connected).toBe(true);
      expect(status.user).toBe('stub-user');
      expect(status.scopes).toEqual(['repo', 'user']);
    });

    test('should return status without user when disconnected', async () => {
      const status = await githubIntegration.getStatus();
      expect(status.connected).toBe(false);
      expect(status.user).toBeNull();
    });
  });

  describe('listRepos', () => {
    test('should return array of repos', async () => {
      const repos = await githubIntegration.listRepos();
      expect(Array.isArray(repos)).toBe(true);
      expect(repos.length).toBeGreaterThan(0);
      expect(repos[0]).toHaveProperty('id');
      expect(repos[0]).toHaveProperty('name');
      expect(repos[0]).toHaveProperty('full_name');
    });
  });

  describe('createRepo', () => {
    test('should return repo object', async () => {
      const repo = await githubIntegration.createRepo('new-repo', true);
      expect(repo).toHaveProperty('id');
      expect(repo).toHaveProperty('name', 'new-repo');
      expect(repo).toHaveProperty('private', true);
      expect(repo).toHaveProperty('html_url');
    });
  });

  describe('getBranches', () => {
    test('should return branches for given repo', async () => {
      const branches = await githubIntegration.getBranches('some-repo');
      expect(Array.isArray(branches)).toBe(true);
      expect(branches[0]).toHaveProperty('name');
      expect(branches[0]).toHaveProperty('commit.sha');
    });
  });
});
