import { z } from "jsr:@zod/zod";
import { SyscallModule } from "./contract.ts";
import { OsMessage } from "../lib/os-event.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { encodeBase64Url, decodeBase64Url } from "jsr:@std/encoding/base64url";

/**
 * PromptWare ØS Crypto Syscalls
 *
 * Implements RFC 0016: Crypto Primitives for sealed secrets (pwenc:v1:...).
 * Uses SSH Agent for key derivation and AES-256-GCM for encryption.
 *
 * Exports 3 modules:
 * - crypto/seal (command): Encrypt plaintext to pwenc ciphertext
 * - crypto/open (query): Decrypt pwenc ciphertext to plaintext
 * - crypto/derive (query): Derive and return key fingerprint
 */

// --- RFC 0016 Constants ---
const PWENC_PREFIX = "pwenc:v1:";
const CTX_STRING = "PromptWareOS::pwenc::v1";
const SALT = new TextEncoder().encode("PromptwareOS");
const INFO = new TextEncoder().encode("pwenc:v1");
const ALG = "A256GCM";

// --- SSH Agent Protocol Client ---

class SshAgentClient {
  private sockPath: string;

  constructor() {
    const sock = Deno.env.get("SSH_AUTH_SOCK");
    if (!sock) {
      throw new Error("SSH_AUTH_SOCK not defined. Cannot connect to signing capability.");
    }
    this.sockPath = sock;
  }

  private async request(code: number, payload: Uint8Array): Promise<Uint8Array> {
    const conn = await Deno.connect({ transport: "unix", path: this.sockPath });
    try {
      const len = 1 + payload.length;
      const buf = new Uint8Array(4 + len);
      const view = new DataView(buf.buffer);
      view.setUint32(0, len, false);
      buf[4] = code;
      buf.set(payload, 5);

      await conn.write(buf);

      const lenBuf = new Uint8Array(4);
      await conn.read(lenBuf);
      const respLen = new DataView(lenBuf.buffer).getUint32(0, false);

      const respBuf = new Uint8Array(respLen);
      let read = 0;
      while (read < respLen) {
        const n = await conn.read(respBuf.subarray(read));
        if (n === null) break;
        read += n;
      }

      return respBuf;
    } finally {
      conn.close();
    }
  }

  async getFirstKey(): Promise<Uint8Array> {
    const resp = await this.request(11, new Uint8Array(0));
    if (resp[0] !== 12) throw new Error(`Unexpected agent response code: ${resp[0]}`);

    const view = new DataView(resp.buffer);
    const count = view.getUint32(1, false);
    if (count === 0) throw new Error("No identities found in SSH Agent.");

    let offset = 5;
    const keyLen = view.getUint32(offset, false);
    offset += 4;
    const keyBlob = resp.slice(offset, offset + keyLen);
    return keyBlob;
  }

  async sign(keyBlob: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const keyLen = keyBlob.length;
    const dataLen = data.length;
    const payload = new Uint8Array(4 + keyLen + 4 + dataLen + 4);
    const view = new DataView(payload.buffer);

    let offset = 0;
    view.setUint32(offset, keyLen, false); offset += keyLen;
    payload.set(keyBlob, offset); offset += keyLen;

    view.setUint32(offset, dataLen, false); offset += 4;
    payload.set(data, offset); offset += dataLen;

    view.setUint32(offset, 0, false);

    const resp = await this.request(13, payload);
    if (resp[0] !== 14) throw new Error(`Agent sign failed. Code: ${resp[0]}`);

    const sigLen = new DataView(resp.buffer).getUint32(1, false);
    const sigBlob = resp.slice(5, 5 + sigLen);

    const sigView = new DataView(sigBlob.buffer);
    const typeLen = sigView.getUint32(0, false);
    const rawSigOffset = 4 + typeLen + 4;
    const rawSig = sigBlob.slice(rawSigOffset);

    return rawSig;
  }
}

// --- Crypto Primitives ---

async function deriveKey(): Promise<{ key: CryptoKey; kid: string }> {
  const agent = new SshAgentClient();
  const keyBlob = await agent.getFirstKey();

  const kidHash = await crypto.subtle.digest("SHA-256", keyBlob as BufferSource);
  const kid = `ssh-fp:SHA256:${encodeBase64Url(kidHash)}`;

  const ctxBytes = new TextEncoder().encode(CTX_STRING);
  const sig = await agent.sign(keyBlob, ctxBytes);

  const ikm = await crypto.subtle.importKey("raw", sig as BufferSource, "HKDF", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: SALT,
      info: INFO,
    },
    ikm,
    256
  );

  const key = await crypto.subtle.importKey(
    "raw",
    derivedBits,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );

  return { key, kid };
}

export async function seal(plaintext: string): Promise<string> {
  const { key, kid } = await deriveKey();
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ptBytes = new TextEncoder().encode(plaintext);

  const ctBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce },
    key,
    ptBytes
  );

  const payload = {
    v: 1,
    kid,
    alg: ALG,
    nonce: encodeBase64Url(nonce),
    ct: encodeBase64Url(new Uint8Array(ctBuffer)),
    ts: Math.floor(Date.now() / 1000),
  };

  const json = JSON.stringify(payload);
  return `${PWENC_PREFIX}${encodeBase64Url(new TextEncoder().encode(json))}`;
}

