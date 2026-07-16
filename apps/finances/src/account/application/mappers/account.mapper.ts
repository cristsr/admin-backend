import { Account } from '../../domain/account';
import { AccountOutputDto } from '../dto/account-output.dto';

export class AccountMapper {
  static toOutput(account: Account): AccountOutputDto {
    return {
      id: account.id,
      active: account.active,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      name: account.name,
      initialBalance: account.initialBalance,
      currency: account.currency,
      user: account.user,
    };
  }
}
