const { ConflictType, ConflictSeverity, detectSessionConflict } = require('./conflict-detector');
const { mergeVersion, incrementVersion } = require('./version');

/**
 * 冲突解决策略
 */
const ResolutionStrategy = {
  KEEP_LOCAL: 'keep_local', // 保留本地版本
  KEEP_CLOUD: 'keep_cloud', // 保留云端版本
  MANUAL_MERGE: 'manual_merge', // 手动合并
  AUTO_MERGE: 'auto_merge', // 自动合并
};

/**
 * 生成冲突详情
 * @param {Object} conflictResult - 冲突检测结果
 * @returns {Object} 冲突详情
 */
function generateConflictDetails(conflictResult) {
  if (!conflictResult.hasConflict) {
    return {
      hasConflict: false,
      message: 'No conflict detected. Sessions are in sync.',
    };
  }

  const details = {
    hasConflict: true,
    type: conflictResult.conflictType,
    severity: conflictResult.severity,
    reason: conflictResult.reason,
    timestamp: new Date().toISOString(),
  };

  // 版本信息
  if (conflictResult.versionConflict) {
    details.versions = {
      local: conflictResult.versionConflict.localVersion,
      cloud: conflictResult.versionConflict.cloudVersion,
      lastSynced: conflictResult.versionConflict.lastSyncedVersion,
    };
  }

  // 数据冲突详情
  if (conflictResult.dataConflict) {
    const dc = conflictResult.dataConflict;

    details.data = {
      onlyLocal: dc.onlyLocal.map((m) => ({
        id: m.id,
        role: m.role,
        timestamp: m.createdAt,
        preview: m.content.substring(0, 100),
      })),
      onlyCloud: dc.onlyCloud.map((m) => ({
        id: m.id,
        role: m.role,
        timestamp: m.createdAt,
        preview: m.content.substring(0, 100),
      })),
      modifiedOverlap: dc.modifiedOverlap.map((m) => ({
        id: m.id,
        role: m.role,
        timestamp: conflictResult.localSession.messages.find((lm) => lm.id === m.id)?.createdAt,
        localPreview: m.localContent.substring(0, 100),
        cloudPreview: m.cloudContent.substring(0, 100),
      })),
    };
  }

  // 元数据冲突详情
  if (conflictResult.metadataConflict) {
    details.metadata = {
      conflicts: conflictResult.metadataConflict.conflicts,
    };
  }

  // 会话摘要
  details.sessionSummaries = {
    local: summarizeSession(conflictResult.localSession),
    cloud: summarizeSession(conflictResult.cloudSession),
  };

  return details;
}

/**
 * 生成会话摘要
 * @param {Object} session - 会话
 * @returns {Object} 会话摘要
 */
function summarizeSession(session) {
  if (!session) {
    return null;
  }

  const meta = session.meta || {};
  const messages = session.messages || [];

  return {
    sessionId: meta.sessionId,
    version: meta.version?.version || 1,
    messageCount: meta.messageCount || messages.length,
    lastUpdated: meta.updatedAt,
    device: meta.device,
    projectPath: meta.projectPath || session.context?.projectPath,
    preview:
      messages.length > 0 ? messages[messages.length - 1].content.substring(0, 200) : 'No messages',
  };
}

/**
 * 格式化冲突详情为可读文本
 * @param {Object} conflictDetails - 冲突详情
 * @returns {string} 格式化的文本
 */
