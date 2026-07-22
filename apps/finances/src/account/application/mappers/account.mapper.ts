import { Account } from '@app/account/domain/account';
import { AccountOutputDto } from '../dto/account-output.dto';

export class AccountMapper {
  static toOutput(account: Account): AccountOutputDto {
    return {
      id: account.id,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      name: account.name,
      initialBalance: account.initialBalance.amount,
      currency: account.currencyCode(),
      allowNegativeBalance: account.allowNegativeBalance,
      user: account.user,
    };
  }

  /** Same output plus the live balance, resolved by the account itself. */
  static toOutputWithBalance(account: Account, movementBalance: number): AccountOutputDto {
    return {
      ...AccountMapper.toOutput(account),
      balance: account.liveBalance(movementBalance).amount,
    };
  }
}
