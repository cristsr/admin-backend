import { ApiProperty } from '@nestjs/swagger';
import { TransactionDto } from './transaction.dto';

/** Response of `GET /transactions`: a page of the `transaction_list` projection. */
export class TransactionListDto {
  @ApiProperty({ type: [TransactionDto] })
  readonly items: TransactionDto[];

  @ApiProperty({ description: 'Total rows matching the filters, ignoring pagination.' })
  readonly total: number;

  @ApiProperty({ description: 'Page size that was applied.' })
  readonly limit: number;

  @ApiProperty({ description: 'Row offset that was applied.' })
  readonly offset: number;
}
