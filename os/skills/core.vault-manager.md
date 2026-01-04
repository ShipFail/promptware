---
type: skill
title: "Vault Manager"
version: "1.0.0"
tags: [security, vault, secrets, crypto]
---

# Vault Manager

This skill provides the standard operating procedure for managing secrets in PromptWar̊e ØS.
Use it whenever the user asks to "store a secret", "save an API key", or "manage credentials".

## Conceptual Model

The **Vault** is a protected namespace within the OS Memory (`/vault/`).
It enforces a **Sealed-at-Rest** policy:

1.  **Mandatory Encryption**: The Memory subsystem rejects any write to `/vault/*` that is not a valid ciphertext string (`pwenc:v1:...`).
2.  **No Plaintext Storage**: You cannot store plaintext secrets. You must seal them first.
3.  **Just-in-Time Decryption**: Secrets are only decrypted at the moment of use (e.g., by `pwosFetch` or the `Sealed` class).

## Workflow: Storing a Secret

To store a new secret (e.g., an OpenAI API Key), you must perform a **Seal-then-Store** operation:

1.  **Seal**: Encrypt the plaintext using the Kernel Crypto syscall.
    ```typescript
    const sealed = await pwosCrypto("seal", "sk-...");
    // Returns "pwenc:v1:..."
    ```
2.  **Store**: Write the ciphertext to the Vault.
    ```typescript
    await pwosMemory("set", "/vault/openai/api_key", sealed);
    ```

## Workflow: Using a Secret

To use a stored secret, you generally do **not** decrypt it manually. Instead, pass the ciphertext to a Sealed-aware tool.

### Option A: Sealed Networking (Preferred)
Use `pwosFetch` to automatically unseal headers.

```typescript
const apiKey = await pwosMemory("get", "/vault/openai/api_key");

// The syscall will unseal 'apiKey' in-memory before sending.
await pwosFetch("https://api.openai.com/v1/...", {
  headers: { Authorization: `Bearer ${apiKey}` }
});
```

### Option B: Manual Decryption (Debugging/Legacy)
If you absolutely need the plaintext (e.g., for a tool that doesn't support Sealed), use `pwosCrypto`.

```typescript
const sealed = await pwosMemory("get", "/vault/openai/api_key");
const plaintext = await pwosCrypto("open", sealed);
```

## Best Practices

*   **Naming**: Use hierarchical keys: `/vault/<provider>/<key_name>` (e.g., `/vault/aws/access_key_id`).
*   **Rotation**: To rotate a key, simply overwrite it with a new sealed value.
*   **Verification**: You can list vault keys with `pwosMemory("list", "/vault/")`. The values will be ciphertext (safe to display).

## Tools

This skill relies on the Kernel Signals defined in `KERNEL.md`:
*   `pwosCrypto`
*   `pwosMemory`
*   `pwosFetch`

No external tools are required.
