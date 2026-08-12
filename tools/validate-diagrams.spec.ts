import {
  collectDocumentableSymbols,
  collectDocumentedSymbols,
  collectSymbols,
  extractIdentifiers,
  runReverseGate,
  validateFile,
  walk,
} from './validate-diagrams';

describe('walk', () => {
  // Units are migrated one at a time, so a declared doc root may not exist yet. Crashing
  // on the first missing folder would make the gate unusable during the migration.
  it('returns empty for a directory that does not exist', () => {
    expect(walk('does/not/exist', '.md')).toEqual([]);
  });

  it('skips .spec.ts files when collecting sources', () => {
    expect(walk('tools', '.ts')).not.toContain('tools/validate-diagrams.spec.ts');
  });
});

describe('collectSymbols', () => {
  // Every declaration form gets its own case: a missed modifier makes the gate report a
  // healthy reference as broken, and the natural reaction is to fix the diagram instead
  // of the script. `canonicalJson` (export async function) already hit this.
  it.each([
    ['export class Foo {}', 'Foo'],
    ['export abstract class Bar {}', 'Bar'],
    ['export async function canonicalJson() {}', 'canonicalJson'],
    ['export function sha256Hex() {}', 'sha256Hex'],
    ['export const REEVALUATION_TRIGGERS = [];', 'REEVALUATION_TRIGGERS'],
    ['export type StreamId = string;', 'StreamId'],
    ['export interface Envelope {}', 'Envelope'],
    ['export enum PostingOrigin {}', 'PostingOrigin'],
    ['export default class Baz {}', 'Baz'],
  ])('indexes %s', (source, expected) => {
    expect(collectSymbols([], { sources: [source] })).toContain(expected);
  });

  it('ignores non-exported declarations', () => {
    expect(collectSymbols([], { sources: ['class Internal {}'] })).not.toContain('Internal');
  });
});

describe('extractIdentifiers — sequenceDiagram', () => {
  it('takes the visible name after "as", not the alias', () => {
    const block = 'sequenceDiagram\n  participant CB as PolicyCommandBus';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'PolicyCommandBus' }]);
  });

  it('takes the bare name when there is no alias', () => {
    const block = 'sequenceDiagram\n  participant EventStore';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'EventStore' }]);
  });

  it('skips whitelisted external actors', () => {
    const block = 'sequenceDiagram\n  actor Client\n  participant U as User';
    expect(extractIdentifiers(block)).toEqual([]);
  });

  it('ignores message arrows, which are not declarations', () => {
    const block = 'sequenceDiagram\n  participant C as Controller\n  C->>CB: dispatch(cmd)';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'Controller' }]);
  });
});

describe('extractIdentifiers — flowchart', () => {
  it('takes the label of a symbol node', () => {
    const block = 'flowchart TB\n  LT("LedgerTransaction")';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'LedgerTransaction' }]);
  });

  it('strips the <br/> suffix used for the stereotype', () => {
    const block = 'flowchart TB\n  ES("EventStore<br/>abstract class")';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'EventStore' }]);
  });

  it('exempts cylinder nodes — they name a table, not a class', () => {
    const block = 'flowchart TB\n  TL[("transaction_list")]';
    expect(extractIdentifiers(block)).toEqual([]);
  });

  it('exempts subgraphs — they group, they do not name a symbol', () => {
    const block = 'flowchart TB\n  subgraph domain["Domain"]\n  end';
    expect(extractIdentifiers(block)).toEqual([]);
  });

  it('ignores edges between already declared nodes', () => {
    const block = 'flowchart TB\n  A("Controller")\n  A --> B';
    expect(extractIdentifiers(block)).toEqual([{ line: 2, name: 'Controller' }]);
  });
});

describe('validateFile', () => {
  const symbols = new Set(['LedgerTransaction']);

  it('reports nothing when every identifier resolves', () => {
    const md = '```mermaid\nflowchart TB\n  LT("LedgerTransaction")\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([]);
  });

  it('reports file, line and identifier when one does not resolve', () => {
    const md = '```mermaid\nflowchart TB\n  X("GhostHandler")\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([
      { file: 'a.md', line: 3, name: 'GhostHandler' },
    ]);
  });

  it('reports every failure, it does not stop at the first', () => {
    const md = '```mermaid\nflowchart TB\n  A("GhostOne")\n  B("GhostTwo")\n```';
    expect(validateFile('a.md', md, symbols)).toHaveLength(2);
  });

  it('ignores fenced blocks that are not mermaid', () => {
    const md = '```typescript\nclass GhostHandler {}\n```';
    expect(validateFile('a.md', md, symbols)).toEqual([]);
  });

  it('handles several mermaid blocks in one file', () => {
    const md = [
      '```mermaid',
      'flowchart TB',
      '  A("GhostOne")',
      '```',
      'prose in between',
      '```mermaid',
      'sequenceDiagram',
      '  participant B as GhostTwo',
      '```',
    ].join('\n');
    expect(validateFile('a.md', md, symbols)).toEqual([
      { file: 'a.md', line: 3, name: 'GhostOne' },
      { file: 'a.md', line: 8, name: 'GhostTwo' },
    ]);
  });
});

