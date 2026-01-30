describe('encryption keys', () => {
  it('derives a 32-byte key from password', () => {
    const salt = generateSalt();
    const key = deriveKeyFromPassword({ password: 'pass1234', salt });
    expect(key.length).toBe(32);
  });

  it('derives a 32-byte key from API key', () => {
    const key = deriveKeyFromApiKey('api-key');
    expect(key.length).toBe(32);
  });

  it('encodes and decodes API key', () => {
    const encoded = encodeApiKey('api-key');
    const decoded = decodeApiKey(encoded);
    expect(decoded).toBe('api-key');
  });

  it('validates password strength', () => {
    expect(validatePasswordStrength('123456').valid).toBe(false);
    expect(validatePasswordStrength('abc12345').valid).toBe(true);
  });
});
