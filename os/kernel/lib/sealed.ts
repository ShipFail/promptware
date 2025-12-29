import { open } from "../handler/crypto.ts";

/**
 * Sealed Handling (RFC 0017)
 * 
 * A minimal abstraction that wraps ciphertext (pwenc:v1:...) and makes
 * accidental plaintext exposure harder.
 */
export class Sealed {
  private constructor(private readonly ciphertext: string) {}

  /**
   * Creates a Sealed instance from a pwenc string.
   * Validates that the input begins with 'pwenc:v1:'.
   */
  static from(pwenc: string): Sealed {
    if (!pwenc.startsWith("pwenc:v1:")) {
      throw new Error("Invalid format: Sealed.from() requires a 'pwenc:v1:' string.");
    }
    return new Sealed(pwenc);
  }

  /**
   * Serializes to the underlying pwenc string.
   * Safe to log, safe to print.
   */
  toString(): string {
    return this.ciphertext;
  }

  /**
   * Serializes to JSON as the underlying pwenc string.
   */
  toJSON(): string {
    return this.ciphertext;
  }

  /**
   * Confined Plaintext Access.
   * Decrypts the secret and passes it to the callback.
   * The callback MUST NOT return the plaintext.
   */
  async use<T>(fn: (secret: string) => Promise<T> | T): Promise<T> {
    const plaintext = await open(this.ciphertext);
    return fn(plaintext);
  }

  /**
   * Unsafe Escape Hatch.
   * Returns the plaintext directly.
   * Requires explicit opt-in.
   */
  async revealUnsafe(options?: { unsafe: boolean }): Promise<string> {
    if (!options?.unsafe) {
      throw new Error("Sealed.revealUnsafe() requires { unsafe: true }.");
    }
    return open(this.ciphertext);
  }
}
