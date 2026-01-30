const fs = require('fs').promises;
const path = require('path');

/**
 * 获取备份目录路径
 * @returns {Promise<string>} 备份目录路径
 */
async function getBackupDir() {
  const homedir = require('os').homedir();
  const backupDir = path.join(homedir, '.codebuddy', 'backups', 'conflicts');

  await fs.mkdir(backupDir, { recursive: true });

  return backupDir;
}

/**
 * 生成备份文件名
 * @param {string} sessionId - 会话 ID
 * @param {string} backupType - 备份类型
 * @param {number} timestamp - 时间戳
 * @returns {string} 备份文件名
 */
function generateBackupFileName(sessionId, backupType, timestamp) {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  return `${sessionId}-${backupType}-${dateStr}-${timeStr}.json`;
}

/**
 * 创建会话备份
 * @param {string} sessionId - 会话 ID
 * @param {Object} session - 要备份的会话
 * @param {string} backupType - 备份类型 (local/cloud)
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 备份结果
 */
async function createBackup({ sessionId, session, backupType, options = {} }) {
  const backupDir = await getBackupDir();
  const timestamp = Date.now();
  const filename = generateBackupFileName(sessionId, backupType, timestamp);
  const filepath = path.join(backupDir, filename);

  const backup = {
    sessionId,
    backupType,
    timestamp,
    backedUpAt: new Date(timestamp).toISOString(),
    session,
    reason: options.reason || 'conflict_resolution',
    expiresAt: new Date(timestamp + options.retentionDays * 24 * 60 * 60 * 1000).toISOString(),
  };

  await fs.writeFile(filepath, JSON.stringify(backup, null, 2), 'utf8');

  return {
    success: true,
    backupId: generateBackupId(sessionId, timestamp, backupType),
    filepath,
    timestamp,
    expiresAt: backup.expiresAt,
  };
}

/**
 * 生成备份 ID
 * @param {string} sessionId - 会话 ID
 * @param {number} timestamp - 时间戳
 * @param {string} backupType - 备份类型
 * @returns {string} 备份 ID
 */
function generateBackupId(sessionId, timestamp, backupType) {
  const crypto = require('crypto');
  const hash = crypto
    .createHash('md5')
    .update(`${sessionId}-${timestamp}-${backupType}`)
    .digest('hex')
    .substring(0, 12);
  return `backup-${hash}`;
}

/**
 * 查找会话的备份
 * @param {string} sessionId - 会话 ID
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 备份列表
 */
