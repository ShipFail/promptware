import { parseArgs } from "jsr:@std/cli/parse-args";
import { open } from "./crypto.ts";

/**
 * PromptWar̊e ØS Syscall: Fetch
 * Implements RFC 0017: Sealed Networking.
 * Wraps W3C fetch with transparent unsealing of pwenc:v1: headers.
 */

const HELP_TEXT = `
Usage: deno run -A fetch.ts --root <os_root> <url> [init_json]

Arguments:
  url       The URL to fetch.
  init_json Optional JSON string for RequestInit (headers, method, etc).

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
  --description   Show tool description (RFC 0012).
`;

const TOOL_DESCRIPTION = "Network fetch with transparent unsealing of pwenc:v1: headers (RFC 0017).";

const PWENC_PREFIX = "pwenc:v1:";

async function unsealHeaders(headers: Headers): Promise<void> {
  for (const [key, value] of headers.entries()) {
    if (value.includes(PWENC_PREFIX)) {
      // Simple substitution: replace all occurrences of pwenc:v1:... with plaintext
      // Note: This regex matches pwenc:v1: followed by base64url chars
      const regex = /pwenc:v1:[A-Za-z0-9_-]+/g;
      const matches = value.match(regex);
      
      if (matches) {
        let newValue = value;
        for (const pwenc of matches) {
          try {
            const plaintext = await open(pwenc);
            newValue = newValue.replace(pwenc, plaintext);
          } catch (e: any) {
            throw new Error(`Failed to unseal header '${key}': ${e.message}`);
          }
        }
        headers.set(key, newValue);
      }
    }
  }
}

export default async function fetchSyscall(root: string, url: string, initJson?: string): Promise<any> {
  let init: RequestInit = {};
  if (initJson) {
    try {
      init = JSON.parse(initJson);
    } catch {
      throw new Error("Invalid init_json: must be valid JSON string.");
    }
  }

  // 1. Build Request object to normalize headers
  const req = new Request(url, init);

  // 2. Unseal Headers
  await unsealHeaders(req.headers);

  // 3. Perform Fetch
  const res = await fetch(req);

  // 4. Return Response (serialized for CLI)
  // We return the text body and status/headers
  const bodyText = await res.text();
  const headersObj: Record<string, string> = {};
  res.headers.forEach((v, k) => headersObj[k] = v);

  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: headersObj,
    body: bodyText,
    url: res.url
  };
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

  const url = String(args._[0]);
  const initJson = args._[1] ? String(args._[1]) : undefined;

  if (!url || url === "undefined") {
    console.error("Error: Missing url argument");
    Deno.exit(1);
  }

  try {
    const result = await fetchSyscall(root, url, initJson);
    console.log(JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
