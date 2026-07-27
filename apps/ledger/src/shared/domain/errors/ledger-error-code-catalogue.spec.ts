import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LEDGER_ERROR_CODE } from './ledger-error-code';

/** Root of the ledger sources, walked to collect every declared error code. */
const SOURCE_ROOT = join(__dirname, '..', '..', '..');

/** `readonly code: string = 'SOME_CODE'` / `readonly code = 'SOME_CODE'`. */
const CODE_DECLARATION = /readonly\s+code(?:\s*:\s*string)?\s*=\s*'([A-Z_]+)'/g;

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });

const declaredCodes = (): readonly string[] => {
  const codes = new Set<string>();

  for (const file of sourceFiles(SOURCE_ROOT)) {
    for (const [, code] of readFileSync(file, 'utf8').matchAll(CODE_DECLARATION)) {
      codes.add(code);
    }
  }

  return [...codes].sort();
};

/**
 * `LEDGER_ERROR_CODE` claims to be the single source of truth for the strings the
 * API exposes (RF-14), but nothing forced it to stay that way: exceptions carry
 * their own `code` and the shared filter surfaces it verbatim, so an exception
 * added without touching the constant still reaches clients — as an undocumented
 * code. This walks the sources so the catalogue cannot silently fall behind.
 */
describe('LEDGER_ERROR_CODE catalogue completeness (RF-14)', () => {
  it('lists every error code the ledger sources declare', () => {
    const catalogued = new Set<string>(Object.values(LEDGER_ERROR_CODE));
    const missing = declaredCodes().filter((code) => !catalogued.has(code));

    expect(missing).toEqual([]);
  });

  it('has no entry whose key differs from its value', () => {
    const mismatched = Object.entries(LEDGER_ERROR_CODE).filter(([key, value]) => key !== value);

    expect(mismatched).toEqual([]);
  });
});
