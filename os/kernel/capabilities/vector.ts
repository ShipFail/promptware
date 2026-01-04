import { z } from "jsr:@zod/zod";
import { Capability } from "../schema/contract.ts";
import { createMessage } from "../schema/message.ts";
import { VectorDriver } from "../lib/vector-driver.ts";

// --- Schemas ---

const VectorEmbedInput = z.object({
  text: z.string(),
});

const VectorEmbedOutput = z.object({
  vector: z.array(z.number()),
});

const VectorStoreInput = z.object({
  collection: z.string(),
  id: z.string(),
  text: z.string(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const VectorStoreOutput = z.object({
  success: z.boolean(),
  id: z.string(),
});

const VectorSearchInput = z.object({
  collection: z.string(),
  query: z.string(),
  limit: z.number().optional().default(5),
  threshold: z.number().optional().default(0),
});

const VectorSearchOutput = z.object({
  results: z.array(z.object({
    id: z.string(),
    text: z.string(),
    metadata: z.record(z.string(), z.any()),
    score: z.number(),
  })),
});

const VectorDeleteInput = z.object({
  collection: z.string(),
  id: z.string(),
});

const VectorDeleteOutput = z.object({
  success: z.boolean(),
});

// --- Inbound/Outbound ---

const EmbedInbound = z.object({ kind: z.literal("query"), type: z.literal("Vector.Embed"), data: VectorEmbedInput });
const EmbedOutbound = z.object({ kind: z.literal("reply"), type: z.literal("Vector.Embed"), data: VectorEmbedOutput });

const StoreInbound = z.object({ kind: z.literal("command"), type: z.literal("Vector.Store"), data: VectorStoreInput });
const StoreOutbound = z.object({ kind: z.literal("reply"), type: z.literal("Vector.Store"), data: VectorStoreOutput });

const SearchInbound = z.object({ kind: z.literal("query"), type: z.literal("Vector.Search"), data: VectorSearchInput });
const SearchOutbound = z.object({ kind: z.literal("reply"), type: z.literal("Vector.Search"), data: VectorSearchOutput });

const DeleteInbound = z.object({ kind: z.literal("command"), type: z.literal("Vector.Delete"), data: VectorDeleteInput });
const DeleteOutbound = z.object({ kind: z.literal("reply"), type: z.literal("Vector.Delete"), data: VectorDeleteOutput });

// --- Singleton Driver ---
let driver: VectorDriver | null = null;

async function getDriver(): Promise<VectorDriver> {
  if (!driver) {
    // Use default KV path (or :memory: for tests if configured)
    // In a real OS, this should respect --location
    const kv = await Deno.openKv();
    driver = new VectorDriver(kv);
  }
  return driver;
}

export async function shutdownVectorDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// --- Capabilities ---

export default {
  "Vector.Embed": (): Capability<typeof EmbedInbound, typeof EmbedOutbound> => ({
    description: "Generate embeddings for text.",
    inbound: EmbedInbound,
    outbound: EmbedOutbound,
    factory: () => {
      return new TransformStream({
        async transform(msg, controller) {
          const drv = await getDriver();
          const data = msg.data as z.infer<typeof VectorEmbedInput>;
          const vector = await drv.embed(data.text);
          controller.enqueue(createMessage("reply", "Vector.Embed", { vector }, undefined, msg.metadata?.correlation, msg.metadata?.id));
        }
      });
    }
  }),

  "Vector.Store": (): Capability<typeof StoreInbound, typeof StoreOutbound> => ({
    description: "Store a document in the vector database.",
    inbound: StoreInbound,
    outbound: StoreOutbound,
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const drv = await getDriver();
        const data = msg.data as z.infer<typeof VectorStoreInput>;
        await drv.store(data.collection, data.id, data.text, data.metadata);
        controller.enqueue(createMessage("reply", "Vector.Store", { success: true, id: data.id }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  }),

  "Vector.Search": (): Capability<typeof SearchInbound, typeof SearchOutbound> => ({
    description: "Semantic search.",
    inbound: SearchInbound,
    outbound: SearchOutbound,
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const drv = await getDriver();
        const data = msg.data as z.infer<typeof VectorSearchInput>;
        const results = await drv.search(data.collection, data.query, data.limit, data.threshold);
        controller.enqueue(createMessage("reply", "Vector.Search", { results }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  }),

  "Vector.Delete": (): Capability<typeof DeleteInbound, typeof DeleteOutbound> => ({
    description: "Delete a document.",
    inbound: DeleteInbound,
    outbound: DeleteOutbound,
    factory: () => new TransformStream({
      async transform(msg, controller) {
        const drv = await getDriver();
        const data = msg.data as z.infer<typeof VectorDeleteInput>;
        await drv.delete(data.collection, data.id);
        controller.enqueue(createMessage("reply", "Vector.Delete", { success: true }, undefined, msg.metadata?.correlation, msg.metadata?.id));
      }
    })
  })
};
