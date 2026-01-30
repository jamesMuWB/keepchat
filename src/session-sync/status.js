const fs = require('fs');
const os = require('os');
const path = require('path');

const STATUS_FILE_NAME = 'sync-status.json';

function getStatusPath() {
  return process.env.KEEPCHAT_SYNC_STATUS || path.join(os.homedir(), '.keepchat', STATUS_FILE_NAME);
}

function ensureStatusDir() {
  const dirPath = path.dirname(getStatusPath());
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadSyncStatus() {
  const filePath = getStatusPath();
  if (!fs.existsSync(filePath)) {
    return { sessions: {} };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid sync status JSON: ${message}`);
  }
}

function saveSyncStatus(status) {
  ensureStatusDir();
  fs.writeFileSync(getStatusPath(), JSON.stringify(status, null, 2), 'utf8');
}

function getSessionStatus(sessionId) {
  const status = loadSyncStatus();
  return status.sessions[sessionId] || null;
}

function updateSessionStatus(sessionId, patch) {
  const status = loadSyncStatus();
  status.sessions[sessionId] = {
    ...(status.sessions[sessionId] || {}),
    ...patch,
  };
  saveSyncStatus(status);
  return status.sessions[sessionId];
}

module.exports = {
  getStatusPath,
  loadSyncStatus,
  saveSyncStatus,
  getSessionStatus,
  updateSessionStatus,
};
