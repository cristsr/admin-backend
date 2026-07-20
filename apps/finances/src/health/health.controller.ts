import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '@shared';
import { OidcHealthIndicator } from './oidc-health.indicator';

/**
 * Two independent health endpoints (AC-2). Both are public — neither sits
 * behind the JWT global guard, so an external probe (NGINX / orchestrator) can
 * reach them without credentials.
 */
@ApiTags('finances-health')
@ApiSecurity({})
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly oidc: OidcHealthIndicator,
  ) {}

  /**
   * Liveness: the process is alive. Touches no dependencies, so a DB/OIDC
   * outage never kills the pod.
   */
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

  /**
   * Readiness: DB + OIDC reachability. Terminus maps a failed indicator to a
   * 503 automatically, and to 200 with `{ status, ..., details: { db, oidc } }`
   * when both are up.
   */
  @Get('ready')
  @Public()
  @ApiOperation({
    operationId: 'healthReady',
    summary: 'Readiness — DB + OIDC accesibles.',
  })
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('db'),
      () => this.oidc.isHealthy('oidc'),
    ]);
  }
}
