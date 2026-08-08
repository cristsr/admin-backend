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

/** The five bounded contexts. `shared` is the kernel: reaching it is always legal. */
const MODULES = ['accounts', 'ledger', 'reconciliation', 'reference', 'transactions'] as const;

/**
 * Cross-module reaches that stay, each with the reason it is defensible.
 * This list only shrinks. An entry removed and not replaced by a real fix
 * turns this suite red — which is the point.
 */
const ALLOWED_CROSS_MODULE: readonly { from: string; to: string; reason: string }[] = [
  {
    from: 'accounts',
    to: 'transactions/infrastructure/projections/account-balances.schema',
    reason:
      'proj_balances lo escribe transactions y lo consulta accounts; contrato declarado en el schema',
  },
  {
    from: 'transactions',
    to: 'accounts/infrastructure/projections/account-tree.schema',
    reason:
      'lee proj_accounts — el adapter pasa a puerto en la Tarea 10, el projector queda con contrato declarado (Tarea 11)',
  },
  {
    from: 'reconciliation',
    to: 'transactions/infrastructure/projections/transaction-list.schema',
    reason: 'AssertionPostingReader ya es el puerto local; contrato declarado (Tarea 11)',
  },
];

/** The bounded context a source file belongs to, or null for bootstrap/tooling/shared. */
const moduleOf = (path: string): string | null => {
  const [first] = relative(SOURCE_ROOT, path).split(sep);

  return MODULES.includes(first as (typeof MODULES)[number]) ? first : null;
};

const isAllowed = (from: string, source: string): boolean =>
  ALLOWED_CROSS_MODULE.some((entry) => entry.from === from && source.includes(entry.to));

/** A module reaching into another module's `domain/` or `infrastructure/`. */
const crossModuleViolations = (): readonly string[] =>
  sourceFiles(SOURCE_ROOT)
    .filter((file) => !isSpec(file))
    .flatMap((file) => {
      const from = moduleOf(file);

      if (!from) return [];

      return importsOf(file)
        .filter((source) => {
          const target = MODULES.find((module) => source.includes(`@ledger/${module}/`));

          if (!target || target === from) return false;
          if (!reaches(source, 'domain') && !reaches(source, 'infrastructure')) return false;

          return !isAllowed(from, source);
        })
        .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`);
    });

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

  /**
   * Direction was never the whole invariant, and neither was the read model:
   * `accounts/application` importing `transactions/domain` points inward and
   * passes every case above. Five bounded contexts that reach into each other's
   * aggregates are one context with five folders — and the coupling is invisible
   * precisely because nothing fails.
   *
   * {@link ALLOWED_CROSS_MODULE} is the declared debt: it only shrinks, and an
   * entry removed without a real fix turns this red.
   */
  it('keeps each module out of its neighbours domain and infrastructure', () => {
    expect(crossModuleViolations()).toEqual([]);
  });

  /**
   * A projection schema states the physical shape of a table. Importing another
   * module's `application` from one points the arrow backwards: `accounts` read
   * `proj_balances`, whose schema then imported `accounts`' own view to build it,
   * closing a loop between two modules that could no longer change apart.
   *
   * The case above does not catch this: `application/views` is neither `domain`
   * nor `infrastructure`, so the reach was invisible to it.
   */
  it('keeps projection schemas free of any other module', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter((file) => file.endsWith('.schema.ts'))
      .flatMap((file) => {
        const owner = moduleOf(file);

        return importsOf(file)
          .filter((source) => {
            const target = MODULES.find((module) => source.includes(`@ledger/${module}/`));

            return Boolean(target) && target !== owner;
          })
          .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`);
      });

    expect(offenders).toEqual([]);
  });

  /**
   * The two schemas another module still reads. Both crossings are defensible
   * and both are in {@link ALLOWED_CROSS_MODULE}, but an allowlist entry lives
   * in this file — the person renaming a column is reading the schema. So the
   * contract is stated there too, or it does not exist where it matters.
   */
  it.each([
    'accounts/infrastructure/projections/account-tree.schema.ts',
    'transactions/infrastructure/projections/transaction-list.schema.ts',
  ])('declares the read contract of %s', (relativePath) => {
    const source = readFileSync(join(SOURCE_ROOT, relativePath), 'utf8');

    expect(source).toMatch(/Public read contract of the/);
  });
});
