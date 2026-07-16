import { Injectable } from '@nestjs/common';
import { Account, AccountRepository } from '../../domain/account';
import { AccountFilterDto } from '../dto/account-filter.dto';

@Injectable()
export class FindAllAccountsUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(filter: AccountFilterDto): Promise<Account[]> {
    return this.accountRepository.findAllByUser(filter.active, filter.user);
  }
}
