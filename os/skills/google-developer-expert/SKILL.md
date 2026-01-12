---
type: skill
title: "Google Developer Expert"
version: "1.0.0"
tags: [google, oauth, gmail, drive, docs, api]
tools:
  - ./oauth-auth.ts
  - ./oauth-token.ts
  - ./gmail-api.ts
  - ./gdocs-api.ts
  - ./gdrive-api.ts
---

# Google Developer Expert Skill

This skill provides comprehensive access to Google APIs (Gmail, Google Docs, Google Drive) with secure OAuth 2.0 authentication.

**Security Architecture**: This skill implements **Zero-Trust Token Management**. OAuth tokens are plaintext secrets that MUST NEVER reach pRing 0 (prompt context). All tokens are:
- Immediately encrypted using `pwosCrypto("seal", token)` upon receipt
- Stored in `/vault/google/*` as `pwenc:v1:...` ciphertext (per RFC 0016, RFC 0018)
- Only decrypted in TypeScript code at the moment of API use
- Never exposed to the LLM context

## Conceptual Model

Think of this skill as a **secure API gateway**:
1. **OAuth Layer**: Handles authentication flow and token lifecycle
2. **API Wrappers**: Provide clean interfaces to Gmail, Docs, and Drive
3. **Vault Storage**: Ensures tokens remain encrypted at rest
4. **JIT Decryption**: Tokens are unsealed only when needed for API calls

## Tool Architecture

### Authentication Tools

#### `oauth-auth.ts` - OAuth 2.0 Authenticator
Orchestrates the OAuth authorization code flow with PKCE.

**Actions:**
- `start`: Begin OAuth flow (opens browser, starts local callback server)
- `status`: Check current authentication status

**Usage:**
```typescript
// First-time authentication
await pwosSyscall("exec", "oauth-auth.ts start --client-id <CLIENT_ID> --scopes <SCOPES>");

// Check status
await pwosSyscall("exec", "oauth-auth.ts status");
```

**Environment Variables Required:**
- `GOOGLE_CLIENT_ID`: OAuth 2.0 client ID from Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: OAuth 2.0 client secret

