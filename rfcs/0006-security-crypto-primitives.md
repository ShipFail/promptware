---
RFC: 0006
Title: Crypto Primitives Specification
Author: Huan Li, ChatGPT
Status: Draft
Type: Standards Track
Created: 2025-12-23
Updated: 2025-12-23
Version: 0.1
Tags: security, cryptography, pwenc, sign-to-derive, aead
---

# RFC 0006: Crypto Primitives Specification

## Abstract

PromptWar̊e ØS runs a prompt kernel in an LLM context window (pRing 0), which must be treated as non-confidential. This RFC defines a minimal set of cryptographic primitives used by PromptWar̊e ØS to store sensitive values as **ciphertext strings safe to copy/paste** and safe to place into prompts/logs.

The core primitive is `pwenc:v1:<payload>`, a string wrapper for AEAD-encrypted secrets. The encryption key is derived via **Sign-to-Derive**, using a **local non-extractable signing capability** (e.g., ssh-agent / OS keychain-backed signing / hardware-backed key). Private key material MUST never be accessed.

## Status of This Memo

This document is a PromptWar̊e ØS RFC-style specification and may change at any time.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in BCP 14 (RFC 2119, RFC 8174).

## Terminology

* **Secret**: Sensitive plaintext value (e.g., OAuth access token, refresh token).
* **Ciphertext**: AEAD-encrypted bytes.
* **pwenc**: PromptWar̊e ØS encrypted string wrapper.
* **AEAD**: Authenticated encryption with associated data.
* **Sign-to-Derive**: Key derivation by signing a fixed challenge and KDF’ing the signature.
* **Local signing capability**: A signing oracle where private key material is non-extractable.
* **KID**: Key identifier of the signing key used.

## Design Goals

1. **Copy/paste-safe ciphertext**: A `pwenc` string MAY be exposed in prompts/logs.
2. **No private key access**: Implementations MUST NOT read private key files.
3. **Cross-platform**: Implementable on macOS/Linux/Windows.
4. **Minimal surface**: One wrapper format (`pwenc:v1`) and one default cipher suite.
5. **Deterministic derivation per identity**: Same signer identity yields same derived key.

## Non-Goals

1. Protecting secrets on a fully compromised host.
2. Providing network or storage semantics (covered by other RFCs).
3. Multi-recipient encryption or sharing.

## Threat Model and Assumptions

### Assumptions

A1. The local signing capability is trusted and does not expose private key material.

A2. Attackers may read pRing 0 content; therefore plaintext secrets MUST NOT be placed in the LLM context by default.

A3. The caller environment may be hostile; ciphertext may be copied, logged, or stored.

### Security Objective

Given A1–A3, `pwenc` MUST provide confidentiality and integrity for the wrapped secret against anyone who does not control the local signing capability for the same identity.

## `pwenc:v1` Format

A `pwenc` value is a UTF-8 string with the prefix:

```
pwenc:v1:
```

followed by a base64url-encoded JSON object:

```
pwenc:v1:<B64URL(JSON)>
```

### `pwenc:v1` JSON schema

The decoded JSON object MUST contain:

* `v` (number): MUST be `1`.
* `kid` (string): key identifier.
* `alg` (string): MUST be `"A256GCM"` for v1.
* `nonce` (string): base64url nonce.
* `ct` (string): base64url ciphertext (including AEAD tag, as produced by the AEAD API).

It MAY contain:

* `aad` (string): base64url AAD (if used; see below).
* `ts` (number): unix seconds timestamp (advisory; not relied upon for security).

### Validation

Implementations MUST:

* Reject non-UTF8 input.
* Reject strings not beginning with `pwenc:v1:`.
* Base64url-decode the payload; reject decode errors.
* Parse JSON; reject parse errors.
* Enforce `v == 1`.
* Enforce `alg == "A256GCM"`.
* Enforce presence of `nonce`, `ct`, `kid`.

## Cipher Suite

### AEAD

For v1, implementations SHOULD use **AES-256-GCM** via WebCrypto (or equivalent) for efficiency and portability.

* Key size: 256-bit
* Nonce size: 96-bit (RECOMMENDED)

Implementations MUST generate a fresh random nonce per encryption.

### Associated Data (AAD)

AAD is OPTIONAL in v1. If present, implementations SHOULD set AAD to bind the ciphertext to:

* the wrapper version (`pwenc:v1`)
* the `kid`

If AAD is used:

* the same AAD bytes MUST be provided for decryption.
* the JSON field `aad` MUST include the base64url of those AAD bytes.

## Key Derivation: Sign-to-Derive

### Overview

`pwenc:v1` uses a derived symmetric key `K` that is computed at runtime from a signature over a fixed challenge string.

This provides a stable key per identity without accessing private key material.

### Inputs

* `CTX` (string): fixed context string

  * MUST be exactly: `"PromptWareOS::pwenc::v1"`
* `KID` (string): key identifier of the signer identity

  * RECOMMENDED: `ssh-fp:SHA256:<fingerprint>` when using ssh-agent.

### Signature

Implementations MUST obtain:

* `SIG = Sign(CTX)`

using a local non-extractable signing capability.

Notes:

* The signing mechanism MUST be user-identity-bound.
* The signing mechanism MAY require user presence (touch) or passphrase.

### KDF

Implementations MUST derive the AEAD key `K` using HKDF-SHA-256:

* `K = HKDF(ikm=SIG, salt="PromptwareOS", info="pwenc:v1", L=32)`

Where:

* `ikm` is the raw signature bytes.
* `salt` and `info` are UTF-8 bytes.

### KID binding

Implementations SHOULD ensure the chosen `KID` corresponds to the signing key used.

If multiple keys are available, implementations SHOULD select the same default key consistently unless explicitly configured.

## Operations

### `seal(plaintext) -> pwenc`

Given a plaintext secret:

1. MUST derive `K` via Sign-to-Derive.
2. MUST generate a random nonce.
3. MUST AEAD-encrypt the plaintext bytes under `K`.
4. MUST construct `pwenc` JSON and base64url-encode it.

The returned value MUST be a `pwenc:v1:` string.

### `open(pwenc) -> plaintext`

Given a `pwenc` string:

1. MUST validate `pwenc` format.
2. MUST derive `K` via Sign-to-Derive.
3. MUST AEAD-decrypt using the given nonce and ciphertext.
4. MUST return plaintext bytes.

The `open` operation MUST be treated as sensitive and SHOULD be used only inside confined code paths (e.g., within a `Secret.use(fn)` pattern).

## Handling and Redaction Requirements

Implementations MUST:

* Never log plaintext secrets.
* Never print plaintext secrets to stdout/stderr.

Implementations SHOULD:

* Best-effort zero sensitive buffers when feasible.
* Ensure `Secret` types (if provided) serialize to ciphertext (not plaintext).

## Error Handling

Implementations MUST fail closed.

* If validation fails, return an error.
* If signing fails, return an error.
* If decryption fails, return an error.

Error messages MUST NOT include plaintext secret material.

## Security Considerations

* If the local signing capability is compromised, secrets can be decrypted.
* If plaintext secrets are copied into prompts/logs, confidentiality is lost regardless of `pwenc`.
* AES-GCM requires unique nonces per key; implementations MUST use a secure RNG.

## Privacy Considerations

`pwenc` values may leak metadata such as:

* frequency of updates
* which `kid` identity was used

This is acceptable for v1.

## IANA Considerations

This document has no IANA actions.

## References

* RFC 2119: Key words for use in RFCs to Indicate Requirement Levels
* RFC 8174: Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words
