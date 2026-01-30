# Delete Session

Delete a session from cloud storage.

## Usage

```
/delete-session <session-id> [options]
```

## Arguments

- `<session-id>`: The UUID of the session to delete

## Options

- `--force`: Skip confirmation prompt
- `--help`: Show this help message

## Description

This command permanently deletes a session from cloud storage, freeing up storage space.

**Features:**

- Creates local backup before deletion
- Confirms deletion with user (unless --force)
- Deletes both cloud and cached copies
- Shows deletion confirmation

**Examples:**

```
/delete-session 550e8400-e29b-41d4-a716-446655440000
/delete-session 550e8400-e29b-41d4-a716-446655440000 --force
```

**Important:**

- Session ID can be obtained from /list-sessions
- Deletion is irreversible (unless local backup exists)
- Local backup is saved to ~/.codebuddy/backups/deleted/
- Cached copy is also deleted
- This operation cannot be undone

**Confirmation Prompt:**

```
Are you sure you want to delete session 550e8400-e29b...? (yes/no):
```
