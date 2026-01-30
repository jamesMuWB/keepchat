const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * 配置文件路径
 */
function getConfigDir() {
  return path.join(os.homedir(), '.codebuddy');
}

/**
 * 获取七牛云配置文件路径
 */
function getQiniuConfigPath() {
  return path.join(getConfigDir(), 'qiniu-config.json');
}

/**
 * 获取加密配置文件路径
 */
function getEncryptionConfigPath() {
  return path.join(getConfigDir(), 'encryption-config.json');
}

/**
 * 获取加密密钥文件路径（用于加密敏感配置）
 */
function getEncryptionKeyPath() {
  return path.join(getConfigDir(), '.config-encryption-key');
}

/**
 * 七牛云配置模板
 */
function getQiniuConfigTemplate() {
  return {
    accessKey: '', // 加密存储
    secretKey: '', // 加密存储
    bucket: '',
    region: 'z0', // 华东
    prefix: 'sessions',
    downloadDomain: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * 加密配置模板
 */
function getEncryptionConfigTemplate() {
  return {
    apiKey: '', // Base64 编码的加密密钥
    mode: 'apikey', // "apikey" 或 "password"
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: '1.0.0',
  };
}

/**
 * 读取配置（解密敏感字段）
 */
async function loadQiniuConfig() {
  const filePath = getQiniuConfigPath();

  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      return { ...getQiniuConfigTemplate(), _missing: true };
    }

    const encryptedContent = await fs.readFile(filePath, 'utf8');
    const encrypted = JSON.parse(encryptedContent);

    // 解密敏感字段
    const config = {
      ...getQiniuConfigTemplate(),
      ...encrypted,
    };

    // 如果 accessKey 和 secretKey 是加密的，解密它们
    if (config.encrypted) {
      const { decryptConfigField } = require('./config-encryption');
      config.accessKey = await decryptConfigField({
        encrypted: config.accessKey,
        keyPath: getEncryptionKeyPath(),
        field: 'qiniu_accessKey',
        source: 'qiniu',
        sessionId: null,
        password: null,
        apiKey: null,
        mode: 'apikey',
        salt: config.salt,
        iv: config.iv,
        authTag: config.authTag,
        algorithm: config.algorithm,
        keyDerivation: config.keyDerivation,
      });
      config.secretKey = await decryptConfigField({
        encrypted: config.secretKey,
        keyPath: getEncryptionKeyPath(),
        field: 'qiniu_secretKey',
        source: 'qiniu',
        sessionId: null,
        password: null,
        apiKey: null,
        mode: 'apikey',
        salt: config.salt,
        iv: config.iv,
        authTag: config.authTag,
        algorithm: config.algorithm,
        keyDerivation: config.keyDerivation,
      });
    }

    // 验证配置
    const validation = validateQiniuConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid Qiniu configuration: ${validation.errors.join(', ')}`);
    }

    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...getQiniuConfigTemplate(), _missing: true };
    }
    throw error;
  }
}

/**
 * 保存配置（加密敏感字段）
 */
async function saveQiniuConfig(config) {
  const filePath = getQiniuConfigPath();

  // 验证配置
  const validation = validateQiniuConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid Qiniu configuration: ${validation.errors.join(', ')}`);
  }

  // 确保配置目录存在
  const configDir = getConfigDir();
  await fs.mkdir(configDir, { recursive: true });

  // 加密敏感字段
  const { encryptConfigField } = require('./config-encryption');
  const encryptedAccessKey = await encryptConfigField({
    plaintext: config.accessKey,
    keyPath: getEncryptionKeyPath(),
    field: 'qiniu_accessKey',
    source: 'qiniu',
  });
  const encryptedSecretKey = await encryptConfigField({
    plaintext: config.secretKey,
    keyPath: getEncryptionKeyPath(),
    field: 'qiniu_secretKey',
    source: 'qiniu',
  });

  // 构建加密的配置对象
  const encryptedConfig = {
    ...config,
    accessKey: encryptedAccessKey.encrypted,
    secretKey: encryptedSecretKey.encrypted,
    encrypted: true,
    salt: encryptedAccessKey.salt,
    iv: encryptedAccessKey.iv,
    authTag: encryptedAccessKey.authTag,
    algorithm: encryptedAccessKey.algorithm,
    keyDerivation: encryptedAccessKey.keyDerivation,
    updatedAt: new Date().toISOString(),
  };

  // 删除未加密的字段（安全）
  delete encryptedConfig.accessKey;
  delete encryptedConfig.secretKey;

  // 保存配置
  await fs.writeFile(filePath, JSON.stringify(encryptedConfig, null, 2), 'utf8');

  return { success: true, path: filePath };
}

/**
 * 读取加密配置
 */
