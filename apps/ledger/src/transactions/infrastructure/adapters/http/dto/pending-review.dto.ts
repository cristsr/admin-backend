import { ApiProperty } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { PendingReviewView } from '@ledger/transactions/application/views/pending-review.view';

/**
 * One entry of the review inbox, from the `pending_review` projection.
 *
 * Documents {@link PendingReviewView}; `implements` keeps the contract and the
 * query handler from drifting apart.
 */
export class PendingReviewDto implements PendingReviewView {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'date', example: '2026-07-20' })
  readonly date: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  readonly occurredAt: Nullable<string>;

  @ApiProperty({ example: 'Netflix', nullable: true })
  readonly payee: Nullable<string>;

  @ApiProperty({ example: 'Monthly subscription' })
  readonly description: string;

  @ApiProperty({ description: 'How many legs the pending transaction has.' })
  readonly postingCount: number;

  @ApiProperty({ description: 'The client that recorded it.' })
  readonly clientId: string;

  @ApiProperty({ nullable: true, description: 'Caller-supplied idempotency key (INV-10).' })
  readonly externalRef: Nullable<string>;
}
