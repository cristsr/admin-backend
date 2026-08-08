import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_PENDING_REVIEW_PAGE_SIZE } from '@ledger/transactions/application/list-pending-review/list-pending-review.query';
import { MAX_TRANSACTION_PAGE_SIZE } from './transaction-query.dto';

/**
 * Query string of `GET /transactions/pending-review`. Paging only: the inbox is
 * everything the user still has to decide on, so filtering it would defeat its
 * purpose — narrower searches belong to `GET /transactions`.
 */
export class PendingReviewQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_TRANSACTION_PAGE_SIZE,
    default: DEFAULT_PENDING_REVIEW_PAGE_SIZE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TRANSACTION_PAGE_SIZE)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
