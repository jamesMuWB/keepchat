describe('incremental sync', () => {
  it('filters messages after last sync', () => {
    const messages = [{ createdAt: '2026-01-01T00:00:00Z' }, { createdAt: '2026-01-02T00:00:00Z' }];
    const filtered = filterMessages(messages, '2026-01-01T12:00:00Z');
    expect(filtered).toHaveLength(1);
  });

  it('returns incremental payload flags', () => {
    const payload = {
      meta: { updatedAt: '2026-01-02T00:00:00Z' },
      messages: [{ createdAt: '2026-01-02T00:00:00Z' }],
      context: { files: [] },
    };
    const result = getIncrementalPayload(payload, '2026-01-01T00:00:00Z');
    expect(result.hasChanges).toBe(true);
  });
});
