import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Root of the ledger sources. */
const SOURCE_ROOT = __dirname;

/** Packages the core must never reach for (rules Art. 1). */
const FORBIDDEN_IMPORTS = ['@nestjs/', 'typeorm', 'pg', 'express'];

/** The two inner layers, and the layers each one is forbidden to import. */
const FORBIDDEN_LAYERS: Readonly<Record<Layer, readonly string[]>> = {
  domain: ['application', 'infrastructure'],
  application: ['infrastructure'],
};

const IMPORT_SOURCE = /(?:from|require\()\s*'([^']+)'/g;

/** The inner layers whose imports are policed. */
type Layer = 'domain' | 'application';

const isSpec = (path: string): boolean =>
  path.endsWith('.spec.ts') || path.endsWith('.contract.ts');

/** The inner layer a file belongs to, or null when it is infrastructure or wiring. */
const layerOf = (path: string): Layer | null => {
  const segments = relative(SOURCE_ROOT, path).split(sep);

  if (isSpec(path)) return null;
  if (segments.includes('domain')) return 'domain';
  if (segments.includes('application')) return 'application';

  return null;
};

/**
 * Whether an import path crosses into a layer, by segment rather than substring:
 * `@cqrs/application/event/envelope.factory` and `../../infrastructure/x` both
 * count, a file named `application.ts` does not.
 */
const reaches = (source: string, layer: string): boolean => source.split('/').includes(layer);

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') ? [path] : [];
  });

const importsOf = (file: string): readonly string[] =>
  [...readFileSync(file, 'utf8').matchAll(IMPORT_SOURCE)].map(([, source]) => source);

const coreFiles = (): readonly { file: string; layer: Layer }[] =>
  sourceFiles(SOURCE_ROOT).flatMap((file) => {
    const layer = layerOf(file);

    return layer ? [{ file, layer }] : [];
  });

/** Core files importing a banned package. */
const frameworkViolations = (): readonly string[] =>
  coreFiles().flatMap(({ file }) =>
    importsOf(file)
      .filter((source) => FORBIDDEN_IMPORTS.some((banned) => source.startsWith(banned)))
      .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`),
  );

/** Core files importing a layer further out than their own. */
const layerViolations = (): readonly string[] =>
  coreFiles().flatMap(({ file, layer }) =>
    importsOf(file)
      .filter((source) => FORBIDDEN_LAYERS[layer].some((banned) => reaches(source, banned)))
      .map((source) => `${layer}: ${relative(SOURCE_ROOT, file)} -> ${source}`),
  );

/** What `application` must not reach for, now that every read goes through a port. */
const FORBIDDEN_READ_ACCESS = ['read-model-store', 'Criteria'];

/** Core files whose imports mention a forbidden read symbol. */
const readModelViolations = (): readonly string[] =>
  coreFiles().flatMap(({ file, layer }) =>
    layer === 'application'
      ? importsOf(file)
          .filter((source) => FORBIDDEN_READ_ACCESS.some((banned) => source.includes(banned)))
          .map((source) => `${layer}: ${relative(SOURCE_ROOT, file)} -> ${source}`)
      : [],
  );

/**
 * Domain and Application own no technology. Every external access goes
 * through a port, and the adapters do the wiring — which is why the
 * modules declare their providers with explicit factories instead of leaning on
 * `@Injectable` metadata inside the core.
 *
 * `@nestjs/common` had drifted into eleven core files as a bare `@Injectable()`.
 * Harmless-looking, and exactly how a boundary erodes: nothing fails, so nobody
 * notices until real infrastructure follows the same path.
 */
describe('Hexagonal isolation', () => {
  it('keeps framework and driver imports out of domain and application', () => {
    expect(frameworkViolations()).toEqual([]);
  });

  /**
   * The package ban above says nothing about the codebase's own layers, so
   * `application` had drifted into importing `infrastructure` for the projection
   * table names — the physical name and `snake_case` shape of a read model,
   * reaching the use cases. Same erosion, different direction: dependencies
   * point inward only.
   */
  it('keeps dependencies pointing inward across the codebase layers', () => {
    expect(layerViolations()).toEqual([]);
  });

  /**
   * Application states what it needs; infrastructure knows where it lives.
   *
   * The two cases above policed direction, and the read side slipped past
   * them: the table names were declared *inside* `application` precisely so
   * no import would point outward. Nothing failed, and the physical schema —
   * `proj_accounts`, `snake_case`, nullable columns — reached the use cases
   * anyway. Direction was never the whole invariant.
   */
  it('keeps the read model schema out of application', () => {
    expect(readModelViolations()).toEqual([]);
  });
});
