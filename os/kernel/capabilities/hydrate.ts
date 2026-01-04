import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage, createReply, createError } from "../schema/message.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse, stringify } from "jsr:@std/yaml";
import { resolve, isUrl, getKernelParams } from "../vfs/core.ts";
import { createBlobPointer, BlobPointer } from "../lib/blob.ts";

/**
 * PromptWare ØS Hydrate Capability
 *
 * Fetches and hydrates markdown files (JIT linking).
 * Resolves skill and tool metadata from YAML frontmatter.
 */

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

  try {
    const command = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", path, "--help"],
      stdout: "piped",
      stderr: "piped",
    });
    const output = await command.output();
    const rawOutput = new TextDecoder().decode(output.success ? output.stdout : output.stderr).trim();

    let desc = rawOutput.split("\n\n")[0];

    if (desc.length > MAX_LENGTH) {
      desc = desc.substring(0, MAX_LENGTH) + "... (Run with --help for full usage)";
    }
    return desc;
  } catch (e: any) {
    return `Error executing tool: ${e.message}`;
  }
}

async function hydrate(targetUri: string, explicitRoot?: string): Promise<string> {
  let root: string = explicitRoot || "";

  if (!root) {
    const params = await getKernelParams();
    if (params) {
      root = params.root;
    } else {
      throw new Error("Kernel Panic: proc/cmdline not found. Is the kernel initialized?");
    }
  }

  if (!root) {
    throw new Error("Kernel Panic: No root found. Unable to resolve paths.");
  }

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

  if (Array.isArray(fm.skills)) {
    const hydratedSkills = [];
    for (const skillPath of fm.skills) {
      if (typeof skillPath === "string") {
        const absoluteSkillPath = await resolve(skillPath, resolvedPath, root);
        const metadata = await getSkillMetadata(absoluteSkillPath);
        hydratedSkills.push({ [skillPath]: metadata });
      } else {
        hydratedSkills.push(skillPath);
      }
    }
    fm.skills = hydratedSkills;
  }

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

const InputSchema = z.object({
  uri: z.string().describe("The URI of the resource to hydrate (markdown file)"),
}).describe("Input for the hydrate capability.");

const ReplySchema = z.object({
  code: z.number().describe("HTTP Status. 202=Async, 4xx=Fail."),
  message: z.string().describe("Outcome summary."),
  cause: z.any().optional().describe("Failure reason.")
}).describe("ACK. 202 Accepted triggers 'Kernel.Ingest'.");

export const HydrateModule = {
  "FileSystem.Hydrate": (): Capability<any, any> => ({
    description: "Hydrate a markdown file with metadata.",
    inbound: z.object({
      kind: z.literal("command"),
      type: z.literal("FileSystem.Hydrate"),
      data: InputSchema
    }),
    outbound: z.object({
      kind: z.literal("reply"),
      type: z.literal("FileSystem.Hydrate"),
      data: ReplySchema
    }),
    factory: () => new TransformStream({
      async transform(msg, controller) {
        try {
          const input = msg.data as z.infer<typeof InputSchema>;
          const content = await hydrate(input.uri);
          
          // 1. Send ACK (202 Accepted)
          controller.enqueue(createReply(msg, { code: 202, message: "Accepted" }));

          // 2. Prepare Ingest Payload (BlobPointer vs String)
          let ingestData: string | BlobPointer;
          
          // Threshold: 10KB (safe margin for 16KB limit)
          if (content.length > 10000) {
             const tempFile = await Deno.makeTempFile({ prefix: "pwo-ingest-", suffix: ".md" });
             await Deno.writeTextFile(tempFile, content);
             ingestData = createBlobPointer(tempFile);
          } else {
             ingestData = content;
          }

          // 3. Send Kernel.Ingest Command (Interrupt)
          const ingestMsg = createMessage(
            "command",
            "Kernel.Ingest",
            { data: ingestData },
            undefined, // new ID
            msg.metadata?.correlation,
            msg.metadata?.id // causation is the Hydrate command
          );
          
          controller.enqueue(ingestMsg);

        } catch (e: any) {
          controller.enqueue(createError(msg, e));
        }
      }
    })
  })
};

export default HydrateModule;

// CLI Entry Point
if (import.meta.main) {
  const args = parseArgs(Deno.args, {
    string: ["root"],
    boolean: ["help"],
    alias: { help: "h" },
  });

  if (args.help) {
    console.log(`
Usage: deno run -A hydrate.ts [--root <os_root>] <uri>

Arguments:
  uri     The URI of the markdown file to hydrate.

Options:
  --root <url>    The OS Root URL (optional, loads from KV if not provided).
  --help, -h      Show this help message.
`);
    Deno.exit(0);
  }

  const root = args.root;
  const uri = String(args._[0]);

  if (!uri || uri === "undefined") {
    console.error("Error: Missing uri argument");
    Deno.exit(1);
  }

  try {
    const content = await hydrate(uri, root);
    console.log(content);
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
    Deno.exit(1);
  }
}
