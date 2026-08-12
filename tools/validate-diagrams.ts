/**
 * Verifies that every identifier inside a Mermaid block names a real symbol of the code
 * it documents. The direction is diagram -> code only: it never checks that all code is
 * documented. See docs/proposals/docs-as-code-mermaid.md for the full convention.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * Documentation unit -> the code roots it documents. Explicit on purpose: implicit
 * derivation from the folder name is what let apps/ledger/docs/shared-kernel/ survive
 * for two weeks describing code that had already moved to libs/cqrs.
 *
 * Every unit is 1:1 except `ledger`, which also resolves `src/accounts` because its
 * `initialize-ledger` flow legitimately names the account handlers that create the
 * technical system accounts, and `shared`, whose README documents why it also covers
 * `src/config` and `src/tooling`.
 */
const UNITS: Record<string, string[]> = {
  'apps/ledger/docs/accounts': ['apps/ledger/src/accounts'],
  'apps/ledger/docs/ledger': ['apps/ledger/src/ledger', 'apps/ledger/src/accounts'],
  'apps/ledger/docs/reconciliation': ['apps/ledger/src/reconciliation'],
  'apps/ledger/docs/reference': ['apps/ledger/src/reference'],
  // `shared` documents the cross-cutting ledger surface: the HTTP kernel (src/shared),
  // the Swagger bootstrap (src/config) and the CLI verifiers (src/tooling).
  'apps/ledger/docs/shared': [
    'apps/ledger/src/shared',
    'apps/ledger/src/config',
    'apps/ledger/src/tooling',
  ],
  'apps/ledger/docs/transactions': ['apps/ledger/src/transactions'],
  'libs/cqrs/docs': ['libs/cqrs/src'],
  'libs/shared/docs': ['libs/shared/src'],
};

/**
 * Always searched as well: a ledger module may legitimately name the cross-cutting
 * policy that governs it (shared -> DryRunPolicy, which lives in libs/cqrs).
 */
const SHARED_ROOTS = ['libs/cqrs/src', 'libs/shared/src', 'apps/ledger/src/shared'];

/** The only by-name exemption. Everything else is exempted by its node shape. */
const EXTERNAL_ACTORS = ['Client', 'User', 'Usuario', 'Postgres', 'Keycloak'];

const DECLARATION =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:class|interface|type|enum|const|let|function\*?)\s+([A-Za-z_$][\w$]*)/;

/** Files whose exported symbols the reverse gate requires to appear in some Mermaid block. */
const DOCUMENTABLE_PATTERN = /\.(handler|controller|projector)\.ts$/;

/** Only class declarations count as documentable — not consts (table names),
 * interfaces or types. The 43 documentable symbols are classes. */
const CLASS_DECLARATION =
  /^\s*export\s+(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?class\s+([A-Za-z_$][\w$]*)/;

export interface Identifier {
  line: number;
  name: string;
}

export interface Finding extends Identifier {
  file: string;
}

/**
 * Lists files under `dir` recursively. Returns empty when the directory is absent:
 * units are migrated one at a time, so a declared doc root may not exist yet.
 */
export function walk(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];

  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out = out.concat(walk(full, ext));
    } else if (entry.endsWith(ext) && !entry.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

export function collectSymbols(roots: string[], opts: { sources?: string[] } = {}): Set<string> {
  const symbols = new Set<string>();
  const contents = opts.sources
    ? opts.sources
    : roots.reduce<string[]>(
        (acc, root) => acc.concat(walk(root, '.ts').map((f) => readFileSync(f, 'utf8'))),
        [],
      );

  for (const content of contents) {
    for (const line of content.split('\n')) {
      const hit = DECLARATION.exec(line);
      if (hit) symbols.add(hit[1]);
    }
  }
  return symbols;
}

/**
 * Collects every identifier that appears in Mermaid blocks across all .md files
 * under `docRoot`. This is the "already documented" side of the reverse gate.
 */
export function collectDocumentedSymbols(
  docRoot: string,
  opts: { sources?: Record<string, string> } = {},
): Set<string> {
  const symbols = new Set<string>();

  const files = opts.sources
    ? Object.entries(opts.sources)
    : walk(docRoot, '.md').map((f): [string, string] => [f, readFileSync(f, 'utf8')]);

  for (const [, content] of files) {
    const lines = content.split('\n');
    let start = -1;

    lines.forEach((raw, index) => {
      const text = raw.trim();
      if (start < 0 && text.indexOf('```mermaid') === 0) {
        start = index;
        return;
      }
      if (start >= 0 && text === '```') {
        const block = lines.slice(start + 1, index).join('\n');
        for (const hit of extractIdentifiers(block)) {
          symbols.add(hit.name);
        }
        start = -1;
      }
    });
  }

  return symbols;
}

/**
 * Collects exported symbols from files matching {@link DOCUMENTABLE_PATTERN}
 * (handlers, controllers, projectors) across all code roots. These are the
 * symbols the reverse gate requires to appear in at least one Mermaid block.
 */
export function collectDocumentableSymbols(
  roots: string[],
  opts: { sources?: string[]; fileNames?: string[] } = {},
): Set<string> {
  const symbols = new Set<string>();

  const fileNames = opts.fileNames ??
    roots.reduce<string[]>(
      (acc, root) => acc.concat(walk(root, '.ts').filter((f) => DOCUMENTABLE_PATTERN.test(f))),
      [],
    );

  const contents = opts.sources ??
    fileNames.map((f) => readFileSync(f, 'utf8'));

  for (let i = 0; i < contents.length; i++) {
    if (fileNames[i] && !DOCUMENTABLE_PATTERN.test(fileNames[i])) continue;
    for (const line of contents[i].split('\n')) {
      const hit = CLASS_DECLARATION.exec(line);
      if (hit) symbols.add(hit[1]);
    }
  }

  return symbols;
}

export function extractIdentifiers(block: string): Identifier[] {
  const found: Identifier[] = [];

  block.split('\n').forEach((raw, index) => {
    const line = index + 1;
    const text = raw.trim();

    // Grouping and external actors never name a symbol.
    if (text.indexOf('subgraph') === 0 || text.indexOf('actor ') === 0) return;

    const participant = /^participant\s+(\S+)(?:\s+as\s+(.+))?$/.exec(text);
    if (participant) {
      const name = (participant[2] || participant[1]).trim();
      if (EXTERNAL_ACTORS.indexOf(name) === -1) found.push({ line, name });
      return;
    }

    // A cylinder [( )] names a table, not a class. Tested before the generic node
    // pattern, which would otherwise swallow it.
    if (/^\S+\[\(/.test(text)) return;

    const node = /^\S+[[(]{1,2}"?([^"\])]+)"?[\])]{1,2}/.exec(text);
    if (node) {
      const name = node[1].split('<br/>')[0].trim();
      if (EXTERNAL_ACTORS.indexOf(name) === -1) found.push({ line, name });
    }
  });

  return found;
}

export function validateFile(file: string, content: string, symbols: Set<string>): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  let start = -1;

  lines.forEach((line, index) => {
    const text = line.trim();
    if (start < 0 && text.indexOf('```mermaid') === 0) {
      start = index;
      return;
    }
    if (start >= 0 && text === '```') {
      const block = lines.slice(start + 1, index).join('\n');
      for (const hit of extractIdentifiers(block)) {
        if (!symbols.has(hit.name)) {
          findings.push({ file, line: start + 1 + hit.line, name: hit.name });
        }
      }
      start = -1;
    }
  });

  return findings;
}

