const { loadConfig, getMissingConfig } = require('../qiniu/config');
const { downloadFile } = require('../qiniu/download');
const { loadEncryptionConfig } = require('../encryption/config');
const { deriveKeyFromApiKey, deriveKeyFromPassword } = require('../encryption/keys');
const { decryptAesGcm } = require('../encryption/aes');
const { parseEncryptionMetadata } = require('../encryption/metadata');
const { gzipDecompress } = require('./compression');
const { SESSION_FILES } = require('./file-store');

function resolveDecryptionKey({ apiKey, password, salt }) {
  if (password) {
    return deriveKeyFromPassword({ password, salt });
  }

  const configApiKey = loadEncryptionConfig().apiKey;
  const resolvedApiKey = apiKey || configApiKey;
  if (!resolvedApiKey) {
    throw new Error('ENCRYPTION_API_KEY is required for decryption');
  }

  return deriveKeyFromApiKey(resolvedApiKey);
}

async function downloadAndDecrypt({
  sessionId,
  fileName,
  qiniu,
  apiKey,
  password,
  prefix,
  onProgress,
}) {
  const baseName = `${fileName}.gz.enc`;
  const metaName = `${fileName}.meta.json`;
  const sessionPrefix = `${prefix}/${sessionId}`;

  const metaKey = `${sessionPrefix}/${metaName}`;
  const encKey = `${sessionPrefix}/${baseName}`;

  const metaResult = await downloadFile({
    key: metaKey,
    bucket: qiniu.bucket,
    accessKey: qiniu.accessKey,
    secretKey: qiniu.secretKey,
    region: qiniu.region,
    downloadDomain: qiniu.downloadDomain,
  });

  const metadata = parseEncryptionMetadata(JSON.parse(metaResult.data.toString('utf8')));
  const key = resolveDecryptionKey({ apiKey, password, salt: metadata.salt });

  const downloadProgress = onProgress
    ? (progress) => onProgress({ ...progress, file: baseName, phase: 'download' })
    : undefined;

  const encResult = await downloadFile({
    key: encKey,
    bucket: qiniu.bucket,
    accessKey: qiniu.accessKey,
    secretKey: qiniu.secretKey,
    region: qiniu.region,
    downloadDomain: qiniu.downloadDomain,
    onProgress: downloadProgress,
  });

  const decrypted = decryptAesGcm({
    ciphertext: encResult.data,
    key,
    iv: metadata.iv,
    authTag: metadata.authTag,
  });
  const decompressed = await gzipDecompress(decrypted);

  return JSON.parse(decompressed.toString('utf8'));
}

async function downloadSessionPayload({
  sessionId,
  apiKey,
  password,
  qiniuConfig,
  prefix = 'sessions',
  onProgress,
}) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const qiniu = qiniuConfig || loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length) {
    throw new Error(`Missing Qiniu config: ${missing.join(', ')}`);
  }
  if (!qiniu.downloadDomain) {
    throw new Error('Qiniu download domain is required to restore session');
  }

  const meta = await downloadAndDecrypt({
    sessionId,
    fileName: SESSION_FILES.meta,
    qiniu,
    apiKey,
    password,
    prefix,
  });
  const messages = await downloadAndDecrypt({
    sessionId,
    fileName: SESSION_FILES.messages,
    qiniu,
    apiKey,
    password,
    prefix,
    onProgress,
  });
  const context = await downloadAndDecrypt({
    sessionId,
    fileName: SESSION_FILES.context,
    qiniu,
    apiKey,
    password,
    prefix,
  });

  return {
    meta,
    messages,
    context,
  };
}

module.exports = {
  downloadSessionPayload,
};
