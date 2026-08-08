import { ApiProperty } from '@nestjs/swagger';
import { BalanceView } from '@ledger/transactions/application/read-models/account-balances.read-model';

/**
 * Confirmed and pending balance for one account+currency, from the
 * `account_balances` projection. Amounts are exact decimal strings (INV-8).
 *
 * Documents {@link BalanceView}; `implements` keeps the contract and the handler
 * from drifting apart.
 */
export class AccountBalanceDto implements BalanceView {
  @ApiProperty({ format: 'uuid' })
  readonly accountId: string;

  @ApiProperty({ example: 'COP' })
  readonly currency: string;

  @ApiProperty({ example: '125000', description: 'Balance from confirmed transactions.' })
  readonly confirmed: string;

  @ApiProperty({ example: '-31900', description: 'Delta from still-pending transactions.' })
  readonly pending: string;
}
