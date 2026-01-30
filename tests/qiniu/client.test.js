describe('qiniu client', () => {
  it('resolves a supported region', () => {
    const zone = resolveZone('z0');
    expect(zone).toBeTruthy();
  });

  it('throws on unsupported region', () => {
    expect(() => resolveZone('unknown')).toThrow('Unsupported Qiniu region');
  });
});
