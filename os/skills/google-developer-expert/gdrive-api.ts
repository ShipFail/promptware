#!/usr/bin/env -S deno run --allow-net --allow-env --allow-run --unstable-kv
/**
 * PromptWar̊e ØS Tool: Google Drive API Wrapper
 * 
 * Provides access to Google Drive API operations.
 * Uses sealed tokens from vault for authentication.
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

const HELP_TEXT = `
Usage: gdrive-api.ts <action> [options]

Actions:
  list                List files
  get <id>            Get file metadata by ID
  download <id>       Download file content
  upload              Upload a file
  delete <id>         Delete a file
  create-folder       Create a folder
  search <query>      Search files

Options:
  --file <path>       Local file path (for upload)
  --name <name>       File/folder name (for upload/create-folder)
  --mime-type <type>  MIME type (for upload)
  --parent <id>       Parent folder ID
  --max-results <n>   Maximum results (default: 10)
  --help, -h          Show this help

Description:
  Google Drive API wrapper. Uses sealed OAuth tokens from vault.
  All authentication is handled transparently.
`;

const TOOL_DESCRIPTION = "Google Drive API wrapper with secure OAuth authentication. Supports file operations, folder management, and search.";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";

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
async function driveRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  
  const url = endpoint.startsWith("http") ? endpoint : `${DRIVE_API_BASE}${endpoint}`;
  
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
    throw new Error(`Drive API error: ${response.status} ${errorText}`);
  }
  
  return await response.json();
}

/**
 * List files
 */
async function listFiles(maxResults: number, parentId?: string): Promise<void> {
  const params = new URLSearchParams({
    pageSize: maxResults.toString(),
    fields: "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink)",
  });
  
  if (parentId) {
    params.set("q", `'${parentId}' in parents`);
  }
  
  const data = await driveRequest(`/files?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Get file metadata
 */
async function getFile(id: string): Promise<void> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,createdTime,modifiedTime,size,webViewLink,parents",
  });
  
  const data = await driveRequest(`/files/${id}?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Download file content
 */
async function downloadFile(id: string): Promise<void> {
  const token = await getAccessToken();
  
  const response = await fetch(`${DRIVE_API_BASE}/files/${id}?alt=media`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Download failed: ${response.status} ${errorText}`);
  }
  
  const content = await response.text();
  console.log(content);
}

/**
 * Upload a file
 */
async function uploadFile(filePath: string, name: string, mimeType: string, parentId?: string): Promise<void> {
  const token = await getAccessToken();
  
  // Read file content
  const fileContent = await Deno.readFile(filePath);
  
  // Create metadata
  const metadata: any = {
    name,
    mimeType,
  };
  
  if (parentId) {
    metadata.parents = [parentId];
  }
  
  // Multipart upload
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  
  const metadataPart = delimiter + "Content-Type: application/json\r\n\r\n" + JSON.stringify(metadata);
  const contentPart = delimiter + `Content-Type: ${mimeType}\r\n\r\n`;
  
  const encoder = new TextEncoder();
  const metadataBytes = encoder.encode(metadataPart);
  const contentHeaderBytes = encoder.encode(contentPart);
  const closeBytes = encoder.encode(closeDelimiter);
  
  const body = new Uint8Array(
    metadataBytes.length + contentHeaderBytes.length + fileContent.length + closeBytes.length
  );
  
  let offset = 0;
  body.set(metadataBytes, offset);
  offset += metadataBytes.length;
  body.set(contentHeaderBytes, offset);
  offset += contentHeaderBytes.length;
  body.set(fileContent, offset);
  offset += fileContent.length;
  body.set(closeBytes, offset);
  
  const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed: ${response.status} ${errorText}`);
  }
  
  const data = await response.json();
  console.log("✅ File uploaded");
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Delete a file
 */
async function deleteFile(id: string): Promise<void> {
  const token = await getAccessToken();
  
  const response = await fetch(`${DRIVE_API_BASE}/files/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Delete failed: ${response.status} ${errorText}`);
  }
  
  console.log("✅ File deleted");
}

/**
 * Create a folder
 */
async function createFolder(name: string, parentId?: string): Promise<void> {
  const metadata: any = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  
  if (parentId) {
    metadata.parents = [parentId];
  }
  
  const data = await driveRequest(`/files`, {
    method: "POST",
    body: JSON.stringify(metadata),
  });
  
  console.log("✅ Folder created");
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Search files
 */
async function searchFiles(query: string, maxResults: number): Promise<void> {
  const params = new URLSearchParams({
    q: query,
    pageSize: maxResults.toString(),
    fields: "files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink)",
  });
  
  const data = await driveRequest(`/files?${params.toString()}`);
  
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Main entry point
 */
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["file", "name", "mime-type", "parent", "max-results"],
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
      await listFiles(maxResults, args.parent);
    } else if (action === "get") {
      const id = String(args._[1] || "");
      if (!id) throw new Error("File ID required");
      await getFile(id);
    } else if (action === "download") {
      const id = String(args._[1] || "");
      if (!id) throw new Error("File ID required");
      await downloadFile(id);
    } else if (action === "upload") {
      const file = args.file;
      const name = args.name;
      const mimeType = args["mime-type"];
      if (!file || !name || !mimeType) {
        throw new Error("--file, --name, and --mime-type required for upload");
      }
      await uploadFile(file, name, mimeType, args.parent);
    } else if (action === "delete") {
      const id = String(args._[1] || "");
      if (!id) throw new Error("File ID required");
      await deleteFile(id);
    } else if (action === "create-folder") {
      const name = args.name;
      if (!name) throw new Error("--name required for create-folder");
      await createFolder(name, args.parent);
    } else if (action === "search") {
      const query = String(args._[1] || "");
      if (!query) throw new Error("Search query required");
      await searchFiles(query, maxResults);
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
