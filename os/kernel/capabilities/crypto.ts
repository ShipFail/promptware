import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";
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

// ================================
// QUERY: crypto/open
// ================================

const OpenInputSchema = z.object({
  ciphertext: z.string().describe("The encrypted secret (pwenc:v1:...) to decrypt"),
}).describe("Input for crypto/open capability.");

const OpenOutputSchema = z.object({
  plaintext: z.string().describe("The decrypted plaintext"),
}).describe("Output from crypto/open capability.");

// ================================
// QUERY: crypto/derive
// ================================

const DeriveInputSchema = z.object({}).describe("Input for crypto/derive capability (no parameters).");

const DeriveOutputSchema = z.object({
  kid: z.string().describe("The derived Key ID (SSH key fingerprint)"),
}).describe("Output from crypto/derive capability.");

export const CryptoModule = {
  "Security.Seal": (): Capability<any, any> => ({
    description: "Encrypt a secret using the OS key.",
    inbound: z.object({
      kind: z.literal("command"),
      type: z.literal("Security.Seal"),
      data: SealInputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("Security.Seal"),
      data: SealOutputSchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const input = msg.data as z.infer<typeof SealInputSchema>;
        const ciphertext = await seal(input.plaintext);
        controller.enqueue(createMessage("reply", "Security.Seal", { ciphertext }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  }),
  "Security.Open": (): Capability<any, any> => ({
    description: "Decrypt a sealed secret using the OS key.",
    inbound: z.object({
      kind: z.literal("query"),
      type: z.literal("Security.Open"),
      data: OpenInputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("Security.Open"),
      data: OpenOutputSchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const input = msg.data as z.infer<typeof OpenInputSchema>;
        const plaintext = await open(input.ciphertext);
        controller.enqueue(createMessage("reply", "Security.Open", { plaintext }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  }),
  "Security.Derive": (): Capability<any, any> => ({
    description: "Derive and return the OS Key ID (KID).",
    inbound: z.object({
      kind: z.literal("query"),
      type: z.literal("Security.Derive"),
      data: DeriveInputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("Security.Derive"),
      data: DeriveOutputSchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const { kid } = await deriveKey();
        controller.enqueue(createMessage("reply", "Security.Derive", { kid }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  })
};

export default CryptoModule;

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
