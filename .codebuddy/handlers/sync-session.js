const { loadConfig, getMissingConfig } = require('../qiniu/config');
const { syncSession } = require('../session-sync/sync');
const {
  createProgressTracker,
  formatProgress,
  completeRestore,
} = require('../session-sync/progress');
const {
  detectSessionConflict,
  generateConflictReport,
  getRecommendedStrategies,
} = require('../session-sync/conflict-detector');
const {
  generateConflictDetails,
  applyResolutionStrategy,
} = require('../session-sync/conflict-resolver');

/**
 * 处理 /sync-session 命令
 * @param {Object} params - 命令参数
 * @param {Object} context - 命令上下文
 * @returns {Promise<Object>} 命令执行结果
 */
async function handleSyncSession(params = {}, context = {}) {
  const { force = false, auto = false, help = false } = params;

  // 显示帮助
  if (help) {
    return showHelp();
  }

  // 验证七牛云配置
  const qiniu = loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length > 0) {
    return {
      success: false,
      error: 'Qiniu configuration is missing',
      missing,
      message: 'Please configure Qiniu cloud storage first using /configure-qiniu',
    };
  }

  // 创建进度跟踪器
  const tracker = createProgressTracker({
    verbose: context.verbose,
    onProgress: (progress) => {
      // 显示进度
      console.log(`\r${formatProgress(tracker)}`);
    },
  });

  try {
    // 收集当前会话数据
    const { collectSessionData } = require('../session-sync/collector');
    const sessionData = await collectSessionData({ tracker });

    // 检查云端是否存在该会话
    const { listFiles } = require('../qiniu/list');
    const { listFiles: listSessions } = require('../qiniu/list');
    const sessions = await listSessions({
      bucket: qiniu.bucket,
      accessKey: qiniu.accessKey,
      secretKey: qiniu.secretKey,
      region: qiniu.region,
      prefix: 'sessions',
    });

    // 检测冲突
    const conflictResult = await detectConflict({
      sessionData,
      sessions,
      force,
    });

    if (conflictResult.hasConflict) {
      return await handleConflict({
        conflictResult,
        tracker,
      });
    }

    // 执行同步
    const syncResult = await syncSession({
      sessionData,
      qiniu,
      options: {
        force,
        auto,
        onProgress: (progress) => {
          tracker.options.onProgress(progress);
        },
      },
    });

    // 完成同步
    const report = completeRestore({
      tracker,
      result: syncResult,
    });

    return {
      success: true,
      sessionId: syncResult.sessionId,
      messageCount: syncResult.messageCount,
      uploadedSize: syncResult.uploadedSize,
      duration: report.duration,
      durationFormatted: report.durationFormatted,
      message: `Session synced successfully in ${report.durationFormatted}`,
    };
  } catch (error) {
    return handleError({
      error,
      tracker,
      command: 'sync-session',
    });
  }
}

/**
 * 检测冲突
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 冲突检测结果
 */
async function detectConflict({ sessionData, sessions, force }) {
  if (force || sessions.length === 0) {
    return { hasConflict: false, reason: 'force_or_no_cloud_session' };
  }

  // 查找匹配的会话
  const cloudSession = sessions.find((s) => s.key.includes(sessionData.meta.sessionId));

  if (!cloudSession) {
    return { hasConflict: false, reason: 'new_session' };
  }

  // 下载云端会话元数据进行比较
  // 这里简化处理，实际应该下载并解密
  return {
    hasConflict: false,
    reason: 'session_exists',
    needsSync: true,
  };
}

/**
 * 处理冲突
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 处理结果
 */
