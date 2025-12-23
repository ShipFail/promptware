---
RFC: 0006
Title: "Ring -1: The Vault Primitive"
Author: Huan Li, ChatGPT
Status: Draft
Type: Standards Track
Created: 2025-12-23
Updated: 2025-12-23
Version: 0.1
Tags: promptwareos, security, oauth, ssh-agent, sign-to-derive, proxy
---

# RFC 0006: Ring -1: The Vault Primitive

## Abstract

PromptWar̊e ØS elevates natural language to kernel privilege: **“Prompt at Ring 0.”** In this model, the prompt kernel (pRing 0) is inherently exposed to untrusted inputs and must be treated as **non-confidential**. This RFC defines a **minimal** security layer at **pRing[-1]** that enables OAuth-based access to remote APIs **without exposing plaintext credentials** to pRing 0 (or higher rings) by default.

The pRing[-1] layer is specified as a **single raw-HTTP proxy primitive** that:

1. Enforces an outbound **base-URL allowlist** (MVP).
2. Performs **decrypt-on-egress** for encrypted credentials carried in standard HTTP headers (e.g., `Authorization`).
3. Performs **encrypt-on-ingress** for OAuth token responses by replacing `access_token` / `refresh_token` values with an encrypted string wrapper.

This document specifies the threat model, trust assumptions, crypto approach (**Sign-to-Derive** via a local non-extractable signing capability), wire format for encrypted tokens (`pwenc:v1:...`), and normative requirements.

## Status of This Memo

This document is an Internet-Draft–style specification for PromptWar̊e ØS. It is a work in progress and is **not** a stable standard.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **PromptWar̊e ØS**: A prompt-defined operating environment intended to be booted by a one-liner prompt in `agents.md`.
* **pRing**: *Prompt Ring*, a privilege/metaphor layer for PromptwareOS.
* **pRing 0**: The prompt kernel (LLM context). Considered **non-confidential**.
* **pRing 1**: System calls (“syscalls”) implemented as Deno TypeScript scripts.
* **pRing 3**: Agent applications that interact with human users and call syscalls.
* **pRing[-1]**: The **Security Layer / Vault Primitive** defined in this RFC.
* **Vault Primitive**: A minimal, pure function-like syscall providing only the behavior defined herein.
* **Credential**: OAuth token material, primarily `access_token` and `refresh_token`.
* **Plaintext credential**: Unencrypted credential material.
* **Sealed / Encrypted credential**: Credential wrapped as `pwenc:v1:...`.
* **Local signing capability**: A non-extractable signing oracle such as `ssh-agent`, OS keychain-backed signing key, or hardware-backed key.

## Design Goals

1. **No plaintext credentials in pRing 0 by default**.
2. **Maximum minimalism**: pRing[-1] is specified as **one primitive** (`proxyFetch`).
3. **Transparency**: pRing[-1] does not invent new OAuth or resource API schemas.
4. **Compatibility**: pRing[-1] MAY pass through plaintext authorization headers (compat mode), but this disables confidentiality guarantees for that call.
5. **Cross-platform**: The design must be implementable on macOS, Linux, and Windows.
6. **No local daemon requirement**: pRing[-1] is invoked on-demand.
7. **Pinned execution**: pRing[-1] implementation MUST be pinned to a known tag/version/branch.

## Non-Goals

1. Preventing compromise on a fully compromised host (e.g., root malware).
2. Providing application-level credential selection, storage, or account management (pRing 3 concerns).
3. Enforcing a syscall sandbox in v1 (file/network restrictions outside pRing[-1] are out of scope for this RFC).
4. Token refresh automation. Refresh logic is application-level (pRing 3).

## Threat Model and Trust Assumptions

### Trust Assumptions

A1. PromptwareOS execution is configured such that the agent cannot read raw private key material (e.g., `~/.ssh/id_*`) or export secrets from the local signing capability.

A2. pRing 0 is **not confidential**. Any data present in the LLM context may be exfiltrated.

A3. pRing[-1] can access a **local non-extractable signing capability** to sign a challenge string (Sign-to-Derive), but cannot export private key material.

A4. The pRing[-1] implementation is pinned to a known version and is not silently replaced.

### Attacker Model

* The attacker can influence prompts, tool outputs, and can attempt prompt injection.
* The attacker may be able to read pRing 0 content.
* The attacker may control or author some pRing 3 code (user scripts).

