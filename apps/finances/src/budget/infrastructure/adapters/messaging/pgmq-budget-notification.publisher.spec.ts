import { BudgetThreshold } from '../../../application/budget.constants';
import { PgmqBudgetNotificationPublisher } from './pgmq-budget-notification.publisher';

const payload = {
  budgetId: 1,
  percentage: 85,
  threshold: BudgetThreshold.WARNING,
  user: 7,
};

describe('PgmqBudgetNotificationPublisher (AC-1)', () => {
  it('publica en la cola configurada con el payload serializado', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) } as any;
    const config = { get: jest.fn().mockReturnValue('budget_threshold') } as any;
    const publisher = new PgmqBudgetNotificationPublisher(dataSource, config);

    await publisher.publish(payload);

    expect(dataSource.query).toHaveBeenCalledWith('SELECT pgmq.send($1, $2)', [
      'budget_threshold',
      JSON.stringify(payload),
    ]);
  });

  it('no propaga el error si la cola falla (no rompe el guardado del movimiento)', async () => {
    const dataSource = {
      query: jest.fn().mockRejectedValue(new Error('pgmq missing')),
    } as any;
    const config = { get: jest.fn().mockReturnValue(undefined) } as any;
    const publisher = new PgmqBudgetNotificationPublisher(dataSource, config);

    await expect(publisher.publish(payload)).resolves.toBeUndefined();
  });
});
