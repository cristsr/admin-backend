import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Root of this library's sources. */
const SOURCE_ROOT = __dirname;

/**
 * Path aliases owned by an application. Importing any of them here would mean
 * this library knows about a particular business domain.
 */
const APPLICATION_ALIASES = ['@ledger/', '@app/'];

const IMPORT_SOURCE = /(?:from|require\()\s*'([^']+)'/g;

const sourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return path.endsWith('.ts') ? [path] : [];
  });

const violations = (): readonly string[] =>
  sourceFiles(SOURCE_ROOT).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(IMPORT_SOURCE)]
      .map(([, source]) => source)
      .filter((source) => APPLICATION_ALIASES.some((alias) => source.startsWith(alias)))
      .map((source) => `${relative(SOURCE_ROOT, file)} -> ${source}`),
  );

/**
 * This library is event sourcing and CQRS machinery: an event store, buses,
 * projections. It must stay ignorant of what is being recorded.
 *
 * The rule is the whole reason the library exists. Before the split, the same
 * folder held `AccountName`, `Payee` and a balance verifier alongside the event
 * store — infrastructure that had quietly learnt double-entry bookkeeping.
 * Nx tags stop an app from reaching in the wrong direction; this stops the
 * library from reaching out.
 */
describe('Domain independence', () => {
  it('never imports from an application', () => {
    expect(violations()).toEqual([]);
  });
});
