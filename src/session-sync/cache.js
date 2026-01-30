const fs = require('fs').promises;
const path = require('path');

/**
 * 获取缓存目录路径
 * @returns {Promise<string>} 缓存目录路径
 */
async function getCacheDir() {
  const homedir = require('os').homedir();
  const cacheDir = path.join(homedir, '.codebuddy', 'cache', 'sessions');

  // 确保缓存目录存在
  await fs.mkdir(cacheDir, { recursive: true });

  return cacheDir;
}

/**
 * 生成缓存文件名
 * @param {string} sessionId - 会话 ID
 * @returns {string} 缓存文件名
 */
function getCacheFileName(sessionId) {
  return `${sessionId}.json`;
}

/**
 * 缓存会话数据
 * @param {string} sessionId - 会话 ID
 * @param {Object} data - 要缓存的数据
 * @returns {Promise<Object>} 缓存结果
 */
async function cacheSession({ sessionId, data }) {
  const cacheDir = await getCacheDir();
  const cacheFile = path.join(cacheDir, getCacheFileName(sessionId));

  const cacheEntry = {
    sessionId,
    cachedAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    data,
  };

  await fs.writeFile(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');

  return {
    success: true,
    path: cacheFile,
    cachedAt: cacheEntry.cachedAt,
  };
}

/**
 * 从缓存加载会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Object|null>} 缓存的会话数据，如果不存在则返回 null
 */
async function loadFromCache(sessionId) {
  const cacheDir = await getCacheDir();
  const cacheFile = path.join(cacheDir, getCacheFileName(sessionId));

  try {
    const content = await fs.readFile(cacheFile, 'utf8');
    const cacheEntry = JSON.parse(content);

    // 更新访问时间
    cacheEntry.accessedAt = new Date().toISOString();
    await fs.writeFile(cacheFile, JSON.stringify(cacheEntry, null, 2), 'utf8');

    return cacheEntry.data;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 检查会话是否已缓存
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否已缓存
 */
async function isCached(sessionId) {
  const cacheDir = await getCacheDir();
  const cacheFile = path.join(cacheDir, getCacheFileName(sessionId));

  try {
    await fs.access(cacheFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取缓存信息
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<Object|null>} 缓存信息
 */
async function getCacheInfo(sessionId) {
  const cacheDir = await getCacheDir();
  const cacheFile = path.join(cacheDir, getCacheFileName(sessionId));

  try {
    const content = await fs.readFile(cacheFile, 'utf8');
    const cacheEntry = JSON.parse(content);

    return {
      sessionId,
      cachedAt: cacheEntry.cachedAt,
      accessedAt: cacheEntry.accessedAt,
      age: Date.now() - new Date(cacheEntry.cachedAt).getTime(),
      size: content.length,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * 列出所有缓存的会话
 * @returns {Promise<Array>} 缓存的会话列表
 */
async function listCachedSessions() {
  const cacheDir = await getCacheDir();

  try {
    const files = await fs.readdir(cacheDir);
    const sessions = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = await fs.readFile(path.join(cacheDir, file), 'utf8');
          const cacheEntry = JSON.parse(content);

          sessions.push({
            sessionId: cacheEntry.sessionId,
            cachedAt: cacheEntry.cachedAt,
            accessedAt: cacheEntry.accessedAt,
            age: Date.now() - new Date(cacheEntry.cachedAt).getTime(),
            size: content.length,
          });
        } catch (error) {
          // 跳过损坏的缓存文件
          continue;
        }
      }
    }

    // 按访问时间排序（最近访问的在前）
    sessions.sort((a, b) => new Date(b.accessedAt) - new Date(a.accessedAt));

    return sessions;
  } catch (error) {
    return [];
  }
}

/**
 * 删除缓存的会话
 * @param {string} sessionId - 会话 ID
 * @returns {Promise<boolean>} 是否成功删除
 */
async function deleteCachedSession(sessionId) {
  const cacheDir = await getCacheDir();
  const cacheFile = path.join(cacheDir, getCacheFileName(sessionId));

  try {
    await fs.unlink(cacheFile);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * 清空所有缓存
 * @returns {Promise<number>} 删除的缓存文件数量
 */
async function clearAllCache() {
  const cacheDir = await getCacheDir();

  try {
    const files = await fs.readdir(cacheDir);
    let count = 0;

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          await fs.unlink(path.join(cacheDir, file));
          count++;
        } catch (error) {
          // 跳过删除失败的文件
          continue;
        }
      }
    }

    return count;
  } catch (error) {
    return 0;
  }
}

/**
 * 检查缓存是否过期
 * @param {string} sessionId - 会话 ID
 * @param {number} maxAge - 最大缓存时间（毫秒）
 * @returns {Promise<boolean>} 是否过期
 */
async function isExpired({ sessionId, maxAge = 30 * 24 * 60 * 60 * 1000 }) {
  const cacheInfo = await getCacheInfo(sessionId);

  if (!cacheInfo) {
    return true;
  }

  return cacheInfo.age > maxAge;
}

/**
 * 获取缓存统计信息
 * @returns {Promise<Object>} 缓存统计
 */
async function getCacheStats() {
  const sessions = await listCachedSessions();

  const totalSize = sessions.reduce((sum, s) => sum + s.size, 0);
  const oldestAge = sessions.length > 0 ? Math.max(...sessions.map((s) => s.age)) : 0;
  const newestAge = sessions.length > 0 ? Math.min(...sessions.map((s) => s.age)) : 0;

  return {
    totalSessions: sessions.length,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    oldestAge,
    newestAge,
    oldestAgeFormatted: formatDuration(oldestAge),
    newestAgeFormatted: formatDuration(newestAge),
  };
}

/**
 * 清理过期缓存
 * @param {number} maxAge - 最大缓存时间（毫秒），默认 30 天
 * @returns {Promise<Object>} 清理结果
 */
async function cleanExpiredCache(maxAge = 30 * 24 * 60 * 60 * 1000) {
  const sessions = await listCachedSessions();
  const deleted = [];
  const errors = [];

  for (const session of sessions) {
    if (session.age > maxAge) {
      try {
        await deleteCachedSession(session.sessionId);
        deleted.push({
          sessionId: session.sessionId,
          age: session.age,
          ageFormatted: formatDuration(session.age),
          size: session.size,
        });
      } catch (error) {
        errors.push({
          sessionId: session.sessionId,
          error: error.message,
        });
      }
    }
  }

  const deletedSize = deleted.reduce((sum, s) => sum + s.size, 0);

  return {
    deletedCount: deleted.length,
    deletedSize,
    deletedSizeFormatted: formatBytes(deletedSize),
    errorsCount: errors.length,
    deleted,
    errors,
  };
}

/**
 * 清理旧缓存（保留最新的 N 个）
 * @param {number} keepCount - 保留的缓存数量
 * @returns {Promise<Object>} 清理结果
 */
async function cleanOldCache(keepCount = 10) {
  const sessions = await listCachedSessions();
  const toDelete = sessions.slice(keepCount);
  const deleted = [];
  const errors = [];

  for (const session of toDelete) {
    try {
      await deleteCachedSession(session.sessionId);
      deleted.push({
        sessionId: session.sessionId,
        age: session.age,
        ageFormatted: formatDuration(session.age),
        size: session.size,
      });
    } catch (error) {
      errors.push({
        sessionId: session.sessionId,
        error: error.message,
      });
    }
  }

  const deletedSize = deleted.reduce((sum, s) => sum + s.size, 0);

  return {
    deletedCount: deleted.length,
    deletedSize,
    deletedSizeFormatted: formatBytes(deletedSize),
    errorsCount: errors.length,
    deleted,
    errors,
  };
}

/**
 * 按大小清理缓存（删除最大的缓存以释放空间）
 * @param {number} targetSize - 目标大小（字节）
 * @returns {Promise<Object>} 清理结果
 */
async function cleanCacheBySize(targetSize) {
  const sessions = await listCachedSessions();

  // 按大小排序，从大到小
  const sorted = [...sessions].sort((a, b) => b.size - a.size);

  const deleted = [];
  const errors = [];
  let currentSize = sessions.reduce((sum, s) => sum + s.size, 0);
  let deletedSize = 0;

  for (const session of sorted) {
    if (currentSize - deletedSize <= targetSize) {
      break;
    }

    try {
      await deleteCachedSession(session.sessionId);
      deletedSize += session.size;
      deleted.push({
        sessionId: session.sessionId,
        size: session.size,
        sizeFormatted: formatBytes(session.size),
        age: session.age,
      });
    } catch (error) {
      errors.push({
        sessionId: session.sessionId,
        error: error.message,
      });
    }
  }

  return {
    deletedCount: deleted.length,
    deletedSize,
    deletedSizeFormatted: formatBytes(deletedSize),
    originalSize: currentSize,
    newSize: currentSize - deletedSize,
    newSizeFormatted: formatBytes(currentSize - deletedSize),
    errorsCount: errors.length,
    deleted,
    errors,
  };
}

/**
 * 生成缓存报告
 * @returns {Promise<string>} 缓存报告字符串
 */
async function generateCacheReport() {
  const stats = await getCacheStats();
  const sessions = await listCachedSessions();

  const lines = [
    '=== Session Cache Report ===',
    '',
    `Total Sessions: ${stats.totalSessions}`,
    `Total Size: ${stats.totalSizeFormatted}`,
    '',
  ];

  if (stats.totalSessions > 0) {
    lines.push(`Oldest Session: ${stats.oldestAgeFormatted} ago`);
    lines.push(`Newest Session: ${stats.newestAgeFormatted} ago`);
    lines.push('');
    lines.push('Recent Sessions:');
    sessions.slice(0, 10).forEach((session, index) => {
      lines.push(
        `${index + 1}. ${session.sessionId.substring(0, 8)}... ` +
          `(${formatDuration(session.age)} ago, ${formatBytes(session.size)})`,
      );
    });

    if (sessions.length > 10) {
      lines.push(`... and ${sessions.length - 10} more`);
    }
  } else {
    lines.push('No cached sessions found.');
  }

  lines.push('');
  lines.push('=== End of Report ===');

  return lines.join('\n');
}

/**
 * 格式化字节数
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的字符串
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
  getCacheDir,
  getCacheFileName,
  cacheSession,
  loadFromCache,
  isCached,
  getCacheInfo,
  listCachedSessions,
  deleteCachedSession,
  clearAllCache,
  isExpired,
  getCacheStats,
  cleanExpiredCache,
  cleanOldCache,
  cleanCacheBySize,
  generateCacheReport,
  formatBytes,
  formatDuration,
};
