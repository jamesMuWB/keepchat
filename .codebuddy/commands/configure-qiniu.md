# Configure Qiniu

Configure Qiniu cloud storage settings.

## Usage

```
/configure-qiniu [options]
```

## Options

- `--access-key <key>`: Set AccessKey directly
- `--secret-key <key>`: Set SecretKey directly
- `--bucket <name>`: Set bucket name
- `--region <region>`: Set storage region
- `--test`: Test connection without saving
- `--help`: Show this help message

## Description

This command configures Qiniu cloud storage settings for session synchronization.

**Options:**

1. **Interactive Mode** (default): Run through setup wizard
2. **Direct Mode**: Set specific values via command-line options

**Storage Regions:**

- `z0` - East China (Nanjing)
- `z1` - North China (Beijing)
- `z2` - South China (Guangzhou)
- `na0` - North America
- `as0` - Southeast Asia

**Bucket Naming:**

- 3-63 characters
- Lowercase letters, numbers, and hyphens only
- Must start with letter or number
- Cannot end with hyphen

**Examples:**

```
/configure-qiniu                         # Interactive mode
/configure-qiniu --test                 # Test connection only
/configure-qiniu --bucket my-bucket --region z1
/configure-qiniu --access-key "xxx..." --secret-key "yyy..."
```

**Notes:**

- AccessKey and SecretKey are encrypted before saving
- Use --test to verify credentials before saving
- Bucket will be created if it doesn't exist
- Region affects latency and pricing
- Get credentials from: https://portal.qiniu.com/user/key
