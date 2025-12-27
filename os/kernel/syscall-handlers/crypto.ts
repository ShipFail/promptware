import { parseArgs } from "jsr:@std/cli/parse-args";
import { encodeBase64Url, decodeBase64Url } from "jsr:@std/encoding/base64url";

/**
 * PromptWar̊e ØS Syscall: Crypto
 * Implements RFC 0016: Crypto Primitives Specification.
 * Provides 'seal', 'open', and 'derive' operations using SSH Agent for key derivation.
 */

const HELP_TEXT = `
Usage: deno run -A crypto.ts --root <os_root> <action> [args...]

Actions:
  seal <plaintext>      Encrypts a secret (returns pwenc:v1:...).
  open <pwenc>          Decrypts a secret (returns plaintext).
  derive                Debug: Derives and prints the key ID (KID).

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
  --description   Show tool description (RFC 0012).
`;

const TOOL_DESCRIPTION = "Cryptographic primitives for PromptWare ØS. Implements RFC 0016 (pwenc) for sealed secrets.";

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
      // Packet: [Length (4 bytes)] [Code (1 byte)] [Payload]
      const len = 1 + payload.length;
      const buf = new Uint8Array(4 + len);
      const view = new DataView(buf.buffer);
      view.setUint32(0, len, false); // Big Endian
      buf[4] = code;
      buf.set(payload, 5);

      await conn.write(buf);

      // Read Response Length
      const lenBuf = new Uint8Array(4);
      await conn.read(lenBuf);
      const respLen = new DataView(lenBuf.buffer).getUint32(0, false);

      // Read Response Body
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
    // SSH_AGENTC_REQUEST_IDENTITIES = 11
    const resp = await this.request(11, new Uint8Array(0));
    
    // SSH_AGENT_IDENTITIES_ANSWER = 12
    if (resp[0] !== 12) throw new Error(`Unexpected agent response code: ${resp[0]}`);

    const view = new DataView(resp.buffer);
    const count = view.getUint32(1, false);
    if (count === 0) throw new Error("No identities found in SSH Agent.");

    // Parse first key blob
    // [Code 1] [Count 4] [Len 4] [KeyBlob...] [CommentLen 4] [Comment...]
    let offset = 5;
    const keyLen = view.getUint32(offset, false);
    offset += 4;
    const keyBlob = resp.slice(offset, offset + keyLen);
    return keyBlob;
  }

  async sign(keyBlob: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    // SSH_AGENTC_SIGN_REQUEST = 13
    // Format: [KeyBlob String] [Data String] [Flags 4]
    
    const keyLen = keyBlob.length;
    const dataLen = data.length;
    const payload = new Uint8Array(4 + keyLen + 4 + dataLen + 4);
    const view = new DataView(payload.buffer);
    
    let offset = 0;
    view.setUint32(offset, keyLen, false); offset += 4;
    payload.set(keyBlob, offset); offset += keyLen;
    
    view.setUint32(offset, dataLen, false); offset += 4;
    payload.set(data, offset); offset += dataLen;
    
    view.setUint32(offset, 0, false); // Flags = 0

    const resp = await this.request(13, payload);

    // SSH_AGENT_SIGN_RESPONSE = 14
    if (resp[0] !== 14) throw new Error(`Agent sign failed. Code: ${resp[0]}`);

    // Parse signature blob
    // [Code 1] [SigBlobLen 4] [SigBlob...]
    const sigLen = new DataView(resp.buffer).getUint32(1, false);
    const sigBlob = resp.slice(5, 5 + sigLen);

    // The sigBlob is an SSH signature: [TypeLen 4] [Type] [RawSigLen 4] [RawSig]
    // We want the RawSig.
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
  
  // KID = SHA256 fingerprint of key blob (standard SSH fingerprint)
  const kidHash = await crypto.subtle.digest("SHA-256", keyBlob as BufferSource);
  const kid = `ssh-fp:SHA256:${encodeBase64Url(kidHash)}`;

  // Sign CTX
  const ctxBytes = new TextEncoder().encode(CTX_STRING);
  const sig = await agent.sign(keyBlob, ctxBytes);

  // HKDF
  const ikm = await crypto.subtle.importKey("raw", sig as BufferSource, "HKDF", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: SALT,
      info: INFO,
    },
    ikm,
    256 // 256 bits for AES-256
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
  const nonce = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce
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

// --- Main Dispatcher ---

export default async function cryptoSyscall(root: string, action: string, ...args: string[]): Promise<string> {
  if (action === "seal") {
    if (!args[0]) throw new Error("Missing plaintext argument");
    return await seal(args[0]);
  } else if (action === "open") {
    if (!args[0]) throw new Error("Missing pwenc argument");
    return await open(args[0]);
  } else if (action === "derive") {
    const { kid } = await deriveKey();
    return `Derived Key ID: ${kid}`;
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help", "description"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  if (args.description) {
    console.log(TOOL_DESCRIPTION);
    Deno.exit(0);
  }

  const root = args.root;
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

  const action = String(args._[0]);
  const cmdArgs = args._.slice(1).map(String);

  if (!action || action === "undefined") {
    console.error("Error: Missing action argument");
    Deno.exit(1);
  }

  try {
    const result = await cryptoSyscall(root, action, ...cmdArgs);
    console.log(result);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
