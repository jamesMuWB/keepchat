const fs = require('fs');
const path = require('path');

const CONFIG_FILE_NAME = 'qiniu-config.json';

function getConfigPath() {
  return path.resolve(process.cwd(), '.codebuddy', CONFIG_FILE_NAME);
}

function loadConfig() {
  const filePath = getConfigPath();
  let fileConfig = {};

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      fileConfig = JSON.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid qiniu config file JSON: ${message}`);
    }
  }

  return {
    accessKey: process.env.QINIU_ACCESS_KEY || fileConfig.accessKey,
    secretKey: process.env.QINIU_SECRET_KEY || fileConfig.secretKey,
    bucket: process.env.QINIU_BUCKET || fileConfig.bucket,
    region: process.env.QINIU_REGION || fileConfig.region,
    prefix: process.env.QINIU_PREFIX || fileConfig.prefix,
    downloadDomain:
      process.env.QINIU_DOWNLOAD_DOMAIN ||
      process.env.QINIU_DOMAIN ||
      fileConfig.downloadDomain ||
      fileConfig.domain,
  };
}

function getMissingConfig(config) {
  return ['accessKey', 'secretKey', 'bucket', 'region'].filter((key) => !config[key]);
}

module.exports = {
  CONFIG_FILE_NAME,
  getConfigPath,
  loadConfig,
  getMissingConfig,
};
