const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * 获取或生成加密密钥
 */
async function getOrGenerateKey() {
  const keyPath = path.join(
    require('../../config/config-manager').getConfigDir(),
    '.config-encryption-key',
  );

  try {
    await fs.access(keyPath);
    const key = await fs.readFile(keyPath, 'utf8');
    return key;
  } catch {
    // 生成新的加密密钥
    const newKey = crypto.randomBytes(32).toString('hex');
    await fs.writeFile(keyPath, newKey, 'utf8');

    // 设置文件权限（仅用户可读写）
    const { chmod } = require('fs');
    chmod(keyPath, 0o600, (err) => {
      if (err) {
        console.warn('Failed to set file permissions:', err.message);
      }
    });

    return newKey;
  }
}

/**
 * 加密配置字段
 */
async function encryptConfigField({
  plaintext,
  keyPath,
  field,
  source,
  sessionId = null,
  password = null,
  apiKey = null,
  mode = 'apikey',
  salt = null,
  iv = null,
  authTag = null,
  algorithm = null,
  keyDerivation = null,
}) {
  const key = await getOrGenerateKey();

  // 如果没有提供加密参数，生成它们
  const encryptionParams = salt
    ? { salt, iv, authTag, algorithm, keyDerivation }
    : generateEncryptionParams();

  // 加密
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(encryptionParams.iv, 'hex'),
  );

  let plaintextBuffer;
  if (typeof plaintext === 'string') {
    plaintextBuffer = Buffer.from(plaintext, 'utf8');
  } else {
    plaintextBuffer = plaintext;
  }

  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);

  const authTagBuffer = cipher.getAuthTag();

  return {
    encrypted: ciphertext.toString('hex'),
    alt: encryptionParams.salt,
    iv: encryptionParams.iv,
    authTag: encryptionParams.authTag,
    algorithm: encryptionParams.algorithm,
    keyDerivation: encryptionParams.keyDerivation,
  };
}

/**
 * 解密配置字段
 */
async function decryptConfigField({
  encrypted,
  keyPath,
  field,
  source,
  sessionId = null,
  password = null,
  apiKey = null,
  mode = 'apikey',
  salt = null,
  iv = null,
  authTag = null,
  algorithm = null,
  keyDerivation = null,
}) {
  const key = await getOrGenerateKey();

  // 解密
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex'),
  );

  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  const ciphertext = Buffer.from(encrypted, 'hex');
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  try {
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(
      `Failed to decrypt ${source} ${field}: Decryption error - data may be corrupted or wrong key`,
    );
  }
}

/**
 * 生成加密参数
 */
function generateEncryptionParams() {
  const iv = crypto.randomBytes(12);
  const salt = crypto.randomBytes(16);

  return {
    iv: iv.toString('hex'),
    salt: salt.toString('hex'),
    authTag: '', // 将在加密时填充
    algorithm: 'aes-256-gcm',
    keyDerivation: 'simple', // 使用简单密钥派生
  };
}

/**
 * 验证加密密钥
 */
function validateEncryptionKey() {
  const keyPath = path.join(
    require('../../config/config-manager').getConfigDir(),
    '.config-encryption-key',
  );

  try {
    const key = require('fs').readFileSync(keyPath, 'utf8');

    // 验证密钥长度（32 字节 = 64 个 hex 字符）
    if (key.length !== 64) {
      return {
        valid: false,
        error: 'Encryption key must be 32 bytes (64 hex characters)',
      };
    }

    // 验证 hex 格式
    const hexRegex = /^[0-9a-f]{64}$/i;
    if (!hexRegex.test(key)) {
      return {
        valid: false,
        error: 'Encryption key must be valid hex string',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * 重新生成加密密钥
 */
async function rotateEncryptionKey() {
  const configDir = require('../../config/config-manager').getConfigDir();
  const keyPath = path.join(configDir, '.config-encryption-key');

  try {
    // 读取旧密钥
    const oldKey = await fs.readFile(keyPath, 'utf8');

    // 备份旧密钥
    const backupPath = path.join(configDir, `.config-encryption-key.backup-${Date.now()}`);
    await fs.writeFile(backupPath, oldKey, 'utf8');

    // 生成新密钥
    const newKey = crypto.randomBytes(32).toString('hex');
    await fs.writeFile(keyPath, newKey, 'utf8');

    return {
      success: true,
      oldKeyBackup: backupPath,
      message: 'Encryption key rotated successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 导出加密密钥（用于备份）
 */
async function exportEncryptionKey() {
  const keyPath = path.join(
    require('../../config/config-manager').getConfigDir(),
    '.config-encryption-key',
  );

  try {
    const key = await fs.readFile(keyPath, 'utf8');

    return {
      success: true,
      key,
      message: 'Encryption key exported',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Encryption key not found',
    };
  }
}

/**
 * 导入加密密钥（用于恢复）
 */
async function importEncryptionKey(newKey) {
  const configDir = require('../../config/config-manager').getConfigDir();
  const keyPath = path.join(configDir, '.config-encryption-key');

  try {
    // 验证密钥格式
    const hexRegex = /^[0-9a-f]{64}$/i;
    if (!hexRegex.test(newKey)) {
      throw new Error('Invalid encryption key format. Must be 64 hex characters.');
    }

    // 备份现有密钥
    if (await fileExists(keyPath)) {
      const oldKey = await fs.readFile(keyPath, 'utf8');
      const backupPath = path.join(configDir, `.config-encryption-key.backup-${Date.now()}`);
      await fs.writeFile(backupPath, oldKey, 'utf8');
    }

    // 保存新密钥
    await fs.writeFile(keyPath, newKey, 'utf8');

    // 设置文件权限
    const { chmod } = require('fs');
    chmod(keyPath, 0o600, (err) => {
      if (err) {
        console.warn('Failed to set file permissions:', err.message);
      }
    });

    return {
      success: true,
      message: 'Encryption key imported successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Failed to import encryption key',
    };
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getOrGenerateKey,
  encryptConfigField,
  decryptConfigField,
  generateEncryptionParams,
  validateEncryptionKey,
  rotateEncryptionKey,
  exportEncryptionKey,
  importEncryptionKey,
};
