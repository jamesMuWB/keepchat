/**
 * 错误处理和用户友好消息
 */

/**
 * 错误类型
 */
const ErrorType = {
  NETWORK_ERROR: "network_error",
  AUTH_ERROR: "auth_error",
  PERMISSION_ERROR: "permission_error",
  STORAGE_LIMIT: "storage_limit",
  QUOTA_EXCEEDED: "quota_exceeded",
  CONFIG_ERROR: "config_error",
  ENCRYPTION_ERROR: "encryption_error",
  SESSION_NOT_FOUND: "session_not_found",
  INVALID_INPUT: "invalid_input",
  CONFLICT: "conflict",
  UNKNOWN: "unknown",
};

/**
 * 错误级别
 */
const ErrorLevel = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
  SUCCESS: "success",
};

/**
 * 获取友好的错误消息
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 * @returns {Object} 友好错误信息
 */
function getUserFriendlyError(error, context = {}) {
  const errorType = classifyError(error);
  const message = getErrorMessage(errorType, error, context);
  const suggestion = getSuggestion(errorType, context);

  return {
    type: errorType,
    level: getErrorLevel(errorType),
    message,
    suggestion,
    code: error.code,
    details: getErrorDetails(error, context),
  };
}

/**
 * 分类错误
 * @param {Error} error - 错误对象
 * @returns {string} 错误类型
 */
function classifyError(error) {
  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";

  // 网络错误
  if (
    code === "enotfound" ||
    code === "econnrefused" ||
    code === "etimedout" ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout")
  ) {
    return ErrorType.NETWORK_ERROR;
  }

  // 认证错误
  if (
    message.includes("accesskey") ||
    message.includes("secretkey") ||
    message.includes("authentication") ||
    message.includes("unauthorized") ||
    code === "401"
  ) {
    return ErrorType.AUTH_ERROR;
  }

  // 权限错误
  if (
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("denied") ||
    code === "403"
  ) {
    return ErrorType.PERMISSION_ERROR;
  }

  // 存储空间限制
  if (
    message.includes("quota") ||
    message.includes("limit") ||
    message.includes("exceeded") ||
    code === "507"
  ) {
    return ErrorType.STORAGE_LIMIT;
  }

  // 配置错误
  if (
    message.includes("config") ||
    message.includes("missing") ||
    message.includes("required")
  ) {
    return ErrorType.CONFIG_ERROR;
  }

  // 加密错误
  if (
    message.includes("encryption") ||
    message.includes("decryption") ||
    message.includes("password") ||
    message.includes("key")
  ) {
    return ErrorType.ENCRYPTION_ERROR;
  }

  // 会话未找到
  if (
    message.includes("not found") ||
    message.includes("404")
  ) {
    return ErrorType.SESSION_NOT_FOUND;
  }

  // 冲突
  if (
    message.includes("conflict") ||
    message.includes("overwrite") ||
    code === "409"
  ) {
    return ErrorType.CONFLICT;
  }

  // 无效输入
  if (
    message.includes("invalid") ||
    message.includes("format")
  ) {
    return ErrorType.INVALID_INPUT;
  }

  return ErrorType.UNKNOWN;
}

/**
 * 获取错误消息
 * @param {string} errorType - 错误类型
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 * @returns {string} 错误消息
 */
function getErrorMessage(errorType, error, context) {
  const messages = {
    [ErrorType.NETWORK_ERROR]: {
      default:
        "Unable to connect to cloud storage. Please check your internet connection.",
      timeout: "Connection timed out. Please try again.",
      refused: "Connection was refused. Check your firewall settings.",
      offline: "You are offline. Please check your network connection.",
    },
    [ErrorType.AUTH_ERROR]: {
      default:
        "Authentication failed. Please check your Qiniu credentials.",
      invalidKey:
        "Invalid AccessKey or SecretKey. Please verify your configuration.",
      unauthorized: "You don't have permission to access this resource.",
    },
    [ErrorType.PERMISSION_ERROR]: {
      default:
        "Permission denied. You don't have access to this resource.",
      forbidden: "Access to this resource is forbidden.",
    },
    [ErrorType.STORAGE_LIMIT]: {
      default:
        "Storage limit reached. Please upgrade your Qiniu plan or delete old sessions.",
      quota: "Storage quota exceeded. Consider deleting old sessions.",
    },
    [ErrorType.CONFIG_ERROR]: {
      default:
        "Configuration error. Please run /configure to fix this issue.",
      missing: "Required configuration is missing.",
      invalid: "Configuration format is invalid.",
    },
    [ErrorType.ENCRYPTION_ERROR]: {
      default:
        "Encryption/decryption failed. Please check your encryption settings.",
      password:
        "Invalid password. Please verify your password and try again.",
      key:
        "Invalid encryption key. Please check your API key configuration.",
    },
    [ErrorType.SESSION_NOT_FOUND]: {
      default:
        "Session not found. Please verify the session ID and try again.",
      deleted: "This session has been deleted from cloud storage.",
    },
    [ErrorType.CONFLICT]: {
      default:
        "Conflict detected. The session has been modified by another device.",
      localNewer: "Local version is newer than cloud version.",
      cloudNewer: "Cloud version is newer than local version.",
    },
    [ErrorType.INVALID_INPUT]: {
      default:
        "Invalid input. Please check your input and try again.",
      sessionId:
        "Invalid session ID format. Expected UUID v4 format.",
      password:
        "Invalid password. Must be at least 8 characters with letters and numbers.",
    },
    [ErrorType.UNKNOWN]: {
      default: "An unexpected error occurred. Please try again.",
    },
  };

  const typeMessages = messages[errorType] || {};

  // 根据错误代码获取特定消息
  if (error.code) {
    if (typeMessages[error.code]) {
      return typeMessages[error.code];
    }
  }

  // 根据错误消息获取特定消息
  const message = error.message?.toLowerCase() || "";
  if (message.includes("timeout")) {
    return typeMessages.timeout || typeMessages.default;
  }
  if (message.includes("refused")) {
    return typeMessages.refused || typeMessages.default;
  }

  return typeMessages.default || messages[ErrorType.UNKNOWN].default;
}