async function loadEncryptionConfig() {
  const filePath = getEncryptionConfigPath();

  try {
    const exists = await fileExists(filePath);
    if (!exists) {
      return { ...getEncryptionConfigTemplate(), _missing: true };
    }

    const content = await fs.readFile(filePath, 'utf8');
    const config = JSON.parse(content);

    // 验证配置
    const validation = validateEncryptionConfig(config);
    if (!validation.valid) {
      throw new Error(`Invalid encryption configuration: ${validation.errors.join(', ')}`);
    }

    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { ...getEncryptionConfigTemplate(), _missing: true };
    }
    throw error;
  }
}

/**
 * 保存加密配置
 */
async function saveEncryptionConfig(config) {
  const filePath = getEncryptionConfigPath();

  // 验证配置
  const validation = validateEncryptionConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid encryption configuration: ${validation.errors.join(', ')}`);
  }

  // 确保配置目录存在
  const configDir = getConfigDir();
  await fs.mkdir(configDir, { recursive: true });

  // 更新时间戳
  config.updatedAt = new Date().toISOString();

  // 保存配置
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');

  return { success: true, path: filePath };
}

/**
 * 验证七牛云配置
 */
function validateQiniuConfig(config) {
  const errors = [];

  // 验证必需字段
  const requiredFields = ['bucket', 'region'];
  for (const field of requiredFields) {
    if (!config[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // 验证 AccessKey 和 SecretKey
  if (config.encrypted) {
    // 如果是加密的，不需要验证明文
  } else {
    if (!config.accessKey && !process.env.QINIU_ACCESS_KEY) {
      errors.push('accessKey is required');
    }
    if (!config.secretKey && !process.env.QINIU_SECRET_KEY) {
      errors.push('secretKey is required');
    }
  }

  // 验证 bucket 名称格式
  if (config.bucket) {
    const bucketRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
    if (!bucketRegex.test(config.bucket)) {
      errors.push('bucket must be 3-63 lowercase letters, numbers, or hyphens');
    }
  }

  // 验证 region
  if (config.region) {
    const validRegions = ['z0', 'z1', 'z2', 'na0', 'as0', 'cn-east-2'];
    if (!validRegions.includes(config.region)) {
      errors.push(`Invalid region. Must be one of: ${validRegions.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证加密配置
 */
function validateEncryptionConfig(config) {
  const errors = [];

  // 验证必需字段
  if (!config.mode) {
    errors.push('mode is required');
  }

  if (config.mode !== 'apikey' && config.mode !== 'password') {
    errors.push(`Invalid mode: ${config.mode}. Must be 'apikey' or 'password'`);
  }

  // 验证 API key（如果使用 apikey 模式）
  if (config.mode === 'apikey' && !config.apiKey) {
    errors.push("apiKey is required when mode is 'apikey'");
  }

  // 验证版本号
  if (config.version) {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(config.version)) {
      errors.push('version must be in format x.y.z');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 合并配置（环境变量优先）
 */
function mergeConfigWithEnv(config) {
  const merged = { ...config };

  if (process.env.QINIU_ACCESS_KEY) {
    merged.accessKey = process.env.QINIU_ACCESS_KEY;
  }
  if (process.env.QINIU_SECRET_KEY) {
    merged.secretKey = process.env.QINIU_SECRET_KEY;
  }
  if (process.env.QINIU_BUCKET) {
    merged.bucket = process.env.QINIU_BUCKET;
  }
  if (process.env.QINIU_REGION) {
    merged.region = process.env.QINIU_REGION;
  }
  if (process.env.QINIU_DOWNLOAD_DOMAIN) {
    merged.downloadDomain = process.env.QINIU_DOWNLOAD_DOMAIN;
  }
  if (process.env.ENCRYPTION_API_KEY) {
    merged.apiKey = process.env.ENCRYPTION_API_KEY;
  }

  return merged;
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

/**
 * 删除配置文件
 */
async function deleteConfig() {
  const qiniuPath = getQiniuConfigPath();
  const encryptionPath = getEncryptionConfigPath();
  const keyPath = getEncryptionKeyPath();

  const results = [];

  try {
    await fs.unlink(qiniuPath);
    results.push({ file: qiniuPath, success: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      results.push({ file: qiniuPath, success: false, error: error.message });
    }
  }

  try {
    await fs.unlink(encryptionPath);
    results.push({ file: encryptionPath, success: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      results.push({
        file: encryptionPath,
        success: false,
        error: error.message,
      });
    }
  }

  try {
    await fs.unlink(keyPath);
    results.push({ file: keyPath, success: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      results.push({ file: keyPath, success: false, error: error.message });
    }
  }

  return results;
}

module.exports = {
  getConfigDir,
  getQiniuConfigPath,
  getEncryptionConfigPath,
  getEncryptionKeyPath,
  getQiniuConfigTemplate,
  getEncryptionConfigTemplate,
  loadQiniuConfig,
  saveQiniuConfig,
  loadEncryptionConfig,
  saveEncryptionConfig,
  validateQiniuConfig,
  validateEncryptionConfig,
  mergeConfigWithEnv,
  fileExists,
  deleteConfig,
};