function formatConflictDetails(conflictDetails) {
  if (!conflictDetails.hasConflict) {
    return conflictDetails.message;
  }

  const lines = [
    '=== Conflict Details ===',
    '',
    `Type: ${conflictDetails.type}`,
    `Severity: ${conflictDetails.severity}`,
    `Reason: ${conflictDetails.reason}`,
    `Detected at: ${new Date(conflictDetails.timestamp).toLocaleString()}`,
    '',
  ];

  // 版本信息
  if (conflictDetails.versions) {
    const v = conflictDetails.versions;
    lines.push('Version Information:');
    lines.push(`  Local: v${v.local.version} (${new Date(v.local.timestamp).toLocaleString()})`);
    lines.push(`  Cloud: v${v.cloud.version} (${new Date(v.cloud.timestamp).toLocaleString()})`);
    if (v.lastSynced) {
      lines.push(`  Last synced: v${v.lastSynced.version}`);
    }
    lines.push('');
  }

  // 会话摘要对比
  if (conflictDetails.sessionSummaries) {
    const ss = conflictDetails.sessionSummaries;
    lines.push('Session Summaries:');
    lines.push('  Local Session:');
    lines.push(`    ID: ${ss.local.sessionId}`);
    lines.push(`    Messages: ${ss.local.messageCount}`);
    lines.push(`    Device: ${ss.local.device}`);
    lines.push(`    Path: ${ss.local.projectPath || 'N/A'}`);
    lines.push(`    Preview: ${ss.local.preview.substring(0, 50)}...`);
    lines.push('');
    lines.push('  Cloud Session:');
    lines.push(`    ID: ${ss.cloud.sessionId}`);
    lines.push(`    Messages: ${ss.cloud.messageCount}`);
    lines.push(`    Device: ${ss.cloud.device}`);
    lines.push(`    Path: ${ss.cloud.projectPath || 'N/A'}`);
    lines.push(`    Preview: ${ss.cloud.preview.substring(0, 50)}...`);
    lines.push('');
  }

  // 数据冲突
  if (conflictDetails.data) {
    const d = conflictDetails.data;
    lines.push('Data Conflicts:');
    lines.push(`  Only in local: ${d.onlyLocal.length} messages`);
    lines.push(`  Only in cloud: ${d.onlyCloud.length} messages`);
    lines.push(`  Modified overlaps: ${d.modifiedOverlap.length} messages`);
    lines.push('');

    if (d.modifiedOverlap.length > 0) {
      lines.push('Modified Overlaps:');
      d.modifiedOverlap.forEach((m, i) => {
        lines.push(`  ${i + 1}. Message ${m.id}`);
        lines.push(`     Local: ${m.localPreview}`);
        lines.push(`     Cloud: ${m.cloudPreview}`);
      });
      lines.push('');
    }
  }

  // 元数据冲突
  if (conflictDetails.metadata) {
    const m = conflictDetails.metadata;
    lines.push('Metadata Conflicts:');
    m.conflicts.forEach((c) => {
      lines.push(`  ${c.field}:`);
      lines.push(`    Local: ${c.local}`);
      lines.push(`    Cloud: ${c.cloud}`);
    });
    lines.push('');
  }

  lines.push('=== End of Details ===');

  return lines.join('\n');
}

/**
 * 解决冲突：保留本地版本
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} options - 选项
 * @returns {Object} 解决结果
 */
