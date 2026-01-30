const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadConfig, getMissingConfig } = require('../qiniu/config');
const { uploadFile } = require('../qiniu/upload');
const { loadEncryptionConfig } = require('../encryption/config');
const { deriveKeyFromApiKey, deriveKeyFromPassword, generateSalt } = require('../encryption/keys');
const { encryptAesGcm } = require('../encryption/aes');
const { createEncryptionMetadata, hashBuffer } = require('../encryption/metadata');
const { gzipCompress } = require('./compression');
const { buildSessionFiles } = require('./file-store');

function resolveEncryptionKey({ apiKey, password } = {}) {
  if (password) {
    const salt = generateSalt();
    return {
      key: deriveKeyFromPassword({ password, salt }),
      salt,
      mode: 'password',
    };
  }

  const configApiKey = loadEncryptionConfig().apiKey;
  const resolvedApiKey = apiKey || configApiKey;
  if (!resolvedApiKey) {
    throw new Error('ENCRYPTION_API_KEY is required for encryption');
  }

  return {
    key: deriveKeyFromApiKey(resolvedApiKey),
    mode: 'api-key',
  };
}

async function encryptFileContent({ content, key, salt }) {
  const compressed = await gzipCompress(Buffer.from(content, 'utf8'));
  const { ciphertext, iv, authTag } = encryptAesGcm({ plaintext: compressed, key });
  const hash = hashBuffer(ciphertext);
  const metadata = createEncryptionMetadata({ salt, iv, authTag, hash });

  return { ciphertext, metadata };
}

async function syncSessionPayload({
  sessionPayload,
  apiKey,
  password,
  qiniuConfig,
  prefix = 'sessions',
  onProgress,
}) {
  if (!sessionPayload || !sessionPayload.meta) {
    throw new Error('sessionPayload with meta is required');
  }

  const qiniu = qiniuConfig || loadConfig();
  const missing = getMissingConfig(qiniu);
  if (missing.length) {
    throw new Error(`Missing Qiniu config: ${missing.join(', ')}`);
  }

  const { key, salt } = resolveEncryptionKey({ apiKey, password });
  const files = buildSessionFiles(sessionPayload);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepchat-sync-'));
  const uploaded = [];

  try {
    for (const file of files) {
      const { ciphertext, metadata } = await encryptFileContent({
        content: file.content,
        key,
        salt,
      });

      const baseName = `${file.name}.gz.enc`;
      const metaName = `${file.name}.meta.json`;
      const sessionPrefix = `${prefix}/${sessionPayload.meta.sessionId}`;

      const encPath = path.join(tempDir, baseName);
      const metaPath = path.join(tempDir, metaName);

      fs.writeFileSync(encPath, ciphertext);
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

      const encKey = `${sessionPrefix}/${baseName}`;
      const metaKey = `${sessionPrefix}/${metaName}`;

      const uploadProgress = onProgress
        ? (progress) => onProgress({ ...progress, file: baseName, phase: 'upload' })
        : undefined;

      await uploadFile({
        filePath: encPath,
        key: encKey,
        bucket: qiniu.bucket,
        accessKey: qiniu.accessKey,
        secretKey: qiniu.secretKey,
        region: qiniu.region,
        onProgress: uploadProgress,
      });
      await uploadFile({
        filePath: metaPath,
        key: metaKey,
        bucket: qiniu.bucket,
        accessKey: qiniu.accessKey,
        secretKey: qiniu.secretKey,
        region: qiniu.region,
      });

      uploaded.push(encKey, metaKey);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  return {
    sessionId: sessionPayload.meta.sessionId,
    uploaded,
  };
}

module.exports = {
  resolveEncryptionKey,
  syncSessionPayload,
};
