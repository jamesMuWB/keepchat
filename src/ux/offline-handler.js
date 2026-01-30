/**
 * 离线检测和优雅降级模块
 * 检测网络连接状态，在离线时提供友好的降级体验
 */

const { displayInfo, displayWarning } = require('./error-handler');

/**
 * 网络状态
 */
const NetworkStatus = {
  ONLINE: 'online', // 在线
  OFFLINE: 'offline', // 离线
  UNKNOWN: 'unknown', // 未知
};

/**
 * 缓存的操作结果
 */
const operationCache = new Map();

/**
 * 是否启用离线模式
 */
let offlineModeEnabled = false;

/**
 * 检测网络连接状态
 * @param {Object} config - 七牛云配置
 * @returns {Promise<string>} 网络状态
 */
async function checkNetworkStatus(config) {
  try {
    // 尝试连接七牛云 API
    const { getBucketInfo } = require('../qiniu/usage');

    // 设置超时
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    // 尝试获取 Bucket 信息
    await Promise.race([getBucketInfo(config), timeoutPromise]);

    offlineModeEnabled = false;
    return NetworkStatus.ONLINE;
  } catch (error) {
    // 检查是否是网络错误
    if (isNetworkError(error)) {
      offlineModeEnabled = true;
      return NetworkStatus.OFFLINE;
    }
    // 其他错误说明在线但认证失败等
    offlineModeEnabled = false;
    return NetworkStatus.ONLINE;
  }
}

/**
 * 判断是否是网络错误
 * @param {Error} error - 错误对象
 * @returns {boolean} 是否是网络错误
 */
function isNetworkError(error) {
  const message = error.message?.toLowerCase() || '';
  const code = error.code?.toLowerCase() || '';

  return (
    code === 'enotfound' ||
    code === 'econnrefused' ||
    code === 'etimedout' ||
    code === 'eai_again' ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('getaddrinfo')
  );
}

/**
 * 在执行操作前检查网络状态
 * @param {Object} config - 七牛云配置
 * @param {string} operation - 操作名称
 * @returns {Promise<boolean>} 是否可以继续执行
 */
async function checkBeforeOperation(config, operation) {
  const status = await checkNetworkStatus(config);

  if (status === NetworkStatus.OFFLINE) {
    displayOfflineWarning(operation);
    return false;
  }

  return true;
}

/**
 * 显示离线警告
 * @param {string} operation - 操作名称
 */
function displayOfflineWarning(operation) {
  displayWarning(
    `You are currently offline. Cannot perform operation: ${operation}\n` +
      'Please check your internet connection and try again.',
  );
}

/**
 * 显示离线模式提示
 */
function displayOfflineModeInfo() {
  displayInfo(
    'Offline mode is enabled. Cloud sync features are paused.\n' +
      'Your local session data is still available and editable.\n' +
      'Changes will be synced when you go back online.',
  );
}

/**
 * 包装操作，支持离线检测
 * @param {Function} operation - 要执行的操作
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 选项
 * @returns {Promise<any>} 操作结果
 */
async function withOfflineCheck(operation, config, options = {}) {
  const { operationName = 'Operation', allowOffline = false, fallback = null } = options;

  // 检查网络状态
  const canProceed = await checkBeforeOperation(config, operationName);

  if (!canProceed) {
    if (allowOffline && fallback) {
      // 允许离线模式，执行降级操作
      return await fallback();
    }
    throw new Error(`Cannot perform ${operationName} while offline`);
  }

  // 在线，执行正常操作
  return await operation();
}

/**
 * 缓存操作以供离线时使用
 * @param {string} key - 缓存键
 * @param {any} data - 要缓存的数据
 */
