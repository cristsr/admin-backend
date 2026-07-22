import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckResult, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '@shared';
import { OidcHealthIndicator } from './oidc-health.indicator';

/** Public liveness/readiness endpoints; not behind the global JWT guard. */
@ApiTags('finances-health')
@ApiSecurity({})
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly oidc: OidcHealthIndicator,
  ) {}

  /** Liveness: touches no dependencies, so a dependency outage never kills the pod. */
  @Get('live')
  @Public()
  @ApiOperation({
    operationId: 'healthLive',
    summary: 'Liveness — sin tocar dependencias externas.',
  })
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /** Readiness: DB + OIDC reachability; a failed indicator maps to 503. */
  @Get('ready')
  @Public()
  @ApiOperation({
    operationId: 'healthReady',
    summary: 'Readiness — DB + OIDC accesibles.',
  })
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([() => this.db.pingCheck('db'), () => this.oidc.isHealthy('oidc')]);
  }
}
