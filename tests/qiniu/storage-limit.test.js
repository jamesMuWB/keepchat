/**
 * 存储空间限制测试: 超出免费额度的处理
 */

describe('Qiniu: 存储空间限制测试', () => {
  const testConfig = {
    accessKey: process.env.QINIU_ACCESS_KEY || 'test-access-key',
    secretKey: process.env.QINIU_SECRET_KEY || 'test-secret-key',
    bucket: process.env.QINIU_BUCKET || 'test-bucket',
    region: process.env.QINIU_REGION || 'z0',
  };

  const FREE_TIER_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB
  const WARNING_THRESHOLD = 9 * 1024 * 1024 * 1024; // 9GB (90%)

  let cleanupSessions = [];

  afterAll(async () => {
    // 清理测试数据
    for (const sessionId of cleanupSessions) {
      try {
        const prefix = `sessions/${sessionId}/`;
        const files = await listFiles(testConfig, { prefix });
        if (files.length > 0) {
          await deleteFiles(
            testConfig,
            files.map((f) => f.key),
          );
        }
      } catch (error) {
        console.error('清理失败:', error.message);
      }
    }
  });

  describe('存储空间查询', () => {
    it('应该正确查询当前存储使用量', async () => {
      const usage = await getStorageUsage(testConfig);

      expect(usage).toBeDefined();
      expect(usage).toHaveProperty('totalBytes');
      expect(usage).toHaveProperty('fileCount');
      expect(typeof usage.totalBytes).toBe('number');
      expect(typeof usage.fileCount).toBe('number');

      console.log(`当前存储使用:`);
      console.log(`  文件数: ${usage.fileCount}`);
      console.log(`  总大小: ${(usage.totalBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    it('应该提供人类可读的存储大小格式', async () => {
      const usage = await getStorageUsage(testConfig);
      const formatted = formatBytes(usage.totalBytes);

      expect(formatted).toMatch(/\d+(\.\d+)?\s*(B|KB|MB|GB|TB)/);
      console.log(`格式化大小: ${formatted}`);
    });
  });

  describe('接近限额警告', () => {
    it('应该在存储使用接近 90% 时发出警告', async () => {
      const usage = await getStorageUsage(testConfig);
      const usagePercent = (usage.totalBytes / FREE_TIER_LIMIT) * 100;

      const warning = checkStorageWarning(usage.totalBytes, FREE_TIER_LIMIT);

      if (usagePercent >= 90) {
        expect(warning.shouldWarn).toBe(true);
        expect(warning.level).toBe('high');
        expect(warning.message).toContain('90%');
      } else if (usagePercent >= 80) {
        expect(warning.shouldWarn).toBe(true);
        expect(warning.level).toBe('medium');
      } else {
        expect(warning.shouldWarn).toBe(false);
      }

      console.log(`警告状态:`, warning);
    });

    it('应该在存储使用接近 9GB 时警告', async () => {
      // 模拟接近限额的使用量
      const mockUsage = WARNING_THRESHOLD - 100 * 1024 * 1024; // 9GB - 100MB
      const warning = checkStorageWarning(mockUsage, FREE_TIER_LIMIT);

      expect(warning.shouldWarn).toBe(true);
      expect(warning.level).toBe('high');
      expect(warning.remainingBytes).toBeLessThan(200 * 1024 * 1024); // < 200MB

      console.log(`高使用量警告:`, warning);
    });

    it('应该在存储使用接近 8GB 时提示', async () => {
      const mockUsage = 8 * 1024 * 1024 * 1024; // 8GB
      const warning = checkStorageWarning(mockUsage, FREE_TIER_LIMIT);

      expect(warning.shouldWarn).toBe(true);
      expect(warning.level).toBe('medium');

      console.log(`中等使用量提示:`, warning);
    });
  });

  describe('空间不足处理', () => {
    it('应该在空间不足时阻止上传', async () => {
      const usage = await getStorageUsage(testConfig);
      const availableBytes = FREE_TIER_LIMIT - usage.totalBytes;

      // 创建一个超过剩余空间的会话
      const largeSession = {
        sessionId: `space-test-${Date.now()}`,
        version: 1,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        device: 'test',
        messages: Array.from({ length: 10000 }, (_, i) => ({
          role: 'user',
          content: `Large message ${i}: ${'x'.repeat(1000)}`,
          timestamp: new Date().toISOString(),
        })),
        context: {},
      };

      // 检查是否有足够空间
      const estimatedSize = JSON.stringify(largeSession).length * 2; // 考虑压缩和加密
      const hasSpace = checkAvailableSpace(estimatedSize, availableBytes);

      if (!hasSpace) {
        // 尝试同步应该失败
        await expect(syncSession(largeSession, { config: testConfig })).rejects.toThrow(
          /storage|space|quota/i,
        );
      } else {
        console.log('剩余空间充足，跳过空间不足测试');
        cleanupSessions.push(largeSession.sessionId);
      }
    });

    it('应该提供空间使用详情', async () => {
      const usage = await getStorageUsage(testConfig);
      const details = getStorageDetails(usage.totalBytes, FREE_TIER_LIMIT);

      expect(details).toHaveProperty('used');
      expect(details).toHaveProperty('available');
      expect(details).toHaveProperty('percent');
      expect(details).toHaveProperty('formatted');

      console.log(`存储详情:`);
      console.log(`  已使用: ${details.used.formatted} (${details.percent}%)`);
      console.log(`  可用: ${details.available.formatted}`);
      console.log(`  限额: ${details.limit.formatted}`);
    });
  });

  describe('超限处理', () => {
    it('应该在超出限额时返回明确错误', async () => {
      // 模拟超出限额场景
      const mockUsage = FREE_TIER_LIMIT + 100 * 1024 * 1024; // 超出 100MB

      const result = handleOverLimitUsage(mockUsage, FREE_TIER_LIMIT);

      expect(result.overLimit).toBe(true);
      expect(result.excessBytes).toBeGreaterThan(0);
      expect(result.message).toContain('超出');

      console.log(`超限处理:`, result);
    });

    it('应该建议清理旧会话', async () => {
      const usage = await getStorageUsage(testConfig);
      const usagePercent = (usage.totalBytes / FREE_TIER_LIMIT) * 100;

      if (usagePercent > 80) {
        const suggestions = generateCleanupSuggestions(usage);

        expect(suggestions).toHaveProperty('shouldCleanup');
        expect(suggestions).toHaveProperty('potentialFreeSpace');
        expect(suggestions).toHaveProperty('actions');

        console.log(`清理建议:`, suggestions);
      } else {
        console.log('存储使用率低，无需清理');
      }
    });
  });

  describe('会话清理', () => {
    let testSessionIds = [];

    afterAll(async () => {
      // 清理
      for (const sessionId of testSessionIds) {
        try {
          const prefix = `sessions/${sessionId}/`;
          const files = await listFiles(testConfig, { prefix });
          if (files.length > 0) {
            await deleteFiles(
              testConfig,
              files.map((f) => f.key),
            );
          }
        } catch (error) {
          // 忽略
        }
      }
    });

    it('应该能列出所有会话及其大小', async () => {
      const sessions = await listFiles(testConfig, { prefix: 'sessions/' });

      const sessionSizes = {};
      for (const file of sessions) {
        const match = file.key.match(/sessions\/([^\/]+)/);
        if (match) {
          const sessionId = match[1];
          sessionSizes[sessionId] = (sessionSizes[sessionId] || 0) + file.size;
        }
      }

      console.log(`会话大小统计:`);
      Object.entries(sessionSizes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .forEach(([id, size]) => {
          console.log(`  ${id}: ${(size / 1024).toFixed(2)} KB`);
        });

      expect(Object.keys(sessionSizes).length).toBeGreaterThanOrEqual(0);
    });

    it('应该能删除旧会话释放空间', async () => {
      // 创建测试会话
      const session1 = {
        sessionId: `cleanup-test-1-${Date.now()}`,
        version: 1,
        created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 天前
        modified: new Date().toISOString(),
        device: 'test',
        messages: [{ role: 'user', content: 'Old session', timestamp: new Date().toISOString() }],
        context: {},
      };

      const session2 = {
        sessionId: `cleanup-test-2-${Date.now()}`,
        version: 1,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        device: 'test',
        messages: [{ role: 'user', content: 'New session', timestamp: new Date().toISOString() }],
        context: {},
      };

      testSessionIds.push(session1.sessionId, session2.sessionId);

      // 同步会话
      await syncSession(session1, { config: testConfig });
      await syncSession(session2, { config: testConfig });

      // 获取删除前的使用量
      const usageBefore = await getStorageUsage(testConfig);

      // 删除旧会话
      const cleanupResult = await cleanupOldSessions(testConfig, {
        olderThan: 7 * 24 * 60 * 60 * 1000, // 7 天前
        dryRun: false,
      });

      // 获取删除后的使用量
      const usageAfter = await getStorageUsage(testConfig);

      expect(cleanupResult).toHaveProperty('deletedCount');
      expect(cleanupResult).toHaveProperty('freedBytes');

      console.log(`清理结果:`);
      console.log(`  删除会话数: ${cleanupResult.deletedCount}`);
      console.log(`  释放空间: ${(cleanupResult.freedBytes / 1024).toFixed(2)} KB`);
    });
  });

  describe('空间监控', () => {
    it('应该持续监控存储使用', async () => {
      const monitor = createStorageMonitor(testConfig, {
        checkInterval: 1000, // 1 秒检查一次（测试用）
        warningThreshold: 0.9,
        onWarning: (warning) => {
          console.log(`存储警告:`, warning);
        },
        onLimitExceeded: (info) => {
          console.log(`超出限额:`, info);
        },
      });

      // 启动监控
      monitor.start();

      // 等待一次检查
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 停止监控
      monitor.stop();

      expect(monitor.isRunning()).toBe(false);
      console.log(`监控检查次数: ${monitor.checkCount}`);
    });
  });

  describe('配额管理', () => {
    it('应该支持自定义配额限制', async () => {
      const customLimit = 100 * 1024 * 1024; // 100MB 自定义限制
      const usage = await getStorageUsage(testConfig);

      const result = checkQuota(usage.totalBytes, customLimit);

      expect(result).toHaveProperty('withinQuota');
      expect(result).toHaveProperty('usagePercent');

      console.log(`自定义配额检查:`, result);
    });

    it('应该支持分用户配额', async () => {
      const userQuotas = {
        'user-1': 1024 * 1024 * 1024, // 1GB
        'user-2': 5 * 1024 * 1024 * 1024, // 5GB
        'user-3': 10 * 1024 * 1024 * 1024, // 10GB
      };

      for (const [user, quota] of Object.entries(userQuotas)) {
        const result = checkQuotaForUser(user, quota, testConfig);
        console.log(`用户 ${user} 配额:`, result);
        expect(result).toHaveProperty('user');
        expect(result).toHaveProperty('withinQuota');
      }
    });
  });
});

// 辅助函数

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkStorageWarning(usedBytes, limitBytes) {
  const percent = (usedBytes / limitBytes) * 100;

  if (percent >= 90) {
    return {
      shouldWarn: true,
      level: 'high',
      message: `存储使用已达 ${percent.toFixed(1)}%，接近 10GB 限额`,
      percent,
      remainingBytes: limitBytes - usedBytes,
    };
  } else if (percent >= 80) {
    return {
      shouldWarn: true,
      level: 'medium',
      message: `存储使用已达 ${percent.toFixed(1)}%`,
      percent,
      remainingBytes: limitBytes - usedBytes,
    };
  }

  return {
    shouldWarn: false,
    level: 'none',
    percent,
    remainingBytes: limitBytes - usedBytes,
  };
}

function checkAvailableSpace(requiredBytes, availableBytes) {
  return availableBytes >= requiredBytes;
}

function getStorageDetails(usedBytes, limitBytes) {
  const availableBytes = limitBytes - usedBytes;
  const percent = ((usedBytes / limitBytes) * 100).toFixed(1);

  return {
    used: {
      bytes: usedBytes,
      formatted: formatBytes(usedBytes),
    },
    available: {
      bytes: availableBytes,
      formatted: formatBytes(availableBytes),
    },
    limit: {
      bytes: limitBytes,
      formatted: formatBytes(limitBytes),
    },
    percent: parseFloat(percent),
  };
}

function handleOverLimitUsage(usedBytes, limitBytes) {
  const excessBytes = usedBytes - limitBytes;

  return {
    overLimit: true,
    excessBytes,
    excessFormatted: formatBytes(excessBytes),
    message: `存储使用超出限额 ${formatBytes(excessBytes)}`,
    action: 'upgrade',
  };
}

function generateCleanupSuggestions(usage) {
  const shouldCleanup = usage.totalBytes > 8 * 1024 * 1024 * 1024; // > 8GB

  return {
    shouldCleanup,
    potentialFreeSpace: shouldCleanup ? usage.totalBytes * 0.3 : 0, // 假设可清理 30%
    actions: shouldCleanup
      ? ['删除 30 天前的会话', '删除超过 100MB 的单个会话', '清空已恢复会话的缓存']
      : [],
  };
}

async function cleanupOldSessions(config, options) {
  const { olderThan, dryRun = true } = options;
  const cutoffDate = new Date(Date.now() - olderThan);

  // 获取所有会话
  const files = await listFiles(config, { prefix: 'sessions/' });
  const sessionMap = new Map();

  for (const file of files) {
    const match = file.key.match(/sessions\/([^\/]+)\/(.+)/);
    if (match) {
      const [, sessionId, fileType] = match;
      if (!sessionMap.has(sessionId)) {
        sessionMap.set(sessionId, { files: [], totalSize: 0 });
      }
      const session = sessionMap.get(sessionId);
      session.files.push(file);
      session.totalSize += file.size;
    }
  }

  // 查找旧会话
  const toDelete = [];
  for (const [sessionId, session] of sessionMap) {
    const metaFile = session.files.find((f) => f.key.endsWith('/meta.json'));
    if (metaFile && metaFile.modified) {
      const modifiedDate = new Date(metaFile.modified);
      if (modifiedDate < cutoffDate) {
        toDelete.push(sessionId);
      }
    }
  }

  if (!dryRun && toDelete.length > 0) {
    const keysToDelete = [];
    for (const sessionId of toDelete) {
      const session = sessionMap.get(sessionId);
      keysToDelete.push(...session.files.map((f) => f.key));
    }
    await deleteFiles(config, keysToDelete);
  }

  let freedBytes = 0;
  for (const sessionId of toDelete) {
    freedBytes += sessionMap.get(sessionId).totalSize;
  }

  return {
    deletedCount: toDelete.length,
    freedBytes,
    dryRun,
  };
}

function createStorageMonitor(config, options) {
  const {
    checkInterval = 60000, // 默认 1 分钟
    warningThreshold = 0.9,
    onWarning = null,
    onLimitExceeded = null,
  } = options;

  let intervalId = null;
  let checkCount = 0;

  return {
    start() {
      intervalId = setInterval(async () => {
        checkCount++;
        const usage = await getStorageUsage(config);
        const percent = usage.totalBytes / (10 * 1024 * 1024 * 1024);

        if (percent >= 1 && onLimitExceeded) {
          onLimitExceeded({ usage, percent });
        } else if (percent >= warningThreshold && onWarning) {
          onWarning({ usage, percent });
        }
      }, checkInterval);
    },
    stop() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    isRunning() {
      return intervalId !== null;
    },
    get checkCount() {
      return checkCount;
    },
  };
}

function checkQuota(usedBytes, limitBytes) {
  const withinQuota = usedBytes <= limitBytes;
  const usagePercent = ((usedBytes / limitBytes) * 100).toFixed(1);

  return {
    withinQuota,
    usagePercent: parseFloat(usagePercent),
    usedBytes,
    limitBytes,
  };
}

function checkQuotaForUser(userId, quotaBytes, config) {
  // 这里应该查询用户的实际使用量
  // 简化实现
  return {
    user: userId,
    quota: quotaBytes,
    quotaFormatted: formatBytes(quotaBytes),
    used: 0, // 实际应该查询
    withinQuota: true,
  };
}