function resolveKeepLocal({ conflictResult, options = {} }) {
  if (!conflictResult.hasConflict) {
    throw new Error('No conflict to resolve');
  }

  const localSession = conflictResult.localSession;
  const newVersion = incrementVersion({
    currentVersion: localSession.meta.version,
    author: 'keep_local_resolution',
  });

  const resolved = {
    ...localSession,
    meta: {
      ...localSession.meta,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      conflictResolved: true,
      resolutionStrategy: ResolutionStrategy.KEEP_LOCAL,
    },
  };

  return {
    success: true,
    strategy: ResolutionStrategy.KEEP_LOCAL,
    resolvedSession: resolved,
    overwrittenSession: conflictResult.cloudSession,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 解决冲突：保留云端版本
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} options - 选项
 * @returns {Object} 解决结果
 */
function resolveKeepCloud({ conflictResult, options = {} }) {
  if (!conflictResult.hasConflict) {
    throw new Error('No conflict to resolve');
  }

  const cloudSession = conflictResult.cloudSession;
  const newVersion = incrementVersion({
    currentVersion: cloudSession.meta.version,
    author: 'keep_cloud_resolution',
  });

  const resolved = {
    ...cloudSession,
    meta: {
      ...cloudSession.meta,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      conflictResolved: true,
      resolutionStrategy: ResolutionStrategy.KEEP_CLOUD,
    },
  };

  return {
    success: true,
    strategy: ResolutionStrategy.KEEP_CLOUD,
    resolvedSession: resolved,
    overwrittenSession: conflictResult.localSession,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 解决冲突：手动合并
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} options - 选项
 * @returns {Object} 解决结果
 */
function resolveManualMerge({ conflictResult, options = {} }) {
  if (!conflictResult.hasConflict) {
    throw new Error('No conflict to resolve');
  }

  const { localSession, cloudSession } = conflictResult;

  // 合并版本号
  const newVersion = mergeVersion({
    localVersion: localSession.meta.version,
    remoteVersion: cloudSession.meta.version,
    resolutionStrategy: ResolutionStrategy.MANUAL_MERGE,
  });

  // 如果有用户提供的合并结果，使用它
  if (options.mergedSession) {
    const resolved = {
      ...options.mergedSession,
      meta: {
        ...options.mergedSession.meta,
        version: newVersion,
        updatedAt: new Date().toISOString(),
        conflictResolved: true,
        resolutionStrategy: ResolutionStrategy.MANUAL_MERGE,
      },
    };

    return {
      success: true,
      strategy: ResolutionStrategy.MANUAL_MERGE,
      resolvedSession: resolved,
      timestamp: new Date().toISOString(),
    };
  }

  // 返回合并预览（需要用户手动完成合并）
  return {
    success: false,
    strategy: ResolutionStrategy.MANUAL_MERGE,
    requiresUserInput: true,
    mergePreview: {
      local: localSession,
      cloud: cloudSession,
      version: newVersion,
    },
    message: 'Manual merge requires user input to complete',
  };
}

/**
 * 应用解决策略
 * @param {Object} conflictResult - 冲突检测结果
 * @param {string} strategy - 解决策略
 * @param {Object} options - 选项
 * @returns {Object} 解决结果
 */
function applyResolutionStrategy({ conflictResult, strategy, options = {} }) {
  if (!conflictResult.hasConflict) {
    throw new Error('No conflict to resolve');
  }

  switch (strategy) {
    case ResolutionStrategy.KEEP_LOCAL:
      return resolveKeepLocal({ conflictResult, options });
    case ResolutionStrategy.KEEP_CLOUD:
      return resolveKeepCloud({ conflictResult, options });
    case ResolutionStrategy.MANUAL_MERGE:
      return resolveManualMerge({ conflictResult, options });
    default:
      throw new Error(`Unknown resolution strategy: ${strategy}`);
  }
}

/**
 * 验证解决结果
 * @param {Object} resolutionResult - 解决结果
 * @returns {Object} 验证结果
 */
function validateResolutionResult(resolutionResult) {
  const errors = [];

  if (!resolutionResult.success) {
    errors.push('Resolution was not successful');
  }

  if (!resolutionResult.resolvedSession) {
    errors.push('Resolved session is missing');
  } else {
    if (!resolutionResult.resolvedSession.meta) {
      errors.push('Resolved session metadata is missing');
    } else if (!resolutionResult.resolvedSession.meta.version) {
      errors.push('Resolved session version is missing');
    }

    if (!resolutionResult.resolvedSession.messages) {
      errors.push('Resolved session messages are missing');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  ResolutionStrategy,
  generateConflictDetails,
  summarizeSession,
  formatConflictDetails,
  resolveKeepLocal,
  resolveKeepCloud,
  resolveManualMerge,
  applyResolutionStrategy,
  validateResolutionResult,
};
