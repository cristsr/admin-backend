import { collectSymbols, extractIdentifiers, validateFile, walk } from './validate-diagrams';

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
