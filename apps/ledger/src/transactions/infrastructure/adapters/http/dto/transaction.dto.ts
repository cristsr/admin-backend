import { ApiProperty } from '@nestjs/swagger';
import { Nullable } from '@shared';
import { TransactionStatus } from '@ledger/shared/domain/posting/transaction-status';
import {
  PostingView,
  TransactionListItemView,
  TransactionView,
} from '@ledger/transactions/application/views/transaction.view';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';

/** A posting as served by the `transaction_list` projection. */
export class TransactionPostingDto implements PostingView {
  @ApiProperty({ format: 'uuid' })
  readonly accountId: string;

  @ApiProperty({ example: '-31900', description: 'Exact decimal string (INV-8).' })
  readonly amount: string;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ type: Object, description: 'Free-form per-posting metadata.' })
  readonly metadata: Readonly<Record<string, string>>;
}

/**
 * A transaction as the list serves it, without its legs.
 *
 * Documents {@link TransactionListItemView}; `implements` is what keeps the
 * contract and the query handler from drifting apart.
 */
export class TransactionListItemDto implements TransactionListItemView {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ format: 'date', example: '2026-07-20' })
  readonly date: string;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description: 'When the movement actually happened, when the caller knew it.',
  })
  readonly occurredAt: Nullable<string>;

  @ApiProperty({ example: 'Netflix', nullable: true })
  readonly payee: Nullable<string>;

  @ApiProperty({ example: 'Monthly subscription' })
  readonly description: string;

  @ApiProperty({ enum: TransactionStatus })
  readonly status: TransactionStatus;

  @ApiProperty({ enum: DerivedKind, description: 'Projector-derived classification.' })
  readonly derivedKind: DerivedKind;

  @ApiProperty({ nullable: true })
  readonly invoiceUrl: Nullable<string>;

  @ApiProperty({ type: [String] })
  readonly tags: readonly string[];

  @ApiProperty({ description: 'The client that recorded it.' })
  readonly clientId: string;

  @ApiProperty({ nullable: true, description: 'Caller-supplied idempotency key (INV-10).' })
  readonly externalRef: Nullable<string>;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'The reversal that cancelled this transaction, when one exists.',
  })
  readonly reversesId: Nullable<string>;

  @ApiProperty({ type: Object })
  readonly metadata: Readonly<Record<string, string>>;
}

/** A single transaction with its legs, as the detail endpoint serves it. */
export class TransactionDto extends TransactionListItemDto implements TransactionView {
  @ApiProperty({ type: [TransactionPostingDto] })
  readonly postings: readonly PostingView[];
}
