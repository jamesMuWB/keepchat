const fs = require('fs');
const path = require('path');

const CONFIG_FILE_NAME = 'encryption-config.json';

function getConfigPath() {
  return path.resolve(process.cwd(), '.codebuddy', CONFIG_FILE_NAME);
}

function ensureConfigDir() {
  const dirPath = path.dirname(getConfigPath());
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function loadEncryptionConfig() {
  const filePath = getConfigPath();
  let fileConfig = {};

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      fileConfig = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid encryption config JSON: ${message}`);
    }
  }

  return {
    apiKey: process.env.ENCRYPTION_API_KEY || fileConfig.apiKey || fileConfig.encryptionApiKey,
  };
}

function saveEncryptionConfig({ apiKey }) {
  if (!apiKey) {
    throw new Error('apiKey is required to save encryption config');
  }

  ensureConfigDir();
  const filePath = getConfigPath();
  fs.writeFileSync(filePath, JSON.stringify({ apiKey }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function getMissingEncryptionConfig(config) {
  return config.apiKey ? [] : ['apiKey'];
}

module.exports = {
  CONFIG_FILE_NAME,
  getConfigPath,
  loadEncryptionConfig,
  saveEncryptionConfig,
  getMissingEncryptionConfig,
};
