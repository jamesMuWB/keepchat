# Sync Session

Synchronize the current session to the cloud.

## Usage

```
/sync-session [options]
```

## Options

- `--force`: Force upload to cloud, even if local version is older
- `--auto`: Enable automatic sync mode (syncs every 5 minutes or every 10 new messages)
- `--help`: Show this help message

## Description

This command uploads the current conversation session to the cloud, allowing you to continue working on it from another device.

**Features:**

- Encrypts session data before upload using AES-256-GCM
- Compresses data using GZIP for faster uploads
- Supports incremental sync (only uploads changed data)
- Displays real-time progress during upload

**Examples:**

```
/sync-session
/sync-session --force
/sync-session --auto
```

**Notes:**

- Requires Qiniu cloud storage to be configured
- Uses the encryption key configured in ENCRYPTION_API_KEY
- Automatically creates a new session ID if this is the first sync
- Detects and handles conflicts if cloud has newer version
