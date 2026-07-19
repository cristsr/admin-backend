import { Injectable } from '@nestjs/common';
import { Account, AccountNotFoundException, AccountRepository } from '../../domain/account';
import { AccountInputDto } from '../dto/account-input.dto';

@Injectable()
export class SaveAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: AccountInputDto, user: number): Promise<Account> {
    const existing = input.id
      ? await this.accountRepository.findByIdAndUser(input.id, user)
      : null;

    if (input.id && !existing) {
      throw new AccountNotFoundException('Account not found');
    }

    const account = Account.create({
      ...existing,
      name: input.name,
      initialBalance: input.initialBalance,
      currency: input.currency,
      allowNegativeBalance:
        input.allowNegativeBalance ?? existing?.allowNegativeBalance ?? false,
      user,
    } as Account);

    return this.accountRepository.save(account);
  }
}
