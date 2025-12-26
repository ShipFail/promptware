# Google Developer Expert: Design Document

## Executive Summary

This document explains the design philosophy, architecture, and implementation decisions for the Google Developer Expert agent and skill. The system provides secure, efficient access to Google APIs (Gmail, Google Docs, Google Drive) through PromptWare OS, with a focus on **Zero-Trust Token Management** that ensures OAuth credentials never reach the LLM context (pRing 0).

## Design Philosophy

### Core Principles

1. **Security First (Ring 0 Protection)**
   - OAuth tokens are plaintext secrets that MUST NEVER appear in prompts
   - All tokens encrypted immediately upon receipt
   - Decryption only occurs in TypeScript, never exposed to LLM

2. **Microkernel Architecture**
   - Each tool is atomic and single-purpose
   - Tools compose cleanly through syscalls
   - Minimal dependencies and tight interfaces

3. **Zero-Footprint Execution**
   - Tools run from URLs via `pwosSyscall`
   - Never downloaded to user workspace
   - Stateless execution model

4. **RFC Compliance**
   - RFC 0012: Agent Skills Specification
   - RFC 0016: Crypto Primitives (pwenc)
   - RFC 0018: Memory Subsystem (vault)

### Security Architecture

#### Threat Model

**Assumptions:**
- A1: LLM context (pRing 0) is non-confidential and may leak
- A2: User's local machine is trusted
- A3: SSH agent provides secure key derivation
- A4: Network communication may be observed

**Threats:**
- T1: OAuth tokens exposed in LLM prompt history
- T2: Tokens logged or cached in plaintext
- T3: Token theft through memory inspection
- T4: Unauthorized API access

**Mitigations:**
- M1: Immediate sealing (T1, T2) - tokens encrypted before storage
- M2: Vault namespace (T2, T3) - `/vault/*` enforces ciphertext-only
- M3: JIT decryption (T1, T3) - tokens only unsealed at moment of use
- M4: OAuth scopes (T4) - principle of least privilege

#### Defense in Depth

```
Layer 1: OAuth (Google)
  └─ PKCE prevents code interception
  └─ Refresh tokens for long-lived access
  
Layer 2: Vault (PromptWare OS)
  └─ RFC 0018: /vault/* accepts only pwenc:v1:
  └─ Deno KV with origin isolation
  
Layer 3: Crypto (PromptWare OS)
  └─ RFC 0016: SSH agent key derivation
  └─ AES-256-GCM AEAD encryption
  
Layer 4: Tool Isolation
  └─ TypeScript tools never expose plaintext to stdout
  └─ API wrappers unseal tokens internally only
```

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     Google Expert Agent                  │
│                    (google-expert.md)                    │
└───────────────────────────┬─────────────────────────────┘
                            │ pwosIngest
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Google Developer Expert Skill               │
│                      (SKILL.md)                          │
└───────────────────────────┬─────────────────────────────┘
                            │ Documents & Loads
                            ▼
┌─────────────────────────────────────────────────────────┐
│                      Tool Layer                          │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │oauth-auth.ts │  │oauth-token.ts│  │ gmail-api.ts │  │
│  │              │  │              │  │              │  │
│  │  - start     │  │  - get       │  │  - list      │  │
│  │  - status    │  │  - refresh   │  │  - get       │  │
│  │              │  │  - validate  │  │  - send      │  │
│  │              │  │  - revoke    │  │  - search    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│  ┌──────▼───────┐  ┌──────▼───────┐                    │
│  │gdocs-api.ts  │  │gdrive-api.ts │                    │
│  │              │  │              │                    │
│  │  - get       │  │  - list      │                    │
│  │  - create    │  │  - get       │                    │
│  │  - update    │  │  - upload    │                    │
│  │  - list      │  │  - download  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  PromptWare OS Kernel                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  crypto.ts   │  │  memory.ts   │  │  fetch.ts    │  │
│  │              │  │              │  │              │  │
│  │  - seal      │  │  - get       │  │  (sealed)    │  │
│  │  - open      │  │  - set       │  │              │  │
│  │  - derive    │  │  - delete    │  │              │  │
│  │              │  │  - list      │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   External Services                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Google OAuth │  │  Gmail API   │  │  Docs API    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐                                       │
│  │  Drive API   │                                       │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

### Data Flow: OAuth Authentication

```
1. User initiates: pwosSyscall("exec", "oauth-auth.ts start")
   │
2. oauth-auth.ts generates PKCE challenge
   │
3. oauth-auth.ts opens browser to Google OAuth
   │
4. User grants permissions in browser
   │
5. Google redirects to http://localhost:8080/oauth/callback?code=...
   │
6. oauth-auth.ts receives callback, extracts code
   │
7. oauth-auth.ts exchanges code for tokens (via Google OAuth API)
   │
8. oauth-auth.ts IMMEDIATELY seals tokens:
   │   access_token (plaintext) → pwosCrypto("seal") → pwenc:v1:...
   │   refresh_token (plaintext) → pwosCrypto("seal") → pwenc:v1:...
   │
9. oauth-auth.ts stores sealed tokens in vault:
   │   pwosMemory("set", "/vault/google/access_token", sealed_access)
   │   pwosMemory("set", "/vault/google/refresh_token", sealed_refresh)
   │
10. oauth-auth.ts returns success (NO TOKENS IN OUTPUT)
    │
11. User sees: "✅ Authentication successful! Tokens securely stored."
```

