const fs = require('fs');
const os = require('os');
const path = require('path');
describe('qiniu config', () => {
  let originalCwd;
  let tempDir;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepchat-'));
    fs.mkdirSync(path.join(tempDir, '.codebuddy'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads config from file when present', () => {
    const configPath = path.join(tempDir, '.codebuddy', 'qiniu-config.json');
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        accessKey: 'ak',
        secretKey: 'sk',
        bucket: 'bucket',
        region: 'z0',
        prefix: 'sessions/',
      }),
      'utf8',
    );

    const config = loadConfig();
    expect(config.accessKey).toBe('ak');
    expect(config.secretKey).toBe('sk');
    expect(config.bucket).toBe('bucket');
    expect(config.region).toBe('z0');
    expect(config.prefix).toBe('sessions/');
  });

  it('returns missing required fields when config is empty', () => {
    const config = loadConfig();
    expect(getMissingConfig(config)).toEqual(['accessKey', 'secretKey', 'bucket', 'region']);
  });
});
