import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { OsMessage } from "../schema/message.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { seal, open, deriveKey } from "../lib/crypto.ts";

/**
 * PromptWare ØS Crypto Capabilities
 *
 * Implements RFC 0016: Crypto Primitives for sealed secrets (pwenc:v1:...).
 * Uses SSH Agent for key derivation and AES-256-GCM for encryption.
 *
 * Exports 3 capabilities:
 * - crypto/seal (command): Encrypt plaintext to pwenc ciphertext
 * - crypto/open (query): Decrypt pwenc ciphertext to plaintext
 * - crypto/derive (query): Derive and return key fingerprint
 */

// ================================
// COMMAND: crypto/seal
// ================================

const SealInputSchema = z.object({
  plaintext: z.string().describe("The secret plaintext to encrypt"),
}).describe("Input for crypto/seal capability.");

const SealOutputSchema = z.object({
  ciphertext: z.string().describe("The encrypted secret (pwenc:v1:...)"),
}).describe("Output from crypto/seal capability.");

const sealProcess = async (input: z.infer<typeof SealInputSchema>, _message: OsMessage): Promise<z.infer<typeof SealOutputSchema>> => {
  const ciphertext = await seal(input.plaintext);
  return { ciphertext };
};

export const cryptoSealModule: Capability<typeof SealInputSchema, typeof SealOutputSchema> = {
  type: "command",
  InputSchema: SealInputSchema,
  OutputSchema: SealOutputSchema,
  process: sealProcess,
  fromArgs: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: crypto/seal <plaintext>");
    return { plaintext: args[0] };
  },
};

// ================================
// QUERY: crypto/open
// ================================

const OpenInputSchema = z.object({
  ciphertext: z.string().describe("The encrypted secret (pwenc:v1:...) to decrypt"),
}).describe("Input for crypto/open capability.");

const OpenOutputSchema = z.object({
  plaintext: z.string().describe("The decrypted plaintext"),
}).describe("Output from crypto/open capability.");

const openProcess = async (input: z.infer<typeof OpenInputSchema>, _message: OsMessage): Promise<z.infer<typeof OpenOutputSchema>> => {
  const plaintext = await open(input.ciphertext);
  return { plaintext };
};

export const cryptoOpenModule: Capability<typeof OpenInputSchema, typeof OpenOutputSchema> = {
  type: "query",
  InputSchema: OpenInputSchema,
  OutputSchema: OpenOutputSchema,
  process: openProcess,
  fromArgs: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: crypto/open <ciphertext>");
    return { ciphertext: args[0] };
  },
};

// ================================
// QUERY: crypto/derive
// ================================

const DeriveInputSchema = z.object({}).describe("Input for crypto/derive capability (no parameters).");

const DeriveOutputSchema = z.object({
  kid: z.string().describe("The derived Key ID (SSH key fingerprint)"),
}).describe("Output from crypto/derive capability.");

const deriveProcess = async (_input: z.infer<typeof DeriveInputSchema>, _message: OsMessage): Promise<z.infer<typeof DeriveOutputSchema>> => {
  const { kid } = await deriveKey();
  return { kid };
};

export const cryptoDeriveModule: Capability<typeof DeriveInputSchema, typeof DeriveOutputSchema> = {
  type: "query",
  InputSchema: DeriveInputSchema,
  OutputSchema: DeriveOutputSchema,
  process: deriveProcess,
  fromArgs: (_args: string[]) => ({}),
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
