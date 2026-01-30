# Configure

Initial setup wizard for cloud session sync.

## Usage

```
/configure [options]
```

## Options

- `--qiniu`: Configure Qiniu cloud storage only
- `--encryption`: Configure encryption only
- `--status`: Show configuration status
- `--help`: Show this help message

## Description

This command runs an interactive setup wizard to configure cloud session sync. It guides you through:

1. **Qiniu Cloud Storage Setup** - Configure your cloud storage credentials
2. **Encryption Setup** - Set up encryption for your session data

**Features:**

- Interactive wizard with prompts and validations
- Automatic configuration file creation
- Secure storage of sensitive credentials (encrypted at rest)
- Configuration status display

**Qiniu Cloud Storage Requirements:**

- Qiniu Cloud account (free tier available: 10GB storage + 10GB traffic/month)
- AccessKey and SecretKey from your Qiniu console
- Bucket name
- Storage region (z0, z1, z2, na0, as0)

**Encryption Options:**

- **API Key Mode** (recommended): Auto-generated encryption key
  - Easy to use, no password to remember
  - Export with `/export-key` for backup
  - Import with `/import-key` on other devices

- **Password Mode** (advanced): User-provided password
  - Maximum security
  - You must remember the password
  - Cannot be recovered if lost

**Examples:**

```
/configure                    # Run full setup wizard
/configure --qiniu           # Configure cloud storage only
/configure --encryption        # Configure encryption only
/configure --status          # Show current status
```

**Notes:**

- This is a one-time setup unless you want to change settings
- Run `/configure-qiniu` to update cloud storage settings
- Run `/configure-encryption` to update encryption settings
- Sensitive data is encrypted at rest using AES-256
- Use `/export-key` to backup your encryption key