### Security Objective

* Prevent **plaintext OAuth credentials** from being exposed to pRing 0 by default when pRing 3 uses the `pwenc:v1:...` mechanism.

## High-Level Architecture

### Overview

pRing[-1] exposes exactly one operation:

* `proxyFetch(input[, init]) -> Response`

`proxyFetch` is intentionally modeled after the Web Platform / W3C **`fetch`** API to reduce cognitive load, but uses a distinct name (`proxyFetch`) to make the security boundary explicit.

Conceptually:

* `input` is either a URL string or a Request-like object.
* `init` is optional and matches `RequestInit` (method, headers, body, etc.).

pRing[-1] validates the destination base URL against an allowlist, then:

* **Decrypt-on-egress**: Finds encrypted credential strings (`pwenc:v1:...`) within the request (commonly in headers such as `Authorization`), decrypts them in memory, and substitutes plaintext values in the outbound request.

* **Encrypt-on-ingress**: If the response is JSON and contains the keys `access_token` and/or `refresh_token`, the corresponding values are encrypted and replaced with `pwenc:v1:...` wrappers.

The response is otherwise passed through unchanged.

### Rings

PromptwareOS uses an explicit *ring metaphor* to reduce cognitive load for both humans and agents. The classic model (hardware → kernel → userland) is **remapped** into PromptwareOS *Prompt Rings* (pRings).

### Classic ring analogy (reference mental model)

In conventional systems:

1. **Ring −1**: Hardware virtualization / hypervisor layer (when present)
2. **Ring 0**: OS kernel (privileged mode)
3. **Ring 3**: Userland applications (least privileged)

This is the familiar “below the kernel / kernel / userland” stack.

### PromptwareOS remap

PromptwareOS is *built on top of* an existing userland runtime (e.g., Deno, a CLI agent host). To make the metaphor memorable, PromptwareOS **re-anchors** the privilege story around what matters most: the LLM context.

* **pRing 0 (Prompt Kernel)**: Natural language prompt kernel inside the LLM context window. This is the system’s control plane but is treated as **non-confidential**.
* **pRing 1 (Syscalls)**: Deno TypeScript scripts implementing system calls and shared services (including `memory`).
* **pRing 3 (Agents / Apps)**: Agent applications facing the human user, orchestrating workflows and calling syscalls.
* **pRing[-1] (Security Layer / Vault Primitive)**: A minimal, privileged security shim that performs cryptographic transforms and acts as a constrained HTTP proxy.

### Why pRing[-1] exists

In traditional OS design, secrets may be managed by privileged components that applications cannot directly introspect. PromptwareOS needs an equivalent boundary **below** the prompt context, because pRing 0 is exposed by design.

pRing[-1] is therefore defined as “the layer that MUST see plaintext credentials briefly in memory to make authenticated requests, while guaranteeing that plaintext credentials MUST NOT be revealed to pRing 0+.”

### Notation

This RFC writes the negative ring explicitly as **`pRing[-1]`** to avoid confusion with `pRing 1`.

## The `proxyFetch` Primitive

To minimize cognitive load, pRing[-1] exposes a single primitive whose call signature mirrors the Web Platform / W3C **`fetch`** API.

* Name: **`proxyFetch`** (distinct from `fetch` for differentiation)
* Signature: **`proxyFetch(input[, init]) -> Response`**

`proxyFetch` behaves like standard `fetch` **except** for two additional security behaviors defined in this RFC:

1. **Allowlist gate** on the request URL base.
2. **Credential transformation** for `pwenc:v1:` wrappers (decrypt-on-egress, encrypt-on-ingress).

The rest of this section specifies the required behavior.

### Input Model

`proxyFetch` MUST accept the same conceptual inputs as standard `fetch`:

* `input`: either

  * a URL string, or
  * a Request-like object (including URL)
* `init` (OPTIONAL): a RequestInit-like object (method, headers, body, etc.)

Because pRing[-1] is invoked across a syscall boundary, implementations MAY serialize `input` and `init` into a JSON object; however, the **semantics** MUST match `fetch`.

Example (fetch-like):

```json
{
  "input": "https://www.googleapis.com/drive/v3/files?pageSize=10",
  "init": {
    "method": "GET",
    "headers": {
      "Authorization": "Bearer pwenc:v1:...",
      "Accept": "application/json"
    }
  }
}
```

