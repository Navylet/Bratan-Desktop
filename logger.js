const fs = require('fs');
const path = require('path');

let logFilePath = null;

function init(appDataPath) {
  try {
    if (!path || !fs || typeof fs.existsSync !== 'function') {
      console.info('Logger: FS not available, skipping file logging');
      return;
    }
    const logsDir = path.join(appDataPath || process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logFilePath = path.join(logsDir, 'openclaw.log');
    if (!fs.existsSync(logFilePath)) {
      fs.writeFileSync(logFilePath, '', 'utf8');
    }
    info('Logger initialized');
  } catch (err) {
    console.error('Logger initialization failed', err);
  }
}

function format(level, message) {
  const timestamp = new Date().toISOString();
  const msg = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
  return `[${timestamp}] [${level}] ${msg}`;
}

function write(level, message) {
  const line = format(level, message);
  console[level](line);
  if (logFilePath && fs && typeof fs.appendFileSync === 'function') {
    try {
      fs.appendFileSync(logFilePath, line + '\n', 'utf8');
    } catch (err) {
      console.error('Failed to write log file', err);
    }
  }
}

function info(message) {
  write('info', message);
}

function warn(message) {
  write('warn', message);
}

function error(message) {
  write('error', message);
}

function debug(message) {
  write('log', message);
}

function getLogFilePath() {
  return logFilePath;
}

module.exports = {
  init,
  info,
  warn,
  error,
  debug,
  getLogFilePath,
};
