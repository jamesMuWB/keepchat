const fs = require('fs');
const path = require('path');
const os = require('os');

function getSessionsDir() {
  return process.env.KEEPCHAT_SESSIONS_DIR || path.join(os.homedir(), '.keepchat', 'sessions');
}

function listSessionFiles(dir = getSessionsDir()) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.join(dir, file));
}

function loadSessionFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid session JSON in ${filePath}: ${message}`);
  }
}

function normalizeMessages(messages, sessionId) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message, index) => {
    if (!message.role) {
      throw new Error(`Message role is required for session ${sessionId}`);
    }
    return {
      id: message.id || `${sessionId}-m${index + 1}`,
      role: message.role,
      content: message.content || '',
      createdAt: message.createdAt || message.created_at || new Date().toISOString(),
    };
  });
}

function normalizeContext(context) {
  if (!context) {
    return { files: [], activeFiles: [] };
  }

  return {
    projectPath: context.projectPath || context.project_path,
    files: Array.isArray(context.files) ? context.files : [],
    activeFiles: Array.isArray(context.activeFiles) ? context.activeFiles : [],
    notes: context.notes,
  };
}

function toSessionPayload(raw, filePath) {
  const sessionId = raw.id || raw.sessionId || path.basename(filePath, '.json');
  const createdAt = raw.createdAt || raw.created_at || new Date().toISOString();
  const updatedAt = raw.updatedAt || raw.updated_at || createdAt;
  const messages = normalizeMessages(raw.messages, sessionId);
  const context = normalizeContext(raw.context);

  return {
    meta: {
      sessionId,
      createdAt,
      updatedAt,
      device: raw.device || raw.deviceName || os.hostname(),
      projectPath: raw.projectPath || raw.project_path || context.projectPath,
      messageCount: messages.length,
      version: raw.version || 1,
      hash: raw.hash,
    },
    messages,
    context,
  };
}

function loadSessions({ dir = getSessionsDir(), sessionId } = {}) {
  const files = listSessionFiles(dir);
  const sessions = [];

  for (const filePath of files) {
    const raw = loadSessionFile(filePath);
    const payload = toSessionPayload(raw, filePath);
    if (sessionId && payload.meta.sessionId !== sessionId) {
      continue;
    }
    sessions.push(payload);
  }

  return sessions;
}

function loadSessionById(sessionId, dir = getSessionsDir()) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const sessions = loadSessions({ dir, sessionId });
  return sessions[0] || null;
}

module.exports = {
  getSessionsDir,
  listSessionFiles,
  loadSessionFile,
  toSessionPayload,
  loadSessions,
  loadSessionById,
};
