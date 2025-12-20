import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, stringify } from "jsr:@std/yaml";
import { join, dirname, isAbsolute, fromFileUrl } from "jsr:@std/path";

/**
 * PromptWar̊e ØS Software Kernel (syscall.ts)
 * The "Hardware" implementation of the OS.
 * Handles Path Resolution, JIT Linking, and Memory.
 */

const HELP_TEXT = `
PromptWar̊e ØS Software Kernel
Usage: deno run -A syscall.ts --root <os_root> <command> [args...]

Commands:
  resolve <uri> [base]   Resolve a URI to an absolute URL.
  ingest <uri>           Fetch and hydrate a Markdown file.
  memory <action> ...    Manage OS memory (get/set/delete/list).

Options:
  --root <url>    The OS Root URL (Required).
  --help, -h      Show this help message.
`;

// --- Core Logic: Path Resolution ---

function isUrl(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a URI against a Base and Root.
 * Implements the "Law of Anchoring" and "TypeScript Import" style.
 */
export function resolveUri(root: string, uri: string, base?: string): string {
  // 1. Absolute URLs (http://, https://, file://)
  if (isUrl(uri)) {
    // Handle os:// protocol
    if (uri.startsWith("os://")) {
      const path = uri.replace("os://", "");
      return new URL(path, root).href;
    }
    return uri;
  }

  // 2. OS-Absolute Paths (starting with /)
  // Anchored to OS Root
  if (uri.startsWith("/")) {
    // Remove leading slash to append to root
    return new URL(uri.slice(1), root).href;
  }

  // 3. Relative Paths (./, ../, or simple filenames)
  // Anchored to Base (Context)
  if (base) {
    // If base is a URL
    if (isUrl(base)) {
      return new URL(uri, base).href;
    }
    // If base is a local file path
    return join(dirname(base), uri);
  }

  // 4. Fallback: If no base, assume relative to Root
  return new URL(uri, root).href;
}

// --- Core Logic: Ingestion (JIT Linker) ---

async function fetchContent(path: string): Promise<string> {
  if (isUrl(path)) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.statusText}`);
    return res.text();
  } else {
    return Deno.readTextFile(path);
  }
}

async function getSkillDescription(path: string): Promise<string> {
  try {
    const content = await fetchContent(path);
    const match = content.match(/^---\n([\s\S]+?)\n---/);
    if (match) {
      const fm = parse(match[1]) as any;
      return fm.description || fm.title || "No description provided.";
    }
    return "No front matter found.";
  } catch (e: any) {
    return `Error reading skill: ${e.message}`;
  }
}

async function getToolHelp(path: string): Promise<string> {
  try {
    // For tools, we execute them with --help
    // If it's a URL, we use `deno run <url>`
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    if (output.success) {
      return new TextDecoder().decode(output.stdout).trim();
    } else {
      return `Error running tool: ${new TextDecoder().decode(output.stderr)}`;
    }
  } catch (e: any) {
    return `Error executing tool: ${e.message}`;
  }
}

async function ingest(root: string, targetUri: string): Promise<string> {
  // Resolve the target URI first (assuming it's relative to root if no base provided, 
  // or we could require absolute. For now, let's assume the caller resolved it or it's absolute)
  // Actually, osIngest in Kernel usually takes a path. Let's resolve it against root if it's not absolute.
  const resolvedPath = resolveUri(root, targetUri);
  
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
        const absoluteSkillPath = resolveUri(root, skillPath, resolvedPath);
        const description = await getSkillDescription(absoluteSkillPath);
        hydratedSkills.push({ [skillPath]: { description } });
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
        const absoluteToolPath = resolveUri(root, toolPath, resolvedPath);
        const description = await getToolHelp(absoluteToolPath);
        hydratedTools.push({ [toolPath]: { description } });
      } else {
        hydratedTools.push(toolPath);
      }
    }
    fm.tools = hydratedTools;
  }

  // Inject __filename into the frontmatter (or just return it? The Kernel handles the register)
  // But we can update the content to include it if we wanted. 
  // For now, we just return the hydrated content.
  
  const newFm = stringify(fm);
  return `---\n${newFm}---\n${body}`;
}

// --- Core Logic: Memory ---

async function memory(action: string, keyStr?: string, value?: string): Promise<void> {
  const kv = await Deno.openKv(); // Uses default location or --location flag
  try {
    const parseKey = (k: string) => k.split("/").filter(p => p.length > 0);

    if (action === "set") {
      if (!keyStr || value === undefined) throw new Error("Missing key or value");
      await kv.set(parseKey(keyStr), value);
      console.log(`[ OK ] Set ${keyStr}`);
    } else if (action === "get") {
      if (!keyStr) throw new Error("Missing key");
      const res = await kv.get(parseKey(keyStr));
      console.log(res.value === null ? "[ NULL ]" : res.value);
    } else if (action === "delete") {
      if (!keyStr) throw new Error("Missing key");
      await kv.delete(parseKey(keyStr));
      console.log(`[ OK ] Deleted ${keyStr}`);
    } else if (action === "list") {
      const prefix = keyStr ? parseKey(keyStr) : [];
      for await (const entry of kv.list({ prefix })) {
        console.log(`${entry.key.join("/")}: ${entry.value}`);
      }
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    kv.close();
  }
}

// --- Main Dispatcher ---

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
  if (!root) {
    console.error("Error: --root <url> is required.");
    Deno.exit(1);
  }

  const command = args._[0];
  
  try {
    switch (command) {
      case "resolve": {
        const uri = String(args._[1]);
        const base = args._[2] ? String(args._[2]) : undefined;
        if (!uri) throw new Error("Missing uri argument");
        console.log(resolveUri(root, uri, base));
        break;
      }
      case "ingest": {
        const uri = String(args._[1]);
        if (!uri) throw new Error("Missing uri argument");
        const content = await ingest(root, uri);
        console.log(content);
        break;
      }
      case "memory": {
        const action = String(args._[1]);
        const key = args._[2] ? String(args._[2]) : undefined;
        const value = args._[3] ? String(args._[3]) : undefined;
        await memory(action, key, value);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP_TEXT);
        Deno.exit(1);
    }
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
