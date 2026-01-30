const crypto = require('crypto');

describe('encryption metadata', () => {
  it('round trips metadata', () => {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const authTag = crypto.randomBytes(16);
    const hash = hashBuffer(Buffer.from('data'));

    const metadata = createEncryptionMetadata({ salt, iv, authTag, hash });
    const parsed = parseEncryptionMetadata(metadata);

    expect(parsed.salt.toString('base64')).toBe(salt.toString('base64'));
    expect(parsed.iv.toString('base64')).toBe(iv.toString('base64'));
    expect(parsed.authTag.toString('base64')).toBe(authTag.toString('base64'));
    expect(parsed.hash).toBe(hash);
  });
});
