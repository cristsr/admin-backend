import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Account, AccountRepository } from '../../domain/account';
import { UserAccountFilterDto } from '../dto/account-filter.dto';

@Injectable()
export class FindAccountUsecase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(
    filter: UserAccountFilterDto,
    user: number,
  ): Promise<Nullable<Account>> {
    return this.accountRepository.findByIdAndUser(filter.account, user);
  }
}
