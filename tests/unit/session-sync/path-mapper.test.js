describe('Path Mapper Module', () => {
  describe('getPlatform', () => {
    it('should return current platform', () => {
      const platform = getPlatform();
      expect(platform).toBeDefined();
      expect(typeof platform).toBe('string');
      expect(['darwin', 'linux', 'win32', 'freebsd', 'openbsd']).toContain(platform);
    });
  });

  describe('detectPathType', () => {
    it('should detect Windows absolute path', () => {
      const result = detectPathType({ filePath: 'C:\\Users\\test\\project' });

      expect(result.platform).toBe('win32');
      expect(result.isAbsolute).toBe(true);
      expect(result.isWindows).toBe(true);
      expect(result.isUnix).toBe(false);
    });

    it('should detect Unix absolute path', () => {
      const result = detectPathType({ filePath: '/Users/test/project' });

      expect(result.isAbsolute).toBe(true);
      expect(result.isWindows).toBe(false);
      expect(result.isUnix).toBe(true);
    });

    it('should detect relative path', () => {
      const result = detectPathType({ filePath: './test/project' });

      expect(result.isAbsolute).toBe(false);
      expect(result.isWindows).toBe(false);
      expect(result.isUnix).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('should normalize Unix path', () => {
      const result = normalizePath({
        filePath: '/Users/test/project/../src',
      });

      expect(result).toBe('/Users/test/src');
    });

    it('should normalize Windows path to Unix on non-Windows', () => {
      const result = normalizePath({
        filePath: 'C:\\Users\\test\\project',
        targetPlatform: 'darwin',
      });

      expect(result).toContain('/C:');
      expect(result).toContain('Users/test/project');
      expect(result).not.toContain('\\');
    });

    it('should keep Unix path as-is on same platform', () => {
      const result = normalizePath({
        filePath: '/Users/test/project',
        targetPlatform: 'darwin',
      });

      expect(result).toBe('/Users/test/project');
    });
  });

  describe('extractUsername', () => {
    it('should extract username from Unix path', () => {
      const username = extractUsername({
        path: '/Users/johndoe/project',
      });

      expect(username).toBe('johndoe');
    });

    it('should extract username from Linux path', () => {
      const username = extractUsername({
        path: '/home/johndoe/project',
      });

      expect(username).toBe('johndoe');
    });

    it('should extract username from Windows path', () => {
      const username = extractUsername({
        path: 'C:\\Users\\johndoe\\project',
      });

      expect(username).toBe('johndoe');
    });

    it('should return null if no username found', () => {
      const username = extractUsername({
        path: '/tmp/project',
      });

      expect(username).toBe(null);
    });
  });

  describe('detectMappingStrategy', () => {
    it('should recommend none for same platform', () => {
      const sourceContext = {
        device: { platform: getPlatform() },
        projectPath: '/Users/test/project',
      };

      const strategy = detectMappingStrategy({
        sourceContext,
        targetContext: {},
      });

      expect(strategy.type).toBe('none');
      expect(strategy.reason).toBe('same platform');
    });

    it('should recommend userdir for different usernames', () => {
      const sourceContext = {
        device: { platform: 'linux' },
        projectPath: '/home/otheruser/project',
      };

      const strategy = detectMappingStrategy({
        sourceContext,
        targetContext: {},
      });

      expect(strategy.type).toBe('userdir');
      expect(strategy.reason).toBe('different user directory');
      expect(strategy.username).toBe('otheruser');
    });
  });

  describe('createPathMapping', () => {
    it('should create mapping for userdir strategy', () => {
      const sourceContext = {
        device: { platform: 'linux' },
        projectPath: '/home/otheruser/project',
      };

      const mapping = createPathMapping({ sourceContext });

      expect(mapping.strategy.type).toBe('userdir');
      expect(mapping.rules.type).toBe('userdir');
      expect(mapping.rules.username).toBe('otheruser');
    });

    it('should create mapping for none strategy', () => {
      const sourceContext = {
        device: { platform: getPlatform() },
        projectPath: '/Users/test/project',
      };

      const mapping = createPathMapping({ sourceContext });

      expect(mapping.strategy.type).toBe('none');
    });
  });

  describe('applyMappingToContext', () => {
    it('should apply userdir mapping to project path', () => {
      const sessionContext = {
        projectPath: '/Users/olduser/project',
        files: [],
        activeFiles: [],
        notes: 'test',
      };

      const mapping = {
        type: 'userdir',
        sourceRoot: '/Users/olduser',
        targetRoot: '/Users/newuser',
      };

      const result = applyMappingToContext({ sessionContext, mapping });

      expect(result.projectPath).toBe('/Users/newuser/project');
      expect(result.originalProjectPath).toBe('/Users/olduser/project');
    });

    it('should apply mapping to files', () => {
      const sessionContext = {
        projectPath: '/Users/olduser/project',
        files: [{ path: '/Users/olduser/project/src/index.js', sha256: 'abc' }],
        activeFiles: ['/Users/olduser/project/src/index.js'],
        notes: 'test',
      };

      const mapping = {
        type: 'root',
        sourceRoot: '/Users/olduser',
        targetRoot: '/Users/newuser',
      };

      const result = applyMappingToContext({ sessionContext, mapping });

      expect(result.files[0].path).toBe('/Users/newuser/project/src/index.js');
      expect(result.files[0].originalPath).toBe('/Users/olduser/project/src/index.js');
      expect(result.activeFiles[0]).toBe('/Users/newuser/project/src/index.js');
    });

    it('should keep mapping in context', () => {
      const sessionContext = {
        projectPath: '/Users/olduser/project',
        files: [],
        activeFiles: [],
        notes: 'test',
      };

      const mapping = { type: 'none' };

      const result = applyMappingToContext({ sessionContext, mapping });

      expect(result.mapping).toBe(mapping);
    });
  });
});
