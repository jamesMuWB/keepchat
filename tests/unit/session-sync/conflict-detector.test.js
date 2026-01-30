describe('Conflict Detector Module', () => {
  const sampleLocalSession = {
    meta: {
      sessionId: 'local-123',
      version: { version: 3, timestamp: '2024-01-03T00:00:00Z', device: 'd1' },
      messageCount: 5,
      device: 'd1',
      projectPath: '/local/project',
    },
    messages: [
      { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'msg-2', role: 'assistant', content: 'Hi!', createdAt: '2024-01-01T00:00:01Z' },
      { id: 'msg-3', role: 'user', content: 'Local only', createdAt: '2024-01-02T00:00:00Z' },
    ],
    context: { projectPath: '/local/project' },
  };

  const sampleCloudSession = {
    meta: {
      sessionId: 'cloud-456',
      version: { version: 3, timestamp: '2024-01-02T00:00:00Z', device: 'd2' },
      messageCount: 4,
      device: 'd2',
      projectPath: '/cloud/project',
    },
    messages: [
      { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2024-01-01T00:00:00Z' },
      { id: 'msg-2', role: 'assistant', content: 'Hi!', createdAt: '2024-01-01T00:00:01Z' },
      { id: 'msg-4', role: 'user', content: 'Cloud only', createdAt: '2024-01-02T00:00:00Z' },
    ],
    context: { projectPath: '/cloud/project' },
  };

  describe('detectDataConflict', () => {
    it('should detect no conflict with empty messages', () => {
      const result = detectDataConflict({
        localMessages: [],
        cloudMessages: [],
      });

      expect(result.hasConflict).toBe(false);
      expect(result.severity).toBe(ConflictSeverity.LOW);
    });

    it('should detect messages only in local', () => {
      const result = detectDataConflict({
        localMessages: sampleLocalSession.messages,
        cloudMessages: sampleCloudSession.messages.slice(0, 2),
      });

      expect(result.hasConflict).toBe(true);
      expect(result.onlyLocalCount).toBe(1);
      expect(result.onlyCloudCount).toBe(0);
      expect(result.severity).toBe(ConflictSeverity.MEDIUM);
    });

    it('should detect messages only in cloud', () => {
      const result = detectDataConflict({
        localMessages: sampleLocalSession.messages.slice(0, 2),
        cloudMessages: sampleCloudSession.messages,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.onlyLocalCount).toBe(0);
      expect(result.onlyCloudCount).toBe(1);
      expect(result.severity).toBe(ConflictSeverity.MEDIUM);
    });

    it('should detect modified overlapping messages', () => {
      const modifiedCloud = [{ ...sampleCloudSession.messages[0], content: 'Modified hello' }];

      const result = detectDataConflict({
        localMessages: [sampleLocalSession.messages[0]],
        cloudMessages: modifiedCloud,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.modifiedOverlapCount).toBe(1);
      expect(result.severity).toBe(ConflictSeverity.HIGH);
      expect(result.modifiedOverlap[0].localContent).toBe('Hello');
      expect(result.modifiedOverlap[0].cloudContent).toBe('Modified hello');
    });
  });

  describe('detectMetadataConflict', () => {
    it('should detect no conflict with same metadata', () => {
      const meta = {
        version: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
        messageCount: 5,
        device: 'd1',
        projectPath: '/project',
      };

      const result = detectMetadataConflict({
        localMeta: meta,
        cloudMeta: meta,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflicts).toHaveLength(0);
    });

    it('should detect project path conflict', () => {
      const result = detectMetadataConflict({
        localMeta: {
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
          messageCount: 5,
          device: 'd1',
          projectPath: '/local/project',
        },
        cloudMeta: {
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
          messageCount: 5,
          device: 'd1',
          projectPath: '/cloud/project',
        },
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.some((c) => c.field === 'projectPath')).toBe(true);
    });

    it('should detect multiple conflicts', () => {
      const result = detectMetadataConflict({
        localMeta: {
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
          messageCount: 5,
          device: 'd1',
          projectPath: '/local/project',
        },
        cloudMeta: {
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
          messageCount: 4,
          device: 'd2',
          projectPath: '/cloud/project',
        },
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflicts.length).toBe(3);
    });
  });

  describe('detectSessionConflict', () => {
    it('should detect no conflict with same version', () => {
      const session = {
        meta: {
          sessionId: 'test-123',
          version: { version: 3, timestamp: '2024-01-01T00:00:00Z', device: 'd1' },
        },
        messages: [sampleLocalSession.messages[0]],
        context: {},
      };

      const result = detectSessionConflict({
        localSession: session,
        cloudSession: session,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflictType).toBe(ConflictType.NONE);
      expect(result.synced).toBe(true);
    });

    it('should detect concurrent modification', () => {
      const result = detectSessionConflict({
        localSession: sampleLocalSession,
        cloudSession: sampleCloudSession,
        options: { lastSyncedVersion: { version: 2 } },
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.CONCURRENT_MODIFICATION);
      expect(result.severity).toBe(ConflictSeverity.HIGH);
    });

    it('should detect data conflict', () => {
      const result = detectSessionConflict({
        localSession: sampleLocalSession,
        cloudSession: sampleCloudSession,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.DATA_CONFLICT);
    });

    it('should detect metadata conflict', () => {
      const local = {
        ...sampleLocalSession,
        messages: sampleLocalSession.messages.slice(0, 2),
      };
      const cloud = {
        ...sampleCloudSession,
        messages: sampleCloudSession.messages.slice(0, 2),
      };

      const result = detectSessionConflict({
        localSession: local,
        cloudSession: cloud,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.METADATA_CONFLICT);
    });
  });

  describe('generateConflictReport', () => {
    it('should generate report for no conflict', () => {
      const report = generateConflictReport({ hasConflict: false });

      expect(report).toContain('No conflict detected');
    });

    it('should generate report for conflict', () => {
      const report = generateConflictReport({
        hasConflict: true,
        conflictType: ConflictType.CONCURRENT_MODIFICATION,
        severity: ConflictSeverity.HIGH,
        versionConflict: {
          localVersion: { version: 3, timestamp: '2024-01-01T00:00:00Z' },
          cloudVersion: { version: 3, timestamp: '2024-01-02T00:00:00Z' },
        },
      });

      expect(report).toContain('Conflict Report');
      expect(report).toContain('CONCURRENT_MODIFICATION');
      expect(report).toContain('v3');
    });
  });

  describe('getRecommendedStrategies', () => {
    it('should recommend sync for no conflict', () => {
      const strategies = getRecommendedStrategies({
        hasConflict: false,
      });

      expect(strategies).toEqual(['sync']);
    });

    it('should recommend strategies for concurrent modification', () => {
      const strategies = getRecommendedStrategies({
        hasConflict: true,
        conflictType: ConflictType.CONCURRENT_MODIFICATION,
      });

      expect(strategies).toContain('keep_local');
      expect(strategies).toContain('keep_cloud');
      expect(strategies).toContain('manual_merge');
    });

    it('should recommend strategies for data conflict', () => {
      const strategies = getRecommendedStrategies({
        hasConflict: true,
        conflictType: ConflictType.DATA_CONFLICT,
        dataConflict: {
          onlyLocalCount: 2,
          onlyCloudCount: 0,
          modifiedOverlapCount: 0,
        },
      });

      expect(strategies).toContain('keep_local');
      expect(strategies).toContain('manual_merge');
    });
  });

  describe('canAutoResolve', () => {
    it('should allow auto-resolve for no conflict', () => {
      const result = canAutoResolve({ hasConflict: false }, 'keep_local');

      expect(result.canResolve).toBe(true);
    });

    it('should not auto-resolve high severity', () => {
      const result = canAutoResolve(
        {
          hasConflict: true,
          severity: ConflictSeverity.HIGH,
        },
        'keep_local',
      );

      expect(result.canResolve).toBe(false);
      expect(result.reason).toBe('requires_manual_intervention');
    });

    it('should allow auto-resolve for metadata conflict', () => {
      const result = canAutoResolve(
        {
          hasConflict: true,
          conflictType: ConflictType.METADATA_CONFLICT,
          severity: ConflictSeverity.LOW,
        },
        'keep_local',
      );

      expect(result.canResolve).toBe(true);
      expect(result.reason).toBe('metadata_override_allowed');
    });

    it('should not auto-resolve for data conflict', () => {
      const result = canAutoResolve(
        {
          hasConflict: true,
          conflictType: ConflictType.DATA_CONFLICT,
          severity: ConflictSeverity.HIGH,
        },
        'keep_local',
      );

      expect(result.canResolve).toBe(false);
      expect(result.reason).toBe('data_conflict_requires_review');
    });
  });
});
