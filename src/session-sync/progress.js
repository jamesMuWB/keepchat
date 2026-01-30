const os = require('os');

/**
 * 恢复阶段
 */
const RestorePhase = {
  INITIALIZE: 'initialize', // 初始化
  DOWNLOAD: 'download', // 下载
  DECRYPT: 'decrypt', // 解密
  VERIFY: 'verify', // 验证
  REBUILD: 'rebuild', // 重建
  MERGE: 'merge', // 合并
  COMPLETE: 'complete', // 完成
};

/**
 * 恢复步骤定义
 */
const RestoreSteps = [
  {
    phase: RestorePhase.INITIALIZE,
    name: 'Initializing restore',
    description: 'Validating configuration and setting up',
    weight: 5,
  },
  {
    phase: RestorePhase.DOWNLOAD,
    name: 'Downloading session data',
    description: 'Fetching encrypted session from cloud',
    weight: 30,
  },
  {
    phase: RestorePhase.DECRYPT,
    name: 'Decrypting session data',
    description: 'Decrypting and decompressing files',
    weight: 15,
  },
  {
    phase: RestorePhase.VERIFY,
    name: 'Verifying integrity',
    description: 'Checking hash and validating data',
    weight: 10,
  },
  {
    phase: RestorePhase.REBUILD,
    name: 'Rebuilding conversation',
    description: 'Reconstructing conversation history',
    weight: 15,
  },
  {
    phase: RestorePhase.MERGE,
    name: 'Merging with current session',
    description: 'Applying merge strategy',
    weight: 15,
  },
  {
    phase: RestorePhase.COMPLETE,
    name: 'Complete',
    description: 'Restore finished successfully',
    weight: 10,
  },
];

/**
 * 创建进度跟踪器
 * @param {Object} options - 选项
 * @returns {Object} 进度跟踪器
 */
function createProgressTracker(options = {}) {
  const tracker = {
    startTime: Date.now(),
    currentPhase: null,
    phaseProgress: {},
    overallProgress: 0,
    logs: [],
    errors: [],
    options: {
      verbose: options.verbose || false,
      onProgress: options.onProgress,
      onPhaseChange: options.onPhaseChange,
      onError: options.onError,
    },
  };

  return tracker;
}

/**
 * 开始新的恢复阶段
 * @param {Object} tracker - 进度跟踪器
 * @param {string} phase - 阶段
 * @param {Object} meta - 元数据
 */
function startPhase({ tracker, phase, meta = {} }) {
  const step = RestoreSteps.find((s) => s.phase === phase);
  if (!step) {
    throw new Error(`Unknown phase: ${phase}`);
  }

  tracker.currentPhase = phase;
  tracker.phaseProgress[phase] = {
    started: Date.now(),
    progress: 0,
    meta,
  };

  log({
    tracker,
    message: `Starting phase: ${step.name}`,
    level: 'info',
    phase,
  });

  if (tracker.options.onPhaseChange) {
    tracker.options.onPhaseChange({
      phase,
      name: step.name,
      description: step.description,
      progress: calculateOverallProgress(tracker),
    });
  }
}

/**
 * 更新阶段进度
 * @param {Object} tracker - 进度跟踪器
 * @param {string} phase - 阶段
 * @param {number} progress - 进度 (0-100)
 * @param {Object} meta - 元数据
 */
function updatePhaseProgress({ tracker, phase, progress, meta = {} }) {
  if (!tracker.phaseProgress[phase]) {
    tracker.phaseProgress[phase] = {
      started: Date.now(),
      progress: 0,
      meta: {},
    };
  }

  const clampedProgress = Math.max(0, Math.min(100, progress));
  tracker.phaseProgress[phase].progress = clampedProgress;
  tracker.phaseProgress[phase].meta = {
    ...tracker.phaseProgress[phase].meta,
    ...meta,
  };

  const overall = calculateOverallProgress(tracker);
  tracker.overallProgress = overall;

  if (tracker.options.onProgress) {
    tracker.options.onProgress({
      phase,
      progress: clampedProgress,
      overall,
      elapsed: Date.now() - tracker.startTime,
      ...tracker.phaseProgress[phase].meta,
    });
  }
}

/**
 * 完成阶段
 * @param {Object} tracker - 进度跟踪器
 * @param {string} phase - 阶段
 * @param {Object} meta - 元数据
 */
function completePhase({ tracker, phase, meta = {} }) {
  updatePhaseProgress({
    tracker,
    phase,
    progress: 100,
    meta,
  });

  const step = RestoreSteps.find((s) => s.phase === phase);
  const elapsed = Date.now() - tracker.phaseProgress[phase].started;

  log({
    tracker,
    message: `Completed phase: ${step.name} (${(elapsed / 1000).toFixed(2)}s)`,
    level: 'info',
    phase,
  });
}

