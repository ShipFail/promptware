#!/usr/bin/env -S deno run --allow-net --allow-env --allow-run --unstable-kv
/**
 * PromptWar̊e ØS Tool: Gmail API Wrapper
 * 
 * Provides access to Gmail API operations.
 * Uses sealed tokens from vault for authentication.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Usage: gmail-api.ts <action> [options]

Actions:
  list            List messages
  get <id>        Get message by ID
  send            Send a message
  search <query>  Search messages
  labels          List labels
  threads         List threads

Options:
  --max-results <n>   Maximum results to return (default: 10)
  --to <email>        Recipient email (for send)
  --subject <text>    Message subject (for send)
  --body <text>       Message body (for send)
  --label <name>      Filter by label (for list)
  --help, -h          Show this help

Description:
  Gmail API wrapper. Uses sealed OAuth tokens from vault.
  All authentication is handled transparently.
`;

const TOOL_DESCRIPTION = "Gmail API wrapper with secure OAuth authentication. Supports reading, sending, and searching emails.";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

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
async function gmailRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  
  const url = endpoint.startsWith("http") ? endpoint : `${GMAIL_API_BASE}${endpoint}`;
  
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
    throw new Error(`Gmail API error: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/**
 * List messages
 */
async function listMessages(maxResults: number, labelIds?: string[]): Promise<void> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });
  
  if (labelIds && labelIds.length > 0) {
    labelIds.forEach(id => params.append("labelIds", id));
  }
  
  const data = await gmailRequest(`/users/me/messages?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Get message by ID
 */
async function getMessage(id: string): Promise<void> {
  const data = await gmailRequest(`/users/me/messages/${id}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Search messages
 */
async function searchMessages(query: string, maxResults: number): Promise<void> {
  const params = new URLSearchParams({
    q: query,
    maxResults: maxResults.toString(),
  });
  
  const data = await gmailRequest(`/users/me/messages?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Send message
 */
async function sendMessage(to: string, subject: string, body: string): Promise<void> {
  // Create RFC 2822 formatted message
  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "",
    body,
  ];
  const message = messageParts.join("\n");
  
  // Base64url encode
  const encoded = btoa(message)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  const data = await gmailRequest(`/users/me/messages/send`, {
    method: "POST",
    body: JSON.stringify({
      raw: encoded,
    }),
  });
  
  console.log("✅ Message sent");
  console.log(JSON.stringify(data, null, 2));
}

/**
 * List labels
 */
async function listLabels(): Promise<void> {
  const data = await gmailRequest(`/users/me/labels`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * List threads
 */
async function listThreads(maxResults: number): Promise<void> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });
  
  const data = await gmailRequest(`/users/me/threads?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["max-results", "to", "subject", "body", "label"],
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
    if (action === "list") {
      const labels = args.label ? [args.label] : undefined;
      await listMessages(maxResults, labels);
    } else if (action === "get") {
      const id = String(args._[1] || "");
      if (!id) throw new Error("Message ID required");
      await getMessage(id);
    } else if (action === "send") {
      const to = args.to;
      const subject = args.subject;
      const body = args.body;
      if (!to || !subject || !body) {
        throw new Error("--to, --subject, and --body required for send");
      }
      await sendMessage(to, subject, body);
    } else if (action === "search") {
      const query = String(args._[1] || "");
      if (!query) throw new Error("Search query required");
      await searchMessages(query, maxResults);
    } else if (action === "labels") {
      await listLabels();
    } else if (action === "threads") {
      await listThreads(maxResults);
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
