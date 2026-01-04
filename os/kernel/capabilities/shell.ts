import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";

// --- Schemas ---

const ShellInput = z.object({
  cmd: z.string(),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

const ShellOutput = z.object({
  stdout: z.string(),
  stderr: z.string(),
  code: z.number(),
});

// --- Inbound/Outbound ---

const ShellInbound = z.object({ 
  kind: z.literal("command"), 
  type: z.literal("Syscall.Shell"), 
  data: ShellInput 
});

const ShellOutbound = z.object({ 
  kind: z.literal("reply"), 
  type: z.literal("Syscall.Shell"), 
  data: ShellOutput 
});

// --- Capability ---

export default {
  "Syscall.Shell": (): Capability<typeof ShellInbound, typeof ShellOutbound> => ({
    description: "Execute a shell command on the host system.",
    inbound: ShellInbound,
    outbound: ShellOutbound,
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const data = msg.data as z.infer<typeof ShellInput>;
        
        const cmd = new Deno.Command(data.cmd, {
          args: data.args,
          cwd: data.cwd,
          env: data.env,
          stdout: "piped",
          stderr: "piped",
        });

        const output = await cmd.output();
        const decoder = new TextDecoder();
        
        const result = {
          stdout: decoder.decode(output.stdout),
          stderr: decoder.decode(output.stderr),
          code: output.code,
        };

        controller.enqueue(createMessage(
          "reply", 
          "Syscall.Shell", 
          result, 
          undefined, 
          msg.metadata?.correlation, 
          msg.metadata?.id
        ));
      }
    })
  })
};
