import { HealthController } from './health.controller';

describe('HealthController', () => {
  const build = (healthCheckService: any, typeOrmHealthIndicator: any, oidcHealthIndicator: any) =>
    new HealthController(healthCheckService, typeOrmHealthIndicator, oidcHealthIndicator);

  it('liveness runs no indicators (proceso vivo, sin tocar dependencias)', async () => {
    const healthCheckService = {
      check: jest.fn().mockResolvedValue({ status: 'ok', info: {}, error: {}, details: {} }),
    };
    const ctrl = build(healthCheckService, {}, {});

    const result = await ctrl.live();

    expect(healthCheckService.check).toHaveBeenCalledWith([]);
    expect(result.status).toBe('ok');
  });

  it('readiness runs the db + oidc indicators', async () => {
    const healthCheckService = {
      check: jest.fn().mockResolvedValue({ status: 'ok' }),
    };
    const typeOrm = {
      pingCheck: jest.fn().mockResolvedValue({ db: { status: 'up' } }),
    };
    const oidc = {
      isHealthy: jest.fn().mockResolvedValue({ oidc: { status: 'up' } }),
    };
    const ctrl = build(healthCheckService, typeOrm, oidc);

    await ctrl.ready();

    // Invoke the indicator callbacks passed to `check` to assert the wiring.
    const indicators = healthCheckService.check.mock.calls[0][0];
    await Promise.all(indicators.map((fn: () => unknown) => fn()));

    expect(typeOrm.pingCheck).toHaveBeenCalledWith('db');
    expect(oidc.isHealthy).toHaveBeenCalledWith('oidc');
    expect(healthCheckService.check).toHaveBeenCalled();
  });
});
