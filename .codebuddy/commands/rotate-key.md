# Rotate Key

Generate a new encryption API key and re-encrypt all cloud sessions.

## Usage

```
/rotate-key [options]
```

## Options

- `--backup <path>`: Backup old key to file before rotating
- `--dry-run`: Show what would happen without making changes
- `--help`: Show this help message

## Description

This command generates a new encryption API key and re-encrypts all sessions in cloud storage with the new key.

**Process:**

1. Generate new random API key
2. Download all sessions from cloud
3. Decrypt with old key
4. Encrypt with new key
5. Upload re-encrypted sessions
6. Update local configuration

**Benefits:**

- Regular key rotation improves security
- Compromised keys limit exposure time
- Refreshes encryption with new algorithms if needed

**What Happens:**

- New key is generated (256-bit random)
- All cloud sessions are re-encrypted
- Local ENCRYPTION_API_KEY is updated
- Old key is backed up (if --backup specified)

**Examples:**

```
/rotate-key
/rotate-key --backup ~/.codebuddy/keys/backup-$(date +%s).txt
/rotate-key --dry-run
```

**Dry Run Mode:**
Shows what would happen without making actual changes:

- Number of sessions to re-encrypt
- Estimated time required
- Backup location (if specified)

**Important:**

- This process will take time for large session collections
- Internet connection is required
- Cloud storage quota will be temporarily doubled during re-encryption
- Do not interrupt the process once started

**Backup:**

- Old key is automatically saved to ~/.codebuddy/keys/backup-<timestamp>.txt
- Backup includes: old key, timestamp, session count
- You can restore old key from backup if needed

**Notes:**

- Requires Qiniu cloud storage to be configured
- Local cache is also cleared and re-encrypted
- Interrupting the process may leave sessions in inconsistent state
- Consider scheduling during low-usage periods
