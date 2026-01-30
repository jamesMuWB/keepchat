/**
 * 冲突场景测试: 多设备并发修改
 */

describe('E2E: 冲突场景测试', () => {
  let testSessionId;
  const testConfig = {
    accessKey: process.env.QINIU_ACCESS_KEY || 'test-access-key',
    secretKey: process.env.QINIU_SECRET_KEY || 'test-secret-key',
    bucket: process.env.QINIU_BUCKET || 'test-bucket',
    region: process.env.QINIU_REGION || 'z0',
  };

  // 模拟设备 A 的会话
  const deviceA_Session = {
    sessionId: null,
    version: 1,
    device: 'device-a',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: '设备 A: 创建会话',
        timestamp: new Date().toISOString(),
      },
    ],
    context: { projectPath: '/device-a/project' },
  };

  // 模拟设备 B 的会话
  const deviceB_Session = {
    sessionId: null,
    version: 1,
    device: 'device-b',
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    messages: [
      {
        role: 'user',
        content: '设备 B: 创建会话',
        timestamp: new Date().toISOString(),
      },
    ],
    context: { projectPath: '/device-b/project' },
  };

  beforeAll(async () => {
    testSessionId = `conflict-test-${Date.now()}`;
    deviceA_Session.sessionId = testSessionId;
    deviceB_Session.sessionId = testSessionId;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      const prefix = `sessions/${testSessionId}/`;
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
  });

  describe('基本冲突检测', () => {
    it('应该检测到版本号冲突', async () => {
      // 设备 A 同步
      deviceA_Session.modified = new Date().toISOString();
      const syncA = await syncSession(deviceA_Session, {
        config: testConfig,
      });

      expect(syncA.success).toBe(true);

      // 设备 B 也尝试同步（未更新版本号）
      deviceB_Session.modified = new Date(Date.now() + 1000).toISOString();

      // 模拟从云端获取的会话
      const cloudSession = await restoreSession(testSessionId, {
        config: testConfig,
        mergeMode: 'new',
      });

      // 检测冲突
      const conflict = await detectConflict(deviceB_Session, cloudSession);

      expect(conflict).toBeDefined();
      expect(conflict.hasConflict).toBe(true);
      expect(conflict.type).toBe('version');
    });
  });

  describe('并发修改冲突', () => {
    it('应该检测到同时修改的冲突', async () => {
      // 设备 A 同步初始会话
      const sessionId = `concurrent-${Date.now()}`;
      deviceA_Session.sessionId = sessionId;

      await syncSession(deviceA_Session, {
        config: testConfig,
      });

      // 设备 A 添加新消息
      deviceA_Session.messages.push({
        role: 'user',
        content: '设备 A 添加的消息',
        timestamp: new Date().toISOString(),
      });
      deviceA_Session.version = 2;

      // 设备 B 也添加不同的消息（模拟并发）
      deviceB_Session.sessionId = sessionId;
      deviceB_Session.messages.push({
        role: 'user',
        content: '设备 B 添加的消息',
        timestamp: new Date().toISOString(),
      });
      deviceB_Session.version = 2;

      // 设备 A 先同步
      await syncSession(deviceA_Session, {
        config: testConfig,
      });

      // 设备 B 尝试同步，应该检测到冲突
      const cloudSession = await restoreSession(sessionId, {
        config: testConfig,
        mergeMode: 'new',
      });

      const conflict = await detectConflict(deviceB_Session, cloudSession);

      expect(conflict.hasConflict).toBe(true);
      expect(conflict.type).toBe('concurrent');

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });

  describe('冲突解决策略', () => {
    it('应该支持保留本地版本', async () => {
      const sessionId = `local-wins-${Date.now()}`;

      // 创建云端会话
      const cloudSession = { ...deviceA_Session, sessionId, version: 2 };
      await syncSession(cloudSession, { config: testConfig });

      // 创建本地会话（版本号相同但内容不同）
      const localSession = { ...deviceB_Session, sessionId, version: 1 };

      const conflict = await detectConflict(localSession, cloudSession);

      // 解决冲突：保留本地版本
      const resolved = await resolveConflict(conflict, {
        strategy: 'local',
        config: testConfig,
      });

      expect(resolved.strategy).toBe('local');
      expect(resolved.session.version).toBe(2);

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });

    it('应该支持保留云端版本', async () => {
      const sessionId = `cloud-wins-${Date.now()}`;

      // 创建云端会话
      const cloudSession = { ...deviceA_Session, sessionId, version: 2 };
      await syncSession(cloudSession, { config: testConfig });

      // 创建本地会话
      const localSession = { ...deviceB_Session, sessionId, version: 1 };

      const conflict = await detectConflict(localSession, cloudSession);

      // 解决冲突：保留云端版本
      const resolved = await resolveConflict(conflict, {
        strategy: 'cloud',
        config: testConfig,
      });

      expect(resolved.strategy).toBe('cloud');

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });

    it('应该支持手动合并', async () => {
      const sessionId = `manual-merge-${Date.now()}`;

      // 创建云端会话
      const cloudSession = { ...deviceA_Session, sessionId, version: 2 };
      await syncSession(cloudSession, { config: testConfig });

      // 创建本地会话（有不同的消息）
      const localSession = { ...deviceB_Session, sessionId, version: 1 };
      localSession.messages.push({
        role: 'user',
        content: '本地独有的消息',
        timestamp: new Date().toISOString(),
      });

      const conflict = await detectConflict(localSession, cloudSession);

      // 手动合并
      const resolved = await resolveConflict(conflict, {
        strategy: 'manual',
        config: testConfig,
        manualSelection: {
          messages: 'local', // 使用本地消息
          context: 'cloud', // 使用云端上下文
        },
      });

      expect(resolved.strategy).toBe('manual');
      expect(resolved.session.messages).toEqual(localSession.messages);
      expect(resolved.session.context).toEqual(cloudSession.context);

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });

  describe('自动合并简单冲突', () => {
    it('应该自动合并仅一方有新消息的冲突', async () => {
      const sessionId = `auto-merge-${Date.now()}`;

      // 云端会话
      const cloudSession = {
        ...deviceA_Session,
        sessionId,
        version: 2,
        messages: [
          {
            role: 'user',
            content: '共同消息 1',
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await syncSession(cloudSession, { config: testConfig });

      // 本地会话（在云端基础上添加了新消息）
      const localSession = {
        ...cloudSession,
        messages: [
          ...cloudSession.messages,
          {
            role: 'user',
            content: '本地新消息',
            timestamp: new Date().toISOString(),
          },
        ],
        version: 2,
      };

      const conflict = await detectConflict(localSession, cloudSession);

      // 应该可以自动合并
      const resolved = await resolveConflict(conflict, {
        strategy: 'auto',
        config: testConfig,
      });

      expect(resolved.strategy).toBe('auto');
      expect(resolved.session.messages).toHaveLength(2);

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });

  describe('冲突备份', () => {
    it('应该在解决冲突前自动备份', async () => {
      const sessionId = `backup-${Date.now()}`;

      // 创建云端会话
      const cloudSession = { ...deviceA_Session, sessionId, version: 2 };
      await syncSession(cloudSession, { config: testConfig });

      const localSession = { ...deviceB_Session, sessionId, version: 1 };
      const conflict = await detectConflict(localSession, cloudSession);

      // 解决冲突时应该创建备份
      const resolved = await resolveConflict(conflict, {
        strategy: 'local',
        config: testConfig,
        createBackup: true,
      });

      expect(resolved.backupCreated).toBe(true);
      expect(resolved.backupId).toBeDefined();

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });

  describe('多设备场景', () => {
    it('应该处理三设备冲突', async () => {
      const sessionId = `three-devices-${Date.now()}`;

      // 设备 A 同步
      const sessionA = {
        ...deviceA_Session,
        sessionId,
        version: 1,
        device: 'device-a',
      };
      await syncSession(sessionA, { config: testConfig });

      // 设备 B 和 C 同时修改
      const sessionB = {
        ...sessionA,
        version: 2,
        device: 'device-b',
        messages: [
          ...sessionA.messages,
          { role: 'user', content: 'B 的消息', timestamp: new Date().toISOString() },
        ],
      };

      const sessionC = {
        ...sessionA,
        version: 2,
        device: 'device-c',
        messages: [
          ...sessionA.messages,
          { role: 'user', content: 'C 的消息', timestamp: new Date().toISOString() },
        ],
      };

      // B 先同步
      await syncSession(sessionB, { config: testConfig });

      // C 尝试同步，应该检测到冲突
      const cloudSession = await restoreSession(sessionId, {
        config: testConfig,
        mergeMode: 'new',
      });

      const conflict = await detectConflict(sessionC, cloudSession);

      expect(conflict.hasConflict).toBe(true);

      // 清理
      const prefix = `sessions/${sessionId}/`;
      const files = await listFiles(testConfig, { prefix });
      if (files.length > 0) {
        await deleteFiles(
          testConfig,
          files.map((f) => f.key),
        );
      }
    });
  });
});
