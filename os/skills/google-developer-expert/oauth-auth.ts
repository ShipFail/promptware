#!/usr/bin/env -S deno run --allow-net --allow-env --allow-run --allow-read --unstable-kv
/**
 * PromptWar̊e ØS Tool: Google OAuth 2.0 Authenticator
 * 
 * Implements OAuth 2.0 Authorization Code Flow for Google APIs.
 * Security: Plaintext tokens NEVER reach pRing 0. Tokens are sealed
 * immediately using pwosCrypto and stored in /vault/google/*.
 * 
 * This tool orchestrates the OAuth flow and returns only success/failure
 * status to the prompt context.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Usage: oauth-auth.ts <action> [options]

Actions:
  start       Start OAuth flow (opens browser, starts local server)
  callback    Handle OAuth callback (internal use)
  status      Check authentication status

Options:
  --client-id <id>        Google OAuth Client ID
  --client-secret <sec>   Google OAuth Client Secret
  --scopes <scopes>       Comma-separated OAuth scopes
  --vault-path <path>     Vault path for tokens (default: /vault/google/oauth)
  --port <port>           Local server port (default: 8080)
  --help, -h              Show this help

Description:
  Implements OAuth 2.0 Authorization Code Flow with PKCE.
  Tokens are immediately sealed and stored in the vault.
  Never exposes plaintext tokens to pRing 0.
`;

const TOOL_DESCRIPTION = "Google OAuth 2.0 authenticator with secure token storage. Implements authorization code flow with PKCE.";

// Default OAuth scopes for Gmail, Drive, and Docs
const DEFAULT_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/documents",
].join(" ");

const REDIRECT_URI = "http://localhost:8080/oauth/callback";

/**
 * Generate PKCE code verifier and challenge
 */
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  // Generate 32 random bytes
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Base64url encode
  const verifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  // SHA256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  
  // Base64url encode
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  
  return { verifier, challenge };
}

/**
 * Start OAuth flow
 */
async function startOAuthFlow(
  clientId: string,
  scopes: string,
  port: number
): Promise<void> {
  const { verifier, challenge } = await generatePKCE();
  
  // Store verifier in temporary location (not vault, as it's not a long-term secret)
  const kv = await Deno.openKv();
  await kv.set(["oauth", "pkce_verifier"], verifier);
  await kv.set(["oauth", "client_id"], clientId);
  kv.close();
  
  // Build authorization URL
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  
  console.log("🔐 Starting OAuth 2.0 flow...");
  console.log("");
  console.log("Please open this URL in your browser:");
  console.log("");
  console.log(authUrl.toString());
  console.log("");
  console.log(`Waiting for callback on port ${port}...`);
  console.log("(The local server will shut down automatically after receiving the callback)");
  
  // Start local HTTP server to receive callback
  await startCallbackServer(port);
}

/**
 * Start local HTTP server to handle OAuth callback
 */
async function startCallbackServer(port: number): Promise<void> {
  const server = Deno.listen({ port });
  console.log(`\n✅ Local server listening on http://localhost:${port}`);
  
  try {
    for await (const conn of server) {
      handleConnection(conn, server);
    }
  } catch (error) {
    console.error("Server error:", error);
  }
}

/**
 * Handle HTTP connection
 */
async function handleConnection(conn: Deno.Conn, server: Deno.Listener): Promise<void> {
  const httpConn = Deno.serveHttp(conn);
  
  for await (const requestEvent of httpConn) {
    const url = new URL(requestEvent.request.url);
    
    if (url.pathname === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      
      if (error) {
        await requestEvent.respondWith(
          new Response(`<h1>Authentication Failed</h1><p>Error: ${error}</p>`, {
            status: 400,
            headers: { "content-type": "text/html" },
          })
        );
        console.error(`\n❌ OAuth error: ${error}`);
        server.close();
        Deno.exit(1);
      }
      
      if (code) {
        // Exchange code for tokens (this happens in TypeScript, not in prompt)
        try {
          await exchangeCodeForTokens(code);
          
          await requestEvent.respondWith(
            new Response(
              `<h1>Authentication Successful!</h1><p>You can close this window and return to the terminal.</p>`,
              {
                status: 200,
                headers: { "content-type": "text/html" },
              }
            )
          );
          
          console.log("\n✅ Authentication successful! Tokens securely stored in vault.");
          server.close();
          Deno.exit(0);
        } catch (err) {
          console.error("\n❌ Failed to exchange code for tokens:", err);
          await requestEvent.respondWith(
            new Response(`<h1>Token Exchange Failed</h1><p>Error: ${err.message}</p>`, {
              status: 500,
              headers: { "content-type": "text/html" },
            })
          );
          server.close();
          Deno.exit(1);
        }
      }
    } else {
      await requestEvent.respondWith(
        new Response("Not Found", { status: 404 })
      );
    }
  }
}

