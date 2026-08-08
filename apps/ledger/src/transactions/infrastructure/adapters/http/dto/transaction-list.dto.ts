import { ApiProperty } from '@nestjs/swagger';
import {
  TransactionPage,
} from '@ledger/transactions/application/list-transactions/list-transactions.query';
import { TransactionListItemView } from '@ledger/transactions/application/read-models/transaction-list.read-model';
import { TransactionListItemDto } from './transaction.dto';

/**
 * Response of `GET /transactions`: one page plus how many rows the filters
 * match.
 *
 * Documents {@link TransactionPage}; `implements` keeps the contract and the
 * query handler from drifting apart.
 */
export class TransactionListDto implements TransactionPage {
  @ApiProperty({ type: [TransactionListItemDto] })
  readonly items: readonly TransactionListItemView[];

  @ApiProperty({ description: 'Rows matching the filters, ignoring pagination.' })
  readonly total: number;

  @ApiProperty({ description: 'Page size that was applied.' })
  readonly limit: number;

  @ApiProperty({ description: 'Row offset that was applied.' })
  readonly offset: number;
}
