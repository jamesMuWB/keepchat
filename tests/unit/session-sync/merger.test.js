describe('Session Merger Module', () => {
  const sampleSource = {
    meta: {
      sessionId: 'source-123',
      updatedAt: '2024-01-02T00:00:00Z',
      messageCount: 3,
    },
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello from source',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi source!',
        createdAt: '2024-01-01T00:00:01Z',
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Source message',
        createdAt: '2024-01-02T00:00:00Z',
      },
    ],
    context: {
      projectPath: '/source/project',
      notes: 'Source notes',
    },
  };

  const sampleTarget = {
    meta: {
      sessionId: 'target-456',
      updatedAt: '2024-01-01T12:00:00Z',
      messageCount: 2,
    },
    messages: [
      {
        id: 'msg-a',
        role: 'user',
        content: 'Hello from target',
        createdAt: '2024-01-01T00:00:00Z',
      },
      {
        id: 'msg-b',
        role: 'assistant',
        content: 'Hi target!',
        createdAt: '2024-01-01T00:00:01Z',
      },
    ],
    context: {
      projectPath: '/target/project',
      notes: 'Target notes',
    },
  };

  describe('detectSessionState', () => {
    it('should detect empty session', () => {
      const state = detectSessionState([]);
      expect(state).toBe(SessionState.EMPTY);
    });

    it('should detect active session', () => {
      const state = detectSessionState([sampleSource.messages[0]]);
      expect(state).toBe(SessionState.ACTIVE);
    });

    it('should detect active session with null messages', () => {
      const state = detectSessionState(null);
      expect(state).toBe(SessionState.EMPTY);
    });
  });

  describe('compareSessions', () => {
    it('should compare two sessions', () => {
      const comparison = compareSessions({
        source: sampleSource,
        target: sampleTarget,
      });

      expect(comparison.sourceCount).toBe(3);
      expect(comparison.targetCount).toBe(2);
      expect(comparison.hasOverlap).toBe(false);
    });

    it('should detect message overlap', () => {
      const overlappingTarget = {
        ...sampleTarget,
        messages: [sampleSource.messages[0], sampleSource.messages[1]],
      };

      const comparison = compareSessions({
        source: sampleSource,
        target: overlappingTarget,
      });

      expect(comparison.hasOverlap).toBe(true);
    });
  });

  describe('detectMessageOverlap', () => {
    it('should detect no overlap', () => {
      const overlap = detectMessageOverlap({
        sourceMessages: sampleSource.messages,
        targetMessages: sampleTarget.messages,
      });

      expect(overlap).toBe(false);
    });

    it('should detect overlap by id', () => {
      const overlapping = detectMessageOverlap({
        sourceMessages: sampleSource.messages,
        targetMessages: [sampleSource.messages[0]],
      });

      expect(overlapping).toBe(true);
    });
  });

  describe('recommendStrategy', () => {
    it('should recommend replace for empty target', () => {
      const recommendation = recommendStrategy({
        source: sampleSource,
        target: { meta: {}, messages: [], context: {} },
      });

      expect(recommendation.strategy).toBe(MergeStrategy.REPLACE);
      expect(recommendation.reason).toBe('target session is empty');
      expect(recommendation.canAppend).toBe(false);
      expect(recommendation.canMerge).toBe(false);
    });

    it('should recommend append for newer source without overlap', () => {
      const recommendation = recommendStrategy({
        source: sampleSource,
        target: sampleTarget,
      });

      expect(recommendation.strategy).toBe(MergeStrategy.APPEND);
      expect(recommendation.reason).toContain('newer');
      expect(recommendation.canAppend).toBe(true);
      expect(recommendation.canMerge).toBe(true);
    });

    it('should recommend merge for overlapping sessions', () => {
      const overlappingTarget = {
        ...sampleTarget,
        messages: [sampleSource.messages[0]],
      };

      const recommendation = recommendStrategy({
        source: sampleSource,
        target: overlappingTarget,
      });

      expect(recommendation.strategy).toBe(MergeStrategy.MERGE);
      expect(recommendation.reason).toContain('overlap');
      expect(recommendation.canMerge).toBe(true);
    });
  });

  describe('replaceSession', () => {
    it('should replace session with source', () => {
      const result = replaceSession({ source: sampleSource });

      expect(result.meta.restoredFrom).toBe('source-123');
      expect(result.meta.strategy).toBe(MergeStrategy.REPLACE);
      expect(result.messages).toEqual(sampleSource.messages);
      expect(result.context).toEqual(sampleSource.context);
      expect(result.messages.length).toBe(3);
    });
  });

  describe('appendToSession', () => {
    it('should append new messages to target', () => {
      const result = appendToSession({
        source: sampleSource,
        target: sampleTarget,
      });

      expect(result.meta.strategy).toBe(MergeStrategy.APPEND);
      expect(result.meta.appendedCount).toBe(3);
      expect(result.messages.length).toBe(5); // 2 from target + 3 from source
    });

    it('should skip duplicate messages', () => {
      const targetWithDup = {
        ...sampleTarget,
        messages: [sampleSource.messages[0], sampleSource.messages[1]],
      };

      const result = appendToSession({
        source: sampleSource,
        target: targetWithDup,
      });

      expect(result.meta.appendedCount).toBe(1);
      expect(result.messages.length).toBe(3);
    });
  });

  describe('mergeSessions', () => {
    it('should merge sessions without overlap', () => {
      const result = mergeSessions({
        source: sampleSource,
        target: sampleTarget,
      });

      expect(result.meta.strategy).toBe(MergeStrategy.MERGE);
      expect(result.messages.length).toBe(5);
      expect(result.meta.originalTargetCount).toBe(2);
      expect(result.meta.sourceCount).toBe(3);
      expect(result.meta.mergedCount).toBe(5);
    });

    it('should deduplicate overlapping messages', () => {
      const overlappingTarget = {
        ...sampleTarget,
        messages: [sampleSource.messages[0], sampleSource.messages[1]],
      };

      const result = mergeSessions({
        source: sampleSource,
        target: overlappingTarget,
      });

      expect(result.messages.length).toBe(3); // Not 5
      expect(result.meta.duplicatesRemoved).toBe(2);
    });
  });

  describe('mergeContexts', () => {
    it('should use latest strategy by default', () => {
      const result = mergeContexts({
        source: sampleSource.context,
        target: sampleTarget.context,
      });

      expect(result.projectPath).toBe('/source/project'); // Longer path wins
      expect(result.notes).toContain('Source notes');
      expect(result.notes).toContain('Target notes');
    });

    it('should use source strategy', () => {
      const result = mergeContexts({
        source: sampleSource.context,
        target: sampleTarget.context,
        strategy: 'source',
      });

      expect(result.projectPath).toBe('/source/project');
      expect(result.notes).toBe('Source notes');
    });

    it('should use target strategy', () => {
      const result = mergeContexts({
        source: sampleSource.context,
        target: sampleTarget.context,
        strategy: 'target',
      });

      expect(result.projectPath).toBe('/target/project');
      expect(result.notes).toBe('Target notes');
    });

    it('should merge file references', () => {
      const sourceCtx = {
        files: [
          { path: '/file1', sha256: 'abc' },
          { path: '/file2', sha256: 'def' },
        ],
      };
      const targetCtx = {
        files: [
          { path: '/file2', sha256: 'def' },
          { path: '/file3', sha256: 'ghi' },
        ],
      };

      const result = mergeContexts({
        source: sourceCtx,
        target: targetCtx,
      });

      expect(result.files.length).toBe(3);
      expect(result.files.some((f) => f.path === '/file1')).toBe(true);
      expect(result.files.some((f) => f.path === '/file2')).toBe(true);
      expect(result.files.some((f) => f.path === '/file3')).toBe(true);
    });
  });

  describe('applyMergeStrategy', () => {
    it('should apply replace strategy', () => {
      const result = applyMergeStrategy({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.REPLACE,
      });

      expect(result.messages).toEqual(sampleSource.messages);
      expect(result.meta.strategy).toBe(MergeStrategy.REPLACE);
    });

    it('should apply append strategy', () => {
      const result = applyMergeStrategy({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.APPEND,
      });

      expect(result.messages.length).toBe(5);
      expect(result.meta.strategy).toBe(MergeStrategy.APPEND);
    });

    it('should apply merge strategy', () => {
      const result = applyMergeStrategy({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.MERGE,
      });

      expect(result.messages.length).toBe(5);
      expect(result.meta.strategy).toBe(MergeStrategy.MERGE);
    });

    it('should throw error for unknown strategy', () => {
      expect(() =>
        applyMergeStrategy({
          source: sampleSource,
          target: sampleTarget,
          strategy: 'unknown',
        }),
      ).toThrow('Unknown merge strategy: unknown');
    });
  });

  describe('generateMergePreview', () => {
    it('should generate preview for replace strategy', () => {
      const preview = generateMergePreview({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.REPLACE,
      });

      expect(preview.strategy).toBe(MergeStrategy.REPLACE);
      expect(preview.source.messageCount).toBe(3);
      expect(preview.target.messageCount).toBe(2);
      expect(preview.result.messageCount).toBe(3);
      expect(preview.result.change).toBe(1);
    });

    it('should generate preview for append strategy', () => {
      const preview = generateMergePreview({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.APPEND,
      });

      expect(preview.strategy).toBe(MergeStrategy.APPEND);
      expect(preview.result.messageCount).toBe(5);
      expect(preview.result.change).toBe(3);
      expect(preview.result.appendedCount).toBe(3);
    });

    it('should indicate if strategy matches recommendation', () => {
      const preview1 = generateMergePreview({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.APPEND,
      });

      expect(preview1.match).toBe(true);

      const preview2 = generateMergePreview({
        source: sampleSource,
        target: sampleTarget,
        strategy: MergeStrategy.REPLACE,
      });

      expect(preview2.match).toBe(false);
    });
  });
});
