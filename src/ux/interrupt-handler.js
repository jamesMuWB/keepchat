/**
 * 命令执行可中断处理模块
 * 处理 Ctrl+C 信号，实现优雅的中止和清理
 */

const { displayWarning, displayInfo } = require('./error-handler');

/**
 * 中断状态
 */
const InterruptState = {
  NONE: 'none', // 无中断
  REQUESTED: 'requested', // 用户请求中断
  PROCESSING: 'processing', // 正在处理中断
  COMPLETED: 'completed', // 中断完成
};

/**
 * 当前中断状态
 */
let currentInterruptState = InterruptState.NONE;

/**
 * 中断回调函数
 */
let interruptCallback = null;

/**
 * 清理函数列表
 */
const cleanupFunctions = [];

/**
 * 是否允许中断
 */
let interruptEnabled = true;

/**
 * 注册中断处理器
 * @param {Function} callback - 中断时的回调函数
 * @returns {Function} 取消注册的函数
 */
function registerInterruptHandler(callback) {
  interruptCallback = callback;

  const sigintHandler = (signal) => {
    handleInterrupt(signal);
  };

  // 监听 SIGINT 信号 (Ctrl+C)
  process.on('SIGINT', sigintHandler);

  // 返回取消注册的函数
  return () => {
    process.removeListener('SIGINT', sigintHandler);
    interruptCallback = null;
  };
}

/**
 * 处理中断信号
 * @param {string} signal - 信号名称
 */
