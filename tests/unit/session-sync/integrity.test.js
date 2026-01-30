describe('Session Integrity Module', () => {
  describe('computeSessionHash', () => {
    it('should compute hash for session data', () => {
      const payload = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const hash = computeSessionHash(payload);

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 hash length
      expect(typeof hash).toBe('string');
    });

    it('should produce consistent hash for same data', () => {
      const payload = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const hash1 = computeSessionHash(payload);
      const hash2 = computeSessionHash(payload);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different data', () => {
      const payload1 = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const payload2 = {
        meta: { sessionId: 'test-456', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'World' }],
        context: { projectPath: '/test' },
      };

      const hash1 = computeSessionHash(payload1);
      const hash2 = computeSessionHash(payload2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifySessionIntegrity', () => {
    it('should verify valid session hash', () => {
      const payload = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const expectedHash = computeSessionHash(payload);
      const result = verifySessionIntegrity({
        payload,
        expectedHash,
      });

      expect(result.isValid).toBe(true);
      expect(result.computedHash).toBe(expectedHash);
    });

    it('should detect invalid session hash', () => {
      const payload = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const wrongHash = '0'.repeat(64);
      const result = verifySessionIntegrity({
        payload,
        expectedHash: wrongHash,
      });

      expect(result.isValid).toBe(false);
      expect(result.computedHash).not.toBe(wrongHash);
    });

    it('should skip verification when no hash provided', () => {
      const payload = {
        meta: { sessionId: 'test-123', messageCount: 5 },
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        context: { projectPath: '/test' },
      };

      const result = verifySessionIntegrity({
        payload,
        expectedHash: null,
      });

      expect(result.isValid).toBe(true);
      expect(result.warning).toBeDefined();
    });
  });

  describe('verifyMessages', () => {
    it('should verify valid messages', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          createdAt: '2024-01-01T00:00:01Z',
        },
      ];

      const result = verifyMessages(messages);

      expect(result.isValid).toBe(true);
      expect(result.messageCount).toBe(2);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const messages = [
        {
          id: 'msg-1',
          content: 'Hello',
          // Missing: role
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = verifyMessages(messages);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0]).toContain('invalid role');
    });

    it('should detect invalid role', () => {
      const messages = [
        {
          id: 'msg-1',
          role: 'invalid',
          content: 'Hello',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = verifyMessages(messages);

      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toContain('invalid role');
    });

    it('should detect unordered messages', () => {
      const messages = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi!',
          createdAt: '2024-01-01T00:00:01Z',
        },
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: '2024-01-01T00:00:00Z',
        },
      ];

      const result = verifyMessages(messages);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Messages are not chronologically ordered');
    });
  });
});
