import { pipeline } from "npm:@huggingface/transformers@3.0.0";

export interface EmbeddingModel {
  embed(text: string): Promise<number[]>;
}

/**
 * Local Embedding Adapter using transformers.js
 * Model: Xenova/all-MiniLM-L6-v2 (Quantized)
 * Dimensions: 384
 */
export class LocalEmbeddingAdapter implements EmbeddingModel {
  private static instance: any = null;
  private static modelName = "Xenova/all-MiniLM-L6-v2";

  async embed(text: string): Promise<number[]> {
    if (!LocalEmbeddingAdapter.instance) {
      // Lazy load the model
      LocalEmbeddingAdapter.instance = await pipeline(
        "feature-extraction",
        LocalEmbeddingAdapter.modelName,
        {
          quantized: true,
        } as any
      );
    }

    const output = await LocalEmbeddingAdapter.instance(text, {
      pooling: "mean",
      normalize: true,
    });

    // Convert Float32Array to standard number[]
    return Array.from(output.data);
  }
}

/**
 * Mock Embedding Adapter for testing/CI
 * Returns a random 384-dim vector
 */
export class MockEmbeddingAdapter implements EmbeddingModel {
  async embed(_text: string): Promise<number[]> {
    return Array.from({ length: 384 }, () => Math.random());
  }
}

// Factory to get the configured model
export function getEmbeddingModel(): EmbeddingModel {
  // In a real implementation, check config/env
  // For now, default to Local if not in CI, or Mock in CI?
  // Let's default to Local for the "OS" experience, but maybe Mock for tests.
  if (Deno.env.get("TEST_MODE") === "true") {
    return new MockEmbeddingAdapter();
  }
  return new LocalEmbeddingAdapter();
}
