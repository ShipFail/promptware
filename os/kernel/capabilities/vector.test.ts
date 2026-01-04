import { assertEquals, assertExists } from "jsr:@std/assert";
import vectorModule, { shutdownVectorDriver } from "./vector.ts";
import { dispatch } from "../test-utils.ts";

// Force Mock Mode for Embeddings to avoid downloading models during test
Deno.env.set("TEST_MODE", "true");

Deno.test("Vector Subsystem", async (t) => {
  const collection = "test-memory";
  const id = "mem-1";
  const text = "PromptWare OS is an AI-native operating system.";
  const metadata = { tag: "os", version: 1 };

  try {
    await t.step("Vector.Embed (Mock)", async () => {
      const result = await dispatch(vectorModule, "Vector.Embed", { text });
      
      assertEquals(result.kind, "reply");
      const data = result.data as { vector: number[] };
      assertExists(data.vector);
      assertEquals(data.vector.length, 384); // Mock adapter returns 384 dims
    });

    await t.step("Vector.Store", async () => {
      const result = await dispatch(vectorModule, "Vector.Store", { 
        collection, 
        id, 
        text, 
        metadata 
      });

      assertEquals(result.kind, "reply");
      const data = result.data as { success: boolean; id: string };
      assertEquals(data.success, true);
      assertEquals(data.id, id);
    });

    await t.step("Vector.Search", async () => {
      const result = await dispatch(vectorModule, "Vector.Search", { 
        collection, 
        query: "AI operating system" 
      });

      assertEquals(result.kind, "reply");
      const data = result.data as { results: any[] };
      const hits = data.results;
      
      assertEquals(hits.length, 1);
      assertEquals(hits[0].id, id);
      assertEquals(hits[0].text, text);
      assertEquals(hits[0].metadata.tag, "os");
      assertExists(hits[0].score);
    });

    await t.step("Vector.Delete", async () => {
      const result = await dispatch(vectorModule, "Vector.Delete", { 
        collection, 
        id 
      });

      assertEquals(result.kind, "reply");
      const data = result.data as { success: boolean };
      assertEquals(data.success, true);
    });

    await t.step("Vector.Search (Empty after delete)", async () => {
      const result = await dispatch(vectorModule, "Vector.Search", { 
        collection, 
        query: "AI operating system" 
      });

      assertEquals(result.kind, "reply");
      const data = result.data as { results: any[] };
      assertEquals(data.results.length, 0);
    });

  } finally {
    // Ensure clean shutdown of the driver (closes KV)
    await shutdownVectorDriver();
  }
});