/**
 * The roots a unit is responsible for documenting in the reverse gate. A root
 * that appears in another unit's `UNITS` entry as its primary root belongs to
 * that other unit — e.g. `ledger` lists `src/accounts` only so its
 * `initialize-ledger` flow can name the account handlers, but those handlers
 * are documented by the `accounts` unit, not by `ledger`.
 */
export function ownedRoots(docRoot: string, codeRoots: string[]): string[] {
  const primaryRoots = new Set<string>();
  for (const [other, roots] of Object.entries(UNITS)) {
    if (other === docRoot) continue;
    if (roots.length > 0) primaryRoots.add(roots[0]);
  }
  return codeRoots.filter((root) => !primaryRoots.has(root));
}

/**
 * Reverse direction of the gate: reports documentable symbols (handlers,
 * controllers, projectors) that do not appear in any Mermaid block of the unit.
 * `file` is set to `docRoot` to identify which unit the gap belongs to.
 */
export function runReverseGate(
  docRoot: string,
  codeRoots: string[],
  sharedRoots: string[],
  opts: {
    codeSources?: string[];
    codeFileNames?: string[];
    docSources?: Record<string, string>;
  } = {},
): Finding[] {
  const findings: Finding[] = [];

  const documentable = collectDocumentableSymbols(codeRoots, {
    sources: opts.codeSources,
    fileNames: opts.codeFileNames,
  });
  const documented = collectDocumentedSymbols(docRoot, {
    sources: opts.docSources,
  });

  Array.from(documentable).forEach((name) => {
    if (!documented.has(name)) {
      findings.push({ file: docRoot, line: 0, name });
    }
  });

  return findings;
}

export function main(): Finding[] {
  const all: Finding[] = [];

  for (const docRoot of Object.keys(UNITS)) {
    const codeRoots = UNITS[docRoot];
    const symbols = collectSymbols(codeRoots.concat(SHARED_ROOTS));

    // Forward: diagram -> code (existing)
    for (const file of walk(docRoot, '.md')) {
      const content = readFileSync(file, 'utf8');
      all.push(...validateFile(relative(process.cwd(), file), content, symbols));
    }

    // Reverse: code -> diagram (new) — only over the roots this unit owns; a
    // cross-referenced root (e.g. `ledger` naming `src/accounts`) is documented
    // by its own unit, not required again here.
    all.push(...runReverseGate(docRoot, ownedRoots(docRoot, codeRoots), SHARED_ROOTS));
  }

  return all;
}

function runCli(): void {
  const findings = main();

  if (findings.length === 0) {
    console.log('✓ Every Mermaid identifier resolves to a real symbol, and every documentable symbol is documented.');
    return;
  }

  // Walk everything and report every break before exiting -- the same CLI convention the
  // repo's other verification tooling already follows.
  for (const f of findings) {
    if (f.line === 0) {
      console.error(`✗ ${f.file} — "${f.name}" is not referenced in any diagram of this unit`);
    } else {
      console.error(`✗ ${f.file}:${f.line} — "${f.name}" does not resolve to a known symbol`);
    }
  }
  console.error(`\n${findings.length} issue(s).`);
  process.exit(1);
}

if (require.main === module) runCli();
