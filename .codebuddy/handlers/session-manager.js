const readline = require('readline');
const { loadConfig, getMissingConfig } = require('../qiniu/config');
const { downloadSessionPayload } = require('../session-sync/restore');
const {
  createProgressTracker,
  formatProgress,
  completeRestore,
} = require('../session-sync/progress');
const { verifySessionIntegrity } = require('../session-sync/integrity');
const { rebuildConversationHistory, prepareForImport } = require('../session-sync/rebuild');
const { createPathMapping, applyMappingToContext } = require('../session-sync/path-mapper');
const {
  detectSessionState,
  recommendStrategy,
  applyMergeStrategy,
} = require('../session-sync/merger');
const { loadFromCache, isCached } = require('../session-sync/cache');

/**
 * 处理 /restore-session 命令
 */
async function handleRestoreSession(params = {}, context = {}) {
  const {
    sessionId: sessionIdArg,
    password,
    strategy: strategyArg = 'append',
    help = false,
  } = params;

  // 显示帮助
  if (help) {
    return showRestoreHelp();
  }

  // 验证参数
  const validation = validateRestoreParams({ sessionId: sessionIdArg });
  if (!validation.valid) {
    return validation;
  }

  // 验证七牛云配置
  const qiniu = loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length > 0) {
    return {
      success: false,
      error: 'Qiniu configuration is missing',
      missing,
      message: 'Please configure Qiniu cloud storage first',
    };
  }

  // 创建进度跟踪器
  const tracker = createProgressTracker({
    verbose: context.verbose,
    onProgress: (progress) => {
      console.log(`\r${formatProgress(tracker)}`);
    },
  });

  try {
    // 获取会话 ID
    const sessionId = await resolveSessionId({ sessionId: sessionIdArg });

    // 检查缓存
    const cached = await loadFromCache(sessionId);
    if (cached && !context.bypassCache) {
      console.log('\nFound session in cache, using cached version...');
    }

    // 获取密码（如果需要）
    const resolvedPassword = await resolvePassword({
      password,
      sessionId,
      qiniu,
    });

    // 下载并解密会话
    const payload = await downloadSessionPayload({
      sessionId,
      password: resolvedPassword,
      qiniuConfig: qiniu,
      onProgress: (progress) => {
        tracker.options.onProgress(progress);
      },
    });

    // 验证完整性
    const integrity = verifySessionIntegrity({
      payload,
      expectedHash: payload.meta.hash,
    });

    if (!integrity.isValid) {
      return {
        success: false,
        error: 'integrity_check_failed',
        message: 'Session integrity check failed',
        details: integrity,
      };
    }

    // 应用路径映射
    const mapping = createPathMapping({
      sourceContext: payload.meta,
    });

    const mappedPayload = {
      ...payload,
      context: applyMappingToContext({
        sessionContext: payload.context,
        mapping,
      }),
    };

    // 重建对话历史
    const rebuilt = await rebuildConversationHistory({
      payload: mappedPayload,
    });

    // 获取当前会话状态
    const currentState = await getCurrentSessionState();

    // 应用合并策略
    const strategy = resolveMergeStrategy({
      requested: strategyArg,
      currentState,
      conflictResult: {
        hasConflict: currentState.messageCount > 0,
        localSession: currentState,
        cloudSession: payload,
      },
    });

    const mergedSession = await applyMergeStrategy({
      source: payload,
      target: currentState,
      strategy,
    });

    // 准备导入
    const importData = prepareForImport({
      rebuilt: { session: mergedSession, summary: rebuilt.summary },
    });

    // 缓存恢复的会话
    if (!cached) {
      const { cacheSession } = require('../session-sync/cache');
      await cacheSession({
        sessionId,
        data: importData,
      });
    }

    // 完成恢复
    const report = completeRestore({
      tracker,
      result: { sessionId, importData },
    });

    return {
      success: true,
      sessionId,
      strategy,
      messageCount: mergedSession.messages.length,
      originalDevice: payload.meta.device,
      originalTime: payload.meta.createdAt,
      duration: report.duration,
      durationFormatted: report.durationFormatted,
      message: `Session restored successfully in ${report.durationFormatted}`,
      importData,
    };
  } catch (error) {
    return handleRestoreError({
      error,
      tracker,
    });
  }
}

/**
 * 解析会话 ID
 */
