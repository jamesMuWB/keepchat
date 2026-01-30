/**
 * 性能测试: 大型会话(1000+ 条消息)的同步速度
 */

describe('Performance: 大型会话同步性能测试', () => {
  const testConfig = {
    accessKey: process.env.QINIU_ACCESS_KEY || 'test-access-key',
    secretKey: process.env.QINIU_SECRET_KEY || 'test-secret-key',
    bucket: process.env.QINIU_BUCKET || 'test-bucket',
    region: process.env.QINIU_REGION || 'z0',
  };

  // 生成大型会话数据的辅助函数
  function generateLargeSession(messageCount = 1000) {
    const messages = [];
    const codeSnippets = [
      "function example() { return 'hello'; }",
      'const arr = [1, 2, 3].map(x => x * 2);',
      'class MyClass { constructor() {} }',
      "import { Component } from 'react';",
      'export default function App() {}',
    ];

    for (let i = 0; i < messageCount; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      let content = `Message #${i + 1} - `;
      content +=
        role === 'user'
          ? '请帮我实现一个功能，需要处理大量数据和复杂逻辑。'
          : '好的，我来帮你实现。这是一个示例代码：\n```\n' +
            codeSnippets[i % codeSnippets.length] +
            '\n```';

      messages.push({
        role,
        content,
        timestamp: new Date(Date.now() - (messageCount - i) * 60000).toISOString(),
        metadata: {
          tokens: Math.floor(Math.random() * 500) + 100,
          model: 'claude-3-opus',
        },
      });
    }

    return {
      sessionId: null,
      version: 1,
      created: new Date(Date.now() - messageCount * 60000).toISOString(),
      modified: new Date().toISOString(),
      device: 'performance-test-device',
      messages,
      context: {
        projectPath: '/Users/test/large-project',
        files: Array.from({ length: 50 }, (_, i) => `src/module-${i}.ts`),
        tasks: Array.from({ length: 20 }, (_, i) => ({
          id: `task-${i}`,
          description: `Task ${i} description`,
          status: i % 3 === 0 ? 'completed' : 'pending',
        })),
        environment: {
          nodeVersion: 'v18.0.0',
          os: 'darwin',
          shell: 'zsh',
        },
      },
      meta: {
        title: '大型会话性能测试',
        tags: ['performance', 'test', 'large-session'],
        messageCount,
      },
    };
  }

  describe('数据压缩性能', () => {
    it('应该高效压缩 1000 条消息的 JSON 数据', async () => {
      const session = generateLargeSession(1000);
      const jsonData = Buffer.from(JSON.stringify(session));

      const startTime = Date.now();
      const compressed = await compressData(jsonData);
      const compressionTime = Date.now() - startTime;

      const originalSize = jsonData.length;
      const compressedSize = compressed.length;
      const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

      expect(compressionTime).toBeLessThan(5000); // 压缩应该在 5 秒内完成
      expect(compressedSize).toBeLessThan(originalSize); // 压缩后应该更小

      console.log(`压缩性能:`);
      console.log(`  原始大小: ${(originalSize / 1024).toFixed(2)} KB`);
      console.log(`  压缩后: ${(compressedSize / 1024).toFixed(2)} KB`);
      console.log(`  压缩率: ${compressionRatio}%`);
      console.log(`  压缩耗时: ${compressionTime}ms`);
    });

    it('应该高效压缩 2000 条消息的 JSON 数据', async () => {
      const session = generateLargeSession(2000);
      const jsonData = Buffer.from(JSON.stringify(session));

      const startTime = Date.now();
      const compressed = await compressData(jsonData);
      const compressionTime = Date.now() - startTime;

      expect(compressionTime).toBeLessThan(10000); // 10 秒内完成

      console.log(`2000 条消息压缩耗时: ${compressionTime}ms`);
    });
  });

  describe('加密性能', () => {
    it('应该高效加密压缩后的大型会话数据', async () => {
      const session = generateLargeSession(1000);
      const jsonData = Buffer.from(JSON.stringify(session));
      const compressed = await compressData(jsonData);
      const key = generateRandomKey();

      const startTime = Date.now();
      const encrypted = await encryptData(compressed, key);
      const encryptionTime = Date.now() - startTime;

      expect(encryptionTime).toBeLessThan(3000); // 加密应该在 3 秒内完成

      console.log(`加密性能:`);
      console.log(`  数据大小: ${(compressed.length / 1024).toFixed(2)} KB`);
      console.log(`  加密耗时: ${encryptionTime}ms`);
      console.log(
        `  加密速度: ${(compressed.length / 1024 / (encryptionTime / 1000)).toFixed(2)} KB/s`,
      );
    });
  });

  describe('同步性能', () => {
    let largeSessionId;

    afterAll(async () => {
      // 清理测试数据
      if (largeSessionId) {
        try {
          const prefix = `sessions/${largeSessionId}/`;
          const files = await listFiles(testConfig, { prefix });
          if (files.length > 0) {
            await deleteFiles(
              testConfig,
              files.map((f) => f.key),
            );
          }
        } catch (error) {
          console.error('清理测试数据失败:', error.message);
        }
      }
    });

    it('应该在合理时间内同步 1000 条消息的会话', async () => {
      const session = generateLargeSession(1000);
      session.sessionId = `perf-test-${Date.now()}`;
      largeSessionId = session.sessionId;

      const startTime = Date.now();
      const result = await syncSession(session, {
        config: testConfig,
        onProgress: (step, current, total) => {
          console.log(`  [进度] ${step}: ${current}/${total}`);
        },
      });
      const syncTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(syncTime).toBeLessThan(30000); // 同步应该在 30 秒内完成

      console.log(`同步性能 (1000 条消息):`);
      console.log(`  总耗时: ${syncTime}ms`);
      console.log(`  平均每条消息: ${(syncTime / 1000).toFixed(2)}ms`);
      console.log(
        `  上传大小: ${result.uploadSize ? (result.uploadSize / 1024).toFixed(2) + ' KB' : 'N/A'}`,
      );
    }, 60000); // 设置超时时间为 60 秒

    it('应该在合理时间内恢复 1000 条消息的会话', async () => {
      if (!largeSessionId) {
        console.log('跳过：需要先同步会话');
        return;
      }

      const startTime = Date.now();
      const result = await restoreSession(largeSessionId, {
        config: testConfig,
        mergeMode: 'new',
        onProgress: (step, current, total) => {
          console.log(`  [进度] ${step}: ${current}/${total}`);
        },
      });
      const restoreTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.messages).toHaveLength(1000);
      expect(restoreTime).toBeLessThan(30000); // 恢复应该在 30 秒内完成

      console.log(`恢复性能 (1000 条消息):`);
      console.log(`  总耗时: ${restoreTime}ms`);
      console.log(`  平均每条消息: ${(restoreTime / 1000).toFixed(2)}ms`);
    }, 60000);
  });

  describe('内存使用', () => {
    it('应该在可接受内存范围内处理大型会话', async () => {
      const session = generateLargeSession(1000);
      const jsonData = Buffer.from(JSON.stringify(session));

      const startMemory = process.memoryUsage();
      const compressed = await compressData(jsonData);
      const key = generateRandomKey();
      const encrypted = await encryptData(compressed, key);
      const endMemory = process.memoryUsage();

      const memoryIncrease = {
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
        external: (endMemory.external - startMemory.external) / 1024 / 1024,
        rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
      };

      console.log(`内存使用:`);
      console.log(`  堆内存增长: ${memoryIncrease.heapUsed.toFixed(2)} MB`);
      console.log(`  外部内存增长: ${memoryIncrease.external.toFixed(2)} MB`);
      console.log(`  RSS 增长: ${memoryIncrease.rss.toFixed(2)} MB`);

      // 内存增长应该在合理范围内（< 200MB）
      expect(memoryIncrease.rss).toBeLessThan(200);
    });
  });

  describe('增量同步性能', () => {
    let sessionId;

    afterAll(async () => {
      if (sessionId) {
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
          console.error('清理测试数据失败:', error.message);
        }
      }
    });

    it('增量同步应该比完整同步更快', async () => {
      const session = generateLargeSession(1000);
      sessionId = `incremental-perf-${Date.now()}`;
      session.sessionId = sessionId;

      // 首次完整同步
      const fullSyncStart = Date.now();
      await syncSession(session, { config: testConfig });
      const fullSyncTime = Date.now() - fullSyncStart;

      // 添加少量新消息
      session.messages.push(
        { role: 'user', content: 'New message 1', timestamp: new Date().toISOString() },
        { role: 'assistant', content: 'New response 1', timestamp: new Date().toISOString() },
      );
      session.version = 2;

      // 增量同步
      const incrementalSyncStart = Date.now();
      await syncSession(session, { config: testConfig, incremental: true });
      const incrementalSyncTime = Date.now() - incrementalSyncStart;

      console.log(`同步性能对比:`);
      console.log(`  完整同步: ${fullSyncTime}ms`);
      console.log(`  增量同步: ${incrementalSyncTime}ms`);
      console.log(`  性能提升: ${((1 - incrementalSyncTime / fullSyncTime) * 100).toFixed(2)}%`);

      expect(incrementalSyncTime).toBeLessThan(fullSyncTime);
    }, 90000);
  });

  describe('分片上传性能', () => {
    it('应该正确处理超过分片阈值的大型文件', async () => {
      const veryLargeSession = generateLargeSession(5000); // 生成超大文件
      const jsonData = Buffer.from(JSON.stringify(veryLargeSession));

      console.log(`超大文件大小: ${(jsonData.length / 1024 / 1024).toFixed(2)} MB`);

      // 测试压缩
      const startTime = Date.now();
      const compressed = await compressData(jsonData);
      const compressionTime = Date.now() - startTime;

      console.log(`压缩后大小: ${(compressed.length / 1024 / 1024).toFixed(2)} MB`);
      console.log(`压缩耗时: ${compressionTime}ms`);

      // 确保压缩有效
      expect(compressed.length).toBeLessThan(jsonData.length);
    }, 120000);
  });
});
