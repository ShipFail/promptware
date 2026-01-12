# Google Developer Expert Skill - Testing & Verification Guide

This document explains how to test and verify the Google Developer Expert skill.

## Prerequisites

- **Deno Runtime**: Version 1.40+ with `--unstable-kv` support
- **SSH Agent**: Running SSH agent for key derivation (used by `pwosCrypto`)
- **Google Cloud Project**: With OAuth credentials and enabled APIs

## Running Unit Tests

The skill includes comprehensive unit tests in `skill.test.ts`.

### Run All Tests

```bash
cd os/skills/google-developer-expert
deno test --allow-all skill.test.ts
```

### Test Coverage

The test suite validates:

1. **Tool Discovery (RFC 0012 Compliance)**
   - All tools respond to `--help` flag
   - All tools respond to `--description` flag
   - Descriptions are ≤ 1024 characters

2. **SKILL.md Structure**
   - Front matter exists and is valid
   - All tools are documented
   - Security architecture is explained
   - RFCs are referenced

3. **Basic Functionality**
   - Tools parse arguments correctly
   - Status checks work without authentication
   - Error messages are informative

### Integration Tests (Optional)

Integration tests require valid OAuth authentication. To enable:

```bash
# Set up OAuth credentials
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-client-secret"

# Authenticate
deno run -A --unstable-kv --location https://google-expert.local/ oauth-auth.ts start

# Enable integration tests
export ENABLE_INTEGRATION_TESTS=1

# Run tests
deno test --allow-all skill.test.ts
```

## Manual Verification

### Step 1: Verify Tool Help

Each tool should display help text:

```bash
deno run -A oauth-auth.ts --help
deno run -A oauth-token.ts --help
deno run -A gmail-api.ts --help
deno run -A gdocs-api.ts --help
deno run -A gdrive-api.ts --help
```

Expected: Clear usage instructions with actions and options.

### Step 2: Verify Tool Description

Each tool should provide a concise description (RFC 0012):

```bash
deno run -A oauth-auth.ts --description
```

Expected: One-line description ≤ 1024 characters.

### Step 3: Test OAuth Flow

**Prerequisites:**
1. Create OAuth credentials in Google Cloud Console
2. Set environment variables

```bash
export GOOGLE_CLIENT_ID="your-id.apps.googleusercontent.com"
export GOOGLE_CLIENT_SECRET="your-secret"
```

