// Интеграция с Google API (Drive, Docs, Calendar, Gmail)
let google = null;
const fs = require('fs').promises;
const path = require('path');

async function getGoogle() {
  if (google) return google;
  const googleModule = await import('googleapis');
  google = googleModule.google || googleModule.default?.google || googleModule.default || googleModule;
  if (!google) throw new Error('Не удалось загрузить googleapis');
  return google;
}

class GoogleIntegration {
  constructor() {
    this.oauth2Client = null;
    this.google = null;
    this.drive = null;
    this.docs = null;
    this.calendar = null;
    this.gmail = null;
    this.tokensPath = path.join(__dirname, '..', 'tokens', 'google.json');
    this.credentialsPath = path.join(__dirname, '..', 'credentials', 'google-credentials.json');
    this.scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
    ];
  }

  // Инициализация клиента OAuth
  async initialize(clientId, clientSecret, redirectUri) {
    const g = await getGoogle();
    this.google = g;
    this.oauth2Client = new g.auth.OAuth2(clientId, clientSecret, redirectUri);

    // Пробуем загрузить сохранённые токены
    try {
      const tokens = JSON.parse(await fs.readFile(this.tokensPath, 'utf8'));
      this.oauth2Client.setCredentials(tokens);
      await this.createServices();
      return { initialized: true, needAuth: false };
    } catch (err) {
      return { initialized: false, needAuth: true, authUrl: this.generateAuthUrl() };
    }
  }

  // Генерация URL для авторизации
  generateAuthUrl() {
    if (!this.oauth2Client) throw new Error('OAuth client not initialized');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      prompt: 'consent',
    });
  }

  // Обработка кода авторизации
  async handleAuthCode(code) {
    if (!this.oauth2Client) throw new Error('OAuth client not initialized');

    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);

    // Сохраняем токены
    await fs.mkdir(path.dirname(this.tokensPath), { recursive: true });
    await fs.writeFile(this.tokensPath, JSON.stringify(tokens, null, 2));

    await this.createServices();
    return { success: true };
  }

  // Создание сервисов Google
  async createServices() {
    const g = this.google || (await getGoogle());
    this.drive = g.drive({ version: 'v3', auth: this.oauth2Client });
    this.docs = g.docs({ version: 'v1', auth: this.oauth2Client });
    this.calendar = g.calendar({ version: 'v3', auth: this.oauth2Client });
    this.gmail = g.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  // Получить список файлов с Google Drive
  async listDriveFiles(query = '', pageSize = 50) {
    if (!this.drive) throw new Error('Drive service not initialized');

    const response = await this.drive.files.list({
      q: query || '',
      pageSize,
      fields: 'files(id, name, mimeType, size, modifiedTime, webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    return response.data.files || [];
  }

  // Прочитать Google Doc
  async readDocument(documentId) {
    if (!this.docs) throw new Error('Docs service not initialized');

    const response = await this.docs.documents.get({ documentId });
    const document = response.data;

    // Извлечение текста
    let text = '';
    if (document.body && document.body.content) {
      document.body.content.forEach((element) => {
        if (element.paragraph) {
          element.paragraph.elements.forEach((elem) => {
            if (elem.textRun) {
              text += elem.textRun.content;
            }
          });
          text += '\n';
        }
      });
    }

    return {
      id: documentId,
      title: document.title,
      text: text.trim(),
      raw: document,
    };
  }

  // Получить события календаря
  async getCalendarEvents(maxResults = 50, timeMin = new Date().toISOString()) {
    if (!this.calendar) throw new Error('Calendar service not initialized');

    const response = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  }

  // Получить непрочитанные письма
  async getUnreadEmails(maxResults = 20) {
    if (!this.gmail) throw new Error('Gmail service not initialized');

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults,
    });

    const messages = response.data.messages || [];
    const details = await Promise.all(
      messages
        .slice(0, 10)
        .map((msg) => this.gmail.users.messages.get({ userId: 'me', id: msg.id }))
    );

    return details.map((detail) => ({
      id: detail.data.id,
      subject: detail.data.payload.headers.find((h) => h.name === 'Subject')?.value || 'Без темы',
      from: detail.data.payload.headers.find((h) => h.name === 'From')?.value,
      snippet: detail.data.snippet,
      date: detail.data.payload.headers.find((h) => h.name === 'Date')?.value,
    }));
  }

  // Проверить статус авторизации
  isAuthenticated() {
    return this.oauth2Client && this.oauth2Client.credentials;
  }
}

module.exports = { GoogleIntegration };
