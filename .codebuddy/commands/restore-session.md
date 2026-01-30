# Restore Session

Restore a session from cloud storage to the current workspace.

## Usage

```
/restore-session <session-id> [options]
```

## Arguments

- `<session-id>`: The ID of the session to restore (required)

## Options

- `--password <password>`: Provide password for decryption (if using password-based encryption)
- `--strategy <strategy>`: Merge strategy (replace, append, merge)
- `--help`: Show this help message

## Description

This command downloads and decrypts a session from cloud storage, allowing you to continue working on it from another device.

**Features:**

- Downloads and decrypts session data
- Verifies session integrity using hash
- Handles path mapping for cross-device compatibility
- Supports multiple merge strategies for conflicts

**Merge Strategies:**

- `replace`: Replace current session with restored one
- `append`: Append restored messages to current session
- `merge`: Smart merge with conflict resolution

**Examples:**

```
/restore-session 550e8400-e29b-41d4-a716-446655440000
/restore-session 550e8400-e29b-41d4-a716-446655440000 --strategy merge
/restore-session 550e8400-e29b-41d4-a716-446655440000 --password mypassword
```

**Notes:**

- Session ID can be obtained from `/list-sessions`
- If using password encryption, you'll be prompted for password
- Current session will be backed up before restore (if not empty)
- Path mapping is automatically applied for cross-device scenarios
