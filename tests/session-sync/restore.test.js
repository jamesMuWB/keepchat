vi.mock('../../src/qiniu/config', () => ({
  loadConfig: vi.fn(() => ({
    accessKey: 'ak',
    secretKey: 'sk',
    bucket: 'bucket',
    region: 'z0',
  })),
  getMissingConfig: vi.fn(() => []),
}));

describe('session restore', () => {
  it('throws when download domain missing', async () => {
    await expect(downloadSessionPayload({ sessionId: 's1' })).rejects.toThrow(
      'Qiniu download domain is required',
    );
  });
});
