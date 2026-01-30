vi.mock('../../src/qiniu/client', () => ({
  createQiniuClient: vi.fn(),
}));

describe('qiniu list', () => {
  beforeEach(() => {
    createQiniuClient.mockReset();
  });

  it('lists files with prefix and marker', async () => {
    const listPrefix = vi.fn((bucket, options, cb) => {
      cb(null, { items: [{ key: 'a' }], marker: 'next' }, { statusCode: 200 });
    });

    createQiniuClient.mockReturnValue({ bucketManager: { listPrefix } });

    const result = await listFiles({
      bucket: 'bucket',
      accessKey: 'ak',
      secretKey: 'sk',
      region: 'z0',
      prefix: 'sessions/',
      marker: 'm1',
      limit: 10,
    });

    expect(listPrefix).toHaveBeenCalledWith(
      'bucket',
      expect.objectContaining({
        prefix: 'sessions/',
        marker: 'm1',
        limit: 10,
      }),
      expect.any(Function),
    );
    expect(result.items).toHaveLength(1);
    expect(result.marker).toBe('next');
  });
});
