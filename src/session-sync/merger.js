const crypto = require('crypto');

/**
 * 合并策略类型
 */
const MergeStrategy = {
  REPLACE: 'replace', // 替换当前会话
  APPEND: 'append', // 追加到当前会话
  MERGE: 'merge', // 智能合并
};

/**
 * 会话状态
 */
const SessionState = {
  EMPTY: 'empty', // 空会话
  ACTIVE: 'active', // 有消息的会话
};

/**
 * 检测会话状态
 * @param {Array} messages - 会话消息列表
 * @returns {string} 会话状态
 */
function detectSessionState(messages) {
  if (!messages || messages.length === 0) {
    return SessionState.EMPTY;
  }
  return SessionState.ACTIVE;
}

/**
 * 比较两个会话
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @returns {Object} 比较结果
 */
function compareSessions({ source, target }) {
  const sourceMessages = source.messages || [];
  const targetMessages = target.messages || [];

  return {
    sourceCount: sourceMessages.length,
    targetCount: targetMessages.length,
    sourceLastUpdated: source.meta?.updatedAt,
    targetLastUpdated: target.meta?.updatedAt,
    hasOverlap: detectMessageOverlap({ sourceMessages, targetMessages }),
  };
}

/**
 * 检测消息重叠
 * @param {Array} sourceMessages - 源消息列表
 * @param {Array} targetMessages - 目标消息列表
 * @returns {boolean} 是否有重叠
 */
function detectMessageOverlap({ sourceMessages, targetMessages }) {
  const sourceIds = new Set(sourceMessages.map((m) => m.id));
  return targetMessages.some((msg) => sourceIds.has(msg.id));
}

/**
 * 推荐合并策略
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @returns {Object} 推荐的策略和理由
 */
function recommendStrategy({ source, target }) {
  const state = detectSessionState(target.messages);

  if (state === SessionState.EMPTY) {
    return {
      strategy: MergeStrategy.REPLACE,
      reason: 'target session is empty',
      canAppend: false,
      canMerge: false,
    };
  }

  const comparison = compareSessions({ source, target });

  // 检查是否有时间重叠
  const sourceTime = new Date(source.meta?.updatedAt);
  const targetTime = new Date(target.meta?.updatedAt);
  const timeDiff = Math.abs(sourceTime - targetTime);

  if (comparison.hasOverlap) {
    // 有消息重叠，需要手动合并
    return {
      strategy: MergeStrategy.MERGE,
      reason: 'sessions have overlapping messages',
      canReplace: true,
      canAppend: false,
      canMerge: true,
      warning: 'Some messages may be duplicated if not merged carefully',
    };
  }

  // 没有重叠，可以追加
  if (sourceTime > targetTime) {
    return {
      strategy: MergeStrategy.APPEND,
      reason: 'source session is newer and has no overlap',
      canReplace: true,
      canAppend: true,
      canMerge: true,
    };
  }

  return {
    strategy: MergeStrategy.REPLACE,
    reason: 'source session is older',
    canReplace: true,
    canAppend: false,
    canMerge: false,
  };
}

/**
 * 替换会话
 * @param {Object} source - 源会话
 * @returns {Object} 合并后的会话
 */
function replaceSession({ source }) {
  return {
    meta: {
      ...source.meta,
      restoredFrom: source.meta.sessionId,
      restoredAt: new Date().toISOString(),
      strategy: MergeStrategy.REPLACE,
    },
    messages: source.messages || [],
    context: source.context || {},
  };
}

/**
 * 追加消息到会话
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @returns {Object} 合并后的会话
 */
function appendToSession({ source, target }) {
  const sourceMessages = source.messages || [];
  const targetMessages = target.messages || [];

  // 去重：只添加不在目标会话中的消息
  const targetIds = new Set(targetMessages.map((m) => m.id));
  const newMessages = sourceMessages.filter((msg) => !targetIds.has(msg.id));

  return {
    meta: {
      ...target.meta,
      messageCount: targetMessages.length + newMessages.length,
      updatedAt: new Date().toISOString(),
      restoredFrom: source.meta.sessionId,
      restoredAt: new Date().toISOString(),
      strategy: MergeStrategy.APPEND,
      appendedCount: newMessages.length,
    },
    messages: [...targetMessages, ...newMessages],
    context: {
      ...target.context,
      ...(source.context || {}),
    },
  };
}

/**
 * 智能合并会话
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @param {Object} options - 选项
 * @returns {Object} 合并结果
 */
