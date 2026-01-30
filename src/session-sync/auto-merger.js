const { detectDataConflict } = require('./conflict-detector');
const { mergeVersion } = require('./version');
const { mergeSessions, mergeContexts } = require('./merger');

/**
 * 检查是否可以自动合并冲突
 * @param {Object} conflictResult - 冲突检测结果
 * @returns {Object} 自动合并评估结果
 */
function canAutoMerge(conflictResult) {
  if (!conflictResult.hasConflict) {
    return {
      canAutoMerge: false,
      reason: 'no_conflict',
    };
  }

  // 数据冲突才考虑自动合并
  if (!conflictResult.dataConflict) {
    return {
      canAutoMerge: false,
      reason: 'no_data_conflict',
    };
  }

  const dc = conflictResult.dataConflict;

  // 如果有修改重叠的消息，不能自动合并
  if (dc.modifiedOverlapCount > 0) {
    return {
      canAutoMerge: false,
      reason: 'has_modified_overlaps',
      details: {
        modifiedOverlapCount: dc.modifiedOverlapCount,
      },
    };
  }

  // 如果双方都有新消息，需要手动合并
  if (dc.onlyLocalCount > 0 && dc.onlyCloudCount > 0) {
    return {
      canAutoMerge: false,
      reason: 'both_sides_have_new_messages',
      details: {
        onlyLocalCount: dc.onlyLocalCount,
        onlyCloudCount: dc.onlyCloudCount,
      },
    };
  }

  // 只有本地有新消息：可以追加本地消息
  if (dc.onlyLocalCount > 0 && dc.onlyCloudCount === 0) {
    return {
      canAutoMerge: true,
      strategy: 'append_local',
      reason: 'only_local_has_new_messages',
      details: {
        newMessageCount: dc.onlyLocalCount,
      },
    };
  }

  // 只有云端有新消息：可以追加云端消息
  if (dc.onlyCloudCount > 0 && dc.onlyLocalCount === 0) {
    return {
      canAutoMerge: true,
      strategy: 'append_cloud',
      reason: 'only_cloud_has_new_messages',
      details: {
        newMessageCount: dc.onlyCloudCount,
      },
    };
  }

  return {
    canAutoMerge: false,
    reason: 'unknown_conflict_pattern',
  };
}

/**
 * 执行自动合并
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} options - 选项
 * @returns {Object} 合并结果
 */