describe('collectDocumentableSymbols', () => {
  it('indexes exports from *.handler.ts files', () => {
    const sources = ['export class InitializeLedgerHandler {}'];
    const fileNames = ['fake/handlers/initialize-ledger.handler.ts'];
    const symbols = (collectDocumentableSymbols as any)(['fake/handlers'], {
      sources,
      fileNames,
    });
    expect(symbols).toContain('InitializeLedgerHandler');
  });

  it('indexes exports from *.controller.ts files', () => {
    const sources = ['export class LedgerController {}'];
    const fileNames = ['fake/ledger.controller.ts'];
    const symbols = (collectDocumentableSymbols as any)(['fake'], { sources, fileNames });
    expect(symbols).toContain('LedgerController');
  });

  it('indexes exports from *.projector.ts files', () => {
    const sources = ['export class LedgerSettingsProjector {}'];
    const fileNames = ['fake/ledger-settings.projector.ts'];
    const symbols = (collectDocumentableSymbols as any)(['fake'], { sources, fileNames });
    expect(symbols).toContain('LedgerSettingsProjector');
  });

  it('ignores exports from other file patterns (ports, aggregates, DTOs)', () => {
    const sources = [
      'export abstract class LedgerSettingsFinder {}',
      'export class LedgerSettings {}',
      'export class LedgerSettingsDto {}',
    ];
    const fileNames = [
      'fake/ledger-settings-finder.port.ts',
      'fake/ledger-settings.aggregate.ts',
      'fake/ledger-settings.dto.ts',
    ];
    const symbols = (collectDocumentableSymbols as any)(['fake'], { sources, fileNames });
    expect(symbols.size).toBe(0);
  });

  it('returns empty when no matching files exist', () => {
    const symbols = (collectDocumentableSymbols as any)(['does/not/exist']);
    expect(symbols.size).toBe(0);
  });

  it('skips .spec.ts files even when they match the pattern', () => {
    const sources = ['export const mock = {};'];
    const fileNames = ['fake/test.handler.spec.ts'];
    const symbols = (collectDocumentableSymbols as any)(['fake'], { sources, fileNames });
    expect(symbols.size).toBe(0);
  });
});

describe('collectDocumentedSymbols', () => {
  it('collects identifiers from mermaid blocks in .md files', () => {
    const mdContent = [
      '# Title',
      '```mermaid',
      'flowchart TB',
      '  A("InitializeLedgerHandler")',
      '```',
      'prose',
      '```mermaid',
      'sequenceDiagram',
      '  participant LC as LedgerController',
      '```',
    ].join('\n');
    const symbols = (collectDocumentedSymbols as any)(['fake/docs'], {
      sources: { 'fake/docs/flow.md': mdContent },
    });
    expect(symbols).toContain('InitializeLedgerHandler');
    expect(symbols).toContain('LedgerController');
  });

  it('returns empty when no .md files contain mermaid blocks', () => {
    const symbols = (collectDocumentedSymbols as any)(['fake/docs'], {
      sources: { 'fake/docs/readme.md': '# Just prose, no diagram' },
    });
    expect(symbols.size).toBe(0);
  });

  it('returns empty for a directory that does not exist', () => {
    const symbols = (collectDocumentedSymbols as any)(['does/not/exist']);
    expect(symbols.size).toBe(0);
  });
});

describe('runReverseGate', () => {
  it('reports documentable symbols not referenced in any mermaid block', () => {
    const docRoot = 'fake/docs/ledger';
    const codeRoots = ['fake/src/ledger'];
    const sharedRoots: string[] = [];

    const codeSources = ['export class MissingHandler {}'];
    const codeFileNames = ['fake/src/ledger/missing.handler.ts'];

    const docSources = {
      'fake/docs/ledger/flow.md': [
        '# Flow',
        '```mermaid',
        'sequenceDiagram',
        '  participant C as LedgerController',
        '```',
      ].join('\n'),
    };

    const findings = (runReverseGate as any)(docRoot, codeRoots, sharedRoots, {
      codeSources,
      codeFileNames,
      docSources,
    });

    expect(findings).toEqual([
      { file: docRoot, line: 0, name: 'MissingHandler' },
    ]);
  });

  it('reports nothing when all documentable symbols are referenced', () => {
    const docRoot = 'fake/docs/ledger';
    const codeRoots = ['fake/src/ledger'];
    const sharedRoots: string[] = [];

    const codeSources = ['export class LedgerController {}'];
    const codeFileNames = ['fake/src/ledger/ledger.controller.ts'];

    const docSources = {
      'fake/docs/ledger/flow.md': [
        '# Flow',
        '```mermaid',
        'sequenceDiagram',
        '  participant LC as LedgerController',
        '```',
      ].join('\n'),
    };

    const findings = (runReverseGate as any)(docRoot, codeRoots, sharedRoots, {
      codeSources,
      codeFileNames,
      docSources,
    });

    expect(findings).toEqual([]);
  });

  it('reports nothing when the unit has no documentable symbols', () => {
    const docRoot = 'fake/docs/shared';
    const codeRoots = ['fake/src/shared'];
    const sharedRoots: string[] = [];

    const codeSources = ['export class DomainException {}'];
    const codeFileNames = ['fake/src/shared/domain.exception.ts'];

    const docSources = {};

    const findings = (runReverseGate as any)(docRoot, codeRoots, sharedRoots, {
      codeSources,
      codeFileNames,
      docSources,
    });

    expect(findings).toEqual([]);
  });
});
