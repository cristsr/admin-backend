import { IdempotencyPurgeScheduler } from './idempotency-purge.scheduler';

describe('IdempotencyPurgeScheduler', () => {
  it('deletes idempotency keys whose expires_at is in the past', async () => {
    const repo = { deleteExpired: jest.fn().mockResolvedValue(3) } as any;
    const scheduler = new IdempotencyPurgeScheduler(repo);

    await scheduler.purge();

    expect(repo.deleteExpired).toHaveBeenCalledWith(expect.any(Date));
  });
});
