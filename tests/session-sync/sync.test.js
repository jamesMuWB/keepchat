vi.mock('../../src/qiniu/config', () => ({
  loadConfig: vi.fn(() => ({
    accessKey: 'ak',
    secretKey: 'sk',
    bucket: 'bucket',
    region: 'z0',
  })),
  getMissingConfig: vi.fn(() => []),
}));

vi.mock('../../src/qiniu/upload', () => ({
  uploadFile: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../src/encryption/config', () => ({
  loadEncryptionConfig: vi.fn(() => ({ apiKey: 'api-key' })),
}));

describe('session sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncs a session payload', async () => {
    const payload = {
      meta: {
        sessionId: 's1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        device: 'Mac',
        messageCount: 1,
        version: 1,
      },
      messages: [{ id: 'm1', role: 'user', content: 'hi' }],
      context: { files: [] },
    };

    const result = await syncSessionPayload({ sessionPayload: payload });
    expect(result.sessionId).toBe('s1');
    expect(result.uploaded.length).toBeGreaterThan(0);
  });
});