async function handleConflict({ conflictResult, tracker }) {
  const details = generateConflictDetails(conflictResult);
  const report = generateConflictReport(conflictResult);

  console.log('\n' + '='.repeat(50));
  console.log('Conflict Detected!');
  console.log('='.repeat(50));
  console.log('\n' + report);

  const strategies = getRecommendedStrategies(conflictResult);

  if (strategies.length === 0) {
    return {
      success: false,
      error: 'conflict_no_strategy',
      message: 'Cannot resolve this conflict automatically',
    };
  }

  console.log('\nRecommended Actions:');
  strategies.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s}`);
  });

  // 这里应该等待用户选择策略
  // 简化处理，使用第一个推荐的策略
  const resolutionResult = applyResolutionStrategy({
    conflictResult,
    strategy: strategies[0],
  });

  if (!resolutionResult.success) {
    return {
      success: false,
      error: 'resolution_failed',
      message: 'Failed to resolve conflict',
      details: resolutionResult,
    };
  }

  return {
    success: true,
    resolved: true,
    strategy: resolutionResult.strategy,
    message: `Conflict resolved using strategy: ${resolutionResult.strategy}`,
  };
}

/**
 * 显示帮助信息
 * @returns {Object} 帮助结果
 */
function showHelp() {
  const help = `
# Sync Session Command

Synchronize the current conversation session to the cloud.

## Usage
  /sync-session [options]

## Options
  --force    Force upload to cloud, even if local version is older
  --auto      Enable automatic sync mode
  --help      Show this help message

## Examples
  /sync-session              # Sync current session
  /sync-session --force      # Force sync (overwrite cloud)
  /sync-session --auto       # Enable auto-sync mode

## Requirements
  - Qiniu cloud storage configured
  - ENCRYPTION_API_KEY set
  - Internet connection
  `.trim();

  return {
    success: true,
    help,
    message: 'Help displayed',
  };
}

/**
 * 处理错误
 * @param {Object} params - 参数
 * @returns {Object} 错误结果
 */
function handleError({ error, tracker, command }) {
  const errorType = classifyError(error);

  const errorMessage = getErrorMessage(errorType, error);

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
    command,
  };
}

/**
 * 分类错误
 * @param {Error} error - 错误对象
 * @returns {string} 错误类型
 */
function classifyError(error) {
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return 'network_error';
  }

  if (error.message.includes('AccessKey') || error.message.includes('SecretKey')) {
    return 'auth_error';
  }

  if (error.message.includes('permission') || error.message.includes('forbidden')) {
    return 'permission_error';
  }

  if (error.message.includes('space') || error.message.includes('quota')) {
    return 'storage_limit';
  }

  return 'unknown_error';
}

/**
 * 获取错误消息
 * @param {string} errorType - 错误类型
 * @param {Error} error - 错误对象
 * @returns {string} 错误消息
 */
function getErrorMessage(errorType, error) {
  const messages = {
    network_error:
      'Network error: Failed to connect to cloud storage. Please check your internet connection.',
    auth_error: 'Authentication error: Invalid Qiniu credentials. Please check your configuration.',
    permission_error: "Permission error: You don't have permission to access this resource.",
    storage_limit:
      'Storage limit: You have exceeded your free storage quota. Please upgrade your plan or delete old sessions.',
    unknown_error: `Unexpected error: ${error.message}`,
  };

  return messages[errorType] || messages.unknown_error;
}

/**
 * 启用自动同步模式
 * @param {Object} params - 参数
 * @returns {Promise<Object>} 启动结果
 */
async function enableAutoSync(params = {}) {
  const { interval = 5 * 60 * 1000, messageThreshold = 10 } = params; // 默认 5 分钟或 10 条消息

  // 检查是否已经启用
  const { getAutoSyncStatus } = require('../session-sync/auto-sync');
  const currentStatus = await getAutoSyncStatus();

  if (currentStatus.enabled) {
    return {
      success: false,
      message: 'Auto-sync is already enabled',
      status: currentStatus,
    };
  }

  // 启用自动同步
  const { enableAutoSync } = require('../session-sync/auto-sync');
  const result = await enableAutoSync({
    interval,
    messageThreshold,
  });

  return {
    success: true,
    message: `Auto-sync enabled with ${interval / 1000}s interval or ${messageThreshold} messages`,
    status: result,
  };
}

/**
 * 禁用自动同步模式
 * @returns {Promise<Object>} 禁用结果
 */
async function disableAutoSync() {
  const { disableAutoSync } = require('../session-sync/auto-sync');
  const result = await disableAutoSync();

  return {
    success: true,
    message: 'Auto-sync disabled',
    status: result,
  };
}

module.exports = {
  handleSyncSession,
  showHelp,
  handleError,
  enableAutoSync,
  disableAutoSync,
};
