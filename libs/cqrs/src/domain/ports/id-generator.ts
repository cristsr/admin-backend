/** Identifier source as a port so tests get reproducible ids. */
export abstract class IdGenerator {
  /** A new unique identifier, UUID v4 shaped. */
  abstract next(): string;
}