async function findBackups({ sessionId, options = {} }) {
  const backupDir = await getBackupDir();

  try {
    const files = await fs.readdir(backupDir);
    const backups = [];

    for (const file of files) {
      if (!file.startsWith(`${sessionId}-`) || !file.endsWith('.json')) {
        continue;
      }

      try {
        const filepath = path.join(backupDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const backup = JSON.parse(content);

        // 检查是否过期
        const isExpired = new Date(backup.expiresAt) < new Date();

        if (options.includeExpired || !isExpired) {
          backups.push({
            ...backup,
            filepath,
            filename: file,
            isExpired,
            age: Date.now() - backup.timestamp,
          });
        }
      } catch (error) {
        // 跳过损坏的备份文件
        continue;
      }
    }

    // 按时间倒序排序
    backups.sort((a, b) => b.timestamp - a.timestamp);

    return backups;
  } catch (error) {
    return [];
  }
}

/**
 * 恢复备份
 * @param {string} backupId - 备份 ID
 * @returns {Promise<Object>} 恢复结果
 */
async function restoreBackup(backupId) {
  const backups = await listAllBackups();

  const backup = backups.find((b) => b.backupId === backupId);

  if (!backup) {
    throw new Error(`Backup not found: ${backupId}`);
  }

  return {
    success: true,
    session: backup.session,
    backupId,
    backupType: backup.backupType,
    backedUpAt: backup.backedUpAt,
    reason: backup.reason,
  };
}

/**
 * 列出所有备份
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 备份列表
 */
async function listAllBackups(options = {}) {
  const backupDir = await getBackupDir();

  try {
    const files = await fs.readdir(backupDir);
    const backups = [];

    for (const file of files) {
      if (!file.endsWith('.json')) {
        continue;
      }

      try {
        const filepath = path.join(backupDir, file);
        const content = await fs.readFile(filepath, 'utf8');
        const backup = JSON.parse(content);

        // 检查是否过期
        const isExpired = new Date(backup.expiresAt) < new Date();

        if (options.includeExpired || !isExpired) {
          backups.push({
            ...backup,
            backupId: generateBackupId(backup.sessionId, backup.timestamp, backup.backupType),
            filepath,
            filename: file,
            isExpired,
            age: Date.now() - backup.timestamp,
          });
        }
      } catch (error) {
        // 跳过损坏的备份文件
        continue;
      }
    }

    // 按时间倒序排序
    backups.sort((a, b) => b.timestamp - a.timestamp);

    return backups;
  } catch (error) {
    return [];
  }
}

/**
 * 清理过期备份
 * @param {Object} options - 选项
 * @returns {Promise<Object>} 清理结果
 */
async function cleanExpiredBackups(options = {}) {
  const backups = await listAllBackups({ includeExpired: true });

  const expired = backups.filter((b) => b.isExpired);
  const deleted = [];
  const errors = [];

  for (const backup of expired) {
    try {
      await fs.unlink(backup.filepath);
      deleted.push({
        backupId: backup.backupId,
        sessionId: backup.sessionId,
        backupType: backup.backupType,
      });
    } catch (error) {
      errors.push({
        backupId: backup.backupId,
        error: error.message,
      });
    }
  }

  return {
    deletedCount: deleted.length,
    deleted,
    errorsCount: errors.length,
    errors,
  };
}

/**
 * 删除指定备份
 * @param {string} backupId - 备份 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteBackup(backupId) {
  const backups = await listAllBackups();

  const backup = backups.find((b) => b.backupId === backupId);

  if (!backup) {
    return false;
  }

  try {
    await fs.unlink(backup.filepath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 记录冲突解决历史
 * @param {string} sessionId - 会话 ID
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} resolutionResult - 解决结果
 * @returns {Promise<Object>} 历史记录
 */
async function recordConflictResolution({ sessionId, conflictResult, resolutionResult }) {
  const historyFile = await getHistoryFile();

  const historyEntry = {
    sessionId,
    timestamp: Date.now(),
    resolvedAt: new Date().toISOString(),
    conflictType: conflictResult.conflictType,
    conflictSeverity: conflictResult.severity,
    resolutionStrategy: resolutionResult.strategy,
    success: resolutionResult.success,
    autoMerged: resolutionResult.autoMerged || false,
    conflictReason: conflictResult.reason,
    backupCreated: resolutionResult.backupId ? true : false,
    backupId: resolutionResult.backupId,
  };

  // 读取现有历史
  let history = [];
  try {
    const content = await fs.readFile(historyFile, 'utf8');
    history = JSON.parse(content);
  } catch (error) {
    // 文件不存在或损坏，创建新历史
  }

  // 添加新条目
  history.push(historyEntry);

  // 只保留最近 100 条记录
  if (history.length > 100) {
    history = history.slice(-100);
  }

  await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf8');

  return historyEntry;
}

/**
 * 获取历史文件路径
 * @returns {Promise<string>} 历史文件路径
 */
async function getHistoryFile() {
  const backupDir = await getBackupDir();
  return path.join(backupDir, 'resolution-history.json');
}

/**
 * 获取冲突解决历史
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 历史记录
 */
async function getResolutionHistory(options = {}) {
  const historyFile = await getHistoryFile();

  try {
    const content = await fs.readFile(historyFile, 'utf8');
    let history = JSON.parse(content);

    // 过滤
    if (options.sessionId) {
      history = history.filter((h) => h.sessionId === options.sessionId);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    // 按时间倒序排序
    history.sort((a, b) => b.timestamp - a.timestamp);

    return history;
  } catch (error) {
    return [];
  }
}

/**
 * 生成备份报告
 * @param {string} sessionId - 会话 ID (可选)
 * @returns {Promise<string>} 备份报告
 */
async function generateBackupReport(sessionId) {
  const backups = sessionId ? await findBackups({ sessionId }) : await listAllBackups();

  const lines = [
    '=== Conflict Backup Report ===',
    '',
    `Session${sessionId ? `: ${sessionId}` : 's: All'}`,
    `Total backups: ${backups.length}`,
    '',
  ];

  if (backups.length === 0) {
    lines.push('No backups found.');
  } else {
    lines.push('Backups:');

    backups.forEach((backup, index) => {
      const age = formatDuration(backup.age);
      const expired = backup.isExpired ? ' [EXPIRED]' : '';
      lines.push(
        `${index + 1}. ${backup.backupId.substring(0, 16)}... ` +
          `(${backup.backupType}) ${age} ago${expired}`,
      );
      lines.push(`   Created: ${new Date(backup.backedUpAt).toLocaleString()}`);
      lines.push(`   Messages: ${backup.session.messages?.length || 0}`);
      lines.push('');
    });
  }

  lines.push('=== End of Report ===');

  return lines.join('\n');
}

/**
 * 格式化持续时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化的时间字符串
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

module.exports = {
  getBackupDir,
  createBackup,
  findBackups,
  restoreBackup,
  listAllBackups,
  cleanExpiredBackups,
  deleteBackup,
  recordConflictResolution,
  getResolutionHistory,
  generateBackupReport,
};
