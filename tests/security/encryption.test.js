/**
 * 加密安全性测试: 验证加密强度和数据保护
 */

const crypto = require('crypto');

describe('Security: 加密安全性测试', () => {
  describe('AES-256-GCM 加密', () => {
    it('应该使用 AES-256-GCM 算法', async () => {
      const key = crypto.randomBytes(32); // 256 bits
      const data = Buffer.from('sensitive data');

      const encrypted = await encryptData(data, key);

      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.iv.length).toBe(12); // GCM 推荐 12 字节 IV
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.tag.length).toBe(16); // GCM 认证标签 16 字节
    });

    it('应该正确解密数据', async () => {
      const key = crypto.randomBytes(32);
      const originalData = Buffer.from('test data');

      const encrypted = await encryptData(originalData, key);
      const decrypted = await decryptData(encrypted, key);

      expect(decrypted).toEqual(originalData);
    });

    it('应该拒绝错误的认证标签', async () => {
      const key = crypto.randomBytes(32);
      const data = Buffer.from('test data');

      const encrypted = await encryptData(data, key);
      encrypted.tag[0] ^= 0xff; // 篡改认证标签

      await expect(decryptData(encrypted, key)).rejects.toThrow();
    });

    it('应该拒绝篡改的数据', async () => {
      const key = crypto.randomBytes(32);
      const data = Buffer.from('test data');

      const encrypted = await encryptData(data, key);
      encrypted.data[0] ^= 0xff; // 篡改密文

      await expect(decryptData(encrypted, key)).rejects.toThrow();
    });

    it('应该使用不同的 IV 每次加密', async () => {
      const key = crypto.randomBytes(32);
      const data = Buffer.from('test data');

      const encrypted1 = await encryptData(data, key);
      const encrypted2 = await encryptData(data, key);

      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
      expect(encrypted1.data).not.toEqual(encrypted2.data);
    });
  });

  describe('密钥派生', () => {
    it('应该从密码派生 256 位密钥', async () => {
      const password = 'my-secure-password';
      const salt = crypto.randomBytes(16);

      const key = await deriveKeyFromPassword(password, salt);

      expect(key.length).toBe(32); // 256 bits
    });

    it('相同的密码和盐应该派生相同的密钥', async () => {
      const password = 'test-password';
      const salt = crypto.randomBytes(16);

      const key1 = await deriveKeyFromPassword(password, salt);
      const key2 = await deriveKeyFromPassword(password, salt);

      expect(key1).toEqual(key2);
    });

    it('不同的盐应该派生不同的密钥', async () => {
      const password = 'test-password';
      const salt1 = crypto.randomBytes(16);
      const salt2 = crypto.randomBytes(16);

      const key1 = await deriveKeyFromPassword(password, salt1);
      const key2 = await deriveKeyFromPassword(password, salt2);

      expect(key1).not.toEqual(key2);
    });

    it('应该使用 PBKDF2 和足够多的迭代次数', async () => {
      const password = 'test-password';
      const salt = crypto.randomBytes(16);

      // 测试派生函数是否使用足够的迭代次数
      const start = Date.now();
      await deriveKeyFromPassword(password, salt);
      const duration = Date.now() - start;

      // 100,000 次迭代应该需要至少 100ms
      expect(duration).toBeGreaterThan(50);
    });
  });

  describe('随机密钥生成', () => {
    it('应该生成 256 位密钥', () => {
      const key = generateRandomKey();

      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // 256 bits
    });

    it('每次生成的密钥应该不同', () => {
      const key1 = generateRandomKey();
      const key2 = generateRandomKey();

      expect(key1).not.toEqual(key2);
    });

    it('生成的密钥应该具有足够的熵', () => {
      const key = generateRandomKey();
      const uniqueBytes = new Set(key);

      // 256 位密钥应该有足够的唯一字节
      expect(uniqueBytes.size).toBeGreaterThan(20);
    });
  });

  describe('密钥导出和导入', () => {
    it('应该正确导出和导入密钥', () => {
      const originalKey = generateRandomKey();
      const exported = exportKey(originalKey);
      const imported = importKey(exported);

      expect(imported).toEqual(originalKey);
    });

    it('导出的密钥应该是 Base64 编码的', () => {
      const key = generateRandomKey();
      const exported = exportKey(key);

      expect(exported).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('应该拒绝无效的 Base64', () => {
      expect(() => importKey('invalid-base64!@#')).toThrow();
    });
  });

  describe('密码强度验证', () => {
        it('应该接受强密码', () => {
      const result = validatePassword('StrongPass123');
      expect(result.valid).toBe(true);
    });

    it('应该拒绝短密码', () => {
      const result = validatePassword('short');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝纯数字密码', () => {
      const result = validatePassword('12345678');
      expect(result.valid).toBe(false);
    });

    it('应该拒绝纯字母密码', () => {
      const result = validatePassword('abcdefgh');
      expect(result.valid).toBe(false);
    });
  });

  describe('密钥轮换安全性', () => {
    it('轮换后旧密钥无法解密新数据', async () => {
      const oldKey = generateRandomKey();
      const newKey = generateRandomKey();
      const data = Buffer.from('sensitive data');

      // 用新密钥加密
      const encrypted = await encryptData(data, newKey);

      // 旧密钥应该无法解密
      await expect(decryptData(encrypted, oldKey)).rejects.toThrow();
    });

    it('轮换后新密钥无法解密旧数据', async () => {
      const oldKey = generateRandomKey();
      const newKey = generateRandomKey();
      const data = Buffer.from('sensitive data');

      // 用旧密钥加密
      const encrypted = await encryptData(data, oldKey);

      // 新密钥应该无法解密
      await expect(decryptData(encrypted, newKey)).rejects.toThrow();
    });
  });

  describe('侧信道攻击防护', () => {
    it('解密时间应该与输入无关（防时序攻击）', async () => {
      const key = generateRandomKey();
      const data1 = Buffer.alloc(1000, 'a');
      const data2 = Buffer.alloc(1000, 'b');

      const encrypted1 = await encryptData(data1, key);
      const encrypted2 = await encryptData(data2, key);

      const times = [];
      for (let i = 0; i < 100; i++) {
        const start = process.hrtime.bigint();
        await decryptData(encrypted1, key);
        const end = process.hrtime.bigint();
        times.push(Number(end - start));
      }

      // 计算标准差，应该相对较小（常数时间）
      const mean = times.reduce((a, b) => a + b) / times.length;
      const variance = times.reduce((a, b) => a + (b - mean) ** 2, 0) / times.length;
      const stdDev = Math.sqrt(variance);

      // 标准差应该小于平均值的 20%
      expect(stdDev).toBeLessThan(mean * 0.2);
    });
  });

  describe('加密元数据', () => {
        it('应该包含所有必需的元数据字段', async () => {
      const key = generateRandomKey();
      const data = Buffer.from('test');
      const encrypted = await encryptData(data, key);

      const metadata = createEncryptionMetadata(encrypted);

      expect(metadata).toHaveProperty('algorithm');
      expect(metadata).toHaveProperty('iv');
      expect(metadata).toHaveProperty('tag');
      expect(metadata).toHaveProperty('salt');
    });

    it('应该验证元数据完整性', () => {
      const metadata = {
        algorithm: 'aes-256-gcm',
        iv: crypto.randomBytes(12),
        tag: crypto.randomBytes(16),
        salt: crypto.randomBytes(16),
      };

      const result = validateMetadata(metadata);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝缺少字段的元数据', () => {
      const invalidMetadata = {
        algorithm: 'aes-256-gcm',
        // 缺少 iv, tag, salt
      };

      const result = validateMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
    });
  });

  describe('数据隐私保护', () => {
    it('加密后的数据不应该包含原始信息', async () => {
      const key = generateRandomKey();
      const data = Buffer.from('SecretMessage123');

      const encrypted = await encryptData(data, key);

      const encryptedString = encrypted.data.toString();
      expect(encryptedString).not.toContain('Secret');
      expect(encryptedString).not.toContain('Message');
    });

    it('应该加密 JSON 数据中的敏感字段', async () => {
      const key = generateRandomKey();
      const sensitiveData = {
        apiKey: 'sk-1234567890',
        password: 'my-password',
        messages: ['normal message'],
      };

      const encrypted = await encryptData(Buffer.from(JSON.stringify(sensitiveData)), key);

      const encryptedString = encrypted.data.toString();
      expect(encryptedString).not.toContain('sk-');
      expect(encryptedString).not.toContain('my-password');
    });
  });

  describe('内存安全', () => {
    it('应该安全地清除敏感数据', () => {
            const sensitiveData = Buffer.from('secret-password-123');
      securelyWipeBuffer(sensitiveData);

      expect(sensitiveData.toString()).not.toContain('secret');
    });
  });
});
