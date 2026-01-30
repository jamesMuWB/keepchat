const { verifySessionIntegrity, verifyMessages } = require('./integrity');

/**
 * 格式化消息为可读的对话格式
 * @param {Array} messages - 会话消息列表
 * @returns {Object} 格式化后的对话 { messages: Array, formatted: string }
 */
function formatConversation(messages) {
  const formattedMessages = messages.map((msg) => {
    const roleLabel =
      {
        user: 'You',
        assistant: 'Assistant',
        system: 'System',
      }[msg.role] || msg.role;

    const timestamp = new Date(msg.createdAt).toLocaleString();
    const separator = '=';

    return {
      ...msg,
      roleLabel,
      timestamp,
      formatted: [`${separator} ${roleLabel} [${timestamp}]`, msg.content, ''].join('\n'),
    };
  });

  const formattedConversation = formattedMessages.map((msg) => msg.formatted).join('\n');

  return {
    messages: formattedMessages,
    formatted: formattedConversation,
  };
}

/**
 * 创建会话摘要
 * @param {Object} payload - 会话数据 { meta, messages, context }
 * @returns {Object} 会话摘要
 */
function createSessionSummary({ meta, messages, context }) {
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];

  return {
    sessionId: meta.sessionId,
    title: extractSessionTitle(firstMessage),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    device: meta.device,
    messageCount: meta.messageCount,
    projectPath: meta.projectPath || context.projectPath,
    firstMessageTime: firstMessage?.createdAt,
    lastMessageTime: lastMessage?.createdAt,
    duration: calculateDuration(meta.createdAt, meta.updatedAt),
  };
}

/**
 * 从第一条消息提取会话标题
 * @param {Object} message - 第一条消息
 * @returns {string} 会话标题
 */
function extractSessionTitle(message) {
  if (!message) {
    return 'Untitled Session';
  }

  const title = message.content.split('\n')[0].trim();
  return title.length > 50 ? title.substring(0, 47) + '...' : title;
}

/**
 * 计算会话持续时间
 * @param {string} startTime - 开始时间
 * @param {string} endTime - 结束时间
 * @returns {string} 持续时间
 */
function calculateDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diff = end - start;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

/**
 * 重建对话历史
 * @param {Object} payload - 从云端下载的会话数据
 * @param {Object} options - 重建选项
 * @returns {Object} 重建后的会话 { session, summary, integrity }
 */
async function rebuildConversationHistory({ payload, options = { verifyIntegrity: true } }) {
  const { meta, messages, context } = payload;

  // 验证完整性
  let integrity = null;
  if (options.verifyIntegrity) {
    const hashResult = verifySessionIntegrity({
      payload,
      expectedHash: meta.hash,
    });

    const messagesResult = verifyMessages(messages);

    integrity = {
      hash: hashResult,
      messages: messagesResult,
      isValid: hashResult.isValid && messagesResult.isValid,
    };

    if (!integrity.isValid) {
      throw new Error(
        'Session integrity check failed: ' +
          JSON.stringify({
            hash: hashResult,
            messages: messagesResult,
          }),
      );
    }
  }

  // 格式化对话
  const conversation = formatConversation(messages);

  // 创建摘要
  const summary = createSessionSummary({ meta, messages, context });

  return {
    session: {
      meta,
      messages: conversation.messages,
      context,
      formatted: conversation.formatted,
    },
    summary,
    integrity,
  };
}

/**
 * 将会话转换为可导入的格式
 * @param {Object} rebuilt - 重建的会话
 * @returns {Object} 可导入的格式
 */
function prepareForImport({ rebuilt }) {
  const { session, summary } = rebuilt;

  return {
    sessionId: summary.sessionId,
    title: summary.title,
    messages: session.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    })),
    context: session.context,
    metadata: {
      device: summary.device,
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
      messageCount: summary.messageCount,
      projectPath: summary.projectPath,
      originalSessionId: summary.sessionId,
    },
  };
}

module.exports = {
  formatConversation,
  createSessionSummary,
  rebuildConversationHistory,
  prepareForImport,
  extractSessionTitle,
  calculateDuration,
};
