import { DuplicateExternalRefException } from '@cqrs/domain/exceptions/event-store.exception';
import { TransientPersistenceException } from '@cqrs/domain/exceptions/transient-persistence.exception';
import { DataSource, QueryFailedError } from 'typeorm';
import { PostgresTransactionScope } from '../../transaction/postgres-transaction.scope';
import { PostgresEventStore } from './postgres-event-store';

function queryFailed(code: string, constraint?: string): QueryFailedError {
  return new QueryFailedError('SELECT 1', [], { code, constraint } as never);
}

describe('PostgresEventStore.translate (transient codes)', () => {
  function storeWith(driverError: unknown) {
    const dataSource = {
      transaction: jest.fn(async () => {
        throw driverError;
      }),
      query: jest.fn(),
      createQueryRunner: jest.fn(),
    } as unknown as DataSource;

    return new PostgresEventStore(dataSource, new PostgresTransactionScope());
  }

  it('maps deadlock_detected (40P01) to TransientPersistenceException', async () => {
    const store = storeWith(queryFailed('40P01'));

    await expect(
      store.append({ userId: 'u', aggregateType: 't', aggregateId: 'a' }, 0, [
        { eventId: 'e-1' } as never,
      ]),
    ).rejects.toBeInstanceOf(TransientPersistenceException);
  });

  it('maps serialization_failure (40001) to TransientPersistenceException', async () => {
    const store = storeWith(queryFailed('40001'));

    await expect(
      store.append({ userId: 'u', aggregateType: 't', aggregateId: 'a' }, 0, [
        { eventId: 'e-1' } as never,
      ]),
    ).rejects.toBeInstanceOf(TransientPersistenceException);
  });

  it('keeps mapping the external-ref unique violation to DuplicateExternalRefException', async () => {
    const store = storeWith(queryFailed('23505', 'idx_event_external_ref'));

    await expect(
      store.append({ userId: 'u', aggregateType: 't', aggregateId: 'a' }, 0, [
        { eventId: 'e-1' } as never,
      ]),
    ).rejects.toBeInstanceOf(DuplicateExternalRefException);
  });

  it('lets unrelated driver errors pass through unchanged', async () => {
    const error = queryFailed('22003');
    const store = storeWith(error);

    await expect(
      store.append({ userId: 'u', aggregateType: 't', aggregateId: 'a' }, 0, [
        { eventId: 'e-1' } as never,
      ]),
    ).rejects.toBe(error);
  });
});