**OAuth Flow:**
1. User runs `start` action
2. Tool generates PKCE challenge
3. Opens browser to Google authorization page
4. User grants permissions
5. Google redirects to local callback server (http://localhost:8080)
6. Tool exchanges code for tokens
7. Tokens are immediately sealed and stored in `/vault/google/*`
8. Success message displayed

**Default Scopes:**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/drive.file`
- `https://www.googleapis.com/auth/documents.readonly`
- `https://www.googleapis.com/auth/documents`

#### `oauth-token.ts` - Token Lifecycle Manager
Manages token refresh, validation, and retrieval.

**Actions:**
- `get`: Retrieve sealed access token (returns `pwenc:v1:...`)
- `refresh`: Refresh expired access token using refresh token
- `validate`: Check if token is valid and not expired
- `revoke`: Revoke and delete all stored tokens

**Usage:**
```typescript
// Get sealed token (for internal use by API wrappers)
const sealedToken = await pwosSyscall("exec", "oauth-token.ts get");

// Refresh token if expired
await pwosSyscall("exec", "oauth-token.ts refresh");

// Validate token
await pwosSyscall("exec", "oauth-token.ts validate");

// Revoke and clean up
await pwosSyscall("exec", "oauth-token.ts revoke");
```

**Token Storage Locations:**
- `/vault/google/access_token`: Sealed access token
- `/vault/google/refresh_token`: Sealed refresh token (if available)
- `/vault/google/token_metadata`: Expiration time and scope metadata (plaintext)

### API Wrapper Tools

All API wrappers automatically handle token retrieval and unsealing. You never need to manually manage tokens when using these tools.

#### `gmail-api.ts` - Gmail Operations

**Actions:**
- `list`: List messages in inbox
- `get <id>`: Get full message by ID
- `send`: Send an email
- `search <query>`: Search messages with Gmail query syntax
- `labels`: List all labels
- `threads`: List conversation threads

**Usage Examples:**
```typescript
// List recent messages
await pwosSyscall("exec", "gmail-api.ts list --max-results 20");

// Get specific message
await pwosSyscall("exec", "gmail-api.ts get <MESSAGE_ID>");

// Send email
await pwosSyscall("exec", 
  "gmail-api.ts send --to user@example.com --subject 'Hello' --body 'Message body'");

// Search messages
await pwosSyscall("exec", "gmail-api.ts search 'from:alice@example.com'");

// List labels
await pwosSyscall("exec", "gmail-api.ts labels");

// List threads
await pwosSyscall("exec", "gmail-api.ts threads --max-results 10");
```

**Options:**
- `--max-results <n>`: Maximum results to return (default: 10)
- `--to <email>`: Recipient email (for send)
- `--subject <text>`: Message subject (for send)
- `--body <text>`: Message body (for send)
- `--label <name>`: Filter by label (for list)

#### `gdocs-api.ts` - Google Docs Operations

**Actions:**
- `get <id>`: Get document content and metadata
- `create`: Create a new document
- `update <id>`: Append content to document
- `list`: List accessible documents (via Drive API)

**Usage Examples:**
```typescript
// Get document
await pwosSyscall("exec", "gdocs-api.ts get <DOC_ID>");

// Create new document
await pwosSyscall("exec", "gdocs-api.ts create --title 'My New Doc'");

// Update document (append text)
await pwosSyscall("exec", 
  "gdocs-api.ts update <DOC_ID> --content 'This text will be appended'");

// List documents
await pwosSyscall("exec", "gdocs-api.ts list --max-results 20");
```

**Options:**
- `--title <text>`: Document title (for create)
- `--content <text>`: Content to append (for update)
- `--max-results <n>`: Maximum results (default: 10)

#### `gdrive-api.ts` - Google Drive Operations

**Actions:**
- `list`: List files in Drive
- `get <id>`: Get file metadata
- `download <id>`: Download file content
- `upload`: Upload a file
- `delete <id>`: Delete a file
- `create-folder`: Create a new folder
- `search <query>`: Search files with Drive query syntax

**Usage Examples:**
```typescript
// List files
await pwosSyscall("exec", "gdrive-api.ts list --max-results 20");

// Get file metadata
await pwosSyscall("exec", "gdrive-api.ts get <FILE_ID>");

// Download file
await pwosSyscall("exec", "gdrive-api.ts download <FILE_ID>");

// Upload file
await pwosSyscall("exec", 
  "gdrive-api.ts upload --file ./local.txt --name 'remote.txt' --mime-type 'text/plain'");

// Delete file
await pwosSyscall("exec", "gdrive-api.ts delete <FILE_ID>");

// Create folder
await pwosSyscall("exec", "gdrive-api.ts create-folder --name 'My Folder'");

// Search files
await pwosSyscall("exec", 
  "gdrive-api.ts search \"name contains 'report' and mimeType='application/pdf'\"");
```

**Options:**
- `--file <path>`: Local file path (for upload)
- `--name <name>`: File/folder name
- `--mime-type <type>`: MIME type (for upload)
- `--parent <id>`: Parent folder ID
- `--max-results <n>`: Maximum results (default: 10)

## Workflow: First-Time Setup

When using this skill for the first time, follow this procedure:

### Step 1: Obtain OAuth Credentials

The user must create OAuth credentials in Google Cloud Console:

1. Go to https://console.cloud.google.com
2. Create a project (or select existing)
3. Enable APIs: Gmail API, Google Drive API, Google Docs API
4. Create OAuth 2.0 credentials (Desktop app type)
5. Download client ID and secret

### Step 2: Provide Credentials to Agent

The agent needs these credentials as environment variables:
```bash
export GOOGLE_CLIENT_ID="<client_id>.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="<client_secret>"
```

**IMPORTANT**: These should be provided by the user in their environment, NOT hardcoded in prompts or code.

### Step 3: Run OAuth Flow

```typescript
// Start authentication
await pwosSyscall("exec", "oauth-auth.ts start");
```

This will:
1. Print an authorization URL
2. Wait for user to visit URL and grant permissions
3. Capture the callback
4. Exchange code for tokens
5. Seal and store tokens in vault
6. Print success message

### Step 4: Verify Authentication

```typescript
// Check status
await pwosSyscall("exec", "oauth-auth.ts status");
```

Should output:
```
✅ Authenticated
   Access token: pwenc:v1:...
   Refresh token: pwenc:v1:...
   Expires in: 3599s
   Scopes: ...
```

### Step 5: Use APIs

Now all API wrappers will work automatically:
```typescript
// List Gmail messages
await pwosSyscall("exec", "gmail-api.ts list");

// List Drive files
await pwosSyscall("exec", "gdrive-api.ts list");

// List Docs
await pwosSyscall("exec", "gdocs-api.ts list");
```

## Workflow: Token Refresh

Tokens expire after 1 hour. The API wrappers automatically detect expiration and attempt refresh. You can also manually refresh:

```typescript
// Check if token is valid
await pwosSyscall("exec", "oauth-token.ts validate");

// Manually refresh
await pwosSyscall("exec", "oauth-token.ts refresh");
```

**Note**: Refresh tokens are long-lived and stored securely. As long as the refresh token is valid, you don't need to re-authenticate.

## Workflow: Revoke Access

To revoke access and clean up:

```typescript
// Revoke tokens with Google and delete local storage
await pwosSyscall("exec", "oauth-token.ts revoke");
```

This will:
1. Call Google's revoke endpoint (if token is valid)
2. Delete all tokens from `/vault/google/*`
3. User will need to re-authenticate to use APIs again

## Security Considerations

### Token Protection (RFC 0016, RFC 0018)

1. **No Plaintext in pRing 0**: OAuth tokens are NEVER exposed to the LLM context
2. **Sealed at Rest**: All tokens stored as `pwenc:v1:...` in `/vault/google/*`
3. **JIT Decryption**: Tokens only decrypted in TypeScript at moment of use
4. **Automatic Cleanup**: Tools clean up temporary data (PKCE verifiers)

### OAuth Security (RFC 6749, RFC 7636)

1. **Authorization Code Flow**: Industry-standard OAuth 2.0 flow
2. **PKCE**: Proof Key for Code Exchange protects against interception
3. **Refresh Tokens**: Long-lived, securely stored for token renewal
4. **Scope Limiting**: Only requests necessary scopes

### Environment Variables

- `GOOGLE_CLIENT_ID`: Not secret, but should be project-specific
- `GOOGLE_CLIENT_SECRET`: IS SECRET, must be protected
- `PWOS_ROOT`: OS root URL (optional, defaults to main branch)
- `PWOS_ORIGIN`: KV origin for storage isolation (optional)

### Best Practices

1. **Never log plaintext tokens**: All console output uses sealed tokens
2. **Check token validity**: Use `oauth-token.ts validate` before operations
3. **Revoke when done**: Clean up tokens when no longer needed
4. **Rotate credentials**: Periodically rotate OAuth client secrets
5. **Limit scopes**: Only enable scopes you actually need

## Error Handling

### Common Errors

**"No access token found"**
- Solution: Run `oauth-auth.ts start` to authenticate

**"Token expired"**
- Solution: Run `oauth-token.ts refresh` or let API wrappers auto-refresh

**"Failed to unseal secret"**
- Solution: Token may be corrupted or SSH agent not available
- Re-authenticate: `oauth-token.ts revoke` then `oauth-auth.ts start`

**"GOOGLE_CLIENT_SECRET not set"**
- Solution: Set environment variable before running tools

**"API error: 401 Unauthorized"**
- Solution: Token invalid or revoked, re-authenticate

**"API error: 403 Forbidden"**
- Solution: Missing OAuth scope, re-authenticate with broader scopes

## API Reference

### Gmail Query Syntax

Search messages using Gmail's query syntax:
- `from:user@example.com`: Messages from specific sender
- `to:user@example.com`: Messages to specific recipient
- `subject:keyword`: Messages with keyword in subject
- `has:attachment`: Messages with attachments
- `is:unread`: Unread messages
- `is:starred`: Starred messages
- `after:2024/01/01`: Messages after date
- `before:2024/12/31`: Messages before date

### Drive Query Syntax

Search files using Drive's query syntax:
- `name contains 'keyword'`: Files containing keyword in name
- `mimeType='application/pdf'`: PDF files
- `'<FOLDER_ID>' in parents`: Files in specific folder
- `trashed=false`: Not in trash
- `starred=true`: Starred files
- `modifiedTime > '2024-01-01T00:00:00'`: Modified after date

### Common MIME Types

- Text: `text/plain`, `text/html`
- Documents: `application/pdf`, `application/vnd.google-apps.document`
- Spreadsheets: `application/vnd.google-apps.spreadsheet`
- Images: `image/png`, `image/jpeg`
- Folders: `application/vnd.google-apps.folder`

## Integration with PromptWare OS

This skill follows PromptWare OS architecture principles:

1. **Microkernel Design**: Each tool is atomic and single-purpose
2. **Zero-Footprint**: Tools execute from URLs, never downloaded
3. **Vault Integration**: Uses `/vault/*` namespace per RFC 0018
4. **Crypto Primitives**: Uses `pwosCrypto` per RFC 0016
5. **System Calls**: Invoked via `pwosSyscall("exec", ...)`

## Dependencies

- **Deno Runtime**: TypeScript execution environment
- **JSR Imports**: `jsr:@std/cli/parse-args` for CLI parsing
- **OS Syscalls**: `crypto.ts` for encryption, `memory.ts` for storage
- **Network Access**: Calls to Google APIs

## Testing

To verify the skill is working:

1. Test authentication:
   ```typescript
   await pwosSyscall("exec", "oauth-auth.ts start");
   await pwosSyscall("exec", "oauth-auth.ts status");
   ```

2. Test token management:
   ```typescript
   await pwosSyscall("exec", "oauth-token.ts validate");
   await pwosSyscall("exec", "oauth-token.ts get"); // Should return pwenc:v1:...
   ```

3. Test APIs:
   ```typescript
   await pwosSyscall("exec", "gmail-api.ts labels");
   await pwosSyscall("exec", "gdocs-api.ts list");
   await pwosSyscall("exec", "gdrive-api.ts list");
   ```

## Limitations

1. **Single Account**: Currently supports one Google account at a time
2. **Local Callback**: OAuth requires local HTTP server on port 8080
3. **SSH Agent Required**: Crypto operations require SSH agent for key derivation
4. **Scope Changes**: Changing scopes requires re-authentication

## Future Enhancements

Potential improvements for future versions:
- Multi-account support
- Configurable callback port
- Additional Google APIs (Calendar, Sheets, etc.)
- Batch operations
- Webhook support for real-time updates
- Rate limiting and retry logic

---

**Version**: 1.0.0  
**Author**: PromptWare OS Development Team  
**License**: PPL-A (Public Prompt License - Apache Variant)
