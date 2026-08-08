import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

/** A posting as served by the `transaction_list` projection. */
export class TransactionPostingDto {
  @ApiProperty({ format: 'uuid' })
  readonly accountId: string;

  @ApiProperty({ example: '-31900', description: 'Exact decimal string (INV-8).' })
  readonly amount: string;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;
}

/**
 * A transaction as served by the `transaction_list` projection. A read shape for
 * the OpenAPI contract; the query side is its source of truth.
 */
export class TransactionDto {
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @ApiProperty({ example: '2026-07-20' })
  readonly date: string;

  @ApiPropertyOptional({ example: 'Netflix' })
  readonly payee?: string;

  @ApiProperty({ example: 'Monthly subscription' })
  readonly description: string;

  @ApiProperty({ enum: TransactionStatus })
  readonly status: TransactionStatus;

  @ApiProperty({ enum: DerivedKind, description: 'Projector-derived classification.' })
  readonly derivedKind: DerivedKind;

  @ApiProperty({ type: [TransactionPostingDto] })
  readonly postings: TransactionPostingDto[];

  @ApiPropertyOptional({ type: [String] })
  readonly tags?: string[];
}
