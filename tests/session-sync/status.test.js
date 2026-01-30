import fs from 'fs';
import os from 'os';
import path from 'path';
describe('sync status', () => {
  let tempFile;
  const originalEnv = process.env.KEEPCHAT_SYNC_STATUS;

  beforeEach(() => {
    tempFile = path.join(os.tmpdir(), `keepchat-status-${Date.now()}.json`);
    process.env.KEEPCHAT_SYNC_STATUS = tempFile;
  });

  afterEach(() => {
    process.env.KEEPCHAT_SYNC_STATUS = originalEnv;
    if (fs.existsSync(tempFile)) {
      fs.rmSync(tempFile, { force: true });
    }
  });

  it('updates session status', () => {
    updateSessionStatus('s1', { lastSyncedAt: 'now', messageCount: 2 });
    const status = loadSyncStatus();
    expect(status.sessions.s1.messageCount).toBe(2);
  });
});