/**
 * Exchange authorization code for access/refresh tokens
 * CRITICAL: This runs in TypeScript. Plaintext tokens never reach pRing 0.
 */
async function exchangeCodeForTokens(code: string): Promise<void> {
  const kv = await Deno.openKv();
  
  try {
    // Retrieve PKCE verifier and client ID
    const verifierEntry = await kv.get(["oauth", "pkce_verifier"]);
    const clientIdEntry = await kv.get(["oauth", "client_id"]);
    
    if (!verifierEntry.value || !clientIdEntry.value) {
      throw new Error("PKCE verifier or client ID not found. Did you run 'start' first?");
    }
    
    const verifier = verifierEntry.value as string;
    const clientId = clientIdEntry.value as string;
    
    // Get client secret from environment (agent must provide this)
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientSecret) {
      throw new Error("GOOGLE_CLIENT_SECRET environment variable not set");
    }
    
    // Exchange code for tokens
    const tokenUrl = "https://oauth2.googleapis.com/token";
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
      code_verifier: verifier,
    });
    
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
    }
    
    const tokens = await response.json();
    
    // CRITICAL SECURITY STEP: Seal tokens immediately
    // We need to call the crypto syscall, but since we're already in TypeScript,
    // we can import and use the crypto module directly
    
    // For now, we'll use a subprocess call to ensure proper isolation
    // In a production system, we'd import the crypto module directly
    const accessTokenSealed = await sealSecret(tokens.access_token);
    const refreshTokenSealed = tokens.refresh_token 
      ? await sealSecret(tokens.refresh_token)
      : null;
    
    // Store sealed tokens in vault
    await kv.set(["vault", "google", "access_token"], accessTokenSealed);
    if (refreshTokenSealed) {
      await kv.set(["vault", "google", "refresh_token"], refreshTokenSealed);
    }
    await kv.set(["vault", "google", "token_metadata"], {
      expires_at: Date.now() + (tokens.expires_in * 1000),
      scope: tokens.scope,
      token_type: tokens.token_type,
    });
    
    // Clean up temporary PKCE data
    await kv.delete(["oauth", "pkce_verifier"]);
    await kv.delete(["oauth", "client_id"]);
    
    console.log("\n🔒 Tokens sealed and stored in /vault/google/*");
  } finally {
    kv.close();
  }
}

/**
 * Seal a secret using pwosCrypto
 * Calls the crypto syscall to encrypt the plaintext
 */
async function sealSecret(plaintext: string): Promise<string> {
  // Determine OS root from environment or use default
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
    throw new Error("Invalid sealed format returned from crypto syscall");
  }
  
  return sealed;
}

/**
 * Check authentication status
 */
async function checkStatus(): Promise<void> {
  const kv = await Deno.openKv();
  try {
    const accessToken = await kv.get(["vault", "google", "access_token"]);
    const refreshToken = await kv.get(["vault", "google", "refresh_token"]);
    const metadata = await kv.get(["vault", "google", "token_metadata"]);
    
    if (!accessToken.value) {
      console.log("❌ Not authenticated. Run with 'start' action to begin OAuth flow.");
      return;
    }
    
    console.log("✅ Authenticated");
    console.log(`   Access token: ${(accessToken.value as string).substring(0, 30)}...`);
    
    if (refreshToken.value) {
      console.log(`   Refresh token: ${(refreshToken.value as string).substring(0, 30)}...`);
    }
    
    if (metadata.value) {
      const meta = metadata.value as any;
      const expiresIn = Math.floor((meta.expires_at - Date.now()) / 1000);
      console.log(`   Expires in: ${expiresIn > 0 ? expiresIn + 's' : 'EXPIRED'}`);
      console.log(`   Scopes: ${meta.scope}`);
    }
  } finally {
    kv.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["client-id", "client-secret", "scopes", "vault-path", "port"],
    boolean: ["help", "description"],
    alias: { h: "help" },
    default: {
      scopes: DEFAULT_SCOPES,
      port: "8080",
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

  try {
    if (action === "start") {
      const clientId = args["client-id"] || Deno.env.get("GOOGLE_CLIENT_ID");
      if (!clientId) {
        throw new Error("--client-id or GOOGLE_CLIENT_ID environment variable required");
      }
      
      const port = parseInt(args.port);
      await startOAuthFlow(clientId, args.scopes, port);
    } else if (action === "status") {
      await checkStatus();
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
