describe('Auto Merger Module', () => {
  const sampleConflictResult = {
    hasConflict: true,
    conflictType: 'data_conflict',
    severity: 'medium',
    reason: 'data_divergence',
    localSession: {
      meta: {
        sessionId: 'local-123',
        version: { version: 3, timestamp: '2024-01-03T00:00:00Z', device: 'd1' },
        messageCount: 3,
      },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Shared', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Response', createdAt: '2024-01-01T00:00:01Z' },
        { id: 'msg-3', role: 'user', content: 'Local only', createdAt: '2024-01-02T00:00:00Z' },
      ],
      context: { projectPath: '/local/project' },
    },
    cloudSession: {
      meta: {
        sessionId: 'cloud-456',
        version: { version: 3, timestamp: '2024-01-02T00:00:00Z', device: 'd2' },
        messageCount: 2,
      },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Shared', createdAt: '2024-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Response', createdAt: '2024-01-01T00:00:01Z' },
      ],
      context: { projectPath: '/cloud/project' },
    },
    dataConflict: {
      hasConflict: true,
      onlyLocal: [
        { id: 'msg-3', role: 'user', content: 'Local only', createdAt: '2024-01-02T00:00:00Z' },
      ],
      onlyCloud: [],
      modifiedOverlap: [],
      onlyLocalCount: 1,
      onlyCloudCount: 0,
      modifiedOverlapCount: 0,
    },
  };

  const sampleOverlapConflict = {
    hasConflict: true,
    conflictType: 'data_conflict',
    severity: 'high',
    reason: 'data_divergence',
    localSession: {
      meta: {
        sessionId: 'local-123',
        version: { version: 3, timestamp: '2024-01-03T00:00:00Z', device: 'd1' },
        messageCount: 1,
      },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Original', createdAt: '2024-01-01T00:00:00Z' },
      ],
      context: {},
    },
    cloudSession: {
      meta: {
        sessionId: 'cloud-456',
        version: { version: 3, timestamp: '2024-01-02T00:00:00Z', device: 'd2' },
        messageCount: 1,
      },
      messages: [
        { id: 'msg-1', role: 'user', content: 'Modified', createdAt: '2024-01-01T00:00:00Z' },
      ],
      context: {},
    },
    dataConflict: {
      hasConflict: true,
      onlyLocal: [],
      onlyCloud: [],
      modifiedOverlap: [
        {
          id: 'msg-1',
          localContent: 'Original',
          cloudContent: 'Modified',
        },
      ],
      onlyLocalCount: 0,
      onlyCloudCount: 0,
      modifiedOverlapCount: 1,
    },
  };

  describe('canAutoMerge', () => {
    it('should return false for no conflict', () => {
      const result = canAutoMerge({ hasConflict: false });

      expect(result.canAutoMerge).toBe(false);
      expect(result.reason).toBe('no_conflict');
    });

    it('should return false for no data conflict', () => {
      const result = canAutoMerge({
        hasConflict: true,
        conflictType: 'metadata_conflict',
      });

      expect(result.canAutoMerge).toBe(false);
      expect(result.reason).toBe('no_data_conflict');
    });

    it('should return false for modified overlaps', () => {
      const result = canAutoMerge(sampleOverlapConflict);

      expect(result.canAutoMerge).toBe(false);
      expect(result.reason).toBe('has_modified_overlaps');
      expect(result.details.modifiedOverlapCount).toBe(1);
    });

    it('should return false for both sides have new messages', () => {
      const conflictWithBothSides = {
        ...sampleConflictResult,
        dataConflict: {
          hasConflict: true,
          onlyLocal: sampleConflictResult.dataConflict.onlyLocal,
          onlyCloud: [
            { id: 'msg-4', role: 'user', content: 'Cloud only', createdAt: '2024-01-02T00:00:00Z' },
          ],
          modifiedOverlap: [],
          onlyLocalCount: 1,
          onlyCloudCount: 1,
          modifiedOverlapCount: 0,
        },
      };

      const result = canAutoMerge(conflictWithBothSides);

      expect(result.canAutoMerge).toBe(false);
      expect(result.reason).toBe('both_sides_have_new_messages');
      expect(result.details.onlyLocalCount).toBe(1);
      expect(result.details.onlyCloudCount).toBe(1);
    });

    it('should return true for only local has new messages', () => {
      const result = canAutoMerge(sampleConflictResult);

      expect(result.canAutoMerge).toBe(true);
      expect(result.strategy).toBe('append_local');
      expect(result.reason).toBe('only_local_has_new_messages');
      expect(result.details.newMessageCount).toBe(1);
    });

    it('should return true for only cloud has new messages', () => {
      const conflictWithCloudOnly = {
        ...sampleConflictResult,
        dataConflict: {
          hasConflict: true,
          onlyLocal: [],
          onlyCloud: [
            { id: 'msg-4', role: 'user', content: 'Cloud only', createdAt: '2024-01-02T00:00:00Z' },
          ],
          modifiedOverlap: [],
          onlyLocalCount: 0,
          onlyCloudCount: 1,
          modifiedOverlapCount: 0,
        },
      };

      const result = canAutoMerge(conflictWithCloudOnly);

      expect(result.canAutoMerge).toBe(true);
      expect(result.strategy).toBe('append_cloud');
      expect(result.reason).toBe('only_cloud_has_new_messages');
    });
  });

  describe('performAutoMerge', () => {
    it('should auto-merge when possible', () => {
      const result = performAutoMerge({
        conflictResult: sampleConflictResult,
      });

      expect(result.success).toBe(true);
      expect(result.strategy).toBe('append_local');
      expect(result.mergedSession).toBeDefined();
      expect(result.assessment.canAutoMerge).toBe(true);
    });

    it('should increment version', () => {
      const result = performAutoMerge({
        conflictResult: sampleConflictResult,
      });

      expect(result.mergedSession.meta.version.version).toBeGreaterThan(
        Math.max(
          sampleConflictResult.localSession.meta.version.version,
          sampleConflictResult.cloudSession.meta.version.version,
        ),
      );
    });

    it('should mark as auto-merged', () => {
      const result = performAutoMerge({
        conflictResult: sampleConflictResult,
      });

      expect(result.mergedSession.meta.autoMerged).toBe(true);
      expect(result.mergedSession.meta.resolutionStrategy).toBe('auto_merge_append_local');
    });

    it('should throw error when cannot auto-merge', () => {
      expect(() =>
        performAutoMerge({
          conflictResult: sampleOverlapConflict,
        }),
      ).toThrow('Cannot auto-merge');
    });
  });

  describe('smartMerge', () => {
    it('should perform auto-merge when possible', () => {
      const result = smartMerge({
        conflictResult: sampleConflictResult,
      });

      expect(result.success).toBe(true);
      expect(result.autoMergePossible).toBe(true);
      expect(result.autoMerged).toBe(true);
      expect(result.strategy).toBe('append_local');
    });

    it('should return manual intervention required when cannot auto-merge', () => {
      const result = smartMerge({
        conflictResult: sampleOverlapConflict,
      });

      expect(result.success).toBe(false);
      expect(result.autoMergePossible).toBe(false);
      expect(result.requiresManualIntervention).toBe(true);
      expect(result.reason).toBe('has_modified_overlaps');
      expect(result.recommendedActions).toBeDefined();
    });

    it('should handle auto-merge error gracefully', () => {
      // Simulate an error during auto-merge
      const conflictWithError = {
        ...sampleConflictResult,
        dataConflict: null, // This will cause an error
      };

      const result = smartMerge({
        conflictResult: conflictWithError,
      });

      expect(result.success).toBe(false);
      expect(result.requiresManualIntervention).toBe(true);
      expect(result.error).toBeDefined();
    });
  });

  describe('generateMergePreview', () => {
    it('should generate preview for append_local', () => {
      const preview = generateMergePreview({
        conflictResult: sampleConflictResult,
        strategy: 'append_local',
      });

      expect(preview.strategy).toBe('append_local');
      expect(preview.previewSession).toBeDefined();
      expect(preview.summary).toBeDefined();
      expect(preview.summary.localMessageCount).toBe(3);
      expect(preview.summary.cloudMessageCount).toBe(2);
      expect(preview.summary.mergedMessageCount).toBe(3);
      expect(preview.summary.addedCount).toBe(1);
    });

    it('should generate preview for append_cloud', () => {
      const conflictWithCloudOnly = {
        ...sampleConflictResult,
        dataConflict: {
          hasConflict: true,
          onlyLocal: [],
          onlyCloud: [
            { id: 'msg-4', role: 'user', content: 'Cloud only', createdAt: '2024-01-02T00:00:00Z' },
          ],
          modifiedOverlap: [],
          onlyLocalCount: 0,
          onlyCloudCount: 1,
          modifiedOverlapCount: 0,
        },
      };

      const preview = generateMergePreview({
        conflictResult: conflictWithCloudOnly,
        strategy: 'append_cloud',
      });

      expect(preview.strategy).toBe('append_cloud');
      expect(preview.summary.localMessageCount).toBe(2);
      expect(preview.summary.cloudMessageCount).toBe(3);
      expect(preview.summary.mergedMessageCount).toBe(3);
      expect(preview.summary.addedCount).toBe(1);
    });

    it('should throw error for unknown strategy', () => {
      expect(() =>
        generateMergePreview({
          conflictResult: sampleConflictResult,
          strategy: 'unknown',
        }),
      ).toThrow('Unknown merge strategy: unknown');
    });
  });

  describe('validateMergeResult', () => {
    it('should validate successful auto-merge', () => {
      const mergeResult = {
        success: true,
        strategy: 'append_local',
        mergedSession: {
          meta: {
            version: { version: 4, timestamp: '2024-01-01T00:00:00Z' },
            autoMerged: true,
            resolutionStrategy: 'auto_merge_append_local',
          },
          messages: [
            { id: 'msg-1', role: 'user', content: 'Test', createdAt: '2024-01-01T00:00:00Z' },
          ],
          context: { projectPath: '/project' },
        },
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect failed merge', () => {
      const mergeResult = {
        success: false,
        reason: 'error',
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Merge was not successful');
    });

    it('should detect missing merged session', () => {
      const mergeResult = {
        success: true,
        strategy: 'append_local',
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Merged session is missing');
    });

    it('should detect missing metadata', () => {
      const mergeResult = {
        success: true,
        strategy: 'append_local',
        mergedSession: {
          messages: [],
          context: {},
        },
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('metadata'))).toBe(true);
    });

    it('should detect missing version', () => {
      const mergeResult = {
        success: true,
        strategy: 'append_local',
        mergedSession: {
          meta: { autoMerged: true, resolutionStrategy: 'auto_merge_append_local' },
          messages: [],
          context: {},
        },
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('version'))).toBe(true);
    });

    it('should warn about missing messages', () => {
      const mergeResult = {
        success: true,
        strategy: 'append_local',
        mergedSession: {
          meta: {
            version: { version: 4, timestamp: '2024-01-01T00:00:00Z' },
            autoMerged: true,
            resolutionStrategy: 'auto_merge_append_local',
          },
          messages: [],
          context: {},
        },
      };

      const validation = validateMergeResult(mergeResult);

      expect(validation.valid).toBe(true);
      expect(validation.warnings).toContain('Session has no messages');
    });
  });
});
