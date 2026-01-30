const crypto = require('crypto');

describe('aes-256-gcm', () => {
  it('encrypts and decrypts round trip', () => {
    const key = crypto.randomBytes(32);
    const plaintext = 'hello';

    const { ciphertext, iv, authTag } = encryptAesGcm({ plaintext, key });
    const decrypted = decryptAesGcm({ ciphertext, key, iv, authTag });

    expect(decrypted.toString('utf8')).toBe(plaintext);
  });

  it('throws with invalid key length', () => {
    const key = crypto.randomBytes(16);
    expect(() => encryptAesGcm({ plaintext: 'a', key })).toThrow('AES-256 key must be 32 bytes');
  });
});
