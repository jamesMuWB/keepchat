# Configure Encryption

Configure encryption settings for session data protection.

## Usage

```
/configure-encryption [options]
```

## Options

- `--mode <mode>`: Encryption mode: `apikey` or `password`
- `--generate-key`: Generate new API key
- `--import-key <key>`: Import existing API key (Base64)
- `--export-key`: Export current API key
- `--help`: Show this help message

## Description

This command configures encryption settings for protecting your session data in cloud storage.

**Encryption Modes:**

### API Key Mode (Recommended)

- Auto-generated 256-bit encryption key
- Easy to use across devices
- Export/import with `/export-key` and `/import-key`
- No password to remember
- Best balance of security and convenience

### Password Mode (Advanced)

- User-provided password
- Maximum security
- You must remember the password
- Cannot be recovered if lost
- More friction for cross-device use

**Security Details:**

- Algorithm: AES-256-GCM
- Key Derivation: PBKDF2 (password mode) or direct (apikey mode)
- Storage: Encrypted at rest
- Integrity: Authenticated encryption (AEAD)

**Examples:**

```
/configure-encryption --mode apikey --generate-key
/configure-encryption --mode password
/configure-encryption --import-key "abc123def456..."
/configure-encryption --export-key
```

**Password Requirements:**

- Minimum 8 characters
- Must contain letters and numbers
- Special characters allowed but not required

**API Key Format:**

- Base64-encoded 256-bit key (32 bytes = 44 base64 characters)
- Example: `aGVzYXVkaW5hZ2ZlZ2ZtYWJjZGVm`

**Important Notes:**

- Changing encryption key will require re-encrypting all sessions
- Lost passwords/keys cannot be recovered
- Always backup your key using `/export-key`
- Password mode requires entering password on restore

**Migration:**
If you change encryption mode:

- Old sessions remain encrypted with old key
- New sessions use new encryption
- You'll need both keys to access old sessions
- Consider rotating all sessions with `/rotate-key`
