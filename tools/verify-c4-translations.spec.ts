import {
  compareView,
  extractC4Messages,
  extractMermaidMessages,
  C4Message,
} from './verify-c4-translations';

describe('extractC4Messages', () => {
  it('extracts message sequences from a LikeC4 dynamic view', () => {
    const c4 = `
dynamic view openAccount {
  title 'Abrir cuenta'
  client -> controller 'POST /accounts'
  controller -> commandBus 'dispatch(OpenAccountCommand)'
  commandBus -> handler 'execute(command)'
  handler -> repository 'save(account)'
}
`;
    const messages = extractC4Messages(c4, 'openAccount');
    expect(messages).toEqual([
      { from: 'client', to: 'controller', text: 'POST /accounts' },
      { from: 'controller', to: 'commandBus', text: 'dispatch(OpenAccountCommand)' },
      { from: 'commandBus', to: 'handler', text: 'execute(command)' },
      { from: 'handler', to: 'repository', text: 'save(account)' },
    ]);
  });

  it('returns empty array when the view is not found', () => {
    const c4 = 'dynamic view other { client -> svc "call" }';
    expect(extractC4Messages(c4, 'missing')).toEqual([]);
  });

  it('skips lines that are not message arrows', () => {
    const c4 = `
dynamic view simple {
  title 'Simple'
  client -> svc 'do'
  note: 'some comment'
}
`;
    const messages = extractC4Messages(c4, 'simple');
    expect(messages).toEqual([{ from: 'client', to: 'svc', text: 'do' }]);
  });
});

describe('extractMermaidMessages', () => {
  it('extracts message sequences from a Mermaid sequenceDiagram', () => {
    const mermaid = [
      'sequenceDiagram',
      '  actor Client',
      '  participant C as LedgerController',
      '  participant CB as CommandBus',
      '  Client->>C: POST /ledger/initialize',
      '  C->>CB: dispatch(InitializeLedgerCommand)',
    ].join('\n');
    const messages = extractMermaidMessages(mermaid);
    expect(messages).toEqual([
      { from: 'Client', to: 'LedgerController', text: 'POST /ledger/initialize' },
      { from: 'LedgerController', to: 'CommandBus', text: 'dispatch(InitializeLedgerCommand)' },
    ]);
  });

  it('resolves participant aliases via "as"', () => {
    const mermaid = [
      'sequenceDiagram',
      '  participant C as LedgerController',
      '  participant B as CommandBus',
      '  C->>B: dispatch(cmd)',
    ].join('\n');
    const messages = extractMermaidMessages(mermaid);
    expect(messages).toEqual([
      { from: 'LedgerController', to: 'CommandBus', text: 'dispatch(cmd)' },
    ]);
  });

  it('ignores Notes and activation markers', () => {
    const mermaid = [
      'sequenceDiagram',
      '  participant S as Service',
      '  Note over S: thinking',
      '  activate S',
      '  Client->>S: request',
      '  deactivate S',
    ].join('\n');
    const messages = extractMermaidMessages(mermaid);
    expect(messages).toEqual([{ from: 'Client', to: 'Service', text: 'request' }]);
  });

  it('returns empty for non-mermaid blocks', () => {
    expect(extractMermaidMessages('just prose')).toEqual([]);
  });
});

describe('compareView', () => {
  it('reports matching sequences as no discrepancy', () => {
    const c4: C4Message[] = [
      { from: 'client', to: 'controller', text: 'POST /x' },
      { from: 'controller', to: 'bus', text: 'dispatch(cmd)' },
    ];
    const mermaid: C4Message[] = [
      { from: 'Client', to: 'Controller', text: 'POST /x' },
      { from: 'Controller', to: 'CommandBus', text: 'dispatch(cmd)' },
    ];
    const result = compareView('test', c4, mermaid);
    expect(result.discrepancies).toEqual([]);
    expect(result.match).toBe(true);
  });

  it('reports difference in message count', () => {
    const c4: C4Message[] = [{ from: 'a', to: 'b', text: 'msg1' }];
    const mermaid: C4Message[] = [
      { from: 'A', to: 'B', text: 'msg1' },
      { from: 'B', to: 'C', text: 'msg2' },
    ];
    const result = compareView('test', c4, mermaid);
    expect(result.match).toBe(false);
    expect(result.discrepancies).toContainEqual(
      expect.stringContaining('message count'),
    );
  });

  it('reports difference in message text', () => {
    const c4: C4Message[] = [{ from: 'a', to: 'b', text: 'old text' }];
    const mermaid: C4Message[] = [{ from: 'A', to: 'B', text: 'new text' }];
    const result = compareView('test', c4, mermaid);
    expect(result.match).toBe(false);
    expect(result.discrepancies).toContainEqual(
      expect.stringContaining('text'),
    );
  });
});