export async function open(pwenc: string): Promise<string> {
  if (!pwenc.startsWith(PWENC_PREFIX)) {
    throw new Error("Invalid format: missing pwenc:v1: prefix");
  }

  const b64 = pwenc.slice(PWENC_PREFIX.length);
  let jsonStr;
  try {
    jsonStr = new TextDecoder().decode(decodeBase64Url(b64));
  } catch {
    throw new Error("Invalid format: payload is not base64url");
  }

  let payload;
  try {
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error("Invalid format: payload is not JSON");
  }

  if (payload.v !== 1) throw new Error(`Unsupported version: ${payload.v}`);
  if (payload.alg !== ALG) throw new Error(`Unsupported alg: ${payload.alg}`);

  const { key, kid } = await deriveKey();

  if (payload.kid !== kid) {
    throw new Error(`Key ID mismatch. Stored: ${payload.kid}, Current: ${kid}`);
  }

  const nonce = decodeBase64Url(payload.nonce);
  const ct = decodeBase64Url(payload.ct);

  try {
    const ptBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      ct
    );
    return new TextDecoder().decode(ptBuffer);
  } catch {
    throw new Error("Decryption failed (integrity check failed).");
  }
}

// ================================
// COMMAND: crypto/seal
// ================================

const SealInputSchema = z.object({
  plaintext: z.string().describe("The secret plaintext to encrypt"),
}).describe("Input for crypto/seal syscall.");

const SealOutputSchema = z.object({
  ciphertext: z.string().describe("The encrypted secret (pwenc:v1:...)"),
}).describe("Output from crypto/seal syscall.");

const sealHandler = async (input: z.infer<typeof SealInputSchema>, _event: OsMessage): Promise<z.infer<typeof SealOutputSchema>> => {
  const ciphertext = await seal(input.plaintext);
  return { ciphertext };
};

export const cryptoSealModule: SyscallModule<typeof SealInputSchema, typeof SealOutputSchema> = {
  type: "command",
  InputSchema: SealInputSchema,
  OutputSchema: SealOutputSchema,
  handler: sealHandler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: crypto/seal <plaintext>");
    return { plaintext: args[0] };
  },
};

// ================================
// QUERY: crypto/open
// ================================

const OpenInputSchema = z.object({
  ciphertext: z.string().describe("The encrypted secret (pwenc:v1:...) to decrypt"),
}).describe("Input for crypto/open syscall.");

const OpenOutputSchema = z.object({
  plaintext: z.string().describe("The decrypted plaintext"),
}).describe("Output from crypto/open syscall.");

const openHandler = async (input: z.infer<typeof OpenInputSchema>, _event: OsMessage): Promise<z.infer<typeof OpenOutputSchema>> => {
  const plaintext = await open(input.ciphertext);
  return { plaintext };
};

export const cryptoOpenModule: SyscallModule<typeof OpenInputSchema, typeof OpenOutputSchema> = {
  type: "query",
  InputSchema: OpenInputSchema,
  OutputSchema: OpenOutputSchema,
  handler: openHandler,
  cliAdapter: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: crypto/open <ciphertext>");
    return { ciphertext: args[0] };
  },
};

// ================================
// QUERY: crypto/derive
// ================================

const DeriveInputSchema = z.object({}).describe("Input for crypto/derive syscall (no parameters).");

const DeriveOutputSchema = z.object({
  kid: z.string().describe("The derived Key ID (SSH key fingerprint)"),
}).describe("Output from crypto/derive syscall.");

const deriveHandler = async (_input: z.infer<typeof DeriveInputSchema>, _event: OsMessage): Promise<z.infer<typeof DeriveOutputSchema>> => {
  const { kid } = await deriveKey();
  return { kid };
};

export const cryptoDeriveModule: SyscallModule<typeof DeriveInputSchema, typeof DeriveOutputSchema> = {
  type: "query",
  InputSchema: DeriveInputSchema,
  OutputSchema: DeriveOutputSchema,
  handler: deriveHandler,
  cliAdapter: (_args: string[]) => ({}),
};

// ================================
// CLI Entry Point (Dual-Mode)
// ================================

if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help", "description"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(`
Usage: deno run -A crypto.ts [action] [args...]

Actions:
  seal <plaintext>      Encrypts a secret (returns pwenc:v1:...).
  open <pwenc>          Decrypts a secret (returns plaintext).
  derive                Debug: Derives and prints the key ID (KID).

Options:
  --help, -h            Show this help message.
  --description         Show tool description.
`);
    Deno.exit(0);
  }

  if (args.description) {
    console.log("Cryptographic primitives for PromptWare ØS. Implements RFC 0016 (pwenc) for sealed secrets.");
    Deno.exit(0);
  }

  const action = String(args._[0]);
  const cmdArgs = args._.slice(1).map(String);

  if (!action || action === "undefined") {
    console.error("Error: Missing action argument");
    Deno.exit(1);
  }

  try {
    let result: string;
    if (action === "seal") {
      if (!cmdArgs[0]) throw new Error("Missing plaintext argument");
      result = await seal(cmdArgs[0]);
    } else if (action === "open") {
      if (!cmdArgs[0]) throw new Error("Missing pwenc argument");
      result = await open(cmdArgs[0]);
    } else if (action === "derive") {
      const { kid } = await deriveKey();
      result = `Derived Key ID: ${kid}`;
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
    console.log(result);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}
