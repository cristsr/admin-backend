import { EventStore } from '@cqrs/domain/ports/event-store';
import { CommandResult } from '../command-result.type';
import { DryRunPolicy } from './dry-run.policy';

const RESULT: CommandResult = {
  aggregateId: 'agg-1',
  streamPosition: 7n,
  idempotentReplay: false,
};

describe('DryRunPolicy', () => {
  const command = { commandType: 'RecordTransactionCommand' } as never;
  const ctx = { userId: 'u', clientId: 'c', externalRef: null };

  function policyWith(store: EventStore) {
    return new DryRunPolicy(store);
  }

  it('passes through without opening a transaction when dryRun is not set', async () => {
    const withTransaction = jest.fn(
      async (work: () => Promise<CommandResult>, _options?: { rollback?: boolean }) => work(),
    );
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => RESULT);

    await expect(policyWith(store).handle(command, ctx, next)).resolves.toBe(RESULT);

    expect(next).toHaveBeenCalledTimes(1);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('runs the handler inside withTransaction({ rollback: true }) and returns its result', async () => {
    const withTransaction = jest.fn(
      async (work: () => Promise<CommandResult>, _options?: { rollback?: boolean }) => work(),
    );
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => RESULT);

    const result = await policyWith(store).handle(command, { ...ctx, dryRun: true }, next);

    expect(result).toBe(RESULT);
    expect(next).toHaveBeenCalledTimes(1);
    expect(withTransaction).toHaveBeenCalledTimes(1);
    expect(withTransaction.mock.calls[0][1]).toEqual({ rollback: true });
  });

  it('propagates a failing handler', async () => {
    const withTransaction = jest.fn(
      async (work: () => Promise<CommandResult>, _options?: { rollback?: boolean }) => work(),
    );
    const store = { withTransaction } as unknown as EventStore;
    const next = jest.fn(async () => { throw new Error('domain failure'); });

    await expect(
      policyWith(store).handle(command, { ...ctx, dryRun: true }, next),
    ).rejects.toThrow('domain failure');
  });
});
