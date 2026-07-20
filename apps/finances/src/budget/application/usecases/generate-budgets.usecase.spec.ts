import { Budget, Period } from '@app/budget/domain/budget';
import { Money } from '@app/shared/domain';
import { GenerateBudgetsUsecase } from './generate-budgets.usecase';

describe('GenerateBudgetsUsecase cron metrics', () => {
  it('logs a structured line with budgetsGenerated and a generated correlationId for the run', async () => {
    const budgetRepository: any = {
      matching: jest.fn().mockResolvedValue([
        Budget.create({
          id: 1,
          period: Period.MONTHLY,
          money: Money.of(1000, 'ARS'),
          categoryId: 1,
          accountId: 1,
          user: 1,
          name: 'b',
          repeat: true,
          startDate: new Date(),
          endDate: new Date(),
        } as Budget),
        Budget.create({
          id: 2,
          period: Period.MONTHLY,
          money: Money.of(500, 'ARS'),
          categoryId: 2,
          accountId: 1,
          user: 1,
          name: 'b2',
          repeat: true,
          startDate: new Date(),
          endDate: new Date(),
        } as Budget),
      ]),
      save: jest.fn().mockResolvedValue(undefined),
      deactivate: jest.fn().mockResolvedValue(undefined),
    };
    const logger = { log: jest.fn(), error: jest.fn() };
    const usecase = new GenerateBudgetsUsecase(budgetRepository, logger as any);

    await usecase.execute();

    const metricLine = logger.log.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.includes('budgetsGenerated=2'));
    expect(metricLine).toBeDefined();
    expect(metricLine).toContain('correlationId=');
  });
});
