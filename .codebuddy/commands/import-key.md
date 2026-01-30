# Import Key

Import an encryption API key from Base64 format.

## Usage

```
/import-key <base64-key> [options]
```

## Arguments

- `<base64-key>`: The Base64-encoded API key to import

## Options

- `--format <format>`: Input format (json, env, raw) - default: auto-detect
- `--verify`: Verify the key after import
- `--help`: Show this help message

## Description

This command imports an encryption API key from another device, allowing you to decrypt sessions synced to that device.

**Input Formats:**

- `json`: JSON format from /export-key
- `env`: Environment variable format
- `raw`: Raw Base64 string

**Verification:**

- If `--verify` is set, a test decryption will be performed
- This ensures the key is valid and matches your sessions

**Examples:**

```
/import-key "abc123def456..."
/import-key '{"apiKey":"abc123...","createdAt":"..."}' --format json
/import-key "ENCRYPTION_API_KEY=abc123..." --format env --verify
```

**JSON Input Format:**

```json
{
  "apiKey": "base64-encoded-key-here...",
  "createdAt": "2024-01-01T00:00:00Z",
  "deviceId": "darwin-a1b2c3..."
}
```

**Security Notes:**

- Only import keys from trusted sources
- Verify the source of the key before importing
- The key can decrypt all your sessions
- Consider rotating the key after importing from untrusted source

**Notes:**

- This will overwrite your current ENCRYPTION_API_KEY
- Back up your existing key before importing (if needed)
- After importing, you'll be able to decrypt sessions from the source device
- All future sessions will use this key for encryption
