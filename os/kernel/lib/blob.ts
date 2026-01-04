/**
 * BlobPointer Implementation (RFC 0025)
 * 
 * A BlobPointer is a minimal JSON-serializable object used to point to an 
 * external blob resource (e.g., a local file, an HTTPS URL, or a Data URL) 
 * from within PromptWar̊e ØS OsMessages.
 */

export interface BlobPointer {
  scheme: "file" | "https" | "data";
  path: string;
  authority?: string;
  query?: string;
  fragment?: string;
}

/**
 * Type guard to check if a value is a BlobPointer.
 */
export function isBlobPointer(value: unknown): value is BlobPointer {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<BlobPointer>;
  return (
    typeof candidate.scheme === "string" &&
    typeof candidate.path === "string" &&
    ["file", "https", "data"].includes(candidate.scheme)
  );
}

/**
 * Creates a file-scheme BlobPointer.
 * 
 * @param absolutePath The absolute path to the file.
 * @returns A valid BlobPointer object.
 * @throws Error if the path is not absolute.
 */
export function createBlobPointer(absolutePath: string): BlobPointer {
  if (!absolutePath.startsWith("/")) {
    throw new Error(`BlobPointer path must be absolute: ${absolutePath}`);
  }
  return {
    scheme: "file",
    path: absolutePath,
  };
}
