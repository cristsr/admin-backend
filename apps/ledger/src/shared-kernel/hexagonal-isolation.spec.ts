import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Root of the ledger sources. */
const SOURCE_ROOT = join(__dirname, '..');

/** Packages the core must never reach for (RNF-11, rules Art. 1). */
const FORBIDDEN_IMPORTS = ['@nestjs/', 'typeorm', 'pg', 'express'];

const IMPORT_SOURCE = /(?:from|require\()\s*'([^']+)'/g;

const isCoreFile = (path: string): boolean => {
  const segments = relative(SOURCE_ROOT, path).split(sep);

  return (
    (segments.includes('domain') || segments.includes('application')) &&
    !path.endsWith('.spec.ts')
  );
};

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') ? [path] : [];
  });

const violations = (): readonly string[] =>
  sourceFiles(SOURCE_ROOT)
    .filter(isCoreFile)
    .flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(IMPORT_SOURCE)]
        .map(([, source]) => source)
        .filter((source) => FORBIDDEN_IMPORTS.some((banned) => source.startsWith(banned)))
        .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`),
    );

/**
 * RNF-11: Domain and Application own no technology. Every external access goes
 * through a port (§3.8), and the adapters do the wiring — which is why the
 * modules declare their providers with explicit factories instead of leaning on
 * `@Injectable` metadata inside the core.
 *
 * `@nestjs/common` had drifted into eleven core files as a bare `@Injectable()`.
 * Harmless-looking, and exactly how a boundary erodes: nothing fails, so nobody
 * notices until real infrastructure follows the same path.
 */
describe('Hexagonal isolation (RNF-11)', () => {
  it('keeps framework and driver imports out of domain and application', () => {
    expect(violations()).toEqual([]);
  });
});
