const googleIntegration = require('../../renderer/src/lib/integration/googleIntegration');

describe('Google Integration Stub', () => {
  beforeEach(() => {
    // Reset the singleton instance state if needed
    googleIntegration.connected = false;
  });

  test('should have correct name', () => {
    expect(googleIntegration.name).toBe('Google');
  });

  describe('connect', () => {
    test('should set connected to true', async () => {
      const result = await googleIntegration.connect();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected');
      expect(googleIntegration.connected).toBe(true);
    });
  });

  describe('disconnect', () => {
    test('should set connected to false', async () => {
      googleIntegration.connected = true;
      const result = await googleIntegration.disconnect();
      expect(result.success).toBe(true);
      expect(googleIntegration.connected).toBe(false);
    });
  });

  describe('getStatus', () => {
    test('should return status object', async () => {
      const status = await googleIntegration.getStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('name', 'Google');
      expect(status.services).toEqual(expect.arrayContaining(['Drive', 'Docs']));
    });
  });

  describe('listFiles', () => {
    test('should return array of files', async () => {
      const files = await googleIntegration.listFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
      expect(files[0]).toHaveProperty('id');
      expect(files[0]).toHaveProperty('name');
    });
  });

  describe('createDocument', () => {
    test('should return document stub', async () => {
      const doc = await googleIntegration.createDocument('Test Doc');
      expect(doc).toHaveProperty('id');
      expect(doc).toHaveProperty('title', 'Test Doc');
      expect(doc).toHaveProperty('url');
    });
  });
});