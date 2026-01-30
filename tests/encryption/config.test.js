const fs = require('fs');
const os = require('os');
const path = require('path');
describe('encryption config', () => {
  let originalCwd;
  let tempDir;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepchat-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and loads api key', () => {
    saveEncryptionConfig({ apiKey: 'api-key' });
    const config = loadEncryptionConfig();
    expect(config.apiKey).toBe('api-key');
  });

  it('returns missing api key', () => {
    const config = loadEncryptionConfig();
    expect(getMissingEncryptionConfig(config)).toEqual(['apiKey']);
  });
});
