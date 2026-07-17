import { Injectable } from '@nestjs/common';
import { Account, AccountRepository } from '../../domain/account';

@Injectable()
export class FindAllAccountsUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(user: number): Promise<Account[]> {
    return this.accountRepository.findAllByUser(user);
  }
}
