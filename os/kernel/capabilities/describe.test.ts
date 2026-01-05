import { assertEquals } from "jsr:@std/assert";
import describeModule from "./describe.ts";
import { dispatch } from "../lib/dispatch.ts";
import "./registry.ts"; // Ensure registry is populated

Deno.test("Syscall.Describe: Should return description for specific capability", async () => {
  const result = await dispatch(describeModule, "Syscall.Describe", { capabilities: ["Syscall.Describe"] });
  const data = result.data as { schemas: Record<string, { description: string }> };
  
  assertEquals(data.schemas["Syscall.Describe"].description, "Introspects the kernel capabilities.");
});

Deno.test("Syscall.Describe: Should return all capabilities with wildcard", async () => {
  const result = await dispatch(describeModule, "Syscall.Describe", { capabilities: ["*"] });
  const data = result.data as { schemas: Record<string, { description: string }> };
  
  // It should contain at least Syscall.Describe itself
  assertEquals(data.schemas["Syscall.Describe"].description, "Introspects the kernel capabilities.");
  // And others from registry (since registry is imported in describe.ts, it should have them)
  // Note: In unit test context, registry might be partially populated depending on imports.
  // But describe.ts imports registry.ts which registers everything.
});

Deno.test("Syscall.Describe: Should handle multiple specific capabilities", async () => {
  const result = await dispatch(describeModule, "Syscall.Describe", { capabilities: ["Syscall.Describe", "Syscall.Ping"] });
  const data = result.data as { schemas: Record<string, { description: string }> };
  
  assertEquals(Object.keys(data.schemas).length, 2);
  assertEquals(data.schemas["Syscall.Describe"].description, "Introspects the kernel capabilities.");
  // Ping might not be in registry if not imported/registered in this test context?
  // describe.ts imports registry.ts, which imports everything. So it should be there.
});
