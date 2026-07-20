import { createHash } from 'crypto';
import { ObjectLiteral } from '@shared';

/** SHA-256 of a request body with sorted keys, so equivalent bodies hash the same. */
export function hashRequestBody(body: ObjectLiteral | undefined): string {
  return createHash('sha256').update(stableStringify(body ?? {})).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.keys(value as ObjectLiteral)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as ObjectLiteral)[key])}`);

  return `{${entries.join(',')}}`;
}
