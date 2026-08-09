import { ChainRow } from '@cqrs/domain/event/chain-row.type';
import { EventChainReader } from '@cqrs/domain/ports/event-chain-reader';
import { canonicalJson, sha256Hex } from '@shared';
import { ChainVerifier } from './chain-verifier';

class FakeChainReader extends EventChainReader {
  constructor(private readonly rowsByUser: Record<string, ChainRow[]>) { super(); }

  async readChain(userId: string, fromPosition: bigint, limit: number): Promise<readonly ChainRow[]> {
    return (this.rowsByUser[userId] ?? [])
      .filter((row) => row.globalPosition > fromPosition)
      .slice(0, limit);
  }

  async userIds(): Promise<readonly string[]> {
    return Object.keys(this.rowsByUser);
  }
}

async function chainOf(
  userId: string,
  count: number,
  corruptAt?: number,
): Promise<ChainRow[]> {
  const rows: ChainRow[] = [];
  let prevHash = '';

  for (let i = 1; i <= count; i += 1) {
    const chainInput = {
      eventId: `evt-${userId}-${i}`,
      userId,
      aggregateType: 'Thing',
      aggregateId: 'agg-1',
      sequence: i,
      eventType: 'ThingHappened',
      schemaVersion: 1,
      clientId: 'client-x',
      externalRef: null,
      payload: { n: i },
      occurredAt: '2026-07-22T00:00:00.000Z',
    };
    const correctHash = sha256Hex(prevHash + (await canonicalJson(chainInput)));
    const hash = i === corruptAt ? 'tampered'.padEnd(64, '0') : correctHash;

    rows.push({ globalPosition: BigInt(i), eventId: chainInput.eventId, hash, chainInput });
    prevHash = correctHash; // the real chain continues from the correct hash even if this row lies
  }

  return rows;
}

describe('ChainVerifier', () => {
  it('reports ok for an intact chain', async () => {
    const rows = await chainOf('user-1', 3);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': rows }));

    const report = await verifier.verifyChain();

    expect(report.ok).toBe(true);
    expect(report.usersChecked).toBe(1);
    expect(report.eventsChecked).toBe(3);
    expect(report.breaks).toEqual([]);
  });

  it('reports every break without stopping at the first one (AC-4)', async () => {
    const rowsA = await chainOf('user-a', 3, 2);
    const rowsB = await chainOf('user-b', 2, 1);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-a': rowsA, 'user-b': rowsB }));

    const report = await verifier.verifyChain();

    expect(report.ok).toBe(false);
    expect(report.breaks).toHaveLength(2);
    expect(report.breaks.map((b) => b.userId).sort()).toEqual(['user-a', 'user-b']);
  });

  it('scopes to a single user when userId is given', async () => {
    const rows = await chainOf('user-1', 2, 1);
    const other = await chainOf('user-2', 2);
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': rows, 'user-2': other }));

    const report = await verifier.verifyChain('user-1');

    expect(report.usersChecked).toBe(1);
    expect(report.breaks).toHaveLength(1);
    expect(report.breaks[0].userId).toBe('user-1');
  });

  it('an empty database reports ok with zero users checked', async () => {
    const verifier = new ChainVerifier(new FakeChainReader({}));

    const report = await verifier.verifyChain();

    expect(report).toEqual({ ok: true, usersChecked: 0, eventsChecked: 0, breaks: [] });
  });

  it('a user with no events reports ok with zero events checked', async () => {
    const verifier = new ChainVerifier(new FakeChainReader({ 'user-1': [] }));

    const report = await verifier.verifyChain('user-1');

    expect(report).toEqual({ ok: true, usersChecked: 1, eventsChecked: 0, breaks: [] });
  });
});