### Allowlist Gate

* pRing[-1] MUST compute the **base URL** as `scheme://host[:port]` from the request URL.
* pRing[-1] MUST reject any request whose base URL is not present in the implementation’s allowlist.
* The allowlist is **hard-coded** for MVP.

### Credential Transformation

#### Detection

* pRing[-1] MUST treat any string that begins with `pwenc:v1:` as an encrypted credential wrapper.
* pRing[-1] SHOULD scan the following locations for `pwenc:v1:` strings:

  * `Authorization` header value
  * Any header values
  * JSON request bodies (OPTIONAL for v1; MAY be added later)

#### Decrypt-on-Egress

* For any `pwenc:v1:` string found in the request, pRing[-1] MUST decrypt it in memory and substitute the plaintext value into the outbound request.
* pRing[-1] MUST NOT expose plaintext credentials in its return value.
* pRing[-1] MUST NOT log plaintext credential material.

#### Pass-through (Compatibility Mode)

* If the request contains plaintext authorization material (e.g., an `Authorization` header not containing `pwenc:v1:`), pRing[-1] MUST pass it through unchanged.
* In this mode, PromptwareOS confidentiality guarantees for credentials do not apply.

#### Encrypt-on-Ingress

* If the response body is JSON and contains keys named `access_token` and/or `refresh_token` with string values, pRing[-1] MUST replace those values with encrypted `pwenc:v1:...` wrappers.
* The response MUST otherwise be returned unchanged, preserving status code, headers, and body structure.

### Response Model

`proxyFetch` MUST return a Response-like result consistent with standard `fetch`:

* status code
* headers
* body

pRing[-1] MUST NOT wrap or annotate the response with additional fields.

## Cryptography

### Sign-to-Derive

pRing[-1] derives a symmetric encryption key without touching private key files.

#### Inputs

* `CTX`: a fixed context string

  * `"PromptwareOS::pwenc::v1"`
* `KID`: an identifier for the signing key (e.g., SSH public key fingerprint)

#### Derivation

1. pRing[-1] obtains a signature `SIG = Sign(CTX)` using the local non-extractable signing capability.
2. pRing[-1] derives an encryption key with HKDF-SHA-256:

* `K = HKDF(ikm=SIG, salt="PromptwareOS", info="pwenc:v1", L=32)`

#### Encryption Algorithm

* pRing[-1] MUST use an AEAD cipher.
* For v1, pRing[-1] SHOULD use **AES-256-GCM** (via WebCrypto) for efficiency and portability.

### `pwenc:v1:` Wrapper

Encrypted tokens are encoded as:

```
pwenc:v1:<B64URL(JSON)>
```

Where the JSON object MUST include:

* `v`: integer version (1)
* `kid`: key identifier string
* `alg`: `"A256GCM"`
* `nonce`: base64url nonce
* `ct`: base64url ciphertext (includes auth tag if applicable)

Example (illustrative):

```text
pwenc:v1:eyJ2IjoxLCJraWQiOiJzc2gtZnA6U0hBMjU2OmFiY2QiLCJhbGciOiJBMjU2R0NNIiwibm9uY2UiOiJ...","Y3QiOiI..."}
```

### Decryption

* pRing[-1] MUST validate the wrapper format and version.
* pRing[-1] MUST derive the same key `K` via Sign-to-Derive.
* pRing[-1] MUST decrypt in memory and zero sensitive buffers when feasible.

## Operational Requirements

1. **No plaintext-token API**: pRing[-1] MUST NOT expose any API that returns plaintext credentials.
2. **No storage**: pRing[-1] MUST NOT read or write PromptwareOS memory/KV directly.
3. **Pinned implementation**: pRing[-1] MUST be pinned to a specific tag/version/branch.
4. **No schema invention**: pRing[-1] MUST NOT invent error codes or alter non-token JSON.
5. **Allowlist**: pRing[-1] MUST enforce an outbound base-URL allowlist.

## Rationale

### Why OAuth

* OAuth device flow supports a prompt/CLI environment without requiring a local daemon.
* OAuth provides explicit user consent, scopes, and revocation semantics.

### Why Sign-to-Derive (not keychains, not services)

