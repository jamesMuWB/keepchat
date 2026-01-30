const {
  detectVersionConflict,
  detectConcurrentModificationConflict,
  compareVersions,
} = require('./version');

/**
 * 冲突类型
 */
const ConflictType = {
  NONE: 'none', // 无冲突
  VERSION_MISMATCH: 'version_mismatch', // 版本不匹配
  CONCURRENT_MODIFICATION: 'concurrent_modification', // 并发修改
  DATA_CONFLICT: 'data_conflict', // 数据冲突
  METADATA_CONFLICT: 'metadata_conflict', // 元数据冲突
};

/**
 * 冲突严重程度
 */
const ConflictSeverity = {
  LOW: 'low', // 低：可以自动解决
  MEDIUM: 'medium', // 中：需要用户确认
  HIGH: 'high', // 高：需要手动解决
};

/**
 * 检测会话冲突
 * @param {Object} localSession - 本地会话
 * @param {Object} cloudSession - 云端会话
 * @param {Object} options - 选项
 * @returns {Object} 冲突检测结果
 */
function detectSessionConflict({ localSession, cloudSession, options = {} }) {
  if (!localSession || !cloudSession) {
    return {
      hasConflict: false,
      conflictType: ConflictType.NONE,
      severity: ConflictSeverity.LOW,
      reason: 'missing_session_data',
    };
  }

  const localMeta = localSession.meta || {};
  const cloudMeta = cloudSession.meta || {};
  const lastSyncedVersion = options.lastSyncedVersion || localMeta.lastSyncedVersion;

  // 检测版本冲突
  const versionConflict = detectConcurrentModificationConflict({
    localVersion: localMeta.version || { version: 0, timestamp: localMeta.createdAt },
    cloudVersion: cloudMeta.version || { version: 0, timestamp: cloudMeta.createdAt },
    lastSyncedVersion,
  });

  if (versionConflict.hasConflict) {
    // 并发修改冲突
    return {
      hasConflict: true,
      conflictType: ConflictType.CONCURRENT_MODIFICATION,
      severity: ConflictSeverity.HIGH,
      reason: 'both_sides_modified',
      localSession,
      cloudSession,
      versionConflict,
    };
  }

  // 检测数据冲突
  const dataConflict = detectDataConflict({
    localMessages: localSession.messages || [],
    cloudMessages: cloudSession.messages || [],
  });

  if (dataConflict.hasConflict) {
    return {
      hasConflict: true,
      conflictType: ConflictType.DATA_CONFLICT,
      severity: dataConflict.severity,
      reason: 'data_divergence',
      localSession,
      cloudSession,
      dataConflict,
    };
  }

  // 检测元数据冲突
  const metadataConflict = detectMetadataConflict({
    localMeta,
    cloudMeta,
  });

  if (metadataConflict.hasConflict) {
    return {
      hasConflict: true,
      conflictType: ConflictType.METADATA_CONFLICT,
      severity: ConflictSeverity.LOW,
      reason: 'metadata_divergence',
      localSession,
      cloudSession,
      metadataConflict,
    };
  }

  // 无冲突，需要同步
  return {
    hasConflict: false,
    conflictType: ConflictType.NONE,
    severity: ConflictSeverity.LOW,
    reason: versionConflict.reason,
    localSession,
    cloudSession,
    versionConflict,
    needsSync: versionConflict.needsSync,
    syncDirection: versionConflict.direction,
  };
}

/**
 * 检测数据冲突
 * @param {Array} localMessages - 本地消息
 * @param {Array} cloudMessages - 云端消息
 * @returns {Object} 数据冲突检测结果
 */
function detectDataConflict({ localMessages, cloudMessages }) {
  if (localMessages.length === 0 && cloudMessages.length === 0) {
    return { hasConflict: false, severity: ConflictSeverity.LOW };
  }

  // 检查消息差异
  const localIds = new Set(localMessages.map((m) => m.id));
  const cloudIds = new Set(cloudMessages.map((m) => m.id));

  const onlyLocal = localMessages.filter((m) => !cloudIds.has(m.id));
  const onlyCloud = cloudMessages.filter((m) => !localIds.has(m.id));

  // 检查重叠消息是否有修改
  const modifiedOverlap = [];
  for (const msg of localMessages) {
    const cloudMsg = cloudMessages.find((cm) => cm.id === msg.id);
    if (cloudMsg && cloudMsg.content !== msg.content) {
      modifiedOverlap.push({
        id: msg.id,
        localContent: msg.content,
        cloudContent: cloudMsg.content,
      });
    }
  }

  const hasConflict = onlyLocal.length > 0 || onlyCloud.length > 0 || modifiedOverlap.length > 0;

  let severity = ConflictSeverity.LOW;
  if (modifiedOverlap.length > 0) {
    severity = ConflictSeverity.HIGH;
  } else if (onlyLocal.length > 0 && onlyCloud.length > 0) {
    severity = ConflictSeverity.MEDIUM;
  }

  return {
    hasConflict,
    severity,
    onlyLocalCount: onlyLocal.length,
    onlyCloudCount: onlyCloud.length,
    modifiedOverlapCount: modifiedOverlap.length,
    onlyLocal,
    onlyCloud,
    modifiedOverlap,
  };
}

/**
 * 检测元数据冲突
 * @param {Object} localMeta - 本地元数据
 * @param {Object} cloudMeta - 云端元数据
 * @returns {Object} 元数据冲突检测结果
 */
