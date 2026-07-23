import { ApiProperty } from '@nestjs/swagger';

/**
 * Confirmed and pending balance for one account+currency, from the
 * `account_balances` projection. Amounts are exact decimal strings (INV-8).
 */
export class AccountBalanceDto {
  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ example: '125000', description: 'Balance from confirmed transactions.' })
  readonly confirmed: string;

  @ApiProperty({ example: '-31900', description: 'Delta from still-pending transactions.' })
  readonly pending: string;
}
