const crypto = require('crypto');

/**
 * 计算会话数据的哈希值
 * @param {Object} payload - 会话数据 { meta, messages, context }
 * @returns {string} SHA-256 哈希值 (hex)
 */
function computeSessionHash({ meta, messages, context }) {
  const hash = crypto.createHash('sha256');

  // 序列化各个部分并计算哈希
  hash.update(JSON.stringify(meta));
  hash.update(JSON.stringify(messages));
  hash.update(JSON.stringify(context));

  return hash.digest('hex');
}

/**
 * 验证会话完整性
 * @param {Object} payload - 从云端下载的会话数据
 * @param {string} expectedHash - 预期的哈希值 (从 meta 中获取)
 * @returns {Object} { isValid: boolean, computedHash: string }
 */
function verifySessionIntegrity({ payload, expectedHash }) {
  if (!expectedHash) {
    // 如果没有预期的哈希值，则跳过验证 (向后兼容)
    return {
      isValid: true,
      computedHash: computeSessionHash(payload),
      warning: 'No hash provided, skipping integrity check',
    };
  }

  const computedHash = computeSessionHash(payload);

  return {
    isValid: computedHash === expectedHash,
    computedHash,
    expectedHash,
  };
}

/**
 * 验证单个文件的哈希值
 * @param {Buffer} data - 文件数据
 * @param {string} expectedHash - 预期的哈希值
 * @returns {Object} { isValid: boolean, computedHash: string }
 */
function verifyFileHash({ data, expectedHash }) {
  if (!expectedHash) {
    return {
      isValid: true,
      computedHash: crypto.createHash('sha256').update(data).digest('hex'),
      warning: 'No hash provided, skipping integrity check',
    };
  }

  const computedHash = crypto.createHash('sha256').update(data).digest('hex');

  return {
    isValid: computedHash === expectedHash,
    computedHash,
    expectedHash,
  };
}

/**
 * 验证会话消息的完整性
 * @param {Array} messages - 会话消息列表
 * @returns {Object} { isValid: boolean, messageCount: number, issues: Array }
 */
function verifyMessages(messages) {
  const issues = [];

  // 检查必需字段
  messages.forEach((msg, index) => {
    if (!msg.id) {
      issues.push(`Message ${index} missing id`);
    }
    if (!msg.role || !['user', 'assistant', 'system'].includes(msg.role)) {
      issues.push(`Message ${index} has invalid role: ${msg.role}`);
    }
    if (!msg.content && msg.content !== '') {
      issues.push(`Message ${index} missing content`);
    }
    if (!msg.createdAt) {
      issues.push(`Message ${index} missing createdAt timestamp`);
    }
  });

  // 检查消息是否按时间排序
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  );
  const isSorted = messages.every((msg, i) => msg.id === sortedMessages[i].id);

  if (!isSorted) {
    issues.push('Messages are not chronologically ordered');
  }

  return {
    isValid: issues.length === 0,
    messageCount: messages.length,
    issues,
  };
}

module.exports = {
  computeSessionHash,
  verifySessionIntegrity,
  verifyFileHash,
  verifyMessages,
};
