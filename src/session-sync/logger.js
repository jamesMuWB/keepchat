const fs = require('fs');
const os = require('os');
const path = require('path');

const LOG_FILE_NAME = 'sync-errors.log';

function getLogPath() {
  return process.env.KEEPCHAT_SYNC_LOG || path.join(os.homedir(), '.keepchat', LOG_FILE_NAME);
}

function ensureLogDir() {
  const dirPath = path.dirname(getLogPath());
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function logSyncError({ sessionId, phase, error }) {
  ensureLogDir();
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId,
    phase,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };

  fs.appendFileSync(getLogPath(), `${JSON.stringify(entry)}\n`, 'utf8');
  return entry;
}

module.exports = {
  getLogPath,
  logSyncError,
};
