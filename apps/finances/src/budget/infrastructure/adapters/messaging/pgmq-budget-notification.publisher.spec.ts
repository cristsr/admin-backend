import { BudgetThreshold } from '@app/budget/application/budget.constants';
import { PgmqBudgetNotificationPublisher } from './pgmq-budget-notification.publisher';

const payload = {
  budgetId: 1,
  percentage: 85,
  threshold: BudgetThreshold.WARNING,
  user: 7,
};

describe('PgmqBudgetNotificationPublisher', () => {
  it('publishes to the configured queue with the serialized payload', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
    const config = { budgetQueue: 'budget_threshold' } as any;
    const publisher = new PgmqBudgetNotificationPublisher(dataSource, config);

    await publisher.publish(payload);

    expect(dataSource.query).toHaveBeenCalledWith('SELECT pgmq.send($1, $2)', [
      'budget_threshold',
      JSON.stringify(payload),
    ]);
  });

  it('does not propagate the error if the queue fails (does not break the movement save)', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('pgmq missing')),
    } as any;
    const config = { budgetQueue: 'budget_threshold' } as any;
    const publisher = new PgmqBudgetNotificationPublisher(dataSource, config);

    await expect(publisher.publish(payload)).resolves.toBeUndefined();
  });
});
