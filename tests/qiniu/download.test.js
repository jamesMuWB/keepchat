describe('qiniu download', () => {
  it('throws when download domain is missing', () => {
    expect(() =>
      downloadFile({
        key: 'file.txt',
        bucket: 'bucket',
        accessKey: 'ak',
        secretKey: 'sk',
        region: 'z0',
      }),
    ).toThrow('Qiniu download domain is required');
  });
});