async function resolveSessionId({ sessionId }) {
  if (sessionId) {
    return sessionId;
  }

  // 如果没有提供，提示用户选择
  console.log('\nAvailable sessions:');
  const sessions = await listSessions({ limit: 10 });

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    console.log(
      `  ${i + 1}. ${session.sessionId.substring(0, 8)}... ` +
        `(${session.messageCount} messages, ${formatTime(session.updatedAt)})`,
    );
  }

  const answer = await prompt('\nSelect a session (1-10): ');
  const index = parseInt(answer) - 1;

  if (index < 0 || index >= sessions.length) {
    throw new Error('Invalid selection');
  }

  return sessions[index].sessionId;
}

/**
 * 解析密码
 */
async function resolvePassword({ password, sessionId, qiniu }) {
  // 如果提供了密码，直接使用
  if (password) {
    return password;
  }

  // 检查是否需要密码
  const { loadEncryptionConfig } = require('../encryption/config');
  const config = loadEncryptionConfig();

  // 如果有 API key，不需要密码
  if (config.apiKey) {
    return null;
  }

  // 否则提示输入密码
  console.log('\nThis session is encrypted. Please enter the password.');
  const pass = await prompt('Password: ');

  if (!pass || pass.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  return pass;
}

/**
 * 解析合并策略
 */
function resolveMergeStrategy({ requested, currentState, conflictResult }) {
  // 如果当前会话为空，使用替换策略
  if (currentState.messageCount === 0) {
    return 'replace';
  }

  // 如果请求了特定策略，使用它
  if (requested && ['replace', 'append', 'merge'].includes(requested)) {
    return requested;
  }

  // 否则使用推荐策略
  const recommendation = recommendStrategy({
    source: conflictResult.cloudSession,
    target: conflictResult.localSession,
  });

  return recommendation.strategy;
}

/**
 * 获取当前会话状态
 */
async function getCurrentSessionState() {
  try {
    const { collectSessionData } = require('../session-sync/collector');
    const sessionData = await collectSessionData({ tracker: null });
    return sessionData;
  } catch (error) {
    // 可能会话不存在或为空
    return {
      meta: { sessionId: null, messageCount: 0 },
      messages: [],
      context: {},
    };
  }
}

/**
 * 验证恢复参数
 */
function validateRestoreParams({ sessionId }) {
  if (!sessionId) {
    // sessionId 可以为空，意味着让用户选择
    return {
      valid: true,
    };
  }

  // 验证 UUID 格式
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(sessionId)) {
    return {
      valid: false,
      error: 'invalid_session_id',
      message: 'Invalid session ID format. Expected UUID v4 format.',
    };
  }

  return { valid: true };
}

/**
 * 显示帮助信息
 */
function showRestoreHelp() {
  const help = `
# Restore Session Command

Restore a session from cloud storage to continue working on it.

## Usage
  /restore-session <session-id> [options]

## Arguments
  session-id        The UUID of the session to restore (optional, will prompt if omitted)

## Options
  --password <pwd>  Provide decryption password
  --strategy <str>  Merge strategy: replace, append, or merge (default: append)
  --help           Show this help message

## Examples
  /restore-session 550e8400-e29b-41d4-a716-446655440000
  /restore-session 550e8400-e29b-41d4-a716-446655440000 --strategy merge
  /restore-session 550e8400-e29b-41d4-a716-446655440000 --password mypassword

## Notes
  - Use /list-sessions to get session IDs
  - Password is required if using password-based encryption
  - Current session is backed up before restore (if not empty)
  - Path mapping is automatically applied for cross-device scenarios
  `.trim();

  return {
    success: true,
    help,
    message: 'Help displayed',
  };
}

/**
 * 处理恢复错误
 */
function handleRestoreError({ error, tracker }) {
  const errorType = classifyError(error);
  const errorMessage = getRestoreErrorMessage(errorType, error);

  const report = completeRestore({
    tracker,
    result: { error },
  });

  return {
    success: false,
    error: errorType,
    message: errorMessage,
    details: error.message,
    duration: report.duration,
  };
}

/**
 * 列出会话
 */
async function listSessions(options = {}) {
  const { limit = 50, search } = options;

  // 验证配置
  const qiniu = loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length > 0) {
    throw new Error('Qiniu configuration is missing');
  }

  // 列出会话
  const { listSessions: listQiniuSessions } = require('../session-sync/file-store');
  const sessions = await listQiniuSessions({
    qiniu,
    limit,
    search,
  });

  return sessions;
}

