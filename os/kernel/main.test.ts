import { assertEquals } from "jsr:@std/assert";
import { assertSpyCall, assertSpyCalls, spy, stub } from "jsr:@std/testing/mock";
import { determineMode, createRuntime, kernelMain } from "./main.ts";
import { logger } from "./bus/logger.ts";

Deno.test("Kernel Mode Resolution", async (t) => {
  await t.step("defaults to 'main' when no args provided", () => {
    const mode = determineMode([]);
    assertEquals(mode, "main");
  });

  await t.step("defaults to 'inline' when args are provided", () => {
    const mode = determineMode(["some-arg"]);
    assertEquals(mode, "inline");
  });

  await t.step("respects explicit --mode flag", () => {
    const mode = determineMode(["--mode", "worker"]);
    assertEquals(mode, "worker");
  });

  await t.step("explicit flag overrides implicit detection", () => {
    const mode = determineMode(["arg1", "--mode", "main"]);
    assertEquals(mode, "main");
  });
});

Deno.test("Kernel Runtime Factory", async (t) => {
  await t.step("creates InlineRuntime for 'inline' mode", () => {
    const runtime = createRuntime("inline");
    assertEquals(runtime.constructor.name, "InlineRuntime");
  });

  await t.step("creates MainRuntime for 'main' mode", () => {
    const runtime = createRuntime("main");
    assertEquals(runtime.constructor.name, "MainRuntime");
  });

  await t.step("creates WorkerRuntime for 'worker' mode", () => {
    const runtime = createRuntime("worker");
    assertEquals(runtime.constructor.name, "WorkerRuntime");
  });

  await t.step("throws on unknown mode", () => {
    try {
      createRuntime("invalid-mode");
      throw new Error("Should have thrown");
    } catch (e) {
      assertEquals((e as Error).message, "Unknown mode: invalid-mode");
    }
  });
});

Deno.test("Kernel Lifecycle", async (t) => {
  await t.step("runs the runtime and returns exit code", async () => {
    const mockRuntime = {
      run: spy(async () => 42),
    };
    const mockFactory = spy(() => mockRuntime as any);

    const exitCode = await kernelMain(["--mode", "test"], mockFactory);

    assertEquals(exitCode, 42);
    assertSpyCall(mockFactory, 0, { args: ["test"] });
    assertSpyCall(mockRuntime.run, 0, { args: [] });
  });

  await t.step("handles unknown mode error gracefully", async () => {
    // Stub logger.error to prevent noise
    const errorStub = stub(logger, "error");
    
    try {
      // Use default factory which throws on unknown mode
      const exitCode = await kernelMain(["--mode", "invalid"]);
      
      assertEquals(exitCode, 1);
      assertSpyCalls(errorStub, 2); // Should log error and valid modes
      assertEquals(errorStub.calls[0].args[0], "Error: Unknown mode: invalid");
    } finally {
      errorStub.restore();
    }
  });

  await t.step("handles runtime panic (fatal error)", async () => {
    const fatalStub = stub(logger, "fatal");
    const mockFactory = () => ({
      run: () => { throw new Error("Critical Failure"); }
    } as any);

    try {
      const exitCode = await kernelMain([], mockFactory);

      assertEquals(exitCode, 1);

      // Verify logger.fatal was called once
      assertSpyCalls(fatalStub, 1);

      // Check individual arguments
      const call = fatalStub.calls[0];
      assertEquals(call.args[0], "[Kernel Panic] Critical Failure");
      assertEquals(call.args[1], {});

      // Check the Error object properties (not exact match due to stack trace)
      const err = call.args[2] as Error;
      assertEquals(err.name, "Error");
      assertEquals(err.message, "Critical Failure");
    } finally {
      fatalStub.restore();
    }
  });
});