function detectMetadataConflict({ localMeta, cloudMeta }) {
  const conflicts = [];

  // 检查项目路径
  if (
    localMeta.projectPath &&
    cloudMeta.projectPath &&
    localMeta.projectPath !== cloudMeta.projectPath
  ) {
    conflicts.push({
      field: 'projectPath',
      local: localMeta.projectPath,
      cloud: cloudMeta.projectPath,
    });
  }

  // 检查设备信息
  if (localMeta.device && cloudMeta.device && localMeta.device !== cloudMeta.device) {
    conflicts.push({
      field: 'device',
      local: localMeta.device,
      cloud: cloudMeta.device,
    });
  }

  // 检查消息数量
  if (localMeta.messageCount !== cloudMeta.messageCount) {
    conflicts.push({
      field: 'messageCount',
      local: localMeta.messageCount,
      cloud: cloudMeta.messageCount,
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * 生成冲突报告
 * @param {Object} conflictResult - 冲突检测结果
 * @returns {string} 冲突报告字符串
 */
function generateConflictReport(conflictResult) {
  if (!conflictResult.hasConflict) {
    return 'No conflict detected.';
  }

  const lines = [
    '=== Conflict Report ===',
    '',
    `Type: ${conflictResult.conflictType}`,
    `Severity: ${conflictResult.severity}`,
    `Reason: ${conflictResult.reason}`,
    '',
  ];

  // 添加版本信息
  if (conflictResult.versionConflict) {
    const { localVersion, cloudVersion } = conflictResult.versionConflict;
    lines.push('Versions:');
    lines.push(`  Local: v${localVersion.version}`);
    lines.push(`  Cloud: v${cloudVersion.version}`);
    lines.push('');
  }

  // 添加数据冲突信息
  if (conflictResult.dataConflict) {
    const dc = conflictResult.dataConflict;
    lines.push('Data Conflicts:');
    lines.push(`  Only in local: ${dc.onlyLocalCount} messages`);
    lines.push(`  Only in cloud: ${dc.onlyCloudCount} messages`);
    lines.push(`  Modified overlaps: ${dc.modifiedOverlapCount} messages`);
    lines.push('');
  }

  // 添加元数据冲突信息
  if (conflictResult.metadataConflict) {
    const mc = conflictResult.metadataConflict;
    lines.push('Metadata Conflicts:');
    mc.conflicts.forEach((c) => {
      lines.push(`  ${c.field}:`);
      lines.push(`    Local: ${c.local}`);
      lines.push(`    Cloud: ${c.cloud}`);
    });
    lines.push('');
  }

  lines.push('=== End of Report ===');

  return lines.join('\n');
}

/**
 * 获取推荐的解决策略
 * @param {Object} conflictResult - 冲突检测结果
 * @returns {Array} 推荐的策略列表
 */
function getRecommendedStrategies(conflictResult) {
  if (!conflictResult.hasConflict) {
    return ['sync'];
  }

  const strategies = [];

  switch (conflictResult.conflictType) {
    case ConflictType.CONCURRENT_MODIFICATION:
      strategies.push('keep_local', 'keep_cloud', 'manual_merge');
      break;

    case ConflictType.DATA_CONFLICT:
      if (
        conflictResult.dataConflict.onlyLocalCount > 0 &&
        conflictResult.dataConflict.onlyCloudCount > 0
      ) {
        strategies.push('manual_merge');
      } else if (conflictResult.dataConflict.onlyLocalCount > 0) {
        strategies.push('keep_local', 'manual_merge');
      } else if (conflictResult.dataConflict.onlyCloudCount > 0) {
        strategies.push('keep_cloud', 'manual_merge');
      } else {
        strategies.push('keep_local', 'keep_cloud');
      }
      break;

    case ConflictType.METADATA_CONFLICT:
      strategies.push('keep_local', 'keep_cloud', 'merge_metadata');
      break;

    default:
      strategies.push('keep_local', 'keep_cloud');
      break;
  }

  return strategies;
}

/**
 * 验证是否可以自动解决冲突
 * @param {Object} conflictResult - 冲突检测结果
 * @param {string} strategy - 解决策略
 * @returns {Object} 验证结果
 */
function canAutoResolve(conflictResult, strategy) {
  if (!conflictResult.hasConflict) {
    return { canResolve: true, reason: 'no_conflict' };
  }

  // 中等或高严重程度的冲突不能自动解决
  if (
    conflictResult.severity === ConflictSeverity.MEDIUM ||
    conflictResult.severity === ConflictSeverity.HIGH
  ) {
    return {
      canResolve: false,
      reason: 'requires_manual_intervention',
    };
  }

  // 数据冲突不能自动解决
  if (conflictResult.conflictType === ConflictType.DATA_CONFLICT) {
    return {
      canResolve: false,
      reason: 'data_conflict_requires_review',
    };
  }

  // 元数据冲突可以根据策略自动解决
  if (conflictResult.conflictType === ConflictType.METADATA_CONFLICT) {
    if (strategy === 'keep_local' || strategy === 'keep_cloud') {
      return { canResolve: true, reason: 'metadata_override_allowed' };
    }
  }

  return {
    canResolve: false,
    reason: 'cannot_auto_resolve',
  };
}

module.exports = {
  ConflictType,
  ConflictSeverity,
  detectSessionConflict,
  detectDataConflict,
  detectMetadataConflict,
  generateConflictReport,
  getRecommendedStrategies,
  canAutoResolve,
};
