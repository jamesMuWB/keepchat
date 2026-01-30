# List Sessions

List all sessions stored in cloud storage.

## Usage

```
/list-sessions [options]
```

## Options

- `--limit <N>`: Limit number of sessions displayed (default: 20)
- `--search <keyword>`: Filter sessions by keyword
- `--help`: Show this help message

## Description

This command lists all sessions available in cloud storage, allowing you to browse and select sessions to restore.

**Features:**

- Lists sessions with preview information
- Shows message count and last update time
- Supports filtering by keyword
- Displays session ID for restore command
- Shows storage usage statistics

**Output Format:**

```
Session ID                    Messages   Device     Last Updated    Preview
--------------------------------------------------------------------------------------
550e8400-e29b...           42         desktop     2 hours ago      Building REST API...
33d4e6a-b1a5...           18         laptop      1 day ago        Docker setup help...
```

**Examples:**

```
/list-sessions
/list-sessions --limit 10
/list-sessions --search "Docker"
/list-sessions --limit 5 --search "API"
```

**Notes:**

- Requires Qiniu cloud storage to be configured
- Sessions are sorted by last update time (newest first)
- Use session ID with /restore-session command
- Preview shows first message content (truncated)
