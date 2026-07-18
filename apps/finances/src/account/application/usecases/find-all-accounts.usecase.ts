import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../domain/account';
import { AccountMapper } from '../mappers';
import { AccountOutputDto } from '../dto';

@Injectable()
export class FindAllAccountsUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(user: number): Promise<AccountOutputDto[]> {
    const [accounts, balances] = await Promise.all([
      this.accountRepository.findAllByUser(user),
      this.accountRepository.movementBalancesByUser(user),
    ]);

    return accounts.map((account) => ({
      ...AccountMapper.toOutput(account),
      balance: account.initialBalance + (balances[account.id] ?? 0),
    }));
  }
}
