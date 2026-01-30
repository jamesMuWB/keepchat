describe('Conflict Resolver Module', () => {
  const sampleConflictResult = {
    hasConflict: true,
    conflictType: 'concurrent_modification',
    severity: 'high',
    reason: 'both_sides_modified',
    localSession: {
      meta: {
        sessionId: 'local-123',
        version: { version: 3, timestamp: '2024-01-03T00:00:00Z', device: 'd1' },
        messageCount: 5,
        device: 'd1',
        projectPath: '/local/project',
      },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Local message', createdAt: '2024-01-01T00:00:00Z' },
      ],
      context: { projectPath: '/local/project' },
    },
    cloudSession: {
      meta: {
        sessionId: 'cloud-456',
        version: { version: 3, timestamp: '2024-01-02T00:00:00Z', device: 'd2' },
        messageCount: 4,
        device: 'd2',
        projectPath: '/cloud/project',
      },
      messages: [
        { id: 'msg-2', role: 'user', content: 'Cloud message', createdAt: '2024-01-01T00:00:00Z' },
      ],
      context: { projectPath: '/cloud/project' },
    },
  };

  describe('summarizeSession', () => {
    it('should summarize session', () => {
      const session = {
        meta: {
          sessionId: 'test-123',
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z', device: 'd1' },
          messageCount: 5,
          device: 'd1',
          projectPath: '/project',
          updatedAt: '2024-01-01T12:00:00Z',
        },
        messages: [
          { id: 'msg-1', role: 'user', content: 'Test message', createdAt: '2024-01-01T00:00:00Z' },
        ],
        context: { projectPath: '/project' },
      };

      const summary = summarizeSession(session);

      expect(summary.sessionId).toBe('test-123');
      expect(summary.version).toBe(3);
      expect(summary.messageCount).toBe(5);
      expect(summary.device).toBe('d1');
      expect(summary.projectPath).toBe('/project');
      expect(summary.preview).toBe('Test message');
    });

    it('should handle null session', () => {
      const summary = summarizeSession(null);

      expect(summary).toBeNull();
    });
  });

  describe('generateConflictDetails', () => {
    it('should generate details for no conflict', () => {
      const details = generateConflictDetails({
        hasConflict: false,
        message: 'No conflict',
      });

      expect(details.hasConflict).toBe(false);
      expect(details.message).toBe('No conflict');
    });

    it('should generate conflict details', () => {
      const details = generateConflictDetails(sampleConflictResult);

      expect(details.hasConflict).toBe(true);
      expect(details.type).toBe('concurrent_modification');
      expect(details.severity).toBe('high');
      expect(details.timestamp).toBeDefined();

      expect(details.sessionSummaries).toBeDefined();
      expect(details.sessionSummaries.local).toBeDefined();
      expect(details.sessionSummaries.cloud).toBeDefined();
    });
  });

  describe('resolveKeepLocal', () => {
    it('should resolve by keeping local', () => {
      const result = resolveKeepLocal({
        conflictResult: sampleConflictResult,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ResolutionStrategy.KEEP_LOCAL);
      expect(result.resolvedSession).toBeDefined();
      expect(result.resolvedSession.meta.conflictResolved).toBe(true);
      expect(result.resolvedSession.meta.resolutionStrategy).toBe(ResolutionStrategy.KEEP_LOCAL);
      expect(result.overwrittenSession).toBeDefined();
    });

    it('should increment version', () => {
      const result = resolveKeepLocal({
        conflictResult: sampleConflictResult,
      });

      expect(result.resolvedSession.meta.version.version).toBeGreaterThan(
        sampleConflictResult.localSession.meta.version.version,
      );
    });

    it('should throw error for no conflict', () => {
      expect(() =>
        resolveKeepLocal({
          conflictResult: { hasConflict: false },
        }),
      ).toThrow('No conflict to resolve');
    });
  });

  describe('resolveKeepCloud', () => {
    it('should resolve by keeping cloud', () => {
      const result = resolveKeepCloud({
        conflictResult: sampleConflictResult,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe(ResolutionStrategy.KEEP_CLOUD);
      expect(result.resolvedSession).toBeDefined();
      expect(result.resolvedSession.meta.conflictResolved).toBe(true);
      expect(result.resolvedSession.meta.resolutionStrategy).toBe(ResolutionStrategy.KEEP_CLOUD);
      expect(result.overwrittenSession).toBeDefined();
    });

    it('should increment version', () => {
      const result = resolveKeepCloud({
        conflictResult: sampleConflictResult,
      });

      expect(result.resolvedSession.meta.version.version).toBeGreaterThan(
        sampleConflictResult.cloudSession.meta.version.version,
      );
    });
  });

  describe('applyResolutionStrategy', () => {
    it('should apply keep_local strategy', () => {
      const result = applyResolutionStrategy({
        conflictResult: sampleConflictResult,
        strategy: ResolutionStrategy.KEEP_LOCAL,
      });

      expect(result.strategy).toBe(ResolutionStrategy.KEEP_LOCAL);
      expect(result.success).toBe(true);
    });

    it('should apply keep_cloud strategy', () => {
      const result = applyResolutionStrategy({
        conflictResult: sampleConflictResult,
        strategy: ResolutionStrategy.KEEP_CLOUD,
      });

      expect(result.strategy).toBe(ResolutionStrategy.KEEP_CLOUD);
      expect(result.success).toBe(true);
    });

    it('should apply manual_merge strategy without user input', () => {
      const result = applyResolutionStrategy({
        conflictResult: sampleConflictResult,
        strategy: ResolutionStrategy.MANUAL_MERGE,
      });

      expect(result.strategy).toBe(ResolutionStrategy.MANUAL_MERGE);
      expect(result.success).toBe(false);
      expect(result.requiresUserInput).toBe(true);
      expect(result.mergePreview).toBeDefined();
    });

    it('should apply manual_merge strategy with user input', () => {
      const mergedSession = {
        meta: {
          sessionId: 'merged-123',
          version: { version: 4, timestamp: '2024-01-01T00:00:00Z' },
        },
        messages: [],
        context: {},
      };

      const result = applyResolutionStrategy({
        conflictResult: sampleConflictResult,
        strategy: ResolutionStrategy.MANUAL_MERGE,
        options: { mergedSession },
      });

      expect(result.strategy).toBe(ResolutionStrategy.MANUAL_MERGE);
      expect(result.success).toBe(true);
      expect(result.resolvedSession).toBe(mergedSession);
    });

    it('should throw error for unknown strategy', () => {
      expect(() =>
        applyResolutionStrategy({
          conflictResult: sampleConflictResult,
          strategy: 'unknown',
        }),
      ).toThrow('Unknown resolution strategy: unknown');
    });
  });

  describe('validateResolutionResult', () => {
    it('should validate successful resolution', () => {
      const resolutionResult = {
        success: true,
        strategy: 'keep_local',
        resolvedSession: {
          meta: {
            version: { version: 4, timestamp: '2024-01-01T00:00:00Z' },
            conflictResolved: true,
            resolutionStrategy: 'keep_local',
          },
          messages: [],
        },
      };

      const validation = validateResolutionResult(resolutionResult);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing resolved session', () => {
      const resolutionResult = {
        success: true,
        strategy: 'keep_local',
      };

      const validation = validateResolutionResult(resolutionResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Resolved session is missing');
    });

    it('should detect missing metadata', () => {
      const resolutionResult = {
        success: true,
        strategy: 'keep_local',
        resolvedSession: {
          messages: [],
        },
      };

      const validation = validateResolutionResult(resolutionResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('metadata'))).toBe(true);
    });

    it('should detect missing version', () => {
      const resolutionResult = {
        success: true,
        strategy: 'keep_local',
        resolvedSession: {
          meta: { conflictResolved: true, resolutionStrategy: 'keep_local' },
          messages: [],
        },
      };

      const validation = validateResolutionResult(resolutionResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('version'))).toBe(true);
    });

    it('should detect failed resolution', () => {
      const resolutionResult = {
        success: false,
        requiresUserInput: true,
      };

      const validation = validateResolutionResult(resolutionResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Resolution was not successful');
    });
  });
});
