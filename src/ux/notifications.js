/**
 * 通知模块
 * 提供同步成功、恢复成功等操作的用户反馈通知
 */

const {
  displaySuccess,
  formatBytes,
  formatDuration,
  formatRelativeTime,
} = require('./error-handler');

/**
 * 显示同步成功通知
 * @param {Object} result - 同步结果
 * @param {string} sessionId - 会话 ID
 * @param {number} duration - 同步耗时（毫秒）
 */
function displaySyncSuccess(result, sessionId, duration) {
  const { messageCount = 0, uploadSize = 0, isNewSession = false, isIncremental = false } = result;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Session Synced Successfully                            ║
╠═══════════════════════════════════════════════════════════╣
║  Session ID:        ${sessionId.padEnd(40)}║
║                                                              ║
║  ${isNewSession ? 'New session created' : isIncremental ? 'Incremental update' : 'Full update'.padEnd(19)}                                      ║
║  Messages synced:   ${messageCount.toString().padEnd(40)}║
║  Upload size:       ${formatBytes(uploadSize).padEnd(40)}║
║  Duration:          ${formatDuration(duration).padEnd(40)}║
║                                                              ║
║  You can now restore this session on any device using:     ║
║  /restore-session ${sessionId.padEnd(30)}║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示恢复成功通知
 * @param {Object} result - 恢复结果
 * @param {string} sessionId - 会话 ID
 * @param {number} duration - 恢复耗时（毫秒）
 */
function displayRestoreSuccess(result, sessionId, duration) {
  const {
    messageCount = 0,
    fileCount = 0,
    downloadSize = 0,
    originalDevice = 'Unknown',
    createdTime = null,
    modifiedTime = null,
    mergeMode = 'replace',
  } = result;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Session Restored Successfully                          ║
╠═══════════════════════════════════════════════════════════╣
║  Session ID:        ${sessionId.padEnd(40)}║
║                                                              ║
║  Messages restored: ${messageCount.toString().padEnd(40)}║
║  Files restored:    ${fileCount.toString().padEnd(40)}║
║  Download size:     ${formatBytes(downloadSize).padEnd(40)}║
║  Duration:          ${formatDuration(duration).padEnd(40)}║
║                                                              ║
║  Original device:   ${originalDevice.padEnd(40)}║
║  Created:           ${createdTime ? formatRelativeTime(createdTime).padEnd(40) : 'Unknown'.padEnd(40)}║
║  Last modified:     ${modifiedTime ? formatRelativeTime(modifiedTime).padEnd(40) : 'Unknown'.padEnd(40)}║
║                                                              ║
║  Merge mode:        ${mergeMode.padEnd(40)}║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示删除成功通知
 * @param {string} sessionId - 会话 ID
 * @param {number} freedSpace - 释放的存储空间（字节）
 * @param {number} fileCount - 删除的文件数量
 */
function displayDeleteSuccess(sessionId, freedSpace, fileCount) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Session Deleted Successfully                           ║
╠═══════════════════════════════════════════════════════════╣
║  Session ID:        ${sessionId.padEnd(40)}║
║                                                              ║
║  Files deleted:     ${fileCount.toString().padEnd(40)}║
║  Space freed:       ${formatBytes(freedSpace).padEnd(40)}║
║                                                              ║
║  The session has been permanently removed from cloud.      ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示自动同步开始通知
 * @param {string} reason - 同步原因
 */
function displayAutoSyncStart(reason) {
  console.log(`\n🔄 Auto-sync started: ${reason}`);
}

/**
 * 显示自动同步完成通知
 * @param {boolean} success - 是否成功
 * @param {string} error - 错误信息（如果失败）
 */
function displayAutoSyncComplete(success, error = null) {
  if (success) {
    console.log('✅ Auto-sync completed');
  } else {
    console.log(`⚠️  Auto-sync failed: ${error || 'Unknown error'}`);
    console.log('   Will retry on next sync interval');
  }
}

/**
 * 显示冲突检测通知
 * @param {Object} conflict - 冲突信息
 */
function displayConflictDetected(conflict) {
  const { localVersion, cloudVersion, sessionId } = conflict;

  console.warn(`
╔═══════════════════════════════════════════════════════════╗
║  ⚠️  Conflict Detected                                      ║
╠═══════════════════════════════════════════════════════════╣
║  Session ID:        ${sessionId.padEnd(40)}║
║                                                              ║
║  Local version:     ${localVersion.toString().padEnd(40)}║
║  Cloud version:     ${cloudVersion.toString().padEnd(40)}║
║                                                              ║
║  Both local and cloud have been modified. Choose action:    ║
║  1. Use local version (overwrite cloud)                     ║
║  2. Use cloud version (overwrite local)                     ║
║  3. Manual merge                                           ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示密钥轮换成功通知
 * @param {number} sessionsReencrypted - 重新加密的会话数量
 * @param {number} duration - 耗时（毫秒）
 */
function displayKeyRotationSuccess(sessionsReencrypted, duration) {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Encryption Key Rotated Successfully                    ║
╠═══════════════════════════════════════════════════════════╣
║  Sessions re-encrypted: ${sessionsReencrypted.toString().padEnd(35)}║
║  Duration:            ${formatDuration(duration).padEnd(40)}║
║                                                              ║
║  ⚠️  IMPORTANT: Your new API key has been generated.        ║
║  Export it now with /export-key and store it safely.        ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示配置成功通知
 * @param {string} configType - 配置类型
 */
function displayConfigSuccess(configType) {
  const messages = {
    qiniu: '七牛云配置已保存',
    encryption: '加密配置已保存',
    all: '配置已保存',
  };

  const message = messages[configType] || messages.all;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Configuration Saved                                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                              ║
║  ${message.padEnd(60)}║
║                                                              ║
║  You can now use cloud session sync features:              ║
║  /sync-session      - Sync current session                  ║
║  /restore-session   - Restore a session                     ║
║  /list-sessions     - List all cloud sessions               ║
║                                                              ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 显示进度更新
 * @param {string} operation - 操作名称
 * @param {number} current - 当前进度
 * @param {number} total - 总进度
 * @param {string} details - 详细信息
 */
function displayProgressUpdate(operation, current, total, details = '') {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filledLength = Math.round((barLength * current) / total);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);

  process.stdout.write(`\r${operation}: [${bar}] ${percentage}%${details ? ' - ' + details : ''}`);

  if (current >= total) {
    process.stdout.write('\n');
  }
}

/**
 * 清除进度行
 */
function clearProgress() {
  process.stdout.write('\r' + ' '.repeat(100) + '\r');
}

/**
 * 显示操作步骤
 * @param {number} step - 当前步骤
 * @param {number} total - 总步骤数
 * @param {string} description - 步骤描述
 */
function displayStep(step, total, description) {
  console.log(`\n[${step}/${total}] ${description}`);
}

/**
 * 显示操作完成
 * @param {string} operation - 操作名称
 * @param {number} duration - 耗时（毫秒）
 */
function displayOperationComplete(operation, duration) {
  console.log(`\n✅ ${operation} completed in ${formatDuration(duration)}`);
}

/**
 * 显示操作失败
 * @param {string} operation - 操作名称
 * @param {Error} error - 错误对象
 */
function displayOperationFailed(operation, error) {
  console.error(`\n❌ ${operation} failed: ${error.message}`);
}

module.exports = {
  displaySyncSuccess,
  displayRestoreSuccess,
  displayDeleteSuccess,
  displayAutoSyncStart,
  displayAutoSyncComplete,
  displayConflictDetected,
  displayKeyRotationSuccess,
  displayConfigSuccess,
  displayProgressUpdate,
  clearProgress,
  displayStep,
  displayOperationComplete,
  displayOperationFailed,
};