function performAutoMerge({ conflictResult, options = {} }) {
  const assessment = canAutoMerge(conflictResult);

  if (!assessment.canAutoMerge) {
    throw new Error(`Cannot auto-merge: ${assessment.reason}`);
  }

  const { localSession, cloudSession } = conflictResult;

  let merged;
  let strategy = assessment.strategy;

  if (strategy === 'append_local') {
    // 追加本地消息到云端会话
    merged = mergeSessions({
      source: localSession,
      target: cloudSession,
    });
  } else if (strategy === 'append_cloud') {
    // 追加云端消息到本地会话
    merged = mergeSessions({
      source: cloudSession,
      target: localSession,
    });
  }

  // 合并版本号
  const newVersion = mergeVersion({
    localVersion: localSession.meta.version,
    remoteVersion: cloudSession.meta.version,
    resolutionStrategy: `auto_merge_${strategy}`,
  });

  // 更新元数据
  merged.meta = {
    ...merged.meta,
    version: newVersion,
    updatedAt: new Date().toISOString(),
    conflictResolved: true,
    resolutionStrategy: `auto_merge_${strategy}`,
    autoMerged: true,
  };

  return {
    success: true,
    strategy,
    mergedSession: merged,
    assessment,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 智能合并 - 尝试自动合并，否则提供预览
 * @param {Object} conflictResult - 冲突检测结果
 * @param {Object} options - 选项
 * @returns {Object} 合并结果或预览
 */
function smartMerge({ conflictResult, options = {} }) {
  const assessment = canAutoMerge(conflictResult);

  if (!assessment.canAutoMerge) {
    // 不能自动合并，提供手动合并选项
    return {
      success: false,
      autoMergePossible: false,
      reason: assessment.reason,
      assessment,
      requiresManualIntervention: true,
      recommendedActions: getRecommendedActions(assessment, conflictResult),
    };
  }

  // 可以自动合并
  try {
    const mergeResult = performAutoMerge({ conflictResult, options });
    return {
      success: true,
      autoMergePossible: true,
      autoMerged: true,
      ...mergeResult,
    };
  } catch (error) {
    return {
      success: false,
      autoMergePossible: true,
      error: error.message,
      requiresManualIntervention: true,
    };
  }
}

/**
 * 获取推荐的解决动作
 * @param {Object} assessment - 自动合并评估结果
 * @param {Object} conflictResult - 冲突检测结果
 * @returns {Array} 推荐的动作列表
 */
function getRecommendedActions(assessment, conflictResult) {
  const actions = [];

  if (assessment.reason === 'has_modified_overlaps') {
    actions.push({
      type: 'manual_merge',
      description: 'Review and manually resolve modified messages',
      priority: 'high',
    });
  }

  if (assessment.reason === 'both_sides_have_new_messages') {
    actions.push({
      type: 'manual_merge',
      description: 'Manually merge messages from both sides',
      priority: 'high',
    });
    actions.push({
      type: 'keep_local',
      description: 'Keep local version (discard cloud changes)',
      priority: 'medium',
    });
    actions.push({
      type: 'keep_cloud',
      description: 'Keep cloud version (discard local changes)',
      priority: 'medium',
    });
  }

  if (conflictResult.conflictType === 'metadata_conflict') {
    actions.push({
      type: 'resolve_metadata',
      description: 'Resolve metadata conflicts',
      priority: 'low',
    });
  }

  return actions.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * 生成合并预览
 * @param {Object} conflictResult - 冲突检测结果
 * @param {string} strategy - 合并策略
 * @returns {Object} 合并预览
 */
function generateMergePreview({ conflictResult, strategy }) {
  const { localSession, cloudSession } = conflictResult;

  let preview;

  switch (strategy) {
    case 'append_local':
      preview = mergeSessions({
        source: localSession,
        target: cloudSession,
      });
      break;

    case 'append_cloud':
      preview = mergeSessions({
        source: cloudSession,
        target: localSession,
      });
      break;

    default:
      throw new Error(`Unknown merge strategy: ${strategy}`);
  }

  return {
    strategy,
    previewSession: preview,
    summary: {
      localMessageCount: localSession.messages?.length || 0,
      cloudMessageCount: cloudSession.messages?.length || 0,
      mergedMessageCount: preview.messages?.length || 0,
      addedCount:
        (preview.messages?.length || 0) -
        Math.max(localSession.messages?.length || 0, cloudSession.messages?.length || 0),
    },
  };
}

/**
 * 验证合并结果
 * @param {Object} mergeResult - 合并结果
 * @returns {Object} 验证结果
 */
function validateMergeResult(mergeResult) {
  const errors = [];
  const warnings = [];

  if (!mergeResult.success) {
    errors.push('Merge was not successful');
    return { valid: false, errors, warnings };
  }

  if (!mergeResult.mergedSession) {
    errors.push('Merged session is missing');
  } else {
    const session = mergeResult.mergedSession;

    // 验证元数据
    if (!session.meta) {
      errors.push('Session metadata is missing');
    } else {
      if (!session.meta.version) {
        errors.push('Session version is missing');
      }

      if (!session.autoMerged) {
        warnings.push('Session may not have been auto-merged');
      }
    }

    // 验证消息
    if (!session.messages || session.messages.length === 0) {
      warnings.push('Session has no messages');
    }

    // 验证上下文
    if (!session.context) {
      warnings.push('Session context is missing');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  canAutoMerge,
  performAutoMerge,
  smartMerge,
  getRecommendedActions,
  generateMergePreview,
  validateMergeResult,
};
