import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { OsMessage } from "../schema/message.ts";
import { open } from "../lib/crypto.ts";

const PWENC_PREFIX = "pwenc:v1:";

async function unsealHeaders(headers: Headers): Promise<void> {
  for (const [key, value] of headers.entries()) {
    if (value.includes(PWENC_PREFIX)) {
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

export const InputSchema = z.object({
  url: z.string().url().describe("The URL to fetch."),
  init: z.record(z.string(), z.any()).optional().describe("Optional RequestInit object (headers, method, etc)."),
}).describe("Input for the fetch capability.");

export const OutputSchema = z.object({
  ok: z.boolean().describe("True if the response status is 2xx."),
  status: z.number().describe("The HTTP status code."),
  statusText: z.string().describe("The status text."),
  headers: z.record(z.string(), z.string()).describe("The response headers."),
  body: z.string().describe("The response body as text."),
  url: z.string().describe("The final URL after redirects."),
}).describe("Output from the fetch capability.");

export const process = async (input: z.infer<typeof InputSchema>, _message: OsMessage): Promise<z.infer<typeof OutputSchema>> => {
  const req = new Request(input.url, input.init);
  await unsealHeaders(req.headers);
  const res = await fetch(req);
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
};

const capability: Capability<typeof InputSchema, typeof OutputSchema> = {
  type: "command",
  InputSchema,
  OutputSchema,
  process,
  fromArgs: (args: string[]) => {
    if (args.length < 1) throw new Error("Usage: fetch <url> [init_json]");
    return {
      url: args[0],
      init: args[1] ? JSON.parse(args[1]) : undefined,
    };
  },
};

export default capability;
