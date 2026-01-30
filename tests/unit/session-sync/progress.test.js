describe('Progress Tracker Module', () => {
  describe('createProgressTracker', () => {
    it('should create tracker with defaults', () => {
      const tracker = createProgressTracker();

      expect(tracker).toBeDefined();
      expect(tracker.startTime).toBeDefined();
      expect(tracker.overallProgress).toBe(0);
      expect(tracker.logs).toEqual([]);
      expect(tracker.errors).toEqual([]);
    });

    it('should accept custom options', () => {
      const onProgress = jest.fn();
      const onPhaseChange = jest.fn();
      const onError = jest.fn();

      const tracker = createProgressTracker({
        verbose: true,
        onProgress,
        onPhaseChange,
        onError,
      });

      expect(tracker.options.verbose).toBe(true);
      expect(tracker.options.onProgress).toBe(onProgress);
      expect(tracker.options.onPhaseChange).toBe(onPhaseChange);
      expect(tracker.options.onError).toBe(onError);
    });
  });

  describe('startPhase', () => {
    it('should start initialize phase', () => {
      const tracker = createProgressTracker();
      const callback = jest.fn();

      tracker.options.onPhaseChange = callback;

      startPhase({ tracker, phase: RestorePhase.INITIALIZE });

      expect(tracker.currentPhase).toBe(RestorePhase.INITIALIZE);
      expect(tracker.phaseProgress[RestorePhase.INITIALIZE]).toBeDefined();
      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].phase).toBe(RestorePhase.INITIALIZE);
    });

    it('should throw error for unknown phase', () => {
      const tracker = createProgressTracker();

      expect(() => startPhase({ tracker, phase: 'unknown' })).toThrow('Unknown phase');
    });

    it('should log phase start', () => {
      const tracker = createProgressTracker();

      startPhase({ tracker, phase: RestorePhase.DOWNLOAD });

      expect(tracker.logs.length).toBe(1);
      expect(tracker.logs[0].message).toContain('Downloading session data');
      expect(tracker.logs[0].phase).toBe(RestorePhase.DOWNLOAD);
    });
  });

  describe('updatePhaseProgress', () => {
    it('should update phase progress', () => {
      const tracker = createProgressTracker();
      const callback = jest.fn();

      tracker.options.onProgress = callback;
      tracker.phaseProgress[RestorePhase.DOWNLOAD] = {
        started: Date.now(),
        progress: 0,
      };

      updatePhaseProgress({
        tracker,
        phase: RestorePhase.DOWNLOAD,
        progress: 50,
      });

      expect(tracker.phaseProgress[RestorePhase.DOWNLOAD].progress).toBe(50);
      expect(tracker.overallProgress).toBeGreaterThan(0);
      expect(callback).toHaveBeenCalled();
    });

    it('should clamp progress to 0-100', () => {
      const tracker = createProgressTracker();

      updatePhaseProgress({
        tracker,
        phase: RestorePhase.DOWNLOAD,
        progress: 150,
      });

      expect(tracker.phaseProgress[RestorePhase.DOWNLOAD].progress).toBe(100);
    });

    it('should accept metadata', () => {
      const tracker = createProgressTracker();
      const callback = jest.fn();

      tracker.options.onProgress = callback;
      tracker.phaseProgress[RestorePhase.DOWNLOAD] = {
        started: Date.now(),
        progress: 0,
      };

      updatePhaseProgress({
        tracker,
        phase: RestorePhase.DOWNLOAD,
        progress: 50,
        meta: { file: 'test.json', loaded: '50 KB', total: '100 KB' },
      });

      const callbackArgs = callback.mock.calls[0][0];
      expect(callbackArgs.file).toBe('test.json');
      expect(callbackArgs.loaded).toBe('50 KB');
      expect(callbackArgs.total).toBe('100 KB');
    });
  });

  describe('completePhase', () => {
    it('should complete phase', () => {
      const tracker = createProgressTracker();
      tracker.phaseProgress[RestorePhase.DOWNLOAD] = {
        started: Date.now(),
        progress: 50,
      };

      completePhase({ tracker, phase: RestorePhase.DOWNLOAD });

      expect(tracker.phaseProgress[RestorePhase.DOWNLOAD].progress).toBe(100);
    });

    it('should log phase completion', () => {
      const tracker = createProgressTracker();
      tracker.phaseProgress[RestorePhase.DOWNLOAD] = {
        started: Date.now(),
        progress: 50,
      };

      completePhase({ tracker, phase: RestorePhase.DOWNLOAD });

      const log = tracker.logs.find((l) => l.message.includes('Completed'));
      expect(log).toBeDefined();
      expect(log.message).toContain('Downloading session data');
    });
  });

  describe('calculateOverallProgress', () => {
    it('should calculate 0% for no progress', () => {
      const tracker = createProgressTracker();

      const progress = calculateOverallProgress(tracker);

      expect(progress).toBe(0);
    });

    it('should calculate partial progress', () => {
      const tracker = createProgressTracker();

      startPhase({ tracker, phase: RestorePhase.INITIALIZE });
      updatePhaseProgress({
        tracker,
        phase: RestorePhase.INITIALIZE,
        progress: 100,
      });

      startPhase({ tracker, phase: RestorePhase.DOWNLOAD });
      updatePhaseProgress({
        tracker,
        phase: RestorePhase.DOWNLOAD,
        progress: 50,
      });

      const progress = calculateOverallProgress(tracker);

      // Initialize: 5% * 100% = 5%
      // Download: 30% * 50% = 15%
      // Total: ~20%
      expect(progress).toBeGreaterThanOrEqual(19);
      expect(progress).toBeLessThanOrEqual(21);
    });

    it('should calculate 100% for completed phases', () => {
      const tracker = createProgressTracker();

      for (const step of RestoreSteps) {
        startPhase({ tracker, phase: step.phase });
        completePhase({ tracker, phase: step.phase });
      }

      const progress = calculateOverallProgress(tracker);

      expect(progress).toBe(100);
    });
  });

  describe('log', () => {
    it('should log message', () => {
      const tracker = createProgressTracker();

      log({ tracker, message: 'Test message', level: 'info' });

      expect(tracker.logs.length).toBe(1);
      expect(tracker.logs[0].message).toBe('Test message');
      expect(tracker.logs[0].level).toBe('info');
    });

    it('should include phase in log', () => {
      const tracker = createProgressTracker();

      log({
        tracker,
        message: 'Test message',
        level: 'info',
        phase: RestorePhase.DOWNLOAD,
      });

      expect(tracker.logs[0].phase).toBe(RestorePhase.DOWNLOAD);
    });

    it('should include data in log', () => {
      const tracker = createProgressTracker();

      log({
        tracker,
        message: 'Test message',
        level: 'info',
        data: { key: 'value' },
      });

      expect(tracker.logs[0].data).toEqual({ key: 'value' });
    });
  });

  describe('logError', () => {
    it('should log error', () => {
      const tracker = createProgressTracker();
      const callback = jest.fn();

      tracker.options.onError = callback;
      tracker.currentPhase = RestorePhase.DOWNLOAD;

      const error = new Error('Test error');
      logError({ tracker, error, context: { sessionId: 'test-123' } });

      expect(tracker.errors.length).toBe(1);
      expect(tracker.errors[0].error.message).toBe('Test error');
      expect(tracker.errors[0].context).toEqual({ sessionId: 'test-123' });
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('formatBytes', () => {
    it('should format bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should format decimal values', () => {
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(1536 * 1024)).toBe('1.50 MB');
    });
  });

  describe('generateProgressReport', () => {
    it('should generate progress report', () => {
      const tracker = createProgressTracker();

      startPhase({ tracker, phase: RestorePhase.INITIALIZE });
      completePhase({ tracker, phase: RestorePhase.INITIALIZE });

      const report = generateProgressReport(tracker);

      expect(report.overallProgress).toBeGreaterThan(0);
      expect(report.currentPhase).toBe(RestorePhase.INITIALIZE);
      expect(report.elapsed).toBeDefined();
      expect(report.logs.length).toBeGreaterThan(0);
      expect(report.hasErrors).toBe(false);
    });

    it('should include elapsed time', () => {
      const tracker = createProgressTracker();

      const report = generateProgressReport(tracker);

      expect(report.elapsed).toBeDefined();
      expect(report.elapsedFormatted).toBeDefined();
    });
  });

  describe('completeRestore', () => {
    it('should complete restore and generate report', () => {
      const tracker = createProgressTracker();
      const result = { sessionId: 'test-123' };

      startPhase({ tracker, phase: RestorePhase.INITIALIZE });
      completePhase({ tracker, phase: RestorePhase.INITIALIZE });

      const report = completeRestore({ tracker, result });

      expect(report.success).toBe(true);
      expect(report.duration).toBeDefined();
      expect(report.result).toBe(result);
      expect(report.logs).toEqual(tracker.logs);
      expect(report.errors).toEqual(tracker.errors);
    });

    it('should mark complete phase', () => {
      const tracker = createProgressTracker();
      const result = { sessionId: 'test-123' };

      const report = completeRestore({ tracker, result });

      expect(tracker.overallProgress).toBe(100);
      expect(report.durationFormatted).toBeDefined();
    });
  });
});