/**
 * 计算总体进度
 * @param {Object} tracker - 进度跟踪器
 * @returns {number} 总体进度 (0-100)
 */
function calculateOverallProgress(tracker) {
  let totalProgress = 0;

  for (const step of RestoreSteps) {
    const phaseProgress = tracker.phaseProgress[step.phase];
    if (!phaseProgress) {
      continue;
    }

    totalProgress += (step.weight * phaseProgress.progress) / 100;
  }

  return Math.round(totalProgress);
}

/**
 * 记录日志
 * @param {Object} tracker - 进度跟踪器
 * @param {string} message - 消息
 * @param {string} level - 日志级别
 * @param {string} phase - 阶段
 * @param {Object} data - 附加数据
 */
function log({ tracker, message, level = 'info', phase, data }) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    phase,
    data,
  };

  tracker.logs.push(entry);

  if (tracker.options.verbose) {
    console.log(`[${entry.level.toUpperCase()}] ${message}`);
  }
}

/**
 * 记录错误
 * @param {Object} tracker - 进度跟踪器
 * @param {Error} error - 错误
 * @param {Object} context - 上下文
 */
function logError({ tracker, error, context }) {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    phase: tracker.currentPhase,
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    context,
  };

  tracker.errors.push(errorEntry);

  log({
    tracker,
    message: `Error: ${error.message}`,
    level: 'error',
    phase: tracker.currentPhase,
    data: errorEntry,
  });

  if (tracker.options.onError) {
    tracker.options.onError(errorEntry);
  }
}

/**
 * 格式化进度显示
 * @param {Object} tracker - 进度跟踪器
 * @returns {string} 格式化的进度字符串
 */
function formatProgress(tracker) {
  const step = RestoreSteps.find((s) => s.phase === tracker.currentPhase);
  const phaseProgress = tracker.phaseProgress[tracker.currentPhase];

  if (!step || !phaseProgress) {
    return '';
  }

  const barLength = 30;
  const filled = Math.round((tracker.overallProgress / 100) * barLength);
  const empty = barLength - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  const elapsed = Date.now() - tracker.startTime;
  const elapsedSeconds = (elapsed / 1000).toFixed(1);

  return `
${step.name}
${tracker.overallProgress}% [${bar}] ${elapsedSeconds}s
${step.description}
`.trim();
}

/**
 * 生成进度报告
 * @param {Object} tracker - 进度跟踪器
 * @returns {Object} 进度报告
 */
function generateProgressReport(tracker) {
  const elapsed = Date.now() - tracker.startTime;

  return {
    overallProgress: tracker.overallProgress,
    currentPhase: tracker.currentPhase,
    phaseProgress: tracker.phaseProgress,
    elapsed,
    elapsedFormatted: formatDuration(elapsed),
    logs: tracker.logs,
    errors: tracker.errors,
    hasErrors: tracker.errors.length > 0,
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

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }

  return `${seconds}s`;
}

/**
 * 创建进度回调 (用于下载、解密等操作)
 * @param {Object} tracker - 进度跟踪器
 * @param {string} phase - 阶段
 * @param {string} file - 文件名
 * @returns {Function} 进度回调函数
 */
function createProgressCallback({ tracker, phase, file }) {
  return ({ progress, loaded, total }) => {
    updatePhaseProgress({
      tracker,
      phase,
      progress,
      meta: {
        file,
        loaded: formatBytes(loaded),
        total: formatBytes(total),
      },
    });
  };
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
 * 完成恢复流程
 * @param {Object} tracker - 进度跟踪器
 * @param {Object} result - 恢复结果
 * @returns {Object} 最终报告
 */
function completeRestore({ tracker, result }) {
  completePhase({ tracker, phase: RestorePhase.COMPLETE });

  return {
    success: true,
    duration: Date.now() - tracker.startTime,
    durationFormatted: formatDuration(Date.now() - tracker.startTime),
    result,
    logs: tracker.logs,
    errors: tracker.errors,
    hasErrors: tracker.errors.length > 0,
  };
}

module.exports = {
  RestorePhase,
  RestoreSteps,
  createProgressTracker,
  startPhase,
  updatePhaseProgress,
  completePhase,
  calculateOverallProgress,
  log,
  logError,
  formatProgress,
  generateProgressReport,
  formatDuration,
  createProgressCallback,
  formatBytes,
  completeRestore,
};
