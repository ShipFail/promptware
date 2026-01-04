import { create, insert, search, insertMultiple, remove, type Orama, type Results } from "npm:@orama/orama@2.0.16";
import { getEmbeddingModel } from "./embeddings.ts";

// Fixed Schema for PromptWare OS
const SCHEMA = {
  id: "string",
  text: "string",
  metadata: "string", // Stored as JSON string to be schema-agnostic
  embedding: "vector[384]", // Fixed 384-dim for MiniLM
} as const;

type VectorDocument = {
  id: string;
  text: string;
  metadata: string;
  embedding: number[];
};

export class VectorDriver {
  private kv: Deno.Kv;
  private indices: Map<string, Orama<typeof SCHEMA>> = new Map();
  private embedder = getEmbeddingModel();

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  /**
   * Get or Create (and Hydrate) an Orama index for a collection
   */
  private async getIndex(collection: string): Promise<Orama<typeof SCHEMA>> {
    if (this.indices.has(collection)) {
      return this.indices.get(collection)!;
    }

    // Create new index
    const index = await create({
      schema: SCHEMA,
    });

    // Hydrate from KV
    // Key: ["vector", "store", collection, id]
    const iter = this.kv.list<VectorDocument>({ prefix: ["vector", "store", collection] });
    const docs: VectorDocument[] = [];
    
    for await (const entry of iter) {
      docs.push(entry.value);
    }

    if (docs.length > 0) {
      await insertMultiple(index, docs);
    }

    this.indices.set(collection, index);
    return index;
  }

  async embed(text: string): Promise<number[]> {
    return await this.embedder.embed(text);
  }

  async store(collection: string, id: string, text: string, metadata: Record<string, any> = {}): Promise<void> {
    const embedding = await this.embed(text);
    const doc: VectorDocument = {
      id,
      text,
      metadata: JSON.stringify(metadata),
      embedding,
    };

    // 1. Persist to KV (Source of Truth)
    await this.kv.set(["vector", "store", collection, id], doc);

    // 2. Update In-Memory Index
    const index = await this.getIndex(collection);
    
    // Upsert logic: Try to remove first (ignore if not found)
    try {
      await remove(index, id);
    } catch {
      // Ignore error if document doesn't exist
    }
    
    await insert(index, doc);
  }

  async search(collection: string, query: string, limit: number = 5, threshold: number = 0.0): Promise<any[]> {
    const index = await this.getIndex(collection);
    const vector = await this.embed(query);

    const results: Results<any> = await search(index, {
      mode: "vector",
      vector: {
        value: vector,
        property: "embedding",
      },
      similarity: threshold, // Orama uses cosine similarity? Check docs. 
      // Actually Orama 2.0 vector search syntax might differ slightly.
      // Using standard vector search params.
      limit,
    });

    return results.hits.map((hit) => ({
      id: hit.document.id,
      text: hit.document.text,
      metadata: JSON.parse(hit.document.metadata as string),
      score: hit.score,
    }));
  }

  async delete(collection: string, id: string): Promise<void> {
    // 1. Delete from KV
    await this.kv.delete(["vector", "store", collection, id]);

    // 2. Remove from Index
    if (this.indices.has(collection)) {
      const index = this.indices.get(collection)!;
      try {
        await remove(index, id);
      } catch {
        // Ignore if not found
      }
    }
  }

  async close(): Promise<void> {
    await this.kv.close();
  }
}
