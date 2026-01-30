const crypto = require('crypto');
const { AES_ALGORITHM } = require('./aes');

function toBase64(buffer) {
  return buffer ? buffer.toString('base64') : undefined;
}

function fromBase64(value) {
  return value ? Buffer.from(value, 'base64') : undefined;
}

function createEncryptionMetadata({ algorithm = AES_ALGORITHM, salt, iv, authTag, hash }) {
  return {
    algorithm,
    salt: toBase64(salt),
    iv: toBase64(iv),
    authTag: toBase64(authTag),
    hash,
  };
}

function parseEncryptionMetadata(metadata = {}) {
  return {
    algorithm: metadata.algorithm,
    salt: fromBase64(metadata.salt),
    iv: fromBase64(metadata.iv),
    authTag: fromBase64(metadata.authTag),
    hash: metadata.hash,
  };
}

function hashBuffer(buffer) {
  if (!buffer) {
    throw new Error('buffer is required to hash');
  }

  return crypto.createHash('sha256').update(buffer).digest('hex');
}

module.exports = {
  createEncryptionMetadata,
  parseEncryptionMetadata,
  hashBuffer,
};
