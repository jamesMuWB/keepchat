/**
 * 会话清理工具
 * 提供会话清理功能，帮助用户删除旧的云端会话
 */

const { listFiles } = require('../qiniu/list');
const { deleteFiles } = require('../qiniu/delete');
const { getStorageUsage } = require('./storage-monitor');
const {
  formatBytes,
  formatRelativeTime,
  displaySuccess,
  displayWarning,
} = require('./error-handler');

/**
 * 会话排序选项
 */
const SortOption = {
  LAST_MODIFIED: 'last_modified', // 按最后修改时间排序
  CREATED: 'created', // 按创建时间排序
  SIZE: 'size', // 按大小排序
  NAME: 'name', // 按名称排序
};

/**
 * 排序方向
 */
const SortOrder = {
  ASC: 'asc', // 升序
  DESC: 'desc', // 降序
};

/**
 * 获取所有云端会话
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 查询选项
 * @returns {Promise<Array>} 会话列表
 */
async function listAllSessions(config, options = {}) {
  const { prefix = 'sessions/', limit = 1000 } = options;

  const files = await listFiles(config, { prefix, limit });

  // 按会话 ID 分组
  const sessionsMap = new Map();

  for (const file of files) {
    // 从文件路径提取会话 ID
    // 格式: sessions/<sessionId>/meta.json
    const match = file.key.match(/^sessions\/([^/]+)\//);
    if (!match) continue;

    const sessionId = match[1];

    if (!sessionsMap.has(sessionId)) {
      sessionsMap.set(sessionId, {
        sessionId,
        files: [],
        totalSize: 0,
        lastModified: file.putTime || new Date().toISOString(),
        created: file.putTime || new Date().toISOString(),
      });
    }

    const session = sessionsMap.get(sessionId);
    session.files.push(file);
    session.totalSize += parseInt(file.fsize) || 0;

    // 更新最后修改时间
    const fileTime = file.putTime || new Date().toISOString();
    if (fileTime > session.lastModified) {
      session.lastModified = fileTime;
    }
  }

  // 转换为数组并添加额外信息
  const sessions = Array.from(sessionsMap.values()).map((session) => ({
    ...session,
    fileCount: session.files.length,
    // 尝试从 meta.json 读取会话元数据
    meta: session.files.find((f) => f.key.endsWith('meta.json')) || null,
  }));

  return sessions;
}

/**
 * 排序会话列表
 * @param {Array} sessions - 会话列表
 * @param {string} sortBy - 排序字段
 * @param {string} order - 排序方向
 * @returns {Array} 排序后的会话列表
 */
function sortSessions(sessions, sortBy = SortOption.LAST_MODIFIED, order = SortOrder.DESC) {
  const sorted = [...sessions];

  sorted.sort((a, b) => {
    let compareValue = 0;

    switch (sortBy) {
      case SortOption.LAST_MODIFIED:
        compareValue = new Date(a.lastModified) - new Date(b.lastModified);
        break;
      case SortOption.CREATED:
        compareValue = new Date(a.created) - new Date(b.created);
        break;
      case SortOption.SIZE:
        compareValue = a.totalSize - b.totalSize;
        break;
      case SortOption.NAME:
        compareValue = a.sessionId.localeCompare(b.sessionId);
        break;
      default:
        compareValue = 0;
    }

    return order === SortOrder.ASC ? compareValue : -compareValue;
  });

  return sorted;
}

/**
 * 过滤会话列表
 * @param {Array} sessions - 会话列表
 * @param {Object} filters - 过滤条件
 * @returns {Array} 过滤后的会话列表
 */
function filterSessions(sessions, filters = {}) {
  let filtered = [...sessions];

  // 按时间范围过滤
  if (filters.olderThan) {
    const cutoffDate = new Date(Date.now() - filters.olderThan);
    filtered = filtered.filter((s) => new Date(s.lastModified) < cutoffDate);
  }

  // 按关键词搜索
  if (filters.keyword) {
    const keyword = filters.keyword.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.sessionId.toLowerCase().includes(keyword) ||
        (s.meta && JSON.stringify(s.meta).toLowerCase().includes(keyword)),
    );
  }

  // 按大小过滤
  if (filters.minSize) {
    filtered = filtered.filter((s) => s.totalSize >= filters.minSize);
  }
  if (filters.maxSize) {
    filtered = filtered.filter((s) => s.totalSize <= filters.maxSize);
  }

  // 按文件数量过滤
  if (filters.minFiles) {
    filtered = filtered.filter((s) => s.fileCount >= filters.minFiles);
  }

  return filtered;
}

