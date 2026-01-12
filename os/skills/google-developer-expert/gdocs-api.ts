#!/usr/bin/env -S deno run --allow-net --allow-env --allow-run --unstable-kv
/**
 * PromptWar̊e ØS Tool: Google Docs API Wrapper
 * 
 * Provides access to Google Docs API operations.
 * Uses sealed tokens from vault for authentication.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Usage: gdocs-api.ts <action> [options]

Actions:
  get <id>           Get document by ID
  create             Create a new document
  update <id>        Update document content
  list               List accessible documents (via Drive API)

Options:
  --title <text>     Document title (for create/update)
  --content <text>   Document content (for create/update)
  --max-results <n>  Maximum results (default: 10)
  --help, -h         Show this help

Description:
  Google Docs API wrapper. Uses sealed OAuth tokens from vault.
  All authentication is handled transparently.
`;

const TOOL_DESCRIPTION = "Google Docs API wrapper with secure OAuth authentication. Supports reading, creating, and updating documents.";

const DOCS_API_BASE = "https://docs.googleapis.com/v1";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

/**
 * Call oauth-token.ts to get sealed token, then unseal it
 */
async function getAccessToken(): Promise<string> {
  const osRoot = Deno.env.get("PWOS_ROOT") || "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/";
  const tokenToolUrl = new URL("skills/google-developer-expert/oauth-token.ts", osRoot).href;
  
  // Get sealed token
  const getTokenCmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "--location",
      Deno.env.get("PWOS_ORIGIN") || "https://google-expert.local/",
      tokenToolUrl,
      "get",
    ],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code: getCode, stdout: getStdout, stderr: getStderr } = await getTokenCmd.output();
  
  if (getCode !== 0) {
    const errorText = new TextDecoder().decode(getStderr);
    throw new Error(`Failed to get token: ${errorText}`);
  }
  
  const sealedToken = new TextDecoder().decode(getStdout).trim();
  
  // Unseal token
  const cryptoUrl = new URL("kernel/syscalls/crypto.ts", osRoot).href;
  const unsealCmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "--location",
      Deno.env.get("PWOS_ORIGIN") || "https://google-expert.local/",
      cryptoUrl,
      "--root",
      osRoot,
      "open",
      sealedToken,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code: unsealCode, stdout: unsealStdout, stderr: unsealStderr } = await unsealCmd.output();
  
  if (unsealCode !== 0) {
    const errorText = new TextDecoder().decode(unsealStderr);
    throw new Error(`Failed to unseal token: ${errorText}`);
  }
  
  return new TextDecoder().decode(unsealStdout).trim();
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  
  const url = endpoint.startsWith("http") ? endpoint : `${DOCS_API_BASE}${endpoint}`;
  
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/**
 * Get document by ID
 */
async function getDocument(id: string): Promise<void> {
  const data = await apiRequest(`/documents/${id}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Create a new document
 */
async function createDocument(title: string): Promise<void> {
  const data = await apiRequest(`/documents`, {
    method: "POST",
    body: JSON.stringify({
      title,
    }),
  });
  
  console.log("✅ Document created");
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Update document content
 */
async function updateDocument(id: string, content: string): Promise<void> {
  // Get current document to find insertion point
  const doc = await apiRequest(`/documents/${id}`);
  const endIndex = doc.body.content[doc.body.content.length - 1].endIndex - 1;
  
  // Batch update to insert text
  const data = await apiRequest(`/documents/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: endIndex },
            text: content,
          },
        },
      ],
    }),
  });
  
  console.log("✅ Document updated");
  console.log(JSON.stringify(data, null, 2));
}

/**
 * List Google Docs (via Drive API)
 */
async function listDocuments(maxResults: number): Promise<void> {
  const token = await getAccessToken();
  
  const params = new URLSearchParams({
    pageSize: maxResults.toString(),
    q: "mimeType='application/vnd.google-apps.document'",
    fields: "files(id,name,createdTime,modifiedTime,webViewLink)",
  });
  
  const url = `${DRIVE_API_BASE}/files?${params.toString()}`;
  
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API error: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["title", "content", "max-results"],
    boolean: ["help", "description"],
    alias: { h: "help" },
    default: {
      "max-results": "10",
    },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  if (args.description) {
    console.log(TOOL_DESCRIPTION);
    Deno.exit(0);
  }

  const action = String(args._[0] || "");
  const maxResults = parseInt(args["max-results"]);

  try {
    if (action === "get") {
      const id = String(args._[1] || "");
      if (!id) throw new Error("Document ID required");
      await getDocument(id);
    } else if (action === "create") {
      const title = args.title;
      if (!title) throw new Error("--title required for create");
      await createDocument(title);
    } else if (action === "update") {
      const id = String(args._[1] || "");
      const content = args.content;
      if (!id || !content) throw new Error("Document ID and --content required");
      await updateDocument(id, content);
    } else if (action === "list") {
      await listDocuments(maxResults);
    } else {
      console.error(`Unknown action: ${action}`);
      console.error("Run with --help for usage information");
      Deno.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