/**
 * 获取建议
 * @param {string} errorType - 错误类型
 * @param {Object} context - 上下文信息
 * @returns {string} 建议消息
 */
function getSuggestion(errorType, context) {
  const suggestions = {
    [ErrorType.NETWORK_ERROR]: {
      default:
        "1. Check your internet connection\n2. Try disabling VPN or proxy\n3. Run /configure --status to check configuration",
      offline: "Check your network settings and try again when online",
    },
    [ErrorType.AUTH_ERROR]: {
      default:
        "1. Run /configure to update credentials\n2. Check your Qiniu console: https://portal.qiniu.com/user/key\n3. Verify your AccessKey and SecretKey",
    },
    [ErrorType.PERMISSION_ERROR]: {
      default:
        "1. Verify your Qiniu account has the necessary permissions\n2. Check bucket access control list\n3. Contact your Qiniu administrator if issue persists",
    },
    [ErrorType.STORAGE_LIMIT]: {
      default:
        "1. Run /cleanup-sessions to delete old sessions\n2. Upgrade your Qiniu plan: https://portal.qiniu.com/billing\n3. Check storage usage: https://portal.qiniu.com/console/bucket",
    },
    [ErrorType.CONFIG_ERROR]: {
      default:
        "1. Run /configure to re-setup configuration\n2. Check your environment variables (QINIU_ACCESS_KEY, etc.)\n3. Verify configuration files exist in ~/.codebuddy/",
    },
    [ErrorType.ENCRYPTION_ERROR]: {
      default:
        "1. Verify your encryption key: /export-key\n2. If using password, ensure it's correct\n3. Consider running /rotate-key if key is corrupted",
    },
    [ErrorType.SESSION_NOT_FOUND]: {
      default:
        "1. Run /list-sessions to see available sessions\n2. Verify the session ID is correct\n3. Check if the session was deleted by another device",
    },
    [ErrorType.CONFLICT]: {
      default:
        "1. Run /list-sessions to see all cloud sessions\n2. Use /sync-session --force to override\n3. Use /restore-session to manually merge",
    },
    [ErrorType.INVALID_INPUT]: {
      default:
        "1. Check the command syntax and try again\n2. Run /<command> --help to see usage\n3. Verify all required parameters are provided",
      sessionId:
        "Session ID must be a UUID v4 format (e.g., 550e8400-e29b-41d4-a716-446655440000)",
      password:
        "Password must be at least 8 characters with both letters and numbers",
    },
      [ErrorType.UNKNOWN]: {
        default:
          "1. Try running the command again\n2. Check your network connection\n3. Run /configure --status to verify configuration\n4. If issue persists, please report it",
      },
  };

  return suggestions[errorType]?.default || suggestions[ErrorType.UNKNOWN].default;
}

/**
 * 获取错误级别
 * @param {string} errorType - 错误类型
 * @returns {string} 错误级别
 */
function getErrorLevel(errorType) {
  const levels = {
    [ErrorType.NETWORK_ERROR]: ErrorLevel.ERROR,
    [ErrorType.AUTH_ERROR]: ErrorLevel.ERROR,
    [ErrorType.PERMISSION_ERROR]: ErrorLevel.ERROR,
    [ErrorType.STORAGE_LIMIT]: ErrorLevel.WARNING,
    [ErrorType.CONFIG_ERROR]: ErrorLevel.ERROR,
    [ErrorType.ENCRYPTION_ERROR]: ErrorLevel.ERROR,
    [ErrorType.SESSION_NOT_FOUND]: ErrorLevel.ERROR,
    [ErrorType.CONFLICT]: ErrorLevel.WARNING,
    [ErrorType.INVALID_INPUT]: ErrorLevel.ERROR,
    [ErrorType.UNKNOWN]: ErrorLevel.ERROR,
  };

  return levels[errorType] || ErrorLevel.ERROR;
}