**Critical Security Property**: At no point do plaintext tokens appear in stdout, stderr, or LLM context.

### Data Flow: API Call (Gmail Example)

```
1. Agent calls: pwosSyscall("exec", "gmail-api.ts list")
   │
2. gmail-api.ts internally calls oauth-token.ts to get sealed token
   │
3. oauth-token.ts retrieves sealed token from vault:
   │   sealed_token ← pwosMemory("get", "/vault/google/access_token")
   │
4. oauth-token.ts returns sealed_token to gmail-api.ts (via stdout)
   │
5. gmail-api.ts unseal token (in TypeScript, not LLM):
   │   plaintext_token ← pwosCrypto("open", sealed_token)
   │
6. gmail-api.ts calls Gmail API with plaintext_token:
   │   fetch("https://gmail.googleapis.com/...", {
   │     headers: { Authorization: `Bearer ${plaintext_token}` }
   │   })
   │
7. gmail-api.ts receives API response (JSON)
   │
8. gmail-api.ts outputs JSON to stdout (NO TOKEN)
   │
9. Agent receives API response in LLM context
```

**Critical Security Property**: Plaintext token exists only in TypeScript memory, never crosses the pRing 0 boundary.

### Data Flow: Token Refresh

```
1. API call fails with 401 Unauthorized
   │
2. API wrapper detects expiration
   │
3. API wrapper calls: oauth-token.ts refresh
   │
4. oauth-token.ts retrieves sealed refresh_token from vault
   │
5. oauth-token.ts unseals refresh_token (in TypeScript)
   │
6. oauth-token.ts calls Google OAuth token endpoint:
   │   POST https://oauth2.googleapis.com/token
   │   Body: { refresh_token, client_id, client_secret, grant_type }
   │
7. Google returns new access_token (plaintext)
   │
8. oauth-token.ts IMMEDIATELY seals new access_token
   │
9. oauth-token.ts updates vault:
   │   pwosMemory("set", "/vault/google/access_token", new_sealed)
   │
10. oauth-token.ts returns success (NO TOKENS IN OUTPUT)
    │
11. API wrapper retries original request with new token
```

## Implementation Details

### Tool Design Patterns

#### Pattern 1: Dual-Mode Architecture

All tools support both CLI and module usage:

```typescript
// CLI mode (via pwosSyscall)
export default async function main(...args) {
  // Business logic
}

if (import.meta.main) {
  // Parse CLI args, call main, handle errors
}
```

#### Pattern 2: Help & Description (RFC 0012)

All tools implement discovery interface:

```typescript
const HELP_TEXT = `...`;  // Detailed usage
const TOOL_DESCRIPTION = `...`;  // One-line, ≤ 1024 chars

if (args.help) {
  console.log(HELP_TEXT);
  Deno.exit(0);
}

if (args.description) {
  console.log(TOOL_DESCRIPTION);
  Deno.exit(0);
}
```

#### Pattern 3: Subprocess Isolation

Tools call syscalls via subprocess to maintain security boundaries:

```typescript
async function sealSecret(plaintext: string): Promise<string> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "-A", "--unstable-kv", cryptoUrl, "seal", plaintext],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await cmd.output();
  
  if (code !== 0) {
    throw new Error(`Failed to seal: ${decode(stderr)}`);
  }
  
  return decode(stdout).trim();
}
```

**Rationale**: Even though tools are TypeScript, subprocess invocation ensures:
1. Clear security boundaries
2. Consistent with PromptWare OS syscall model
3. Future-proof for remote execution

### OAuth Implementation

#### PKCE (RFC 7636)

Proof Key for Code Exchange prevents authorization code interception:

```typescript
// Generate code_verifier (random 32 bytes, base64url)
const verifier = base64url(crypto.randomBytes(32));

// Generate code_challenge (SHA256 of verifier, base64url)
const challenge = base64url(sha256(verifier));

// Include in authorization URL
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?
  client_id=${clientId}&
  code_challenge=${challenge}&
  code_challenge_method=S256&
  ...`;

