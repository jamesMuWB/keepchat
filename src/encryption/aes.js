const crypto = require('crypto');

const AES_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;

function normalizeBuffer(input) {
  if (Buffer.isBuffer(input)) {
    return input;
  }
  if (typeof input === 'string') {
    return Buffer.from(input, 'utf8');
  }
  throw new Error('Input must be a string or Buffer');
}

function encryptAesGcm({ plaintext, key, aad }) {
  if (!key || key.length !== 32) {
    throw new Error('AES-256 key must be 32 bytes');
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, key, iv);
  if (aad) {
    cipher.setAAD(normalizeBuffer(aad));
  }

  const ciphertext = Buffer.concat([cipher.update(normalizeBuffer(plaintext)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv,
    authTag,
    algorithm: AES_ALGORITHM,
  };
}

function decryptAesGcm({ ciphertext, key, iv, authTag, aad }) {
  if (!key || key.length !== 32) {
    throw new Error('AES-256 key must be 32 bytes');
  }
  if (!iv || iv.length !== IV_LENGTH_BYTES) {
    throw new Error('AES-256-GCM IV must be 12 bytes');
  }
  if (!authTag || authTag.length !== AUTH_TAG_LENGTH_BYTES) {
    throw new Error('AES-256-GCM auth tag must be 16 bytes');
  }

  const decipher = crypto.createDecipheriv(AES_ALGORITHM, key, iv);
  if (aad) {
    decipher.setAAD(normalizeBuffer(aad));
  }
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(normalizeBuffer(ciphertext)), decipher.final()]);
}

module.exports = {
  AES_ALGORITHM,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
  encryptAesGcm,
  decryptAesGcm,
};
