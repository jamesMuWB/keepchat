describe('Version Management Module', () => {
  describe('createInitialVersion', () => {
    it('should create initial version', () => {
      const version = createInitialVersion();

      expect(version.version).toBe(1);
      expect(version.timestamp).toBeDefined();
      expect(version.device).toBeDefined();
      expect(version.author).toBe('system');
    });
  });

  describe('incrementVersion', () => {
    it('should increment version', () => {
      const current = {
        version: 1,
        timestamp: '2024-01-01T00:00:00Z',
        device: 'device-1',
        author: 'user',
      };

      const incremented = incrementVersion({
        currentVersion: current,
        author: 'user2',
      });

      expect(incremented.version).toBe(2);
      expect(incremented.author).toBe('user2');
      expect(incremented.previousVersion).toBe(1);
      expect(incremented.previousTimestamp).toBe(current.timestamp);
    });

    it('should create initial if no current version', () => {
      const incremented = incrementVersion({
        currentVersion: null,
        author: 'user',
      });

      expect(incremented.version).toBe(1);
    });
  });

  describe('syncVersion', () => {
    it('should sync version from cloud', () => {
      const cloudVersion = {
        version: 5,
        timestamp: '2024-01-01T00:00:00Z',
        device: 'cloud-device',
        author: 'cloud-user',
      };

      const synced = syncVersion({ cloudVersion });

      expect(synced.version).toBe(5);
      expect(synced.device).toBe('cloud-device');
      expect(synced.author).toBe('cloud-user');
      expect(synced.syncedAt).toBeDefined();
    });
  });

  describe('mergeVersion', () => {
    it('should merge versions', () => {
      const local = {
        version: 3,
        timestamp: '2024-01-01T00:00:00Z',
        device: 'd1',
        author: 'user1',
      };
      const remote = {
        version: 4,
        timestamp: '2024-01-02T00:00:00Z',
        device: 'd2',
        author: 'user2',
      };

      const merged = mergeVersion({
        localVersion: local,
        remoteVersion: remote,
        resolutionStrategy: 'keep_local',
      });

      expect(merged.version).toBe(5); // max(3,4) + 1
      expect(merged.author).toBe('merged');
      expect(merged.resolution.strategy).toBe('keep_local');
      expect(merged.resolution.localVersion).toBe(3);
      expect(merged.resolution.remoteVersion).toBe(4);
    });
  });

  describe('compareVersions', () => {
    it('should compare versions', () => {
      const v1 = { version: 3, timestamp: '2024-01-01T00:00:00Z' };
      const v2 = { version: 4, timestamp: '2024-01-02T00:00:00Z' };

      expect(compareVersions({ version1: v1, version2: v2 })).toBe(-1);
      expect(compareVersions({ version1: v2, version2: v1 })).toBe(1);
    });

    it('should compare timestamps when versions are equal', () => {
      const v1 = { version: 3, timestamp: '2024-01-01T00:00:00Z' };
      const v2 = { version: 3, timestamp: '2024-01-02T00:00:00Z' };

      expect(compareVersions({ version1: v1, version2: v2 })).toBe(-1);
      expect(compareVersions({ version1: v2, version2: v1 })).toBe(1);
    });

    it('should return 0 for equal versions', () => {
      const v = { version: 3, timestamp: '2024-01-01T00:00:00Z' };

      expect(compareVersions({ version1: v, version2: v })).toBe(0);
    });
  });

  describe('detectVersionConflict', () => {
    it('should detect no conflict with same version', () => {
      const v = { version: 3, timestamp: '2024-01-01T00:00:00Z' };

      const result = detectVersionConflict({
        localVersion: v,
        cloudVersion: v,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.synced).toBe(true);
    });

    it('should detect cloud newer', () => {
      const local = { version: 2, timestamp: '2024-01-01T00:00:00Z' };
      const cloud = { version: 3, timestamp: '2024-01-02T00:00:00Z' };

      const result = detectVersionConflict({
        localVersion: local,
        cloudVersion: cloud,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.needsSync).toBe(true);
      expect(result.direction).toBe('pull');
    });

    it('should detect local newer', () => {
      const local = { version: 3, timestamp: '2024-01-02T00:00:00Z' };
      const cloud = { version: 2, timestamp: '2024-01-01T00:00:00Z' };

      const result = detectVersionConflict({
        localVersion: local,
        cloudVersion: cloud,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.needsSync).toBe(true);
      expect(result.direction).toBe('push');
    });
  });

  describe('validateVersion', () => {
    it('should validate valid version', () => {
      const version = {
        version: 3,
        timestamp: '2024-01-01T00:00:00Z',
        device: 'device-1',
        author: 'user',
      };

      const result = validateVersion(version);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing fields', () => {
      const version = { version: 3 };

      const result = validateVersion(version);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('timestamp'))).toBe(true);
      expect(result.errors.some((e) => e.includes('device'))).toBe(true);
    });

    it('should detect invalid version number', () => {
      const version = {
        version: -1,
        timestamp: '2024-01-01T00:00:00Z',
        device: 'device-1',
        author: 'user',
      };

      const result = validateVersion(version);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('positive'))).toBe(true);
    });

    it('should detect invalid timestamp', () => {
      const version = {
        version: 3,
        timestamp: 'invalid-date',
        device: 'device-1',
        author: 'user',
      };

      const result = validateVersion(version);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('timestamp'))).toBe(true);
    });
  });

  describe('formatVersion', () => {
    it('should format version', () => {
      const version = {
        version: 3,
        timestamp: '2024-01-01T12:30:45Z',
        device: 'device-1',
        author: 'user',
      };

      const formatted = formatVersion(version);

      expect(formatted).toContain('v3');
      expect(formatted).toContain('12:30:45');
    });

    it('should return N/A for null version', () => {
      const formatted = formatVersion(null);

      expect(formatted).toBe('N/A');
    });
  });
});