/**
 * 删除会话
 */
async function deleteSession(sessionId, options = {}) {
  const { force = false, help = false } = options;

  if (help) {
    return showDeleteHelp();
  }

  // 验证参数
  if (!sessionId) {
    return {
      success: false,
      error: 'missing_session_id',
      message: 'Session ID is required',
    };
  }

  // 验证配置
  const qiniu = loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length > 0) {
    return {
      success: false,
      error: 'Qiniu configuration is missing',
      missing,
    };
  }

  // 确认删除
  if (!force) {
    const answer = await prompt(
      `Are you sure you want to delete session ${sessionId.substring(0, 8)}...? (yes/no): `,
    );

    if (answer.toLowerCase() !== 'yes') {
      return {
        success: false,
        cancelled: true,
        message: 'Delete cancelled by user',
      };
    }
  }

  try {
    // 备份会话（在删除前）
    const backupResult = await createBackupBeforeDelete({ sessionId, qiniu });

    // 删除会话
    const { deleteFiles } = require('../qiniu/delete');
    await deleteFiles({
      keys: [`sessions/${sessionId}/*`],
      bucket: qiniu.bucket,
      accessKey: qiniu.accessKey,
      secretKey: qiniu.secretKey,
      region: qiniu.region,
    });

    // 删除缓存
    const { deleteCachedSession } = require('../session-sync/cache');
    await deleteCachedSession(sessionId);

    return {
      success: true,
      sessionId,
      backup: backupResult.success,
      message: 'Session deleted successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: classifyError(error),
      message: error.message,
      sessionId,
    };
  }
}

/**
 * 创建删除前的备份
 */
async function createBackupBeforeDelete({ sessionId, qiniu }) {
  try {
    // 下载会话
    const payload = await downloadSessionPayload({
      sessionId,
      qiniuConfig: qiniu,
    });

    // 保存到本地备份
    const fs = require('fs').promises;
    const path = require('path');
    const backupDir = path.join(require('os').homedir(), '.codebuddy', 'backups', 'deleted');

    await fs.mkdir(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `${sessionId}-${Date.now()}.json`);

    await fs.writeFile(backupFile, JSON.stringify(payload, null, 2), 'utf8');

    return {
      success: true,
      backupFile,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 显示删除帮助
 */
function showDeleteHelp() {
  const help = `
# Delete Session Command

Delete a session from cloud storage.

## Usage
  /delete-session <session-id> [options]

## Arguments
  session-id        The UUID of the session to delete

## Options
  --force        Skip confirmation prompt
  --help         Show this help message

## Examples
  /delete-session 550e8400-e29b-41d4-a716-446655440000
  /delete-session 550e8400-e29b-41d4-a716-446655440000 --force

## Notes
  - Session ID can be obtained from /list-sessions
  - Session will be backed up locally before deletion
  - Cached version will also be deleted
  - This operation is irreversible
  `.trim();

  return {
    success: true,
    help,
    message: 'Help displayed',
  };
}

/**
 * 提示用户输入
 */
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * 格式化时间
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return 'Just now';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)} minutes ago`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)} hours ago`;
  } else if (diff < 604800000) {
    return `${Math.floor(diff / 86400000)} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * 分类错误
 */
function classifyError(error) {
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return 'network_error';
  }

  if (error.message.includes('AccessKey') || error.message.includes('SecretKey')) {
    return 'auth_error';
  }

  if (error.message.includes('not found') || error.message.includes('404')) {
    return 'not_found';
  }

  if (error.message.includes('decryption')) {
    return 'decryption_error';
  }

  return 'unknown_error';
}

/**
 * 获取恢复错误消息
 */
function getRestoreErrorMessage(errorType, error) {
  const messages = {
    network_error: 'Network error: Failed to download session. Please check your connection.',
    auth_error: 'Authentication error: Invalid credentials. Please check your configuration.',
    not_found: 'Session not found: The requested session does not exist in cloud storage.',
    decryption_error: 'Decryption error: Invalid password or corrupted data.',
    unknown_error: `Unexpected error: ${error.message}`,
  };

  return messages[errorType] || messages.unknown_error;
}

module.exports = {
  handleRestoreSession,
  listSessions,
  deleteSession,
  showRestoreHelp,
  showDeleteHelp,
};
