import { GenerateScheduledMovementsUsecase } from './generate-scheduled-movements.usecase';

describe('GenerateScheduledMovementsUsecase (cron metrics)', () => {
  it('logs a structured line with scheduledMaterialized and a generated correlationId for the run', async () => {
    const scheduledRepository: any = {
      matching: jest.fn().mockResolvedValue([
        { id: 1, user: 1, recurs: () => false },
        { id: 2, user: 1, recurs: () => false },
      ]),
      removeMatching: jest.fn().mockResolvedValue(1),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const movementRepository: any = {
      save: jest.fn().mockResolvedValue({ id: 10 }),
    };
    const logger = { log: jest.fn(), error: jest.fn() };
    const usecase = new GenerateScheduledMovementsUsecase(
      scheduledRepository,
      movementRepository,
      logger as any,
    );

    await usecase.execute();

    const metricLine = logger.log.mock.calls
      .map((c) => String(c[0]))
      .find((m) => m.includes('scheduledMaterialized=2'));
    expect(metricLine).toBeDefined();
    expect(metricLine).toContain('correlationId=');
  });
});