* System keychains are unreliable in headless/CI environments and differ across OSes.
* A remote vault service adds operational complexity and a central trust dependency.
* Developers already have SSH keys and agents; Sign-to-Derive leverages a local non-extractable signing capability.

### Why Minimal `proxyFetch`

* A single primitive minimizes attack surface.
* Raw HTTP preserves upstream API schemas and reduces cognitive load.

## Security Considerations

* If a caller supplies plaintext tokens, pRing[-1] cannot prevent exposure in pRing 0.
* Base-URL allowlists reduce accidental exfiltration but do not prevent all misuse if a listed host is malicious.
* If the local signing capability is compromised, confidentiality is lost.

## Privacy Considerations

* Encrypted tokens may still leak metadata (provider hostnames, request paths, scopes). This is considered acceptable for v1.

## IANA Considerations

This document has no IANA actions.

## Acknowledgements

Thanks to PromptwareOS contributors and the broader CLI/security community.

## Examples

This section is non-normative.

### Example 1: Resource request with encrypted Authorization

A pRing 3 agent stores an OAuth token response where `access_token` and `refresh_token` have been replaced by `pwenc:v1:...` strings. To call a protected API, the agent supplies the encrypted token in a normal `Authorization` header.

Request:

```json
{
  "url": "https://www.googleapis.com/drive/v3/files?pageSize=10",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer pwenc:v1:eyJ2IjoxLCJraWQiOiJzc2gtZnA6U0hBMjU2OmFiY2QiLCJhbGciOiJBMjU2R0NNIiwibm9uY2UiOiJOT05DRSIsImN0IjoiQ0lQSEVSVEVYVCJ9",
    "Accept": "application/json"
  }
}
```

pRing[-1] behavior (summary):

* Validates base URL `https://www.googleapis.com` is allowlisted.
* Detects `pwenc:v1:` wrapper in the `Authorization` header.
* Decrypts in-memory and substitutes the outbound `Authorization: Bearer <PLAINTEXT_TOKEN>`.
* Sends the request.
* Returns the upstream response unchanged.

Upstream response (unchanged):

```json
{
  "files": [
    {"name": "report.md", "id": "1a2b3c"},
    {"name": "notes.txt", "id": "4d5e6f"}
  ],
  "nextPageToken": "..."
}
```

### Example 2: Device flow start (no tokens yet)

A pRing 3 agent initiates OAuth device flow by calling the provider’s device authorization endpoint via `proxyFetch`. Since no token exists yet, the request has no `Authorization` header.

Request:

```json
{
  "url": "https://oauth2.googleapis.com/device/code",
  "method": "POST",
  "headers": {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json"
  },
  "body": "client_id=CLIENT_ID&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly"
}
```

Response (unchanged, standard device flow fields):

```json
{
  "device_code": "dc_...",
  "user_code": "ABCD-EFGH",
  "verification_uri": "https://www.google.com/device",
  "expires_in": 900,
  "interval": 5
}
```

### Example 3: Token exchange/polling response with token encryption

When the token endpoint returns `access_token` and `refresh_token`, pRing[-1] replaces those values with `pwenc:v1:...` wrappers. All other fields are preserved.

Upstream response (illustrative):

```json
{
  "access_token": "ya29.a0AfH6SMA...",
  "expires_in": 3599,
  "refresh_token": "1//0gL...",
  "scope": "https://www.googleapis.com/auth/drive.readonly",
  "token_type": "Bearer"
}
```

Returned response (token strings replaced):

```json
{
  "access_token": "pwenc:v1:eyJ2IjoxLCJraWQiOiJzc2gtZnA6U0hBMjU2OmFiY2QiLCJhbGciOiJBMjU2R0NNIiwibm9uY2UiOiJOT05DRSIsImN0IjoiQ0lQSEVSVEVYVCJ9",
  "expires_in": 3599,
  "refresh_token": "pwenc:v1:eyJ2IjoxLCJraWQiOiJzc2gtZnA6U0hBMjU2OmFiY2QiLCJhbGciOiJBMjU2R0NNIiwibm9uY2UiOiJOT05DRTIiLCJjdCI6IkNJUEhFUlRFWFQyIn0",
  "scope": "https://www.googleapis.com/auth/drive.readonly",
  "token_type": "Bearer"
}
```

## References

* RFC 2119, RFC 8174 (BCP 14 key words)
