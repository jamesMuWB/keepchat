describe('qiniu upload', () => {
  it('throws when file does not exist', () => {
    expect(() =>
      uploadFile({
        filePath: '/path/not-exist.txt',
        bucket: 'bucket',
        accessKey: 'ak',
        secretKey: 'sk',
        region: 'z0',
      }),
    ).toThrow('File not found');
  });
});
