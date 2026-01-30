# Export Key

Export the encryption API key as Base64 for backup or sharing.

## Usage

```
/export-key [options]
```

## Options

- `--format <format>`: Output format (json, env, file) - default: json
- `--output <path>`: Save to file instead of printing
- `--help`: Show this help message

## Description

This command exports your encryption API key in Base64 format, allowing you to:

- Backup your key to a secure location
- Transfer the key to another device
- Share the key (with caution)

**Output Formats:**

- `json`: JSON format with metadata
- `env`: Environment variable format
- `file`: Saved to a file

**Security Warning:**

- The API key allows decryption of all your sessions
- Never share it publicly or commit it to version control
- Store it in a password manager
- Delete the exported key after transfer

**Examples:**

```
/export-key
/export-key --format env
/export-key --output ~/.config/encryption-key.txt
```

**Output (JSON format):**

```json
{
  "apiKey": "base64-encoded-key-here...",
  "createdAt": "2024-01-01T00:00:00Z",
  "deviceId": "darwin-a1b2c3...",
  "version": "1"
}
```

**Notes:**

- Requires ENCRYPTION_API_KEY to be configured
- If using password-based encryption, this will show an error
- Exported key is Base64-encoded for easy copying