async function handleInterrupt(signal) {
  if (!interruptEnabled) {
    // 中断被禁用，忽略信号
    return;
  }

  if (currentInterruptState === InterruptState.REQUESTED) {
    // 用户已经请求过中断，强制退出
    console.log('\n\n🚨 Force quitting...');
    process.exit(1);
  }

  if (currentInterruptState === InterruptState.PROCESSING) {
    // 正在处理中断，等待完成
    console.log('\n\n⚠️  Interrupt already in progress. Please wait...');
    return;
  }

  if (currentInterruptState === InterruptState.COMPLETED) {
    // 中断已完成，直接退出
    console.log('\n\n👋 Goodbye!');
    process.exit(0);
  }

  // 首次中断请求
  currentInterruptState = InterruptState.REQUESTED;

  console.log('\n\n⚠️  Interrupt received. Cleaning up...');

  // 切换到处理状态
  currentInterruptState = InterruptState.PROCESSING;

  try {
    // 执行清理函数
    await runCleanupFunctions();

    // 执行中断回调
    if (interruptCallback) {
      await interruptCallback();
    }

    // 标记为完成
    currentInterruptState = InterruptState.COMPLETED;

    console.log('\n✅ Cleanup completed.');
    console.log('Press Ctrl+C again to exit, or wait to continue...\n');

    // 设置一个超时，如果用户不再次按 Ctrl+C，则继续执行
    setTimeout(() => {
      console.log('Continuing execution...');
      currentInterruptState = InterruptState.NONE;
    }, 3000);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

/**
 * 添加清理函数
 * @param {Function} cleanupFn - 清理函数
 * @returns {Function} 移除清理函数的函数
 */
function addCleanupFunction(cleanupFn) {
  cleanupFunctions.push(cleanupFn);

  // 返回移除函数
  return () => {
    const index = cleanupFunctions.indexOf(cleanupFn);
    if (index > -1) {
      cleanupFunctions.splice(index, 1);
    }
  };
}

/**
 * 运行所有清理函数
 * @returns {Promise<void>}
 */
async function runCleanupFunctions() {
  for (const cleanupFn of cleanupFunctions) {
    try {
      await cleanupFn();
    } catch (error) {
      console.error(`\n⚠️  Cleanup function failed: ${error.message}`);
    }
  }
}

/**
 * 清除所有清理函数
 */
function clearCleanupFunctions() {
  cleanupFunctions.length = 0;
}

/**
 * 禁用中断处理
 * @returns {Function} 重新启用中断处理的函数
 */
function disableInterrupt() {
  interruptEnabled = false;

  // 返回重新启用的函数
  return () => {
    interruptEnabled = true;
  };
}

/**
 * 启用中断处理
 */
function enableInterrupt() {
  interruptEnabled = true;
}

/**
 * 检查是否应该停止执行
 * @returns {boolean} 是否应该停止
 */
function shouldStop() {
  return (
    currentInterruptState === InterruptState.REQUESTED ||
    currentInterruptState === InterruptState.PROCESSING
  );
}

/**
 * 等待并检查中断状态
 * @param {number} ms - 等待时间（毫秒）
 * @returns {Promise<void>}
 */
async function waitWithInterruptCheck(ms) {
  const checkInterval = 100;
  const elapsed = 0;

  while (elapsed < ms) {
    if (shouldStop()) {
      throw new Error('Operation interrupted by user');
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(checkInterval, ms - elapsed)));
  }
}

/**
 * 创建可中断的操作
 * @param {Function} operation - 要执行的操作
 * @param {Object} options - 选项
 * @returns {Promise<any>} 操作结果
 */
async function withInterruptHandler(operation, options = {}) {
  const { operationName = 'Operation', onProgress = null, checkInterval = 100 } = options;

  let unregisterHandler = null;
  let wasInterrupted = false;

  // 注册中断处理器
  unregisterHandler = registerInterruptHandler(async () => {
    wasInterrupted = true;
    console.log(`\n\n⚠️  ${operationName} interrupted by user`);
  });

  try {
    // 执行操作
    const result = await operation();

    if (!wasInterrupted) {
      return result;
    } else {
      throw new Error('Operation was interrupted');
    }
  } finally {
    // 取消注册中断处理器
    if (unregisterHandler) {
      unregisterHandler();
    }
  }
}

/**
 * 显示中断提示
 */
function displayInterruptHint() {
  displayInfo('Press Ctrl+C to interrupt this operation');
}

/**
 * 创建带进度检查的可中断循环
 * @param {Array} items - 要处理的项目数组
 * @param {Function} processor - 处理每个项目的函数
 * @param {Object} options - 选项
 * @returns {Promise<Array>} 处理结果
 */
async function interruptibleForEach(items, processor, options = {}) {
  const { onProgress = null, itemName = 'item' } = options;

  const results = [];

  for (let i = 0; i < items.length; i++) {
    // 检查中断状态
    if (shouldStop()) {
      displayWarning(`${operationName || 'Operation'} interrupted at ${i + 1}/${items.length}`);
      break;
    }

    const item = items[i];

    try {
      const result = await processor(item, i);
      results.push(result);

      // 报告进度
      if (onProgress) {
        onProgress(i + 1, items.length, item);
      }
    } catch (error) {
      if (error.message === 'Operation interrupted by user') {
        throw error;
      }
      // 其他错误继续处理
      results.push({ error: error.message });
    }
  }

  return results;
}

/**
 * 获取中断状态
 * @returns {string} 当前中断状态
 */
function getInterruptState() {
  return currentInterruptState;
}

/**
 * 重置中断状态
 */
function resetInterruptState() {
  currentInterruptState = InterruptState.NONE;
}

/**
 * 创建临时文件并在中断时自动清理
 * @param {string} filePath - 文件路径
 * @param {Function} operation - 使用文件的操作
 * @returns {Promise<any>} 操作结果
 */
async function withTempFile(filePath, operation) {
  const fs = require('fs').promises;

  // 添加清理函数
  const removeCleanup = addCleanupFunction(async () => {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // 文件可能已不存在
    }
  });

  try {
    // 执行操作
    const result = await operation(filePath);
    return result;
  } finally {
    // 如果没有被中断，正常清理
    if (!shouldStop()) {
      await fs.unlink(filePath).catch(() => {});
    }
    // 移除清理函数
    removeCleanup();
  }
}

/**
 * 创建可中断的超时等待
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @param {Function} onTimeout - 超时回调
 * @returns {Promise<void>}
 */
async function interruptibleTimeout(timeoutMs, onTimeout) {
  let timeoutId = null;
  let completed = false;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  // 添加清理函数
  const removeCleanup = addCleanupFunction(cleanup);

  return new Promise((resolve, reject) => {
    timeoutId = setTimeout(async () => {
      completed = true;
      removeCleanup();

      if (onTimeout) {
        try {
          await onTimeout();
        } catch (error) {
          reject(error);
          return;
        }
      }

      resolve();
    }, timeoutMs);

    // 检查中断状态
    const checkInterval = setInterval(() => {
      if (shouldStop()) {
        clearInterval(checkInterval);
        cleanup();
        removeCleanup();
        reject(new Error('Timeout interrupted by user'));
      }
    }, 100);
  });
}

module.exports = {
  InterruptState,
  registerInterruptHandler,
  handleInterrupt,
  addCleanupFunction,
  runCleanupFunctions,
  clearCleanupFunctions,
  disableInterrupt,
  enableInterrupt,
  shouldStop,
  waitWithInterruptCheck,
  withInterruptHandler,
  displayInterruptHint,
  interruptibleForEach,
  getInterruptState,
  resetInterruptState,
  withTempFile,
  interruptibleTimeout,
};