**Start OAuth flow:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-auth.ts start
```

**Expected behavior:**
1. URL is printed to console
2. Local server starts on port 8080
3. After granting permissions in browser, server receives callback
4. Tokens are sealed and stored in `/vault/google/*`
5. Success message is displayed
6. Server shuts down automatically

**Verify authentication:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-auth.ts status
```

Expected output:
```
✅ Authenticated
   Access token: pwenc:v1:...
   Refresh token: pwenc:v1:...
   Expires in: 3599s
   Scopes: ...
```

### Step 4: Test Token Management

**Get sealed token:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts get
```

Expected: `pwenc:v1:...` string (sealed token).

**Validate token:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts validate
```

Expected: `✅ Token valid` or `⚠️ Token expired`.

**Refresh token:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts refresh
```

Expected: `✅ Token refreshed successfully`.

### Step 5: Test Gmail API

**List messages:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gmail-api.ts list --max-results 5
```

Expected: JSON array of messages.

**List labels:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gmail-api.ts labels
```

Expected: JSON array of Gmail labels.

**Search messages:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gmail-api.ts search "is:unread"
```

Expected: JSON array of unread messages.

### Step 6: Test Google Docs API

**List documents:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gdocs-api.ts list --max-results 5
```

Expected: JSON array of documents from Drive.

**Create document:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gdocs-api.ts create --title "Test Document"
```

Expected: JSON with new document ID and metadata.

### Step 7: Test Google Drive API

**List files:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gdrive-api.ts list --max-results 10
```

Expected: JSON array of files.

**Search files:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gdrive-api.ts search "name contains 'test'"
```

Expected: JSON array of matching files.

**Create folder:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  gdrive-api.ts create-folder --name "Test Folder"
```

Expected: JSON with folder ID and metadata.

## Security Verification

### Verify Token Sealing

**Check vault contents:**

```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  os/kernel/syscalls/memory.ts list /vault/google
```

Expected output should show:
- Keys: `vault/google/access_token`, `vault/google/refresh_token`, `vault/google/token_metadata`
- Values: All tokens should start with `pwenc:v1:...`
- Metadata: Plaintext (not sensitive)

**Verify no plaintext leakage:**

Run any tool with verbose output and confirm:
1. No plaintext OAuth tokens are printed to console
2. All stored tokens begin with `pwenc:v1:`
3. Error messages don't expose secrets

## Common Test Failures

### "SSH_AUTH_SOCK not defined"

**Cause:** No SSH agent running.

**Solution:**
```bash
eval $(ssh-agent)
ssh-add ~/.ssh/id_rsa  # or your key
```

### "GOOGLE_CLIENT_SECRET environment variable not set"

**Cause:** OAuth credentials not provided.

**Solution:**
```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
```

### "Failed to seal secret"

**Cause:** Crypto syscall not working (SSH agent issue).

**Solution:**
1. Verify SSH agent is running
2. Check that you have SSH keys loaded
3. Test crypto directly:
   ```bash
   deno run -A --unstable-kv os/kernel/syscalls/crypto.ts --root <ROOT> seal "test"
   ```

### "Token expired"

**Cause:** Access token TTL exceeded (1 hour).

**Solution:**
```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts refresh
```

### "API error: 403 Forbidden"

**Cause:** Missing OAuth scope.

**Solution:** Re-authenticate with additional scopes:
```bash
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-auth.ts start --scopes "gmail.readonly gmail.send drive.readonly ..."
```

## Performance Testing

### Token Refresh Performance

Measure token refresh time:

```bash
time deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts refresh
```

Expected: < 2 seconds (network dependent).

### API Call Performance

Measure Gmail list performance:

```bash
time deno run -A --unstable-kv --location https://google-expert.local/ \
  gmail-api.ts list --max-results 10
```

Expected: 1-3 seconds (network dependent).

## Continuous Integration

For CI/CD pipelines:

```bash
# Run unit tests (no auth required)
deno test --allow-all os/skills/google-developer-expert/skill.test.ts

# Verify tool help text
for tool in oauth-auth oauth-token gmail-api gdocs-api gdrive-api; do
  deno run -A os/skills/google-developer-expert/${tool}.ts --help > /dev/null
done

# Check SKILL.md exists
test -f os/skills/google-developer-expert/SKILL.md
```

## Test Environment Cleanup

After testing, clean up:

```bash
# Revoke OAuth tokens
deno run -A --unstable-kv --location https://google-expert.local/ \
  oauth-token.ts revoke

# Clear KV database (optional, for fresh start)
rm -rf ~/.cache/deno/location_data/google-expert.local/
```

## Compliance Checklist

Before considering this skill production-ready, verify:

- [ ] All tools respond to `--help` (RFC 0012)
- [ ] All tools respond to `--description` (RFC 0012)
- [ ] Descriptions are ≤ 1024 characters (RFC 0012)
- [ ] Tokens are stored as `pwenc:v1:...` (RFC 0016)
- [ ] Tokens use `/vault/google/*` namespace (RFC 0018)
- [ ] No plaintext tokens in logs or output
- [ ] OAuth flow uses PKCE (RFC 7636)
- [ ] Refresh tokens work correctly
- [ ] All API wrappers handle token expiration
- [ ] Error messages are informative
- [ ] SKILL.md documents all operations
- [ ] Agent persona is defined in `google-expert.md`

## Reporting Issues

If tests fail, collect:

1. Deno version: `deno --version`
2. OS and architecture: `uname -a`
3. Error messages and stack traces
4. Steps to reproduce

File issues at: https://github.com/ShipFail/promptware/issues

---

**Last Updated**: 2024-12-24  
**Skill Version**: 1.0.0  
**Requires**: Deno 1.40+, SSH Agent
