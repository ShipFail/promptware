import { assertEquals, assertExists } from "jsr:@std/assert";
import { SyscallShell } from "./shell.ts";
import { dispatch } from "../lib/dispatch.ts";

Deno.test("Syscall.Shell: Execute simple command", async () => {
  const result = await dispatch(SyscallShell, {
    cmd: "echo",
    args: ["hello world"]
  });

  assertEquals(result.kind, "reply");
  const data = result.data as { stdout: string; stderr: string; code: number };
  assertEquals(data.code, 0);
  assertEquals(data.stdout.trim(), "hello world");
});

Deno.test("Syscall.Shell: Capture stderr", async () => {
  // Use a command that writes to stderr. 
  // 'sh -c' is portable enough for this environment (Linux).
  const result = await dispatch(SyscallShell, {
    cmd: "sh",
    args: ["-c", "echo 'error message' >&2"]
  });

  const data = result.data as { stdout: string; stderr: string; code: number };
  assertEquals(data.code, 0);
  assertEquals(data.stderr.trim(), "error message");
});

Deno.test("Syscall.Shell: Return exit code", async () => {
  const result = await dispatch(SyscallShell, {
    cmd: "sh",
    args: ["-c", "exit 42"]
  });

  const data = result.data as { stdout: string; stderr: string; code: number };
  assertEquals(data.code, 42);
});

Deno.test("Syscall.Shell: Use custom CWD", async () => {
  const result = await dispatch(SyscallShell, {
    cmd: "pwd",
    cwd: "/tmp"
  });

  const data = result.data as { stdout: string; stderr: string; code: number };
  assertEquals(data.code, 0);
  // On Linux /tmp is standard.
  assertEquals(data.stdout.trim(), "/tmp");
});

Deno.test("Syscall.Shell: Use custom Env", async () => {
  const result = await dispatch(SyscallShell, {
    cmd: "sh",
    args: ["-c", "echo $TEST_VAR"],
    env: { "TEST_VAR": "secret_value" }
  });

  const data = result.data as { stdout: string; stderr: string; code: number };
  assertEquals(data.code, 0);
  assertEquals(data.stdout.trim(), "secret_value");
});
