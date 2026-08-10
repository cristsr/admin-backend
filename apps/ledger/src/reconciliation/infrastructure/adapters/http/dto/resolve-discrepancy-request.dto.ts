import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Body of `POST /balance-assertions/{id}/resolve`, introduced by hu-0025 so
 * every write accepts the dry-run preview (AC-4). Empty bodies behave exactly
 * as before — `dryRun` is optional.
 */
export class ResolveDiscrepancyRequestDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;
}