/**
 * 显示会话列表
 * @param {Array} sessions - 会话列表
 * @param {Object} options - 显示选项
 */
function displaySessions(sessions, options = {}) {
  const {
    showIndex = true,
    showSize = true,
    showDate = true,
    showFileCount = true,
    compact = false,
  } = options;

  if (sessions.length === 0) {
    console.log('\nNo sessions found.');
    return;
  }

  console.log(`\nFound ${sessions.length} session(s):\n`);

  sessions.forEach((session, index) => {
    const lines = [];

    if (showIndex) {
      lines.push(`${(index + 1).toString().padStart(3)}. ${session.sessionId}`);
    } else {
      lines.push(session.sessionId);
    }

    if (showSize) {
      lines.push(`   Size: ${formatBytes(session.totalSize)}`);
    }

    if (showDate) {
      lines.push(`   Modified: ${formatRelativeTime(session.lastModified)}`);
    }

    if (showFileCount) {
      lines.push(`   Files: ${session.fileCount}`);
    }

    if (!compact) {
      lines.push(''); // 空行分隔
    }

    console.log(lines.join('\n'));
  });

  // 显示总计信息
  const totalSize = sessions.reduce((sum, s) => sum + s.totalSize, 0);
  const totalFiles = sessions.reduce((sum, s) => sum + s.fileCount, 0);

  console.log(
    `\nTotal: ${sessions.length} sessions, ${totalFiles} files, ${formatBytes(totalSize)}\n`,
  );
}

/**
 * 删除会话
 * @param {Object} config - 七牛云配置
 * @param {string|Array} sessionIds - 会话 ID 或会话 ID 数组
 * @returns {Promise<Object>} 删除结果
 */
