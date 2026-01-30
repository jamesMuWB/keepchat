/**
 * 端到端测试: 完整的同步和恢复流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { syncSession } from '../../src/session-sync/sync.js';
import { restoreSession } from '../../src/session-sync/restore.js';
import { listFiles } from '../../src/qiniu/list.js';
import { deleteFiles } from '../../src/qiniu/delete.js';

describe('E2E: 完整的同步和恢复流程', () => {
  let testSessionId;
  const testConfig = {
    accessKey: process.env.QINIU_ACCESS_KEY || 'test-access-key',
    secretKey: process.env.QINIU_SECRET_KEY || 'test-secret-key',
    bucket: process.env.QINIU_BUCKET || 'test-bucket',
    region: process.env.QINIU_REGION || 'z0',
  };

  // 测试用的会话数据
  const testSessionData = {
    sessionId: null, // 会在测试中生成
    version: 1,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    device: 'test-device',
    messages: [
      {
        role: 'user',
        content: '你好，请帮我创建一个 TypeScript 函数',
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content: '好的，这是一个示例函数...',
        timestamp: new Date().toISOString(),
      },
    ],
    context: {
      projectPath: '/Users/test/project',
      files: ['src/index.ts', 'src/utils.ts'],
      tasks: [],
    },
    meta: {
      title: '测试会话',
      tags: ['test', 'e2e'],
    },
  };

  beforeAll(async () => {
    // 生成测试会话 ID
    testSessionData.sessionId = generateTestSessionId();
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      const prefix = `sessions/${testSessionData.sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        const keys = files.map((f) => f.key);
        await deleteFiles(testConfig, keys);
      }
    } catch (error) {
      console.error('清理测试数据失败:', error.message);
    }
  });

  describe('同步流程', () => {
    it('应该成功同步新会话', async () => {
      const result = await syncSession(testSessionData, {
        config: testConfig,
        incremental: false,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(testSessionData.sessionId);
      expect(result.messageCount).toBe(2);
      expect(result.isNewSession).toBe(true);

      testSessionId = result.sessionId;
    });

    it('应该能从云端列出已同步的会话', async () => {
      const sessions = await listFiles(testConfig, {
        prefix: 'sessions/',
      });

      const syncedSession = sessions.find((s) => s.key.includes(testSessionId));

      expect(syncedSession).toBeDefined();
    });

    it('应该成功执行增量同步', async () => {
      // 添加新消息
      testSessionData.messages.push({
        role: 'user',
        content: '请添加错误处理',
        timestamp: new Date().toISOString(),
      });
      testSessionData.version = 2;
      testSessionData.modified = new Date().toISOString();

      const result = await syncSession(testSessionData, {
        config: testConfig,
        incremental: true,
      });

      expect(result.success).toBe(true);
      expect(result.isIncremental).toBe(true);
    });

    it('应该正确处理同步失败（配置错误）', async () => {
      const invalidConfig = {
        ...testConfig,
        accessKey: 'invalid-key',
      };

      await expect(
        syncSession(testSessionData, {
          config: invalidConfig,
        }),
      ).rejects.toThrow();
    });
  });

  describe('恢复流程', () => {
    it('应该成功恢复会话', async () => {
      const result = await restoreSession(testSessionId, {
        config: testConfig,
        mergeMode: 'new',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(testSessionId);
      expect(result.messages).toHaveLength(3);
      expect(result.context.projectPath).toBe('/Users/test/project');
    });

    it('应该正确处理会话完整性验证', async () => {
      const result = await restoreSession(testSessionId, {
        config: testConfig,
        verifyIntegrity: true,
      });

      expect(result.integrityVerified).toBe(true);
    });

    it('应该支持不同的合并模式', async () => {
      // 替换模式
      const replaceResult = await restoreSession(testSessionId, {
        config: testConfig,
        mergeMode: 'replace',
      });

      expect(replaceResult.mergeMode).toBe('replace');

      // 合并模式
      const mergeResult = await restoreSession(testSessionId, {
        config: testConfig,
        mergeMode: 'merge',
      });

      expect(mergeResult.mergeMode).toBe('merge');
    });

    it('应该正确处理不存在的会话', async () => {
      const fakeSessionId = generateTestSessionId();

      await expect(
        restoreSession(fakeSessionId, {
          config: testConfig,
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('应该正确处理密码错误的加密会话', async () => {
      // 这个测试需要先创建一个使用密码加密的会话
      // 然后尝试用错误的密码恢复
      // 暂时跳过，需要更多设置
      // TODO: 实现加密会话的测试
    });
  });

  describe('完整流程集成', () => {
    it('应该支持完整的同步-恢复-再同步流程', async () => {
      // 1. 首次同步
      const sessionId1 = generateTestSessionId();
      const session1 = { ...testSessionData, sessionId: sessionId1 };

      const sync1 = await syncSession(session1, {
        config: testConfig,
      });

      expect(sync1.success).toBe(true);

      // 2. 恢复会话
      const restored = await restoreSession(sessionId1, {
        config: testConfig,
        mergeMode: 'new',
      });

      expect(restored.success).toBe(true);

      // 3. 在恢复的会话中添加内容
      restored.messages.push({
        role: 'user',
        content: '这是恢复后添加的消息',
        timestamp: new Date().toISOString(),
      });

      // 4. 再次同步
      const sync2 = await syncSession(restored, {
        config: testConfig,
        incremental: true,
      });

      expect(sync2.success).toBe(true);

      // 5. 清理
      const prefix = `sessions/${sessionId1}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });

  describe('进度反馈', () => {
    it('应该正确报告同步进度', async () => {
      const progressUpdates = [];

      await syncSession(testSessionData, {
        config: testConfig,
        onProgress: (step, current, total) => {
          progressUpdates.push({ step, current, total });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty('step');
      expect(progressUpdates[0]).toHaveProperty('current');
      expect(progressUpdates[0]).toHaveProperty('total');
    });

    it('应该正确报告恢复进度', async () => {
      const progressUpdates = [];

      await restoreSession(testSessionId, {
        config: testConfig,
        onProgress: (step, current, total) => {
          progressUpdates.push({ step, current, total });
        },
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});

// 辅助函数：生成测试会话 ID
function generateTestSessionId() {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
