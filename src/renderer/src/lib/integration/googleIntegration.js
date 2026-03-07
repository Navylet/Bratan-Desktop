// Google Integration Stub
class GoogleIntegration {
  constructor() {
    this.name = 'Google';
    this.connected = false;
  }

  async connect() {
    console.log('[Google] Simulating connection...');
    this.connected = true;
    return { success: true, message: 'Connected (stub)' };
  }

  async disconnect() {
    this.connected = false;
    return { success: true, message: 'Disconnected (stub)' };
  }

  async getStatus() {
    return {
      connected: this.connected,
      name: this.name,
      services: ['Drive', 'Docs', 'Calendar', 'Gmail']
    };
  }

  // Stub methods for services
  async listFiles() {
    return [
      { id: '1', name: 'document1.txt', type: 'text', size: '1KB' },
      { id: '2', name: 'spreadsheet.xlsx', type: 'spreadsheet', size: '2KB' }
    ];
  }

  async createDocument(title) {
    return { id: 'new-doc', title, url: 'https://docs.google.com/document/d/stub' };
  }
}

module.exports = new GoogleIntegration();