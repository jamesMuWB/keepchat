const fs = require('fs');
const os = require('os');
const path = require('path');
describe('session collector', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keepchat-sessions-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads sessions from local json files', () => {
    const sessionPath = path.join(tempDir, 'session-1.json');
    fs.writeFileSync(
      sessionPath,
      JSON.stringify({
        id: 'session-1',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
        device: 'Mac',
        messages: [{ role: 'user', content: 'hi' }],
        context: { files: [] },
      }),
      'utf8',
    );

    const sessions = loadSessions({ dir: tempDir });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].meta.sessionId).toBe('session-1');
  });

  it('loads session by id', () => {
    const sessionPath = path.join(tempDir, 'session-2.json');
    fs.writeFileSync(
      sessionPath,
      JSON.stringify({
        id: 'session-2',
        messages: [],
        context: {},
      }),
      'utf8',
    );

    const session = loadSessionById('session-2', tempDir);
    expect(session).toBeTruthy();
    expect(session.meta.sessionId).toBe('session-2');
  });
});
