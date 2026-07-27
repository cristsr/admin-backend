import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, Matches } from 'class-validator';

/** Decimal string with an optional sign; scale is the currency's business (RNF-2). */
const DECIMAL_AMOUNT = /^-?\d+(\.\d+)?$/;

/**
 * Body of `POST /accounts/{id}/opening-balance` (RF-27). Validates shape only,
 * and deliberately leaves the counterparty account, the transaction status and
 * the posting origin out of the contract: the handler resolves
 * `Equity:OpeningBalances` from the user's own settings and stamps the origin
 * itself, so no request can name a system account or claim to be one
 * (INV-13, §2.10).
 */
export class RecordOpeningBalanceRequestDto {
  @ApiProperty({ example: '1500000.00', description: 'Balance the account already had.' })
  @IsString()
  @IsNotEmpty()
  @Matches(DECIMAL_AMOUNT, { message: 'amount must be a decimal string' })
  readonly amount: string;

  @ApiProperty({ example: 'COP' })
  @IsString()
  @IsNotEmpty()
  readonly currency: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Accounting date of the opening entry (RNF-7); on or after ledger initialization.',
  })
  @IsDateString()
  readonly date: string;
}
