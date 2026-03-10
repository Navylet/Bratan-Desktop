jest.mock('fs', () => ({
  readFileSync: jest.fn(() => JSON.stringify({ token: 'test-token' })),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true),
  unlinkSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const { EventEmitter } = require('events');
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();
    proc.pid = 12345;
    return proc;
  }),
}));

jest.mock('electron', () => {
  class BrowserWindow {
    constructor() {
      this.isVisible = jest.fn(() => true);
      this.webContents = { send: jest.fn() };
    }
    hide = jest.fn();
    show = jest.fn();
    focus = jest.fn();
    setSkipTaskbar = jest.fn();
    on = jest.fn();
    once = jest.fn((event, cb) => cb());
    loadFile = jest.fn();
  }

  class Tray {
    constructor() {
      this.setToolTip = jest.fn();
      this.setContextMenu = jest.fn();
      this.on = jest.fn();
      this.destroy = jest.fn();
    }
  }

  return {
    app: {
      whenReady: jest.fn().mockResolvedValue(),
      on: jest.fn(),
    },
    BrowserWindow,
    Notification: class {
      constructor() {
        this.show = jest.fn();
      }
    },
    shell: { openPath: jest.fn(), openExternal: jest.fn() },
    Menu: { buildFromTemplate: jest.fn(() => ({})), setApplicationMenu: jest.fn() },
    dialog: {},
    Tray,
    globalShortcut: { register: jest.fn(), unregisterAll: jest.fn() },
    ipcMain: { handle: jest.fn() },
  };
});

jest.mock('../../../integrations/google', () => ({
  GoogleIntegration: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn(),
    handleAuthCode: jest.fn(),
  })),
}));

jest.mock('../../../integrations/github', () => ({
  GitHubIntegration: jest.fn().mockImplementation(() => ({
    initialize: jest.fn(),
  })),
}));

let startOpenClawGateway;
let stopOpenClawGateway;

beforeEach(() => {
  jest.resetModules();
  const mainModule = require('../../../index');
  startOpenClawGateway = mainModule.startOpenClawGateway;
  stopOpenClawGateway = mainModule.stopOpenClawGateway;
});

describe('Main process controls', () => {
  test('startOpenClawGateway should execute without throwing', () => {
    expect(() => startOpenClawGateway()).not.toThrow();
  });

  test('stopOpenClawGateway should execute without throwing', () => {
    expect(() => {
      startOpenClawGateway();
      stopOpenClawGateway();
    }).not.toThrow();
  });
});
