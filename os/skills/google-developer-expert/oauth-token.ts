#!/usr/bin/env -S deno run --allow-net --allow-env --allow-run --unstable-kv
/**
 * PromptWar̊e ØS Tool: OAuth Token Manager
 * 
 * Manages OAuth token lifecycle: refresh, validation, and retrieval.
 * Security: Never exposes plaintext tokens to pRing 0.
 * Returns only sealed tokens or status information.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Usage: oauth-token.ts <action> [options]

Actions:
  get          Get sealed access token (returns pwenc:v1:...)
  refresh      Refresh access token if expired
  validate     Check if token is valid (doesn't return token)
  revoke       Revoke and delete stored tokens

Options:
  --help, -h   Show this help

Description:
  Manages OAuth token lifecycle. All tokens remain sealed.
  Use this tool to retrieve tokens for API calls or check validity.
`;

const TOOL_DESCRIPTION = "OAuth token lifecycle manager. Handles token refresh, validation, and secure retrieval.";

/**
 * Call crypto syscall to unseal a token (only used internally in TypeScript)
 */
async function unsealSecret(sealed: string): Promise<string> {
  const osRoot = Deno.env.get("PWOS_ROOT") || "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/";
  const cryptoUrl = new URL("kernel/syscalls/crypto.ts", osRoot).href;
  
  const cmd = new Deno.Command("deno", {
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
      sealed,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await cmd.output();
  
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to unseal secret: ${errorText}`);
  }
  
  return new TextDecoder().decode(stdout).trim();
}

/**
 * Seal a secret using crypto syscall
 */
async function sealSecret(plaintext: string): Promise<string> {
  const osRoot = Deno.env.get("PWOS_ROOT") || "https://raw.githubusercontent.com/ShipFail/promptware/refs/heads/main/os/";
  const cryptoUrl = new URL("kernel/syscalls/crypto.ts", osRoot).href;
  
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "-A",
      "--unstable-kv",
      "--location",
      Deno.env.get("PWOS_ORIGIN") || "https://google-expert.local/",
      cryptoUrl,
      "--root",
      osRoot,
      "seal",
      plaintext,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  
  const { code, stdout, stderr } = await cmd.output();
  
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to seal secret: ${errorText}`);
  }
  
  const sealed = new TextDecoder().decode(stdout).trim();
  
  if (!sealed.startsWith("pwenc:v1:")) {
    throw new Error("Invalid sealed format");
  }
  
  return sealed;
}

/**
 * Get sealed access token
 */
async function getToken(): Promise<string> {
  const kv = await Deno.openKv();
  try {
    const tokenEntry = await kv.get(["vault", "google", "access_token"]);
    
    if (!tokenEntry.value) {
      throw new Error("No access token found. Please authenticate first.");
    }
    
    // Check if token is expired
    const metadataEntry = await kv.get(["vault", "google", "token_metadata"]);
    if (metadataEntry.value) {
      const metadata = metadataEntry.value as any;
      if (metadata.expires_at && Date.now() >= metadata.expires_at) {
        console.error("⚠️  Token expired. Attempting refresh...");
        await refreshToken();
        // Retry getting the token
        const newTokenEntry = await kv.get(["vault", "google", "access_token"]);
        return newTokenEntry.value as string;
      }
    }
    
    return tokenEntry.value as string;
  } finally {
    kv.close();
  }
}

/**
 * Refresh access token using refresh token
 */
async function refreshToken(): Promise<void> {
  const kv = await Deno.openKv();
  try {
    const refreshTokenEntry = await kv.get(["vault", "google", "refresh_token"]);
    
    if (!refreshTokenEntry.value) {
      throw new Error("No refresh token found. Please re-authenticate.");
    }
    
    // Unseal refresh token (happens in TypeScript, not pRing 0)
    const sealedRefreshToken = refreshTokenEntry.value as string;
    const refreshTokenPlaintext = await unsealSecret(sealedRefreshToken);
    
    // Get client credentials from environment
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
      throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables required");
    }
    
    // Request new access token
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenPlaintext,
      grant_type: "refresh_token",
    });
    
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }
    
    const tokens = await response.json();
    
    // Seal new access token
    const newAccessTokenSealed = await sealSecret(tokens.access_token);
    
    // Update stored token
    await kv.set(["vault", "google", "access_token"], newAccessTokenSealed);
    await kv.set(["vault", "google", "token_metadata"], {
      expires_at: Date.now() + (tokens.expires_in * 1000),
      scope: tokens.scope,
      token_type: tokens.token_type,
    });
    
    console.log("✅ Token refreshed successfully");
  } finally {
    kv.close();
  }
}

/**
 * Validate token (check if it exists and isn't expired)
 */
async function validateToken(): Promise<void> {
  const kv = await Deno.openKv();
  try {
    const tokenEntry = await kv.get(["vault", "google", "access_token"]);
    
    if (!tokenEntry.value) {
      console.log("❌ No token found");
      Deno.exit(1);
    }
    
    const metadataEntry = await kv.get(["vault", "google", "token_metadata"]);
    if (metadataEntry.value) {
      const metadata = metadataEntry.value as any;
      if (metadata.expires_at && Date.now() >= metadata.expires_at) {
        console.log("⚠️  Token expired");
        Deno.exit(2);
      }
    }
    
    console.log("✅ Token valid");
  } finally {
    kv.close();
  }
}

/**
 * Revoke and delete stored tokens
 */
async function revokeToken(): Promise<void> {
  const kv = await Deno.openKv();
  try {
    const tokenEntry = await kv.get(["vault", "google", "access_token"]);
    
    if (tokenEntry.value) {
      // Unseal and revoke with Google
      try {
        const plaintext = await unsealSecret(tokenEntry.value as string);
        const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(plaintext)}`;
        await fetch(revokeUrl, { method: "POST" });
        console.log("✅ Token revoked with Google");
      } catch (err) {
        console.error("⚠️  Failed to revoke with Google:", err.message);
      }
    }
    
    // Delete from vault
    await kv.delete(["vault", "google", "access_token"]);
    await kv.delete(["vault", "google", "refresh_token"]);
    await kv.delete(["vault", "google", "token_metadata"]);
    
    console.log("✅ Local tokens deleted");
  } finally {
    kv.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    boolean: ["help", "description"],
    alias: { h: "help" },
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

  try {
    if (action === "get") {
      const token = await getToken();
      console.log(token); // Returns sealed token (safe for pRing 0)
    } else if (action === "refresh") {
      await refreshToken();
    } else if (action === "validate") {
      await validateToken();
    } else if (action === "revoke") {
      await revokeToken();
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
