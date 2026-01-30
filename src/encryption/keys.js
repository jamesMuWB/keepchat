const crypto = require('crypto');

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH_BYTES);
}

function deriveKeyFromPassword({ password, salt, iterations = PBKDF2_ITERATIONS }) {
  if (!password) {
    throw new Error('Password is required to derive key');
  }
  if (!salt || salt.length !== SALT_LENGTH_BYTES) {
    throw new Error('Salt must be 16 bytes');
  }

  return crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH_BYTES, 'sha256');
}

function generateKey() {
  return crypto.randomBytes(KEY_LENGTH_BYTES);
}

function deriveKeyFromApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required to derive key');
  }

  return crypto.createHash('sha256').update(apiKey, 'utf8').digest();
}

function encodeApiKey(apiKey) {
  if (!apiKey) {
    throw new Error('API key is required for export');
  }

  return Buffer.from(apiKey, 'utf8').toString('base64');
}

function decodeApiKey(encoded) {
  if (!encoded) {
    throw new Error('Encoded API key is required for import');
  }

  return Buffer.from(encoded, 'base64').toString('utf8');
}

function generateApiKey() {
  return crypto.randomBytes(KEY_LENGTH_BYTES).toString('base64');
}

const WEAK_PASSWORDS = new Set(['123456', 'password', '12345678', 'qwerty']);

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters' };
  }
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, reason: 'Password is too weak' };
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, reason: 'Password must include letters and numbers' };
  }
  return { valid: true };
}

module.exports = {
  PBKDF2_ITERATIONS,
  SALT_LENGTH_BYTES,
  KEY_LENGTH_BYTES,
  generateSalt,
  deriveKeyFromPassword,
  generateKey,
  deriveKeyFromApiKey,
  encodeApiKey,
  decodeApiKey,
  generateApiKey,
  validatePasswordStrength,
};
