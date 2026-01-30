import fs from 'fs';
import os from 'os';
import path from 'path';
describe('sync logger', () => {
  let tempFile;
  const originalEnv = process.env.KEEPCHAT_SYNC_LOG;

  beforeEach(() => {
    tempFile = path.join(os.tmpdir(), `keepchat-log-${Date.now()}.log`);
    process.env.KEEPCHAT_SYNC_LOG = tempFile;
  });

  afterEach(() => {
    process.env.KEEPCHAT_SYNC_LOG = originalEnv;
    if (fs.existsSync(tempFile)) {
      fs.rmSync(tempFile, { force: true });
    }
  });

  it('writes log entries', () => {
    logSyncError({ sessionId: 's1', phase: 'upload', error: new Error('fail') });
    const content = fs.readFileSync(tempFile, 'utf8');
    expect(content).toContain('"sessionId":"s1"');
  });
});