// After user grants, exchange code with verifier
const tokenRequest = {
  code: authCode,
  code_verifier: verifier,
  ...
};
```

**Security Benefit**: Even if authorization code is intercepted, attacker cannot exchange it without the verifier.

#### Token Storage

```typescript
// Storage hierarchy
/vault/google/access_token      // pwenc:v1:... (sealed)
/vault/google/refresh_token     // pwenc:v1:... (sealed)
/vault/google/token_metadata    // { expires_at, scope } (plaintext, not sensitive)
```

**Design Decision**: Metadata is stored in plaintext because:
1. Not sensitive (expiration time, scope names)
2. Enables token validation without unsealing
3. Simpler implementation

### API Wrapper Design

#### Unified Token Retrieval

All API wrappers use the same pattern:

```typescript
async function getAccessToken(): Promise<string> {
  // 1. Call oauth-token.ts get (returns sealed)
  const sealed = await subprocess("oauth-token.ts", "get");
  
  // 2. Unseal (in TypeScript, not LLM)
  const plaintext = await subprocess("crypto.ts", "open", sealed);
  
  return plaintext;
}
```

#### Error Handling

```typescript
try {
  const response = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return await response.json();
} catch (error) {
  // API wrappers catch and re-throw with context
  // Agent layer handles error recovery
  throw new Error(`Gmail API failed: ${error.message}`);
}
```

**Design Decision**: Error handling at API wrapper level, recovery at agent level. This separation allows:
1. API wrappers to remain simple and focused
2. Agent to implement sophisticated retry/fallback logic
3. User-friendly error messages in agent persona

## Design Decisions & Tradeoffs

### Decision 1: Subprocess Invocation vs. Direct Import

**Options:**
- A: Import TypeScript modules directly
- B: Use subprocess invocation (Deno.Command)

**Choice: B (Subprocess)**

**Rationale:**
- Maintains clear security boundaries
- Consistent with PromptWare OS syscall model
- Allows tools to run from URLs (zero-footprint)
- Future-proof for distributed execution

**Tradeoff:**
- Slightly slower (process overhead ~10-50ms)
- More complex error handling
- Accepted: Security and consistency outweigh performance cost

### Decision 2: Token Storage Location

**Options:**
- A: Store in environment variables
- B: Store in local files
- C: Store in Deno KV vault

**Choice: C (Deno KV vault)**

**Rationale:**
- RFC 0018 compliance
- Enforces sealed-at-rest (vault rejects plaintext)
- Origin isolation (multi-tenant safe)
- Persistent across sessions

**Tradeoff:**
- Requires Deno KV setup
- Slightly more complex than env vars
- Accepted: Security and compliance outweigh simplicity

### Decision 3: Single Account vs. Multi-Account

**Options:**
- A: Support multiple Google accounts
- B: Single account only

**Choice: B (Single account)**

**Rationale:**
- Simplifies initial implementation
- Most use cases involve one account
- Can be extended later without breaking changes

**Tradeoff:**
- Users with multiple accounts must revoke/re-auth
- Accepted: 80/20 rule - single account covers most needs

### Decision 4: Automatic Refresh vs. Manual

**Options:**
- A: API wrappers auto-refresh on 401
- B: Require explicit refresh call

**Choice: A (Automatic refresh)**

**Rationale:**
- Better user experience
- Reduces agent complexity
- Matches industry best practices

**Tradeoff:**
- Slightly more complex API wrapper code
- Accepted: UX improvement justifies complexity

### Decision 5: API Surface (Full vs. Minimal)

**Options:**
- A: Expose every Google API method
- B: Minimal set of high-value operations

**Choice: B (Minimal)**

**Rationale:**
- Follows microkernel philosophy
- Easier to test and maintain
- Covers 80% of use cases

**Tradeoff:**
- Users may need to extend for advanced use cases
- Accepted: Can add operations incrementally based on demand

## Testing Strategy

### Unit Tests

Focus: Tool interfaces and basic functionality
- Help/description flags work (RFC 0012)
- Argument parsing is correct
- Error messages are informative

### Integration Tests

Focus: End-to-end workflows
- OAuth flow completes successfully
- Token refresh works
- API calls return expected data

### Security Tests

Focus: Token protection
- No plaintext tokens in logs
- Vault enforces pwenc format
- Sealed tokens decrypt correctly

## Future Enhancements

### Planned Features

1. **Additional Google APIs**
   - Google Calendar
   - Google Sheets
   - Google Meet
   - Google Tasks

2. **Advanced Operations**
   - Batch API calls
   - Webhook support for real-time updates
   - Advanced query builders

3. **Multi-Account Support**
   - Profile management
   - Account switching
   - Shared vault namespaces

4. **Performance Optimizations**
   - Token caching (in-memory, time-limited)
   - Connection pooling
   - Rate limiting with exponential backoff

5. **Monitoring & Observability**
   - API usage metrics
   - Token refresh monitoring
   - Error rate tracking

### Extension Points

The architecture allows extensions without breaking changes:

1. **New API Wrappers**: Add `*-api.ts` tools, update SKILL.md
2. **Alternative Auth**: Add OAuth for different providers
3. **Custom Workflows**: Compose existing tools in agent scripts

## Conclusion

The Google Developer Expert skill demonstrates PromptWare OS's ability to securely integrate with external APIs while maintaining strict security boundaries. The **Zero-Trust Token Management** architecture ensures OAuth credentials never reach the LLM context, making it safe to use in production environments.

Key achievements:
- ✅ RFC 0012, 0016, 0018 compliant
- ✅ Zero plaintext token leakage to pRing 0
- ✅ Microkernel design (atomic, composable tools)
- ✅ Comprehensive documentation and testing
- ✅ Production-ready security architecture

---

**Document Version**: 1.0  
**Author**: PromptWare OS Development Team  
**Last Updated**: 2024-12-24  
**Status**: Final