/**
 * 格式化错误输出
 * @param {Object} errorInfo - 错误信息
 * @returns {string} 格式化的错误字符串
 */
function formatErrorOutput(errorInfo) {
  const levelIcon = {
    [ErrorLevel.ERROR]: "❌",
    [ErrorLevel.WARNING]: "⚠️",
    [ErrorLevel.INFO]: "ℹ️",
    [ErrorLevel.SUCCESS]: "✅",
  };

  const icon = levelIcon[errorInfo.level] || levelIcon[ErrorLevel.ERROR];

  const lines = [
    `${icon} ${errorInfo.message}`,
    "",
  ];

  if (errorInfo.suggestion) {
    lines.push("💡 Suggestion:");
    lines.push("   " + errorInfo.suggestion);
    lines.push("");
  }

  if (errorInfo.details) {
    lines.push("Details:");
    for (const [key, value] of Object.entries(errorInfo.details)) {
      lines.push(`   ${key}: ${value}`);
    }
    lines.push("");
  }

  if (errorInfo.code) {
    lines.push(`Error Code: ${errorInfo.code}`);
  }

  return lines.join("\n");
}

/**
 * 显示错误
 * @param {Error} error - 错误对象
 * @param {Object} context - 上下文信息
 */
function displayError(error, context = {}) {
  const errorInfo = getUserFriendlyError(error, context);
  console.error("\n" + formatErrorOutput(errorInfo));
  return errorInfo;
}

/**
 * 显示警告
 * @param {string} message - 警告消息
 */
function displayWarning(message) {
  console.warn("\n⚠️  " + message);
}

/**
 * 显示成功消息
 * @param {string} message - 成功消息
 */
function displaySuccess(message) {
  console.log("\n✅  " + message);
}

/**
 * 显示信息消息
 * @param {string} message - 信息消息
 */
function displayInfo(message) {
  console.log("\nℹ️  " + message);
}

/**
 * 创建进度条
 * @param {number} current - 当前进度
 * @param {number} total - 总进度
 * @param {number} width - 进度条宽度
 * @returns {string} 进度条字符串
 */
function createProgressBar(current, total, width = 40) {
  if (total === 0) {
    return "█".repeat(width);
  }

  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.floor((percentage / 100) * width);
  const empty = width - filled;

  return "█".repeat(filled) + "░".repeat(empty);
}

/**
 * 显示进度
 * @param {number} current - 当前进度
 * @param {number} total - 总进度
 * @param {string} message - 进度消息
 */
function displayProgress(current, total, message) {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const bar = createProgressBar(current, total);

  console.log(`\r${bar} ${percentage}% - ${message}`);
}

/**
 * 清除进度行
 */
function clearProgressLine() {
  console.log("\r" + " ".repeat(100));
}

/**
 * 显示加载动画
 * @param {string} message - 加载消息
 * @returns {Function} 停止加载动画的函数
 */
function showLoadingAnimation(message) {
  const frames = ["⠋", "⠙", "⠹", "⠺", "⠸"];
  let i = 0;
  let intervalId;

  // 显示初始消息
  console.log(`\n${message}`);

  // 启动动画
  intervalId = setInterval(() => {
    process.stdout.write(`\r${frames[i % frames.length]} `);
    i++;
  }, 100);

  // 返回停止函数
  return () => {
    clearInterval(intervalId);
    process.stdout.write("\r");
  };
}

/**
 * 显示成功完成动画
 * @param {string} message - 成功消息
 */
function showSuccessAnimation(message) {
  const frames = ["⠋", "⠙", "⠹", "⠺", "✅"];
  let i = 0;

  console.log(`\n${message}`);

  return new Promise((resolve) => {
    const intervalId = setInterval(() => {
      process.stdout.write(`\r${frames[i % frames.length]} `);
      i++;
      if (i === frames.length) {
        clearInterval(intervalId);
        process.stdout.write("\n");
        resolve();
      }
    }, 100);
  });
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小字符串
 */
function formatBytes(bytes) {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));

  return `${size} ${sizes[i]}`;
}

/**
 * 格式化持续时间
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的持续时间字符串
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * 格式化相对时间
 * @param {string} timestamp - ISO 时间戳
 * @returns {string} 相对时间字符串
 */
function formatRelativeTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return "Just now";
  }
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }

  const days = Math.floor(diff / 86400000);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

module.exports = {
  ErrorType,
  ErrorLevel,
  getUserFriendlyError,
  classifyError,
  getErrorMessage,
  getSuggestion,
  getErrorLevel,
  formatErrorOutput,
  displayError,
  displayWarning,
  displaySuccess,
  displayInfo,
  createProgressBar,
  displayProgress,
  clearProgressLine,
  showLoadingAnimation,
  showSuccessAnimation,
  formatBytes,
  formatDuration,
  formatRelativeTime,
};
