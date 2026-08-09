import { createHash } from 'node:crypto';

type CanonicalizeFn = (value: unknown) => string | undefined;

/**
 * `canonicalize` ships ESM-only (`"type": "module"`, no `require` export
 * condition) while this codebase compiles to CommonJS. A dynamic `import()`
 * is the only way a CJS caller can load it — cached after the first call so
 * the async cost only happens once per process.
 */
let canonicalizeFn: Promise<CanonicalizeFn> | undefined;

function loadCanonicalize(): Promise<CanonicalizeFn> {
  canonicalizeFn ??= import('canonicalize').then((mod) => mod.default as CanonicalizeFn);
  return canonicalizeFn;
}

/**
 * JSON Canonicalization Scheme (RFC 8785 / JCS): the same value always
 * serializes to the same string, regardless of key insertion order. Delegates
 * to `canonicalize`, whose maintainer co-authored the RFC — this project does
 * not reimplement JCS (Anti-Abstraction Gate).
 */
export async function canonicalJson(value: unknown): Promise<string> {
  const canonicalize = await loadCanonicalize();
  const result = canonicalize(value);

  if (result === undefined) {
    throw new Error('canonicalJson: value is not JSON-serializable');
  }

  return result;
}

/** Lowercase hex SHA-256 digest, 64 characters — matches a `char(64)` column. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
