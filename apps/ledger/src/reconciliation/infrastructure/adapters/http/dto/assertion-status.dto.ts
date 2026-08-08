import { ApiProperty } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { AssertionStatusView } from '@ledger/reconciliation/application/read-models/assertion-status.read-model';
import { AssertionStatus } from '@ledger/reconciliation/domain/balance-assertion/enums/assertion-status.enum';

/**
 * A balance assertion and its verdict, from the `assertion_status` projection.
 *
 * Documents {@link AssertionStatusView}; `implements` keeps the contract and the
 * query handler from drifting apart.
 */
export class AssertionStatusDto implements AssertionStatusView {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'uuid' })
  readonly accountId: string;

  @ApiProperty({ format: 'date', example: '2026-07-22' })
  readonly date: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'Intraday cutoff, when the assertion states one.',
  })
  readonly occurredAt: Nullable<string>;

  @ApiProperty({ example: '1000', description: 'Exact decimal string (INV-8).' })
  readonly expectedAmount: string;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ example: '0', description: 'Accepted deviation before it counts as a mismatch.' })
  readonly tolerance: string;

  @ApiProperty({ enum: AssertionStatus })
  readonly status: AssertionStatus;

  @ApiProperty({
    nullable: true,
    description: 'Actual minus expected, once evaluated; null while the verdict is pending.',
  })
  readonly difference: Nullable<string>;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The adjustment transaction that closed the discrepancy, when resolved.',
  })
  readonly resolvedByTransactionId: Nullable<string>;

  @ApiProperty({ nullable: true })
  readonly revokeReason: Nullable<string>;

  @ApiProperty({ format: 'date-time', nullable: true, description: 'Last evaluation.' })
  readonly checkedAt: Nullable<string>;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt: string;
}