function mergeSessions({ source, target, options = {} }) {
  const sourceMessages = source.messages || [];
  const targetMessages = target.messages || [];

  // 按时间戳排序
  const allMessages = [...sourceMessages, ...targetMessages].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );

  // 去重：相同的消息只保留一个
  const messageMap = new Map();
  for (const msg of allMessages) {
    const key = `${msg.role}-${msg.content}-${msg.createdAt}`;
    if (!messageMap.has(key) || messageMap.get(key).id < msg.id) {
      messageMap.set(key, msg);
    }
  }

  const mergedMessages = Array.from(messageMap.values());

  // 合并上下文
  const mergedContext = mergeContexts({
    source: source.context || {},
    target: target.context || {},
    strategy: options.contextStrategy || 'latest',
  });

  return {
    meta: {
      ...target.meta,
      messageCount: mergedMessages.length,
      updatedAt: new Date().toISOString(),
      restoredFrom: source.meta.sessionId,
      restoredAt: new Date().toISOString(),
      strategy: MergeStrategy.MERGE,
      originalTargetCount: targetMessages.length,
      sourceCount: sourceMessages.length,
      mergedCount: mergedMessages.length,
      duplicatesRemoved: allMessages.length - mergedMessages.length,
    },
    messages: mergedMessages,
    context: mergedContext,
  };
}

/**
 * 合并上下文
 * @param {Object} source - 源上下文
 * @param {Object} target - 目标上下文
 * @param {string} strategy - 策略
 * @returns {Object} 合并后的上下文
 */
function mergeContexts({ source, target, strategy = 'latest' }) {
  if (strategy === 'source') {
    return { ...target, ...source };
  }

  if (strategy === 'target') {
    return { ...source, ...target };
  }

  // latest 策略：对于不同的字段，选择最新的
  const merged = { ...target };

  // 合并项目路径（选择更详细的）
  if (
    source.projectPath &&
    (!merged.projectPath || source.projectPath.length > merged.projectPath.length)
  ) {
    merged.projectPath = source.projectPath;
  }

  // 合并文件引用（去重）
  const fileMap = new Map();
  [...(target.files || []), ...(source.files || [])].forEach((file) => {
    fileMap.set(file.path, file);
  });
  merged.files = Array.from(fileMap.values());

  // 合并活动文件（去重）
  const activeFileSet = new Set([...(target.activeFiles || []), ...(source.activeFiles || [])]);
  merged.activeFiles = Array.from(activeFileSet);

  // 合并备注（追加）
  const notes = [];
  if (target.notes) notes.push(target.notes);
  if (source.notes) notes.push(source.notes);
  merged.notes = notes.join('\n\n---\n\n') || undefined;

  return merged;
}

/**
 * 应用合并策略
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @param {string} strategy - 合并策略
 * @param {Object} options - 选项
 * @returns {Object} 合并结果
 */
function applyMergeStrategy({ source, target, strategy, options = {} }) {
  switch (strategy) {
    case MergeStrategy.REPLACE:
      return replaceSession({ source });
    case MergeStrategy.APPEND:
      return appendToSession({ source, target });
    case MergeStrategy.MERGE:
      return mergeSessions({ source, target, options });
    default:
      throw new Error(`Unknown merge strategy: ${strategy}`);
  }
}

/**
 * 生成合并预览
 * @param {Object} source - 源会话
 * @param {Object} target - 目标会话
 * @param {string} strategy - 合并策略
 * @returns {Object} 预览结果
 */
function generateMergePreview({ source, target, strategy }) {
  const comparison = compareSessions({ source, target });
  const recommendation = recommendStrategy({ source, target });
  const result = applyMergeStrategy({ source, target, strategy });

  return {
    strategy,
    recommended: recommendation.strategy,
    match: strategy === recommendation.strategy,
    source: {
      sessionId: source.meta?.sessionId,
      messageCount: source.messages?.length || 0,
      lastUpdated: source.meta?.updatedAt,
    },
    target: {
      messageCount: target.messages?.length || 0,
    },
    comparison,
    result: {
      messageCount: result.messages.length,
      change: result.messages.length - (target.messages?.length || 0),
      strategy: result.meta.strategy,
      duplicatesRemoved: result.meta.duplicatesRemoved || 0,
      appendedCount: result.meta.appendedCount || 0,
    },
  };
}

module.exports = {
  MergeStrategy,
  SessionState,
  detectSessionState,
  compareSessions,
  detectMessageOverlap,
  recommendStrategy,
  replaceSession,
  appendToSession,
  mergeSessions,
  mergeContexts,
  applyMergeStrategy,
  generateMergePreview,
};