async function deleteSessions(config, sessionIds) {
  const ids = Array.isArray(sessionIds) ? sessionIds : [sessionIds];
  const results = {
    successful: [],
    failed: [],
    totalSize: 0,
  };

  for (const sessionId of ids) {
    try {
      // 列出会话的所有文件
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(config, { prefix });

      if (files.length === 0) {
        results.failed.push({
          sessionId,
          error: 'Session not found',
        });
        continue;
      }

      // 计算总大小
      const totalSize = files.reduce((sum, f) => sum + (parseInt(f.fsize) || 0), 0);

      // 删除所有文件
      const keys = files.map((f) => f.key);
      await deleteFiles(config, keys);

      results.successful.push({
        sessionId,
        fileCount: files.length,
        size: totalSize,
      });
      results.totalSize += totalSize;
    } catch (error) {
      results.failed.push({
        sessionId,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * 交互式清理会话
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 清理选项
 * @returns {Promise<Object>} 清理结果
 */
async function interactiveCleanup(config, options = {}) {
  const {
    olderThan = 30 * 24 * 60 * 60 * 1000, // 默认 30 天
    minSize = 0,
    sortBy = SortOption.LAST_MODIFIED,
    sortOrder = SortOrder.ASC,
    limit = 20,
    dryRun = false,
  } = options;

  console.log('\n🔍 Scanning for sessions to clean up...\n');

  // 获取所有会话
  const allSessions = await listAllSessions(config);

  // 过滤和排序
  let sessions = filterSessions(allSessions, { olderThan, minSize });
  sessions = sortSessions(sessions, sortBy, sortOrder);

  // 限制数量
  sessions = sessions.slice(0, limit);

  if (sessions.length === 0) {
    displaySuccess('No sessions found matching the cleanup criteria.');
    return { deleted: 0, freedSpace: 0, sessions: [] };
  }

  // 显示会话列表
  displaySessions(sessions, { compact: false });

  // 计算总计信息
  const totalSize = sessions.reduce((sum, s) => sum + s.totalSize, 0);
  const totalFiles = sessions.reduce((sum, s) => sum + s.fileCount, 0);

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`   Sessions: ${sessions.length}`);
  console.log(`   Files: ${totalFiles}`);
  console.log(`   Total size: ${formatBytes(totalSize)}`);
  console.log(`   This will free up ${formatBytes(totalSize)} of storage space.\n`);

  if (dryRun) {
    console.log('🏃 Dry run mode - no sessions will be deleted.');
    return {
      deleted: 0,
      freedSpace: 0,
      sessions,
      dryRun: true,
    };
  }

  // 确认删除
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmed = await new Promise((resolve) => {
    rl.question(
      `Are you sure you want to delete these ${sessions.length} session(s)? (yes/no): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      },
    );
  });

  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled.');
    return { deleted: 0, freedSpace: 0, sessions: [] };
  }

  // 执行删除
  console.log('\n🗑️  Deleting sessions...');
  const results = await deleteSessions(
    config,
    sessions.map((s) => s.sessionId),
  );

  // 显示结果
  if (results.successful.length > 0) {
    console.log(`\n✅ Successfully deleted ${results.successful.length} session(s)`);
    console.log(`   Freed up: ${formatBytes(results.totalSize)}`);
  }

  if (results.failed.length > 0) {
    console.log(`\n⚠️  Failed to delete ${results.failed.length} session(s):`);
    results.failed.forEach((f) => {
      console.log(`   ${f.sessionId}: ${f.error}`);
    });
  }

  return {
    deleted: results.successful.length,
    freedSpace: results.totalSize,
    sessions: results.successful,
  };
}

/**
 * 自动清理（删除最旧的 N 个会话）
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 清理选项
 * @returns {Promise<Object>} 清理结果
 */
async function autoCleanup(config, options = {}) {
  const {
    count = 10, // 删除最旧的 10 个会话
    minAge = 7 * 24 * 60 * 60 * 1000, // 最少 7 天未访问
    keepFree = 1024 * 1024 * 1024, // 保持至少 1GB 空闲空间
  } = options;

  // 检查当前存储使用情况
  const usage = await getStorageUsage(config);

  // 如果还有足够空间，不需要清理
  if (usage.remaining > keepFree) {
    return {
      deleted: 0,
      freedSpace: 0,
      reason: 'Sufficient storage space available',
    };
  }

  // 获取会话列表并过滤
  const sessions = await listAllSessions(config);
  const oldSessions = filterSessions(sessions, {
    olderThan: minAge,
  });

  // 按最后修改时间排序（最旧的在前）
  const sorted = sortSessions(oldSessions, SortOption.LAST_MODIFIED, SortOrder.ASC);

  // 选择要删除的会话
  const toDelete = sorted.slice(0, count);

  if (toDelete.length === 0) {
    return {
      deleted: 0,
      freedSpace: 0,
      reason: 'No eligible sessions found for cleanup',
    };
  }

  // 删除会话
  const results = await deleteSessions(
    config,
    toDelete.map((s) => s.sessionId),
  );

  return {
    deleted: results.successful.length,
    freedSpace: results.totalSize,
    sessions: results.successful,
  };
}

/**
 * 估算可以清理多少空间
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 估算选项
 * @returns {Promise<Object>} 估算结果
 */
async function estimateCleanup(config, options = {}) {
  const {
    olderThan = 30 * 24 * 60 * 60 * 1000,
    sortBy = SortOption.SIZE,
    sortOrder = SortOrder.DESC,
  } = options;

  const sessions = await listAllSessions(config);
  const filtered = filterSessions(sessions, { olderThan });
  const sorted = sortSessions(filtered, sortBy, sortOrder);

  const totalSize = filtered.reduce((sum, s) => sum + s.totalSize, 0);
  const avgSize = filtered.length > 0 ? totalSize / filtered.length : 0;

  return {
    sessionCount: filtered.length,
    totalSize,
    averageSize: avgSize,
    sessions: sorted.slice(0, 10), // 返回前 10 个最大的会话
  };
}

module.exports = {
  SortOption,
  SortOrder,
  listAllSessions,
  sortSessions,
  filterSessions,
  displaySessions,
  deleteSessions,
  interactiveCleanup,
  autoCleanup,
  estimateCleanup,
};
