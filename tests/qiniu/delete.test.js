vi.mock('../../src/qiniu/client', () => ({
  createQiniuClient: vi.fn(),
}));

describe('qiniu delete', () => {
  beforeEach(() => {
    createQiniuClient.mockReset();
  });

  it('deletes a single file', async () => {
    const del = vi.fn((bucket, key, cb) => {
      cb(null, { result: 'ok' }, { statusCode: 200 });
    });
    createQiniuClient.mockReturnValue({ bucketManager: { delete: del } });

    const result = await deleteFile({
      bucket: 'bucket',
      key: 'file.txt',
      accessKey: 'ak',
      secretKey: 'sk',
      region: 'z0',
    });

    expect(del).toHaveBeenCalledWith('bucket', 'file.txt', expect.any(Function));
    expect(result.key).toBe('file.txt');
  });

  it('deletes multiple files', async () => {
    const batch = vi.fn((ops, cb) => {
      cb(null, [{ code: 200 }], { statusCode: 200 });
    });
    createQiniuClient.mockReturnValue({ bucketManager: { batch } });

    const result = await deleteFiles({
      bucket: 'bucket',
      keys: ['a.txt', 'b.txt'],
      accessKey: 'ak',
      secretKey: 'sk',
      region: 'z0',
    });

    expect(batch).toHaveBeenCalledWith(expect.any(Array), expect.any(Function));
    expect(result.keys).toEqual(['a.txt', 'b.txt']);
  });
});