function cacheOperation(key, data) {
  operationCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

/**
 * 获取缓存的操作
 * @param {string} key - 缓存键
 * @param {number} maxAge - 最大缓存时间（毫秒）
 * @returns {any|null} 缓存的数据
 */
function getCachedOperation(key, maxAge = 60000) {
  const cached = operationCache.get(key);

  if (!cached) {
    return null;
  }

  const age = Date.now() - cached.timestamp;

  if (age > maxAge) {
    operationCache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * 清除缓存的操作
 * @param {string} key - 缓存键
 */
function clearCachedOperation(key) {
  operationCache.delete(key);
}

/**
 * 清除所有缓存
 */
function clearAllCache() {
  operationCache.clear();
}

/**
 * 获取缓存大小
 * @returns {number} 缓存中的操作数量
 */
function getCacheSize() {
  return operationCache.size;
}

/**
 * 执行带重试的操作
 * @param {Function} operation - 要执行的操作
 * @param {Object} config - 七牛云配置
 * @param {Object} options - 选项
 * @returns {Promise<any>} 操作结果
 */
async function withRetry(operation, config, options = {}) {
  const { maxRetries = 3, retryDelay = 1000, operationName = 'Operation' } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 检查网络状态
      const status = await checkNetworkStatus(config);

      if (status === NetworkStatus.OFFLINE) {
        throw new Error('Network is offline');
      }

      // 执行操作
      return await operation();
    } catch (error) {
      lastError = error;

      // 如果是网络错误且还有重试机会
      if (isNetworkError(error) && attempt < maxRetries) {
        console.log(
          `\n⚠️  ${operationName} failed (attempt ${attempt + 1}/${maxRetries + 1}). ` +
            `Retrying in ${retryDelay}ms...`,
        );

        // 等待后重试
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      // 其他错误或已达到最大重试次数
      throw error;
    }
  }

  throw lastError;
}

/**
 * 启用离线模式
 */
function enableOfflineMode() {
  offlineModeEnabled = true;
  displayOfflineModeInfo();
}

/**
 * 禁用离线模式
 */
function disableOfflineMode() {
  offlineModeEnabled = false;
  displayInfo('Offline mode disabled. Cloud sync features are now active.');
}

/**
 * 检查是否处于离线模式
 * @returns {boolean} 是否处于离线模式
 */
function isOfflineMode() {
  return offlineModeEnabled;
}

/**
 * 显示在线状态恢复提示
 */
function displayOnlineRestored() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ Connection Restored                                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                              ║
║  You are back online.                                       ║
║  Cloud sync features are now available.                     ║
║                                                              ║
║  Pending changes will be synced automatically.              ║
║  You can also manually sync with /sync-session.             ║
║                                                              ║
╚═══════════════════════════════════════════════════════════╝
`);
}

/**
 * 监听网络状态变化
 * @param {Function} onOnline - 在线回调
 * @param {Function} onOffline - 离线回调
 * @returns {Function} 停止监听的函数
 */
function watchNetworkStatus(onOnline, onOffline) {
  // Node.js 环境下的网络状态监听
  let isOnline = true;

  // 检查网络状态的定时器
  const interval = setInterval(async () => {
    try {
      // 尝试连接到一个可靠的地址
      const dns = require('dns');
      await new Promise((resolve, reject) => {
        dns.lookup('qiniu.com', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!isOnline) {
        isOnline = true;
        if (onOnline) onOnline();
      }
    } catch (error) {
      if (isOnline) {
        isOnline = false;
        if (onOffline) onOffline();
      }
    }
  }, 30000); // 每 30 秒检查一次

  // 返回停止监听的函数
  return () => clearInterval(interval);
}

/**
 * 获取网络状态摘要
 * @param {string} status - 网络状态
 * @returns {string} 状态摘要
 */
function getStatusSummary(status) {
  const summaries = {
    [NetworkStatus.ONLINE]: '🟢 Online - Cloud sync features available',
    [NetworkStatus.OFFLINE]: '🔴 Offline - Only local operations available',
    [NetworkStatus.UNKNOWN]: '🟡 Unknown - Cannot determine network status',
  };

  return summaries[status] || summaries[NetworkStatus.UNKNOWN];
}

module.exports = {
  NetworkStatus,
  checkNetworkStatus,
  isNetworkError,
  checkBeforeOperation,
  displayOfflineWarning,
  displayOfflineModeInfo,
  withOfflineCheck,
  cacheOperation,
  getCachedOperation,
  clearCachedOperation,
  clearAllCache,
  getCacheSize,
  withRetry,
  enableOfflineMode,
  disableOfflineMode,
  isOfflineMode,
  displayOnlineRestored,
  watchNetworkStatus,
  getStatusSummary,
};
