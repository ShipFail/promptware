/**
 * PromptWar̊e ØS Syscall: Echo
 * Simple echo for ABI testing.
 */
export default async function echo(...args: any[]): Promise<string> {
  return args.join(" ");
}
