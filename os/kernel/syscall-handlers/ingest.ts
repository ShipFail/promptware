import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, stringify } from "jsr:@std/yaml";
import resolve from "./resolve.ts";

/**
 * PromptWar̊e ØS Syscall: Ingest
 * Fetches and hydrates a Markdown file (JIT Linking).
 */

const HELP_TEXT = `
Usage: deno run -A ingest.ts --root <os_root> <uri>

Arguments:
  uri     The URI of the markdown file to ingest.

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
`;

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

async function fetchContent(path: string): Promise<string> {
  if (isUrl(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
    return res.text();
  } else {
    return Deno.readTextFile(path);
  }
}

async function getSkillMetadata(path: string): Promise<{ name?: string; description: string }> {
  try {
    const content = await fetchContent(path);
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (match) {
      const fm = parse(match[1]) as any;
      return {
        name: fm.name,
        description: fm.description || "No description provided.",
      };
    }
    return { description: "No front matter found." };
  } catch (e: any) {
    return { description: `Error reading skill: ${e.message}` };
  }
}

async function getToolDescription(path: string): Promise<string> {
  const MAX_LENGTH = 1024;
  
  // 1. Try --description (PromptWare Native)
  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--description"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.success) {
      let desc = new TextDecoder().decode(output.stdout).trim();
      if (desc.length > MAX_LENGTH) {
        desc = desc.substring(0, MAX_LENGTH) + "... (truncated)";
      }
      return desc;
    }
  } catch {
    // Ignore errors, fall back to --help
  }

  // 2. Fallback to --help (Legacy/External)
  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    // Even if it fails (exit code != 0), we might get useful help text in stdout/stderr
    const rawOutput = new TextDecoder().decode(output.success ? output.stdout : output.stderr).trim();
    
    // First Paragraph Heuristic
    let desc = rawOutput.split("\n\n")[0];
    
    if (desc.length > MAX_LENGTH) {
      desc = desc.substring(0, MAX_LENGTH) + "... (Run with --help for full usage)";
    }
    return desc;
  } catch (e: any) {
    return `Error executing tool: ${e.message}`;
  }
}

export default async function ingest(targetUri: string, explicitRoot?: string): Promise<string> {
  let root: string = explicitRoot || "";

  if (!root) {
    // Load Root from KV (Service Locator Pattern)
    const kv = await Deno.openKv();
    try {
      const res = await kv.get(["proc", "cmdline"]);
      if (!res.value) throw new Error("Kernel Panic: proc/cmdline not found. Is the kernel initialized?");
      // Note: KERNEL.md stores params as a JSON string
      const params = JSON.parse(res.value as string);
      root = params.root;
    } finally {
      kv.close();
    }
  }

  if (!root) {
    throw new Error("Kernel Panic: No root found. Unable to resolve paths.");
  }

  // Resolve the target URI first
  const resolvedPath = await resolve(targetUri, undefined, root);
  
  let content = "";
  try {
    content = await fetchContent(resolvedPath);
  } catch (e: any) {
    throw new Error(`Failed to read ${resolvedPath}: ${e.message}`);
  }

  const match = content.match(/^---\n([\s\S]+?)\n---/);
  if (!match) return content;

  const rawFm = match[1];
  const body = content.substring(match[0].length);
  const fm = parse(rawFm) as any;

  // Hydrate Skills
  if (Array.isArray(fm.skills)) {
    const hydratedSkills = [];
    for (const skillPath of fm.skills) {
      if (typeof skillPath === "string") {
        // Resolve skill path relative to the *current file* (resolvedPath)
        const absoluteSkillPath = await resolve(skillPath, resolvedPath, root);
        const metadata = await getSkillMetadata(absoluteSkillPath);
        hydratedSkills.push({ [skillPath]: metadata });
      } else {
        hydratedSkills.push(skillPath);
      }
    }
    fm.skills = hydratedSkills;
  }

  // Hydrate Tools
  if (Array.isArray(fm.tools)) {
    const hydratedTools = [];
    for (const toolPath of fm.tools) {
      if (typeof toolPath === "string") {
        const absoluteToolPath = await resolve(toolPath, resolvedPath, root);
        const description = await getToolDescription(absoluteToolPath);
        hydratedTools.push({ [toolPath]: { description } });
      } else {
        hydratedTools.push(toolPath);
      }
    }
    fm.tools = hydratedTools;
  }

  const newFm = stringify(fm);
  return `---\n${newFm}---${body}`;
}

// CLI Entry Point
async function main() {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  const root = args.root;
  // In fallback mode (CLI), we require root if not relying on KV.
  // But to be safe and explicit in CLI mode, we enforce it.
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

  const uri = String(args._[0]);

  if (!uri || uri === "undefined") {
    console.error("Error: Missing uri argument");
    Deno.exit(1);
  }

  try {
    const content = await ingest(uri, root);
    console.log(content);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
