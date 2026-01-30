/**
 * 版本号管理模块
 * 用于管理会话的版本号，支持冲突检测和解决
 */

/**
 * 创建初始版本号
 * @returns {Object} 初始版本信息
 */
function createInitialVersion() {
  return {
    version: 1,
    timestamp: new Date().toISOString(),
    device: getDeviceId(),
    author: 'system',
  };
}

/**
 * 递增版本号
 * @param {Object} currentVersion - 当前版本信息
 * @param {string} author - 作者 (可选)
 * @returns {Object} 新版本信息
 */
function incrementVersion({ currentVersion, author = 'system' }) {
  if (!currentVersion) {
    return createInitialVersion();
  }

  return {
    version: currentVersion.version + 1,
    timestamp: new Date().toISOString(),
    device: getDeviceId(),
    author,
    previousVersion: currentVersion.version,
    previousTimestamp: currentVersion.timestamp,
  };
}

/**
 * 同步版本号 (从云端更新本地版本)
 * @param {Object} cloudVersion - 云端版本信息
 * @returns {Object} 同步后的版本信息
 */
function syncVersion({ cloudVersion }) {
  return {
    version: cloudVersion.version,
    timestamp: cloudVersion.timestamp,
    device: cloudVersion.device,
    author: cloudVersion.author,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * 合并版本号 (用于冲突解决后)
 * @param {Object} localVersion - 本地版本
 * @param {Object} remoteVersion - 远程版本
 * @param {string} resolutionStrategy - 解决策略
 * @returns {Object} 合并后的版本信息
 */
function mergeVersion({ localVersion, remoteVersion, resolutionStrategy }) {
  const baseVersion = Math.max(localVersion.version, remoteVersion.version);

  return {
    version: baseVersion + 1,
    timestamp: new Date().toISOString(),
    device: getDeviceId(),
    author: 'merged',
    resolution: {
      strategy: resolutionStrategy,
      localVersion: localVersion.version,
      remoteVersion: remoteVersion.version,
    },
    previousVersions: {
      local: localVersion,
      remote: remoteVersion,
    },
  };
}

/**
 * 比较两个版本号
 * @param {Object} version1 - 版本1
 * @param {Object} version2 - 版本2
 * @returns {number} 1 (version1 > version2), -1 (version1 < version2), 0 (相等)
 */
function compareVersions({ version1, version2 }) {
  if (version1.version > version2.version) {
    return 1;
  } else if (version1.version < version2.version) {
    return -1;
  }

  // 版本号相同，比较时间戳
  const time1 = new Date(version1.timestamp).getTime();
  const time2 = new Date(version2.timestamp).getTime();

  if (time1 > time2) {
    return 1;
  } else if (time1 < time2) {
    return -1;
  }

  return 0;
}

/**
 * 检测版本冲突
 * @param {Object} localVersion - 本地版本
 * @param {Object} cloudVersion - 云端版本
 * @returns {Object} 冲突检测结果
 */
function detectVersionConflict({ localVersion, cloudVersion }) {
  if (!localVersion || !cloudVersion) {
    return {
      hasConflict: false,
      reason: 'missing_version',
      localVersion,
      cloudVersion,
    };
  }

  const comparison = compareVersions({
    version1: localVersion,
    version2: cloudVersion,
  });

  // 版本相同，没有冲突
  if (comparison === 0) {
    return {
      hasConflict: false,
      reason: 'same_version',
      localVersion,
      cloudVersion,
      synced: true,
    };
  }

  // 云端版本更新，需要同步
  if (comparison === -1) {
    return {
      hasConflict: false,
      reason: 'cloud_newer',
      localVersion,
      cloudVersion,
      needsSync: true,
      direction: 'pull',
    };
  }

  // 本地版本更新，需要推送
  if (comparison === 1) {
    return {
      hasConflict: false,
      reason: 'local_newer',
      localVersion,
      cloudVersion,
      needsSync: true,
      direction: 'push',
    };
  }

  return {
    hasConflict: false,
    localVersion,
    cloudVersion,
  };
}

/**
 * 检测并发修改冲突
 * @param {Object} localVersion - 本地版本
 * @param {Object} cloudVersion - 云端版本
 * @param {number} lastSyncedVersion - 上次同步时的版本号
 * @returns {Object} 冲突检测结果
 */
function detectConcurrentModificationConflict({ localVersion, cloudVersion, lastSyncedVersion }) {
  if (!lastSyncedVersion) {
    // 没有同步历史，可能是首次同步
    return {
      hasConflict: false,
      reason: 'first_sync',
      needsSync: true,
    };
  }

  const comparison = compareVersions({
    version1: localVersion,
    version2: cloudVersion,
  });

  // 如果两个版本都大于上次同步版本，说明双方都修改了
  const localModified = localVersion.version > lastSyncedVersion;
  const cloudModified = cloudVersion.version > lastSyncedVersion;

  if (localModified && cloudModified && comparison !== 0) {
    return {
      hasConflict: true,
      reason: 'concurrent_modification',
      localVersion,
      cloudVersion,
      lastSyncedVersion,
    };
  }

  return detectVersionConflict({ localVersion, cloudVersion });
}

/**
 * 验证版本号的有效性
 * @param {Object} version - 版本信息
 * @returns {Object} 验证结果
 */
function validateVersion(version) {
  const errors = [];

  if (!version) {
    errors.push('version is required');
  } else {
    if (typeof version.version !== 'number' || version.version < 1) {
      errors.push('version must be a positive number');
    }

    if (!version.timestamp) {
      errors.push('timestamp is required');
    } else if (isNaN(new Date(version.timestamp).getTime())) {
      errors.push('invalid timestamp format');
    }

    if (!version.device) {
      errors.push('device identifier is required');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 格式化版本号显示
 * @param {Object} version - 版本信息
 * @returns {string} 格式化后的字符串
 */
function formatVersion(version) {
  if (!version) {
    return 'N/A';
  }

  const time = new Date(version.timestamp).toLocaleString();
  return `v${version.version} (${time})`;
}

/**
 * 获取设备 ID
 * @returns {string} 设备唯一标识符
 */
function getDeviceId() {
  const os = require('os');
  const crypto = require('crypto');

  // 使用机器信息生成设备 ID
  const hostname = os.hostname();
  const platform = os.platform();
  const arch = os.arch();

  const hash = crypto
    .createHash('sha256')
    .update(`${hostname}-${platform}-${arch}`)
    .digest('hex')
    .substring(0, 12);

  return `${platform}-${hash}`;
}

/**
 * 创建版本历史条目
 * @param {Object} version - 版本信息
 * @param {string} action - 动作 (created, synced, merged, etc.)
 * @returns {Object} 历史条目
 */
function createVersionHistoryEntry({ version, action }) {
  return {
    version: version.version,
    timestamp: version.timestamp,
    device: version.device,
    author: version.author,
    action,
    recordedAt: new Date().toISOString(),
  };
}

/**
 * 计算版本差异
 * @param {Object} version1 - 版本1
 * @param {Object} version2 - 版本2
 * @returns {Object} 版本差异信息
 */
function calculateVersionDifference({ version1, version2 }) {
  const comparison = compareVersions({
    version1,
    version2,
  });

  const timeDiff = new Date(version1.timestamp).getTime() - new Date(version2.timestamp).getTime();

  return {
    comparison,
    versionDiff: version1.version - version2.version,
    timeDiff,
    timeDiffFormatted: formatDuration(Math.abs(timeDiff)),
    versionsBehind: comparison === -1 ? version2.version - version1.version : 0,
    versionsAhead: comparison === 1 ? version1.version - version2.version : 0,
  };
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
  createInitialVersion,
  incrementVersion,
  syncVersion,
  mergeVersion,
  compareVersions,
  detectVersionConflict,
  detectConcurrentModificationConflict,
  validateVersion,
  formatVersion,
  getDeviceId,
  createVersionHistoryEntry,
  calculateVersionDifference,
};
